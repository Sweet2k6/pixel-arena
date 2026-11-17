// =====================================================================================
//  NƯỚNG (BAKE) HIỆU ỨNG & HOẠT ẢNH PIXELFX THÀNH SPRITESHEET
//
//  pixelfx vẽ mọi hiệu ứng bằng code, từng pixel, mỗi khung hình — đẹp nhưng nặng khi có hàng trăm quái.
//  File này chạy pixelfx MỘT LẦN, chụp lại từng frame rồi xếp thành 1 tấm spritesheet:
//      mỗi HÀNG = 1 biến thể (seed khác nhau) hoặc 1 hoạt ảnh (Idle / Run / Skill)
//      mỗi CỘT  = 1 frame theo thời gian
//  Trong game chỉ còn drawImage() từng ô -> rất nhẹ.
//
//  File THUẦN JavaScript (không dùng DOM) nên chạy được ở cả 2 nơi:
//    * trình duyệt  — tự nướng lúc tải nếu thiếu file PNG (dự phòng)
//    * Node.js      — công cụ  game/tools/bake-sprites.mjs  xuất sẵn file PNG vào assets/images
// =====================================================================================
import { createFrame, clearFrame, createFx, composite, painterFor, hex, DUMMY_PAL, posed, skeleton, STAND } from "../../pixelfx-main/src/core/index.js";

// -------------------------------------------------------------------------------------
//  Tiện ích RGBA
// -------------------------------------------------------------------------------------

/** Khung hình trống có bao nhiêu pixel nhìn thấy (alpha > 0)? Trả về hộp bao { x0, y0, x1, y1 } hoặc null */
function alphaBox(rgba, w, h) {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    const row = y * w * 4;
    for (let x = 0; x < w; x++) {
      if (rgba[row + x * 4 + 3] === 0) continue;
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  return x1 < 0 ? null : { x0, y0, x1, y1 };
}

/** Cắt 1 vùng (sx, sy, cw, ch) của ảnh RGBA w x h, có thêm `pad` pixel trong suốt bao quanh */
function crop(rgba, w, h, sx, sy, cw, ch, pad) {
  const ow = cw + pad * 2, oh = ch + pad * 2, out = new Uint8ClampedArray(ow * oh * 4);
  for (let y = 0; y < ch; y++) {
    const yy = sy + y;
    if (yy < 0 || yy >= h) continue;
    for (let x = 0; x < cw; x++) {
      const xx = sx + x;
      if (xx < 0 || xx >= w) continue;
      const s = (yy * w + xx) * 4, d = ((y + pad) * ow + x + pad) * 4;
      out[d] = rgba[s]; out[d + 1] = rgba[s + 1]; out[d + 2] = rgba[s + 2]; out[d + 3] = rgba[s + 3];
    }
  }
  return out;
}

/**
 * Xếp các frame (cùng kích thước fw x fh) thành 1 tấm sheet.
 * grid[row][col] = RGBA (hoặc null = ô trống). Trả về { rgba, width, height, cols, rows }.
 */
export function packSheet(grid, fw, fh) {
  const rows = grid.length, cols = Math.max(...grid.map((r) => r.length));
  const width = cols * fw, height = rows * fh, rgba = new Uint8ClampedArray(width * height * 4);
  grid.forEach((row, r) => row.forEach((fr, c) => {
    if (!fr) return;
    for (let y = 0; y < fh; y++) rgba.set(fr.subarray(y * fw * 4, (y + 1) * fw * 4), ((r * fh + y) * width + c * fw) * 4);
  }));
  return { rgba, width, height, cols, rows };
}

// -------------------------------------------------------------------------------------
//  1. HIỆU ỨNG (one-shot hoặc lặp) — bakeEffect
// -------------------------------------------------------------------------------------
/**
 * Nướng 1 hiệu ứng pixelfx thành sheet.
 *   mod      : module hiệu ứng (import * as fx from ".../hit-spark.js")
 *   o.options: tham số truyền cho hiệu ứng (palette, size, text...)
 *   o.fps    : số frame / giây khi chụp (24 là đủ mượt cho pixel art)
 *   o.maxTime: cắt bớt đuôi hiệu ứng (khói bay lâu...) — tự mờ dần ở `fadeOut` giây cuối
 *   o.variants: số biến thể (mỗi biến thể 1 seed khác, nằm trên 1 hàng riêng)
 * Trả về { rgba, width, height, cols, rows, frameW, frameH, frames, anchorX, anchorY, fps, loop }.
 * anchor = điểm gốc của hiệu ứng trong 1 ô (vị trí truyền vào play(x, y) sẽ trùng điểm này).
 */
export function bakeEffect(mod, o = {}) {
  const meta = mod.meta ?? {};
  const [W, H] = meta.size ?? [128, 128], [OX, OY] = meta.origin ?? [W / 2, H / 2];
  const fps = o.fps ?? 24, loop = !!meta.loop;
  const full = meta.duration ?? 1, dur = Math.min(full, o.maxTime ?? full);
  const cut = dur < full - 1e-6, fadeOut = cut ? Math.min(o.fadeOut ?? 0.25, dur) : 0;
  const n = Math.max(1, loop ? Math.round(dur * fps) : Math.ceil(dur * fps));
  const variants = Math.max(1, o.variants ?? 1);
  const baseSeed = o.options?.seed ?? meta.options?.seed ?? 1;
  const alphaMin = o.alphaMin ?? 10;

  const frame = createFrame(W, H);
  const raw = [];         // raw[v][i] = RGBA W x H
  for (let v = 0; v < variants; v++) {
    const inst = createFx(mod, { ...(o.options ?? {}), x: OX, y: OY, seed: baseSeed + v * 7919 });
    const list = [];
    for (let i = 0; i < n; i++) {
      if (i > 0) inst.update(1 / fps);
      clearFrame(frame);
      inst.draw(frame);
      const rgba = composite(frame, new Uint8ClampedArray(W * H * 4), null);
      // ánh sáng quá mờ (gần như vô hình) chỉ làm ô to ra vô ích -> bỏ
      for (let j = 3; j < rgba.length; j += 4) if (rgba[j] < alphaMin) rgba[j] = 0;
      // cắt đuôi: mờ dần cho khỏi "biến mất cái bụp"
      const t = i / fps;
      if (fadeOut && t > dur - fadeOut) {
        const k = Math.max(0, (dur - t) / fadeOut);
        for (let j = 3; j < rgba.length; j += 4) rgba[j] = rgba[j] * k;
      }
      list.push(rgba);
    }
    raw.push(list);
  }

  // Bỏ các frame trống ở cuối (hiệu ứng đã tắt hẳn) + tìm hộp bao chung để cắt sát
  let last = 0, box = null;
  for (const list of raw) list.forEach((rgba, i) => {
    const b = alphaBox(rgba, W, H);
    if (!b) return;
    last = Math.max(last, i);
    box = box ? { x0: Math.min(box.x0, b.x0), y0: Math.min(box.y0, b.y0), x1: Math.max(box.x1, b.x1), y1: Math.max(box.y1, b.y1) } : b;
  });
  if (!box) box = { x0: OX, y0: OY, x1: OX, y1: OY };
  const frames = loop ? n : last + 1;
  const PAD = 1;   // 1px trong suốt quanh mỗi ô: xoay ảnh không bị "lem" sang ô bên cạnh
  const cw = box.x1 - box.x0 + 1, ch = box.y1 - box.y0 + 1;
  const grid = raw.map((list) => list.slice(0, frames).map((rgba) => crop(rgba, W, H, box.x0, box.y0, cw, ch, PAD)));
  const sheet = packSheet(grid, cw + PAD * 2, ch + PAD * 2);
  return {
    ...sheet, frameW: cw + PAD * 2, frameH: ch + PAD * 2, frames, fps, loop,
    anchorX: OX - box.x0 + PAD, anchorY: OY - box.y0 + PAD,
  };
}

/**
 * Nướng TỪNG FRAME MỘT (không cắt sát, ô = meta.size) — để vừa phát vừa nướng mà không làm khựng khung hình.
 * Trả về { frameW, frameH, anchorX, anchorY, frames, fps, next() } ; next() trả RGBA của frame kế tiếp hoặc null khi hết.
 */
export function createBaker(mod, o = {}) {
  const meta = mod.meta ?? {};
  const [W, H] = meta.size ?? [128, 128], [OX, OY] = meta.origin ?? [W / 2, H / 2];
  const fps = o.fps ?? 30, n = Math.max(1, Math.ceil(Math.min(meta.duration ?? 1, o.maxTime ?? Infinity) * fps));
  const alphaMin = o.alphaMin ?? 10, frame = createFrame(W, H);
  const inst = createFx(mod, { ...(o.options ?? {}), x: OX, y: OY });
  let i = 0;
  return {
    frameW: W, frameH: H, anchorX: OX, anchorY: OY, frames: n, fps, cols: n, rows: 1, loop: false,
    get done() { return i >= n; },
    get baked() { return i; },
    next() {
      if (i >= n) return null;
      if (i > 0) inst.update(1 / fps);
      clearFrame(frame);
      inst.draw(frame);
      const rgba = composite(frame, new Uint8ClampedArray(W * H * 4), null);
      for (let j = 3; j < rgba.length; j += 4) if (rgba[j] < alphaMin) rgba[j] = 0;
      i++;
      return rgba;
    },
  };
}

// -------------------------------------------------------------------------------------
//  2. BỤI CHÂN KHI CHẠY — vẽ tay (pixelfx không có hiệu ứng nào đủ nhỏ)
// -------------------------------------------------------------------------------------
const DUST_RAMP = ["#efe7dc", "#c9bfb8", "#8f8693", "#5a5468"].map((c) => hex(c) >>> 0);
/** 3 cụm bụi nhỏ (mỗi hàng 1 biến thể), 7 frame, gốc = điểm chân chạm đất, bụi bay ngược hướng chạy (sang TRÁI). */
export function bakeDust({ variants = 3, frames = 7, fps = 18 } = {}) {
  const fw = 18, fh = 12, ax = 12, ay = 10;
  const grid = [];
  for (let v = 0; v < variants; v++) {
    let s = 1234 + v * 977;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const puffs = Array.from({ length: 4 + v }, () => ({ x: -rnd() * 5, y: -rnd() * 2, vx: -6 - rnd() * 8, vy: -3 - rnd() * 4, r: 1 + rnd() * 1.6 }));
    const row = [];
    for (let i = 0; i < frames; i++) {
      const t = i / (frames - 1), rgba = new Uint8ClampedArray(fw * fh * 4);
      for (const p of puffs) {
        const px = ax + p.x + p.vx * t, py = ay + p.y + p.vy * t * (1 - t * 0.5);
        const r = p.r * (0.6 + t * 1.3), shade = DUST_RAMP[Math.min(3, Math.floor(t * 3.2 + (p.r > 2 ? 0 : 1)))];
        const alpha = Math.round(255 * (1 - t * t) * 0.9);
        for (let y = Math.floor(py - r); y <= Math.ceil(py + r); y++) for (let x = Math.floor(px - r); x <= Math.ceil(px + r); x++) {
          if (x < 0 || y < 0 || x >= fw || y >= fh) continue;
          if ((x - px) ** 2 + (y - py) ** 2 > r * r) continue;
          const j = (y * fw + x) * 4;
          rgba[j] = shade & 255; rgba[j + 1] = (shade >>> 8) & 255; rgba[j + 2] = (shade >>> 16) & 255;
          rgba[j + 3] = Math.max(rgba[j + 3], alpha);
        }
      }
      row.push(rgba);
    }
    grid.push(row);
  }
  return { ...packSheet(grid, fw, fh), frameW: fw, frameH: fh, frames, fps, loop: false, anchorX: ax, anchorY: ay };
}

// -------------------------------------------------------------------------------------
//  3. NHÂN VẬT HÌNH NGƯỜI — dựng tư thế bằng bộ xương (rig) của pixelfx
// -------------------------------------------------------------------------------------
/** Bảng màu gốc của người pixel pixelfx (A sáng nhất ... J tối nhất, m điểm nhấn, k viền) */
export const BODY_PAL_DEFAULT = { ...DUMMY_PAL };

/** Phụ kiện trên đầu (gốc tọa độ = chân nhân vật, quay mặt sang phải). "x" = màu accent, "y" = accent sáng */
export const HATS = {
  plume: { x: -2, y: -42, rows: ["...yx", "..yxx", ".xxx.", "kxx..", ".k..."] },
  band: { x: -5, y: -37, rows: ["..xxxxxxxxx", "xxyyyyyyyyx", ".x.........", "x.........."] },
  wizard: { x: -6, y: -45, rows: ["........kk..", ".......kxk..", "......kxxk..", ".....kxxyk..", "....kxxxyxk.", "...kxxxxxxk.", "kkkkkkkkkkkkk", ".kyyyyyyyyyk."] },
  helm: { x: -6, y: -40, rows: ["...xxxxxx...", "..xyyyyyyx..", ".xyyyyyyyyx.", ".xx.xxxx.xx."] },
  hood: { x: -6, y: -40, rows: ["...kkkkkk...", "..kxxxxxxk..", ".kxxyyxxxxk.", ".kx......xk."] },
};

/** Làm sáng màu "#rrggbb" -> trả về "#rrggbb" (pixelfx chỉ hiểu dạng hex) */
export function lightenHex(h, k) {
  const v = parseInt(h.slice(1, 7), 16), f = (c) => Math.round(c + (255 - c) * k).toString(16).padStart(2, "0");
  return `#${f((v >> 16) & 255)}${f((v >> 8) & 255)}${f(v & 255)}`;
}

const TAU = Math.PI * 2;
/** Tay gần (tay cầm vũ khí) luôn đưa ra trước ngực — vũ khí được vẽ riêng và xoay theo chuột */
const HOLD = { fx: 7, fy: -19 };

/**
 * >>> TƯ THẾ CỦA TỪNG HOẠT ẢNH (chỉnh ở đây nếu muốn dáng chạy khác)
 * Mỗi hàm nhận u = 0..1 (vị trí trong vòng lặp) và trả về 1 tư thế pixelfx (xem pixelfx-main/src/core/poses.js).
 */
export const HERO_ANIMS = {
  // Đứng yên: thở nhẹ
  idle: {
    frames: 4, fps: 5, loop: true,
    pose: (u) => {
      const b = u < 0.5 ? 0 : 1;
      return { ...HOLD, crouch: b, fy: HOLD.fy + b, bx: 5, by: -15 + b, ffx: -2, fbx: 3 };
    },
  },
  // Chạy: 8 frame, chân bước luân phiên, tay sau vung ngược chân, người hơi đổ về trước
  run: {
    frames: 8, fps: 14, loop: true, contact: [2, 6],   // contact = frame chân chạm đất (tung bụi)
    pose: (u) => {
      const a = u * TAU, s = Math.sin(a), c = Math.cos(a);
      return {
        lean: 4, crouch: 0.5 + 1.5 * Math.abs(s),
        fx: HOLD.fx + 1, fy: HOLD.fy + Math.round(Math.abs(s)),
        bx: 2 - 7 * s, by: -18 + Math.abs(s),
        ffx: 1 + 7 * s, ffy: -4 - 4 * Math.max(0, c),
        fbx: 1 - 7 * s, fby: -4 - 4 * Math.max(0, -c),
      };
    },
  },
  // Lướt / dùng kỹ năng: đổ người, sải chân dài, tay sau vung ra sau
  skill: {
    frames: 4, fps: 14, loop: true,
    pose: (u) => {
      const s = Math.sin(u * TAU);
      return { lean: 8, crouch: 5, fx: 11, fy: -21, bx: -9, by: -22 - s, ffx: 11 + s, ffy: -4, fbx: -11 - s, fby: -6, toeB: true };
    },
  },
};
export const HERO_ROWS = ["idle", "run", "skill"];
export const HERO_FRAME = { w: 48, h: 56, ax: 24, ay: 52 };   // ô 48x56, chân ở (24, 52)

/**
 * Nướng 1 nhân vật hình người: look = { palette, hat, accent } (khối `fallback` trong characters.js).
 * Trả về sheet 3 hàng (idle / run / skill) + vị trí bàn tay cầm vũ khí ở từng frame: hands[row][col] = [x, y] (tính từ chân).
 */
export function bakeHero(look = {}) {
  const pal = { ...BODY_PAL_DEFAULT, ...(look.palette ?? {}) };
  // đổi màu: màu gốc của bộ xương (DUMMY_PAL) -> màu nhân vật
  const recolor = new Map();
  for (const k of Object.keys(DUMMY_PAL)) recolor.set(hex(DUMMY_PAL[k]) >>> 0, hex(pal[k] ?? DUMMY_PAL[k]) >>> 0);
  const hat = HATS[look.hat] ?? null;
  const accent = look.accent ?? "#ff4a3a";
  const hatPal = { k: "#0e0c14", x: accent, y: lightenHex(accent, 0.45) };
  const restHead = skeleton(STAND).joints.head;

  const { w, h, ax, ay } = HERO_FRAME;
  const frame = createFrame(w, h);
  const grid = [], hands = [], counts = [];
  for (const name of HERO_ROWS) {
    const A = HERO_ANIMS[name], row = [], handRow = [];
    for (let i = 0; i < A.frames; i++) {
      const pose = A.pose(i / A.frames);
      clearFrame(frame);
      const r = posed(pose);
      for (let j = 0; j < r.n; j++) {
        const x = ax + r.xs[j], y = ay + r.ys[j];
        if (x < 0 || y < 0 || x >= w || y >= h) continue;
        frame.color[y * w + x] = recolor.get(r.color[j] >>> 0) ?? r.color[j];
      }
      const sk = skeleton(pose).joints;
      if (hat) {
        const dx = Math.round(sk.head[0] - restHead[0]), dy = Math.round(sk.head[1] - restHead[1]);
        painterFor(frame).place(ax + dx, ay + dy, false, 0).sprite(hat.rows, hatPal, hat.x, hat.y);
      }
      row.push(composite(frame, new Uint8ClampedArray(w * h * 4), null));
      handRow.push([Math.round(sk.handN[0]), Math.round(sk.handN[1])]);
    }
    grid.push(row); hands.push(handRow); counts.push(A.frames);
  }
  return {
    ...packSheet(grid, w, h), frameW: w, frameH: h, anchorX: ax, anchorY: ay, hands,
    anims: Object.fromEntries(HERO_ROWS.map((n, i) => [n, { row: i, frames: counts[i], fps: HERO_ANIMS[n].fps, loop: HERO_ANIMS[n].loop, contact: HERO_ANIMS[n].contact ?? [] }])),
  };
}

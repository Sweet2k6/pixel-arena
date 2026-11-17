// =====================================================================================
//  NHÂN VẬT CHIBI KIỂU SOUL KNIGHT — đầu to, thân nhỏ, viền đậm, vẽ bằng code từng pixel
//
//  bakeChibi(spec) -> spritesheet 3 hàng: idle (4 frame) · run (8 frame) · skill (4 frame)
//  Mỗi bộ phận (chân, thân, tay, đầu, mũ...) là 1 "lớp" có viền riêng, tô sáng góc trên-trái và tối góc dưới-phải;
//  vẽ chồng theo thứ tự sau -> trước nên chỗ đầu đè lên thân tự có đường viền ngăn cách như pixel art vẽ tay.
//  File thuần JavaScript (không DOM): chạy được ở trình duyệt lẫn Node (game/tools/bake-sprites.mjs).
//
//  >>> MUỐN SỬA NGOẠI HÌNH: chỉnh bảng màu / kiểu đầu trong CHIBI_LOOKS (fx-config.js),
//      muốn sửa dáng chạy: CHIBI_ANIMS bên dưới.
// =====================================================================================

export const CHIBI_FRAME = { w: 40, h: 44, ax: 20, ay: 42 };   // cùng cỡ ô với spritesheet Thanh Xuân

/** Đổi "#rrggbb" -> [r, g, b] ; làm sáng / tối */
const rgb = (h) => { const v = parseInt(h.slice(1, 7), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; };
const mixc = (a, b, k) => a.map((c, i) => Math.round(c + (b[i] - c) * k));
const tone = (h) => { const c = rgb(h); return { mid: c, hi: mixc(c, [255, 255, 255], 0.35), lo: mixc(c, [10, 6, 20], 0.38) }; };
const INK = [22, 16, 30];

/** 1 lớp vẽ: mặt nạ + màu, toạ độ tính từ CHÂN nhân vật (x sang phải, y âm là lên trên) */
class Layer {
  constructor() { this.px = new Map(); }
  key(x, y) { return `${x},${y}`; }
  set(x, y, c) { this.px.set(this.key(Math.round(x), Math.round(y)), { x: Math.round(x), y: Math.round(y), c }); }
  has(x, y) { return this.px.has(this.key(x, y)); }
  rect(x0, y0, w, h, c) { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) this.set(x, y, c); }
  /** elip đặc tâm (cx, cy) bán kính rx, ry */
  oval(cx, cy, rx, ry, c) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++)
        if (((x + 0.5 - cx - 0.5) / rx) ** 2 + ((y + 0.5 - cy - 0.5) / ry) ** 2 <= 1) this.set(x, y, c);
  }
  poly(pts, c) {   // đa giác đặc
    const ys = pts.map((p) => p[1]);
    for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++) {
      const xs = [];
      for (let i = 0; i < pts.length; i++) {
        const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length];
        if ((y0 <= y + 0.5 && y1 > y + 0.5) || (y1 <= y + 0.5 && y0 > y + 0.5)) xs.push(x0 + ((y + 0.5 - y0) / (y1 - y0)) * (x1 - x0));
      }
      xs.sort((a, b) => a - b);
      for (let i = 0; i + 1 < xs.length; i += 2) for (let x = Math.round(xs[i]); x < Math.round(xs[i + 1]); x++) this.set(x, y, c);
    }
  }
  /** Tô khối: viền sáng trên-trái, tối dưới-phải (chỉ với ô có màu dạng {mid,hi,lo}) */
  shade() {
    for (const p of this.px.values()) {
      if (!p.c.mid) continue;
      const lo = !this.has(p.x + 1, p.y) || !this.has(p.x, p.y + 1);
      const hi = !this.has(p.x - 1, p.y) || !this.has(p.x, p.y - 1);
      p.out = lo ? p.c.lo : hi ? p.c.hi : p.c.mid;
    }
    for (const p of this.px.values()) if (!p.out) p.out = p.c.mid ? p.c.mid : p.c;
  }
}

/** Ghép các lớp (sau -> trước) vào ảnh RGBA; mỗi lớp được viền mực 1px trước khi vẽ */
function compose(layers, rgba, W, H, ax, ay, outline = true) {
  const put = (x, y, c) => {
    const X = ax + x, Y = ay + y;
    if (X < 0 || Y < 0 || X >= W || Y >= H) return;
    const j = (Y * W + X) * 4;
    rgba[j] = c[0]; rgba[j + 1] = c[1]; rgba[j + 2] = c[2]; rgba[j + 3] = 255;
  };
  for (const L of layers) {
    if (!L) continue;
    L.shade();
    if (outline && !L.noOutline) for (const p of L.px.values())
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]])
        if (!L.has(p.x + dx, p.y + dy)) put(p.x + dx, p.y + dy, INK);
    for (const p of L.px.values()) put(p.x, p.y, p.out);
  }
}

// -------------------------------------------------------------------------------------
//  TƯ THẾ theo frame: độ lệch của đầu / thân / chân / tay (pixel)
// -------------------------------------------------------------------------------------
export const CHIBI_ANIMS = {
  idle: { frames: 4, fps: 5, pose: (i) => ({ bob: i >= 2 ? 1 : 0, lean: 0, legN: [0, 0], legF: [0, 0], armF: [0, 0], arm: [0, i >= 2 ? 1 : 0], tail: i }) },
  run: {
    frames: 8, fps: 13, contact: [2, 6],
    pose: (i) => {
      const a = (i / 8) * Math.PI * 2, s = Math.sin(a), c = Math.cos(a);
      return {
        bob: i % 4 === 1 || i % 4 === 3 ? -1 : 0, lean: 1,
        legN: [Math.round(3 * s), -Math.max(0, Math.round(2 * c))],
        legF: [Math.round(-3 * s), -Math.max(0, Math.round(-2 * c))],
        armF: [Math.round(-2 * s), 0], arm: [0, 0], tail: i,
      };
    },
  },
  skill: {
    frames: 4, fps: 14,
    pose: (i) => ({ bob: 1, lean: 3, legN: [4, -1 + (i % 2)], legF: [-5, -1], armF: [-3, 1], arm: [1, 0], tail: i * 2 }),
  },
};
const ROWS = ["idle", "run", "skill"];

/**
 * Vẽ 1 frame. look = { skin, hair, outfit, outfit2, pants, shoes, eyes, head: "knight" | "monk" | "wizard" | "skull" | "helm", accent, accent2 }
 * Trả về { rgba, hand: [x, y] } — hand = vị trí bàn tay cầm vũ khí, tính từ chân.
 */
function drawFrame(look, P, W, H, ax, ay) {
  const T = (h) => tone(h);
  const skin = T(look.skin ?? "#ffd2a8"), outfit = T(look.outfit), outfit2 = T(look.outfit2 ?? look.outfit);
  const pants = T(look.pants ?? "#3a3f55"), shoes = T(look.shoes ?? "#26283a");
  const lean = P.lean, bob = P.bob;
  const bodyY = -6 + bob, headCY = -22 + bob, hx = lean;   // tâm đầu

  // --- tay sau (khuất sau thân)
  const armF = new Layer();
  armF.rect(-6 + P.armF[0], bodyY - 7 + P.armF[1], 3, 5, look.armSkin ? skin : outfit2);
  // --- chân: chân sau rồi chân trước, giày nhô về trước 1px
  const legF = new Layer(), legN = new Layer();
  const leg = (L, x, lift, robe) => {
    if (!robe) L.rect(x, -5 + lift + 1, 3, 4, pants);
    L.rect(x, -2 + lift + 1, 4, 2, shoes);
  };
  leg(legF, -4 + P.legF[0], P.legF[1], look.robe);
  leg(legN, 0 + P.legN[0], P.legN[1], look.robe);
  // --- thân: hình thang bo góc + thắt lưng
  const body = new Layer();
  const bx = Math.round(lean / 2);
  body.poly([[-6 + bx, bodyY - 9], [5 + bx, bodyY - 9], [6 + bx, bodyY + 1], [-7 + bx, bodyY + 1]], outfit);
  if (look.robe) body.poly([[-7 + bx, bodyY], [6 + bx, bodyY], [7 + bx, 0], [-8 + bx, 0]], outfit);   // áo choàng dài
  if (look.belt) body.rect(-6 + bx, bodyY - 2, 12, 1, T(look.belt));
  if (look.chest) body.rect(-1 + bx, bodyY - 8, 2, 4, T(look.chest));
  // --- tay trước (cầm vũ khí) — bàn tay da
  const arm = new Layer();
  const handX = 4 + bx + P.arm[0], handY = bodyY - 4 + P.arm[1];
  arm.rect(1 + bx, bodyY - 8 + P.arm[1], 3, 3, look.armSkin ? skin : outfit2);
  arm.rect(handX - 1, handY - 1, 3, 3, skin);

  // --- ĐẦU (to!) + mặt + tóc / mũ
  const head = new Layer(), face = new Layer(), top = new Layer(), back = new Layer();
  face.noOutline = true;
  const hairC = T(look.hair ?? "#2a1c18");
  const hcx = hx + 0.5, rx = 9.5, ry = 8.5;
  const K = look.head;
  if (K === "knight" || K === "helm") {
    const steel = T(look.helm ?? "#b8c4d8");
    head.oval(hcx, headCY, rx, ry, steel);
    // kính che mặt tối có 2 mắt
    face.poly([[hx - 2, headCY - 2], [hx + 9, headCY - 3], [hx + 9, headCY + 3], [hx - 1, headCY + 3]], [20, 18, 32]);
    const ec = rgb(K === "knight" ? "#ffffff" : look.eyes ?? "#ffd34a");
    face.rect(hx + 2, headCY - 1, 2, 2, ec); face.rect(hx + 6, headCY - 1, 2, 2, ec);
    face.rect(hx - 8, headCY - 5, 1, 4, steel.hi);                      // ánh kim
    if (K === "knight") {   // chùm lông đỏ trên đỉnh, phất ra sau theo frame
      const plume = T(look.accent ?? "#ff4a3a"), w = P.tail % 2;
      back.poly([[hx - 1, headCY - 8], [hx + 3, headCY - 9], [hx - 4, headCY - 13 - w], [hx - 9, headCY - 11 + w]], plume);
    } else {               // mũ sắt kín: sống mũ
      top.rect(hx - 1, headCY - 10, 3, 3, steel);
    }
  } else if (K === "skull") {
    const bone = T(look.skin ?? "#f4f0e0");
    head.oval(hcx, headCY, rx - 0.5, ry, bone);
    face.rect(hx + 1, headCY - 1, 3, 3, [26, 16, 28]); face.rect(hx + 6, headCY - 1, 3, 3, [26, 16, 28]);
    face.set(hx + 2, headCY, rgb("#ff3030")); face.set(hx + 7, headCY, rgb("#ff3030"));
    face.rect(hx + 3, headCY + 4, 5, 1, bone.lo);
    // mũ trùm
    const hood = T(look.accent ?? "#3a3040");
    top.poly([[hx - 10, headCY + 6], [hx - 9, headCY - 6], [hx - 3, headCY - 10], [hx + 6, headCY - 9], [hx + 9, headCY - 4], [hx + 2, headCY - 5], [hx - 4, headCY - 2], [hx - 5, headCY + 6]], hood);
  } else {
    // đầu người: da mặt + tóc
    head.oval(hcx, headCY, rx, ry, skin);
    const eye = rgb(look.eyes ?? "#1a1420");
    face.rect(hx + 2, headCY - 1, 2, 3, eye); face.rect(hx + 6, headCY - 1, 2, 3, eye);
    face.set(hx + 2, headCY - 1, [255, 255, 255]); face.set(hx + 6, headCY - 1, [255, 255, 255]);
    face.rect(hx + 1, headCY + 3, 2, 1, mixc(skin.mid, [255, 110, 130], 0.45));   // má hồng
    face.rect(hx + 7, headCY + 3, 2, 1, mixc(skin.mid, [255, 110, 130], 0.45));
    // tóc phủ nửa trên + sau gáy
    top.poly([[hx - 10, headCY + 4], [hx - 10, headCY - 4], [hx - 6, headCY - 9], [hx + 2, headCY - 10], [hx + 8, headCY - 8], [hx + 10, headCY - 4],
      [hx + 9, headCY - 3], [hx + 4, headCY - 4], [hx + 1, headCY - 3], [hx - 3, headCY - 4], [hx - 5, headCY + 1], [hx - 7, headCY + 5]], hairC);
    if (K === "monk") {   // tóc dựng + băng đô đỏ, 2 đuôi bay ra sau
      for (const [x, h] of [[-5, 3], [-1, 4], [3, 3]]) top.poly([[hx + x - 2, headCY - 8], [hx + x + 2, headCY - 9], [hx + x - 1, headCY - 9 - h]], hairC);
      const band = T(look.accent ?? "#ff3b4a");
      const bandL = new Layer();
      bandL.poly([[hx - 9, headCY - 5], [hx + 9, headCY - 6], [hx + 9, headCY - 4], [hx - 9, headCY - 3]], band);
      const w = [0, 1, 0, -1][P.tail % 4];
      bandL.poly([[hx - 9, headCY - 5], [hx - 15, headCY - 4 + w], [hx - 15, headCY - 2 + w], [hx - 9, headCY - 3]], band);
      bandL.poly([[hx - 9, headCY - 4], [hx - 13, headCY + 1 - w], [hx - 12, headCY + 2 - w], [hx - 9, headCY - 2]], band);
      top.extra = bandL;
    }
    if (K === "wizard") {   // mũ phù thủy to: vành + chóp cong ra sau, dải vàng
      const hat = T(look.accent ?? "#7a52d6");
      const hatL = new Layer();
      hatL.poly([[hx - 12, headCY - 5], [hx + 12, headCY - 6], [hx + 10, headCY - 3], [hx - 11, headCY - 2]], hat);   // vành
      const sw = P.tail % 2;
      hatL.poly([[hx - 7, headCY - 5], [hx + 7, headCY - 6], [hx + 3, headCY - 13], [hx - 3 - sw, headCY - 18], [hx - 8 - sw, headCY - 20], [hx - 4, headCY - 13]], hat);
      hatL.rect(hx - 6, headCY - 8, 12, 2, T(look.accent2 ?? "#ffd34a"));
      top.extra = hatL;
    }
  }

  const rgba = new Uint8ClampedArray(W * H * 4);
  compose([back, armF, legF, legN, body, head, top, top.extra, arm], rgba, W, H, ax, ay);
  compose([face], rgba, W, H, ax, ay, false);
  return { rgba, hand: [handX, handY] };
}

/** Xếp mọi frame thành sheet (mỗi hàng 1 hoạt ảnh) */
export function bakeChibi(look) {
  const { w, h, ax, ay } = CHIBI_FRAME;
  const cols = Math.max(...ROWS.map((r) => CHIBI_ANIMS[r].frames));
  const width = w * cols, height = h * ROWS.length, rgba = new Uint8ClampedArray(width * height * 4);
  const hands = [];
  ROWS.forEach((name, r) => {
    const A = CHIBI_ANIMS[name], row = [];
    for (let i = 0; i < A.frames; i++) {
      const f = drawFrame(look, A.pose(i), w, h, ax, ay);
      for (let y = 0; y < h; y++) rgba.set(f.rgba.subarray(y * w * 4, (y + 1) * w * 4), ((r * h + y) * width + i * w) * 4);
      row.push(f.hand);
    }
    hands.push(row);
  });
  return {
    rgba, width, height, cols, rows: ROWS.length, frameW: w, frameH: h, anchorX: ax, anchorY: ay, hands,
    anims: Object.fromEntries(ROWS.map((n, i) => [n, { row: i, frames: CHIBI_ANIMS[n].frames, fps: CHIBI_ANIMS[n].fps, loop: true, contact: CHIBI_ANIMS[n].contact ?? [] }])),
  };
}

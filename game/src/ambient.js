// =====================================================================================
//  ÁNH SÁNG + THỜI TIẾT + VIỀN TỐI (bản 3.0)
//
//  LightLayer  — phủ 1 lớp tối lên bản đồ rồi "đục lỗ" sáng quanh nhân vật, đuốc, lò lửa, dung nham, đạn phép...
//                Vùng sáng chia nấc (dithering kiểu pixel art). Thêm 1 lớp màu cộng sáng (lighter) cho ánh lửa ấm.
//                Mỗi bán kính chỉ vẽ sẵn 1 lần (cache) -> mỗi frame chỉ vài chục drawImage, rất nhẹ.
//  Ambient     — hạt môi trường bay trong khung hình: bụi (hầm ngục), đom đóm + lá rơi (rừng), tàn lửa (dung nham),
//                tuyết (băng), sương mù (nghĩa trang). Tọa độ THẾ GIỚI nên bám đúng theo camera.
//  makeVignette — viền tối 4 góc màn hình (vẽ sẵn 1 lần)
//  Muốn tắt / chỉnh độ tối từng bản đồ: BIOMES[].light trong src/world.js
// =====================================================================================

/** Nấc độ sáng theo khoảng cách (tâm -> mép) */
const LIGHT_STEPS = [[0.38, 1], [0.6, 0.78], [0.8, 0.5], [0.93, 0.25], [1, 0.1]];

export class LightLayer {
  constructor(w, h) {
    this.w = w; this.h = h;
    this.canvas = document.createElement("canvas");
    this.canvas.width = w; this.canvas.height = h;
    this.g = this.canvas.getContext("2d");
    this.stamps = new Map();
    this.enabled = true;
  }

  /**
   * Vết sáng tròn bán kính r, màu trắng (đục bóng tối) hoặc màu (cộng sáng).
   * Bán kính làm tròn 4px (màu: 8px) và màu quy về 1 trong GLOW_COLORS -> số vết sáng cần vẽ sẵn luôn ít, không tốn RAM.
   */
  stamp(r, color = null) {
    if (color) color = glowColor(color);
    const q = color ? 8 : 4;
    r = Math.max(q, Math.min(color ? 120 : 176, Math.round(r / q) * q));
    const key = `${r}|${color ?? ""}`;
    let c = this.stamps.get(key);
    if (c) return c;
    const size = r * 2;
    c = document.createElement("canvas");
    c.width = c.height = size;
    const g = c.getContext("2d"), img = g.createImageData(size, size), d = img.data;
    const [cr, cg, cb] = color ? hexRgb(color) : [255, 255, 255];
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const k = Math.hypot(x + 0.5 - r, (y + 0.5 - r) * 1.15) / r;   // hơi dẹt theo chiều dọc (góc nhìn từ trên)
      let a = 0;
      for (const [lim, v] of LIGHT_STEPS) if (k <= lim) { a = v; break; }
      // dithering ở ranh giới các nấc cho mềm mà vẫn "pixel"
      if (a > 0 && ((x + y) & 1) && LIGHT_STEPS.some(([lim]) => Math.abs(k - lim) < 0.025)) a *= 0.8;
      const i = (y * size + x) * 4;
      d[i] = cr; d[i + 1] = cg; d[i + 2] = cb; d[i + 3] = Math.round(a * 255);
    }
    g.putImageData(img, 0, 0);
    this.stamps.set(key, c);
    return c;
  }

  /**
   * Vẽ lớp sáng/tối lên ctx (ctx ở TỌA ĐỘ MÀN HÌNH).
   * lights: [{ x, y, r, color?, a? (0..1 độ mạnh), glow? (độ cộng màu) }] — tọa độ thế giới
   */
  render(ctx, cam, ambient, lights) {
    if (!this.enabled || !ambient || ambient.alpha <= 0) return;
    const g = this.g, ox = cam.rx, oy = cam.ry;
    g.globalCompositeOperation = "source-over";
    g.globalAlpha = 1;
    g.clearRect(0, 0, this.w, this.h);
    g.fillStyle = ambient.color; g.globalAlpha = ambient.alpha;
    g.fillRect(0, 0, this.w, this.h);
    g.globalCompositeOperation = "destination-out";
    for (let i = 0; i < lights.length; i++) {
      const L = lights[i], s = this.stamp(L.r);
      g.globalAlpha = Math.min(1, L.a ?? 1);
      g.drawImage(s, Math.round(L.x - ox - s.width / 2), Math.round(L.y - oy - s.height / 2));
    }
    g.globalCompositeOperation = "source-over"; g.globalAlpha = 1;
    ctx.drawImage(this.canvas, 0, 0);
    // ánh màu cộng sáng (lửa ấm, axit xanh, phép thuật...)
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < lights.length; i++) {
      const L = lights[i];
      if (!L.color || L.glow === 0) continue;
      const s = this.stamp(L.r * 0.75, L.color);
      ctx.globalAlpha = (L.glow ?? 0.14) * Math.min(1, L.a ?? 1);
      ctx.drawImage(s, Math.round(L.x - ox - s.width / 2), Math.round(L.y - oy - s.height / 2));
    }
    ctx.restore();
  }
}

/** Viền tối 4 góc (vẽ sẵn 1 lần) */
export function makeVignette(w, h, strength = 0.42) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const g = c.getContext("2d"), img = g.createImageData(w, h), d = img.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (x - w / 2) / (w / 2), dy = (y - h / 2) / (h / 2), k = Math.max(0, Math.hypot(dx * 0.85, dy) - 0.62) / 0.6;
    const a = Math.min(1, k) ** 1.6 * strength;
    const q = Math.round(a * 12) / 12;   // chia nấc kiểu pixel
    d[(y * w + x) * 4 + 3] = Math.round(q * 255);
  }
  g.putImageData(img, 0, 0);
  return c;
}

// =====================================================================================
//  HẠT MÔI TRƯỜNG
// =====================================================================================
const KINDS = {
  dust:      { n: 34, make: (p) => { p.vx = rand(-4, 4); p.vy = rand(-3, 3); p.life = rand(4, 9); p.s = 1; p.col = "#b8a8d8"; } },
  fireflies: { n: 30, make: (p) => { p.vx = rand(-8, 8); p.vy = rand(-8, 8); p.life = rand(4, 8); p.s = 1; p.col = "#d8ff6a"; p.leaf = Math.random() < 0.35; if (p.leaf) { p.vy = rand(10, 18); p.vx = rand(-6, 6); p.col = pickOf(["#5a7a2a", "#8a6a2a", "#a07a30"]); } } },
  embers:    { n: 44, make: (p) => { p.vx = rand(-6, 6); p.vy = rand(-28, -12); p.life = rand(2, 4.5); p.s = 1; p.col = pickOf(["#ff8a2a", "#ffc23d", "#ff6a1e", "#ffe26b"]); } },
  snow:      { n: 70, make: (p) => { p.vx = rand(-10, 2); p.vy = rand(14, 26); p.life = rand(6, 11); p.s = Math.random() < 0.25 ? 2 : 1; p.col = "#ffffff"; } },
  fog:       { n: 14, make: (p) => { p.vx = rand(4, 10) * (Math.random() < 0.5 ? -1 : 1); p.vy = rand(-1, 1); p.life = rand(10, 18); p.s = rand(30, 60); p.col = "#8a94a8"; } },
};
function rand(a, b) { return a + Math.random() * (b - a); }
function pickOf(a) { return a[(Math.random() * a.length) | 0]; }
function hexRgb(h) { const v = parseInt(h.slice(1, 7), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; }
/** Bảng màu ánh sáng cộng (mọi màu khác được quy về màu gần nhất trong bảng) */
const GLOW_COLORS = ["#ffb04a", "#ff6a1e", "#ff3b3b", "#ffe26b", "#a6f06a", "#45f0b0", "#7cd8ff", "#5e7cff", "#c48cff", "#ff7ad8", "#ffffff"];
const GLOW_RGB = GLOW_COLORS.map(hexRgb), glowCache = new Map();
function glowColor(c) {
  let g = glowCache.get(c);
  if (g) return g;
  const [r, gg, b] = c.startsWith("#") && c.length >= 7 ? hexRgb(c) : [255, 255, 255];
  let best = 0, bd = Infinity;
  GLOW_RGB.forEach(([R, G, B], i) => { const d = (R - r) ** 2 + (G - gg) ** 2 + (B - b) ** 2; if (d < bd) { bd = d; best = i; } });
  g = GLOW_COLORS[best];
  glowCache.set(c, g);
  return g;
}

export class Ambient {
  constructor(kind) {
    this.kind = KINDS[kind] ? kind : null;
    this.cfg = KINDS[kind] ?? null;
    this.parts = [];
    this.t = 0;
  }
  spawn(p, cam, anywhere) {
    p.x = cam.x + rand(-20, cam.w + 20);
    p.y = anywhere ? cam.y + rand(-20, cam.h + 20) : (this.kind === "snow" || (this.kind === "fireflies" && p.leaf) ? cam.y - 10 : this.kind === "embers" ? cam.y + cam.h + 6 : cam.y + rand(-20, cam.h + 20));
    p.age = 0; p.ph = Math.random() * 10;
    this.cfg.make(p);
    if (this.kind === "fireflies" && p.leaf && !anywhere) p.y = cam.y - 8;
    return p;
  }
  update(dt, cam) {
    if (!this.cfg) return;
    this.t += dt;
    while (this.parts.length < this.cfg.n) this.parts.push(this.spawn({}, cam, true));
    for (const p of this.parts) {
      p.age += dt;
      if (this.kind === "fireflies" && !p.leaf) { p.vx += rand(-20, 20) * dt; p.vy += rand(-20, 20) * dt; p.vx *= 0.98; p.vy *= 0.98; }
      if (this.kind === "snow" || (this.kind === "fireflies" && p.leaf)) p.vx += Math.sin(this.t * 1.3 + p.ph) * 6 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      const out = p.x < cam.x - 70 || p.x > cam.x + cam.w + 70 || p.y < cam.y - 70 || p.y > cam.y + cam.h + 70;
      if (p.age > p.life || out) this.spawn(p, cam, out && this.kind !== "snow" && this.kind !== "embers");
    }
  }
  /** ctx ở TỌA ĐỘ THẾ GIỚI */
  draw(ctx) {
    if (!this.cfg) return;
    for (const p of this.parts) {
      const fade = Math.min(1, p.age / 0.8, (p.life - p.age) / 0.8);
      if (fade <= 0) continue;
      const x = Math.round(p.x), y = Math.round(p.y);
      switch (this.kind) {
        case "dust": ctx.globalAlpha = 0.35 * fade; ctx.fillStyle = p.col; ctx.fillRect(x, y, 1, 1); break;
        case "fireflies":
          if (p.leaf) { ctx.globalAlpha = 0.85 * fade; ctx.fillStyle = p.col; ctx.fillRect(x, y, 2, 1); if (Math.sin(this.t * 6 + p.ph) > 0) ctx.fillRect(x + 1, y + 1, 1, 1); }
          else { const b = 0.5 + 0.5 * Math.sin(this.t * 3 + p.ph); ctx.globalAlpha = 0.25 * b * fade; ctx.fillStyle = p.col; ctx.fillRect(x - 1, y - 1, 3, 3); ctx.globalAlpha = (0.4 + 0.6 * b) * fade; ctx.fillRect(x, y, 1, 1); }
          break;
        case "embers": ctx.globalAlpha = fade * (Math.sin(this.t * 20 + p.ph) > -0.6 ? 1 : 0.4); ctx.fillStyle = p.col; ctx.fillRect(x, y, 1, p.age < 0.4 ? 2 : 1); break;
        case "snow": ctx.globalAlpha = 0.8 * fade; ctx.fillStyle = p.col; ctx.fillRect(x, y, p.s, p.s); break;
        case "fog": {
          ctx.globalAlpha = 0.07 * fade; ctx.fillStyle = p.col;
          ctx.beginPath(); ctx.ellipse(x, y, p.s, p.s * 0.35, 0, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = 0.05 * fade; ctx.beginPath(); ctx.ellipse(x + p.s * 0.4, y - 3, p.s * 0.6, p.s * 0.22, 0, 0, Math.PI * 2); ctx.fill();
          break;
        }
      }
    }
    ctx.globalAlpha = 1;
  }
}

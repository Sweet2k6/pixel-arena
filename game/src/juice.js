// =====================================================================================
//  GAME JUICE — cảm giác "đã tay" khi đánh: XÁC NGÃ GỤC · VẾT MÁU / CHẤT NHẦY TRÊN NỀN · CHUI LÊN TỪ ĐẤT · MÉO NGƯỜI
//
//    Corpse   — quái chết KHÔNG biến mất ngay: chớp trắng, bật lùi theo hướng đạn, nảy lên, NGÃ GỤC xuống đất
//               (người / zombie) hoặc BẸP DÍ xuống (slime, dơi, ma...), nằm lại 1 lúc rồi chìm + mờ dần.
//    Decals   — vết máu đỏ sẫm (zombie), dịch xanh (zombie phun độc, slime, ếch), mảnh xương (bộ xương),
//               vết cháy sém (vụ nổ) in lên nền, mờ dần sau DECAL_CFG.life giây. Hình vết vẽ sẵn (cache), vẽ rất rẻ.
//    springStep — lò xo méo người: trúng đòn -> bè ngang + lùn xuống -> nảy cao -> về dáng cũ.
//    drawRise — zombie / quái đi bộ CHUI LÊN TỪ ĐẤT lúc xuất hiện (đất văng tung tóe), quái bay thì hiện dần + phồng lên.
//
//  >>> CHỈNH: CORPSE_CFG (thời gian nằm, số xác tối đa), DECAL_CFG (số vết, thời gian mờ), BLOOD (màu theo loại quái)
// =====================================================================================
import { withAlpha, clamp, rand, TAU } from "./util.js";

export const CORPSE_CFG = {
  max: 45,          // số xác tối đa cùng lúc (quá thì xác cũ nhất biến mất)
  lie: 3.0,         // giây nằm trên đất trước khi chìm (đủ lâu để thấy vũng máu loang ra dưới thân)
  fade: 0.9,        // giây chìm + mờ dần
  fall: 0.28,       // giây ngã từ đứng -> nằm
  knock: 85,        // tốc độ bật lùi (px/s)
  pop: 70,          // vận tốc nảy lên (px/s)
};
export const DECAL_CFG = {
  max: 110,          // vết lớn: vũng máu, vệt văng, vệt kéo lê, cháy sém
  maxDrops: 170,     // giọt nhỏ (máu phun rơi xuống nền)
  life: 26,          // giây tồn tại của vết lớn
  dropLife: 15,      // giây tồn tại của giọt nhỏ
  fadeLast: 4,       // giây mờ dần cuối đời
  dry: [5, 12],      // máu tươi (có ánh ướt) bắt đầu khô sẫm lại -> khô hẳn (giây)
  poolGrow: 2.4,     // giây vũng máu loang rộng ra dưới xác
};
/** Máu phun khi trúng đòn: số giọt khi trúng thường / chí mạng / gục ngã, trọng lực */
export const BLOOD_FX = { max: 320, hit: 3, crit: 7, kill: 12, gravity: 430 };
/** Loại "máu" dùng được (khóa) — xem bloodOf */
export const BLOOD = { red: 1, green: 1, goo: 1, purple: 1, bone: 1, scorch: 1 };
/** Bảng màu vết: tươi [viền đông, nền, giữa, sáng, ánh ướt] · khô [viền, nền, giữa, sáng] · giọt bay [tối, sáng] */
const STAIN = {
  red:    { fresh: ["#24030a", "#4a0810", "#681016", "#8a1c20", "#f09090"], dry: ["#180806", "#2c0d0a", "#38120d", "#441812"], drop: ["#3a0610", "#a01c24"] },
  green:  { fresh: ["#102e08", "#265612", "#387818", "#589e28", "#e0ffb8"], dry: ["#121a08", "#202e0e", "#2a3c12", "#344816"], drop: ["#1e4a0c", "#78c83a"] },
  goo:    { fresh: ["#08341f", "#126244", "#1b8656", "#34b276", "#d0fff0"], dry: ["#0c1e16", "#143426", "#1a4430", "#20543a"], drop: ["#0e5038", "#56e0a0"] },
  purple: { fresh: ["#1a0624", "#3c1250", "#561e76", "#8034ae", "#f4d0ff"], dry: ["#140a18", "#24122c", "#2e1836", "#381e42"], drop: ["#3a1250", "#b06cff"] },
  bone:   { drop: ["#8a8270", "#ece6d4"] },
};
const BLOOD_OF = {
  zWalker: "red", zRunner: "red", zBoss: "red", zBloater: "green", archer: "bone", shaman: "bone", skull: "bone", skullLord: "bone",
  knight: "red", slime: "goo", bigSlime: "goo", slimeKing: "purple", frog: "green", snake: "green", bat: "red", eyeball: "purple", eyeLord: "purple",
  ghost: null, boss: "purple", spirit: null,
};
export const bloodOf = (e) => (e.type in BLOOD_OF ? BLOOD_OF[e.type] : "red");

// ------------------------------------------------------------------ LÒ XO MÉO NGƯỜI
/** Cập nhật lò xo o.sq (độ méo, 1 = bè ngang) / o.sqV. Trả về [scaleX, scaleY] */
export function springStep(o, dt, k = 260, damp = 13) {
  if (!o.sq && !o.sqV) return [1, 1];
  o.sqV += (-o.sq * k - o.sqV * damp) * dt;
  o.sq += o.sqV * dt;
  if (Math.abs(o.sq) < 0.004 && Math.abs(o.sqV) < 0.05) { o.sq = 0; o.sqV = 0; }
  return [1 + o.sq * 0.2, 1 - o.sq * 0.2];
}
/** Đá lò xo: amount 1 = trúng đòn mạnh (bè ngang), âm = vươn cao (bật nhảy) */
export function kickSquash(o, amount = 1) { o.sq = clamp((o.sq ?? 0) + amount * 0.9, -1.2, 1.2); o.sqV = (o.sqV ?? 0) + amount * 2; }

// ------------------------------------------------------------------ VẾT TRÊN NỀN (vẽ từng pixel, cache theo loại / hình / hướng)
/** Vẽ elip đặc bằng các hàng pixel (sắc nét kiểu pixel art) */
function pxOval(c, cx, cy, rx, ry) {
  for (let y = -Math.ceil(ry); y <= Math.ceil(ry); y++) {
    const w = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y / ry) ** 2)));
    if (w > 0) c.fillRect(Math.round(cx - w), Math.round(cy + y), w * 2, 1);
  }
}
const hexRgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
/** Số ngẫu nhiên có hạt giống (mỗi biến thể vết luôn giống nhau) */
function seeded(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 100000) / 100000; };
}
const STAIN_CACHE = new Map();
/**
 * Dựng 1 vết: shape = "splat" (văng theo hướng đạn) | "pool" (vũng) | "smear" (kéo lê) | "drop" (giọt) · dir 0..7 = 8 hướng · v = biến thể
 * Trả về { fresh, dry, sheen, ax, ay, w, h } — 3 lớp cùng khuôn: máu tươi, máu khô, ánh ướt.
 */
function stain(kind, shape, dir, v) {
  const key = `${kind}|${shape}|${dir}|${v}`;
  let st = STAIN_CACHE.get(key);
  if (st) return st;
  const rnd = seeded(key);
  const [W, H] = shape === "drop" ? [12, 8] : shape === "pool" ? [44, 22] : [48, 28];
  const cx = W / 2, cy = H / 2;
  const ang = (dir / 8) * TAU, ux = Math.cos(ang), uy = Math.sin(ang) * 0.6, px = -Math.sin(ang), py = Math.cos(ang) * 0.6;
  const blobs = [];
  const B = (x, y, r, k = 0.62) => blobs.push([x, y, Math.max(0.5, r), Math.max(0.45, r * k)]);
  if (kind === "bone") {   // mảnh xương vụn + bụi xương
    for (let i = 0; i < (shape === "drop" ? 1 : 9); i++) B(cx + (rnd() - 0.3) * (shape === "drop" ? 1 : 16), cy + (rnd() - 0.5) * 6, 0.5 + rnd() * 0.6, 1);
  } else if (shape === "pool") {
    B(cx, cy, 7 + rnd() * 2.5, 0.52);
    for (let i = 0, n = 6 + Math.floor(rnd() * 4); i < n; i++) { const a = rnd() * TAU, d = rnd() * 8; B(cx + Math.cos(a) * d * 1.35, cy + Math.sin(a) * d * 0.55, 2.5 + rnd() * 5, 0.52); }
    for (let i = 0; i < 5; i++) { const a = rnd() * TAU, d = 12 + rnd() * 5; B(cx + Math.cos(a) * d * 1.3, cy + Math.sin(a) * d * 0.48, 0.6 + rnd() * 0.9, 0.8); }   // giọt lẻ quanh mép
  } else if (shape === "splat") {
    const ox = cx - ux * 9, oy = cy - uy * 9;   // tâm loang lệch ra sau, các giọt bắn về phía trước (hướng đạn)
    B(ox, oy, 3.4 + rnd() * 2.4, 0.6); B(ox + ux * 2.2 + px * (rnd() - 0.5) * 3, oy + uy * 2.2 + py * (rnd() - 0.5) * 3, 2.4 + rnd() * 2, 0.6);
    for (let i = 0, n = 8 + Math.floor(rnd() * 7); i < n; i++) {
      const t = 4 + rnd() * 21, side = (rnd() - 0.5) * (2 + t * 0.38);
      const x = ox + ux * t + px * side, y = oy + uy * t + py * side, r = Math.max(0.55, (2.5 - t * 0.085) * (0.5 + rnd() * 0.7));
      B(x, y, r, 0.8);
      if (r > 1.05) { B(x - ux * r * 1.25, y - uy * r * 1.25, r * 0.62, 0.8); B(x - ux * r * 2.2, y - uy * r * 2.2, r * 0.36, 0.8); }   // giọt hình GIỌT NƯỚC, đuôi chỉ về tâm
    }
    for (let s = 0; s < 2; s++) { const side = (rnd() - 0.5) * 5, L = 10 + rnd() * 9; for (let t = 3; t < L; t += 0.8) B(ox + ux * t + px * side, oy + uy * t + py * side, 0.55, 1); }   // tia bắn dài mảnh
  } else if (shape === "smear") {
    const L = 6 + rnd() * 5;
    for (let t = -L; t <= L; t += 0.7) B(cx + ux * t, cy + uy * t, 1.3 + Math.sin(((t + L) / (2 * L)) * Math.PI) * 0.9 + (rnd() - 0.5) * 0.4, 0.75);
    for (const sd of [-1, 1]) for (let t = -L; t <= L; t += 1) if (rnd() < 0.55) B(cx + ux * t + px * sd * 2.3, cy + uy * t + py * sd * 2.3, 0.5, 1);   // vệt cào song song
  } else {   // giọt: v = 0 nhỏ tròn · 1 có đuôi (rơi nghiêng) · 2 to + giọt con văng tiếp
    const r = 0.8 + v * 0.45;
    B(cx, cy, r + 0.35, 0.75);
    if (v >= 1) B(cx - ux * r * 1.5, cy - uy * r * 1.5, r * 0.55, 0.8);
    if (v >= 2) B(cx + ux * (r + 2.2), cy + uy * (r + 2.2), 0.5, 1);
  }
  // ---- mật độ từng pixel (lấy lớn nhất của các khối) -> tô màu: viền đông sẫm, lõi đỏ, chấm sáng, nhiễu nhẹ
  const dens = new Float32Array(W * H);
  for (const [bx, by, rx, ry] of blobs)
    for (let y = Math.max(0, Math.floor(by - ry - 1)); y <= Math.min(H - 1, Math.ceil(by + ry + 1)); y++)
      for (let x = Math.max(0, Math.floor(bx - rx - 1)); x <= Math.min(W - 1, Math.ceil(bx + rx + 1)); x++) {
        const q = ((x + 0.5 - bx) / rx) ** 2 + ((y + 0.5 - by) / ry) ** 2;
        if (q < 1 && 1 - q > dens[y * W + x]) dens[y * W + x] = 1 - q;
      }
  const D = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : dens[y * W + x]);
  const layer = (pal, alpha, mode) => {
    const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    const g = cv.getContext("2d"), img = g.createImageData(W, H), P = pal.map(hexRgb);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const d = dens[y * W + x];
      if (d <= 0) continue;
      const edge = !D(x + 1, y) || !D(x - 1, y) || !D(x, y + 1) || !D(x, y - 1);
      let ci, a;
      if (mode === "sheen") {   // ánh ướt: dải sáng sát mép trên của vùng dày + vài đốm lấp lánh
        if (edge || d < 0.45 || !(D(x, y - 2) < 0.3 || D(x - 2, y - 1) < 0.25) || (x + y) % 3 === 0) continue;
        ci = 4; a = 0.5;
      } else if (kind === "bone") { ci = rnd() < 0.5 ? 2 : 3; a = 0.95; }
      else if (shape === "drop") { ci = edge ? (d > 0.3 ? 2 : 1) : 3; a = alpha; }   // giọt nhỏ: đỏ tươi (không bị viền sẫm nuốt mất)
      else {
        ci = edge ? 0 : d > 0.82 ? 3 : d > 0.5 ? 2 : 1;
        const nz = rnd();
        if (!edge && nz < 0.12) ci = Math.max(1, ci - 1); else if (!edge && nz > 0.93) ci = Math.min(3, ci + 1);   // vân máu không phẳng lì
        a = edge ? alpha * 0.8 : alpha;
      }
      const c = P[Math.min(ci, P.length - 1)], j = (y * W + x) * 4;
      img.data[j] = c[0]; img.data[j + 1] = c[1]; img.data[j + 2] = c[2]; img.data[j + 3] = Math.round(a * 255);
    }
    g.putImageData(img, 0, 0);
    return cv;
  };
  if (kind === "bone") {
    const pal = ["#6a6458", "#8a8270", "#b8b09a", "#ece6d4"], fresh = layer(pal, 0.95, "fresh");
    st = { fresh, dry: null, sheen: null, ax: cx, ay: cy, w: W, h: H };
  } else {
    const S = STAIN[kind];
    st = { fresh: layer(S.fresh, 0.94, "fresh"), dry: layer(S.dry, 0.86, "dry"), sheen: shape === "drop" ? null : layer(S.fresh, 1, "sheen"), ax: cx, ay: cy, w: W, h: H };
  }
  STAIN_CACHE.set(key, st);
  return st;
}
/** Vết cháy sém (vụ nổ): loang đen, viền nâu, tâm tro */
let SCORCH = null;
function scorchVariants() {
  if (SCORCH) return SCORCH;
  SCORCH = [];
  for (let v = 0; v < 4; v++) {
    const cv = document.createElement("canvas"); cv.width = 40; cv.height = 20;
    const c = cv.getContext("2d"), cx = 20, cy = 10;
    c.fillStyle = "rgba(58,42,30,0.45)"; pxOval(c, cx, cy, 17, 8);
    c.fillStyle = "#1c1816"; pxOval(c, cx, cy, 12.5 + rand(-1, 1), 5.8);
    c.fillStyle = "#0c0a0a"; pxOval(c, cx, cy, 8, 3.6);
    for (let i = 0; i < 16; i++) { const a = rand(0, TAU), r = rand(9, 18); c.fillStyle = i % 3 ? "#0c0a0a" : "#2a2018"; c.fillRect(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r * 0.45), 1, 1); }
    for (let i = 0; i < 5; i++) { c.fillStyle = "#6a5a4a"; c.fillRect(Math.round(cx + rand(-6, 6)), Math.round(cy + rand(-2, 2)), 1, 1); }   // tro sáng
    SCORCH.push({ fresh: cv, dry: null, sheen: null, ax: cx, ay: cy, w: 40, h: 20 });
  }
  return SCORCH;
}
const dirIndex = (a) => ((Math.round((a / TAU) * 8) % 8) + 8) % 8;

export class Decals {
  /** world (gán từ main.js): vết KHÔNG in đè lên tường / vật cản / hố — phần chồm lên bị cắt bỏ khi vẽ */
  constructor() { this.list = []; this.drops = 0; this.world = null; this.q = []; }
  clear() { this.list.length = 0; this.drops = 0; }
  /** Các khối tường / hố chạm vùng [x0..x1] x [y0..y1] (đã nới 1px theo viền vẽ) */
  blockers(x0, y0, x1, y1) {
    const W = this.world;
    if (!W?.boxesIn) return [];
    return W.boxesIn(x0, y0, x1, y1, true, this.q).filter((b) => b.x - 1 < x1 && b.x + b.w + 1 > x0 && b.y - 1 < y1 && b.y + b.h + 1 > y0).map((b) => [b.x - 1, b.y - 1, b.w + 2, b.h + 2]);
  }
  push(st, kind, x, y, size, opts = {}) {
    const drop = !!opts.drop;
    const inside = (m) => x >= m[0] && x <= m[0] + m[2] && y >= m[1] && y <= m[1] + m[3];
    let mask = null;
    if (drop) { if (this.blockers(x - 1, y - 1, x + 1, y + 1).some(inside)) return; }   // giọt rơi trúng tường: không để vết
    else {
      const rs = this.blockers(x - st.ax * size, y - st.ay * size, x + (st.w - st.ax) * size, y + (st.h - st.ay) * size);
      if (rs.some(inside)) return;              // tâm vết nằm trên tường: bỏ
      if (rs.length) mask = rs;                 // chồm lên tường: cắt khi vẽ
    }
    if (drop && this.drops >= DECAL_CFG.maxDrops) { const i = this.list.findIndex((d) => d.drop); if (i >= 0) { this.list.splice(i, 1); this.drops--; } }
    if (!drop && this.list.length - this.drops >= DECAL_CFG.max) { const i = this.list.findIndex((d) => !d.drop); if (i >= 0) this.list.splice(i, 1); }
    this.list.push({ st, kind, x, y, s: size, age: 0, life: drop ? DECAL_CFG.dropLife : DECAL_CFG.life, grow: opts.grow ?? 0, drop, mask });
    if (drop) this.drops++;
  }
  /** Vệt VĂNG theo hướng đạn (dir radian) — kind: khóa trong BLOOD (red / green / goo / purple / bone / scorch) */
  add(kind, x, y, dir = 0, size = 1) {
    if (!kind || !BLOOD[kind]) return;
    if (kind === "scorch") { const v = scorchVariants(); this.push(v[(Math.random() * v.length) | 0], kind, x, y, size); return; }
    this.push(stain(kind, "splat", dirIndex(dir), (Math.random() * 4) | 0), kind, x, y, size);
  }
  /** VŨNG máu loang dần ra dưới xác (grow giây) */
  addPool(kind, x, y, size = 1, grow = DECAL_CFG.poolGrow) {
    if (!kind || kind === "bone" || kind === "scorch" || !BLOOD[kind]) return;
    this.push(stain(kind, "pool", 0, (Math.random() * 4) | 0), kind, x, y, size, { grow });
  }
  /** VỆT KÉO LÊ khi xác trượt trên nền */
  addSmear(kind, x, y, dir) {
    if (!kind || kind === "bone" || kind === "scorch" || !BLOOD[kind]) return;
    this.push(stain(kind, "smear", dirIndex(dir), (Math.random() * 3) | 0), kind, x, y, 1, { drop: true });
  }
  /** GIỌT máu rơi xuống nền (từ máu phun) — r 1..2 */
  addDrop(kind, x, y, dir, r = 1) {
    if (!kind || kind === "scorch" || !BLOOD[kind]) return;
    const v = r >= 2 ? 2 : Math.random() < 0.55 ? 1 : 0;
    this.push(stain(kind, "drop", dirIndex(dir), v), kind, x, y, 1, { drop: true });
  }
  update(dt) {
    let n = 0;
    for (const d of this.list) { d.age += dt; if (d.age < d.life) this.list[n++] = d; else if (d.drop) this.drops--; }
    this.list.length = n;
  }
  draw(c, cam) {
    const x0 = cam.rx - 50, x1 = cam.rx + cam.w + 50, y0 = cam.ry - 30, y1 = cam.ry + cam.h + 30, [dry0, dry1] = DECAL_CFG.dry;
    for (const d of this.list) {
      if (d.x < x0 || d.x > x1 || d.y < y0 || d.y > y1) continue;
      const a = Math.min(1, (d.life - d.age) / DECAL_CFG.fadeLast);
      if (a <= 0.02) continue;
      const st = d.st, g = d.grow ? Math.min(1, 0.2 + 0.8 * (1 - (1 - Math.min(1, d.age / d.grow)) ** 2)) : 1, s = d.s * g;
      const w = Math.max(1, Math.round(st.w * s)), h = Math.max(1, Math.round(st.h * s)), X = Math.round(d.x - st.ax * s), Y = Math.round(d.y - st.ay * s);
      const dry = st.dry ? Math.min(1, Math.max(0, (d.age - dry0) / (dry1 - dry0))) : 0;
      if (d.mask) {   // cắt phần chồm lên tường (đường cắt chẵn-lẻ: khung vết trừ các khối tường)
        c.save(); c.beginPath(); c.rect(X - 1, Y - 1, w + 2, h + 2);
        for (const m of d.mask) c.rect(m[0], m[1], m[2], m[3]);
        c.clip("evenodd");
      }
      if (dry < 1) { c.globalAlpha = a; c.drawImage(st.fresh, X, Y, w, h); }
      if (dry > 0) { c.globalAlpha = a * dry; c.drawImage(st.dry, X, Y, w, h); }
      if (st.sheen && d.age < dry0 + 1) { c.globalAlpha = a * Math.max(0, 1 - d.age / (dry0 + 1)) * (0.65 + 0.35 * Math.sin(d.age * 3 + d.x)); c.drawImage(st.sheen, X, Y, w, h); }   // ánh ướt nhấp nháy rồi khô
      if (d.mask) c.restore();
    }
    c.globalAlpha = 1;
  }
}

// ------------------------------------------------------------------ MÁU PHUN (giọt bay theo hướng đạn, rơi xuống thành vết)
export class BloodFx {
  constructor(decals) { this.decals = decals; this.list = []; }
  clear() { this.list.length = 0; }
  /** kind = bloodOf(quái) · (x, y) = chân · z = độ cao điểm phun · ang = hướng đạn · n = số giọt · power = lực */
  spray(kind, x, y, z, ang, n, power = 1) {
    if (!kind || kind === "scorch" || !STAIN[kind]) return;
    const spread = kind === "bone" ? 2.2 : 1.1;
    for (let i = 0; i < n; i++) {
      if (this.list.length >= BLOOD_FX.max) this.list.shift();
      const a = ang + (Math.random() - 0.5) * spread, sp = (35 + Math.random() * 115) * power;
      this.list.push({ kind, x, y, z: z + rand(-2, 2), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.55, vz: (15 + Math.random() * 75) * power, r: Math.random() < 0.28 ? 2 : 1 });
    }
  }
  update(dt) {
    const g = BLOOD_FX.gravity;
    let n = 0;
    for (const p of this.list) {
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vz -= g * dt;
      if (p.z <= 0) { this.decals?.addDrop(p.kind, p.x, p.y, Math.atan2(p.vy, p.vx), p.r); continue; }
      this.list[n++] = p;
    }
    this.list.length = n;
  }
  draw(c, cam) {
    for (const p of this.list) {
      if (!cam.inView(p.x, p.y, 24)) continue;
      const col = STAIN[p.kind].drop, X = Math.round(p.x), Y = Math.round(p.y - p.z);
      c.fillStyle = col[0]; c.fillRect(Math.round(X - p.vx * 0.014), Math.round(Y - (p.vy - p.vz) * 0.014), 1, 1);   // vệt bay phía sau
      c.fillStyle = col[1]; c.fillRect(X, Y, p.r, p.r);
    }
  }
}

// ------------------------------------------------------------------ BÓNG DƯỚI CHÂN (elip mờ, vẽ sẵn theo bề ngang)
const SHADOW_CACHE = new Map();
/** Vẽ bóng elip dưới chân tại (x, y), rộng w pixel, độ đậm a */
export function drawShadow(c, x, y, w, a = 0.3) {
  w = Math.max(6, Math.round(w / 2) * 2);
  let cv = SHADOW_CACHE.get(w);
  if (!cv) {
    const h = Math.max(3, Math.round(w * 0.32));
    cv = document.createElement("canvas"); cv.width = w + 2; cv.height = h + 2;
    const g = cv.getContext("2d");
    g.fillStyle = "rgba(0,0,0,0.55)"; pxOval(g, (w + 2) / 2, (h + 2) / 2, w / 2, h / 2);
    g.fillStyle = "rgba(0,0,0,0.45)"; pxOval(g, (w + 2) / 2, (h + 2) / 2, w / 2 - 2, Math.max(1, h / 2 - 1));
    SHADOW_CACHE.set(w, cv);
  }
  c.globalAlpha = a / 0.55;
  c.drawImage(cv, Math.round(x - cv.width / 2), Math.round(y - cv.height / 2));
  c.globalAlpha = 1;
}

// ------------------------------------------------------------------ XÁC QUÁI
export class Corpse {
  /**
   * e = quái vừa chết · decals = nơi in vết máu khi xác chạm đất
   * Người / zombie (spritesheet chibi) NGÃ GỤC quanh gót chân; quái dạng khối (slime, dơi, ma...) BẸP DÍ xuống.
   */
  constructor(e, decals, opts = {}) {
    const S = e.sprite;
    this.sheet = S.sheet; this.flashSheet = S.flash; this.dark = S.sheet.tinted("#1a0e10", 0.35);
    this.kind = S.kind === "chibi" || e.type === "player" ? "fall" : "squish";   // người chơi luôn ngã gục
    const hurt = S.anims.hurt;
    this.row = hurt ? hurt.row : e.anim.row;
    this.col = hurt ? 1 : e.anim.col;
    this.flip = Math.cos(e.facing) < 0;
    this.s = (e.cfg.scale ?? 1) * (e.sc ?? 1);
    this.x = e.x; this.y = e.y; this.z = e.z ?? 0;
    const a = e.hitAng ?? e.facing + Math.PI, kb = CORPSE_CFG.knock * (e.boss ? 0.3 : 1) * (opts.knock ?? 1) * (0.7 + Math.random() * 0.6);
    this.vx = Math.cos(a) * kb; this.vy = Math.sin(a) * kb * 0.5; this.vz = CORPSE_CFG.pop * (e.boss ? 0.4 : 1) * (e.cfg.flying ? 0.2 : 1);
    this.dir = a;
    // ngã về phía bị đẩy: đầu đổ theo hướng văng (nhìn ngang)
    this.rotTo = (Math.cos(a) >= 0 ? 1 : -1) * (Math.PI / 2) * 0.94;
    this.rot = 0; this.t = 0; this.flash = 0.07; this.landed = false;
    this.blood = bloodOf(e); this.decals = decals; this.slid = 0; this.pooled = false;
    this.max = opts.stay ? Infinity : CORPSE_CFG.lie + CORPSE_CFG.fade + (e.boss ? 2.5 : 0);
    this.big = e.boss;
  }
  update(dt) {
    this.t += dt; this.flash -= dt;
    const damp = Math.pow(0.02, dt), sp = Math.hypot(this.vx, this.vy);
    const nx = this.x + this.vx * dt, ny = this.y + this.vy * dt, W = this.decals?.world;
    if (W?.solidAt && W.solidAt(nx, ny, 3)) { this.vx = 0; this.vy = 0; }   // văng vào tường: dừng lại, không xuyên qua
    else { this.x = nx; this.y = ny; }
    this.vx *= damp; this.vy *= damp;
    this.z += this.vz * dt; this.vz -= 520 * dt;
    const size = (this.big ? 2 : 1) * clamp(this.s, 0.8, 1.6);
    if (this.z <= 0) {
      this.z = 0;
      if (!this.landed) {   // đổ xuống đất: máu văng theo hướng bị bắn
        this.landed = true;
        this.decals?.add(this.blood, this.x + Math.cos(this.dir) * 4, this.y, this.dir, size);
      }
      this.vz = this.vz < -60 ? -this.vz * 0.28 : 0;   // nảy nhẹ 1 lần
      // trượt trên nền: để lại VỆT KÉO LÊ dưới thân
      if (sp > 14 && this.kind === "fall") {
        this.slid += sp * dt;
        if (this.slid > 5) { this.slid = 0; this.decals?.addSmear(this.blood, this.x + Math.sin(this.rot) * 9 * this.s, this.y, Math.atan2(this.vy, this.vx)); }
      }
      // nằm yên: VŨNG MÁU loang dần ra dưới thân
      if (!this.pooled && sp < 12) {
        this.pooled = true;
        this.decals?.addPool(this.blood, this.x + (this.kind === "fall" ? Math.sin(this.rotTo) * 12 * this.s : 0), this.y + 1, size * (this.kind === "fall" ? 0.9 : 0.7));
      }
    }
    if (this.kind === "fall") {
      const k = clamp(this.t / CORPSE_CFG.fall, 0, 1), e = 1 - (1 - k) ** 3;
      this.rot = this.rotTo * e + (k >= 1 ? Math.sin((this.t - CORPSE_CFG.fall) * 30) * 0.05 * Math.max(0, 1 - (this.t - CORPSE_CFG.fall) * 5) : 0);
    }
    return this.t < this.max;
  }
  draw(c, cam) {
    if (!cam.inView(this.x, this.y, 60)) return;
    const left = this.max - this.t, a = clamp(left / CORPSE_CFG.fade, 0, 1);
    const sink = (1 - a) * 6;   // chìm dần xuống đất
    const sheet = this.flash > 0 ? this.flashSheet : this.t > 0.5 && !this.player ? this.dark : this.sheet;
    c.save();
    c.globalAlpha = a;
    c.translate(Math.round(this.x), Math.round(this.y - this.z + sink));
    if (this.kind === "fall") {
      c.rotate(this.rot);
      sheet.draw(c, this.col, this.row, 0, 0, this.flip, this.s);
    } else {   // bẹp dí: bè ngang + lùn tịt, rồi xẹp hẳn
      const k = clamp(this.t / 0.18, 0, 1), sx = 1 + 0.45 * k, sy = Math.max(0.12, 1 - 0.82 * k);
      c.scale(sx, sy);
      sheet.draw(c, this.col, this.row, 0, 0, this.flip, this.s);
    }
    c.restore();
  }
}

// ------------------------------------------------------------------ CHUI LÊN TỪ ĐẤT
/**
 * Vẽ quái đang xuất hiện: k = 0 (mới) -> 1 (xong). drawFn(dx, dy) vẽ quái lệch xuống dy pixel.
 * walker = true: chui từ dưới đất lên (cắt phần dưới chân) + đất văng; false: hiện dần + phồng lên.
 */
export function drawRise(c, x, y, k, h, walker, drawFn, seed = 0) {
  const e = 1 - (1 - k) ** 3;
  if (walker) {
    // hố đất + mảnh đất văng
    c.fillStyle = withAlpha("#1a120c", 0.55 * (1 - k * 0.6)); pxOval(c, x, y, 9 + 3 * e, 2.5 + e);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI + seed, u = clamp(k * 1.4 - i * 0.04, 0, 1), r = 4 + u * 12;
      const px = x + Math.cos(a) * r * (i % 2 ? 1 : -1), py = y - Math.sin(u * Math.PI) * (6 + (i % 3) * 3);
      c.fillStyle = i % 3 ? "#4a3624" : "#6a5038"; c.fillRect(Math.round(px), Math.round(py), i % 2 ? 2 : 1, i % 2 ? 1 : 2);
    }
    c.save(); c.beginPath(); c.rect(x - 60, y - 140, 120, 141); c.clip();
    drawFn(0, Math.round((1 - e) * h));
    c.restore();
  } else {
    c.save(); c.globalAlpha = e;
    c.translate(x, y); const s = 0.5 + 0.5 * e + Math.sin(k * Math.PI) * 0.15; c.scale(s, s); c.translate(-x, -y);
    drawFn(0, 0);
    c.restore();
  }
}

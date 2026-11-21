// =====================================================================================
//  KHOANG MÁY BAY — sảnh chờ của chế độ Nhảy Dù Rút Quân (giữa Cổng Xuất Kích và bản đồ chiến thuật)
//
//  Vẽ hoàn toàn bằng code, pixel art 480x270, nhìn ngang vách khoang máy bay vận tải quân sự:
//    trần ống dẫn + đèn vàng · vách cách nhiệt chần ô · sườn thép đinh tán · CỬA SỔ TRÒN có trời + MÂY TRÔI
//    dây móc dù (static line) đung đưa · dù đeo lưng treo móc · giá súng trên vách · bình cứu hỏa
//    ghế lưới đỏ dọc vách · sàn thép có ray con lăn · thùng đạn, hộp đạn, thùng y tế chằng dây
//    đèn nhảy ĐỎ -> XANH khi tới vùng thả · rung nhẹ liên tục + thỉnh thoảng NHIỄU ĐỘNG (rung mạnh, đèn chớp)
//  NGOÀI TRỜI: NGÀY TẬN THẾ — trời u ám đỏ quạch, mây đen cuồn cuộn, tia chớp, pháo phòng không nổ quanh máy bay,
//    thành phố đổ nát bốc cháy dưới đất, tro bụi bay. ÂM THANH: động cơ, gió, nổ, sấm (src/cabinAudio.js)
//  Bảng chọn đồ (HTML #cabin) phủ nửa PHẢI màn hình -> các chi tiết đẹp nhất đặt ở nửa TRÁI.
//
//  >>> ẢNH RIÊNG (tùy chọn): điền đường dẫn vào CABIN_IMAGES rồi khai báo trong IMAGE_MANIFEST (main.js).
//      background: ảnh 480x270 thay toàn bộ phần vẽ vách/sàn (khoét TRONG SUỐT chỗ cửa sổ ở các vị trí PORTHOLES
//      để mây vẫn trôi phía sau). Để trống "" = dùng hình vẽ bằng code.
// =====================================================================================
import { LightLayer, makeVignette } from "./ambient.js";
import { drawGunIcon } from "./guns.js";
import { withAlpha, clamp, rand, TAU } from "./util.js";
import { CabinAudio } from "./cabinAudio.js";

export const CABIN_IMAGES = {
  background: "",   // vd "assets/images/cabin/khoang-may-bay.png"
};

const W = 480, H = 270, M = 4;                          // M = lề vẽ thừa để rung không lộ mép
/** Cửa sổ tròn (tâm x, y, bán kính kính) — vị trí dùng chung cho ảnh nền riêng */
export const PORTHOLES = [[38, 74, 9], [100, 74, 9], [162, 74, 9], [224, 74, 9], [286, 74, 9], [348, 74, 9], [404, 74, 9]];
const RIBS = [7, 69, 131, 193, 255, 317, 379];
const LAMPS = [[69, 24], [193, 24], [317, 24], [441, 24]];
const JUMP_LIGHT = [238, 46];
const HERO = { x: 84, y: 230 };
/** Vùng sàn đi lại được (tính theo CHÂN nhân vật) + khối hàng chằng dây (không đi xuyên / không ra sau được) */
const FLOOR = { x0: 14, x1: 462, y0: 198, y1: 262 };
const BLOCKS = [[116, 186, 256, 244]];
/** Cửa nhảy ở đuôi khoang (khoảng trống x0..x1, y0..y1) */
const DOOR = { x0: 444, x1: 470, y0: 58, y1: 172 };
/** Điểm tương tác: đứng gần + bấm E (hoặc chạm vào) */
export const CABIN_SPOTS = {
  gear: { x: 190, y: 250, r: 30, label: "E · Trang bị" },
  door: { x: 450, y: 222, r: 26, label: "E · Nhảy dù" },
};
const WALK = 74;   // tốc độ đi trong khoang (px/giây)
/** Thời lượng cảnh cắt (giây): lên máy bay · nhảy khỏi máy bay (trong khoang + rơi tự do) */
export const CUTSCENE = { board: 4.6, jumpIn: 1.9, fall: 2.3 };
/** Tham số rung lắc */
const SHAKE = { calm: 0.55, burst: 2.6, burstDur: [1.1, 1.9], gap: [6, 12] };
/** Thời gian bay tới vùng thả (giây) — hết thì đèn chuyển XANH */
export const CABIN_ETA = 45;

/** Bảng màu bầu trời NGÀY TẬN THẾ (đổi ở đây là đổi cả cửa sổ, cửa nhảy, cảnh lên máy bay, cảnh rơi) */
const DOOM = {
  sky: [[0, "#0c090e"], [0.4, "#221518"], [0.7, "#4a1e17"], [0.88, "#7a3018"], [1, "#a4481d"]],
  cloudFar: "#2e2226", cloud: "#1d171b", cloudLit: "#6a2c1d",
  ruin: "#0a080a", fire: "#ff7a2a", ember: "#ffae5a", ash: "#a89e98", smoke: "#1c1719",
  bolt: "#dde4ff", boom: "#ffa24a",
};
/** Thời gian giữa 2 tia chớp / 2 tiếng nổ ngoài trời (giây) + tỉ lệ nổ SÁT máy bay */
const SKY_EVENTS = { bolt: [7, 15], boom: [4.5, 10], nearChance: 0.25 };

function doomSky(c, x, y, w, h, stops = DOOM.sky) {
  const g = c.createLinearGradient(0, y, 0, y + h);
  for (const [k, col] of stops) g.addColorStop(k, col);
  c.fillStyle = g; c.fillRect(x, y, w, h);
}
/** Thành phố đổ nát ở chân trời (dựng 1 lần, tất định) */
function makeSkyline() {
  const out = [];
  for (let x = -12, i = 0; x < W + 12; i++) {
    const w = 9 + ((i * 37) % 21), h = 10 + ((i * 53) % 44) + (i % 7 === 3 ? 22 : 0);
    out.push({ x, w, h, cut: (i * 29) % 4, lit: (i * 13) % 5, ant: i % 6 === 1 });
    x += w + ((i * 7) % 5) - 2;
  }
  return out;
}
/** Vẽ thành phố đổ nát: chân nhà tại y0, s = tỉ lệ cao, t = thời gian (lửa chập chờn) */
function drawRuins(c, list, y0, s, t, col = DOOM.ruin) {
  for (const b of list) {
    const h = Math.round(b.h * s), top = y0 - h, x = b.x, w = b.w;
    c.fillStyle = col; c.beginPath(); c.moveTo(x, y0); c.lineTo(x, top + (b.cut === 1 ? 5 : 0));
    if (b.cut === 2) { c.lineTo(x + w * 0.35, top); c.lineTo(x + w * 0.55, top + 7); c.lineTo(x + w * 0.75, top + 2); }   // mái vỡ
    else if (b.cut === 3) { c.lineTo(x + w * 0.5, top - 3); }
    c.lineTo(x + w, top + (b.cut === 1 ? 0 : b.cut === 3 ? 6 : 0)); c.lineTo(x + w, y0); c.closePath(); c.fill();
    if (b.ant) { c.fillRect(x + Math.round(w / 2), top - 8, 1, 8); }
    // cửa sổ còn cháy
    for (let yy = top + 4; yy < y0 - 3; yy += 5) for (let xx = x + 2; xx < x + w - 2; xx += 4) {
      const hsh = (xx * 7 + yy * 13 + b.lit) % 23;
      if (hsh < 2) { c.fillStyle = withAlpha(hsh ? "#ff9a3a" : "#c8501e", 0.55 + 0.4 * Math.sin(t * 7 + xx + yy)); c.fillRect(xx, yy, 1, 1); }
    }
  }
}

// ------------------------------------------------------------------ chữ pixel 3x5 (in lên thùng đạn)
const GLYPH = {
  "0": "111101101101111", "1": "010110010010111", "2": "111001111100111", "3": "111001111001111",
  "4": "101101111001001", "5": "111100111001111", "6": "111100111101111", "7": "111001010010010",
  "8": "111101111101111", "9": "111101111001111", ".": "000000000000010", "-": "000000111000000",
  A: "010101111101101", M: "101111111101101", O: "111101101101111", G: "111100101101111", X: "101101010101101",
  C: "111100100100111", E: "111100110100111", D: "110101101101110", I: "111010010010111", N: "101111111111101",
  S: "111100111001111", T: "111010010010010", R: "110101110101101", P: "111101111100100", U: "101101101101111",
  H: "101101111101101", L: "100100100100111", F: "111100110100100", " ": "000000000000000",
  J: "001001001101111", B: "110101110101110", K: "101110100110101",
};
function stencil(c, s, x, y, col) {
  c.fillStyle = col;
  for (const ch of s) {
    const g = GLYPH[ch] ?? GLYPH[" "];
    for (let i = 0; i < 15; i++) if (g[i] === "1") c.fillRect(x + (i % 3), y + ((i / 3) | 0), 1, 1);
    x += 4;
  }
}
const R = (c, x, y, w, h, col) => { c.fillStyle = col; c.fillRect(x, y, w, h); };

// ------------------------------------------------------------------ NỀN TĨNH (vẽ 1 lần vào canvas riêng)
function paintStatic() {
  const cv = document.createElement("canvas");
  cv.width = W + M * 2; cv.height = H + M * 2;
  const c = cv.getContext("2d");
  c.translate(M, M);
  // ---- trần
  R(c, -M, -M, W + M * 2, 36 + M, "#1d2118");
  for (let x = -M; x < W + M; x += 24) R(c, x, 4, 1, 28, "#262b20");
  // ống dẫn + máng cáp
  R(c, -M, 9, W + M * 2, 4, "#4b5240"); R(c, -M, 9, W + M * 2, 1, "#6d7560"); R(c, -M, 12, W + M * 2, 1, "#2a2e22");
  R(c, -M, 16, W + M * 2, 3, "#3d4434"); R(c, -M, 16, W + M * 2, 1, "#59614d");
  for (let x = 12; x < W; x += 40) { R(c, x, 7, 3, 14, "#2a2e22"); R(c, x, 7, 1, 14, "#4b5240"); }
  for (let x = 0; x < W; x += 9) R(c, x, 20, 5, 2, (x / 9) % 2 ? "#a88a2c" : "#262626");   // dây cáp vàng đen
  // đèn trần
  for (const [x, y] of LAMPS) { R(c, x - 8, y - 2, 16, 6, "#2b2f25"); R(c, x - 6, y, 12, 3, "#e9cf86"); R(c, x - 6, y, 12, 1, "#fff2c0"); }
  // mép trần / vách
  R(c, -M, 32, W + M * 2, 3, "#2f3526"); R(c, -M, 32, W + M * 2, 1, "#5a6249");

  // ---- vách cách nhiệt chần ô (y 35..150)
  R(c, -M, 35, W + M * 2, 115, "#525b3c");
  for (let y = 35; y < 150; y += 14) for (let x = -M; x < W + M; x += 12) {
    R(c, x, y, 12, 1, "#3e4630");            // đường chần ngang
    R(c, x, y + 1, 11, 1, "#626c48");         // sáng mép trên
    R(c, x + 11, y, 1, 14, "#434b33");        // chần dọc
    R(c, x + 11, y + 13, 1, 1, "#353c27");    // nút chần
  }
  // vệt bẩn / mảng loang
  for (let i = 0; i < 70; i++) { const x = (i * 97) % W, y = 40 + ((i * 53) % 104); R(c, x, y, 2 + (i % 3), 1, i % 2 ? "#4a5236" : "#5c6644"); }
  // sườn thép + đinh tán
  for (const x of RIBS) {
    R(c, x - 3, 33, 6, 119, "#2f3524"); R(c, x - 3, 33, 1, 119, "#5f684f"); R(c, x + 2, 33, 1, 119, "#1d2117");
    for (let y = 40; y < 148; y += 10) R(c, x - 1, y, 2, 1, "#7a8466");
  }
  // khung cửa sổ (kính vẽ động)
  for (const [x, y, r] of PORTHOLES) {
    c.fillStyle = "#1b1f16"; c.beginPath(); c.arc(x, y, r + 4, 0, TAU); c.fill();
    c.fillStyle = "#7d866b"; c.beginPath(); c.arc(x, y, r + 3, 0, TAU); c.fill();
    c.fillStyle = "#3d4433"; c.beginPath(); c.arc(x, y, r + 2, 0, TAU); c.fill();
    c.fillStyle = "#a3ab8f"; c.beginPath(); c.arc(x - 1, y - 1, r + 2, Math.PI * 1.05, Math.PI * 1.55); c.lineTo(x - 1, y - 1); c.fill();
    for (let k = 0; k < 8; k++) { const a = (k / 8) * TAU; R(c, Math.round(x + Math.cos(a) * (r + 3)), Math.round(y + Math.sin(a) * (r + 3)), 1, 1, "#c4cbb0"); }
    c.save(); c.globalCompositeOperation = "destination-out"; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); c.restore();
  }
  // biển cảnh báo dưới cửa sổ
  R(c, 186, 96, 34, 9, "#c9a531"); R(c, 187, 97, 32, 7, "#1d1d1a"); stencil(c, "EXIT", 196, 98, "#e7c94a");
  for (const hx of [150, 170]) { R(c, hx - 1, 97, 3, 3, "#9aa0a6"); R(c, hx - 1, 97, 3, 1, "#d8dde2"); }   // móc treo dù
  R(c, 262, 92, 48, 9, "#c9a531"); R(c, 263, 93, 46, 7, "#1d1d1a"); stencil(c, "C-130", 268, 94, "#e7c94a");

  // ---- giá súng trên vách (x 10..124, y 104..148)
  R(c, 10, 104, 114, 44, "#3a2a1c"); R(c, 10, 104, 114, 1, "#6a4c32"); R(c, 10, 147, 114, 1, "#1f160e");
  for (let x = 12; x < 124; x += 6) R(c, x, 105, 1, 42, "#33251a");
  for (const y of [116, 130, 144]) { R(c, 12, y, 110, 2, "#24190f"); for (const px of [20, 62, 104]) { R(c, px, y - 3, 2, 4, "#9aa0a6"); R(c, px, y - 3, 2, 1, "#d8dde2"); } }
  drawGunIcon(c, "rifle", 16, 103, 52, 14, 1);
  drawGunIcon(c, "sniper", 16, 117, 104, 14, 1);
  drawGunIcon(c, "carbine", 66, 103, 52, 14, 1);
  drawGunIcon(c, "shotgun", 16, 131, 60, 14, 1);
  drawGunIcon(c, "smg", 76, 131, 44, 14, 1);
  // bình cứu hỏa
  R(c, 226, 112, 8, 22, "#b3261e"); R(c, 226, 112, 2, 22, "#e24a3c"); R(c, 227, 108, 6, 4, "#2a2a2a"); R(c, 233, 109, 4, 2, "#2a2a2a");
  R(c, 225, 133, 10, 2, "#6a6f73"); R(c, 227, 118, 6, 3, "#efe6c8");

  // ---- ghế lưới đỏ dọc vách (y 150..174)
  R(c, -M, 150, W + M * 2, 2, "#9aa0a6"); R(c, -M, 150, W + M * 2, 1, "#d6dbe0");
  R(c, -M, 152, W + M * 2, 18, "#8a2f27");
  for (let y = 152; y < 170; y += 3) for (let x = -M + ((y / 3) % 2) * 2; x < W + M; x += 4) R(c, x, y, 2, 1, "#6a221c");
  for (let x = -M; x < W + M; x += 30) R(c, x, 152, 1, 18, "#5a1c17");
  R(c, -M, 170, W + M * 2, 3, "#9aa0a6"); R(c, -M, 170, W + M * 2, 1, "#d6dbe0"); R(c, -M, 172, W + M * 2, 1, "#4a4f53");
  for (let x = 6; x < W; x += 30) { R(c, x, 173, 2, 10, "#7a8085"); R(c, x, 173, 1, 10, "#b6bcc1"); }

  // ---- sàn thép (y 174..270)
  R(c, -M, 174, W + M * 2, H - 174 + M, "#3b3f41");
  R(c, -M, 174, W + M * 2, 3, "#2a2d2f");
  for (let y = 180; y < H + M; y += 22) {
    R(c, -M, y, W + M * 2, 1, "#2a2d2f"); R(c, -M, y + 1, W + M * 2, 1, "#4b5053");
    for (let x = ((y / 22) % 2) * 24 - M; x < W + M; x += 48) R(c, x, y + 1, 1, 21, "#2c2f31");
  }
  for (let y = 184; y < H + M; y += 5) for (let x = ((y / 5) % 2) * 3; x < W; x += 6) R(c, x, y, 1, 1, "#45494c");   // hạt chống trượt
  // 2 ray con lăn
  for (const y of [204, 246]) {
    R(c, -M, y, W + M * 2, 5, "#2a2d30"); R(c, -M, y, W + M * 2, 1, "#6c7276");
    for (let x = -M; x < W + M; x += 8) { R(c, x + 2, y + 1, 4, 3, "#7d8387"); R(c, x + 2, y + 1, 4, 1, "#b0b6ba"); }
  }
  for (let x = 20; x < W; x += 60) { c.strokeStyle = "#8a8f93"; c.lineWidth = 1; c.beginPath(); c.arc(x + 0.5, 226.5, 2.5, 0, TAU); c.stroke(); }

  // ---- CỬA NHẢY ở đuôi khoang: khung sọc vàng đen + khoét trống (trời vẽ phía sau, cánh cửa vẽ động)
  R(c, DOOR.x0 - 6, DOOR.y0 - 6, DOOR.x1 - DOOR.x0 + 12, DOOR.y1 - DOOR.y0 + 8, "#1b1f16");
  for (let y = DOOR.y0 - 5; y < DOOR.y1 + 1; y += 4) {
    R(c, DOOR.x0 - 5, y, 4, 2, "#e0b830"); R(c, DOOR.x1 + 1, y + 2, 4, 2, "#e0b830");
  }
  for (let x = DOOR.x0 - 5; x < DOOR.x1 + 5; x += 4) R(c, x, DOOR.y0 - 5, 2, 3, "#e0b830");
  R(c, DOOR.x0 - 2, DOOR.y1, DOOR.x1 - DOOR.x0 + 4, 3, "#6c7276");
  stencil(c, "JUMP", DOOR.x0 - 1, DOOR.y0 - 13, "#e7c94a");
  c.save(); c.globalCompositeOperation = "destination-out"; c.fillRect(DOOR.x0, DOOR.y0, DOOR.x1 - DOOR.x0, DOOR.y1 - DOOR.y0); c.restore();

  // ---- hàng hóa: thùng đạn gỗ, hộp đạn, thùng y tế (x 136..250)
  crate(c, 150, 208, 46, 26, "5.56");
  crate(c, 198, 208, 46, 26, "7.62");
  crate(c, 172, 183, 46, 25, "AMMO");
  ammoCan(c, 138, 220); ammoCan(c, 126, 228);
  medBox(c, 222, 186);
  // dây chằng hàng
  R(c, 164, 183, 2, 51, "#c9a531"); R(c, 230, 183, 2, 51, "#c9a531");
  R(c, 149, 221, 96, 2, "#a88a2c");
  return cv;
}

function crate(c, x, y, w, h, label) {
  R(c, x, y, w, h, "#4f5a2c"); R(c, x, y, w, 2, "#6b7840"); R(c, x, y + h - 2, w, 2, "#323a1b");
  R(c, x, y, 2, h, "#3b4421"); R(c, x + w - 2, y, 2, h, "#3b4421");
  for (let k = x + 4; k < x + w - 3; k += 7) R(c, k, y + 2, 1, h - 4, "#46512a");
  R(c, x + 3, y + 3, 3, 3, "#8a8f93"); R(c, x + w - 6, y + 3, 3, 3, "#8a8f93");
  const tw = label.length * 4 - 1;
  stencil(c, label, x + Math.round((w - tw) / 2), y + Math.round(h / 2) - 2, "#d7c160");
}
function ammoCan(c, x, y) {
  R(c, x, y, 16, 12, "#4e5a35"); R(c, x, y, 16, 1, "#6e7c4d"); R(c, x, y + 11, 16, 1, "#2e3520");
  R(c, x + 4, y - 2, 8, 2, "#2e3520"); R(c, x + 2, y + 4, 12, 3, "#c9a531"); stencil(c, "X", x + 6, y + 3, "#1d1d1a");
}
function medBox(c, x, y) {
  R(c, x, y, 26, 20, "#cfd3d6"); R(c, x, y, 26, 2, "#f2f4f5"); R(c, x, y + 18, 26, 2, "#8c9195");
  R(c, x + 11, y + 4, 4, 12, "#d8322a"); R(c, x + 7, y + 8, 12, 4, "#d8322a");
}

// ------------------------------------------------------------------ MÂY
function makeClouds() {
  const list = [];
  for (let i = 0; i < 26; i++) {
    const far = i % 3 === 0;
    list.push({ x: rand(0, 900), y: rand(56, 92), r: far ? rand(3, 6) : rand(5, 11), sp: far ? rand(26, 40) : rand(70, 110), far, puffs: Math.floor(rand(3, 6)) });
  }
  return list;
}

export class Cabin {
  constructor() {
    this.bg = null;            // nền tĩnh (vẽ khi vào khoang lần đầu — lúc đó ảnh súng đã tải xong)
    this.light = new LightLayer(W, H);
    this.vignette = makeVignette(W, H, 0.5);
    this.cam = { x: 0, y: 0, rx: 0, ry: 0, w: W, h: H, inView: () => true };
    this.clouds = makeClouds();
    this.dust = Array.from({ length: 34 }, () => ({ x: rand(0, W), y: rand(30, 260), vx: rand(-4, 4), vy: rand(-3, 3), a: rand(0.15, 0.5) }));
    this.fallClouds = Array.from({ length: 22 }, () => ({ x: rand(-40, W + 40), y: rand(-40, H + 80), r: rand(10, 34), sp: rand(260, 520), a: rand(0.5, 0.95) }));
    this.skyline = makeSkyline();
    this.ash = Array.from({ length: 46 }, (_, i) => ({ x: rand(0, W), y: rand(0, H), v: rand(10, 26), d: rand(-14, -4), s: i % 5 ? 1 : 2, a: rand(0.3, 0.7) }));
    this.audio = new CabinAudio();
    this.reset();
  }

  reset() {
    this.t = 0; this.eta = CABIN_ETA;
    this.burstT = 0; this.nextBurst = rand(...SHAKE.gap) * 0.5;
    this.sx = 0; this.sy = 0; this.swing = 0; this.swingV = 0;
    this.engineT = 0; this.whiteout = 0;
    this.hx = HERO.x; this.hy = HERO.y; this.flip = false; this.moving = false; this.target = null;
    this.near = null; this.door = 0; this.seq = null; this.wind = [];
    // ngoài trời: tia chớp (bolt) + chớp lửa tiếng nổ (boom) — 0..1, tắt dần
    this.fx = { bolt: 0, boom: 0, boomX: 240, boltX: 240 };
    this.nextBolt = rand(2.5, 6); this.nextBoom = rand(1.5, 4);
    this.flak = []; this.timers = []; this.greenHorn = false;
  }

  /**
   * Vào khoang: hero = { sprite, anim } (spritesheet nhân vật, xem ACTOR_SPRITES trong main.js).
   * boarding = true: chiếu cảnh LÊN MÁY BAY ở sân bay trước (bỏ qua được).
   */
  enter(hero, images = {}, boarding = false) {
    this.reset();
    this.hero = hero;
    hero?.anim?.set?.("idle");
    this.bgImg = CABIN_IMAGES.background ? images["cabin:bg"] ?? null : null;
    if (!this.bg) this.bg = paintStatic();
    if (boarding) this.seq = { kind: "board", t: 0 };
  }
  /** Bắt đầu cảnh NHẢY: mở cửa, chạy ra cửa, nhảy, rơi tự do qua mây */
  startJump(hero) {
    if (hero) this.hero = hero;
    if (!this.bg) this.bg = paintStatic();
    this.target = null;
    // đường ra cửa: vòng PHÍA TRƯỚC đống thùng hàng (không đi xuyên qua)
    const path = [];
    if (this.hx < DOOR.x0 - 30 && this.hy < 248) path.push({ x: this.hx, y: 250 });
    if (this.hx < DOOR.x0 - 30) path.push({ x: DOOR.x0 - 26, y: Math.max(this.hy, 250) });
    path.push({ x: DOOR.x0 + 4, y: 226 });
    this.seq = { kind: "jump", t: 0, jumped: false, path };
  }
  /** Bỏ qua cảnh cắt đang chiếu */
  skip() {
    if (!this.seq) return null;
    const k = this.seq.kind;
    this.seq = null; this.door = 0;
    return k === "board" ? "boarded" : "jumped";
  }

  /** Lúc hết phần trong khoang của cảnh nhảy: >= jumpIn và luôn 0.5s sau khi nhảy khỏi cửa */
  get jumpEnd() { const q = this.seq; return q?.jumped ? Math.max(CUTSCENE.jumpIn, q.jt + 0.5) : 99; }
  get ready() { return this.eta <= 0; }
  get turbulent() { return this.burstT > 0; }
  get cutscene() { return this.seq?.kind ?? null; }

  /**
   * input: { keys, pressed, mouse, joy } của main.js · canWalk: false khi bảng HTML đang giữ phím
   * Trả về sự kiện: "gear" (mở trang bị) | "door" (ra cửa nhảy) | "boarded" | "jumped" | null
   */
  update(dt, sound, input = null, canWalk = true) {
    this.t += dt;
    this.eta = Math.max(0, this.eta - dt);
    let ev = null;
    if (this.seq) ev = this.updateSeq(dt, sound);
    // nhiễu động: lặng -> rung mạnh 1-2 giây -> lặng
    if (this.burstT > 0) this.burstT -= dt;
    else if ((this.nextBurst -= dt) <= 0 && this.seq?.kind !== "board") {
      this.burstT = rand(...SHAKE.burstDur); this.nextBurst = rand(...SHAKE.gap);
      this.swingV += rand(-1.6, 1.6);
      this.audio.rattle(sound, 0.6);
    }
    const amp = this.burstT > 0 ? SHAKE.burst * Math.min(1, this.burstT * 2) : SHAKE.calm;
    this.sx = Math.round(Math.sin(this.t * 23) * amp * 0.5 + (this.burstT > 0 ? rand(-1, 1) * amp * 0.5 : 0));
    this.sy = Math.round(Math.sin(this.t * 17.3) * amp + Math.sin(this.t * 41) * amp * 0.35);
    // dây treo / dù đung đưa (lò xo tắt dần) — cửa mở thì gió giật mạnh
    this.swingV += (-this.swing * 9 - this.swingV * 1.6) * dt + Math.sin(this.t * 1.7) * 0.25 * dt;
    if (this.burstT > 0) this.swingV += rand(-6, 6) * dt;
    if (this.door > 0) this.swingV += (-4 * this.door + rand(-3, 3)) * dt;
    this.swing += this.swingV * dt;
    for (const cl of this.clouds) { cl.x -= cl.sp * dt; if (cl.x < -60) { cl.x += 960; cl.y = rand(56, 92); } }
    this.whiteout = Math.max(0, this.whiteout - dt * 0.6);
    if (Math.random() < dt * 0.05) this.whiteout = 1;
    for (const d of this.dust) {
      d.x += (d.vx + this.sx * 6 - this.door * 120) * dt; d.y += (d.vy + Math.sin(this.t + d.x) * 2) * dt;
      if (d.x < 0) d.x += W; if (d.x > W) d.x -= W; if (d.y < 30) d.y = 260; if (d.y > 262) d.y = 32;
    }
    this.tickSky(dt, sound, !this.seq);
    if (this.ready && !this.greenHorn) { this.greenHorn = true; this.audio.horn(sound, 2); }   // đèn XANH: còi báo nhảy
    this.audio.update(sound, this.mix());
    if (!this.seq) ev = this.updateWalk(dt, input, canWalk) ?? ev;
    if (this.hero?.anim) { this.hero.anim.set(this.moving ? "run" : "idle"); this.hero.anim.update(dt, 1); }
    return ev;
  }

  /** Đang ở BẢN ĐỒ CHIẾN THUẬT (vẫn ngồi trên máy bay): giữ tiếng máy bay + nổ xa, nhỏ hơn 1 chút */
  ambience(dt, sound) {
    this.t += dt;
    if (this.burstT > 0) this.burstT -= dt;
    this.tickSky(dt, sound, true);
    this.audio.update(sound, { ...this.mix(), level: 0.7 });
  }

  /** Chớp, nổ ngoài trời theo nhịp ngẫu nhiên (random = false: chỉ chạy hẹn giờ + tắt dần, dùng trong cảnh cắt) */
  tickSky(dt, sound, random = true) {
    const f = this.fx;
    f.bolt = Math.max(0, f.bolt - dt * 3.2);
    f.boom = Math.max(0, f.boom - dt * 1.7);
    for (const tm of this.timers) if ((tm.t -= dt) <= 0) tm.fn();
    this.timers = this.timers.filter((tm) => tm.t > 0);
    for (const p of this.flak) { p.x -= 95 * dt; p.r += 7 * dt; p.a -= dt * 0.22; }
    this.flak = this.flak.filter((p) => p.a > 0 && p.x > -30);
    if (!random) return;
    if ((this.nextBolt -= dt) <= 0) { this.nextBolt = rand(...SKY_EVENTS.bolt); this.lightning(sound); }
    if ((this.nextBoom -= dt) <= 0) { this.nextBoom = rand(...SKY_EVENTS.boom); this.explode(sound, Math.random() < SKY_EVENTS.nearChance); }
  }
  after(t, fn) { this.timers.push({ t, fn }); }
  /** TIA CHỚP: lóe 2 lần + sấm đến sau (càng xa càng trễ) */
  lightning(sound, x = rand(0, W)) {
    this.fx.bolt = 1; this.fx.boltX = x;
    this.after(0.13, () => { this.fx.bolt = Math.max(this.fx.bolt, 0.75); });
    this.audio.thunder(sound, rand(0.5, 1.5));
  }
  /** PHÁO PHÒNG KHÔNG nổ ngoài cửa sổ: near = sát thân máy bay (rung mạnh, đèn chớp, mảnh văng) */
  explode(sound, near = false, x = rand(30, 420)) {
    this.fx.boom = near ? 1 : rand(0.45, 0.7); this.fx.boomX = x;
    this.flak.push({ x: x + 240, y: rand(62, 86), r: near ? 4 : 2, a: 1 });   // đám khói đen trôi qua các cửa sổ
    if (near) {
      this.burstT = Math.max(this.burstT, 1.2); this.nextBurst = Math.max(this.nextBurst, 3); this.swingV += rand(-3, 3);
      this.audio.boom(sound, rand(0.75, 1), 0.03);
    } else this.audio.boom(sound, rand(0.08, 0.4), rand(0.25, 0.8));   // xa: thấy chớp trước, nghe tiếng sau
  }
  /** Mức âm thanh theo cảnh: động cơ, gió, còi... (xem CabinAudio.update) */
  mix() {
    const q = this.seq, burst = this.burstT > 0 ? Math.min(1, this.burstT) : 0;
    if (q?.kind === "board") {   // ngoài sân bay: còi báo động, máy nổ rồi tăng tốc, cửa đóng thì còi nhỏ hẳn
      const t = q.t, spool = clamp((t - 2.2) / 1.8, 0, 1);
      return { level: 1, engine: 0.32 + spool * 0.5, pitch: 0.55 + spool * 0.5, wind: 0.22 + spool * 0.25, gust: 0.8, hiss: 0.05, siren: t < 3 ? 1 : clamp(1 - (t - 3) / 1.2, 0.12, 1) };
    }
    if (q?.kind === "jump" && q.fallT) {   // rơi tự do: gió gào, máy bay xa dần (tiếng trầm xuống)
      const k = clamp((q.t - q.fallT) / 0.9, 0, 1);
      return { level: 1, engine: 0.85 * (1 - k), pitch: 1 - k * 0.18, wind: 1, gust: 1, hiss: 1, siren: 0 };
    }
    const d = this.door;
    return { level: 1, engine: 0.6 + burst * 0.22 + d * 0.25, pitch: 1 + Math.sin(this.t * 0.4) * 0.015 + burst * 0.03, wind: 0.3 + burst * 0.3 + d * 0.6, gust: 0.5 + burst * 0.5, hiss: 0.03 + d * 0.9, siren: 0 };
  }

  /** Đi lại trong khoang: WASD / phím mũi tên / click-chạm sàn để đi tới; E hoặc chạm vào điểm sáng để dùng */
  updateWalk(dt, input, canWalk) {
    let dx = 0, dy = 0, ev = null;
    if (input && canWalk) {
      const k = input.keys;
      if (k.has("w") || k.has("arrowup")) dy -= 1;
      if (k.has("s") || k.has("arrowdown")) dy += 1;
      if (k.has("a") || k.has("arrowleft")) dx -= 1;
      if (k.has("d") || k.has("arrowright")) dx += 1;
      dx += input.joy?.x ?? 0; dy += input.joy?.y ?? 0;
      if (dx || dy) this.target = null;
      if (input.pressed.has("mouse0")) {
        const mx = input.mouse.x, my = input.mouse.y;
        const hit = Object.entries(CABIN_SPOTS).find(([, s]) => Math.hypot(mx - s.x, my - (s.y - 14)) < s.r + 8);
        this.target = hit ? { x: hit[1].x, y: hit[1].y, spot: hit[0] } : { x: mx, y: Math.max(my, FLOOR.y0) };
      }
      if (this.target) {
        const tx = this.target.x - this.hx, ty = this.target.y - this.hy, d = Math.hypot(tx, ty);
        if (d < 3) { if (this.target.spot) ev = this.target.spot; this.target = null; }
        else { dx = tx / d; dy = ty / d; }
      }
    }
    const len = Math.hypot(dx, dy);
    if (len > 1) { dx /= len; dy /= len; }
    const bx = this.hx, by = this.hy;
    if (len > 0.1) {
      this.moveTo(this.hx + dx * WALK * dt, this.hy);
      this.moveTo(this.hx, this.hy + dy * WALK * dt);
      if (Math.abs(dx) > 0.1) this.flip = dx < 0;
      if (this.target && Math.hypot(this.hx - bx, this.hy - by) < WALK * dt * 0.2) this.target = null;   // kẹt: thôi đi
    }
    this.moving = Math.hypot(this.hx - bx, this.hy - by) > WALK * dt * 0.3;
    // đứng gần điểm nào?
    this.near = null;
    for (const [id, s] of Object.entries(CABIN_SPOTS)) if (Math.hypot(this.hx - s.x, this.hy - s.y) < s.r) this.near = id;
    if (input && canWalk && this.near && input.pressed.has("e")) ev = this.near;
    return ev;
  }
  moveTo(x, y) {
    x = clamp(x, FLOOR.x0, FLOOR.x1); y = clamp(y, FLOOR.y0, FLOOR.y1);
    for (const [x0, y0, x1, y1] of BLOCKS) if (x > x0 && x < x1 && y > y0 && y < y1) return;
    this.hx = x; this.hy = y;
  }

  updateSeq(dt, sound) {
    const q = this.seq;
    q.t += dt;
    if (q.kind === "board") {   // kịch bản: bom nổ ở thành phố xa -> chớp + sấm -> máy nổ -> pháo nổ gần lúc cất cánh
      if (q.t > 0.85 && !q.c1) { q.c1 = true; this.fx.boom = 0.8; this.fx.boomX = 338; this.audio.boom(sound, 0.35, 0.35); }
      if (q.t > 1.75 && !q.c2) { q.c2 = true; this.lightning(sound, 250); }
      if (q.t > 2.7 && !q.rev) { q.rev = true; this.audio.rattle(sound, 0.4); }
      if (q.t > 3.55 && !q.c3) { q.c3 = true; this.fx.boom = 1; this.fx.boomX = 62; this.audio.boom(sound, 0.6, 0.1); }
      if (q.t >= CUTSCENE.board) { this.seq = null; return "boarded"; }
      return null;
    }
    // ---- NHẢY: cửa trượt lên, gió lùa, chạy ra cửa, nhảy, rơi tự do
    if (q.t > 6 && !q.jumped) { q.jumped = true; q.jt = q.t; }   // an toàn: kẹt đường thì vẫn nhảy
    if (q.t < this.jumpEnd) {
      this.door = Math.min(1, q.t / 0.45);
      if (!q.opened) { q.opened = true; this.audio.horn(sound, 2); this.audio.rattle(sound, 0.8); }
      if (q.t > 0.3 && !q.jumped) {
        const wp = q.path[0], ddx = wp.x - this.hx, ddy = wp.y - this.hy, d = Math.hypot(ddx, ddy);
        if (d > 3) { const sp = 210 * dt; this.hx += (ddx / d) * Math.min(sp, d); this.hy += (ddy / d) * Math.min(sp, d); if (Math.abs(ddx) > 1) this.flip = ddx < 0; this.moving = true; }
        else if (q.path.length > 1) q.path.shift();
        else { q.jumped = true; q.jt = q.t; this.moving = false; this.flip = false; sound?.play("skillDash", 0.6); }
      }
      if (q.jumped) { const k = q.t - q.jt; this.hx += 160 * dt; this.hy += (-90 + 420 * k) * dt; }
      // gió lùa từ cửa vào
      if (this.door > 0.3 && this.wind.length < 40) this.wind.push({ x: DOOR.x0 + rand(0, 20), y: rand(DOOR.y0, DOOR.y1), v: rand(260, 420), l: rand(8, 22) });
      for (const w of this.wind) w.x -= w.v * dt;
      this.wind = this.wind.filter((w) => w.x > 0);
      return null;
    }
    this.door = 1;
    if (!q.fallT) q.fallT = q.t;
    const ft = q.t - q.fallT;
    if (ft > 0.3 && !q.f1) { q.f1 = true; this.fx.boom = 0.9; this.fx.boomX = 330; this.audio.boom(sound, 0.7, 0.02); }   // pháo nổ cạnh máy bay
    if (ft > 1.15 && !q.f2) { q.f2 = true; this.lightning(sound, 120); }
    if (q.t - q.fallT >= CUTSCENE.fall) { this.seq = null; this.door = 0; this.wind = []; return "jumped"; }
    for (const c of this.fallClouds) { c.y -= c.sp * dt; if (c.y < -50) { c.y = H + rand(20, 120); c.x = rand(-40, W + 40); } }
    return null;
  }

  draw(c) {
    const k = this.seq?.kind;
    if (k === "board") return this.drawBoarding(c, this.seq.t);
    if (k === "jump" && this.seq.fallT) return this.drawFall(c, this.seq.t - this.seq.fallT);
    const sx = this.sx, sy = this.sy;
    c.fillStyle = "#0d0f0b"; c.fillRect(0, 0, W, H);
    // ---- trời + mây phía sau cửa sổ / cửa nhảy
    for (const [x, y, r] of PORTHOLES) this.drawWindow(c, x + sx, y + sy, r);
    this.drawDoorSky(c, sx, sy);
    // ---- nền (ảnh riêng hoặc hình vẽ)
    if (this.bgImg) c.drawImage(this.bgImg, sx, sy, W, H);
    else c.drawImage(this.bg, sx - M, sy - M);
    this.drawDoorPanel(c, sx, sy);
    // ---- ánh trời đỏ quạch hắt qua cửa sổ xuống sàn (chớp / nổ thì lóe sáng)
    const f = this.fx;
    c.save(); c.globalCompositeOperation = "lighter";
    for (const [x, y] of PORTHOLES) {
      const bk = f.boom * clamp(1 - Math.abs(x - f.boomX) / 170, 0, 1);
      const beam = (col, a) => {
        if (a <= 0.004) return;
        c.fillStyle = withAlpha(col, a);
        c.beginPath(); c.moveTo(x - 6 + sx, y + sy); c.lineTo(x + 6 + sx, y + sy); c.lineTo(x + 40 + sx, 250 + sy); c.lineTo(x + 18 + sx, 250 + sy); c.closePath(); c.fill();
      };
      beam("#ff8a4a", 0.028 + 0.012 * Math.sin(this.t * 0.7 + x) - this.whiteout * 0.02 + bk * 0.24);
      beam("#c8d4ff", f.bolt * 0.22);
    }
    if (this.door > 0) {   // cửa mở: ánh lửa đỏ + chớp tràn vào sàn
      c.fillStyle = withAlpha("#ff8a50", 0.1 * this.door + f.bolt * 0.12 + f.boom * 0.08);
      c.beginPath(); c.moveTo(DOOR.x0 + sx, DOOR.y0 + sy); c.lineTo(DOOR.x0 + sx, DOOR.y1 + sy); c.lineTo(DOOR.x0 - 120 + sx, 262 + sy); c.lineTo(DOOR.x0 - 40 + sx, 262 + sy); c.closePath(); c.fill();
    }
    c.restore();
    this.drawStaticLine(c, sx, sy);
    this.drawJumpLight(c, JUMP_LIGHT[0] + sx, JUMP_LIGHT[1] + sy);
    // ---- điểm tương tác (vòng sáng trên sàn + chữ khi đứng gần)
    if (!this.seq) for (const [id, s] of Object.entries(CABIN_SPOTS)) {
      const on = this.near === id, a = on ? 0.75 : 0.28 + 0.12 * Math.sin(this.t * 3 + s.x);
      c.strokeStyle = withAlpha(id === "door" ? "#5fdc8c" : "#ffe26b", a); c.lineWidth = 1;
      c.beginPath(); c.ellipse(s.x + sx, s.y + sy, 12, 4, 0, 0, TAU); c.stroke();
    }
    // ---- nhân vật
    const jumpingOut = this.seq?.kind === "jump" && this.seq.jumped && this.hx > DOOR.x0 + 6;
    const hx = Math.round(this.hx + sx + (this.burstT > 0 && !this.seq ? Math.round(Math.sin(this.t * 13)) : 0)), hy = Math.round(this.hy + sy);
    if (!jumpingOut) { c.fillStyle = "rgba(0,0,0,0.35)"; c.beginPath(); c.ellipse(hx, hy, 8, 2.5, 0, 0, TAU); c.fill(); }
    c.save();
    if (jumpingOut) { c.beginPath(); c.rect(0, 0, DOOR.x1 + sx, H); c.clip(); }   // ra khỏi cửa thì khuất sau khung
    const h = this.hero;
    if (h?.sprite && h.anim) h.sprite.sheet.draw(c, h.anim.col, h.anim.row, hx, hy, this.flip);
    else { c.fillStyle = "#c8c0e0"; c.fillRect(hx - 5, hy - 20, 10, 20); }
    c.restore();
    // ---- gió lùa + bụi
    if (this.wind.length) { c.fillStyle = "rgba(235,245,255,0.55)"; for (const w of this.wind) c.fillRect(Math.round(w.x), Math.round(w.y + sy), Math.round(w.l), 1); }
    for (const d of this.dust) { c.fillStyle = withAlpha("#c8bcb2", d.a * 0.6); c.fillRect(Math.round(d.x), Math.round(d.y + sy), 1, 1); }
    // ---- ánh sáng
    const flick = (this.burstT > 0 && Math.sin(this.t * 37) > 0.6) || (f.boom > 0.75 && Math.sin(this.t * 53) > 0) ? 0.5 : 1;   // nổ gần: đèn chập chờn
    const green = this.ready || this.seq?.kind === "jump";
    const L = [];
    for (const [x, y] of LAMPS) L.push({ x, y: y + 18, r: 92 * flick, color: "#ffcf7a", a: flick, glow: 0.13 });
    for (const [x, y] of PORTHOLES) {
      const bk = f.boom * clamp(1 - Math.abs(x - f.boomX) / 170, 0, 1);
      L.push({ x, y: y + 6, r: 34 + f.bolt * 46 + bk * 30, color: f.bolt > 0.25 ? "#c8d4ff" : "#ff7a3a", a: 0.42 + f.bolt * 0.55 + bk * 0.5, glow: 0.05 + f.bolt * 0.1 + bk * 0.16 });
    }
    L.push({ x: JUMP_LIGHT[0], y: JUMP_LIGHT[1], r: 56, color: green ? "#4dff7a" : "#ff3b30", a: 0.9 + 0.1 * Math.sin(this.t * 6), glow: 0.22 });
    L.push({ x: this.hx, y: this.hy - 16, r: 70, color: null, a: 0.8, glow: 0 });
    L.push({ x: 200, y: 214, r: 90, color: null, a: 0.55, glow: 0 });
    L.push({ x: (DOOR.x0 + DOOR.x1) / 2, y: 140, r: 60 + 70 * this.door, color: this.door > 0 ? "#ff8a50" : null, a: 0.4 + 0.6 * this.door, glow: 0.1 * this.door });
    this.cam.rx = -sx; this.cam.ry = -sy;
    this.light.render(c, this.cam, { color: "#06050a", alpha: 0.62 - f.bolt * 0.22 }, L);
    c.drawImage(this.vignette, 0, 0);
    if (this.burstT > 0 && flick < 1) { c.fillStyle = "rgba(0,0,0,0.12)"; c.fillRect(0, 0, W, H); }
    // ---- chữ gợi ý khi đứng gần điểm tương tác
    if (!this.seq && this.near) {
      const s = CABIN_SPOTS[this.near], label = s.label;
      c.font = "8px monospace"; c.textBaseline = "top"; c.textAlign = "center";
      const tw = Math.ceil(c.measureText(label).width) + 8, x = Math.round(this.hx + sx), y = Math.round(this.hy + sy - 54);
      c.fillStyle = "rgba(8,10,6,0.85)"; c.fillRect(x - tw / 2, y, tw, 11);
      c.fillStyle = this.near === "door" ? "#5fdc8c" : "#ffe26b"; c.fillRect(x - tw / 2, y + 10, tw, 1);
      c.fillStyle = "#f4f0dc"; c.fillText(label, x, y + 2);
      c.textAlign = "left";
    }
    const end = this.jumpEnd;
    if (this.seq?.kind === "jump" && this.seq.jumped && this.seq.t > end - 0.3) {   // lao ra ngoài: tối sầm màu khói lửa
      c.fillStyle = withAlpha("#2a1614", clamp((this.seq.t - (end - 0.3)) / 0.3, 0, 1)); c.fillRect(0, 0, W, H);
    }
  }

  /** Trời phía sau cửa nhảy: mây đen + tàn lửa lao vun vút khi cửa mở */
  drawDoorSky(c, sx, sy) {
    const x0 = DOOR.x0 + sx, y0 = DOOR.y0 + sy, w = DOOR.x1 - DOOR.x0, h = DOOR.y1 - DOOR.y0, f = this.fx;
    doomSky(c, x0, y0, w, h);
    c.save(); c.beginPath(); c.rect(x0, y0, w, h); c.clip();
    if (f.bolt > 0.45) this.drawBolt(c, x0 + w / 2, y0, y0 + h * 0.7);
    for (let i = 0; i < 7; i++) {
      const cx = x0 + ((i * 53 - this.t * 260) % 90 + 90) % 90 - 20, cy = y0 + 10 + i * 16;
      c.fillStyle = i % 2 ? DOOM.cloud : DOOM.cloudFar;
      c.beginPath(); c.arc(cx, cy, 6 + (i % 3) * 3, 0, TAU); c.arc(cx + 8, cy + 2, 5 + (i % 2) * 3, 0, TAU); c.fill();
      c.fillStyle = DOOM.cloudLit; c.fillRect(Math.round(cx - 4), Math.round(cy + 6 + (i % 3) * 2), 14, 1);
    }
    for (let i = 0; i < 9; i++) {   // tàn lửa
      const ex = x0 + ((i * 37 - this.t * 340) % 60 + 60) % 60 - 10, ey = y0 + ((i * 29 + this.t * 20) % h);
      c.fillStyle = withAlpha(DOOM.ember, 0.5 + 0.5 * Math.sin(this.t * 9 + i)); c.fillRect(Math.round(ex), Math.round(ey), 2, 1);
    }
    if (f.bolt > 0) { c.fillStyle = withAlpha(DOOM.bolt, f.bolt * 0.6); c.fillRect(x0, y0, w, h); }
    const bk = f.boom * clamp(1 - Math.abs(DOOR.x0 - f.boomX) / 170, 0, 1);
    if (bk > 0) { c.fillStyle = withAlpha(DOOM.boom, bk * 0.8); c.fillRect(x0, y0, w, h); }
    c.restore();
  }
  /** Cánh cửa nhảy: trượt lên trần khi mở (door 0 -> 1) */
  drawDoorPanel(c, sx, sy) {
    const x0 = DOOR.x0 + sx, y0 = DOOR.y0 + sy, w = DOOR.x1 - DOOR.x0, h = DOOR.y1 - DOOR.y0;
    const off = Math.round(this.door * (h + 4));
    if (off >= h) return;
    c.save(); c.beginPath(); c.rect(x0, y0, w, h); c.clip();
    const y = y0 - off;
    R(c, x0, y, w, h, "#3d4533"); R(c, x0, y, w, 2, "#5c654c"); R(c, x0 + w - 2, y, 2, h, "#262b20");
    for (let yy = y + 12; yy < y + h; yy += 18) R(c, x0 + 2, yy, w - 4, 1, "#2f3527");
    // ô kính nhỏ + tay nắm + vạch đỏ
    R(c, x0 + 7, y + 14, 12, 16, "#1b1f16"); R(c, x0 + 8, y + 15, 10, 14, "#4a221a"); R(c, x0 + 8, y + 25, 10, 4, "#8a3a1c"); R(c, x0 + 9, y + 16, 2, 8, "#8a5a4a");
    R(c, x0 + 4, y + 60, 3, 12, "#9aa0a6"); R(c, x0 + 4, y + 60, 1, 12, "#d8dde2");
    R(c, x0 + 2, y + h - 18, w - 4, 3, "#b3261e");
    c.restore();
  }

  // ------------------------------------------------------------------ CẢNH LÊN MÁY BAY (sân bay ngày tận thế)
  drawBoarding(c, t) {
    const f = this.fx;
    // ---- trời đỏ quạch + mặt trời đỏ khuất sau khói
    doomSky(c, 0, 0, W, 176);
    c.fillStyle = withAlpha("#c2462a", 0.5); c.beginPath(); c.arc(356, 114, 15, 0, TAU); c.fill();
    c.fillStyle = withAlpha("#c2462a", 0.12); c.beginPath(); c.arc(356, 114, 30, 0, TAU); c.fill();
    // ---- mây đen cuồn cuộn 3 lớp (lớp xa trôi chậm), lớp thấp hắt ánh lửa
    for (let L = 0; L < 3; L++) {
      const cy = 16 + L * 24, sp = 3 + L * 5, col = ["#100c10", "#191316", "#251a1b"][L];
      for (let i = 0; i < 13; i++) {
        const cx = ((i * 47 + L * 31 - t * sp) % 560 + 560) % 560 - 40, r = 13 + ((i * 7 + L * 3) % 5) * 4, yy = cy + Math.sin(i * 1.7 + L) * 6;
        c.fillStyle = col; c.beginPath(); c.arc(cx, yy, r, 0, TAU); c.fill();
        if (L === 2) { c.fillStyle = withAlpha(DOOM.cloudLit, 0.5); c.fillRect(Math.round(cx - r * 0.7), Math.round(yy + r * 0.82), Math.round(r * 1.4), 1); }
      }
    }
    if (f.bolt > 0.35) this.drawBolt(c, f.boltX, 0, 140);
    // ---- đèn pha quét trời
    c.save(); c.globalCompositeOperation = "lighter";
    for (const [bx, ph] of [[96, 0], [418, 2.1]]) {
      const a = -Math.PI / 2 + Math.sin(t * 0.55 + ph) * 0.55, len = 230;
      const ex = bx + Math.cos(a) * len, ey = 168 + Math.sin(a) * len, px = -Math.sin(a) * 16, py = Math.cos(a) * 16;
      const g = c.createLinearGradient(bx, 168, ex, ey); g.addColorStop(0, "rgba(235,225,200,0.17)"); g.addColorStop(1, "rgba(235,225,200,0)");
      c.fillStyle = g; c.beginPath(); c.moveTo(bx - 1, 168); c.lineTo(ex + px, ey + py); c.lineTo(ex - px, ey - py); c.lineTo(bx + 1, 168); c.closePath(); c.fill();
    }
    // ánh lửa hắt sau dãy nhà đổ
    for (const x of [46, 128, 212, 300, 384, 452]) {
      const r = 30 + Math.sin(t * 5 + x) * 3, g = c.createRadialGradient(x, 170, 0, x, 170, r);
      g.addColorStop(0, "rgba(255,110,40,0.42)"); g.addColorStop(1, "rgba(255,110,40,0)");
      c.fillStyle = g; c.fillRect(x - r, 170 - r, r * 2, r * 2);
    }
    c.restore();
    // ---- cột khói đen bốc lên từ thành phố, bạt theo gió
    for (const [x0, ph] of [[46, 0], [212, 0.4], [384, 0.7]]) for (let i = 0; i < 9; i++) {
      const k = (t * 0.12 + ph + i / 9) % 1, x = x0 + k * 60 + Math.sin(i * 2 + t) * 3, y = 166 - k * 150;
      c.fillStyle = withAlpha(DOOM.smoke, 0.9 * (1 - k * 0.7)); c.beginPath(); c.arc(x, y, 4 + k * 20, 0, TAU); c.fill();
    }
    // ---- thành phố đổ nát + bom nổ ở xa (theo kịch bản trong updateSeq)
    drawRuins(c, this.skyline, 172, 1, t);
    this.drawBlast(c, 338, 158, (t - 0.85) / 2.4, 128);   // bom lớn ở thành phố xa: nấm khói vượt qua nóc máy bay
    this.drawBlast(c, 62, 156, (t - 3.55) / 1.6, 60);
    for (const x of [40, 131, 205, 297, 377, 448]) {   // lửa liếm chân nhà
      const fh = 3 + Math.round(2 * Math.abs(Math.sin(t * 9 + x)));
      R(c, x - 2, 172 - fh, 5, fh, "#ff7a2a"); R(c, x - 1, 172 - fh + 1, 3, fh - 1, "#ffd27a");
    }
    // tháp điều khiển gãy + đèn đỏ
    R(c, 402, 128, 4, 44, DOOM.ruin); R(c, 396, 124, 14, 5, DOOM.ruin); R(c, 404, 120, 6, 4, DOOM.ruin);
    if (Math.sin(t * 5) > 0) R(c, 399, 125, 2, 2, "#ff3b30");
    // ---- đường băng nứt + đèn viền đỏ nhấp nháy
    R(c, 0, 172, W, 98, "#1b1c1f"); R(c, 0, 172, W, 1, "#3a3236");
    for (let x = 0; x < W; x += 6) R(c, x, 174 + ((x * 7) % 5), 1, 1, "#28292d");
    for (const [x, y, l] of [[60, 236, 40], [300, 250, 30], [180, 210, 26]]) { R(c, x, y, l, 1, "#101113"); R(c, x + l, y + 1, 12, 1, "#101113"); }   // vết nứt
    for (let x = 0; x < W; x += 40) R(c, x, 228, 22, 3, "#5c5a54");
    R(c, 0, 262, W, 8, "#141518");
    for (let x = 12; x < W; x += 38) if (Math.sin(t * 6 + x * 0.3) > -0.1) { R(c, x, 180, 2, 2, "#ff3b30"); R(c, x - 1, 179, 4, 4, "rgba(255,59,48,0.25)"); }
    // ---- hàng rào kẽm gai + zombie đã lọt vào, lê bước về phía máy bay (viền ánh lửa cho dễ thấy)
    R(c, 0, 160, W, 1, "#2a2427"); R(c, 0, 166, W, 1, "#2a2427");
    for (let x = 4; x < W; x += 24) R(c, x, 157, 2, 16, "#0f0d0f");
    for (let x = 0; x < W; x += 6) R(c, x + 2, 159 + (x % 12 ? 0 : 1), 2, 1, "#3a3235");
    for (let i = 0; i < 4; i++) {
      const zx = Math.round(472 - i * 21 - t * (4 + i)), zy = 178 + (i % 2) * 3, sw = Math.round(Math.sin(t * 4 + i * 2)), lg = Math.round(Math.sin(t * 5 + i));
      R(c, zx - 2, zy - 4, 2, 4 + lg, "#1c221a"); R(c, zx + 1, zy - 4, 2, 4 - lg, "#1c221a");          // chân
      R(c, zx - 3, zy - 11 + sw, 6, 7, "#2e3a2a"); R(c, zx + 2, zy - 11 + sw, 1, 7, "#c8501e");          // thân + viền lửa
      R(c, zx - 8, zy - 10 + sw, 6, 2, "#3e4c36"); R(c, zx - 8, zy - 8 + sw, 5, 1, "#2e3a2a");          // 2 tay giơ ra trước
      R(c, zx - 3, zy - 15 + sw, 5, 4, "#52634a"); R(c, zx + 1, zy - 15 + sw, 1, 4, "#d8783a");         // đầu
      R(c, zx - 2, zy - 14 + sw, 1, 1, "#ff3b30");
    }
    // ---- xác xe cháy (tiền cảnh phải)
    R(c, 392, 238, 40, 12, "#121012"); R(c, 400, 230, 24, 9, "#121012"); R(c, 404, 232, 7, 5, "#2a1210");
    for (const wx of [400, 424]) { c.fillStyle = "#050405"; c.beginPath(); c.arc(wx, 250, 4, 0, TAU); c.fill(); }
    for (let i = 0; i < 3; i++) { const fh = 4 + Math.round(3 * Math.abs(Math.sin(t * 8 + i * 2))); R(c, 404 + i * 6, 230 - fh, 4, fh, "#ff7a2a"); R(c, 405 + i * 6, 231 - fh, 2, fh - 2, "#ffd27a"); }
    for (let i = 0; i < 6; i++) { const k = (t * 0.4 + i / 6) % 1; c.fillStyle = withAlpha(DOOM.smoke, 0.8 * (1 - k)); c.beginPath(); c.arc(412 + k * 30, 222 - k * 70, 3 + k * 9, 0, TAU); c.fill(); }

    // ---- máy bay vận tải (nhìn ngang, mũi sang PHẢI, đuôi + cửa sau bên TRÁI) — tối màu, hắt lửa đỏ
    const shake = t > 2.7 ? Math.round(Math.sin(t * 40) * 1) : 0, px = 0, py = shake;
    const body = "#4a5444", top = "#5d684f", belly = "#30382b", ink = "#110e10";
    c.fillStyle = ink; c.beginPath(); c.moveTo(118 + px, 120 + py); c.lineTo(132 + px, 36 + py); c.lineTo(160 + px, 36 + py); c.lineTo(186 + px, 112 + py); c.closePath(); c.fill();
    c.fillStyle = body; c.beginPath(); c.moveTo(121 + px, 118 + py); c.lineTo(134 + px, 39 + py); c.lineTo(158 + px, 39 + py); c.lineTo(182 + px, 112 + py); c.closePath(); c.fill();
    R(c, 136 + px, 42 + py, 20, 3, top); R(c, 140 + px, 56 + py, 10, 8, "#a88a2c"); stencil(c, "07", 141 + px, 58 + py, "#1b1f16");
    if (Math.sin(t * 7) > 0.3) R(c, 145 + px, 34 + py, 3, 2, "#ff3b30");   // đèn đỏ đỉnh đuôi
    R(c, 104 + px, 104 + py, 70, 6, ink); R(c, 106 + px, 105 + py, 66, 4, top);
    c.fillStyle = ink; c.beginPath();
    c.moveTo(112 + px, 116 + py); c.lineTo(200 + px, 96 + py); c.lineTo(420 + px, 96 + py); c.quadraticCurveTo(466 + px, 98 + py, 470 + px, 126 + py);
    c.quadraticCurveTo(464 + px, 152 + py, 420 + px, 154 + py); c.lineTo(190 + px, 154 + py); c.lineTo(150 + px, 148 + py); c.closePath(); c.fill();
    c.fillStyle = body; c.beginPath();
    c.moveTo(116 + px, 116 + py); c.lineTo(201 + px, 99 + py); c.lineTo(420 + px, 99 + py); c.quadraticCurveTo(462 + px, 101 + py, 466 + px, 126 + py);
    c.quadraticCurveTo(460 + px, 149 + py, 420 + px, 151 + py); c.lineTo(190 + px, 151 + py); c.lineTo(152 + px, 146 + py); c.closePath(); c.fill();
    R(c, 200 + px, 100 + py, 220, 6, top); R(c, 190 + px, 140 + py, 232, 11, belly);
    R(c, 190 + px, 150 + py, 232, 1, withAlpha("#ff7a3a", 0.45));   // bụng máy bay hắt ánh lửa
    for (let x = 220; x < 420; x += 26) R(c, x + px, 112 + py, 6, 6, "#e0a85a");   // cửa sổ thân sáng đèn vàng
    c.fillStyle = "#2e1a18"; c.beginPath(); c.moveTo(436 + px, 106 + py); c.lineTo(458 + px, 110 + py); c.lineTo(462 + px, 118 + py); c.lineTo(440 + px, 116 + py); c.closePath(); c.fill();
    R(c, 441 + px, 108 + py, 6, 1, "#a8502a");
    stencil(c, "C-130", 300 + px, 126 + py, "#a8a478");
    R(c, 236 + px, 148 + py, 90, 12, "#262c22");
    for (const wx of [250, 276, 302]) { c.fillStyle = "#0a0a0a"; c.beginPath(); c.arc(wx + px, 164 + py, 6, 0, TAU); c.fill(); c.fillStyle = "#444"; c.fillRect(wx - 1 + px, 163 + py, 2, 2); }
    R(c, 214 + px, 90 + py, 150, 7, ink); R(c, 216 + px, 91 + py, 146, 4, top);
    const spin = t < 2.2 ? t * 3 : 6.6 + (t - 2.2) * 28;
    for (const ex of [246, 310]) {
      R(c, ex - 16 + px, 96 + py, 34, 12, ink); R(c, ex - 15 + px, 97 + py, 32, 9, "#404a38"); R(c, ex - 15 + px, 97 + py, 32, 2, top);
      const bx = ex + 20 + px, by = 102 + py, blade = Math.abs(Math.sin(spin)) * 16;
      if (t > 2.6) { c.fillStyle = "rgba(200,190,180,0.25)"; c.beginPath(); c.ellipse(bx, by, 2, 17, 0, 0, TAU); c.fill(); }
      else { R(c, bx - 1, Math.round(by - blade), 2, Math.round(blade * 2), "#1a1a1a"); }
      R(c, bx - 2, by - 2, 4, 4, "#8a8f93");
    }
    // ---- cửa sau (dốc): hạ xuống đất lúc đầu, đóng lên sau khi nhân vật vào
    const close = clamp((t - 2.2) / 0.7, 0, 1);
    const hinge = [150 + px, 146 + py], len = 58, ang = (1 - close) * 0.42 + close * -1.15;
    const tip = [hinge[0] - Math.cos(ang) * len, hinge[1] + Math.sin(ang) * len];
    if (close < 1) {
      c.fillStyle = "#2b2213"; c.beginPath(); c.moveTo(150 + px, 146 + py); c.lineTo(126 + px, 118 + py); c.lineTo(176 + px, 108 + py); c.lineTo(190 + px, 146 + py); c.closePath(); c.fill();
      c.fillStyle = withAlpha("#ffcf7a", 0.5 * (1 - close)); c.beginPath(); c.moveTo(150 + px, 146 + py); c.lineTo(132 + px, 120 + py); c.lineTo(174 + px, 112 + py); c.lineTo(186 + px, 146 + py); c.closePath(); c.fill();
    }
    c.strokeStyle = ink; c.lineWidth = 7; c.beginPath(); c.moveTo(hinge[0], hinge[1]); c.lineTo(tip[0], tip[1]); c.stroke();
    c.strokeStyle = "#5a6452"; c.lineWidth = 5; c.beginPath(); c.moveTo(hinge[0], hinge[1]); c.lineTo(tip[0], tip[1]); c.stroke();
    // ---- nhân vật chạy từ trái vào, lên dốc, khuất vào khoang
    const h = this.hero;
    let hxp, hyp, show = true;
    if (t < 1.3) { hxp = -20 + (t / 1.3) * 118; hyp = 214 - (t / 1.3) * 22; }
    else if (t < 2.1) { const k = (t - 1.3) / 0.8; hxp = 98 + k * 52; hyp = 192 - k * 44; }
    else show = false;
    if (show) {
      if (h?.anim) { h.anim.set("run"); }
      c.fillStyle = "rgba(0,0,0,0.35)"; if (t < 1.3) { c.beginPath(); c.ellipse(hxp, hyp, 7, 2, 0, 0, TAU); c.fill(); }
      if (h?.sprite && h.anim) h.sprite.sheet.draw(c, h.anim.col, h.anim.row, Math.round(hxp), Math.round(hyp), false);
      else { c.fillStyle = "#c8c0e0"; c.fillRect(hxp - 5, hyp - 20, 10, 20); }
    }
    // khói / bụi phụt ra sau khi động cơ chạy
    if (t > 2.6) for (let i = 0; i < 10; i++) {
      const k = ((t * 1.6 + i * 0.1) % 1);
      c.fillStyle = withAlpha("#4a4044", 0.45 * (1 - k)); c.beginPath(); c.arc(110 - k * 90, 170 - k * 8 + (i % 3) * 3, 4 + k * 10, 0, TAU); c.fill();
    }
    // ---- tro bụi bay + chớp sáng toàn cảnh + viền tối
    for (const a of this.ash) {
      const x = ((a.x + t * a.d) % W + W) % W, y = (a.y + t * a.v) % H;
      c.fillStyle = withAlpha(DOOM.ash, a.a); c.fillRect(Math.round(x), Math.round(y), a.s, a.s);
    }
    this.drawFlashes(c);
    c.drawImage(this.vignette, 0, 0);
    // chú thích + mờ dần cuối cảnh
    c.font = "8px monospace"; c.textBaseline = "top"; c.textAlign = "left";
    c.fillStyle = "rgba(0,0,0,0.6)"; c.fillRect(10, 10, 198, 22);
    c.fillStyle = "#ff8a4a"; c.fillText("C-130 · CHUYẾN SƠ TÁN CUỐI", 16, 12);
    c.fillStyle = "#d8d4c4"; c.fillText(t < 2.2 ? "Lên máy bay — nhanh lên!" : t < 3.2 ? "Đóng cửa sau · khởi động" : "Cất cánh!", 16, 22);
    const fade = clamp((t - (CUTSCENE.board - 0.7)) / 0.7, 0, 1) + clamp(1 - t / 0.3, 0, 1);
    if (fade > 0) { c.fillStyle = withAlpha("#05060a", Math.min(1, fade)); c.fillRect(0, 0, W, H); }
  }

  /** Tia chớp gấp khúc từ y0 xuống y1 (hình dạng cố định theo x) */
  drawBolt(c, x, y0, y1) {
    let s = (Math.floor(Math.abs(x) * 7.31) % 2147483646) + 1;
    const rr = () => (s = (s * 16807) % 2147483647) / 2147483647;
    const pts = [[x, y0]];
    for (let y = y0, cx = x; y < y1;) { y += 6 + rr() * 10; cx += (rr() - 0.5) * 16; pts.push([cx, y]); }
    c.save(); c.globalCompositeOperation = "lighter";
    for (const [lw, col] of [[4, "rgba(150,170,255,0.28)"], [1.5, "#f4f6ff"]]) {
      c.strokeStyle = col; c.lineWidth = lw; c.beginPath();
      pts.forEach(([px, py], i) => (i ? c.lineTo(px, py) : c.moveTo(px, py))); c.stroke();
    }
    const [bx, by] = pts[Math.floor(pts.length / 2)];
    c.lineWidth = 1; c.strokeStyle = "#dfe6ff"; c.beginPath(); c.moveTo(bx, by); c.lineTo(bx + 14, by + 12); c.lineTo(bx + 10, by + 24); c.stroke();
    c.restore();
  }
  /** Vụ nổ ở xa: cầu lửa bốc lên thành nấm khói (k = tuổi 0..1, tall = độ cao cột khói) */
  drawBlast(c, x, y, k, tall = 46) {
    if (!(k > 0 && k < 1)) return;
    const rise = Math.min(1, k * 1.8), top = y - rise * tall;
    for (let i = 0; i < 10; i++) {   // thân nấm
      const yy = y - (y - top) * (i / 9), r = 2 + k * 6 + (i / 9) * 2;
      c.fillStyle = withAlpha(DOOM.smoke, 0.85 * (1 - k * 0.45)); c.beginPath(); c.arc(x + Math.sin(i * 1.3 + k * 3) * 2, yy, r, 0, TAU); c.fill();
    }
    const cap = 6 + k * (tall * 0.22);   // mũ nấm
    c.fillStyle = withAlpha("#2a2022", 0.9 * (1 - k * 0.4));
    c.beginPath(); c.ellipse(x, top, cap * 1.5, cap * 0.8, 0, 0, TAU); c.fill();
    c.fillStyle = withAlpha(DOOM.fire, Math.max(0, 0.95 - k * 1.1));   // lõi lửa trong mũ nấm, tắt dần
    c.beginPath(); c.ellipse(x, top + cap * 0.2, cap * 1.1, cap * 0.5, 0, 0, TAU); c.fill();
    c.fillStyle = withAlpha("#ffe0a0", Math.max(0, 1 - k * 2.4));
    c.beginPath(); c.arc(x, top + cap * 0.2, cap * 0.55, 0, TAU); c.fill();
    c.fillStyle = withAlpha(DOOM.cloudLit, Math.max(0, 0.6 - k * 0.5)); c.fillRect(Math.round(x - cap * 1.3), Math.round(top + cap * 0.7), Math.round(cap * 2.6), 1);
  }
  /** Chớp sáng toàn màn hình: tia chớp (trắng xanh) + tiếng nổ (cam, quanh boomX) */
  drawFlashes(c) {
    const f = this.fx;
    if (f.bolt > 0) { c.fillStyle = withAlpha("#cfd8ff", f.bolt * 0.32); c.fillRect(0, 0, W, H); }
    if (f.boom > 0) {
      const g = c.createRadialGradient(f.boomX, 150, 0, f.boomX, 150, 260);
      g.addColorStop(0, withAlpha(DOOM.boom, f.boom * 0.45)); g.addColorStop(1, withAlpha(DOOM.boom, 0));
      c.fillStyle = g; c.fillRect(0, 0, W, H);
    }
  }

  // ------------------------------------------------------------------ CẢNH RƠI TỰ DO (lao xuống thành phố đang cháy)
  drawFall(c, t) {
    const f = this.fx, k = clamp(t / CUTSCENE.fall, 0, 1);
    doomSky(c, 0, 0, W, H, [[0, "#0d0a0e"], [0.45, "#241619"], [0.8, "#4e2018"], [1, "#7c321a"]]);
    if (f.bolt > 0.35) this.drawBolt(c, f.boltX, 0, 170);
    // thành phố đổ nát bên dưới — to dần khi rơi xuống
    const base = H + 50 - k * 64;
    c.save(); c.globalCompositeOperation = "lighter";
    for (const x of [40, 150, 250, 330, 430]) {
      const r = 50 + Math.sin(t * 6 + x) * 4, g = c.createRadialGradient(x, base - 10, 0, x, base - 10, r);
      g.addColorStop(0, "rgba(255,110,40,0.4)"); g.addColorStop(1, "rgba(255,110,40,0)"); c.fillStyle = g; c.fillRect(x - r, base - 10 - r, r * 2, r * 2);
    }
    c.restore();
    for (const [x0, ph] of [[60, 0], [250, 0.3], [410, 0.6]]) for (let i = 0; i < 7; i++) {   // khói bốc lên vụt qua (đang rơi)
      const q = (t * 0.55 + ph + i / 7) % 1, y = base - 20 - q * (base + 40);
      c.fillStyle = withAlpha(DOOM.smoke, 0.75 * (1 - q * 0.6)); c.beginPath(); c.arc(x0 + q * 40, y, 6 + q * 22, 0, TAU); c.fill();
    }
    drawRuins(c, this.skyline, base, 1.2 + k * 1.1, t);
    // máy bay xa dần phía trên, pháo phòng không nổ quanh
    if (t < 1.1) {
      const px = 300 - t * 160, py = 30 - t * 40, s = 1 - t * 0.5;
      c.fillStyle = "#16121a"; c.fillRect(Math.round(px - 40 * s), Math.round(py), Math.round(80 * s), Math.max(2, Math.round(10 * s)));
      c.fillRect(Math.round(px - 12 * s), Math.round(py - 4 * s), Math.round(24 * s), Math.max(1, Math.round(3 * s)));
      for (const [dx, dy, t0] of [[30, 14, 0.3], [-24, -10, 0.55], [52, -6, 0.8]]) {
        const a = t - t0; if (a < 0) continue;
        c.fillStyle = withAlpha(DOOM.smoke, Math.max(0, 0.9 - a * 0.6)); c.beginPath(); c.arc(px + dx, py + dy, 3 + a * 8, 0, TAU); c.fill();
        if (a < 0.2) { c.fillStyle = withAlpha(DOOM.boom, 1 - a * 5); c.beginPath(); c.arc(px + dx, py + dy, 3 + a * 6, 0, TAU); c.fill(); }
      }
    }
    // mây đen vọt lên (đang rơi xuống), mép dưới hắt lửa
    for (const cl of this.fallClouds) {
      c.fillStyle = withAlpha(DOOM.cloudLit, cl.a * 0.6);
      c.beginPath(); c.arc(cl.x, cl.y + 3, cl.r, 0, TAU); c.arc(cl.x + cl.r * 0.9, cl.y + 7, cl.r * 0.7, 0, TAU); c.fill();
      c.fillStyle = withAlpha(DOOM.cloud, cl.a * 0.92);
      c.beginPath(); c.arc(cl.x, cl.y, cl.r, 0, TAU); c.arc(cl.x + cl.r * 0.9, cl.y + 4, cl.r * 0.7, 0, TAU); c.arc(cl.x - cl.r * 0.8, cl.y + 6, cl.r * 0.6, 0, TAU); c.fill();
    }
    // tàn lửa vọt lên + vệt gió
    for (let i = 0; i < 26; i++) {
      const x = (i * 71) % W + Math.sin(t * 3 + i) * 4, y = ((i * 113 - t * 520) % (H + 20) + H + 20) % (H + 20) - 10;
      c.fillStyle = withAlpha(i % 3 ? DOOM.ember : DOOM.ash, 0.7); c.fillRect(Math.round(x), Math.round(y), 1, 3);
    }
    c.fillStyle = "rgba(200,180,170,0.3)";
    for (let i = 0; i < 18; i++) { const x = (i * 53) % W, y = ((i * 97) - t * 600) % H; c.fillRect(x, (y + H) % H, 1, 14); }
    // nhân vật rơi, chao nhẹ
    const h = this.hero, hx = Math.round(W / 2 + Math.sin(t * 5) * 6), hy = Math.round(H / 2 + 18 + Math.sin(t * 3) * 3);
    if (h?.anim) h.anim.set("skill");
    c.save(); c.translate(hx, hy); c.rotate(Math.sin(t * 4) * 0.18);
    if (h?.sprite && h.anim) h.sprite.sheet.draw(c, h.anim.col, h.anim.row, 0, 0, false);
    else { c.fillStyle = "#c8c0e0"; c.fillRect(-5, -20, 10, 20); }
    c.restore();
    this.drawFlashes(c);
    c.drawImage(this.vignette, 0, 0);
    c.font = "8px monospace"; c.textBaseline = "top"; c.textAlign = "center";
    c.fillStyle = "rgba(0,0,0,0.55)"; c.fillRect(W / 2 - 60, 14, 120, 12);
    c.fillStyle = "#ffd0b0"; c.fillText(`ĐỘ CAO ${Math.max(0, Math.round(3200 - k * 2100))} m`, W / 2, 16);
    c.textAlign = "left";
    const fadeIn = clamp(1 - t / 0.35, 0, 1), fadeOut = clamp((t - (CUTSCENE.fall - 0.4)) / 0.4, 0, 1);
    if (fadeIn > 0) { c.fillStyle = withAlpha("#2a1614", fadeIn); c.fillRect(0, 0, W, H); }
    if (fadeOut > 0) { c.fillStyle = withAlpha("#05060a", fadeOut); c.fillRect(0, 0, W, H); }
  }

  drawWindow(c, x, y, r) {
    const f = this.fx, wx = x - this.sx;   // vị trí cửa sổ trong khoang (không tính rung)
    c.save();
    c.beginPath(); c.arc(x, y, r + 0.5, 0, TAU); c.clip();
    doomSky(c, x - r - 1, y - r - 1, r * 2 + 2, r * 2 + 2, [[0, "#140e12"], [0.5, "#2e1a1a"], [0.85, "#6a2a17"], [1, "#94401b"]]);
    if (f.bolt > 0.45 && Math.abs(wx - f.boltX) < 45) this.drawBolt(c, x + (f.boltX - wx) * 0.15, y - r - 2, y + r + 2);
    // mọi cửa sổ cùng nhìn 1 bầu trời: mây đen + khói pháo trôi lần lượt qua từng cửa sổ (mây xa trôi chậm hơn)
    const oy = y - 74;
    for (const p of this.flak) {
      const px = p.x - 240 + this.sx;
      if (px < x - r - 14 || px > x + r + 14) continue;
      c.fillStyle = withAlpha("#0e0b0d", Math.min(1, p.a * 1.2));
      c.beginPath(); c.arc(px, p.y + oy, p.r, 0, TAU); c.arc(px + p.r * 0.7, p.y + oy + 1, p.r * 0.7, 0, TAU); c.fill();
      if (p.a > 0.8) { c.fillStyle = withAlpha(DOOM.boom, (p.a - 0.8) * 5); c.beginPath(); c.arc(px, p.y + oy, p.r * 0.7, 0, TAU); c.fill(); }
    }
    for (const cl of this.clouds) {
      const cx = cl.x - 240 + this.sx;
      if (cx < x - r - 40 || cx > x + r + 40) continue;
      for (let k = 0; k < cl.puffs; k++) {
        const px = cx + k * cl.r * 0.9 - cl.puffs * cl.r * 0.45, py = cl.y + oy + Math.sin(k * 2.3) * cl.r * 0.35;
        c.fillStyle = cl.far ? DOOM.cloudFar : DOOM.cloud;
        c.beginPath(); c.arc(Math.round(px), Math.round(py), cl.r * (0.7 + 0.3 * Math.sin(k * 1.7 + cl.x * 0.01)), 0, TAU); c.fill();
        if (!cl.far) { c.fillStyle = DOOM.cloudLit; c.fillRect(Math.round(px - cl.r * 0.6), Math.round(py + cl.r * 0.5), Math.round(cl.r * 1.2), 1); }
      }
    }
    if (this.whiteout > 0) { c.fillStyle = withAlpha("#221b1e", Math.min(0.85, this.whiteout)); c.fillRect(x - r, y - r, r * 2, r * 2); }   // bay qua cột khói
    if (f.bolt > 0) { c.fillStyle = withAlpha(DOOM.bolt, f.bolt * 0.7); c.fillRect(x - r, y - r, r * 2, r * 2); }
    const bk = f.boom * clamp(1 - Math.abs(wx - f.boomX) / 170, 0, 1);
    if (bk > 0) { c.fillStyle = withAlpha(DOOM.boom, bk * 0.85); c.fillRect(x - r, y - r, r * 2, r * 2); }
    c.fillStyle = "rgba(255,215,190,0.16)"; c.fillRect(Math.round(x - r * 0.55), Math.round(y - r * 0.5), 2, Math.round(r * 0.9));
    c.restore();
  }

  drawStaticLine(c, sx, sy) {
    const y0 = 40 + sy;
    R(c, 0, y0, DOOR.x0 - 8, 1, "#c9a531"); R(c, 0, y0 + 1, DOOR.x0 - 8, 1, "#7a6420");
    const sw = clamp(this.swing, -0.6, 0.6);
    for (const [x0, len] of [[22, 44], [54, 36], [118, 48], [182, 40], [300, 42], [372, 38]]) {
      const x = x0 + sx;
      c.strokeStyle = "#c9a531"; c.lineWidth = 2; c.beginPath(); c.moveTo(x, y0 + 1);
      c.quadraticCurveTo(x + sw * len * 0.6, y0 + len * 0.6, x + sw * len, y0 + len); c.stroke();
      R(c, Math.round(x + sw * len) - 1, Math.round(y0 + len), 3, 4, "#9aa0a6");
    }
    for (const [x0, col] of [[150, "#5a6440"], [170, "#566039"]]) {
      const x = Math.round(x0 + sx + sw * 6), y = 101 + sy;
      R(c, x0 + sx, 99 + sy, 1, 3, "#2e3324");
      R(c, x - 8, y, 16, 22, col); R(c, x - 8, y, 16, 2, "#748055"); R(c, x - 8, y + 20, 16, 2, "#353c27");
      R(c, x - 6, y + 4, 2, 16, "#3c4228"); R(c, x + 4, y + 4, 2, 16, "#3c4228"); R(c, x - 6, y + 10, 12, 2, "#3c4228");
      R(c, x + 1, y + 13, 3, 3, "#e0b830");
    }
  }

  drawJumpLight(c, x, y) {
    const green = this.ready || this.seq?.kind === "jump";
    R(c, x - 7, y - 9, 14, 22, "#1a1c17"); R(c, x - 6, y - 8, 12, 20, "#2c2f27");
    const blink = Math.sin(this.t * 6) > -0.2;
    R(c, x - 4, y - 6, 8, 7, !green && blink ? "#ff3b30" : "#3a1410");
    R(c, x - 4, y + 3, 8, 7, green ? "#4dff7a" : "#10331b");
    R(c, x - 3, y - 5, 2, 2, "rgba(255,255,255,0.6)"); R(c, x - 3, y + 4, 2, 2, "rgba(255,255,255,0.35)");
  }
}

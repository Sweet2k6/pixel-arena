// =====================================================================================
//  KHOANG MÁY BAY C-130 — sảnh chờ của chế độ Nhảy Dù Rút Quân (giữa Cổng Xuất Kích và bản đồ chiến thuật)
//
//  Pixel art vẽ hoàn toàn bằng code. Khoang DÀI 1120px (gấp 2.3 màn hình 480x270), CAMERA TRƯỢT THEO nhân vật:
//
//    [BUỒNG LÁI 0-196]  2 phi công (cơ trưởng quay đầu, cơ phó gật gù), cửa kính lớn nhìn ra trời lửa,
//                       bảng đồng hồ + màn radar quét + đường chân trời nghiêng theo máy bay, công tắc trần nhấp nháy
//    [VÁCH NGĂN]        cửa thông, rìu cứu hộ, hộp mặt nạ dưỡng khí
//    [KHU TỔ LÁI 222-520] tủ đồ + mũ, bàn BỘ ĐÀM (đèn LED, máy hiện sóng), màn hình NHIỆM VỤ, BÀN BẢN ĐỒ (đèn treo
//                       đung đưa, cốc cà phê bốc khói), lính NGỦ GẬT trên ghế lưới (Zzz)
//    [KHOANG HÀNG 520-900] giá súng, dù treo móc, lưới hàng, thùng đạn chằng dây (TRANG BỊ), thùng phuy nhiên liệu
//    [ĐUÔI 900-1120]    CHỈ HUY NHẢY DÙ (hô "ĐI! ĐI! ĐI!" khi đèn xanh), đèn nhảy, CỬA JUMP, dốc sau thủy lực
//
//  ĐI LẠI TỰ DO: WASD / phím mũi tên / cần ảo (Shift = chạy) · BẤM / CHẠM SÀN = tự tìm đường vòng qua đồ vật (A*)
//    đồ vật trên sàn vẽ theo CHIỀU SÂU: đi ra sau bàn / thùng hàng thì bị che, đi phía trước thì che đồ vật.
//  TƯƠNG TÁC (đứng gần, bấm E hoặc chạm): phi công · bộ đàm · bản đồ · đánh thức lính · NHÌN QUA CỬA SỔ (cảnh cánh
//    máy bay + cánh quạt + pháo nổ) · chỉ huy nhảy · TRANG BỊ · CỬA NHẢY.
//  NGOÀI TRỜI: NGÀY TẬN THẾ — trời đỏ quạch, mây đen, chớp, pháo phòng không. ÂM THANH: src/cabinAudio.js
//
//  >>> ẢNH RIÊNG (tùy chọn): CABIN_IMAGES.background = ảnh CW x 270 (1120x270) thay phần vẽ vách/sàn,
//      khoét TRONG SUỐT chỗ cửa sổ (PORTHOLES), kính buồng lái và cửa nhảy để trời vẫn hiện phía sau.
// =====================================================================================
import { LightLayer, makeVignette } from "./ambient.js";
import { drawGunIcon } from "./guns.js";
import { withAlpha, clamp, rand, TAU } from "./util.js";
import { CabinAudio } from "./cabinAudio.js";

export const CABIN_IMAGES = {
  background: "",   // vd "assets/images/cabin/khoang-may-bay.png" (1120x270)
};

const W = 480, H = 270, M = 4;                          // màn hình · M = lề vẽ thừa để rung không lộ mép
/** Chiều dài khoang (px) — camera trượt trong khoảng 0..CW-W */
export const CW = 1120;
/** Cửa sổ tròn (tâm x, y, bán kính kính) — tọa độ trong khoang */
export const PORTHOLES = [[270, 74, 9], [358, 74, 9], [446, 74, 9], [560, 74, 9], [690, 74, 9], [780, 74, 9], [870, 74, 9], [950, 74, 9]];
/** Kính buồng lái (3 ô, tọa độ đa giác) */
const COCKPIT_GLASS = [[[40, 46], [84, 42], [84, 104], [34, 104]], [[90, 42], [134, 42], [134, 104], [90, 104]], [[140, 42], [180, 46], [184, 104], [140, 104]]];
const RIBS = [314, 402, 494, 520, 625, 735, 825, 910, 985];
const LAMPS = [[110, 24], [300, 24], [440, 24], [600, 24], [740, 24], [880, 24], [990, 24]];
const JUMP_LIGHT = [984, 50];
const HERO = { x: 934, y: 250 };
/** Vùng sàn đi lại được (tính theo CHÂN nhân vật) */
const FLOOR = { x0: 14, x1: 1044, y0: 186, y1: 262 };
/** Cửa nhảy ở đuôi khoang (khoảng trống x0..x1, y0..y1) */
const DOOR = { x0: 1008, x1: 1034, y0: 58, y1: 172 };
/**
 * Đồ vật trên sàn: chân đế [x0, y0, x1, y1] (không đi xuyên) · base = vạch chiều sâu (chân nhân vật < base -> bị che)
 * Lối đi y >= 248 luôn trống để chạy ra cửa nhảy.
 */
const PROPS = {
  seat1: { foot: [56, 186, 82, 200], base: 199 },
  pedestal: { foot: [100, 186, 120, 200], base: 199 },
  seat2: { foot: [136, 186, 162, 200], base: 199 },
  table: { foot: [350, 204, 424, 219], base: 218 },
  crates: { foot: [598, 196, 714, 228], base: 227 },
  drums: { foot: [788, 190, 832, 206], base: 205 },
  cans: { foot: [878, 232, 906, 244], base: 243 },
  master: { foot: [944, 194, 958, 204], base: 203 },
};
/** Điểm tương tác: đứng gần + bấm E (hoặc chạm vào). Sự kiện "gear" / "door" chuyển cho main.js, còn lại xử lý trong khoang. */
export const CABIN_SPOTS = {
  pilot: { x: 110, y: 214, r: 26, label: "E · Hỏi phi công" },
  radio: { x: 262, y: 196, r: 30, label: "E · Nghe bộ đàm" },
  map: { x: 388, y: 232, r: 24, label: "E · Xem bản đồ" },
  sleeper: { x: 470, y: 194, r: 20, label: "E · Lay lính dậy" },
  window: { x: 870, y: 192, r: 20, label: "E · Nhìn ra cửa sổ" },
  gear: { x: 656, y: 240, r: 30, label: "E · Trang bị" },
  master: { x: 950, y: 222, r: 20, label: "E · Hỏi chỉ huy nhảy" },
  door: { x: 1018, y: 226, r: 24, label: "E · Nhảy dù" },
};
const SPOT_COLOR = { door: "#5fdc8c", gear: "#ffe26b" };
const WALK = 82, RUN = 138;   // tốc độ đi / chạy (giữ Shift) trong khoang (px/giây)
/** Thời lượng cảnh cắt (giây): lên máy bay · nhảy khỏi máy bay (trong khoang + rơi tự do) */
export const CUTSCENE = { board: 4.6, jumpIn: 2.4, fall: 2.3 };
/** Tham số rung lắc */
const SHAKE = { calm: 0.55, burst: 2.6, burstDur: [1.1, 1.9], gap: [6, 12] };
/** Thời gian bay tới vùng thả (giây) — hết thì đèn chuyển XANH */
export const CABIN_ETA = 45;
/** Câu thoại khi tương tác ({eta} = số giây còn lại) */
const LINES = {
  pilot: ["Cơ trưởng: Bám chắc! Pháo phòng không dày đặc phía trước.", "Cơ trưởng: Còn {eta} giây tới vùng thả.", "Cơ phó: Động cơ số 3 hơi khục khặc... chắc không sao đâu.", "Cơ trưởng: Thành phố bên dưới cháy suốt 3 ngày rồi.", "Cơ phó: Đừng đứng sau lưng tôi, tôi run tay."],
  pilotGo: ["Cơ trưởng: ĐÈN XANH! Ra cửa nhảy ngay, tôi không vòng lại đâu!"],
  radio: ["*rè rè* ...Sói Xám, nghe rõ trả lời... *rè*", "...khu B4 có bầy xác sống rất lớn, tránh xa...", "...điểm rút quân sẽ bắn pháo sáng ĐỎ...", "...còn ai sống sót không... ai đó... *rè rè*", "...trực thăng chỉ chờ 30 giây ở điểm rút..."],
  map: ["Bản đồ: hòm tiếp tế khoanh vàng, điểm rút quân khoanh đỏ.", "Ghi chú tay: \"Lục hòm nhanh, đừng tham. Trời tối là bầy lớn kéo đến.\"", "Có vết cà phê đổ ngay giữa vùng thả... điềm xấu."],
  sleeper: ["Lính: Hửm... tới nơi chưa? ... Zzz", "Lính: Cho tôi ngủ 5 phút nữa...", "Lính: Đừng lay! Đang mơ thấy cơm tấm sườn bì chả..."],
  master: ["Chỉ huy nhảy: Móc dây dù vào cáp! Chờ đèn xanh.", "Chỉ huy nhảy: Lính mới hả? Kiểm tra trang bị lần cuối đi.", "Chỉ huy nhảy: Ra khỏi cửa thì co người lại, đếm đến 3."],
  masterGo: ["Chỉ huy nhảy: ĐÈN XANH! ĐI! ĐI! ĐI!"],
};
const pick = (a) => a[Math.floor(Math.random() * a.length)];

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
  W: "101101101111101", Y: "101101010010010", V: "101101101101010",
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


// ------------------------------------------------------------------ NỀN TĨNH (vẽ 1 lần, CW x H)
function paintStatic() {
  const cv = document.createElement("canvas");
  cv.width = CW + M * 2; cv.height = H + M * 2;
  const c = cv.getContext("2d");
  c.translate(M, M);
  const L = -M, FW = CW + M * 2;
  // ================= TRẦN
  R(c, L, -M, FW, 36 + M, "#1d2118");
  for (let x = L; x < CW + M; x += 24) R(c, x, 4, 1, 28, "#262b20");
  R(c, L, 9, FW, 4, "#4b5240"); R(c, L, 9, FW, 1, "#6d7560"); R(c, L, 12, FW, 1, "#2a2e22");
  R(c, L, 16, FW, 3, "#3d4434"); R(c, L, 16, FW, 1, "#59614d");
  for (let x = 12; x < CW; x += 40) { R(c, x, 7, 3, 14, "#2a2e22"); R(c, x, 7, 1, 14, "#4b5240"); }
  for (let x = 222; x < CW; x += 9) R(c, x, 20, 5, 2, (x / 9) % 2 ? "#a88a2c" : "#262626");   // máng cáp vàng đen
  // bảng công tắc trần buồng lái
  R(c, 24, 2, 168, 28, "#16191a"); R(c, 24, 2, 168, 1, "#3a4044");
  for (let x = 30; x < 186; x += 8) for (let y = 6; y < 26; y += 7) { R(c, x, y, 5, 4, "#2c3134"); R(c, x + 2, y + 1, 1, 2, "#b8bec2"); }
  for (const [x, y] of LAMPS) { R(c, x - 8, y - 2, 16, 6, "#2b2f25"); R(c, x - 6, y, 12, 3, "#e9cf86"); R(c, x - 6, y, 12, 1, "#fff2c0"); }
  R(c, L, 32, FW, 3, "#2f3526"); R(c, L, 32, FW, 1, "#5a6249");

  // ================= BUỒNG LÁI (0..196)
  R(c, L, 35, 200 + M, 139, "#353c31");
  for (let y = 38; y < 108; y += 6) R(c, L, y, 200 + M, 1, "#30372c");
  // mũi máy bay (vách xiên bên trái)
  c.fillStyle = "#1a1e18"; c.beginPath(); c.moveTo(L, 35); c.lineTo(30, 35); c.lineTo(22, 174); c.lineTo(L, 174); c.closePath(); c.fill();
  R(c, 4, 60, 10, 40, "#24291f"); R(c, 6, 64, 6, 6, "#3a4a3a"); R(c, 6, 74, 6, 6, "#4a3a2a");
  // khung kính
  for (const poly of COCKPIT_GLASS) {
    c.fillStyle = "#14170f"; c.beginPath(); poly.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath();
    c.lineWidth = 6; c.strokeStyle = "#14170f"; c.stroke(); c.lineWidth = 3; c.strokeStyle = "#5a6352"; c.stroke();
  }
  // bảng điều khiển bên dưới kính
  R(c, 22, 108, 172, 4, "#0e100c");                       // tấm che nắng
  R(c, 22, 112, 172, 50, "#1c201b"); R(c, 22, 112, 172, 1, "#40473d"); R(c, 22, 161, 172, 1, "#0b0c0a");
  for (const [gx, gy] of [[34, 124], [48, 124], [34, 140], [48, 140], [98, 124], [112, 124], [98, 140], [112, 140], [168, 124], [182, 124], [168, 140], [182, 140]]) {
    c.fillStyle = "#0b0c0a"; c.beginPath(); c.arc(gx, gy, 6, 0, TAU); c.fill();
    c.fillStyle = "#24282a"; c.beginPath(); c.arc(gx, gy, 5, 0, TAU); c.fill();
    for (let k = 0; k < 8; k++) { const a = (k / 8) * TAU; R(c, Math.round(gx + Math.cos(a) * 4), Math.round(gy + Math.sin(a) * 4), 1, 1, "#c8ccce"); }
  }
  R(c, 60, 116, 26, 30, "#090a08"); R(c, 128, 116, 30, 30, "#090a08");                 // khung 2 màn hình (vẽ động)
  for (let x = 28; x < 190; x += 6) R(c, x, 152, 4, 3, x % 12 ? "#3a3f42" : "#5a4a22"); // hàng nút
  stencil(c, "C-130", 140, 150, "#6c7276");
  // ================= VÁCH NGĂN BUỒNG LÁI (196..222)
  R(c, 196, 35, 26, 139, "#262c21"); R(c, 196, 35, 2, 139, "#4b5240"); R(c, 220, 35, 2, 139, "#171a14");
  for (let y = 40; y < 172; y += 8) { R(c, 199, y, 1, 1, "#7a8466"); R(c, 218, y, 1, 1, "#7a8466"); }
  R(c, 200, 52, 18, 10, "#c9a531"); R(c, 201, 53, 16, 8, "#1d1d1a"); stencil(c, "CREW", 201, 55, "#e7c94a");
  // rìu cứu hộ + hộp dưỡng khí
  R(c, 203, 70, 12, 30, "#b3261e"); R(c, 204, 71, 10, 28, "#1a1c18"); R(c, 208, 72, 2, 26, "#8a5a30"); R(c, 205, 74, 7, 5, "#b8bec2");
  R(c, 202, 108, 14, 12, "#d0c8a8"); R(c, 202, 108, 14, 2, "#f0ead0"); stencil(c, "O2", 205, 112, "#2a6a3a");
  for (let y = 150; y < 174; y += 4) R(c, 196, y, 26, 2, "#e0b830");                    // sọc cảnh báo chân vách

  // ================= VÁCH KHOANG CHÍNH (222..1046): cách nhiệt chần ô
  R(c, 222, 35, CW - 222 + M, 115, "#525b3c");
  for (let y = 35; y < 150; y += 14) for (let x = 222; x < CW + M; x += 12) {
    R(c, x, y, 12, 1, "#3e4630"); R(c, x, y + 1, 11, 1, "#626c48"); R(c, x + 11, y, 1, 14, "#434b33"); R(c, x + 11, y + 13, 1, 1, "#353c27");
  }
  for (let i = 0; i < 160; i++) { const x = 222 + ((i * 97) % (CW - 222)), y = 40 + ((i * 53) % 104); R(c, x, y, 2 + (i % 3), 1, i % 2 ? "#4a5236" : "#5c6644"); }
  for (const x of RIBS) {
    R(c, x - 3, 33, 6, 119, "#2f3524"); R(c, x - 3, 33, 1, 119, "#5f684f"); R(c, x + 2, 33, 1, 119, "#1d2117");
    for (let y = 40; y < 148; y += 10) R(c, x - 1, y, 2, 1, "#7a8466");
  }
  for (const [x, y, r] of PORTHOLES) {
    c.fillStyle = "#1b1f16"; c.beginPath(); c.arc(x, y, r + 4, 0, TAU); c.fill();
    c.fillStyle = "#7d866b"; c.beginPath(); c.arc(x, y, r + 3, 0, TAU); c.fill();
    c.fillStyle = "#3d4433"; c.beginPath(); c.arc(x, y, r + 2, 0, TAU); c.fill();
    c.fillStyle = "#a3ab8f"; c.beginPath(); c.arc(x - 1, y - 1, r + 2, Math.PI * 1.05, Math.PI * 1.55); c.lineTo(x - 1, y - 1); c.fill();
    for (let k = 0; k < 8; k++) { const a = (k / 8) * TAU; R(c, Math.round(x + Math.cos(a) * (r + 3)), Math.round(y + Math.sin(a) * (r + 3)), 1, 1, "#c4cbb0"); }
  }
  // ---- KHU TỔ LÁI: bàn bộ đàm
  R(c, 230, 92, 70, 58, "#1e2219"); R(c, 230, 92, 70, 1, "#4b5240");
  R(c, 234, 96, 62, 24, "#2b2f2a"); R(c, 266, 100, 28, 18, "#071208");                  // khung máy hiện sóng
  for (let x = 238; x < 262; x += 6) { c.fillStyle = "#14161a"; c.beginPath(); c.arc(x + 2, 108, 2.5, 0, TAU); c.fill(); R(c, x + 2, 106, 1, 2, "#c8ccce"); }
  R(c, 234, 124, 62, 22, "#30352d");
  for (let x = 238; x < 292; x += 9) { R(c, x, 128, 6, 4, "#1a1c18"); R(c, x, 136, 6, 6, "#40463c"); R(c, x + 1, 137, 4, 1, "#7a8466"); }
  R(c, 226, 148, 78, 4, "#5a4a36"); R(c, 226, 148, 78, 1, "#8a7254"); R(c, 226, 152, 78, 22, "#2a2620");   // mặt bàn + tủ
  R(c, 230, 156, 70, 1, "#3a342b"); R(c, 262, 160, 6, 2, "#9aa0a6");
  R(c, 240, 142, 10, 6, "#151714"); R(c, 242, 140, 6, 2, "#151714");                       // ống nghe
  // mũ + áo giáp treo móc
  for (const [hx, col] of [[312, "#4a5638"], [330, "#3e4a32"], [348, "#4a5638"]]) {
    R(c, hx, 98, 2, 4, "#9aa0a6");
    c.fillStyle = col; c.beginPath(); c.arc(hx + 1, 108, 6, Math.PI, 0); c.fill(); R(c, hx - 5, 108, 13, 2, "#2a3022"); R(c, hx - 1, 103, 3, 1, "#6a7a54");
  }
  R(c, 360, 100, 1, 4, "#9aa0a6"); R(c, 354, 104, 14, 22, "#2e3526"); R(c, 356, 106, 4, 6, "#454e38"); R(c, 362, 106, 4, 6, "#454e38"); R(c, 356, 116, 10, 4, "#3a4230");
  // khung màn hình nhiệm vụ (chữ vẽ động)
  R(c, 384, 48, 48, 36, "#0c0e0b"); R(c, 384, 48, 48, 1, "#4b5240"); R(c, 406, 84, 4, 6, "#2a2e22");
  R(c, 470, 96, 48, 9, "#c9a531"); R(c, 471, 97, 46, 7, "#1d1d1a"); stencil(c, "C-130", 476, 98, "#e7c94a");
  // ---- KHOANG HÀNG: giá súng
  const gx = 530;
  R(c, gx, 104, 114, 44, "#3a2a1c"); R(c, gx, 104, 114, 1, "#6a4c32"); R(c, gx, 147, 114, 1, "#1f160e");
  for (let x = gx + 2; x < gx + 114; x += 6) R(c, x, 105, 1, 42, "#33251a");
  for (const y of [116, 130, 144]) { R(c, gx + 2, y, 110, 2, "#24190f"); for (const px of [10, 52, 94]) { R(c, gx + px, y - 3, 2, 4, "#9aa0a6"); R(c, gx + px, y - 3, 2, 1, "#d8dde2"); } }
  drawGunIcon(c, "rifle", gx + 6, 103, 52, 14, 1);
  drawGunIcon(c, "sniper", gx + 6, 117, 104, 14, 1);
  drawGunIcon(c, "carbine", gx + 56, 103, 52, 14, 1);
  drawGunIcon(c, "shotgun", gx + 6, 131, 60, 14, 1);
  drawGunIcon(c, "smg", gx + 66, 131, 44, 14, 1);
  R(c, gx + 30, 92, 54, 9, "#c9a531"); R(c, gx + 31, 93, 52, 7, "#1d1d1a"); stencil(c, "ARMORY", gx + 45, 94, "#e7c94a");
  // bình cứu hỏa
  R(c, 656, 112, 8, 22, "#b3261e"); R(c, 656, 112, 2, 22, "#e24a3c"); R(c, 657, 108, 6, 4, "#2a2a2a"); R(c, 663, 109, 4, 2, "#2a2a2a");
  R(c, 655, 133, 10, 2, "#6a6f73"); R(c, 657, 118, 6, 3, "#efe6c8");
  for (const hx of [700, 722, 744]) { R(c, hx - 1, 97, 3, 3, "#9aa0a6"); R(c, hx - 1, 97, 3, 1, "#d8dde2"); }   // móc treo dù
  // lưới hàng căng trên vách + hàng phía sau
  R(c, 792, 112, 30, 36, "#4f5a2c"); R(c, 822, 120, 34, 28, "#5a4a30"); R(c, 800, 100, 40, 14, "#3e4a2a");
  c.strokeStyle = "rgba(20,20,14,0.9)"; c.lineWidth = 1;
  for (let k = -60; k < 80; k += 8) { c.beginPath(); c.moveTo(790 + k, 96); c.lineTo(790 + k + 56, 150); c.stroke(); c.beginPath(); c.moveTo(866 - k, 96); c.lineTo(866 - k - 56, 150); c.stroke(); }
  R(c, 788, 94, 82, 2, "#c9a531"); R(c, 788, 148, 82, 2, "#c9a531");
  // bình dưỡng khí xanh + hộp sơ cứu
  for (const bx of [900, 912]) { R(c, bx, 102, 9, 44, "#2f6a3a"); R(c, bx, 102, 3, 44, "#4a9a58"); R(c, bx + 2, 98, 5, 4, "#6c7276"); R(c, bx - 1, 120, 11, 2, "#1d1d1a"); }
  R(c, 928, 104, 22, 16, "#cfd3d6"); R(c, 928, 104, 22, 2, "#f2f4f5"); R(c, 937, 107, 4, 10, "#d8322a"); R(c, 934, 110, 10, 4, "#d8322a");
  R(c, 940, 92, 34, 9, "#c9a531"); R(c, 941, 93, 32, 7, "#1d1d1a"); stencil(c, "EXIT", 948, 95, "#e7c94a");

  // ================= GHẾ LƯỚI ĐỎ DỌC VÁCH (300..1000)
  const b0 = 300, b1 = 1000;
  R(c, b0, 150, b1 - b0, 2, "#9aa0a6"); R(c, b0, 150, b1 - b0, 1, "#d6dbe0");
  R(c, b0, 152, b1 - b0, 18, "#8a2f27");
  for (let y = 152; y < 170; y += 3) for (let x = b0 + ((y / 3) % 2) * 2; x < b1; x += 4) R(c, x, y, 2, 1, "#6a221c");
  for (let x = b0; x < b1; x += 30) R(c, x, 152, 1, 18, "#5a1c17");
  R(c, b0, 170, b1 - b0, 3, "#9aa0a6"); R(c, b0, 170, b1 - b0, 1, "#d6dbe0"); R(c, b0, 172, b1 - b0, 1, "#4a4f53");
  for (let x = b0 + 6; x < b1; x += 30) { R(c, x, 173, 2, 10, "#7a8085"); R(c, x, 173, 1, 10, "#b6bcc1"); }
  // ================= SÀN
  R(c, L, 174, FW, H - 174 + M, "#3b3f41"); R(c, L, 174, FW, 3, "#2a2d2f");
  // buồng lái: thảm cao su
  R(c, L, 177, 200 + M, H - 177 + M, "#2a2d2a");
  for (let y = 180; y < H; y += 4) for (let x = ((y / 4) % 2) * 4; x < 196; x += 8) R(c, x, y, 4, 1, "#323632");
  // khu tổ lái + khoang hàng: tấm thép
  for (let y = 180; y < H + M; y += 22) {
    R(c, 196, y, CW - 196 + M, 1, "#2a2d2f"); R(c, 196, y + 1, CW - 196 + M, 1, "#4b5053");
    for (let x = 196 + ((y / 22) % 2) * 24; x < CW + M; x += 48) R(c, x, y + 1, 1, 21, "#2c2f31");
  }
  for (let y = 184; y < H + M; y += 5) for (let x = 196 + ((y / 5) % 2) * 3; x < CW; x += 6) R(c, x, y, 1, 1, "#45494c");
  for (const y of [190, 258]) for (let x = 204; x < 520; x += 10) R(c, x, y, 6, 1, "#a88a2c");   // vạch lối đi vàng
  for (const y of [204, 246]) {                                                                // ray con lăn khoang hàng
    R(c, 520, y, CW - 520 + M, 5, "#2a2d30"); R(c, 520, y, CW - 520 + M, 1, "#6c7276");
    for (let x = 520; x < CW + M; x += 8) { R(c, x + 2, y + 1, 4, 3, "#7d8387"); R(c, x + 2, y + 1, 4, 1, "#b0b6ba"); }
  }
  for (let x = 540; x < CW; x += 60) { c.strokeStyle = "#8a8f93"; c.lineWidth = 1; c.beginPath(); c.arc(x + 0.5, 226.5, 2.5, 0, TAU); c.stroke(); }
  // ================= ĐUÔI: CỬA NHẢY + DỐC SAU THỦY LỰC
  R(c, DOOR.x0 - 6, DOOR.y0 - 6, DOOR.x1 - DOOR.x0 + 12, DOOR.y1 - DOOR.y0 + 8, "#1b1f16");
  for (let y = DOOR.y0 - 5; y < DOOR.y1 + 1; y += 4) { R(c, DOOR.x0 - 5, y, 4, 2, "#e0b830"); R(c, DOOR.x1 + 1, y + 2, 4, 2, "#e0b830"); }
  for (let x = DOOR.x0 - 5; x < DOOR.x1 + 5; x += 4) R(c, x, DOOR.y0 - 5, 2, 3, "#e0b830");
  R(c, DOOR.x0 - 2, DOOR.y1, DOOR.x1 - DOOR.x0 + 4, 3, "#6c7276");
  stencil(c, "JUMP", DOOR.x0 - 1, DOOR.y0 - 13, "#e7c94a");
  c.fillStyle = "#2c3226"; c.beginPath(); c.moveTo(1046, 35); c.lineTo(CW + M, 35); c.lineTo(CW + M, 262); c.lineTo(1046, 262); c.closePath(); c.fill();
  c.fillStyle = "#3d4433"; c.beginPath(); c.moveTo(1050, 262); c.lineTo(1112, 60); c.lineTo(CW + M, 60); c.lineTo(CW + M, 262); c.closePath(); c.fill();   // mặt dốc (đã đóng)
  for (let k = 0; k < 9; k++) { const y = 80 + k * 20, x = 1050 + (262 - y) * (62 / 202); R(c, Math.round(x), y, CW + M - Math.round(x), 1, "#2a3022"); }
  for (let k = 0; k < 6; k++) R(c, 1066 + k * 8, 236 - k * 26, 6, 3, "#e0b830");
  c.strokeStyle = "#8a8f93"; c.lineWidth = 3; c.beginPath(); c.moveTo(1052, 120); c.lineTo(1094, 190); c.stroke();      // ty thủy lực
  c.strokeStyle = "#c8ccce"; c.lineWidth = 1; c.beginPath(); c.moveTo(1052, 119); c.lineTo(1080, 166); c.stroke();
  stencil(c, "RAMP", 1076, 140, "#e7c94a");
  R(c, 1044, 35, 4, 227, "#14170f");
  // ================= KHOÉT TRONG SUỐT: cửa sổ, kính buồng lái, cửa nhảy (trời vẽ phía sau)
  c.save(); c.globalCompositeOperation = "destination-out";
  for (const [x, y, r] of PORTHOLES) { c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); }
  for (const poly of COCKPIT_GLASS) { c.beginPath(); poly.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.fill(); }
  c.fillRect(DOOR.x0, DOOR.y0, DOOR.x1 - DOOR.x0, DOOR.y1 - DOOR.y0);
  c.restore();
  return cv;
}

/** Vẽ 1 đồ vật tĩnh vào canvas riêng (bbox trong tọa độ khoang) */
function propCanvas(x0, y0, x1, y1, fn) {
  const cv = document.createElement("canvas");
  cv.width = x1 - x0; cv.height = y1 - y0;
  const c = cv.getContext("2d"); c.translate(-x0, -y0); fn(c);
  return { x: x0, y: y0, cv };
}
function paintProps() {
  return {
    crates: propCanvas(580, 168, 718, 232, (c) => {
      c.fillStyle = "rgba(0,0,0,0.35)"; c.fillRect(596, 224, 118, 5);
      crate(c, 610, 202, 46, 26, "5.56"); crate(c, 658, 202, 46, 26, "7.62"); crate(c, 632, 177, 46, 25, "AMMO");
      ammoCan(c, 594, 216); ammoCan(c, 586, 204); medBox(c, 682, 182);
      R(c, 622, 177, 2, 51, "#c9a531"); R(c, 690, 177, 2, 51, "#c9a531"); R(c, 609, 214, 96, 2, "#a88a2c");
      R(c, 614, 226, 4, 2, "#8a8f93"); R(c, 696, 226, 4, 2, "#8a8f93");
    }),
    drums: propCanvas(786, 178, 836, 208, (c) => {
      c.fillStyle = "rgba(0,0,0,0.35)"; c.fillRect(788, 202, 44, 4);
      for (const [x, col] of [[790, "#8a2a20"], [811, "#4f5a2c"]]) {
        R(c, x, 182, 20, 22, col); R(c, x, 182, 3, 22, "rgba(255,255,255,0.18)"); R(c, x + 17, 182, 3, 22, "rgba(0,0,0,0.3)");
        R(c, x, 180, 20, 3, "#2a2a2a"); R(c, x, 188, 20, 1, "#1d1d1a"); R(c, x, 197, 20, 1, "#1d1d1a"); R(c, x + 3, 180, 4, 1, "#6c7276");
        R(c, x + 7, 191, 6, 4, "#e0b830"); R(c, x + 9, 192, 2, 2, "#1d1d1a");
      }
    }),
    cans: propCanvas(874, 222, 910, 246, (c) => {
      c.fillStyle = "rgba(0,0,0,0.35)"; c.fillRect(876, 240, 32, 4);
      ammoCan(c, 878, 230); ammoCan(c, 890, 222); R(c, 876, 238, 30, 2, "#2e3520");
    }),
    table: propCanvas(344, 186, 430, 222, (c) => {
      c.fillStyle = "rgba(0,0,0,0.4)"; c.fillRect(348, 214, 80, 6);
      R(c, 352, 206, 3, 13, "#2a2620"); R(c, 420, 206, 3, 13, "#2a2620"); R(c, 360, 206, 2, 10, "#221e19"); R(c, 412, 206, 2, 10, "#221e19");
      R(c, 348, 196, 78, 10, "#5a4a36"); R(c, 348, 196, 78, 1, "#8a7254"); R(c, 348, 205, 78, 2, "#3a2f22");
      R(c, 354, 197, 62, 8, "#c9b98a"); R(c, 354, 197, 62, 1, "#e6d8ac");                       // bản đồ giấy
      for (const [x, y, w] of [[358, 199, 20], [376, 201, 26], [362, 203, 30]]) R(c, x, y, w, 1, "#8a7a5a");
      R(c, 392, 198, 1, 6, "#5a8a5a"); R(c, 370, 198, 8, 1, "#5a8a5a");
      R(c, 366, 200, 3, 3, "#e0b830"); R(c, 398, 199, 3, 3, "#d8322a"); R(c, 382, 202, 2, 2, "#e0b830");
      R(c, 384, 201, 5, 3, "#6a4a2a");                                                            // vết cà phê
      R(c, 412, 190, 6, 7, "#d8d0c0"); R(c, 418, 192, 2, 3, "#d8d0c0"); R(c, 413, 191, 4, 1, "#3a2414");   // cốc cà phê
      R(c, 356, 194, 10, 3, "#2a2a2a"); R(c, 357, 193, 3, 1, "#9aa0a6");                                   // ống nhòm
    }),
    pedestal: propCanvas(96, 166, 124, 202, (c) => {
      R(c, 100, 176, 20, 24, "#1c201b"); R(c, 100, 176, 20, 1, "#40473d"); R(c, 100, 199, 20, 1, "#0b0c0a");
      for (const [x, col] of [[103, "#d8322a"], [108, "#2a2a2a"], [113, "#2a2a2a"], [117, "#3a6a9a"]]) { R(c, x, 168, 2, 9, "#8a8f93"); R(c, x - 1, 166, 4, 3, col); }
      for (let y = 182; y < 196; y += 5) R(c, 103, y, 14, 2, "#2c3134");
    }),
  };
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

// ------------------------------------------------------------------ NGƯỜI TRONG KHOANG (pixel, vẽ theo khung hình)
const SOLDIER = { helmet: "#3e4a32", helmetHi: "#5a6a48", skin: "#d9a77a", suit: "#4a5638", vest: "#2e3526", boot: "#1a1a1a", glove: "#2a2a2a" };
/** Lính đứng (chân tại x,y) — point: giơ tay chỉ ra cửa · shout: há miệng */
function drawSoldierStand(c, x, y, t, point, shout) {
  const S = SOLDIER, b = Math.round(Math.sin(t * 2) * 0.5);
  c.fillStyle = "rgba(0,0,0,0.35)"; c.beginPath(); c.ellipse(x, y, 7, 2, 0, 0, TAU); c.fill();
  R(c, x - 3, y - 7, 2, 6, S.suit); R(c, x + 1, y - 7, 2, 6, S.suit); R(c, x - 4, y - 2, 3, 2, S.boot); R(c, x + 1, y - 2, 3, 2, S.boot);
  R(c, x - 4, y - 16 + b, 8, 9, S.suit); R(c, x - 4, y - 15 + b, 8, 6, S.vest); R(c, x - 3, y - 13 + b, 2, 2, "#5c5638"); R(c, x + 1, y - 13 + b, 2, 2, "#5c5638");
  R(c, x - 6, y - 15 + b, 2, 7, S.suit); R(c, x - 6, y - 9 + b, 2, 2, S.glove);
  if (point) { const k = Math.round(Math.sin(t * 9) * 1); R(c, x + 4, y - 16 + b + k, 9, 2, S.suit); R(c, x + 12, y - 16 + b + k, 2, 2, S.glove); }
  else { R(c, x + 4, y - 15 + b, 2, 7, S.suit); R(c, x + 4, y - 9 + b, 2, 2, S.glove); }
  R(c, x - 4, y - 25 + b, 8, 8, S.skin); R(c, x - 5, y - 28 + b, 10, 5, S.helmet); R(c, x - 6, y - 24 + b, 12, 1, S.helmet); R(c, x - 4, y - 28 + b, 4, 1, S.helmetHi);
  R(c, x, y - 21 + b, 1, 1, "#1a1210"); R(c, x + 2, y - 21 + b, 1, 1, "#1a1210");
  if (shout) R(c, x + 1, y - 19 + b, 2, 2, "#3a1210"); else R(c, x + 1, y - 18 + b, 2, 1, "#8a5a40");
  R(c, x - 4, y - 22 + b, 1, 4, "#2a2a2a");   // quai mũ
}
/** Lính ngồi ngủ gật trên ghế lưới (mông tại x, y = mặt ghế) */
function drawSoldierSleep(c, x, y, t, woke) {
  const S = SOLDIER, nod = woke ? 0 : Math.round((Math.sin(t * 0.8) + 1) * 1);
  R(c, x - 4, y - 3, 10, 3, S.suit); R(c, x + 4, y - 3, 3, 9, S.suit); R(c, x + 3, y + 5, 5, 2, S.boot);
  R(c, x - 5, y - 13, 8, 10, S.suit); R(c, x - 5, y - 12, 8, 6, S.vest);
  R(c, x + 2, y - 10, 5, 2, S.suit); R(c, x + 5, y - 9, 2, 2, S.glove);
  const hx = x - 4 + (woke ? 0 : 1), hy = y - 21 + nod;
  R(c, hx, hy, 8, 8, S.skin); R(c, hx - 1, hy - 3 + (woke ? 0 : 2), 10, 5, S.helmet); R(c, hx - 2, hy + 1 + (woke ? 0 : 2), 12, 1, S.helmet);
  if (woke) { R(c, hx + 4, hy + 4, 1, 2, "#1a1210"); R(c, hx + 6, hy + 4, 1, 2, "#1a1210"); R(c, hx + 5, hy + 7, 2, 1, "#3a1210"); }
  else { R(c, hx + 4, hy + 5, 2, 1, "#1a1210"); R(c, hx + 6, hy + 5, 1, 1, "#1a1210"); R(c, hx + 5, hy + 7, 1, 1, "#b8d8ff"); }
}
/** Phi công ngồi ghế, nhìn về mũi máy bay (bên trái) — look: quay đầu ra sau */
function drawPilot(c, x, y, t, k, look) {
  R(c, x + 4, y - 40, 7, 38, "#2a2620"); R(c, x + 4, y - 40, 7, 1, "#4a4236"); R(c, x + 5, y - 36, 5, 10, "#3a332a");   // lưng ghế
  R(c, x - 8, y - 8, 18, 4, "#2a2620"); R(c, x - 2, y - 4, 4, 4, "#1a1814"); R(c, x - 6, y, 14, 2, "#3a3f42");      // mặt ghế, chân ghế
  R(c, x - 14, y - 10, 10, 3, "#5a5a3c"); R(c, x - 15, y - 8, 3, 6, "#5a5a3c"); R(c, x - 17, y - 3, 5, 2, "#1a1a1a");  // chân duỗi
  const bob = Math.round(Math.sin(t * 1.3 + k) * 0.6);
  R(c, x - 4, y - 22 + bob, 9, 14, "#5a5a3c"); R(c, x - 4, y - 22 + bob, 9, 2, "#6a6a4a"); R(c, x - 2, y - 18 + bob, 3, 3, "#c9a531");   // áo bay + phù hiệu
  R(c, x - 4, y - 18 + bob, 7, 2, "#2a2a22"); R(c, x - 10, y - 17 + bob, 7, 2, "#5a5a3c"); R(c, x - 12, y - 17 + bob, 2, 2, "#2a2a2a");   // dây đai, tay cầm cần lái
  R(c, x - 14, y - 22, 2, 14, "#3a3f42"); R(c, x - 17, y - 22, 6, 2, "#1a1a1a");                                    // cần lái
  const hx = x - 4, hy = y - 31 + bob;
  R(c, hx, hy, 8, 8, "#d9a77a"); R(c, hx - 1, hy - 2, 10, 6, "#6a6a5a"); R(c, hx - 1, hy - 2, 10, 1, "#8a8a72"); R(c, hx + 7, hy + 1, 2, 5, "#2a2a2a");
  if (look) { R(c, hx + 4, hy + 3, 3, 2, "#1a1a22"); R(c, hx + 6, hy + 3, 1, 1, "#4a6a9a"); R(c, hx + 3, hy + 6, 2, 1, "#8a5a40"); }
  else { R(c, hx - 1, hy + 2, 4, 3, "#1a1a22"); R(c, hx - 1, hy + 2, 1, 1, "#6a8aba"); R(c, hx - 3, hy + 5, 3, 1, "#2a2a2a"); }   // kính che + micro
}

// ------------------------------------------------------------------ MÂY (trôi qua cửa sổ, cùng 1 bầu trời cho mọi cửa sổ)
const SKY_SPAN = CW + 500;
function makeClouds() {
  const list = [];
  for (let i = 0; i < 40; i++) {
    const far = i % 3 === 0;
    list.push({ x: rand(-200, SKY_SPAN), y: rand(52, 96), r: far ? rand(3, 6) : rand(5, 11), sp: far ? rand(26, 40) : rand(70, 110), far, puffs: Math.floor(rand(3, 6)) });
  }
  return list;
}

// ------------------------------------------------------------------ TÌM ĐƯỜNG (lưới 6px trên sàn, A*)
const CELL = 6, GX = Math.ceil((FLOOR.x1 - FLOOR.x0) / CELL) + 1, GY = Math.ceil((FLOOR.y1 - FLOOR.y0) / CELL) + 1;
function blocked(x, y) {
  if (x < FLOOR.x0 || x > FLOOR.x1 || y < FLOOR.y0 || y > FLOOR.y1) return true;
  for (const p of Object.values(PROPS)) { const [x0, y0, x1, y1] = p.foot; if (x > x0 - 3 && x < x1 + 3 && y > y0 && y < y1) return true; }
  return false;
}
const GRID = (() => { const g = new Uint8Array(GX * GY); for (let j = 0; j < GY; j++) for (let i = 0; i < GX; i++) g[j * GX + i] = blocked(FLOOR.x0 + i * CELL, FLOOR.y0 + j * CELL) ? 1 : 0; return g; })();
const toCell = (x, y) => [clamp(Math.round((x - FLOOR.x0) / CELL), 0, GX - 1), clamp(Math.round((y - FLOOR.y0) / CELL), 0, GY - 1)];
function clearLine(ax, ay, bx, by) {
  const n = Math.ceil(Math.hypot(bx - ax, by - ay) / 3);
  for (let i = 1; i <= n; i++) if (blocked(ax + ((bx - ax) * i) / n, ay + ((by - ay) * i) / n)) return false;
  return true;
}
/** Đường đi (danh sách điểm) từ (ax,ay) tới (bx,by) vòng qua đồ vật; đích nằm trong đồ vật thì lấy ô trống gần nhất */
function findPath(ax, ay, bx, by) {
  if (clearLine(ax, ay, bx, by)) return [{ x: bx, y: by }];
  let [ti, tj] = toCell(bx, by);
  if (GRID[tj * GX + ti]) {
    let best = null, bd = 1e9;
    for (let j = 0; j < GY; j++) for (let i = 0; i < GX; i++) if (!GRID[j * GX + i]) { const d = (i - ti) ** 2 + (j - tj) ** 2; if (d < bd) { bd = d; best = [i, j]; } }
    [ti, tj] = best; bx = FLOOR.x0 + ti * CELL; by = FLOOR.y0 + tj * CELL;
  }
  const [si, sj] = toCell(ax, ay), N = GX * GY, goal = tj * GX + ti, start = sj * GX + si;
  const gs = new Float32Array(N).fill(1e9), from = new Int32Array(N).fill(-1), done = new Uint8Array(N), inOpen = new Uint8Array(N);
  const open = [start]; gs[start] = 0; inOpen[start] = 1;
  const hf = (id) => Math.hypot((id % GX) - ti, ((id / GX) | 0) - tj);
  while (open.length) {
    let bi = 0; for (let k = 1; k < open.length; k++) if (gs[open[k]] + hf(open[k]) < gs[open[bi]] + hf(open[bi])) bi = k;
    const cur = open.splice(bi, 1)[0]; inOpen[cur] = 0;
    if (cur === goal) break;
    done[cur] = 1;
    const ci = cur % GX, cj = (cur / GX) | 0;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue;
      const ni = ci + di, nj = cj + dj; if (ni < 0 || nj < 0 || ni >= GX || nj >= GY) continue;
      const id = nj * GX + ni; if (GRID[id] || done[id]) continue;
      if (di && dj && (GRID[cj * GX + ni] || GRID[nj * GX + ci])) continue;   // không cắt góc
      const g = gs[cur] + (di && dj ? 1.414 : 1);
      if (g < gs[id]) { gs[id] = g; from[id] = cur; if (!inOpen[id]) { open.push(id); inOpen[id] = 1; } }
    }
  }
  if (goal !== start && from[goal] < 0) return [];
  const pts = [];
  for (let id = goal; id >= 0 && id !== start; id = from[id]) pts.unshift({ x: FLOOR.x0 + (id % GX) * CELL, y: FLOOR.y0 + ((id / GX) | 0) * CELL });
  if (!pts.length) return [{ x: bx, y: by }];
  pts[pts.length - 1] = { x: bx, y: by };
  const out = []; let px = ax, py = ay;   // làm mượt: bỏ điểm giữa nếu nhìn thẳng được
  for (let i = 0; i < pts.length; i++) {
    const nxt = pts[i + 1];
    if (nxt && clearLine(px, py, nxt.x, nxt.y)) continue;
    out.push(pts[i]); px = pts[i].x; py = pts[i].y;
  }
  return out;
}

export class Cabin {
  constructor() {
    this.bg = null;            // nền tĩnh (vẽ khi vào khoang lần đầu — lúc đó ảnh súng đã tải xong)
    this.props = null;
    this.light = new LightLayer(W, H);
    this.vignette = makeVignette(W, H, 0.5);
    this.cam = { x: 0, y: 0, rx: 0, ry: 0, w: W, h: H, inView: () => true };
    this.clouds = makeClouds();
    this.dust = Array.from({ length: 34 }, () => ({ x: rand(0, W), y: rand(30, 260), vx: rand(-4, 4), vy: rand(-3, 3), a: rand(0.15, 0.5) }));
    this.fallClouds = Array.from({ length: 22 }, () => ({ x: rand(-40, W + 40), y: rand(-40, H + 80), r: rand(10, 34), sp: rand(260, 520), a: rand(0.5, 0.95) }));
    this.skyline = makeSkyline();
    this.ash = Array.from({ length: 46 }, (_, i) => ({ x: rand(0, W), y: rand(0, H), v: rand(10, 26), d: rand(-14, -4), s: i % 5 ? 1 : 2, a: rand(0.3, 0.7) }));
    this.audio = new CabinAudio();
    this.panel = false;        // bảng trang bị HTML đang mở (che nửa phải) -> camera đẩy nhân vật sang trái
    this.reset();
  }

  reset() {
    this.t = 0; this.eta = CABIN_ETA;
    this.burstT = 0; this.nextBurst = rand(...SHAKE.gap) * 0.5;
    this.sx = 0; this.sy = 0; this.swing = 0; this.swingV = 0;
    this.engineT = 0; this.whiteout = 0;
    this.hx = HERO.x; this.hy = HERO.y; this.vx = 0; this.vy = 0; this.flip = true; this.moving = false; this.running = false;
    this.path = []; this.goal = null;
    this.camX = clamp(this.hx - W / 2, 0, CW - W);
    this.near = null; this.door = 0; this.seq = null; this.wind = [];
    this.say = null; this.peek = 0; this.peeking = false; this.wakeT = 0; this.lookT = 0; this.masterShout = 0;
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
    if (!this.bg) { this.bg = paintStatic(); this.props = paintProps(); }
    if (boarding) this.seq = { kind: "board", t: 0 };
  }
  /** Bắt đầu cảnh NHẢY: mở cửa, chạy (tự tìm đường) ra cửa, nhảy, rơi tự do qua mây */
  startJump(hero) {
    if (hero) this.hero = hero;
    if (!this.bg) { this.bg = paintStatic(); this.props = paintProps(); }
    this.goal = null; this.peeking = false; this.peek = 0; this.say = null;
    const path = findPath(this.hx, this.hy, DOOR.x0 - 2, 228);
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
   * Trả về sự kiện cho main.js: "gear" (mở trang bị) | "door" (ra cửa nhảy) | "boarded" | "jumped" | null
   */
  update(dt, sound, input = null, canWalk = true) {
    this.t += dt;
    const wasReady = this.ready;
    this.eta = Math.max(0, this.eta - dt);
    let ev = null;
    if (this.seq) ev = this.updateSeq(dt, sound);
    if (this.burstT > 0) this.burstT -= dt;
    else if ((this.nextBurst -= dt) <= 0 && this.seq?.kind !== "board") {
      this.burstT = rand(...SHAKE.burstDur); this.nextBurst = rand(...SHAKE.gap);
      this.swingV += rand(-1.6, 1.6);
      this.audio.rattle(sound, 0.6);
    }
    const amp = this.burstT > 0 ? SHAKE.burst * Math.min(1, this.burstT * 2) : SHAKE.calm;
    this.sx = Math.round(Math.sin(this.t * 23) * amp * 0.5 + (this.burstT > 0 ? rand(-1, 1) * amp * 0.5 : 0));
    this.sy = Math.round(Math.sin(this.t * 17.3) * amp + Math.sin(this.t * 41) * amp * 0.35);
    this.swingV += (-this.swing * 9 - this.swingV * 1.6) * dt + Math.sin(this.t * 1.7) * 0.25 * dt;
    if (this.burstT > 0) this.swingV += rand(-6, 6) * dt;
    if (this.door > 0) this.swingV += (-4 * this.door + rand(-3, 3)) * dt;
    this.swing += this.swingV * dt;
    for (const cl of this.clouds) { cl.x += cl.sp * dt; if (cl.x > SKY_SPAN) { cl.x -= SKY_SPAN + 200; cl.y = rand(52, 96); } }   // máy bay bay về phía mũi (trái) -> mây trôi sang phải
    this.whiteout = Math.max(0, this.whiteout - dt * 0.6);
    if (Math.random() < dt * 0.05) this.whiteout = 1;
    for (const d of this.dust) {
      d.x += (d.vx + this.sx * 6 - this.door * 120) * dt; d.y += (d.vy + Math.sin(this.t + d.x) * 2) * dt;
      if (d.x < 0) d.x += W; if (d.x > W) d.x -= W; if (d.y < 30) d.y = 260; if (d.y > 262) d.y = 32;
    }
    this.tickSky(dt, sound, !this.seq);
    if (this.ready && !this.greenHorn) { this.greenHorn = true; this.audio.horn(sound, 2); }
    if (this.ready && !wasReady && !this.seq) { this.masterShout = 3; this.talk("master", pick(LINES.masterGo), sound); }   // chỉ huy nhảy hô
    this.masterShout = Math.max(0, this.masterShout - dt);
    if (this.say && (this.say.t -= dt) <= 0) this.say = null;
    this.wakeT = Math.max(0, this.wakeT - dt); this.lookT = Math.max(0, this.lookT - dt);
    this.peek = clamp(this.peek + (this.peeking ? dt : -dt) * 3, 0, 1);
    this.audio.update(sound, this.mix());
    if (!this.seq) ev = this.updateWalk(dt, input, canWalk, sound) ?? ev;
    // camera trượt theo (nhìn trước theo hướng đi; bảng trang bị mở thì giữ nhân vật ở nửa trái)
    const look = (this.flip ? -40 : 40) * (this.moving ? 1 : 0.4);
    const want = clamp(this.hx - W * (this.panel && !this.seq ? 0.28 : 0.5) + look, 0, CW - W);
    this.camX += (want - this.camX) * Math.min(1, dt * (this.seq ? 6 : 3.5));
    if (this.hero?.anim) { this.hero.anim.set(this.moving ? "run" : "idle"); this.hero.anim.update(dt, this.running ? 1.5 : 1); }
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
    for (const p of this.flak) { p.x += 95 * dt; p.r += 7 * dt; p.a -= dt * 0.22; }
    this.flak = this.flak.filter((p) => p.a > 0);
    if (!random) return;
    if ((this.nextBolt -= dt) <= 0) { this.nextBolt = rand(...SKY_EVENTS.bolt); this.lightning(sound, rand(this.camX - 100, this.camX + W + 100)); }
    if ((this.nextBoom -= dt) <= 0) { this.nextBoom = rand(...SKY_EVENTS.boom); this.explode(sound, Math.random() < SKY_EVENTS.nearChance); }
  }
  after(t, fn) { this.timers.push({ t, fn }); }
  /** TIA CHỚP: lóe 2 lần + sấm đến sau. x = tọa độ trong khoang (cảnh cắt: tọa độ màn hình) */
  lightning(sound, x = rand(0, W)) {
    this.fx.bolt = 1; this.fx.boltX = x;
    this.after(0.13, () => { this.fx.bolt = Math.max(this.fx.bolt, 0.75); });
    this.audio.thunder(sound, rand(0.5, 1.5));
  }
  /** PHÁO PHÒNG KHÔNG nổ ngoài cửa sổ: near = sát thân máy bay (rung mạnh, đèn chớp, mảnh văng) */
  explode(sound, near = false, x = rand(this.camX - 60, this.camX + W + 60)) {
    this.fx.boom = near ? 1 : rand(0.45, 0.7); this.fx.boomX = x;
    this.flak.push({ x: x - 200, y: rand(58, 88), r: near ? 4 : 2, a: 1 });   // đám khói đen trôi qua các cửa sổ
    if (near) {
      this.burstT = Math.max(this.burstT, 1.2); this.nextBurst = Math.max(this.nextBurst, 3); this.swingV += rand(-3, 3);
      this.audio.boom(sound, rand(0.75, 1), 0.03);
    } else this.audio.boom(sound, rand(0.08, 0.4), rand(0.25, 0.8));
  }
  /** Mức âm thanh theo cảnh: động cơ, gió, còi... (xem CabinAudio.update) */
  mix() {
    const q = this.seq, burst = this.burstT > 0 ? Math.min(1, this.burstT) : 0;
    if (q?.kind === "board") {
      const t = q.t, spool = clamp((t - 2.2) / 1.8, 0, 1);
      return { level: 1, engine: 0.32 + spool * 0.5, pitch: 0.55 + spool * 0.5, wind: 0.22 + spool * 0.25, gust: 0.8, hiss: 0.05, siren: t < 3 ? 1 : clamp(1 - (t - 3) / 1.2, 0.12, 1) };
    }
    if (q?.kind === "jump" && q.fallT) {
      const k = clamp((q.t - q.fallT) / 0.9, 0, 1);
      return { level: 1, engine: 0.85 * (1 - k), pitch: 1 - k * 0.18, wind: 1, gust: 1, hiss: 1, siren: 0 };
    }
    const d = this.door, cock = clamp(1 - this.hx / 260, 0, 1), pk = this.peek;   // gần buồng lái / nhìn cửa sổ: động cơ to hơn
    return { level: 1, engine: 0.6 + burst * 0.22 + d * 0.25 + cock * 0.15 + pk * 0.2, pitch: 1 + Math.sin(this.t * 0.4) * 0.015 + burst * 0.03, wind: 0.3 + burst * 0.3 + d * 0.6 + pk * 0.3, gust: 0.5 + burst * 0.5, hiss: 0.03 + d * 0.9, siren: 0 };
  }

  /** Câu thoại hiện trên đầu người nói (who = id điểm tương tác) */
  talk(who, text, sound) {
    const pos = { pilot: [100, 150], radio: [262, 96], map: [388, 186], sleeper: [470, 140], master: [950, 166] }[who] ?? [this.hx, this.hy - 40];
    this.say = { x: pos[0], y: pos[1], text: text.replace("{eta}", String(Math.ceil(this.eta))), t: 3.2 + text.length * 0.035 };
    sound?.play?.("uiSelect", 0.25);
  }
  /** Tương tác tại chỗ (không cần main.js) */
  interact(id, sound) {
    if (id === "pilot") { this.lookT = 2.5; this.talk("pilot", pick(this.ready ? LINES.pilotGo : LINES.pilot), sound); }
    else if (id === "radio") { this.audio.radio(sound); this.talk("radio", pick(LINES.radio), sound); }
    else if (id === "map") this.talk("map", pick(LINES.map), sound);
    else if (id === "sleeper") { this.wakeT = 2.6; this.talk("sleeper", pick(LINES.sleeper), sound); }
    else if (id === "master") { this.masterShout = 1.2; this.talk("master", pick(this.ready ? LINES.masterGo : LINES.master), sound); }
    else if (id === "window") { this.peeking = true; this.say = null; sound?.play?.("uiSelect", 0.3); }
  }

  /** Đi lại TỰ DO: WASD / mũi tên / cần ảo (Shift chạy, tăng tốc mượt) · bấm/chạm sàn = tìm đường · E = tương tác */
  updateWalk(dt, input, canWalk, sound) {
    let dx = 0, dy = 0, ev = null, wantRun = false;
    const wasPeeking = this.peeking;   // bấm E để THÔI nhìn cửa sổ thì không được mở lại ngay trong cùng khung hình
    if (input && canWalk) {
      const k = input.keys;
      if (k.has("w") || k.has("arrowup")) dy -= 1;
      if (k.has("s") || k.has("arrowdown")) dy += 1;
      if (k.has("a") || k.has("arrowleft")) dx -= 1;
      if (k.has("d") || k.has("arrowright")) dx += 1;
      dx += input.joy?.x ?? 0; dy += input.joy?.y ?? 0;
      wantRun = k.has("shift") || Math.hypot(input.joy?.x ?? 0, input.joy?.y ?? 0) > 0.92;
      if (this.peeking) {   // đang nhìn ra cửa sổ: đi / E / click = thôi nhìn
        if (dx || dy || input.pressed.has("e") || input.pressed.has("mouse0") || input.pressed.has(" ")) this.peeking = false;
        dx = dy = 0;
      } else {
        if (dx || dy) { this.path = []; this.goal = null; }
        if (input.pressed.has("mouse0")) {
          const mx = input.mouse.x + this.camX - this.sx, my = input.mouse.y - this.sy;
          const hit = Object.entries(CABIN_SPOTS).find(([, s]) => Math.hypot(mx - s.x, my - (s.y - 16)) < s.r + 10);
          const tx = hit ? hit[1].x : mx, ty = hit ? hit[1].y : clamp(my, FLOOR.y0, FLOOR.y1);
          if (hit && this.near === hit[0]) ev = hit[0];            // đang đứng cạnh: dùng luôn
          else { this.path = findPath(this.hx, this.hy, tx, ty); this.goal = hit ? hit[0] : null; this.pathRun = Math.hypot(tx - this.hx, ty - this.hy) > 150; }
        }
        if (this.path.length) {
          const wp = this.path[0], tx = wp.x - this.hx, ty = wp.y - this.hy, d = Math.hypot(tx, ty);
          if (d < 3) { this.path.shift(); if (!this.path.length && this.goal) { ev = this.goal; this.goal = null; } }
          else { dx = tx / d; dy = ty / d; wantRun ||= this.pathRun; }
        }
      }
    }
    this.running = wantRun;
    const len = Math.hypot(dx, dy);
    if (len > 1) { dx /= len; dy /= len; }
    const sp = wantRun ? RUN : WALK, acc = Math.min(1, dt * (len > 0.1 ? 12 : 16));
    this.vx += (dx * sp - this.vx) * acc; this.vy += (dy * sp * 0.8 - this.vy) * acc;   // lên/xuống chậm hơn (phối cảnh)
    const bx = this.hx, by = this.hy;
    this.moveTo(this.hx + this.vx * dt, this.hy);
    this.moveTo(this.hx, this.hy + this.vy * dt);
    if (Math.abs(this.vx) > 8) this.flip = this.vx < 0;
    const moved = Math.hypot(this.hx - bx, this.hy - by);
    if (this.path.length && len > 0.1 && moved < WALK * dt * 0.1 && Math.hypot(this.vx, this.vy) > WALK * 0.5) { this.path = []; this.goal = null; }   // kẹt: thôi đi
    this.moving = moved > WALK * dt * 0.3;
    this.near = null; let nd = 1e9;   // đứng gần điểm nào? (gần nhất)
    for (const [id, s] of Object.entries(CABIN_SPOTS)) { const d = Math.hypot(this.hx - s.x, this.hy - s.y); if (d < s.r && d < nd) { nd = d; this.near = id; } }
    if (input && canWalk && !wasPeeking && this.near && input.pressed.has("e")) ev = this.near;
    if (ev && ev !== "gear" && ev !== "door") { this.interact(ev, sound); ev = null; }
    return ev;
  }
  moveTo(x, y) {
    if (blocked(x, y) && !blocked(this.hx, this.hy)) { if (this.path.length) this.vx *= 0.5; return; }   // đang kẹt sẵn trong đồ vật thì cho đi ra
    x = clamp(x, FLOOR.x0, FLOOR.x1); y = clamp(y, FLOOR.y0, FLOOR.y1);
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
      if (q.t >= CUTSCENE.board) { this.seq = null; this.fx.boom = 0; this.fx.bolt = 0; return "boarded"; }
      return null;
    }
    // ---- NHẢY: cửa trượt lên, gió lùa, chạy ra cửa, nhảy, rơi tự do
    if (q.t > 9 && !q.jumped) { q.jumped = true; q.jt = q.t; }   // an toàn: kẹt đường thì vẫn nhảy
    if (q.t < this.jumpEnd) {
      this.door = Math.min(1, q.t / 0.45);
      if (!q.opened) { q.opened = true; this.audio.horn(sound, 2); this.audio.rattle(sound, 0.8); this.masterShout = 3; }
      if (q.t > 0.3 && !q.jumped) {
        const wp = q.path[0], ddx = wp.x - this.hx, ddy = wp.y - this.hy, d = Math.hypot(ddx, ddy);
        if (d > 3) { const sp = 240 * dt; this.hx += (ddx / d) * Math.min(sp, d); this.hy += (ddy / d) * Math.min(sp, d); if (Math.abs(ddx) > 1) this.flip = ddx < 0; this.moving = true; this.running = true; }
        else if (q.path.length > 1) q.path.shift();
        else { q.jumped = true; q.jt = q.t; this.moving = false; this.flip = false; sound?.play("skillDash", 0.6); }
      }
      if (q.jumped) { const k = q.t - q.jt; this.hx += 160 * dt; this.hy += (-90 + 420 * k) * dt; }
      if (this.door > 0.3 && this.wind.length < 40) this.wind.push({ x: DOOR.x0 + rand(0, 20), y: rand(DOOR.y0, DOOR.y1), v: rand(260, 420), l: rand(8, 22) });
      for (const w of this.wind) w.x -= w.v * dt;
      this.wind = this.wind.filter((w) => w.x > this.camX - 20);
      return null;
    }
    this.door = 1;
    if (!q.fallT) { q.fallT = q.t; this.fx.boom = 0; this.fx.bolt = 0; }
    const ft = q.t - q.fallT;
    if (ft > 0.3 && !q.f1) { q.f1 = true; this.fx.boom = 0.9; this.fx.boomX = 330; this.audio.boom(sound, 0.7, 0.02); }
    if (ft > 1.15 && !q.f2) { q.f2 = true; this.lightning(sound, 120); }
    if (q.t - q.fallT >= CUTSCENE.fall) { this.seq = null; this.door = 0; this.wind = []; return "jumped"; }
    for (const c of this.fallClouds) { c.y -= c.sp * dt; if (c.y < -50) { c.y = H + rand(20, 120); c.x = rand(-40, W + 40); } }
    return null;
  }

  // ------------------------------------------------------------------ VẼ KHOANG
  draw(c) {
    const k = this.seq?.kind;
    if (k === "board") return this.drawBoarding(c, this.seq.t);
    if (k === "jump" && this.seq.fallT) return this.drawFall(c, this.seq.t - this.seq.fallT);
    const sx = this.sx, sy = this.sy, cx = Math.round(this.camX), f = this.fx, t = this.t;
    const ox = sx - cx;
    const vis = (x0, x1) => x1 > cx - 20 && x0 < cx + W + 20;
    c.fillStyle = "#0d0f0b"; c.fillRect(0, 0, W, H);
    c.save(); c.translate(ox, sy);
    if (vis(20, 200)) this.drawCockpitSky(c);
    for (const [x, y, r] of PORTHOLES) if (vis(x - 20, x + 20)) this.drawWindow(c, x, y, r);
    if (vis(DOOR.x0, DOOR.x1)) this.drawDoorSky(c);
    if (this.bgImg) c.drawImage(this.bgImg, 0, 0, CW, H);
    else c.drawImage(this.bg, -M, -M);
    this.drawDoorPanel(c);
    this.drawWallLife(c, vis);
    c.save(); c.globalCompositeOperation = "lighter";
    for (const [x, y] of PORTHOLES) {
      if (!vis(x - 10, x + 50)) continue;
      const bk = f.boom * clamp(1 - Math.abs(x - f.boomX) / 170, 0, 1), bl = f.bolt * clamp(1 - Math.abs(x - f.boltX) / 400, 0.3, 1);
      const beam = (col, a) => { if (a <= 0.004) return; c.fillStyle = withAlpha(col, a); c.beginPath(); c.moveTo(x - 6, y); c.lineTo(x + 6, y); c.lineTo(x + 40, 250); c.lineTo(x + 18, 250); c.closePath(); c.fill(); };
      beam("#ff8a4a", 0.028 + 0.012 * Math.sin(t * 0.7 + x) - this.whiteout * 0.02 + bk * 0.24);
      beam("#c8d4ff", bl * 0.22);
    }
    if (vis(0, 200)) {
      c.fillStyle = withAlpha("#ff7a3a", 0.05 + f.bolt * 0.12 + f.boom * clamp(1 - Math.abs(100 - f.boomX) / 220, 0, 1) * 0.2);
      c.beginPath(); c.moveTo(34, 104); c.lineTo(184, 104); c.lineTo(214, 262); c.lineTo(10, 262); c.closePath(); c.fill();
    }
    if (this.door > 0) {
      c.fillStyle = withAlpha("#ff8a50", 0.1 * this.door + f.bolt * 0.12 + f.boom * 0.08);
      c.beginPath(); c.moveTo(DOOR.x0, DOOR.y0); c.lineTo(DOOR.x0, DOOR.y1); c.lineTo(DOOR.x0 - 120, 262); c.lineTo(DOOR.x0 - 40, 262); c.closePath(); c.fill();
    }
    c.restore();
    this.drawStaticLine(c, vis);
    if (vis(JUMP_LIGHT[0] - 10, JUMP_LIGHT[0] + 10)) this.drawJumpLight(c, JUMP_LIGHT[0], JUMP_LIGHT[1]);
    if (!this.seq) for (const [id, s] of Object.entries(CABIN_SPOTS)) {
      if (!vis(s.x - 14, s.x + 14)) continue;
      const on = this.near === id, a = on ? 0.8 : 0.22 + 0.1 * Math.sin(t * 3 + s.x);
      c.strokeStyle = withAlpha(SPOT_COLOR[id] ?? "#9fd8ff", a); c.lineWidth = 1;
      c.beginPath(); c.ellipse(s.x, s.y, on ? 13 : 11, on ? 4.5 : 3.5, 0, 0, TAU); c.stroke();
    }
    // ---- đồ vật + người: vẽ theo CHIỀU SÂU (chân ở trên vẽ trước)
    const list = [], P = this.props;
    for (const id of ["crates", "drums", "cans", "table", "pedestal"]) { const p = P[id]; if (vis(p.x, p.x + p.cv.width)) list.push({ y: PROPS[id].base, fn: () => c.drawImage(p.cv, p.x, p.y) }); }
    if (vis(40, 170)) {
      list.push({ y: PROPS.seat1.base, fn: () => drawPilot(c, 72, 198, t, 0, this.lookT > 0) });
      list.push({ y: PROPS.seat2.base, fn: () => drawPilot(c, 152, 198, t, 2, Math.sin(t * 0.37) > 0.93) });
    }
    if (vis(930, 970)) list.push({ y: PROPS.master.base, fn: () => drawSoldierStand(c, 951, 203, t, this.ready || this.seq?.kind === "jump", this.masterShout > 0 && Math.sin(t * 14) > -0.3) });
    list.push({ y: this.hy, fn: () => this.drawHero(c) });
    list.sort((a, b) => a.y - b.y);
    for (const o of list) o.fn();
    if (vis(340, 440)) this.drawMapLamp(c);
    if (this.wind.length) { c.fillStyle = "rgba(235,225,215,0.5)"; for (const w of this.wind) c.fillRect(Math.round(w.x), Math.round(w.y), Math.round(w.l), 1); }
    c.restore();
    for (const d of this.dust) { c.fillStyle = withAlpha("#c8bcb2", d.a * 0.6); c.fillRect(Math.round(d.x), Math.round(d.y + sy), 1, 1); }
    // ---- ánh sáng (tọa độ khoang)
    const flick = (this.burstT > 0 && Math.sin(t * 37) > 0.6) || (f.boom > 0.75 && Math.sin(t * 53) > 0) ? 0.5 : 1;
    const green = this.ready || this.seq?.kind === "jump";
    const Ls = [];
    const add = (o) => { if (o.x > cx - o.r && o.x < cx + W + o.r) Ls.push(o); };
    for (const [x, y] of LAMPS) add({ x, y: y + 18, r: 92 * flick, color: "#ffcf7a", a: flick, glow: 0.13 });
    for (const [x, y] of PORTHOLES) {
      const bk = f.boom * clamp(1 - Math.abs(x - f.boomX) / 170, 0, 1);
      add({ x, y: y + 6, r: 34 + f.bolt * 46 + bk * 30, color: f.bolt > 0.25 ? "#c8d4ff" : "#ff7a3a", a: 0.42 + f.bolt * 0.55 + bk * 0.5, glow: 0.05 + f.bolt * 0.1 + bk * 0.16 });
    }
    add({ x: 110, y: 80, r: 120, color: f.bolt > 0.25 ? "#c8d4ff" : "#ff7a3a", a: 0.55 + f.bolt * 0.45, glow: 0.06 + f.bolt * 0.1 });
    add({ x: 73, y: 131, r: 40, color: "#5dff9a", a: 0.7, glow: 0.12 }); add({ x: 143, y: 131, r: 40, color: "#5dff9a", a: 0.7, glow: 0.12 });
    if (this.burstT > 0 && Math.sin(t * 8) > 0) add({ x: 92, y: 116, r: 30, color: "#ff3b30", a: 0.9, glow: 0.2 });
    add({ x: 280, y: 110, r: 46, color: "#5dff9a", a: 0.6, glow: 0.08 });
    add({ x: 408, y: 66, r: 48, color: "#5dbaff", a: 0.65, glow: 0.1 });
    add({ x: 388 + this.swing * 10, y: 160, r: 70, color: "#ffd98a", a: 0.9, glow: 0.14 });
    add({ x: JUMP_LIGHT[0], y: JUMP_LIGHT[1], r: 60, color: green ? "#4dff7a" : "#ff3b30", a: 0.9 + 0.1 * Math.sin(t * 6), glow: 0.22 });
    if (!green) add({ x: 1080, y: 46, r: 80, color: "#ff3b30", a: 0.5 + 0.4 * Math.max(0, Math.sin(t * 4)), glow: 0.12 });
    add({ x: this.hx, y: this.hy - 16, r: 70, color: null, a: 0.8, glow: 0 });
    add({ x: 656, y: 214, r: 90, color: null, a: 0.55, glow: 0 });
    add({ x: (DOOR.x0 + DOOR.x1) / 2, y: 140, r: 60 + 70 * this.door, color: this.door > 0 ? "#ff8a50" : null, a: 0.4 + 0.6 * this.door, glow: 0.1 * this.door });
    this.cam.rx = cx - sx; this.cam.ry = -sy;
    this.light.render(c, this.cam, { color: "#06050a", alpha: 0.62 - f.bolt * 0.22 }, Ls);
    this.drawForeground(c);
    c.drawImage(this.vignette, 0, 0);
    if (this.burstT > 0 && flick < 1) { c.fillStyle = "rgba(0,0,0,0.12)"; c.fillRect(0, 0, W, H); }
    c.save(); c.translate(ox, sy);
    if (this.say) this.drawBubble(c, this.say);
    if (!this.seq && this.near && !this.peeking && !this.say) {
      const s = CABIN_SPOTS[this.near], label = s.label;
      c.font = "8px monospace"; c.textBaseline = "top"; c.textAlign = "center";
      const tw = Math.ceil(c.measureText(label).width) + 8, x = Math.round(clamp(this.hx, cx + tw / 2 + 2, cx + W - tw / 2 - 2)), y = Math.round(this.hy - 54);
      c.fillStyle = "rgba(8,10,6,0.85)"; c.fillRect(x - tw / 2, y, tw, 11);
      c.fillStyle = SPOT_COLOR[this.near] ?? "#9fd8ff"; c.fillRect(x - tw / 2, y + 10, tw, 1);
      c.fillStyle = "#f4f0dc"; c.fillText(label, x, y + 2);
      c.textAlign = "left";
    }
    c.restore();
    if (!this.seq) this.drawCompass(c);
    if (this.peek > 0) this.drawPeek(c);
    const end = this.jumpEnd;
    if (this.seq?.kind === "jump" && this.seq.jumped && this.seq.t > end - 0.3) {
      c.fillStyle = withAlpha("#2a1614", clamp((this.seq.t - (end - 0.3)) / 0.3, 0, 1)); c.fillRect(0, 0, W, H);
    }
  }

  drawHero(c) {
    const jumpingOut = this.seq?.kind === "jump" && this.seq.jumped && this.hx > DOOR.x0 + 6;
    const hx = Math.round(this.hx + (this.burstT > 0 && !this.seq ? Math.round(Math.sin(this.t * 13)) : 0)), hy = Math.round(this.hy);
    if (!jumpingOut) { c.fillStyle = "rgba(0,0,0,0.35)"; c.beginPath(); c.ellipse(hx, hy, 8, 2.5, 0, 0, TAU); c.fill(); }
    c.save();
    if (jumpingOut) { c.beginPath(); c.rect(DOOR.x0 - 200, 0, 200 + DOOR.x1 - DOOR.x0, H); c.clip(); }
    const h = this.hero;
    if (h?.sprite && h.anim) h.sprite.sheet.draw(c, h.anim.col, h.anim.row, hx, hy, this.flip);
    else { c.fillStyle = "#c8c0e0"; c.fillRect(hx - 5, hy - 20, 10, 20); }
    c.restore();
  }

  /** Những thứ "sống" gắn trên vách: màn hình, đèn LED, người ngủ gật, khói cà phê... */
  drawWallLife(c, vis) {
    const t = this.t;
    if (vis(0, 200)) {
      for (let i = 0; i < 20; i++) { const on = Math.sin(t * (1 + (i % 5) * 0.7) + i * 2.1) > 0.2; R(c, 32 + i * 8, 4 + (i % 3) * 7, 2, 1, on ? (i % 4 ? "#5dff9a" : "#ffb03a") : "#1a2a1a"); }
      R(c, 61, 117, 24, 28, "#03140a");   // radar
      c.strokeStyle = "rgba(93,255,154,0.35)"; c.lineWidth = 1; for (const r of [4, 8, 11]) { c.beginPath(); c.arc(73, 131, r, 0, TAU); c.stroke(); }
      const a = t * 2.2; c.strokeStyle = "#5dff9a"; c.beginPath(); c.moveTo(73, 131); c.lineTo(73 + Math.cos(a) * 11, 131 + Math.sin(a) * 11); c.stroke();
      for (const [bx, by, ph] of [[78, 125, 0.4], [67, 136, 2.5], [80, 138, 4]]) { const k = ((a - ph) % TAU + TAU) % TAU; if (k < 2.5) R(c, bx, by, 2, 2, withAlpha("#ff5a3a", 1 - k / 2.5)); }
      c.save(); c.beginPath(); c.rect(129, 117, 28, 28); c.clip();   // chân trời nhân tạo
      c.translate(143, 131); c.rotate(clamp(this.swing, -0.5, 0.5) * 0.6 + (this.burstT > 0 ? Math.sin(t * 9) * 0.12 : 0));
      R(c, -24, -24, 48, 24, "#2a5a9a"); R(c, -24, 0, 48, 24, "#6a4a2a"); R(c, -24, 0, 48, 1, "#f4f4f4");
      for (const y of [-6, 6]) R(c, -5, y, 10, 1, "#f4f4f4");
      c.restore(); R(c, 136, 130, 5, 1, "#ffd23a"); R(c, 145, 130, 5, 1, "#ffd23a"); R(c, 142, 131, 2, 1, "#ffd23a");
      for (const [gx, gy, ph] of [[34, 124, 0], [48, 124, 1], [34, 140, 2], [48, 140, 3], [98, 124, 4], [112, 124, 5], [98, 140, 6], [112, 140, 7], [168, 124, 8], [182, 124, 9], [168, 140, 10], [182, 140, 11]]) {
        const an = ph * 0.9 + Math.sin(t * (0.5 + ph * 0.13)) * 0.4 + (this.burstT > 0 ? rand(-0.3, 0.3) : 0);
        c.strokeStyle = ph % 3 ? "#f4f4f4" : "#ffb03a"; c.beginPath(); c.moveTo(gx, gy); c.lineTo(gx + Math.cos(an) * 4, gy + Math.sin(an) * 4); c.stroke();
      }
      if (this.burstT > 0 && Math.sin(t * 8) > 0) R(c, 88, 113, 9, 4, "#ff3b30");   // MASTER CAUTION
    }
    if (vis(230, 300)) {
      R(c, 267, 101, 26, 16, "#04170a");
      const talking = this.say && this.say.x === 262;
      c.strokeStyle = "#5dff9a"; c.lineWidth = 1; c.beginPath();
      for (let i = 0; i <= 24; i++) { const y = 109 + Math.sin(i * 0.7 + t * 8) * (talking ? 2 + 4 * Math.random() : 2); i ? c.lineTo(268 + i, y) : c.moveTo(268, y); }
      c.stroke();
      for (let i = 0; i < 6; i++) R(c, 239 + i * 9, 128, 2, 2, Math.sin(t * (2 + i) + i) > 0 ? ["#5dff9a", "#ffb03a", "#ff3b30"][i % 3] : "#1a1c18");
    }
    if (vis(380, 436)) {
      R(c, 386, 50, 44, 32, "#04101c");
      c.font = "5px monospace"; c.textBaseline = "top"; c.textAlign = "left";
      c.fillStyle = "#5dbaff"; c.fillText("VUNG THA", 389, 52);
      c.fillStyle = this.ready ? "#4dff7a" : "#ffd23a"; c.fillText(this.ready ? "GO GO GO" : `ETA 00:${String(Math.ceil(this.eta)).padStart(2, "0")}`, 389, 59);
      R(c, 389, 67, 38, 12, "#0a2234"); for (let i = 0; i < 6; i++) R(c, 391 + i * 6, 70 + (i % 2) * 4, 3, 2, "#1e4a6a");
      const px = 391 + (1 - this.eta / CABIN_ETA) * 32; R(c, Math.round(px), 72, 2, 2, "#ffd23a"); if (Math.sin(t * 6) > 0) R(c, 423, 71, 3, 3, "#ff3b30");
      if (Math.random() < 0.02) { c.fillStyle = "rgba(93,186,255,0.25)"; c.fillRect(386, 50 + Math.random() * 30, 44, 2); }
    }
    if (vis(400, 440)) for (let i = 0; i < 4; i++) { const k = (t * 0.5 + i / 4) % 1; c.fillStyle = withAlpha("#e8e2d8", 0.35 * (1 - k)); c.fillRect(Math.round(414 + Math.sin(t * 2 + i) * 2), Math.round(188 - k * 14), 1, 2); }
    if (vis(450, 500)) {
      drawSoldierSleep(c, 470, 168, t, this.wakeT > 0);
      if (this.wakeT <= 0) for (let i = 0; i < 3; i++) {
        const k = (t * 0.35 + i / 3) % 1;
        c.font = `${5 + Math.round(k * 3)}px monospace`; c.textBaseline = "top"; c.fillStyle = withAlpha("#dfe6ff", 0.8 * (1 - k)); c.fillText("z", 478 + k * 10, 140 - k * 18);
      }
    }
    if (vis(1060, 1100) && !(this.ready || this.seq?.kind === "jump")) { R(c, 1076, 40, 8, 6, "#3a1410"); R(c, 1077, 41, 6, 4, Math.sin(t * 4) > 0 ? "#ff3b30" : "#7a1a14"); }
  }

  /** Đèn treo trên bàn bản đồ (đung đưa theo máy bay) */
  drawMapLamp(c) {
    const sw = clamp(this.swing, -0.6, 0.6), lx = 388 + sw * 10, ly = 150;
    c.strokeStyle = "#1a1a1a"; c.lineWidth = 1; c.beginPath(); c.moveTo(388, 35); c.quadraticCurveTo(388 + sw * 4, 92, lx, ly - 6); c.stroke();
    c.fillStyle = "#2f3526"; c.beginPath(); c.moveTo(lx - 8, ly); c.lineTo(lx - 3, ly - 7); c.lineTo(lx + 3, ly - 7); c.lineTo(lx + 8, ly); c.closePath(); c.fill();
    R(c, Math.round(lx - 3), ly, 6, 2, "#ffe7a0");
    c.save(); c.globalCompositeOperation = "lighter"; c.fillStyle = "rgba(255,220,140,0.07)";
    c.beginPath(); c.moveTo(lx - 6, ly); c.lineTo(lx + 6, ly); c.lineTo(lx + 34, 206); c.lineTo(lx - 34, 206); c.closePath(); c.fill(); c.restore();
  }

  /** Lớp tiền cảnh (trôi nhanh hơn camera = cảm giác chiều sâu): dây đai treo trần + mép thùng hàng tối */
  drawForeground(c) {
    const base = -this.camX * 1.35, sw = Math.round(clamp(this.swing, -0.6, 0.6) * 8);
    for (let i = 0; i < 9; i++) {
      const x = Math.round(base + i * 190 + 60 + this.sx * 1.5);
      if (x < -40 || x > W + 40) continue;
      if (i % 2) { R(c, x, -2, 3, 26, "#0a0b08"); R(c, x + sw, 22, 3, 14, "#0a0b08"); R(c, x - 2 + sw, 34, 7, 4, "#0a0b08"); }
      else { R(c, x - 26, H - 12, 60, 14, "#07080a"); R(c, x - 26, H - 12, 60, 1, "#1a1c18"); R(c, x - 18, H - 17, 30, 6, "#07080a"); }
    }
  }

  /** Bóng thoại pixel */
  drawBubble(c, s) {
    c.font = "8px monospace"; c.textBaseline = "top"; c.textAlign = "left";
    const words = s.text.split(" "), lines = []; let cur = "";
    for (const w of words) { const nx = cur ? cur + " " + w : w; if (c.measureText(nx).width > 150 && cur) { lines.push(cur); cur = w; } else cur = nx; }
    lines.push(cur);
    const bw = Math.ceil(Math.max(...lines.map((l) => c.measureText(l).width))) + 10, bh = lines.length * 10 + 6;
    const bx = Math.round(clamp(s.x - bw / 2, this.camX + 4, this.camX + W - bw - 4)), by = Math.round(Math.max(4, s.y - bh));
    c.globalAlpha = Math.min(1, s.t * 3);
    c.fillStyle = "rgba(10,12,8,0.92)"; c.fillRect(bx, by, bw, bh);
    c.fillStyle = "#e0b830"; c.fillRect(bx, by, bw, 1); c.fillRect(bx, by + bh - 1, bw, 1); c.fillRect(bx, by, 1, bh); c.fillRect(bx + bw - 1, by, 1, bh);
    const tx = Math.round(clamp(s.x, bx + 6, bx + bw - 6));
    c.fillStyle = "rgba(10,12,8,0.92)"; c.fillRect(tx - 2, by + bh, 5, 2); c.fillRect(tx - 1, by + bh + 2, 3, 2);
    c.fillStyle = "#f4f0dc"; lines.forEach((l, i) => c.fillText(l, bx + 5, by + 4 + i * 10));
    c.globalAlpha = 1;
  }

  /** Thanh vị trí trong khoang + mũi tên chỉ cửa nhảy khi đèn xanh */
  drawCompass(c) {
    const x0 = 170, w = 140, y = 262;
    c.fillStyle = "rgba(8,10,6,0.6)"; c.fillRect(x0 - 2, y - 3, w + 4, 7);
    for (const [px, col] of [[100, "#9fd8ff"], [262, "#9fd8ff"], [388, "#9fd8ff"], [470, "#9fd8ff"], [656, "#ffe26b"], [870, "#9fd8ff"], [950, "#9fd8ff"], [1018, "#5fdc8c"]]) R(c, Math.round(x0 + (px / CW) * w), y - 1, 1, 3, col);
    R(c, Math.round(x0 + (this.camX / CW) * w), y - 2, Math.round((W / CW) * w), 1, "rgba(244,240,220,0.35)");
    R(c, Math.round(x0 + (this.hx / CW) * w) - 1, y - 2, 3, 5, "#f4f0dc");
    if (this.ready && DOOR.x0 > this.camX + W) {
      c.fillStyle = Math.sin(this.t * 8) > 0 ? "#4dff7a" : "#2a8a4a"; c.beginPath(); c.moveTo(W - 6, 130); c.lineTo(W - 16, 122); c.lineTo(W - 16, 138); c.closePath(); c.fill();
      c.font = "8px monospace"; c.textAlign = "right"; c.textBaseline = "middle"; c.fillText("CỬA NHẢY", W - 20, 130); c.textAlign = "left";
    }
  }

  /** NHÌN RA CỬA SỔ (cận cảnh): cánh máy bay + động cơ + cánh quạt, mây đen, pháo nổ, thành phố cháy bên dưới */
  drawPeek(c) {
    const k = this.peek, t = this.t, f = this.fx, cx = W / 2, cy = H / 2 - 4, r = 6 + 96 * k;
    c.fillStyle = withAlpha("#050506", 0.82 * k); c.fillRect(0, 0, W, H);
    c.save(); c.beginPath(); c.arc(cx, cy, r, 0, TAU); c.clip();
    doomSky(c, cx - r, cy - r, r * 2, r * 2, [[0, "#0c090e"], [0.45, "#241619"], [0.72, "#4e2018"], [0.86, "#8a3a1a"], [1, "#2a1414"]]);
    if (f.bolt > 0.35) this.drawBolt(c, cx - 40, cy - r, cy + 20);
    c.save(); c.translate(cx - r, cy + 50); c.scale(0.5, 0.5);   // thành phố cháy tít dưới xa
    const off = -((t * 30) % 480);
    for (const o of [off, off + 480]) { c.save(); c.translate(o, 0); drawRuins(c, this.skyline, 40, 0.6, t, "#0c090b"); c.restore(); }
    c.restore();
    for (let i = 0; i < 10; i++) { const fx2 = cx - r + ((i * 47 + t * 15) % (r * 2)); c.fillStyle = withAlpha(DOOM.fire, 0.6 + 0.4 * Math.sin(t * 7 + i)); c.fillRect(Math.round(fx2), Math.round(cy + 68 + (i % 3) * 3), 2, 1); }
    for (let i = 0; i < 12; i++) {   // mây xa + gần trôi
      const far = i % 2 === 0, sp = far ? 22 : 70, span = r * 2 + 120;
      const x = cx - r - 60 + (((i * 83 + t * sp) % span) + span) % span, y = cy - 50 + ((i * 37) % 90), rr = far ? 10 : 18;
      c.fillStyle = far ? DOOM.cloudFar : DOOM.cloud; c.beginPath(); c.arc(x, y, rr, 0, TAU); c.arc(x + rr, y + 3, rr * 0.8, 0, TAU); c.arc(x - rr * 0.8, y + 4, rr * 0.6, 0, TAU); c.fill();
      if (!far) { c.fillStyle = DOOM.cloudLit; c.fillRect(Math.round(x - rr), Math.round(y + rr * 0.6), Math.round(rr * 2.2), 1); }
    }
    for (let i = 0; i < 4; i++) {   // pháo phòng không nổ
      const ph = (t * 0.45 + i * 0.27) % 1, bx = cx - 70 + ((i * 61) % 150), by = cy - 60 + ((i * 43) % 50);
      if (ph < 0.12) { c.fillStyle = withAlpha("#ffe0a0", 1 - ph / 0.12); c.beginPath(); c.arc(bx, by, 3 + ph * 30, 0, TAU); c.fill(); }
      if (ph < 0.8) { c.fillStyle = withAlpha("#0e0b0d", 0.85 * (1 - ph)); c.beginPath(); c.arc(bx + ph * 30, by, 3 + ph * 12, 0, TAU); c.fill(); }
    }
    // cánh máy bay + động cơ + cánh quạt
    const wy = cy + 18 + Math.round(Math.sin(t * 1.3) * 2 + this.sy), shade = "#3e4636", top = "#566048";
    c.fillStyle = "#1a1e16"; c.beginPath(); c.moveTo(cx - r - 10, wy - 2); c.lineTo(cx + 120, wy + 8); c.lineTo(cx + 120, wy + 16); c.lineTo(cx - r - 10, wy + 22); c.closePath(); c.fill();
    c.fillStyle = shade; c.beginPath(); c.moveTo(cx - r - 10, wy); c.lineTo(cx + 118, wy + 9); c.lineTo(cx + 118, wy + 14); c.lineTo(cx - r - 10, wy + 19); c.closePath(); c.fill();
    c.fillStyle = top; c.beginPath(); c.moveTo(cx - r - 10, wy); c.lineTo(cx + 118, wy + 9); c.lineTo(cx + 118, wy + 10); c.lineTo(cx - r - 10, wy + 4); c.closePath(); c.fill();
    R(c, cx + 104, wy + 9, 6, 2, Math.sin(t * 5) > 0.4 ? "#ff3b30" : "#5a1410");
    const ex = cx - 22;
    R(c, ex - 30, wy - 4, 50, 18, "#1a1e16"); R(c, ex - 29, wy - 3, 48, 15, shade); R(c, ex - 29, wy - 3, 48, 3, top); R(c, ex - 29, wy + 10, 48, 2, "#2a3024");
    R(c, ex + 14, wy - 1, 4, 3, "#3a3f42");
    for (let i = 0; i < 4; i++) R(c, ex + 20 + i * 3, wy + 6 + Math.round(Math.random()), 5, 2, withAlpha(i ? "#ff9a3a" : "#ffe0a0", 0.7 - i * 0.15));   // lửa xả
    c.fillStyle = "rgba(210,200,190,0.28)"; c.beginPath(); c.ellipse(ex - 32, wy + 5, 3, 26, 0, 0, TAU); c.fill();
    for (let i = 0; i < 4; i++) { const a = t * 40 + i * (TAU / 4); R(c, Math.round(ex - 33), Math.round(wy + 5 + Math.sin(a) * 24), 2, 3, "rgba(20,20,20,0.5)"); }
    R(c, ex - 36, wy + 2, 6, 7, "#8a8f93");
    if (f.bolt > 0) { c.fillStyle = withAlpha(DOOM.bolt, f.bolt * 0.5); c.fillRect(cx - r, cy - r, r * 2, r * 2); }
    if (f.boom > 0) { c.fillStyle = withAlpha(DOOM.boom, f.boom * 0.35); c.fillRect(cx - r, cy - r, r * 2, r * 2); }
    c.fillStyle = "rgba(255,220,200,0.06)"; c.beginPath(); c.ellipse(cx - r * 0.4, cy - r * 0.45, r * 0.35, r * 0.18, -0.6, 0, TAU); c.fill();
    c.restore();
    c.lineWidth = 10; c.strokeStyle = "#3d4433"; c.beginPath(); c.arc(cx, cy, r + 5, 0, TAU); c.stroke();
    c.lineWidth = 2; c.strokeStyle = "#7d866b"; c.beginPath(); c.arc(cx, cy, r + 1, 0, TAU); c.stroke();
    c.strokeStyle = "#1b1f16"; c.beginPath(); c.arc(cx, cy, r + 10, 0, TAU); c.stroke();
    for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU; R(c, Math.round(cx + Math.cos(a) * (r + 6)), Math.round(cy + Math.sin(a) * (r + 6)), 2, 2, "#c4cbb0"); }
    if (k > 0.9) {
      c.font = "8px monospace"; c.textAlign = "center"; c.textBaseline = "top";
      c.fillStyle = "rgba(8,10,6,0.8)"; c.fillRect(cx - 80, H - 16, 160, 11);
      c.fillStyle = "#f4f0dc"; c.fillText("E / di chuyển / chạm: thôi nhìn", cx, H - 14); c.textAlign = "left";
    }
  }

  /** Trời nhìn qua kính buồng lái: chân trời rực lửa, mây đen lao về phía máy bay, pháo nổ phía trước */
  drawCockpitSky(c) {
    const t = this.t, f = this.fx;
    c.save(); c.beginPath();
    for (const poly of COCKPIT_GLASS) { poly.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); }
    c.clip();
    doomSky(c, 30, 40, 160, 66, [[0, "#120d11"], [0.5, "#2e1a1a"], [0.78, "#6a2a17"], [0.92, "#a4481d"], [1, "#3a1a14"]]);
    const hz = 94 + Math.round(clamp(this.swing, -0.6, 0.6) * 6);
    c.fillStyle = "#0c090b"; for (let x = 30; x < 190; x += 7) { const h = 3 + ((x * 13) % 7); c.fillRect(x, hz - h, 6, h + 14); }
    for (let i = 0; i < 6; i++) { const x = 36 + ((i * 29) % 150); R(c, x, hz - 1, 2, 1, Math.sin(t * 6 + i) > 0 ? "#ff7a2a" : "#ffd27a"); }
    if (f.bolt > 0.35) this.drawBolt(c, 60 + ((Math.floor(Math.abs(f.boltX)) * 7) % 110), 40, hz);
    for (let i = 0; i < 9; i++) {   // mây lao tới: phình to dần rồi vụt qua
      const k = ((t * 0.35 + i / 9) % 1), x = 110 + Math.cos(i * 2.4) * (10 + k * 120), y = 72 + Math.sin(i * 1.7) * (6 + k * 40), rr = 2 + k * 16;
      c.fillStyle = withAlpha(i % 2 ? DOOM.cloud : DOOM.cloudFar, 0.4 + k * 0.6); c.beginPath(); c.arc(x, y, rr, 0, TAU); c.arc(x + rr * 0.8, y + 2, rr * 0.7, 0, TAU); c.fill();
    }
    for (let i = 0; i < 3; i++) {
      const ph = (t * 0.33 + i * 0.37) % 1, bx = 60 + i * 50, by = 56 + (i % 2) * 12;
      if (ph < 0.1) { c.fillStyle = withAlpha("#ffe0a0", 1 - ph * 10); c.beginPath(); c.arc(bx, by, 2 + ph * 30, 0, TAU); c.fill(); }
      else if (ph < 0.6) { c.fillStyle = withAlpha("#0e0b0d", 0.8 * (1 - ph)); c.beginPath(); c.arc(bx, by, 2 + ph * 9, 0, TAU); c.fill(); }
    }
    if (f.bolt > 0) { c.fillStyle = withAlpha(DOOM.bolt, f.bolt * 0.6); c.fillRect(30, 40, 160, 66); }
    if (f.boom > 0) { c.fillStyle = withAlpha(DOOM.boom, f.boom * 0.5 * clamp(1 - Math.abs(100 - f.boomX) / 220, 0, 1)); c.fillRect(30, 40, 160, 66); }
    for (let i = 0; i < 5; i++) { const k = (t * 1.5 + i * 0.2) % 1; R(c, Math.round(40 + i * 33 + k * 8), Math.round(44 + k * 60), 1, 3, "rgba(200,210,230,0.35)"); }
    c.restore();
  }

  /** Trời phía sau cửa nhảy: mây đen + tàn lửa lao vun vút khi cửa mở (tọa độ khoang) */
  drawDoorSky(c) {
    const x0 = DOOR.x0, y0 = DOOR.y0, w = DOOR.x1 - DOOR.x0, h = DOOR.y1 - DOOR.y0, f = this.fx;
    doomSky(c, x0, y0, w, h);
    c.save(); c.beginPath(); c.rect(x0, y0, w, h); c.clip();
    if (f.bolt > 0.45) this.drawBolt(c, x0 + w / 2, y0, y0 + h * 0.7);
    for (let i = 0; i < 7; i++) {
      const cx = x0 + ((i * 53 + this.t * 260) % 90 + 90) % 90 - 20, cy = y0 + 10 + i * 16;
      c.fillStyle = i % 2 ? DOOM.cloud : DOOM.cloudFar;
      c.beginPath(); c.arc(cx, cy, 6 + (i % 3) * 3, 0, TAU); c.arc(cx + 8, cy + 2, 5 + (i % 2) * 3, 0, TAU); c.fill();
      c.fillStyle = DOOM.cloudLit; c.fillRect(Math.round(cx - 4), Math.round(cy + 6 + (i % 3) * 2), 14, 1);
    }
    for (let i = 0; i < 9; i++) {
      const ex = x0 + ((i * 37 + this.t * 340) % 60 + 60) % 60 - 10, ey = y0 + ((i * 29 + this.t * 20) % h);
      c.fillStyle = withAlpha(DOOM.ember, 0.5 + 0.5 * Math.sin(this.t * 9 + i)); c.fillRect(Math.round(ex), Math.round(ey), 2, 1);
    }
    if (f.bolt > 0) { c.fillStyle = withAlpha(DOOM.bolt, f.bolt * 0.6); c.fillRect(x0, y0, w, h); }
    const bk = f.boom * clamp(1 - Math.abs(DOOR.x0 - f.boomX) / 170, 0, 1);
    if (bk > 0) { c.fillStyle = withAlpha(DOOM.boom, bk * 0.8); c.fillRect(x0, y0, w, h); }
    c.restore();
  }
  /** Cánh cửa nhảy: trượt lên trần khi mở (door 0 -> 1) */
  drawDoorPanel(c) {
    const x0 = DOOR.x0, y0 = DOOR.y0, w = DOOR.x1 - DOOR.x0, h = DOOR.y1 - DOOR.y0;
    const off = Math.round(this.door * (h + 4));
    if (off >= h) return;
    c.save(); c.beginPath(); c.rect(x0, y0, w, h); c.clip();
    const y = y0 - off;
    R(c, x0, y, w, h, "#3d4533"); R(c, x0, y, w, 2, "#5c654c"); R(c, x0 + w - 2, y, 2, h, "#262b20");
    for (let yy = y + 12; yy < y + h; yy += 18) R(c, x0 + 2, yy, w - 4, 1, "#2f3527");
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


  /** Cửa sổ tròn (tọa độ khoang): mọi cửa sổ cùng nhìn 1 bầu trời — mây đen + khói pháo trôi lần lượt qua */
  drawWindow(c, x, y, r) {
    const f = this.fx;
    c.save();
    c.beginPath(); c.arc(x, y, r + 0.5, 0, TAU); c.clip();
    doomSky(c, x - r - 1, y - r - 1, r * 2 + 2, r * 2 + 2, [[0, "#140e12"], [0.5, "#2e1a1a"], [0.85, "#6a2a17"], [1, "#94401b"]]);
    if (f.bolt > 0.45 && Math.abs(x - f.boltX) < 60) this.drawBolt(c, x + (f.boltX - x) * 0.15, y - r - 2, y + r + 2);
    const oy = y - 74;
    for (const p of this.flak) {
      if (p.x < x - r - 14 || p.x > x + r + 14) continue;
      c.fillStyle = withAlpha("#0e0b0d", Math.min(1, p.a * 1.2));
      c.beginPath(); c.arc(p.x, p.y + oy, p.r, 0, TAU); c.arc(p.x - p.r * 0.7, p.y + oy + 1, p.r * 0.7, 0, TAU); c.fill();
      if (p.a > 0.8) { c.fillStyle = withAlpha(DOOM.boom, (p.a - 0.8) * 5); c.beginPath(); c.arc(p.x, p.y + oy, p.r * 0.7, 0, TAU); c.fill(); }
    }
    for (const cl of this.clouds) {
      if (cl.x < x - r - 40 || cl.x > x + r + 40) continue;
      for (let k = 0; k < cl.puffs; k++) {
        const px = cl.x + k * cl.r * 0.9 - cl.puffs * cl.r * 0.45, py = cl.y + oy + Math.sin(k * 2.3) * cl.r * 0.35;
        c.fillStyle = cl.far ? DOOM.cloudFar : DOOM.cloud;
        c.beginPath(); c.arc(Math.round(px), Math.round(py), cl.r * (0.7 + 0.3 * Math.sin(k * 1.7 + cl.x * 0.01)), 0, TAU); c.fill();
        if (!cl.far) { c.fillStyle = DOOM.cloudLit; c.fillRect(Math.round(px - cl.r * 0.6), Math.round(py + cl.r * 0.5), Math.round(cl.r * 1.2), 1); }
      }
    }
    if (this.whiteout > 0) { c.fillStyle = withAlpha("#221b1e", Math.min(0.85, this.whiteout)); c.fillRect(x - r, y - r, r * 2, r * 2); }
    if (f.bolt > 0) { c.fillStyle = withAlpha(DOOM.bolt, f.bolt * 0.7); c.fillRect(x - r, y - r, r * 2, r * 2); }
    const bk = f.boom * clamp(1 - Math.abs(x - f.boomX) / 170, 0, 1);
    if (bk > 0) { c.fillStyle = withAlpha(DOOM.boom, bk * 0.85); c.fillRect(x - r, y - r, r * 2, r * 2); }
    c.fillStyle = "rgba(255,215,190,0.16)"; c.fillRect(Math.round(x - r * 0.55), Math.round(y - r * 0.5), 2, Math.round(r * 0.9));
    c.restore();
  }

  /** Cáp móc dù dọc trần (từ vách ngăn tới cửa nhảy) + dây móc + dù đeo lưng treo móc, đung đưa */
  drawStaticLine(c, vis) {
    const y0 = 40, sw = clamp(this.swing, -0.6, 0.6);
    R(c, 222, y0, DOOR.x0 - 230, 1, "#c9a531"); R(c, 222, y0 + 1, DOOR.x0 - 230, 1, "#7a6420");
    for (const [x, len] of [[240, 40], [330, 44], [420, 36], [520, 48], [610, 40], [760, 42], [840, 38], [930, 46], [975, 34]]) {
      if (!vis(x - 30, x + 30)) continue;
      c.strokeStyle = "#c9a531"; c.lineWidth = 2; c.beginPath(); c.moveTo(x, y0 + 1);
      c.quadraticCurveTo(x + sw * len * 0.6, y0 + len * 0.6, x + sw * len, y0 + len); c.stroke();
      R(c, Math.round(x + sw * len) - 1, Math.round(y0 + len), 3, 4, "#9aa0a6");
    }
    if (vis(680, 760)) for (const [x0, col] of [[700, "#5a6440"], [722, "#566039"], [744, "#4e5835"]]) {
      const x = Math.round(x0 + sw * 6), y = 101;
      R(c, x0, 99, 1, 3, "#2e3324");
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

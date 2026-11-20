// =====================================================================================
//  BẢN ĐỒ RÚT QUÂN "VÙNG DỊCH Z-07" — chế độ Nhảy Dù – Nhiệm Vụ – Rút Quân
//
//  3200 x 2240 px, đường lớn hình chữ thập chia 4 khu:
//    town (trên trái)  · military (trên phải)  · grave (dưới trái)  · lab (dưới phải)
//  Mỗi khu có sàn + vật cản riêng (đăng ký kiểu vẽ vào SOLID_STYLES của world.js).
//  Thứ tự sinh: tường bao -> đường -> điểm đặc biệt (đáp, rút quân, nhiệm vụ) vào "vùng cấm"
//  -> công trình & vật cản (tránh vùng cấm) -> nhặt đồ / đội tuần tra -> vật phá được -> ánh sáng.
// =====================================================================================
import { World, WORLD, ENV, SOLID_STYLES, DECOR_DRAW, ellipse, shade } from "./world.js";
import { clamp, rand, randInt, pick, circleRect, rectOverlap, darken, withAlpha, TAU, makeRng } from "./util.js";

export const EXTRACT_WORLD = { w: 3200, h: 2240 };

export const EXTRACT_BIOME = {
  id: "zone",
  name: "Vùng Dịch Z-07",
  desc: "Thành phố bị phong tỏa: khu dân cư đổ nát, trạm quân sự, nghĩa trang và phòng thí nghiệm bị rò rỉ. Đường lớn chia 4 khu.",
  floor: { a: "#463f33", b: "#41392e", line: "#2f2a22", dots: ["#2f2a22", "#5a5242"] },
  wall: { base: "#34343c", top: "#5a5a66", dark: "#14141a", face: "#24242c", pillarTop: "#6a6e78", pillarFace: "#3a3c46", pillarLine: "#8a8e98" },
  pillarStyle: "stone",
  counts: { pillars: 0, barrels: 0, acid: 0, traps: 0, crystals: 0, lavaRivers: 0, hands: 0, braziers: 0, shrines: 0, crates: 0, jars: 0, bushes: 0 },
  accel: 30,
  minimap: "#22222a",
  light: { color: "#0a0814", alpha: 0.3 },
  weather: "dust",
  torch: "#ffb04a",
  spawnBias: {},
};

export const ZONES = [
  { id: "town", name: "Khu Dân Cư Đổ Nát", color: "#d9a05b" },
  { id: "military", name: "Trạm Quân Sự", color: "#7fae5a" },
  { id: "grave", name: "Nghĩa Trang", color: "#9a7ad8" },
  { id: "lab", name: "Phòng Thí Nghiệm", color: "#4fd6c8" },
];

// =====================================================================================
//  TIỆN ÍCH VẼ PIXEL
// =====================================================================================
const R = (g, c, x, y, w, h) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.max(0, Math.round(w)), Math.max(0, Math.round(h))); };
const rngOf = (s) => makeRng((((s.seed ?? 0.5) * 1e6) | 0) + ((s.x * 31 + s.y * 17) | 0));
const inflate = (r, m) => ({ x: r.x - m, y: r.y - m, w: r.w + m * 2, h: r.h + m * 2 });
const OUT = "#0a0810";

// ---------- Tường (nhà đổ nát / tường phòng thí nghiệm) ----------
const WALL_PAL = {
  town: { out: "#120e0c", top: "#a89a86", hi: "#cbbda6", face: "#6e6050", seam: "#8c7e6a", fseam: "#54483c", brick: "#a05a3c", moss: "#4a6a34", rubble: "#7a6c5a", chip: "#3c3228" },
  lab: { out: "#0a1216", top: "#c6dcdc", hi: "#f0ffff", face: "#6a8e96", seam: "#9cbcc0", fseam: "#46666e", brick: "#2fc9b8", moss: "#3a8a5a", rubble: "#9ab4b8", chip: "#2c4a52", lab: true },
};

function drawWallBlock(g, s, P) {
  const rg = rngOf(s), horiz = s.w >= s.h, face = horiz ? Math.min(7, s.h >> 1) : 8, topH = s.h - face;
  R(g, P.out, s.x - 1, s.y - 1, s.w + 2, s.h + 2);
  R(g, P.top, s.x, s.y, s.w, topH);
  R(g, P.face, s.x, s.y + topH, s.w, face);
  R(g, P.hi, s.x, s.y, s.w, 1); R(g, P.hi, s.x, s.y, 1, topH);
  // đường ghép gạch trên mặt tường
  if (horiz) for (let x = s.x + 5 + ((rg() * 5) | 0); x < s.x + s.w - 3; x += 8 + ((rg() * 6) | 0)) R(g, P.seam, x, s.y + 1, 1, topH - 1);
  else for (let y = s.y + 4; y < s.y + topH - 1; y += 6) { R(g, P.seam, s.x + 1, y, s.w - 2, 1); R(g, P.seam, s.x + ((((y - s.y) / 6) | 0) % 2 ? 4 : 9), y + 1, 1, Math.min(5, s.y + topH - y - 2)); }
  // mặt trước: gạch xếp so le
  for (let r = 0; r < face; r += 3) {
    if (r + 2 < face) R(g, P.fseam, s.x, s.y + topH + r + 2, s.w, 1);
    for (let x = s.x + (((r / 3) | 0) % 2 ? 4 : 0); x < s.x + s.w; x += 8) R(g, P.fseam, x, s.y + topH + r, 1, Math.min(2, face - r));
  }
  // vá gạch lộ ra / vết bong tróc
  const n = Math.max(1, (s.w * s.h / 260) | 0);
  for (let i = 0; i < n; i++) {
    const px = s.x + 2 + rg() * Math.max(1, s.w - 9), py = s.y + 1 + rg() * Math.max(1, s.h - 5), bw = 3 + ((rg() * 4) | 0);
    R(g, P.brick, px, py, bw, 2); R(g, P.chip, px, py + 2, bw, 1);
  }
  if (P.lab) {   // viền xanh ngọc + ô cửa kính
    R(g, "#2fc9b8", s.x, s.y + topH + 1, s.w, 1);
    if (horiz && s.w > 50) { const wx = s.x + 10 + ((rg() * (s.w - 34)) | 0); R(g, "#12303a", wx, s.y + topH + 2, 14, Math.max(2, face - 4)); R(g, "#7ae0e0", wx + 1, s.y + topH + 2, 4, 1); }
  } else if (rg() < 0.55) R(g, P.moss, s.x + rg() * Math.max(1, s.w - 8), s.y + s.h - 3, 4 + ((rg() * 5) | 0), 2);
  if (s.crumble || s.low) {   // đoạn sứt mẻ: mảnh vụn trên đỉnh + vết khuyết
    for (let k = 0; k < 3; k++) { R(g, P.chip, s.x + rg() * Math.max(1, s.w - 6), s.y, 4, 2); }
    for (let k = 0; k < 4; k++) R(g, P.rubble, s.x + rg() * Math.max(1, s.w - 4), s.y - 2 + ((rg() * 2) | 0), 3, 2);
    if (s.low) R(g, "rgba(0,0,0,0.25)", s.x, s.y, s.w, topH);
  }
  R(g, "rgba(0,0,0,0.3)", s.x, s.y + s.h - 1, s.w, 1);
  for (let k = 0; k < 2; k++) R(g, P.rubble, s.x + rg() * s.w, s.y + s.h, 3, 2);   // vụn gạch dưới chân tường
}
SOLID_STYLES.ruinWall = (g, s) => drawWallBlock(g, s, WALL_PAL.town);
SOLID_STYLES.labWall = (g, s) => drawWallBlock(g, s, WALL_PAL.lab);

// ---------- Xe hơi cháy ----------
SOLID_STYLES.car = (g, s) => {
  const rg = rngOf(s), x = s.x, y = s.y, w = s.w, h = s.h;
  const pal = [["#6a2a24", "#8c3a30"], ["#2a4260", "#3c5a80"], ["#5a5a54", "#78786e"], ["#6a5a22", "#8c7830"]][(rg() * 4) | 0];
  const body = shade(pal[0], -0.4), mid = shade(pal[1], -0.4);
  R(g, OUT, x - 1, y - 1, w + 2, h + 1);
  R(g, mid, x, y, w, 9);                                       // mặt trên: capo - mui - cốp
  R(g, body, x, y + 9, w, 6);                                  // thân bên
  R(g, shade(mid, -0.5), x + 11, y + 1, w - 22, 7);            // mui cháy đen
  R(g, "#0e1216", x + 9, y + 1, 3, 7); R(g, "#0e1216", x + w - 12, y + 1, 3, 7);   // kính chắn gió / sau
  R(g, "#0e1216", x + 11, y + 10, w - 22, 3); R(g, "#2a4050", x + 12, y + 10, 4, 1);   // cửa sổ bên
  R(g, shade(body, -0.5), x + (w >> 1), y + 9, 1, 6);          // khe cửa
  R(g, "#1a1412", x + 2, y + 2, 6, 5);                         // capo mở, đen sì
  R(g, "#ff6a1e", x + 3, y + 5, 2, 1); R(g, "#ffc23d", x + 4, y + 5, 1, 1);      // than hồng
  R(g, "#2a2a2e", x, y + 13, 3, 2); R(g, "#2a2a2e", x + w - 3, y + 13, 3, 2);     // cản
  R(g, "#08080a", x + 3, y + 14, 8, 4); R(g, "#08080a", x + w - 11, y + 14, 8, 4);  // bánh xe
  R(g, "#3a3a40", x + 6, y + 15, 2, 2); R(g, "#3a3a40", x + w - 8, y + 15, 2, 2);
  R(g, mid, x, y, w, 1); R(g, shade(mid, 0.25), x + 12, y, w - 24, 1);
  for (let i = 0; i < 5; i++) R(g, rg() < 0.5 ? "#8a4a24" : "#0c0a0a", x + 2 + rg() * (w - 6), y + rg() * 13, 2 + ((rg() * 3) | 0), 1 + ((rg() * 2) | 0));   // gỉ + muội
};

// ---------- Bao cát ----------
SOLID_STYLES.sandbag = (g, s) => {
  const rg = rngOf(s), bw = 9, bh = 6;
  R(g, OUT, s.x - 1, s.y - 1, s.w + 2, s.h + 2);
  for (let ry = 0, row = 0; ry < s.h; ry += bh, row++) {
    const hh = Math.min(bh, s.h - ry);
    for (let rx = row % 2 ? -4 : 0; rx < s.w; rx += bw) {
      const x0 = Math.max(0, rx), x1 = Math.min(s.w, rx + bw), w2 = x1 - x0;
      if (w2 < 3) continue;
      const t = rg(), base = t < 0.4 ? "#b09a6a" : t < 0.75 ? "#a18c5e" : "#bba878";
      R(g, "#5a4a2e", s.x + x0, s.y + ry, w2, hh);
      R(g, base, s.x + x0, s.y + ry, w2 - 1, Math.max(1, hh - 1));
      R(g, "#d8c690", s.x + x0 + 1, s.y + ry, Math.max(1, w2 - 3), 1);
      if (hh > 3) R(g, "#7a6844", s.x + x0 + (w2 >> 1), s.y + ry + (hh >> 1), 2, 1);
    }
  }
  R(g, "rgba(0,0,0,0.3)", s.x, s.y + s.h - 1, s.w, 1);
};

// ---------- Container ----------
const CONT_PAL = [
  ["#4f6f4a", "#6a8e62", "#33492f"],   // xanh rêu
  ["#c0702a", "#e08a3a", "#7a4418"],   // cam
  ["#4a6082", "#6a84aa", "#2e3e58"],   // xanh xám
  ["#8a3a2c", "#aa5240", "#5a241a"],   // đỏ gạch
];
SOLID_STYLES.container = (g, s) => {
  const rg = rngOf(s), horiz = s.w >= s.h, [d, m, k] = CONT_PAL[(((s.seed ?? 0) * 997) | 0) % CONT_PAL.length];
  const face = horiz ? 9 : 10, topH = s.h - face;
  R(g, OUT, s.x - 1, s.y - 1, s.w + 2, s.h + 2);
  R(g, m, s.x, s.y, s.w, topH);
  R(g, d, s.x, s.y + topH, s.w, face);
  if (horiz) { for (let x = s.x + 2; x < s.x + s.w - 1; x += 4) R(g, shade(m, -0.22), x, s.y + 2, 1, topH - 3); }     // gân tôn trên mặt
  else for (let y = s.y + 3; y < s.y + topH - 1; y += 4) R(g, shade(m, -0.22), s.x + 2, y, s.w - 4, 1);
  if (horiz) for (let x = s.x + 2; x < s.x + s.w - 1; x += 4) { R(g, k, x, s.y + topH + 1, 1, face - 2); R(g, shade(d, 0.18), x + 1, s.y + topH + 1, 1, face - 2); }
  else {   // đầu container: 2 cánh cửa + thanh khóa
    R(g, k, s.x + (s.w >> 1), s.y + topH + 1, 1, face - 2);
    for (const dx of [s.x + 6, s.x + s.w - 7]) R(g, "#c8c8c0", dx, s.y + topH + 1, 1, face - 3);
    R(g, "#e8e8e0", s.x + (s.w >> 1) - 2, s.y + topH + 4, 1, 2); R(g, "#e8e8e0", s.x + (s.w >> 1) + 2, s.y + topH + 4, 1, 2);
  }
  R(g, shade(m, 0.3), s.x, s.y, s.w, 1); R(g, shade(m, 0.2), s.x, s.y, 1, topH);
  R(g, k, s.x, s.y, 3, 3); R(g, k, s.x + s.w - 3, s.y, 3, 3); R(g, k, s.x, s.y + s.h - 3, 3, 3); R(g, k, s.x + s.w - 3, s.y + s.h - 3, 3, 3);   // cạnh góc
  if (horiz) { const lx = s.x + 6 + ((rg() * (s.w - 30)) | 0); R(g, "#e8e8e0", lx, s.y + topH + 3, 8, 1); R(g, "#e8e8e0", lx, s.y + topH + 5, 5, 1); }   // số hiệu
  for (let i = 0; i < 3; i++) R(g, "#6a3a1c", s.x + 3 + rg() * (s.w - 8), s.y + 1 + rg() * (s.h - 4), 1, 3 + ((rg() * 3) | 0));   // vệt gỉ
  R(g, "rgba(0,0,0,0.3)", s.x, s.y + s.h - 1, s.w, 1);
};

// ---------- Chân tháp canh ----------
SOLID_STYLES.watchtower = (g, s) => {
  const x = s.x, y = s.y, w = s.w, h = s.h, deck = h - 14;
  R(g, OUT, x - 1, y - 1, w + 2, deck + 2);
  R(g, "#8a6a40", x, y, w, deck);                                                // sàn gỗ trên cao
  for (let yy = y + 3; yy < y + deck - 1; yy += 4) R(g, "#6a4e2c", x + 1, yy, w - 2, 1);
  R(g, "#a8844e", x, y, w, 1);
  R(g, "#2a2a30", x, y + deck - 4, w, 4); R(g, "#5a5a66", x, y + deck - 4, w, 1);   // lan can trước
  for (let xx = x + 2; xx < x + w; xx += 6) R(g, "#14141a", xx, y + deck - 3, 2, 3);
  R(g, "#b09a6a", x + 2, y + 2, 9, 5); R(g, "#7a6844", x + 2, y + 6, 9, 1);        // bao cát trên sàn
  R(g, "#3a3a44", x + w - 10, y + 3, 6, 5); R(g, "#ffe9a8", x + w - 9, y + 4, 2, 2);   // đèn pha
  // 4 chân thép + giằng chéo bên dưới sàn
  R(g, "#14181c", x, y + deck, w, 14);
  for (const lx of [x + 1, x + w - 5]) { R(g, "#4a5058", lx, y + deck, 4, 13); R(g, "#7a828c", lx, y + deck, 1, 13); }
  for (let i = 0; i < 10; i++) { R(g, "#3a4048", x + 5 + ((i * (w - 12)) / 10 | 0), y + deck + 1 + i, 2, 1); R(g, "#3a4048", x + w - 7 - ((i * (w - 12)) / 10 | 0), y + deck + 1 + i, 2, 1); }
  R(g, "#6a6a66", x - 1, y + h - 2, w + 2, 2);                                   // bệ bê tông
  for (let r = deck + 2; r < h - 1; r += 3) R(g, "#8a6a40", x + (w >> 1) - 1, y + r, 3, 1);   // thang
};

// ---------- Rào chắn bê tông ----------
SOLID_STYLES.barrier = (g, s) => {
  R(g, OUT, s.x - 1, s.y - 1, s.w + 2, s.h + 2);
  const face = Math.min(6, s.h >> 1);
  R(g, "#9a9a96", s.x, s.y, s.w, s.h - face);
  R(g, "#6e6e6a", s.x, s.y + s.h - face, s.w, face);
  R(g, "#c8c8c2", s.x, s.y, s.w, 1);
  for (let x = s.x + 2; x < s.x + s.w - 4; x += 8) { R(g, "#c0392b", x, s.y + s.h - face, 4, face); R(g, "#e8e8e0", x + 4, s.y + s.h - face, 4, face); }
  R(g, "rgba(0,0,0,0.3)", s.x, s.y + s.h - 1, s.w, 1);
};

// ---------- Hàng rào sắt (nghĩa trang) ----------
SOLID_STYLES.fence = (g, s) => {
  const horiz = s.w >= s.h;
  if (horiz) {
    R(g, "#14141a", s.x, s.y + 2, s.w, 2); R(g, "#14141a", s.x, s.y + s.h - 2, s.w, 2);       // thanh ngang
    for (let x = s.x + 1; x < s.x + s.w - 1; x += 6) { R(g, "#1a1a20", x, s.y - 7, 2, s.h + 7); R(g, "#5a5a66", x, s.y - 7, 1, s.h + 6); R(g, "#8a8a98", x, s.y - 9, 1, 2); }
    R(g, "#5a5a66", s.x, s.y + 2, s.w, 1);
  } else {
    for (let y = s.y + 1; y < s.y + s.h - 2; y += 7) { R(g, "#1a1a20", s.x, y - 6, s.w, 8); R(g, "#5a5a66", s.x + 1, y - 6, 1, 7); R(g, "#8a8a98", s.x + 1, y - 8, 1, 2); }
    R(g, "#14141a", s.x + 1, s.y - 2, 1, s.h + 2);
  }
};

// ---------- Bàn thí nghiệm ----------
SOLID_STYLES.labBench = (g, s) => {
  const rg = rngOf(s), face = 8, topH = s.h - face;
  R(g, OUT, s.x - 1, s.y - 1, s.w + 2, s.h + 2);
  R(g, "#dde8ea", s.x, s.y, s.w, topH); R(g, "#ffffff", s.x, s.y, s.w, 1);
  R(g, "#8aa4aa", s.x, s.y, 1, topH); R(g, "#8aa4aa", s.x + s.w - 1, s.y, 1, topH); R(g, "#a8c0c4", s.x, s.y + topH - 1, s.w, 1);
  R(g, "#5e7880", s.x, s.y + topH, s.w, face);
  for (let x = s.x; x < s.x + s.w - 2; x += 14) { R(g, "#46606a", x, s.y + topH + 1, 1, face - 1); R(g, "#c8d8dc", x + 5, s.y + topH + 3, 3, 1); }
  R(g, "#2a3a40", s.x + 1, s.y + s.h - 2, 3, 2); R(g, "#2a3a40", s.x + s.w - 4, s.y + s.h - 2, 3, 2);
  const n = Math.max(2, (s.w / 16) | 0);
  for (let i = 0; i < n; i++) {   // đồ thí nghiệm trên bàn
    const ix = s.x + 4 + i * ((s.w - 10) / n), t = rg(), liq = pick(["#3aff9a", "#c46cff", "#ff7a5a", "#5ab4ff"]);
    if (t < 0.5) { R(g, "#9fe8e0", ix, s.y + 2, 4, 6); R(g, liq, ix, s.y + 5, 4, 3); R(g, "#ffffff", ix, s.y + 2, 1, 4); }          // bình
    else if (t < 0.8) { R(g, "#1c2a30", ix, s.y + 2, 8, 6); R(g, "#3aff6a", ix + 1, s.y + 3, 6, 3); R(g, "#2a3a40", ix + 3, s.y + 8, 2, 1); }   // màn hình
    else { R(g, "#3a3a44", ix, s.y + 2, 3, 7); R(g, "#6a6a76", ix - 1, s.y + 2, 5, 2); R(g, "#2a2a30", ix - 1, s.y + 8, 5, 1); }       // kính hiển vi
  }
};

// ---------- Tủ máy chủ ----------
SOLID_STYLES.serverRack = (g, s) => {
  const rg = rngOf(s), top = 8;
  R(g, OUT, s.x - 1, s.y - 1, s.w + 2, s.h + 2);
  R(g, "#505662", s.x, s.y, s.w, top); R(g, "#7a8290", s.x, s.y, s.w, 1);
  R(g, "#1c2026", s.x, s.y + top, s.w, s.h - top);
  for (let yy = s.y + top + 2, i = 0; yy < s.y + s.h - 4; yy += 5, i++) {
    R(g, "#2c323c", s.x + 2, yy, s.w - 4, 4);
    R(g, "#14181e", s.x + 3, yy + 2, s.w - 11, 1);
    R(g, pick(["#3aff6a", "#3aff6a", "#ffb02a", "#ff4a3a"]), s.x + s.w - 6, yy + 1, 2, 1);
    if (rg() < 0.4) R(g, "#5ab4ff", s.x + s.w - 9, yy + 1, 1, 1);
  }
  R(g, "#3a424e", s.x, s.y + top, 1, s.h - top); R(g, "#0e1014", s.x + s.w - 1, s.y + top, 1, s.h - top);
  R(g, "#0e1014", s.x + 3, s.y + s.h - 3, s.w - 6, 2);
};

// =====================================================================================
//  ĐỒ TRANG TRÍ SÀN RIÊNG CỦA TỪNG KHU
// =====================================================================================
const XD = {
  trash(g, x, y) { for (let i = 0; i < 4; i++) R(g, pick(["#8a8a82", "#c8c0a8", "#3a5a7a", "#7a3a2a"]), x + randInt(-5, 5), y + randInt(-3, 3), randInt(1, 3), randInt(1, 2)); },
  rubble(g, x, y) { for (let i = 0; i < 6; i++) { const px = x + randInt(-6, 6), py = y + randInt(-3, 3); R(g, "rgba(0,0,0,0.3)", px, py + 1, 3, 1); R(g, pick(["#7a6c5a", "#5a4e40", "#9a8c78", "#a05a3c"]), px, py, randInt(2, 4), randInt(1, 2)); } },
  weeds(g, x, y) { for (let i = -3; i <= 3; i++) R(g, pick(["#4a6a34", "#5e8444", "#3a5428"]), x + i, y - randInt(1, 4), 1, randInt(2, 4)); },
  blood(g, x, y) { g.fillStyle = "rgba(90,12,14,0.55)"; ellipse(g, x, y, randInt(3, 7), randInt(2, 3)); R(g, "rgba(140,20,22,0.5)", x - 2, y - 1, 3, 1); },
  oil(g, x, y) { g.fillStyle = "rgba(14,16,20,0.4)"; ellipse(g, x, y, randInt(5, 11), randInt(3, 6)); R(g, "rgba(120,160,200,0.18)", x - 3, y - 1, 3, 1); },
  casings(g, x, y) { for (let i = 0; i < 5; i++) R(g, "#c8a23a", x + randInt(-7, 7), y + randInt(-4, 4), 2, 1); },
  glass(g, x, y) { for (let i = 0; i < 6; i++) { const px = x + randInt(-8, 8), py = y + randInt(-4, 4); R(g, pick(["#c8f4f0", "#8adcd8", "#ffffff"]), px, py, randInt(1, 2), 1); } },
  stain(g, x, y) { g.fillStyle = pick(["rgba(40,70,60,0.35)", "rgba(70,90,40,0.3)", "rgba(30,40,50,0.3)"]); ellipse(g, x, y, randInt(5, 12), randInt(3, 6)); },
  paper(g, x, y) { R(g, "#e8e8dc", x, y, 4, 3); R(g, "#a8a89c", x + 1, y + 1, 2, 1); },
  slime(g, x, y) { g.fillStyle = "rgba(80,200,60,0.5)"; ellipse(g, x, y, randInt(3, 6), randInt(2, 3)); R(g, "#b8ff8a", x - 1, y - 1, 2, 1); },
  grassTuft(g, x, y) { for (let i = -2; i <= 2; i++) R(g, pick(["#46583a", "#566a46", "#384a2e"]), x + i, y - randInt(1, 3), 1, randInt(2, 4)); },
  moundGrave(g, x, y) { g.fillStyle = "rgba(20,16,12,0.5)"; ellipse(g, x, y, 8, 3); R(g, "#4a4238", x - 4, y - 1, 8, 2); },
};
const DECOR_BY_ZONE = {
  town: [["rubble", 3], ["trash", 3], ["weeds", 3], ["pebbles", 2], ["crack", 3], ["blood", 1], ["bones", 1], ["twig", 1]],
  military: [["oil", 3], ["casings", 3], ["pebbles", 2], ["crack", 4], ["rubble", 1]],
  grave: [["grassTuft", 5], ["bones", 2], ["skull", 1], ["flowerDead", 3], ["twig", 2], ["leaves", 3], ["pebbles", 1], ["crossSmall", 1], ["candle", 1]],
  lab: [["glass", 4], ["stain", 4], ["paper", 2], ["slime", 1], ["crack", 2], ["blood", 1]],
};
const DRAWERS = { ...DECOR_DRAW, ...XD };
function weightedPick(list) { let t = 0; for (const [, w] of list) t += w; let r = Math.random() * t; for (const [k, w] of list) { r -= w; if (r <= 0) return k; } return list[0][0]; }

// =====================================================================================
//  ExtractionWorld
// =====================================================================================
const ROAD_W = 110;

export class ExtractionWorld extends World {
  constructor(images = {}) {
    Object.assign(WORLD, EXTRACT_WORLD);   // đổi kích thước thế giới TRƯỚC khi World dựng lưới / canvas nền
    super(EXTRACT_BIOME, images);
  }

  // ---------------------------------------------------------------- tiện ích sinh bản đồ
  zoneAt(x, y) {
    const l = x < WORLD.w / 2, t = y < WORLD.h / 2;
    return this.zones[t ? (l ? 0 : 1) : (l ? 2 : 3)];
  }
  zoneById(id) { return this.zones.find((z) => z.id === id); }

  /** Vùng đi lại của 1 khu (trừ tường bao + nửa đường + lề m) */
  inner(zid, m = 0) {
    const W = WORLD, cx = W.w / 2, cy = W.h / 2, hw = ROAD_W / 2;
    const left = zid === "town" || zid === "grave", top = zid === "town" || zid === "military";
    const x0 = (left ? W.wall : cx + hw) + m, x1 = (left ? cx - hw : W.w - W.wall) - m;
    const y0 = (top ? W.wallTop : cy + hw) + m, y1 = (top ? cy - hw : W.h - W.wall) - m;
    return { x: x0, y: y0, w: Math.max(0, x1 - x0), h: Math.max(0, y1 - y0) };
  }
  onRoad(x, y, m = 0) { return this.roads.some((r) => x > r.x - m && x < r.x + r.w + m && y > r.y - m && y < r.y + r.h + m); }
  reserve(x, y, r) { this._res.push({ x, y, r }); }
  clearOfRes(x, y, r) { return this._res.every((q) => (q.x - x) ** 2 + (q.y - y) ** 2 >= (q.r + r) ** 2); }
  resHitRect(rc) { return this._res.some((q) => circleRect(q.x, q.y, q.r, rc)); }

  /** Tìm chỗ đặt hình chữ nhật w x h trong vùng R, không chồng vật cản / công trình / vùng cấm */
  findSpot(Rr, w, h, gap = 24, tries = 80, useBlocks = true) {
    if (Rr.w < w || Rr.h < h) return null;
    for (let t = 0; t < tries; t++) {
      const r = { x: randInt(Rr.x, Rr.x + Rr.w - w), y: randInt(Rr.y, Rr.y + Rr.h - h), w, h }, g = inflate(r, gap);
      if (this.resHitRect(inflate(r, 4))) continue;
      if (this.solids.some((s) => !s.wall && rectOverlap(g, s))) continue;
      if (useBlocks && this.blocks.some((b) => rectOverlap(g, b))) continue;
      if (this.pools.some((p) => circleRect(p.x, p.y, p.r + 12, r))) continue;
      return r;
    }
    return null;
  }
  place(zid, w, h, gap = 24, tries = 80) { return this.findSpot(this.inner(zid, 34), w, h, gap, tries); }
  addSolid(r, style, extra = {}) { r.style = style; r.seed = Math.random(); Object.assign(r, extra); this.solids.push(r); return r; }

  /** Khung tường chữ nhật có cửa (gates = [[cạnh, độ rộng]]) và đoạn tường sập. Trả về thông tin khung. */
  buildFrame(x, y, w, h, t, style, gates, collapse = 0.5) {
    const sides = ["top", "bottom", "left", "right"], gaps = { top: [], bottom: [], left: [], right: [] }, holes = [];
    const addGap = (side, len, collapsed) => {
      const horiz = side === "top" || side === "bottom", L = horiz ? w : h - 2 * t, pad = horiz ? t + 8 : 8;
      const lo = pad, hi = L - len - pad;
      if (hi <= lo) return;
      for (let k = 0; k < 8; k++) {
        const st = randInt(lo, hi);
        if (gaps[side].every((q) => st > q.st + q.len + 14 || st + len + 14 < q.st)) { gaps[side].push({ st, len, collapsed }); return; }
      }
    };
    for (const [side, len] of gates) addGap(side, len, false);
    if (Math.random() < collapse) addGap(pick(sides), randInt(56, 84), true);
    const segs = [];
    for (const side of sides) {
      const horiz = side === "top" || side === "bottom", L = horiz ? w : h - 2 * t;
      const emit = (a, b) => {
        if (b - a < 10) return;
        const r = horiz ? { x: x + a, y: side === "top" ? y : y + h - t, w: b - a, h: t } : { x: side === "left" ? x : x + w - t, y: y + t + a, w: t, h: b - a };
        this.addSolid(r, style, { crumble: Math.random() < 0.3, low: style === "ruinWall" && Math.random() < 0.12 });
        segs.push(r);
      };
      let cur = 0;
      for (const gp of gaps[side].slice().sort((p, q) => p.st - q.st)) {
        emit(cur, gp.st); cur = gp.st + gp.len;
        holes.push({ collapsed: gp.collapsed, x: horiz ? x + gp.st : (side === "left" ? x : x + w - t), y: horiz ? (side === "top" ? y : y + h - t) : y + t + gp.st, w: horiz ? gp.len : t, h: horiz ? t : gp.len });
      }
      emit(cur, L);
    }
    return { x, y, w, h, t, segs, holes, inner: { x: x + t, y: y + t, w: w - 2 * t, h: h - 2 * t } };
  }

  // ---------------------------------------------------------------- SINH BẢN ĐỒ
  generate() {
    const W = WORLD, cx = W.w / 2, cy = W.h / 2, hw = ROAD_W / 2;
    this.solids.push(
      { x: 0, y: 0, w: W.w, h: W.wallTop, wall: true },
      { x: 0, y: W.h - W.wall, w: W.w, h: W.wall, wall: true },
      { x: 0, y: 0, w: W.wall, h: W.h, wall: true },
      { x: W.w - W.wall, y: 0, w: W.wall, h: W.h, wall: true },
    );
    this.spawn = { x: cx, y: cy };
    this.roads = [
      { x: cx - hw, y: W.wallTop, w: ROAD_W, h: W.h - W.wall - W.wallTop },   // dọc
      { x: W.wall, y: cy - hw, w: W.w - W.wall * 2, h: ROAD_W },                // ngang
    ];
    const rects = [{ x: 0, y: 0, w: cx, h: cy }, { x: cx, y: 0, w: W.w - cx, h: cy }, { x: 0, y: cy, w: cx, h: W.h - cy }, { x: cx, y: cy, w: W.w - cx, h: W.h - cy }];
    this.zones = ZONES.map((z, i) => ({ ...z, rect: rects[i] }));
    this._res = [];            // vùng cấm tròn { x, y, r }
    this.blocks = [];          // khu công trình (nhà, trại, nghĩa địa, phòng lab) — đồ lẻ không đặt chồng lên
    this.houses = []; this.slabs = []; this.plots = []; this.labRooms = []; this.lamps = [];
    this.hot = { town: [], military: [], grave: [], lab: [] };   // chỗ ưu tiên đặt đồ nhặt
    this.reserve(cx, cy, 150);

    this.genSpecials();
    this.genTown(); this.genMilitary(); this.genGrave(); this.genLab();
    this.genHazards();
    this.genLoot();
    this.genSquads();
    this.genProps();
    this.genLights();
    this._res = null;
  }

  // ---- điểm đặc biệt: bãi đáp, bãi rút quân, điểm nhiệm vụ
  genSpecials() {
    const W = WORLD, cx = W.w / 2, cy = W.h / 2;
    const farFrom = (x, y, list, d) => list.every((p) => (p.x - x) ** 2 + (p.y - y) ** 2 >= d * d);
    const pickPoint = (zid, m, ok, tries = 500) => {
      const Rr = this.inner(zid, m);
      for (let i = 0; i < tries; i++) {
        const x = rand(Rr.x, Rr.x + Rr.w), y = rand(Rr.y, Rr.y + Rr.h);
        if (ok(x, y)) return { x: Math.round(x), y: Math.round(y) };
      }
      return null;
    };
    // --- 6 bãi đáp (2 trên đường)
    const L = this.landingZones = [];
    const addL = (x, y, name) => { L.push({ x, y, zone: this.zoneAt(x, y).id, name }); this.reserve(x, y, 66); };
    addL(cx, randInt(380, 780), "Đường Chính Bắc");
    addL(randInt(420, 1000), cy, "Đường Chính Tây");
    for (const [zid, name] of [["town", "Bãi Đỗ Xe Bắc"], ["town", "Quảng Trường Cũ"], ["military", "Sân Bê Tông"], ["lab", "Sân Thí Nghiệm"]]) {
      const p = pickPoint(zid, 150, (x, y) => farFrom(x, y, L, 560) && !this.onRoad(x, y, 70));
      if (p) addL(p.x, p.y, name);
    }
    // --- 3 bãi rút quân gần mép (cách tường 120–260), mỗi khu khác nhau
    const pads = this.extractPads = [], padZones = ["town", "military", "grave", "lab"].sort(() => Math.random() - 0.5).slice(0, 3);
    for (const zid of padZones) {
      const p = pickPoint(zid, 80, (x, y) => {
        const dw = Math.min(x - W.wall, W.w - W.wall - x, y - W.wallTop, W.h - W.wall - y);
        return dw >= 120 && dw <= 260 && !this.onRoad(x, y, 80) && farFrom(x, y, pads, 900) && farFrom(x, y, L, 320) && this.clearOfRes(x, y, 80);
      }, 800);
      if (p) { pads.push(p); this.reserve(p.x, p.y, 76); p.zone = zid; }
    }
    // --- điểm nhiệm vụ (trống bán kính >= 70, cách nhau >= 400)
    const M = this.missionSites = { outpost: [], rescue: [], hive: [], tower: [] }, allM = [];
    const plan = [["outpost", "military", 3], ["rescue", "town", 2], ["rescue", "grave", 1], ["hive", "lab", 1], ["hive", "grave", 1], ["tower", "lab", 1], ["tower", "military", 1]];
    for (const [kind, zid, n] of plan) {
      for (let k = 0; k < n; k++) {
        const ok = (d) => (x, y) => !this.onRoad(x, y, 90) && farFrom(x, y, allM, d) && farFrom(x, y, L, 280) && farFrom(x, y, pads, 260) && this.clearOfRes(x, y, 72);
        const p = pickPoint(zid, 130, ok(420)) ?? pickPoint(zid, 130, ok(400)) ?? pickPoint(zid, 120, ok(400), 1500);
        if (p) { M[kind].push(p); allM.push(p); this.reserve(p.x, p.y, 74); }
      }
    }
  }

  // ---- Khu dân cư: nhà đổ nát, xe cháy
  genTown() {
    let placed = 0;
    for (let i = 0; i < 160 && placed < 11; i++) {
      const w = randInt(9, 15) * 16, h = randInt(8, 12) * 16, r = this.place("town", w, h, 44, 30);
      if (!r) continue;
      const gates = [["bottom", 48]];
      if (Math.random() < 0.7) gates.push([pick(["top", "left", "right"]), 44]);
      const f = this.buildFrame(r.x, r.y, w, h, 14, "ruinWall", gates, 0.55);
      f.tone = Math.random() < 0.35 ? "tile" : "wood";
      this.houses.push(f); this.blocks.push(inflate(r, 6)); this.hot.town.push(f.inner);
      placed++;
    }
    for (let i = 0, n = 0; i < 120 && n < 13; i++) {   // xe hơi cháy rải rác
      const r = this.place("town", 34, 18, 22, 30);
      if (r) { this.addSolid(r, "car"); this.blocks.push(inflate(r, 4)); n++; }
    }
  }

  // ---- Trạm quân sự: trại bao cát, container, tháp canh, chốt chặn
  genMilitary() {
    for (const [cw, ch] of [[350, 250], [300, 230]]) {
      const r = this.place("military", cw, ch, 50, 60);
      if (!r) continue;
      const gates = [["bottom", 56], ["top", 56]];
      if (Math.random() < 0.6) gates.push([pick(["left", "right"]), 52]);
      this.buildFrame(r.x, r.y, cw, ch, 12, "sandbag", gates, 0);
      const inner = { x: r.x + 12, y: r.y + 12, w: cw - 24, h: ch - 24 };
      this.slabs.push(r); this.blocks.push(inflate(r, 6)); this.hot.military.push(inner);
      for (const tx of [inner.x + 4, inner.x + inner.w - 34]) this.addSolid({ x: tx, y: inner.y + 4, w: 30, h: 30 }, "watchtower");
      const mid = { x: inner.x + 10, y: inner.y + 44, w: inner.w - 20, h: inner.h - 54 };
      for (let k = 0, n = 0; k < 14 && n < 4; k++) {
        const horiz = Math.random() < 0.6, w = horiz ? 64 : 28, h = horiz ? 28 : 64, c = this.findSpot(mid, w, h, 30, 40, false);
        if (c) { this.addSolid(c, "container"); n++; }
      }
    }
    // container lẻ, bao cát che chắn, tháp canh đơn, chốt chặn bê tông
    for (let i = 0, n = 0; i < 100 && n < 10; i++) {
      const horiz = Math.random() < 0.6, w = horiz ? 64 : 28, h = horiz ? 28 : 64, r = this.place("military", w, h, 40, 30);
      if (r) { this.addSolid(r, "container"); this.blocks.push(inflate(r, 4)); n++; }
    }
    for (let i = 0, n = 0; i < 160 && n < 14; i++) {
      const horiz = Math.random() < 0.5, r = this.place("military", horiz ? 44 : 12, horiz ? 12 : 44, 30, 30);
      if (!r) continue;
      this.addSolid(r, "sandbag"); n++;
      if (Math.random() < 0.6) {   // cánh chữ L
        const wing = horiz ? { x: r.x, y: r.y + 12, w: 12, h: 28 } : { x: r.x + 12, y: r.y, w: 28, h: 12 };
        if (!this.resHitRect(wing) && !this.solids.some((s) => !s.wall && s !== r && rectOverlap(inflate(wing, 8), s))) this.addSolid(wing, "sandbag");
      }
      this.blocks.push(inflate(r, 8));
    }
    for (let i = 0, n = 0; i < 40 && n < 2; i++) {
      const r = this.place("military", 30, 30, 70, 30);
      if (r) { this.addSolid(r, "watchtower"); this.blocks.push(inflate(r, 6)); n++; }
    }
    for (const zy of [[this.inner("military").y + 140, this.inner("military").y + 420], [this.inner("military").y + 640, this.inner("military").y + 880]]) {   // chốt chặn cạnh đường dọc
      const bx = WORLD.w / 2 + ROAD_W / 2 + 14, by = randInt(zy[0], zy[1]);
      for (const oy of [0, 96]) {
        const b = { x: bx, y: by + oy, w: 30, h: 12 };
        if (!this.resHitRect(b) && !this.solids.some((s) => !s.wall && rectOverlap(inflate(b, 10), s))) this.addSolid(b, "barrier");
      }
    }
  }

  // ---- Nghĩa trang: khu mộ có hàng rào, hầm mộ, bia mộ lẻ, bàn tay ma
  genGrave() {
    const I = this.inner("grave", 34);
    for (const [pw, ph] of [[330, 230], [290, 210], [260, 210]]) {
      const r = this.place("grave", pw, ph, 46, 60);
      if (!r) continue;
      this.plots.push(r); this.blocks.push(inflate(r, 6)); this.hot.grave.push(r);
      // hàng rào quanh khu mộ, mở 2 cổng
      const fh = 8;
      const gate = (len, gx) => [gx, gx + len];
      const wallRun = (x0, y0, len, horiz, gaps) => {
        let cur = 0;
        for (const [a, b] of gaps.concat([[len, len]])) { if (a - cur > 6) this.addSolid(horiz ? { x: x0 + cur, y: y0, w: a - cur, h: fh } : { x: x0, y: y0 + cur, w: 6, h: a - cur }, "fence"); cur = b; }
      };
      wallRun(r.x, r.y, pw, true, [gate(52, randInt(30, pw - 90))]);
      wallRun(r.x, r.y + ph - fh, pw, true, [gate(52, randInt(30, pw - 90))]);
      wallRun(r.x, r.y + fh, ph - fh * 2, false, Math.random() < 0.5 ? [gate(48, randInt(24, ph - 90))] : []);
      wallRun(r.x + pw - 6, r.y + fh, ph - fh * 2, false, Math.random() < 0.5 ? [gate(48, randInt(24, ph - 90))] : []);
      // hàng bia mộ
      for (let gy = r.y + 36, row = 0; gy < r.y + ph - 36; gy += 46, row++) {
        for (let gx = r.x + 30; gx < r.x + pw - 40; gx += 38) {
          if (Math.random() < 0.18) continue;
          const g1 = { x: gx + randInt(-2, 2), y: gy + randInt(-2, 2), w: randInt(4, 5) * 4, h: 12 };
          if (row === 0 && Math.random() < 0.22 && gx + 56 < r.x + pw - 20) this.addSolid({ x: gx, y: gy - 6, w: 52, h: 38 }, "crypt"), gx += 22;
          else if (!this.resHitRect(g1)) this.addSolid(g1, "grave");
        }
      }
    }
    // hầm mộ lẻ + bia mộ rải rác
    for (let i = 0, n = 0; i < 80 && n < 8; i++) {
      const w = randInt(12, 16) * 4, h = randInt(9, 11) * 4, r = this.place("grave", w, h, 46, 30);
      if (r) { this.addSolid(r, "crypt"); this.blocks.push(inflate(r, 4)); n++; }
    }
    for (let i = 0, n = 0; i < 220 && n < 40; i++) {
      const r = this.place("grave", randInt(4, 5) * 4, 12, 34, 20);
      if (r) { this.addSolid(r, "grave"); n++; }
    }
    void I;
  }

  // ---- Phòng thí nghiệm: 2 toà nhà, bàn thí nghiệm, tủ máy chủ
  genLab() {
    for (const [lw, lh] of [[320, 230], [270, 210]]) {
      const r = this.place("lab", lw, lh, 50, 60);
      if (!r) continue;
      const gates = [["bottom", 52], ["top", 52]];
      if (Math.random() < 0.7) gates.push([pick(["left", "right"]), 50]);
      const f = this.buildFrame(r.x, r.y, lw, lh, 12, "labWall", gates, 0.25);
      this.labRooms.push(f.inner); this.blocks.push(inflate(r, 6)); this.hot.lab.push(f.inner);
      // vách ngăn giữa có cửa
      const px = f.inner.x + randInt(90, f.inner.w - 120), gy = f.inner.y + randInt(30, f.inner.h - 90);
      this.addSolid({ x: px, y: f.inner.y, w: 10, h: gy - f.inner.y }, "labWall");
      this.addSolid({ x: px, y: gy + 54, w: 10, h: f.inner.y + f.inner.h - gy - 54 }, "labWall");
      // nội thất: bàn + tủ máy chủ
      const bounds = { x: f.inner.x + 8, y: f.inner.y + 8, w: f.inner.w - 16, h: f.inner.h - 16 };
      const avoid = (c) => !(c.x < px + 40 && c.x + c.w > px - 30);
      for (let k = 0, n = 0; k < 40 && n < 4; k++) { const c = this.findSpot(bounds, 56, 22, 26, 20, false); if (c && avoid(c)) { this.addSolid(c, "labBench"); n++; } }
      for (let k = 0, n = 0; k < 40 && n < 3; k++) { const c = this.findSpot(bounds, 22, 36, 24, 20, false); if (c && avoid(c)) { this.addSolid(c, "serverRack"); n++; } }
    }
    for (let i = 0, n = 0; i < 120 && n < 10; i++) { const r = this.place("lab", 56, 22, 34, 30); if (r) { this.addSolid(r, "labBench"); this.blocks.push(inflate(r, 4)); n++; } }
    for (let i = 0, n = 0; i < 100 && n < 6; i++) {   // hàng tủ máy chủ 3 cái
      const r = this.place("lab", 74, 36, 36, 30);
      if (!r) continue;
      for (let k = 0; k < 3; k++) this.addSolid({ x: r.x + k * 26, y: r.y, w: 22, h: 36 }, "serverRack");
      this.blocks.push(inflate(r, 4)); n++;
    }
  }

  // ---- bẫy môi trường: vũng axit (lab) + bàn tay ma (nghĩa trang)
  genHazards() {
    const okPt = (x, y, r) => !this.onRoad(x, y, r + 40) && this.clearOfRes(x, y, r + 6) && !this.solids.some((s) => circleRect(x, y, r + 8, s)) && !this.blocks.some((b) => circleRect(x, y, r, b));
    const Rl = this.inner("lab", 70);
    for (let i = 0, n = 0; i < 400 && n < 6; i++) {
      const r = randInt(22, 40), x = rand(Rl.x, Rl.x + Rl.w), y = rand(Rl.y, Rl.y + Rl.h);
      if (!okPt(x, y, r) || this.pools.some((p) => Math.hypot(p.x - x, p.y - y) < p.r + r + 60)) continue;
      this.pools.push({ x: Math.round(x), y: Math.round(y), r, seed: Math.random() * 100 }); n++;
    }
    const Rg = this.inner("grave", 90);
    for (let i = 0, n = 0; i < 500 && n < 6; i++) {
      const x = rand(Rg.x, Rg.x + Rg.w), y = rand(Rg.y, Rg.y + Rg.h);
      if (!okPt(x, y, 30) || this.onRoad(x, y, 150) || this.hands.some((h) => Math.hypot(h.x - x, h.y - y) < 260)) continue;
      this.hands.push({ x: Math.round(x), y: Math.round(y), phase: Math.random() * ENV.hands.period, fired: false }); n++;
    }
  }

  // ---- điểm nhặt đồ: 32 điểm (13 túi y tế, 19 thùng) rải đều 4 khu
  genLoot() {
    const out = this.lootSpots = [], per = { town: 8, military: 8, grave: 8, lab: 8 }, medPer = { town: 3, military: 3, grave: 4, lab: 3 };
    for (const z of this.zones) {
      const kinds = Array.from({ length: per[z.id] }, (_, i) => (i < medPer[z.id] ? "medbag" : "crate")).sort(() => Math.random() - 0.5);
      for (const kind of kinds) {
        for (let t = 0; t < 700; t++) {
          const hot = this.hot[z.id];
          let x, y;
          if (hot.length && Math.random() < 0.7) { const h = pick(hot); x = rand(h.x + 10, h.x + h.w - 10); y = rand(h.y + 10, h.y + h.h - 10); }
          else { const Rr = this.inner(z.id, 40); x = rand(Rr.x, Rr.x + Rr.w); y = rand(Rr.y, Rr.y + Rr.h); }
          if (this.onRoad(x, y, 20) || !this.isFree(x, y, 17) || !this.clearOfRes(x, y, 16)) continue;
          if (out.some((q) => (q.x - x) ** 2 + (q.y - y) ** 2 < 110 * 110)) continue;
          x = Math.round(x); y = Math.round(y);
          out.push({ x, y, kind, zone: z.id }); this.reserve(x, y, 14);
          break;
        }
      }
    }
  }

  // ---- 30 điểm tuần tra (7–8 mỗi khu)
  genSquads() {
    const out = this.squadSpawns = [], per = { town: 8, military: 7, grave: 8, lab: 7 };
    for (const z of this.zones) {
      let n = 0;
      for (let t = 0; t < 1800 && n < per[z.id]; t++) {
        const Rr = this.inner(z.id, 50), x = rand(Rr.x, Rr.x + Rr.w), y = rand(Rr.y, Rr.y + Rr.h), sp = t < 1200 ? 160 : 90;
        if (this.onRoad(x, y, 20) || !this.isFree(x, y, 34) || !this.clearOfRes(x, y, 30)) continue;
        if (this.landingZones.some((l) => (l.x - x) ** 2 + (l.y - y) ** 2 < 280 * 280)) continue;
        if (out.some((q) => (q.x - x) ** 2 + (q.y - y) ** 2 < sp * sp)) continue;
        out.push({ x: Math.round(x), y: Math.round(y), zone: z.id }); this.reserve(x, y, 30); n++;
      }
    }
  }

  // ---- vật phá được + thùng nổ
  genProps() {
    const P = ENV.props;
    const addProp = (kind, x, y) => this.props.push({ x, y, kind, r: P[kind].r, cy: P[kind].cy, hp: P[kind].hp, max: P[kind].hp, dead: false, flash: 0, seed: Math.random() });
    const spot = (zid, r, hotP = 0.5) => {
      for (let t = 0; t < 120; t++) {
        const hot = this.hot[zid];
        let x, y;
        if (hot.length && Math.random() < hotP) { const h = pick(hot); x = rand(h.x + 8, h.x + h.w - 8); y = rand(h.y + 8, h.y + h.h - 8); }
        else { const Rr = this.inner(zid, 24); x = rand(Rr.x, Rr.x + Rr.w); y = rand(Rr.y, Rr.y + Rr.h); }
        if (this.onRoad(x, y, 16) || !this.isFree(x, y, r + 6) || !this.clearOfRes(x, y, r + 4)) continue;
        return { x: Math.round(x), y: Math.round(y) };
      }
      return null;
    };
    const plan = [
      ["crate", "town", 14], ["bush", "town", 16], ["barrel", "town", 3],
      ["crate", "military", 6], ["jar", "military", 8], ["barrel", "military", 10],
      ["bush", "grave", 12], ["crate", "grave", 3], ["barrel", "grave", 1],
      ["jar", "lab", 8], ["crate", "lab", 4], ["barrel", "lab", 5],
    ];
    for (const [kind, zid, n] of plan) {
      for (let i = 0; i < n; i++) {
        const p = spot(zid, kind === "barrel" ? ENV.barrel.r : P[kind].r, kind === "bush" ? 0.1 : 0.5);
        if (!p) continue;
        if (kind === "barrel") this.barrels.push({ x: p.x, y: p.y, r: ENV.barrel.r, fuse: -1, dead: false, flash: 0 });
        else {
          addProp(kind, p.x, p.y);
          if (kind === "crate") for (const [ox, oy] of [[15, 0], [7, 11]]) if (Math.random() < 0.4 && this.isFree(p.x + ox, p.y + oy, P.crate.r + 2) && this.clearOfRes(p.x + ox, p.y + oy, 9)) addProp("crate", p.x + ox, p.y + oy);
        }
      }
    }
  }

  // ---- đuốc tường + đèn đường + đèn pha + ánh sáng đặc trưng từng khu
  genLights() {
    const W = WORLD, cx = W.w / 2, cy = W.h / 2, tc = this.biome.torch;
    for (let x = 90; x < W.w - 60; x += randInt(130, 170)) this.torches.push({ x, y: W.wallTop - 18, side: "top", seed: Math.random() });
    for (let y = 160; y < W.h - 80; y += randInt(200, 260)) { this.torches.push({ x: W.wall + 3, y, side: "left", seed: Math.random() }); this.torches.push({ x: W.w - W.wall - 3, y, side: "right", seed: Math.random() }); }
    for (const t of this.torches) this.lights.push({ x: t.x, y: t.y + (t.side === "top" ? 12 : 0), r: 78, color: tc, flicker: t.seed * 10 });
    // đèn đường dọc 2 trục
    let alt = 0;
    for (let y = W.wallTop + 140; y < W.h - W.wall - 60; y += 300) { if (Math.abs(y - cy) < 140) continue; this.lamps.push({ x: cx + (alt++ % 2 ? ROAD_W / 2 + 6 : -ROAD_W / 2 - 6), y }); }
    for (let x = 170; x < W.w - W.wall - 60; x += 300) { if (Math.abs(x - cx) < 140) continue; this.lamps.push({ x, y: cy + (alt++ % 2 ? ROAD_W / 2 + 6 : -ROAD_W / 2 - 6) }); }
    for (const l of this.lamps) this.lights.push({ x: l.x, y: l.y - 14, r: 120, color: "#ffd9a0", flicker: Math.random() * 10 });
    this.lights.push({ x: cx, y: cy, r: 150, color: "#ffd9a0", flicker: 1 });
    // trại quân sự: đèn pha ở tháp canh
    for (const s of this.solids) {
      if (s.style === "watchtower") this.lights.push({ x: s.x + s.w / 2, y: s.y + 8, r: 140, color: "#dff4ff", flicker: s.seed * 10 });
      else if (s.style === "crypt") this.lights.push({ x: s.x + s.w / 2, y: s.y + s.h, r: 62, color: "#7ad8c8", flicker: s.seed * 10 });
      else if (s.style === "car" && s.seed < 0.5) this.lights.push({ x: s.x + 8, y: s.y + 6, r: 44, color: "#ff8a3a", flicker: s.seed * 10 });
    }
    for (const r of this.labRooms) this.lights.push({ x: r.x + r.w / 2, y: r.y + r.h / 2, r: 120, color: "#9afff0", flicker: Math.random() * 10 });
    for (const p of this.pools) this.lights.push({ x: p.x, y: p.y, r: p.r + 28, color: "#7cff4a", flicker: p.seed });
    for (const h of this.hands) this.lights.push({ x: h.x, y: h.y, r: 36, color: "#b07aff", flicker: Math.random() * 10 });
    for (const j of this.props) if (j.kind === "jar") this.lights.push({ x: j.x, y: j.y - 5, r: 26, color: "#4aa8ff", flicker: j.seed * 10, prop: j });
    for (const l of this.landingZones) this.lights.push({ x: l.x, y: l.y, r: 90, color: "#fff2c0", flicker: 0 });
  }

  // ---------------------------------------------------------------- DỮ LIỆU CHO MODULE KHÁC
  /** Điểm trống ngẫu nhiên trong 1 khu (null nếu không tìm được) */
  randomPointInZone(zoneId, margin = 14) {
    const z = this.zoneById(zoneId);
    if (!z) return null;
    const Rr = this.inner(zoneId, margin + 8);
    for (let t = 0; t < 150; t++) {
      const x = rand(Rr.x, Rr.x + Rr.w), y = rand(Rr.y, Rr.y + Rr.h);
      if (this.isFree(x, y, margin)) return { x, y };
    }
    return null;
  }

  // ---------------------------------------------------------------- VẼ SÀN
  paintFloor(g) {
    const W = WORLD, cx = W.w / 2, cy = W.h / 2;
    const Zr = (id) => this.zoneById(id).rect;
    this.paintTownBase(g, Zr("town"));
    this.paintMilitaryBase(g, Zr("military"));
    this.paintGraveBase(g, Zr("grave"));
    this.paintLabBase(g, Zr("lab"));
    this.paintPatches(g);
    this.paintRoads(g, cx, cy);
    this.paintLandingMarks(g);
    // trang trí rải rác theo khu
    for (const z of this.zones) {
      const n = Math.round((z.rect.w * z.rect.h) / 3200), list = DECOR_BY_ZONE[z.id];
      for (let i = 0; i < n; i++) {
        const x = Math.round(rand(z.rect.x + 40, z.rect.x + z.rect.w - 30)), y = Math.round(rand(z.rect.y + W.wallTop + 6, z.rect.y + z.rect.h - 26));
        if (this.onRoad(x, y, 14) || this.solids.some((s) => !s.wall && circleRect(x, y, 5, s)) || this.pools.some((p) => (p.x - x) ** 2 + (p.y - y) ** 2 < (p.r + 8) ** 2)) continue;
        DRAWERS[weightedPick(list)](g, x, y);
      }
    }
    // cột đèn đường
    for (const l of this.lamps) { R(g, "rgba(0,0,0,0.35)", l.x - 1, l.y, 6, 2); R(g, "#1a1a20", l.x - 2, l.y - 2, 4, 3); R(g, "#2e2e36", l.x - 1, l.y - 15, 2, 14); R(g, "#ffe9a8", l.x - 3, l.y - 18, 6, 3); R(g, "#fff8d8", l.x - 2, l.y - 18, 3, 1); }
  }

  paintTownBase(g, r) {
    R(g, "#463f33", r.x, r.y, r.w, r.h);
    for (let y = r.y; y < r.y + r.h; y += 8) for (let x = r.x; x < r.x + r.w; x += 8) if (Math.random() < 0.5) R(g, pick(["#4b4437", "#41392e", "#4e4739", "#3f382d"]), x, y, 8, 8);
    for (let i = 0, n = (r.w * r.h) / 40; i < n; i++) R(g, pick(["#2f2a22", "#5a5242", "#383227", "#645b49"]), r.x + rand(0, r.w), r.y + rand(0, r.h), 1, 1);
    // mảng cỏ dại
    for (let i = 0; i < 80; i++) {
      const x = rand(r.x + 40, r.x + r.w - 40), y = rand(r.y + 60, r.y + r.h - 40), rad = rand(14, 34);
      g.fillStyle = "rgba(52,70,38,0.55)"; ellipse(g, x, y, rad, rad * 0.65);
      g.fillStyle = "rgba(70,96,48,0.4)"; ellipse(g, x - 2, y - 2, rad * 0.7, rad * 0.45);
      for (let k = 0; k < rad * 1.5; k++) R(g, pick(["#4a6a34", "#5e8444", "#6a9450", "#3a5428"]), x + rand(-rad, rad) * 0.9, y + rand(-rad, rad) * 0.55, 1, randInt(2, 3));
    }
  }
  paintMilitaryBase(g, r) {
    R(g, "#5b6062", r.x, r.y, r.w, r.h);
    for (let y = r.y; y < r.y + r.h; y += 32) for (let x = r.x; x < r.x + r.w; x += 32) {
      R(g, pick(["#5d6264", "#595e60", "#606567", "#5b6062"]), x, y, 32, 32);
      R(g, "#474c4e", x, y, 32, 1); R(g, "#474c4e", x, y, 1, 32); R(g, "#6a7072", x + 1, y + 1, 31, 1);
    }
    for (let i = 0, n = (r.w * r.h) / 36; i < n; i++) R(g, pick(["#4a4f51", "#6c7274", "#53585a"]), r.x + rand(0, r.w), r.y + rand(0, r.h), 1, 1);
    for (let i = 0; i < 22; i++) { g.fillStyle = "rgba(20,22,24,0.3)"; ellipse(g, rand(r.x + 40, r.x + r.w - 40), rand(r.y + 60, r.y + r.h - 40), rand(10, 26), rand(5, 12)); }
    for (let i = 0; i < 40; i++) {   // vết nứt bê tông
      let x = rand(r.x + 30, r.x + r.w - 30), y = rand(r.y + 50, r.y + r.h - 30); g.fillStyle = "rgba(10,12,14,0.5)";
      for (let k = 0; k < randInt(8, 20); k++) { g.fillRect(Math.round(x), Math.round(y), 1, 1); x += randInt(-1, 1); y += randInt(0, 1); }
    }
  }
  paintGraveBase(g, r) {
    R(g, "#2f3529", r.x, r.y, r.w, r.h);
    for (let y = r.y; y < r.y + r.h; y += 8) for (let x = r.x; x < r.x + r.w; x += 8) if (Math.random() < 0.55) R(g, pick(["#2e3428", "#2a3024", "#343b2c", "#272d22", "#383a2c"]), x, y, 8, 8);
    for (let i = 0, n = (r.w * r.h) / 34; i < n; i++) R(g, pick(["#1e231a", "#3c4630", "#463f2e"]), r.x + rand(0, r.w), r.y + rand(0, r.h), 1, 1);
    for (let i = 0; i < 60; i++) {
      const x = rand(r.x + 30, r.x + r.w - 30), y = rand(r.y + 40, r.y + r.h - 30), rad = rand(12, 28);
      g.fillStyle = "rgba(44,62,36,0.5)"; ellipse(g, x, y, rad, rad * 0.6);
    }
  }
  paintLabBase(g, r) {
    const T = 16;
    for (let y = r.y; y < r.y + r.h; y += T) for (let x = r.x; x < r.x + r.w; x += T) {
      const chk = ((x / T) + (y / T)) % 2 === 0, v = rand(-0.03, 0.03), t = Math.random();
      R(g, shade(t < 0.05 ? "#8fd4c8" : chk ? "#b9d0cc" : "#aec7c3", v), x, y, T, T);
      R(g, "#92aeaa", x, y, T, 1); R(g, "#92aeaa", x, y, 1, T); R(g, "#d2e6e2", x + 1, y + 1, T - 2, 1);
    }
    for (let i = 0; i < 90; i++) { g.fillStyle = pick(["rgba(40,50,40,0.18)", "rgba(60,70,40,0.15)", "rgba(30,40,50,0.15)"]); ellipse(g, rand(r.x + 30, r.x + r.w - 30), rand(r.y + 50, r.y + r.h - 30), rand(8, 30), rand(5, 16)); }   // vết bẩn
    for (let i = 0; i < 50; i++) { let x = rand(r.x + 30, r.x + r.w - 30), y = rand(r.y + 50, r.y + r.h - 30); g.fillStyle = "rgba(30,50,50,0.4)"; for (let k = 0; k < randInt(6, 14); k++) { g.fillRect(Math.round(x), Math.round(y), 1, 1); x += randInt(-1, 1); y += randInt(0, 1); } }
  }

  /** Sân nhà, nền nhà, tấm bê tông trại, đất nghĩa địa, phòng lab */
  paintPatches(g) {
    // sân lát gạch quanh nhà
    for (const h of this.houses) {
      const yd = inflate(h, 18);
      for (let y = yd.y; y < yd.y + yd.h; y += 12) for (let x = yd.x; x < yd.x + yd.w; x += 12) {
        if (Math.random() < 0.16) continue;   // gạch vỡ lộ đất
        R(g, pick(["#6a655b", "#625d54", "#6e695f"]), x, y, 12, 12); R(g, "#4e4a42", x, y, 12, 1); R(g, "#4e4a42", x, y, 1, 12);
      }
      for (let i = 0; i < 10; i++) XD.weeds(g, Math.round(rand(yd.x, yd.x + yd.w)), Math.round(rand(yd.y, yd.y + yd.h)));
    }
    // nền trong nhà
    for (const h of this.houses) {
      const i = h.inner;
      if (h.tone === "tile") {
        for (let y = i.y; y < i.y + i.h; y += 8) for (let x = i.x; x < i.x + i.w; x += 8) R(g, ((x - i.x) / 8 + (y - i.y) / 8) % 2 ? "#8a857a" : "#7e796e", x, y, Math.min(8, i.x + i.w - x), Math.min(8, i.y + i.h - y));
      } else {
        R(g, "#5a4632", i.x, i.y, i.w, i.h);
        for (let y = i.y; y < i.y + i.h; y += 6) { R(g, "#463524", i.x, y, i.w, 1); for (let x = i.x + randInt(0, 20); x < i.x + i.w; x += randInt(18, 34)) R(g, "#463524", x, y, 1, 6); }
        for (let k = 0; k < 14; k++) R(g, pick(["#6a523a", "#4e3c2a"]), i.x + rand(0, i.w), i.y + rand(0, i.h), randInt(3, 8), 1);
      }
      g.fillStyle = "rgba(0,0,0,0.18)"; g.fillRect(i.x, i.y, i.w, 6);   // bóng mái đổ cạnh tường trên
      for (let k = 0; k < 7; k++) XD.rubble(g, Math.round(rand(i.x + 8, i.x + i.w - 8)), Math.round(rand(i.y + 8, i.y + i.h - 8)));
      for (const ho of h.holes) if (ho.collapsed) for (let k = 0; k < 4; k++) XD.rubble(g, Math.round(ho.x + rand(0, ho.w)), Math.round(ho.y + rand(0, ho.h) + 4));
      if (Math.random() < 0.5) { R(g, "#7a1c28", i.x + i.w * 0.3, i.y + i.h * 0.35, 36, 22); R(g, "#a0303c", i.x + i.w * 0.3 + 2, i.y + i.h * 0.35 + 2, 32, 18); }   // thảm cũ
    }
    // tấm bê tông trại quân sự: viền vàng gạch đứt
    for (const s of this.slabs) {
      if (!s) continue;
      const q = inflate(s, 14);
      R(g, "#6c7173", q.x, q.y, q.w, q.h);
      for (let y = q.y; y < q.y + q.h; y += 24) R(g, "#575c5e", q.x, y, q.w, 1);
      for (let x = q.x; x < q.x + q.w; x += 24) R(g, "#575c5e", x, q.y, 1, q.h);
      for (let x = q.x + 4; x < q.x + q.w - 12; x += 20) { R(g, "#d4b230", x, q.y + 4, 12, 2); R(g, "#d4b230", x, q.y + q.h - 6, 12, 2); }
      for (let y = q.y + 4; y < q.y + q.h - 12; y += 20) { R(g, "#d4b230", q.x + 4, y, 2, 12); R(g, "#d4b230", q.x + q.w - 6, y, 2, 12); }
    }
    // đất khu mộ + lối sỏi
    for (const p of this.plots) {
      R(g, "#3a3c2e", p.x - 4, p.y - 4, p.w + 8, p.h + 8);
      for (let i = 0; i < (p.w * p.h) / 14; i++) R(g, pick(["#4c4a42", "#3e3c32", "#5a564a"]), p.x + rand(0, p.w), p.y + rand(0, p.h), 1, 1);
      for (let gy = p.y + 36; gy < p.y + p.h - 36; gy += 46) { g.fillStyle = "rgba(10,8,6,0.35)"; for (let gx = p.x + 30; gx < p.x + p.w - 40; gx += 38) ellipse(g, gx + 9, gy + 14, 9, 3); }
    }
    // phòng thí nghiệm: nền tối hơn + viền vàng đen cảnh báo
    for (const i of this.labRooms) {
      R(g, "#a8cfc8", i.x, i.y, i.w, i.h);
      for (let y = i.y; y < i.y + i.h; y += 16) R(g, "#8fb6ae", i.x, y, i.w, 1);
      for (let x = i.x; x < i.x + i.w; x += 16) R(g, "#8fb6ae", x, i.y, 1, i.h);
      for (let k = 0; k < 8; k++) XD.stain(g, Math.round(rand(i.x + 10, i.x + i.w - 10)), Math.round(rand(i.y + 10, i.y + i.h - 10)));
      for (let x = i.x; x < i.x + i.w; x += 8) { R(g, (x / 8) % 2 ? "#e0b420" : "#202428", x, i.y + i.h - 3, 8, 3); }
    }
  }

  paintRoads(g, cx, cy) {
    const W = WORLD;
    for (const r of this.roads) {   // lề đường (vỉa hè)
      const vert = r.h > r.w;
      for (const sgn of [-1, 1]) {
        const sx = vert ? (sgn < 0 ? r.x - 12 : r.x + r.w) : r.x, sy = vert ? r.y : (sgn < 0 ? r.y - 12 : r.y + r.h), sw = vert ? 12 : r.w, sh = vert ? r.h : 12;
        R(g, "#78746a", sx, sy, sw, sh);
        for (let k = 0; k < (vert ? sh : sw); k += 12) { if (vert) R(g, "#5a564e", sx, sy + k, sw, 1); else R(g, "#5a564e", sx + k, sy, 1, sh); }
      }
    }
    for (const r of this.roads) {   // nhựa đường
      R(g, "#35383c", r.x, r.y, r.w, r.h);
      for (let i = 0, n = (r.w * r.h) / 18; i < n; i++) R(g, pick(["#2e3034", "#3c4044", "#40444a", "#2a2c30"]), r.x + rand(0, r.w), r.y + rand(0, r.h), randInt(1, 2), 1);
    }
    for (const r of this.roads) {   // viền lề đường sáng + tối
      const vert = r.h > r.w;
      if (vert) { R(g, "#8c8a80", r.x, r.y, 2, r.h); R(g, "#8c8a80", r.x + r.w - 2, r.y, 2, r.h); R(g, "#24262a", r.x + 2, r.y, 1, r.h); R(g, "#24262a", r.x + r.w - 3, r.y, 1, r.h); }
      else { R(g, "#8c8a80", r.x, r.y, r.w, 2); R(g, "#8c8a80", r.x, r.y + r.h - 2, r.w, 2); R(g, "#24262a", r.x, r.y + 2, r.w, 1); R(g, "#24262a", r.x, r.y + r.h - 3, r.w, 1); }
    }
    // vết nứt, ổ gà, vệt lốp, nắp cống
    for (const r of this.roads) {
      const vert = r.h > r.w, len = vert ? r.h : r.w;
      for (let i = 0; i < len / 70; i++) {
        let x = vert ? r.x + rand(6, r.w - 6) : r.x + rand(0, r.w), y = vert ? r.y + rand(0, r.h) : r.y + rand(6, r.h - 6);
        g.fillStyle = "rgba(10,10,12,0.55)";
        for (let k = 0; k < randInt(10, 28); k++) { g.fillRect(Math.round(x), Math.round(y), 1, 1); x += vert ? randInt(-1, 1) : 1; y += vert ? 1 : randInt(-1, 1); }
      }
      for (let i = 0; i < len / 260; i++) { const x = vert ? r.x + rand(14, r.w - 14) : r.x + rand(20, r.w - 20), y = vert ? r.y + rand(20, r.h - 20) : r.y + rand(14, r.h - 14); g.fillStyle = "rgba(10,10,14,0.55)"; ellipse(g, x, y, rand(4, 8), rand(2, 4)); g.fillStyle = "rgba(60,64,72,0.5)"; ellipse(g, x - 1, y - 1, 3, 1.5); }
      for (let i = 0; i < len / 220; i++) { const o = rand(-30, 30); g.fillStyle = "rgba(16,16,18,0.28)"; if (vert) g.fillRect(Math.round(r.x + r.w / 2 + o), Math.round(r.y + rand(0, r.h - 120)), 2, randInt(40, 120)); else g.fillRect(Math.round(r.x + rand(0, r.w - 120)), Math.round(r.y + r.h / 2 + o), randInt(40, 120), 2); }
    }
    // vạch sơn vàng đứt giữa đường (bỏ qua ngã tư)
    const v = this.roads[0], h = this.roads[1], gap = ROAD_W / 2 + 22;
    for (let y = v.y + 6; y < v.y + v.h - 20; y += 50) { if (Math.abs(y + 13 - cy) < gap) continue; R(g, "#d6b84a", cx - 1, y, 2, 26); }
    for (let x = h.x + 6; x < h.x + h.w - 20; x += 50) { if (Math.abs(x + 13 - cx) < gap) continue; R(g, "#d6b84a", x, cy - 1, 26, 2); }
    // ngã tư: vạch qua đường + vạch dừng
    const hw = ROAD_W / 2;
    for (let k = -hw + 6; k < hw - 6; k += 8) {
      for (const d of [-1, 1]) {
        R(g, "#d8d8d0", cx + k, cy + d * (hw + 6) - (d > 0 ? 0 : 12), 5, 12);   // vạch qua đường (dọc)
        R(g, "#d8d8d0", cx + d * (hw + 6) - (d > 0 ? 0 : 12), cy + k, 12, 5);
      }
    }
    R(g, "#c8c8c0", cx - hw, cy - hw - 24, hw, 3); R(g, "#c8c8c0", cx, cy + hw + 22, hw, 3);
    R(g, "#c8c8c0", cx - hw - 24, cy, 3, hw); R(g, "#c8c8c0", cx + hw + 22, cy - hw, 3, hw);
    g.fillStyle = "rgba(10,10,12,0.3)"; ellipse(g, cx, cy, 26, 20); R(g, "#46484e", cx - 6, cy - 4, 12, 8); R(g, "#2a2c30", cx - 5, cy - 3, 10, 1); R(g, "#2a2c30", cx - 5, cy + 1, 10, 1);   // nắp cống ngã tư
    void W;
  }

  /** Vòng sơn đánh dấu bãi đáp; sân bay trực thăng chữ H ở Sân Bê Tông */
  paintLandingMarks(g) {
    for (const l of this.landingZones) {
      for (let i = 0; i < 64; i++) {
        if (i % 2) continue;
        const a = (i / 64) * TAU;
        R(g, l.name === "Sân Bê Tông" ? "#d4b230" : "rgba(220,220,210,0.5)", l.x + Math.cos(a) * 50 - 1, l.y + Math.sin(a) * 50 * 0.78 - 1, 3, 3);
      }
      if (l.name === "Sân Bê Tông") {
        R(g, "#d4b230", l.x - 14, l.y - 14, 4, 28); R(g, "#d4b230", l.x + 10, l.y - 14, 4, 28); R(g, "#d4b230", l.x - 10, l.y - 2, 20, 4);
      }
    }
  }

  // ---------------------------------------------------------------- MINIMAP
  renderMinimap(mw, mh) {
    const cv = document.createElement("canvas");
    cv.width = mw; cv.height = mh;
    const g = cv.getContext("2d");
    const sx = mw / WORLD.w, sy = mh / WORLD.h;
    g.fillStyle = "#101014"; g.fillRect(0, 0, mw, mh);
    for (const z of this.zones) { g.fillStyle = darken(z.color, 0.72); g.fillRect(z.rect.x * sx, z.rect.y * sy, Math.ceil(z.rect.w * sx), Math.ceil(z.rect.h * sy)); }
    g.fillStyle = "#6f747c";
    for (const r of this.roads) g.fillRect(r.x * sx, r.y * sy, Math.max(1, r.w * sx), Math.max(1, r.h * sy));
    g.fillStyle = "#56d23a";
    for (const p of this.pools) g.fillRect((p.x - p.r) * sx, (p.y - p.r * 0.8) * sy, Math.max(1, p.r * 2 * sx), Math.max(1, p.r * 1.6 * sy));
    g.fillStyle = "#9a9aa6";
    for (const s of this.solids) if (!s.wall) g.fillRect(s.x * sx, s.y * sy, Math.max(1, s.w * sx), Math.max(1, s.h * sy));
    g.fillStyle = "#26262e";
    g.fillRect(0, 0, mw, WORLD.wallTop * sy); g.fillRect(0, mh - WORLD.wall * sy, mw, WORLD.wall * sy); g.fillRect(0, 0, WORLD.wall * sx, mh); g.fillRect(mw - WORLD.wall * sx, 0, WORLD.wall * sx, mh);
    return cv;
  }
}

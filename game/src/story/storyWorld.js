// =====================================================================================
//  BẢN ĐỒ CỐT TRUYỆN — mỗi căn phòng vẽ bằng CHỮ (ô 16 px), kiểu RPG Maker / Nobihaza
//
//  Ký tự ô (xem thêm story/chuong1.js):
//    #  tường (tự vẽ: hàng sát sàn = MẶT TƯỜNG, cao 2 ô; xa hơn = nóc tường)   (dấu cách) khoảng tối
//    .  sàn        ,  sàn thảm / bẩn       ~  vết máu trên sàn       /  bậc cầu thang
//    w  cửa sổ (đặt trên mặt tường)        =  bảng đen (mặt tường)    n  bảng tin (mặt tường)    m  gương (mặt tường)
//    d  bàn học    k  bàn giáo viên / quầy  h  ghế (đi xuyên được)    l  tủ sắt cá nhân   b  kệ sách
//    c  tủ hồ sơ   v  máy bán nước         s  bồn rửa tay             u  bồn tiểu         p  chậu cây
//    x  thùng carton đổ                     o  cột vuông               t  vách buồng vệ sinh
//    A-Z, 0-9      ĐIỂM ĐÁNH DẤU — cửa, vật phẩm, zombie, điểm xuất hiện... (khai báo trong `objects` của phòng)
//                  điểm đặt trên ô tường = cửa nằm trên tường; còn lại = ô sàn
// =====================================================================================
import { World, WORLD } from "../world.js";

export const TILE = 16;
const T = TILE;

/** Ô chặn đường */
const SOLID_TILES = new Set(["#", " ", "w", "=", "n", "m", "d", "k", "l", "b", "c", "v", "s", "u", "p", "x", "o", "t"]);
/** Ô thuộc khối tường (vẽ tĩnh) */
const WALL_TILES = new Set(["#", "w", "=", "n", "m"]);
/** Đồ đạc vẽ động, sắp theo chiều sâu (ai đứng thấp hơn che người phía trên) — gộp các ô liền nhau cùng loại */
const FURN = { d: "desk", k: "counter", h: "chair", l: "locker", b: "shelf", c: "cabinet", v: "vending", s: "sink", u: "urinal", p: "plant", x: "boxes", o: "pillar", t: "stall" };
const MERGE = new Set(["d", "k", "l", "b", "c"]);
const isMarker = (ch) => /[A-Z0-9]/.test(ch);

/** Bảng màu sàn / tường theo vật liệu */
export const FLOORS = {
  wood:     { a: "#6a5136", b: "#614a31", c: "#735a3d", seam: "#3c2c1e", dot: "#4e3a26" },
  tile:     { a: "#7c847c", b: "#747c74", c: "#848c84", seam: "#4e544e", dot: "#5e665e" },
  wc:       { a: "#a8b0b4", b: "#a0a8ac", c: "#b0b8bc", seam: "#6e787c", dot: "#889094" },
  carpet:   { a: "#4c2c32", b: "#462930", c: "#542f37", seam: "#331c22", dot: "#3c2228" },
  concrete: { a: "#5e5e5c", b: "#585856", c: "#666664", seam: "#3e3e3c", dot: "#4a4a48" },
};
export const WALLS = {
  plaster: { cap: "#26222c", capHi: "#3e3848", top: "#c8b88e", topHi: "#dccca2", low: "#46685a", lowHi: "#5a7e6e", trim: "#2e2a24", base: "#1e1c20", line: "#a89870" },
  wcTile:  { cap: "#24282c", capHi: "#3a4046", top: "#d4dade", topHi: "#eef2f4", low: "#8aa4b0", lowHi: "#a4bcc6", trim: "#5e6c74", base: "#3a444a", line: "#b0bcc2" },
  office:  { cap: "#2a2420", capHi: "#423a32", top: "#bca88a", topHi: "#d2c0a2", low: "#5a4030", lowHi: "#6e5240", trim: "#2a1e16", base: "#1a1410", line: "#9c8a6c" },
  hall:    { cap: "#22242a", capHi: "#383c44", top: "#b8b49c", topHi: "#d0ccb4", low: "#3c5a6a", lowHi: "#4e7080", trim: "#262a2e", base: "#18191c", line: "#9a9682" },
};

const rnd = (seed) => { let s = seed | 0 || 1; return () => ((s = (s * 1664525 + 1013904223) | 0) >>> 0) / 4294967296; };
const R = (g, c, x, y, w, h) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };

/** Biome tối cho phòng cốt truyện (ánh sáng do StoryRun điều khiển) */
function storyBiome(def) {
  return {
    id: "story", name: def.name ?? "", desc: "", map: def,
    floor: { a: "#000", b: "#000", line: "#000", dots: ["#000"] },
    wall: { base: "#000", top: "#000", dark: "#000", face: "#000", pillarTop: "#000", pillarFace: "#000", pillarLine: "#000" },
    counts: {}, accel: 30, minimap: "#16141c",
    light: { color: def.ambient ?? "#03020a", alpha: def.dark ?? 0.9 },
    weather: def.weather ?? "dust", torch: "#ffb04a", spawnBias: {},
  };
}

export class StoryWorld extends World {
  /** def = 1 phòng trong chương (maps[id]) */
  constructor(def, images = {}) {
    const rows = def.tiles, cols = Math.max(...rows.map((r) => r.length));
    Object.assign(WORLD, { w: cols * T, h: rows.length * T, wall: 0, wallTop: 0 });
    super(storyBiome(def), images);
  }

  // ---------------------------------------------------------------- DỰNG PHÒNG TỪ CHỮ
  generate() {
    const def = this.biome.map;
    this.def = def;
    this.cols = Math.max(...def.tiles.map((r) => r.length));
    this.rows = def.tiles.length;
    this.grid2 = def.tiles.map((r) => r.padEnd(this.cols, " ").split(""));
    this.markers = {};                 // "A" -> { col, row, wall }
    this.furniture = [];               // đồ đạc vẽ động
    this.lamps = [];                   // đèn trần (StoryRun cho chập chờn / tắt)
    this.windows = [];                 // ô cửa sổ (lóe sáng khi có sét)
    this.doorTiles = [];
    // điểm đánh dấu: thay bằng ô tường (nếu đặt trên tường) hoặc sàn
    for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) {
      const ch = this.grid2[r][c];
      if (!isMarker(ch)) continue;
      const o = def.objects?.[ch], onWall = !!o && (o.type === "door" || o.wall) && !o.floor;   // cửa nằm trên ô tường
      this.markers[ch] = { col: c, row: r, wall: onWall };
      this.grid2[r][c] = onWall ? "#" : o?.under ?? ".";   // under: ký tự ô bên dưới điểm đánh dấu (vd "/" bậc thang)
      if (onWall) this.doorTiles.push({ col: c, row: r, id: ch });
    }
    // va chạm: gộp các ô chặn theo hàng ngang thành hình chữ nhật (ít hộp hơn -> nhanh)
    for (let r = 0; r < this.rows; r++) {
      let c = 0;
      while (c < this.cols) {
        const ch = this.grid2[r][c];
        if (!SOLID_TILES.has(ch) || FURN[ch]) { c++; continue; }
        let e = c;
        while (e + 1 < this.cols && SOLID_TILES.has(this.grid2[r][e + 1]) && !FURN[this.grid2[r][e + 1]]) e++;
        this.solids.push({ x: c * T, y: r * T, w: (e - c + 1) * T, h: T, wall: true });
        c = e + 1;
      }
    }
    // đồ đạc
    const used = new Set();
    for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) {
      const ch = this.grid2[r][c], kind = FURN[ch];
      if (!kind || used.has(r * 999 + c)) continue;
      let e = c;
      if (MERGE.has(ch)) while (e + 1 < this.cols && this.grid2[r][e + 1] === ch) e++;
      for (let k = c; k <= e; k++) used.add(r * 999 + k);
      const f = { kind, x: c * T, y: r * T, w: (e - c + 1) * T, h: T, seed: (r * 131 + c * 17) | 0, against: this.at(c, r - 1) === "#" };
      f.sortY = f.y + f.h - (kind === "chair" ? 6 : 1);
      this.furniture.push(f);
      const box = furnBox(f);
      if (box) this.solids.push({ ...box, wall: true, furn: f });
    }
    // điểm xuất hiện mặc định
    const st = this.markers[def.start ?? "1"] ?? Object.values(this.markers)[0];
    this.spawn = st ? this.spotOf(st) : { x: WORLD.w / 2, y: WORLD.h / 2 };
    // đèn trần
    for (const L of def.lights ?? []) {
      const [c, r, o = {}] = L;
      this.lamps.push({ x: c * T + T / 2, y: r * T + T / 2, r: o.r ?? 70, color: o.color ?? "#ffe9b0", mode: o.mode ?? "on", seed: (c * 7 + r * 13) % 97, a: o.a ?? 0.85, on: true });
    }
    for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) if (this.grid2[r][c] === "w") this.windows.push({ col: c, row: r });
  }

  at(c, r) { return r < 0 || r >= this.rows || c < 0 || c >= this.cols ? " " : this.grid2[r][c]; }
  floorLike(ch) { return ch && !SOLID_TILES.has(ch) || FURN[ch] !== undefined; }
  isWall(c, r) { return WALL_TILES.has(this.at(c, r)) || this.at(c, r) === " "; }
  /** Tọa độ chân (px) để đứng ở 1 điểm đánh dấu: điểm trên tường -> ô sàn ngay trước cửa */
  spotOf(m) {
    let c = m.col, r = m.row;
    if (m.wall) {
      if (this.floorLike(this.at(c, r + 1)) && !this.isWall(c, r + 1)) r += 1;
      else if (!this.isWall(c, r - 1)) r -= 1;
      else if (!this.isWall(c + 1, r)) c += 1;
      else c -= 1;
    }
    return { x: c * T + T / 2, y: r * T + T - 3 };
  }
  /** Hướng của cửa trên tường: "up" (cửa ở mặt tường phía trên), "down" (tường dưới), "left", "right" */
  doorSide(m) {
    const c = m.col, r = m.row;
    if (!this.isWall(c, r + 1)) return "up";
    if (!this.isWall(c, r - 1)) return "down";
    if (!this.isWall(c + 1, r)) return "left";
    return "right";
  }
  /** Số ô tường liên tiếp bên dưới (0 = sát sàn) — để biết ô là mặt tường hay nóc */
  depthAbove(c, r) {
    let d = 0;
    while (r + d + 1 < this.rows && this.isWall(c, r + d + 1)) d++;
    return r + d + 1 >= this.rows ? 99 : d;
  }

  // ---------------------------------------------------------------- VẼ NỀN TĨNH
  paintFloor(g) {
    const def = this.def, F = FLOORS[def.floor ?? "tile"] ?? FLOORS.tile, rg = rnd(this.cols * 31 + this.rows);
    R(g, "#020104", 0, 0, WORLD.w, WORLD.h);
    for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) {
      const ch = this.grid2[r][c];
      if (WALL_TILES.has(ch) || ch === " ") continue;
      const x = c * T, y = r * T;
      const mat = ch === "," ? (def.floor2 ?? "carpet") : (def.floor ?? "tile");
      paintFloorTile(g, FLOORS[mat] ?? F, mat, x, y, c, r, rg);
      if (ch === "/") paintStairs(g, x, y, c);
    }
    // bóng đổ của tường lên sàn (mép dưới tường) + bóng góc
    for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) {
      if (this.isWall(c, r) || this.at(c, r) === " ") continue;
      const x = c * T, y = r * T;
      if (this.isWall(c, r - 1)) { g.fillStyle = "rgba(0,0,0,0.38)"; g.fillRect(x, y, T, 3); g.fillStyle = "rgba(0,0,0,0.18)"; g.fillRect(x, y + 3, T, 3); }
      if (this.isWall(c - 1, r)) { g.fillStyle = "rgba(0,0,0,0.25)"; g.fillRect(x, y, 3, T); }
      if (this.isWall(c + 1, r)) { g.fillStyle = "rgba(0,0,0,0.16)"; g.fillRect(x + T - 2, y, 2, T); }
    }
    // vết máu vẽ sẵn
    for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) if (this.grid2[r][c] === "~") paintBlood(g, c * T + 8, r * T + 8, rg);
    // đồ trang trí rải rác: giấy, rác, mảnh kính
    for (let i = 0; i < (this.cols * this.rows) / 18; i++) {
      const c = (rg() * this.cols) | 0, r = (rg() * this.rows) | 0;
      if (this.isWall(c, r) || SOLID_TILES.has(this.at(c, r))) continue;
      const x = c * T + rg() * 12 + 2, y = r * T + rg() * 12 + 2, k = rg();
      if (k < 0.45) { R(g, "#d8d4c4", x, y, 4, 3); R(g, "#a8a494", x + 1, y + 1, 2, 1); }          // tờ giấy
      else if (k < 0.65) { R(g, "rgba(0,0,0,0.3)", x - 2, y, 6, 2); }                              // vết bẩn
      else if (k < 0.8) { for (let j = 0; j < 4; j++) R(g, ["#c8f4f0", "#8adcd8", "#ffffff"][j % 3], x + rg() * 8 - 4, y + rg() * 4 - 2, 1, 1); }   // mảnh kính
      else { R(g, "#3a3430", x, y, 3, 2); R(g, "#5a524a", x, y, 2, 1); }                           // đá vụn
    }
  }

  paintWalls(g) {
    const W = WALLS[this.def.wall ?? "plaster"] ?? WALLS.plaster;
    for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) {
      const ch = this.at(c, r);
      if (!WALL_TILES.has(ch)) continue;
      const x = c * T, y = r * T, d = this.depthAbove(c, r);
      if (d === 0 || d === 1) paintFace(g, W, x, y, d, ch, c, r, this);   // MẶT TƯỜNG: d=1 nửa trên, d=0 nửa dưới (sát sàn)
      else paintCap(g, W, x, y, c, r, this);
    }
    // khung cửa trên tường
    for (const dt of this.doorTiles) {
      const side = this.doorSide({ col: dt.col, row: dt.row });
      const x = dt.col * T, y = dt.row * T;
      if (side === "up") paintDoorFace(g, x, y, this.def.doorColor);
      else paintDoorFlat(g, x, y, side, this.def.doorColor);
    }
  }

  /** Không dùng cột / hố / axit của bản đồ đấu trường */
  renderMinimap(mw, mh) {
    const cv = document.createElement("canvas");
    cv.width = mw; cv.height = mh;
    const g = cv.getContext("2d"), sx = mw / WORLD.w, sy = mh / WORLD.h;
    g.fillStyle = "#0e0c14"; g.fillRect(0, 0, mw, mh);
    g.fillStyle = "#4a4458";
    for (const s of this.solids) g.fillRect(s.x * sx, s.y * sy, Math.max(1, s.w * sx), Math.max(1, s.h * sy));
    return cv;
  }

  /** Sét đánh: cửa sổ trắng xóa (gọi từ StoryRun) */
  drawWindowsFlash(ctx, cam, k) {
    if (k <= 0) return;
    for (const wd of this.windows) {
      const x = wd.col * T, y = wd.row * T;
      if (!cam.inView(x + 8, y + 8, 20)) continue;
      ctx.fillStyle = `rgba(220,235,255,${0.8 * k})`; ctx.fillRect(x + 3, y + 3, T - 6, T - 5);
    }
  }
}

// =====================================================================================
//  HỘP VA CHẠM của đồ đạc (theo chân: phần đáy)
// =====================================================================================
function furnBox(f) {
  const { x, y, w } = f;
  switch (f.kind) {
    case "chair": return null;                                  // ghế: đi xuyên qua
    case "desk": return { x: x + 1, y: y + 4, w: w - 2, h: 11 };
    case "counter": return { x, y: y + 2, w, h: 14 };
    case "sink": case "urinal": return { x: x + 2, y: y + 2, w: w - 4, h: 10 };
    case "plant": return { x: x + 4, y: y + 6, w: 8, h: 8 };
    case "boxes": return { x: x + 1, y: y + 4, w: w - 2, h: 11 };
    case "pillar": return { x: x + 1, y: y + 2, w: w - 2, h: 14 };
    case "stall": return { x: x + 6, y, w: 4, h: T };
    default: return { x, y: y + 1, w, h: 15 };                  // tủ, kệ, máy bán nước: chiếm cả ô
  }
}

// =====================================================================================
//  VẼ SÀN / TƯỜNG / CỬA
// =====================================================================================
function paintFloorTile(g, F, mat, x, y, c, r, rg) {
  if (mat === "wood") {         // ván gỗ chạy ngang, mỗi tấm cao 4 px, mối nối so le
    for (let k = 0; k < 4; k++) {
      const yy = y + k * 4, shade = [F.a, F.b, F.c][(c * 3 + r * 5 + k) % 3];
      R(g, shade, x, yy, T, 4); R(g, F.seam, x, yy + 3, T, 1);
      const off = ((r * 4 + k) * 7) % 16;
      R(g, F.seam, x + off, yy, 1, 3);
      if (rg() < 0.4) R(g, F.dot, x + ((off + 5) % 15), yy + 1, 2, 1);
    }
  } else if (mat === "wc") {    // gạch nhỏ 8 px
    for (let k = 0; k < 4; k++) { const xx = x + (k % 2) * 8, yy = y + ((k / 2) | 0) * 8; R(g, (k + c + r) % 2 ? F.a : F.b, xx, yy, 8, 8); R(g, F.seam, xx, yy + 7, 8, 1); R(g, F.seam, xx + 7, yy, 1, 8); }
    if (rg() < 0.2) R(g, "rgba(60,80,70,0.3)", x + rg() * 10, y + rg() * 10, 4, 3);
  } else if (mat === "carpet") {
    R(g, F.a, x, y, T, T);
    for (let i = 0; i < 10; i++) R(g, rg() < 0.5 ? F.b : F.c, x + rg() * 15, y + rg() * 15, 1, 1);
    if ((c + r) % 4 === 0) R(g, F.seam, x, y + 15, T, 1);
  } else if (mat === "concrete") {
    R(g, (c + r) % 3 ? F.a : F.b, x, y, T, T);
    for (let i = 0; i < 6; i++) R(g, F.dot, x + rg() * 15, y + rg() * 15, 1, 1);
    if (rg() < 0.12) { let cx = x + rg() * 14, cy = y + rg() * 6; for (let k = 0; k < 8; k++) { R(g, F.seam, cx, cy, 1, 1); cx += rg() * 2 - 0.6; cy += 1; } }
  } else {                      // gạch men hành lang 16 px: ô sáng tối xen kẽ + vạch ron
    R(g, (c + r) % 2 ? F.a : F.b, x, y, T, T);
    R(g, F.seam, x, y + 15, T, 1); R(g, F.seam, x + 15, y, 1, T);
    R(g, F.c, x + 1, y + 1, 6, 1);
    if (rg() < 0.25) R(g, F.dot, x + rg() * 12 + 2, y + rg() * 12 + 2, 2, 1);
  }
}
function paintStairs(g, x, y, c) {
  for (let k = 0; k < 4; k++) { R(g, k % 2 ? "#4a4a50" : "#5a5a60", x, y + k * 4, T, 4); R(g, "#2a2a30", x, y + k * 4 + 3, T, 1); R(g, "#6a6a72", x, y + k * 4, T, 1); }
  if (c % 3 === 0) R(g, "#8a6a3a", x, y, 2, T);   // tay vịn
}
function paintBlood(g, x, y, rg) {
  g.fillStyle = "rgba(70,6,10,0.85)"; g.beginPath(); g.ellipse(x, y, 7 + rg() * 4, 4 + rg() * 2, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = "rgba(120,14,18,0.8)"; g.beginPath(); g.ellipse(x - 1, y - 1, 5, 2.5, 0, 0, Math.PI * 2); g.fill();
  for (let i = 0; i < 7; i++) R(g, "rgba(110,12,16,0.85)", x + rg() * 26 - 13, y + rg() * 14 - 7, 1 + (rg() * 2 | 0), 1);
  R(g, "rgba(200,60,60,0.5)", x - 3, y - 2, 2, 1);
}
function paintCap(g, W, x, y, c, r, w) {
  R(g, W.cap, x, y, T, T);
  if (!w.isWall(c, r - 1)) R(g, W.capHi, x, y, T, 2);
  if (!w.isWall(c - 1, r) && w.at(c - 1, r) !== " ") R(g, W.capHi, x, y, 2, T);
  if (!w.isWall(c + 1, r) && w.at(c + 1, r) !== " ") R(g, W.capHi, x + T - 2, y, 2, T);
  if (!w.isWall(c, r + 1) && r + 1 < w.rows) R(g, "#0c0a10", x, y + T - 2, T, 2);
}
/** Mặt tường cao 2 ô: d=1 nửa trên (tường sơn + cửa sổ / bảng), d=0 nửa dưới (ốp chân tường + len chân) */
function paintFace(g, W, x, y, d, ch, c, r, w) {
  if (d === 1) {
    R(g, W.top, x, y, T, T);
    R(g, W.trim, x, y, T, 2);                         // gờ trần
    R(g, W.topHi, x, y + 2, T, 1);
    if ((c * 5 + r) % 7 === 0) { R(g, "rgba(0,0,0,0.12)", x + 3, y + 5, 3, 8); }   // vệt ố
    if (ch === "w") paintWindow(g, x, y, c);
    if (ch === "m") { R(g, "#5e6c74", x + 2, y + 3, 12, 12); R(g, "#9ab4c4", x + 3, y + 4, 10, 10); R(g, "#d8ecf4", x + 4, y + 5, 2, 6); R(g, "#c8dce6", x + 7, y + 5, 1, 3); }
  } else {
    R(g, W.low, x, y, T, T);
    R(g, W.trim, x, y, T, 1); R(g, W.lowHi, x, y + 1, T, 1);
    for (let k = 4; k < 14; k += 5) R(g, "rgba(0,0,0,0.12)", x, y + k, T, 1);
    R(g, W.base, x, y + 13, T, 3);                   // len chân tường
    if (ch === "=") { R(g, "#3a2a1c", x, y - 9, T, 21); R(g, "#1e3a2c", x, y - 8, T, 19); R(g, "#2c4c3a", x, y - 8, T, 1); R(g, "#b0b8a4", x + ((c * 7) % 11) + 1, y - 4, 4, 1); R(g, "#c04040", x + ((c * 5) % 9) + 2, y + 2, 5, 1); R(g, "#8a6a48", x, y + 10, T, 2); }
    if (ch === "n") { R(g, "#6a4a2a", x + 1, y - 6, 14, 14); R(g, "#a8845a", x + 2, y - 5, 12, 12); for (let k = 0; k < 3; k++) R(g, ["#e8e4d4", "#f0d080", "#d8e8f0"][k], x + 3 + k * 4, y - 4 + (k % 2) * 3, 3, 4); R(g, "#c03030", x + 4, y - 4, 1, 1); }
  }
}
function paintWindow(g, x, y, c) {
  R(g, "#24242c", x + 1, y + 3, 14, 13);
  R(g, "#0e1626", x + 2, y + 4, 12, 11);
  for (let k = 0; k < 4; k++) R(g, "#24344e", x + 3 + ((k * 5 + c) % 10), y + 5 + k * 2, 1, 3);   // giọt mưa trên kính
  R(g, "#3a3a46", x + 7, y + 4, 2, 11); R(g, "#3a3a46", x + 2, y + 9, 12, 1);                       // song cửa
  R(g, "#4a4a56", x + 1, y + 15, 14, 1);
}
function paintDoorFace(g, x, y, col = "#6a4a2e") {
  const top = y - 10;
  R(g, "#1c140e", x + 1, top - 1, 14, 27);
  R(g, col, x + 2, top, 12, 26);
  R(g, "rgba(255,255,255,0.08)", x + 3, top + 1, 1, 24);
  R(g, "rgba(0,0,0,0.25)", x + 3, top + 4, 10, 6); R(g, "rgba(0,0,0,0.25)", x + 3, top + 13, 10, 9);
  R(g, "#9ab0c0", x + 5, top + 5, 6, 4);              // ô kính nhỏ
  R(g, "#d8c070", x + 11, top + 13, 2, 2);            // tay nắm
  R(g, "#0a0806", x + 1, y + 15, 14, 1);
}
function paintDoorFlat(g, x, y, side, col = "#6a4a2e") {
  R(g, "#1c140e", x, y, T, T);
  if (side === "down" || side === "up") { R(g, col, x + 1, y + 4, 14, 8); R(g, "#d8c070", x + 11, y + 7, 2, 2); R(g, "rgba(0,0,0,0.3)", x + 1, y + 10, 14, 2); }
  else { R(g, col, x + 4, y + 1, 8, 14); R(g, "#d8c070", x + 7, y + 10, 2, 2); }
}

// =====================================================================================
//  ĐỒ ĐẠC (vẽ động, có chiều cao — sắp xếp theo chân)
// =====================================================================================
export function drawFurniture(ctx, f, t, flash = 0) {
  const { x, y, w } = f, X = Math.round(x), Y = Math.round(y);
  const r = rnd(f.seed);
  switch (f.kind) {
    case "desk": {
      for (let i = 0; i < w; i += 16) {   // mỗi ô 1 bàn học: mặt gỗ + chân sắt
        R(ctx, "rgba(0,0,0,0.3)", X + i + 1, Y + 13, 15, 3);
        R(ctx, "#2a2420", X + i + 2, Y + 8, 2, 7); R(ctx, "#2a2420", X + i + 12, Y + 8, 2, 7);
        R(ctx, "#1a1410", X + i, Y - 1, 16, 11);
        R(ctx, "#9a7650", X + i + 1, Y, 14, 7); R(ctx, "#b48c62", X + i + 1, Y, 14, 1);
        R(ctx, "#6e5236", X + i + 1, Y + 7, 14, 2);
        if (r() < 0.35) R(ctx, "#e8e4d4", X + i + 3 + r() * 6, Y + 2, 5, 3);     // sách / giấy
        if (r() < 0.15) R(ctx, "#3a5a8a", X + i + 9, Y + 1, 4, 4);
      }
      break;
    }
    case "counter": {
      R(ctx, "rgba(0,0,0,0.3)", X + 1, Y + 14, w, 3);
      R(ctx, "#1a120c", X - 1, Y - 6, w + 2, 22);
      R(ctx, "#7a5434", X, Y - 5, w, 6); R(ctx, "#94683e", X, Y - 5, w, 1);
      R(ctx, "#5a3c26", X, Y + 1, w, 14);
      for (let i = 4; i < w; i += 12) R(ctx, "#4a301e", X + i, Y + 3, 8, 10);
      if (w >= 32) { R(ctx, "#e8e4d4", X + 6, Y - 4, 6, 3); R(ctx, "#2a2a30", X + w - 14, Y - 9, 9, 6); R(ctx, "#4a7aa8", X + w - 13, Y - 8, 7, 4); }   // giấy tờ + máy tính
      break;
    }
    case "chair": {
      R(ctx, "#1a1410", X + 3, Y + 1, 10, 12);
      R(ctx, "#4a5a6a", X + 4, Y + 2, 8, 3);          // tựa lưng
      R(ctx, "#5a6c7c", X + 4, Y + 6, 8, 4);          // mặt ghế
      R(ctx, "#2a2a30", X + 4, Y + 10, 1, 3); R(ctx, "#2a2a30", X + 11, Y + 10, 1, 3);
      break;
    }
    case "locker": {
      for (let i = 0; i < w; i += 16) {
        R(ctx, "#101418", X + i, Y - 14, 16, 30);
        R(ctx, i % 32 ? "#4e6272" : "#4a5e6e", X + i + 1, Y - 13, 14, 28);
        R(ctx, "#6a8090", X + i + 1, Y - 13, 14, 1);
        for (let k = 0; k < 3; k++) R(ctx, "#2a3640", X + i + 4, Y - 10 + k * 2, 8, 1);   // khe thông gió
        R(ctx, "#b8c4cc", X + i + 11, Y - 1, 2, 3);
        if (r() < 0.3) R(ctx, "#2a3640", X + i + 3, Y + 3, 3, 2);      // vết móp
        if (r() < 0.15) { R(ctx, "#3a4a56", X + i + 1, Y - 13, 2, 28); }   // cửa hé
      }
      break;
    }
    case "shelf": {
      R(ctx, "#140e0a", X, Y - 18, w, 34);
      R(ctx, "#5a3c26", X + 1, Y - 17, w - 2, 32);
      for (let k = 0; k < 3; k++) {
        const yy = Y - 15 + k * 10;
        R(ctx, "#2a1a10", X + 2, yy, w - 4, 8);
        for (let i = X + 3; i < X + w - 4; i += 2 + (r() * 2 | 0)) { const hgt = 5 + (r() * 3 | 0); R(ctx, ["#8a2a2a", "#2a5a8a", "#c8a050", "#3a6a3a", "#6a3a6a", "#d8d0c0"][(r() * 6) | 0], i, yy + 8 - hgt, 2, hgt); }
        R(ctx, "#6e4c30", X + 1, yy + 8, w - 2, 2);
      }
      break;
    }
    case "cabinet": {
      for (let i = 0; i < w; i += 16) {
        R(ctx, "#121416", X + i, Y - 10, 16, 26);
        R(ctx, "#6a6e74", X + i + 1, Y - 9, 14, 24); R(ctx, "#8a8e94", X + i + 1, Y - 9, 14, 1);
        for (let k = 0; k < 3; k++) { R(ctx, "#4a4e54", X + i + 2, Y - 7 + k * 8, 12, 7); R(ctx, "#c8ccd0", X + i + 6, Y - 4 + k * 8, 4, 1); }
      }
      break;
    }
    case "vending": {
      R(ctx, "#0a0606", X, Y - 18, 16, 34);
      R(ctx, "#a82a2a", X + 1, Y - 17, 14, 32); R(ctx, "#c84040", X + 1, Y - 17, 14, 1);
      const on = Math.sin(t * 37 + f.seed) > -0.7 || flash > 0;
      R(ctx, on ? "#c8e8ff" : "#4a5a6a", X + 3, Y - 14, 7, 14);
      for (let k = 0; k < 3; k++) for (let j = 0; j < 2; j++) R(ctx, ["#e84a4a", "#4ae84a", "#e8c84a"][(k + j) % 3], X + 4 + j * 3, Y - 12 + k * 4, 2, 3);
      R(ctx, "#2a2a30", X + 11, Y - 12, 3, 6); R(ctx, "#1a1010", X + 3, Y + 3, 10, 4);
      break;
    }
    case "sink": {
      R(ctx, "#2a3034", X + 7, Y + 6, 2, 8);
      R(ctx, "#1a2024", X + 1, Y, 14, 8);
      R(ctx, "#dce4e8", X + 2, Y + 1, 12, 6); R(ctx, "#a8b8c0", X + 4, Y + 2, 8, 3);
      R(ctx, "#b8c4cc", X + 7, Y - 3, 2, 4);
      break;
    }
    case "urinal": {
      R(ctx, "#1a2024", X + 3, Y - 6, 10, 16);
      R(ctx, "#e4ecf0", X + 4, Y - 5, 8, 14); R(ctx, "#a8b8c0", X + 6, Y + 1, 4, 6);
      break;
    }
    case "plant": {
      R(ctx, "rgba(0,0,0,0.3)", X + 3, Y + 13, 11, 3);
      R(ctx, "#5a3020", X + 4, Y + 6, 8, 8); R(ctx, "#7a4a30", X + 4, Y + 6, 8, 2);
      for (let k = 0; k < 7; k++) { const a = -Math.PI / 2 + (k - 3) * 0.45, L = 6 + (k % 3) * 2; for (let s = 0; s < L; s++) R(ctx, k % 2 ? "#4a5a2a" : "#3a4a22", X + 8 + Math.cos(a) * s, Y + 6 + Math.sin(a) * s * 1.2, 1, 1); }
      R(ctx, "#6a5a2a", X + 6, Y - 2, 2, 2);         // lá úa
      break;
    }
    case "boxes": {
      R(ctx, "rgba(0,0,0,0.3)", X + 1, Y + 13, 15, 3);
      R(ctx, "#1a120a", X + 1, Y + 1, 14, 14); R(ctx, "#a07a48", X + 2, Y + 2, 12, 12); R(ctx, "#c09a64", X + 2, Y + 2, 12, 1); R(ctx, "#7a5a30", X + 7, Y + 2, 2, 12);
      R(ctx, "#1a120a", X + 4, Y - 7, 10, 9); R(ctx, "#b08a54", X + 5, Y - 6, 8, 7); R(ctx, "#8a6a3a", X + 8, Y - 6, 1, 7);
      break;
    }
    case "pillar": {
      R(ctx, "rgba(0,0,0,0.35)", X + 2, Y + 13, 15, 4);
      R(ctx, "#121216", X, Y - 30, 16, 46);
      R(ctx, "#8a8a84", X + 1, Y - 29, 14, 44); R(ctx, "#a8a8a0", X + 1, Y - 29, 3, 44); R(ctx, "#6a6a66", X + 12, Y - 29, 3, 44);
      R(ctx, "#3c5a6a", X + 1, Y + 2, 14, 12);        // ốp chân cột
      break;
    }
    case "stall": {   // vách buồng vệ sinh nhìn từ trên + cánh cửa
      R(ctx, "#1a2024", X + 6, Y - 14, 4, 30);
      R(ctx, "#8aa0ac", X + 7, Y - 13, 2, 28);
      break;
    }
  }
}

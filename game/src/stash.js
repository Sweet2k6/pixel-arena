// =====================================================================================
//  KHO ĐỒ VĨNH VIỄN (STASH) + TÚI CHIẾN THUẬT (LOADOUT) — chế độ Nhảy Dù Rút Quân
//
//  * Kho Đồ lưu trong localStorage: vật phẩm tiêu hao (Hộp Cứu Thương, Bình Năng Lượng, Lựu Đạn, Mìn,
//    Ống Tiêm) + vũ khí mang về được sau mỗi lần RÚT QUÂN THÀNH CÔNG.
//  * Trước khi lên máy bay: chọn đồ từ Kho bỏ vào TÚI CHIẾN THUẬT 4 ô (phím Z X C V hoặc 3 4 5 6 trong trận)
//    và (tùy chọn) 1 khẩu súng trong Kho làm vũ khí phụ.
//  * Lên máy bay = đồ trong túi RỜI KHO (có rủi ro):
//      - Rút quân thành công: đồ còn dư trong túi + mọi thứ nhặt được trong ván quay về Kho.
//      - Tử trận / bỏ trận: mất hết đồ đã mang theo (chỉ giữ nhân vật, vũ khí khởi đầu và đồ còn cất ở nhà).
//  Muốn đổi tác dụng vật phẩm: sửa ITEM_DEFS. Muốn đổi bộ quà khởi đầu: STARTER_KIT.
// =====================================================================================
import { WEAPONS, drawWeaponIcon } from "./weapons.js";

const KEY = "pixelArena.stash.v1";
/** Số ô của Túi Chiến Thuật và phím dùng nhanh tương ứng */
export const BAG_SLOTS = 4;
export const BAG_KEYS = [["z", "3"], ["x", "4"], ["c", "5"], ["v", "6"]];

/**
 * >>> VẬT PHẨM <<<   stack = tối đa bao nhiêu cái trong 1 ô túi.
 * Tác dụng thật nằm trong src/extraction.js -> useItem() (đọc các số heal / energy... ở đây).
 */
export const ITEM_DEFS = {
  medkit:     { id: "medkit",     name: "Hộp Cứu Thương",     short: "CỨU THƯƠNG", color: "#ff4a5a", stack: 5, heal: 0.6,
                desc: "Hồi 60% Máu ngay lập tức" },
  energyCell: { id: "energyCell", name: "Bình Năng Lượng",    short: "NĂNG LƯỢNG", color: "#4aa8ff", stack: 5, energy: 0.6, armor: 0.5, cdCut: 0.5,
                desc: "Hồi 60% Năng lượng, 50% Giáp và giảm một nửa hồi chiêu kỹ năng" },
  grenade:    { id: "grenade",    name: "Lựu Đạn",            short: "LỰU ĐẠN",   color: "#8ac040", stack: 6, radius: 72, damage: 9, range: 190,
                desc: "Ném tới chỗ ngắm, nổ tung 72px. Tiếng nổ kéo zombie tới" },
  mine:       { id: "mine",       name: "Mìn Cảm Ứng",        short: "MÌN",       color: "#e8b030", stack: 4, radius: 84, damage: 12,
                desc: "Đặt dưới chân. Zombie dẫm lên là nổ 84px" },
  stim:       { id: "stim",       name: "Ống Tiêm Kích Thích", short: "KÍCH THÍCH", color: "#ff8a2a", stack: 4, time: 10,
                desc: "+30% tốc chạy và +40% tốc bắn trong 10 giây" },
};
export const ITEM_ORDER = ["medkit", "energyCell", "grenade", "mine", "stim"];

/**
 * >>> CHÈN ẢNH ICON VẬT PHẨM (tùy chọn) — PNG vuông 16x16 nền trong suốt, đặt trong game/assets/images/items/
 *     Để "" thì game tự vẽ icon pixel bằng code.
 */
export const ITEM_IMAGES = {
  "item:medkit": "",       // ví dụ: "assets/images/items/medkit.png"      (Hộp Cứu Thương)
  "item:energyCell": "",   // ví dụ: "assets/images/items/energy-cell.png" (Bình Năng Lượng)
  "item:grenade": "",      // ví dụ: "assets/images/items/grenade.png"     (Lựu Đạn)
  "item:mine": "",         // ví dụ: "assets/images/items/mine.png"        (Mìn)
  "item:stim": "",         // ví dụ: "assets/images/items/stim.png"        (Ống Tiêm)
};

/** Quà khởi đầu cho người chơi mới (lần đầu mở game) */
const STARTER_KIT = { items: { medkit: 3, energyCell: 2, grenade: 3, mine: 1, stim: 1 }, bag: [["medkit", 2], ["grenade", 2], ["energyCell", 1], null] };

export class Stash {
  constructor() {
    this.items = {};                          // { id: số lượng }
    this.weapons = [];                        // [{ id, lvl }] — súng mang về từ trận
    this.bag = Array(BAG_SLOTS).fill(null);   // kế hoạch túi: [{ id, n } | null]
    this.bagWeapon = -1;                      // chỉ số súng trong this.weapons mang theo (-1 = không)
    this.duration = 7;                        // phút / ván (5 · 7 · 10)
    this.stats = { runs: 0, extracted: 0, died: 0, bestLoot: 0 };
    this.load();
  }

  // ---------------------------------------------------------------- LƯU / ĐỌC
  load() {
    let d = null;
    try { d = JSON.parse(localStorage.getItem(KEY) ?? "null"); } catch { d = null; }
    if (!d || typeof d !== "object") {          // người chơi mới: tặng bộ đồ khởi đầu
      this.items = { ...STARTER_KIT.items };
      this.bag = STARTER_KIT.bag.map((s) => (s ? { id: s[0], n: s[1] } : null));
      this.save();
      return;
    }
    for (const id of ITEM_ORDER) { const n = Math.trunc(Number(d.items?.[id])); if (n > 0) this.items[id] = Math.min(999, n); }
    if (Array.isArray(d.weapons)) this.weapons = d.weapons.filter((w) => w && WEAPONS[w.id]).map((w) => ({ id: w.id, lvl: Math.max(1, Math.min(3, Math.trunc(w.lvl) || 1)) }));
    if (Array.isArray(d.bag)) this.bag = Array.from({ length: BAG_SLOTS }, (_, i) => { const s = d.bag[i]; return s && ITEM_DEFS[s.id] ? { id: s.id, n: Math.max(1, Math.trunc(s.n) || 1) } : null; });
    this.bagWeapon = Number.isInteger(d.bagWeapon) && d.bagWeapon < this.weapons.length ? d.bagWeapon : -1;
    if ([5, 7, 10].includes(d.duration)) this.duration = d.duration;
    if (d.stats && typeof d.stats === "object") Object.assign(this.stats, d.stats);
    this.normalizeBag();
  }
  save() {
    try {
      localStorage.setItem(KEY, JSON.stringify({ items: this.items, weapons: this.weapons, bag: this.bag, bagWeapon: this.bagWeapon, duration: this.duration, stats: this.stats }));
    } catch { /* bỏ qua (chế độ ẩn danh...) */ }
  }

  // ---------------------------------------------------------------- VẬT PHẨM
  count(id) { return this.items[id] ?? 0; }
  add(id, n = 1) {
    if (!ITEM_DEFS[id] || n <= 0) return;
    this.items[id] = Math.min(999, this.count(id) + n);
  }
  /** Lấy n cái ra khỏi kho, trả về số lấy được */
  take(id, n = 1) {
    const got = Math.min(n, this.count(id));
    if (got > 0) { this.items[id] -= got; if (this.items[id] <= 0) delete this.items[id]; }
    return got;
  }
  /** Tổng số cái của `id` đã xếp vào túi (trừ ô `except`) */
  planned(id, except = -1) {
    let n = 0;
    this.bag.forEach((s, i) => { if (s && s.id === id && i !== except) n += s.n; });
    return n;
  }
  /** Còn bao nhiêu cái `id` chưa xếp vào túi */
  free(id) { return Math.max(0, this.count(id) - this.planned(id)); }

  // ---------------------------------------------------------------- TÚI CHIẾN THUẬT (kế hoạch trước trận)
  /** Đặt ô i = n cái `id` (n bị giới hạn bởi stack và số còn trong kho). id = null để làm trống. */
  setBagSlot(i, id, n = 1) {
    if (i < 0 || i >= BAG_SLOTS) return;
    if (!id) { this.bag[i] = null; this.save(); return; }
    const def = ITEM_DEFS[id];
    if (!def) return;
    const can = Math.min(def.stack, this.count(id) - this.planned(id, i));
    this.bag[i] = can > 0 ? { id, n: Math.max(1, Math.min(n, can)) } : null;
    this.save();
  }
  /** Bỏ 1 món vào ô trống đầu tiên (hoặc cộng vào ô cùng loại chưa đầy). Trả về true nếu được. */
  addToBag(id) {
    const def = ITEM_DEFS[id];
    if (!def || this.free(id) <= 0) return false;
    const same = this.bag.findIndex((s) => s && s.id === id && s.n < def.stack);
    if (same >= 0) { this.bag[same].n++; this.save(); return true; }
    const empty = this.bag.findIndex((s) => !s);
    if (empty < 0) return false;
    this.bag[empty] = { id, n: 1 };
    this.save();
    return true;
  }
  /** Bớt 1 cái ở ô i (hết thì ô trống) */
  removeFromBag(i) {
    const s = this.bag[i];
    if (!s) return;
    if (--s.n <= 0) this.bag[i] = null;
    this.save();
  }
  /** Kho thay đổi (vd vừa chết mất đồ) -> cắt bớt kế hoạch túi cho khớp số lượng thật */
  normalizeBag() {
    for (let i = 0; i < BAG_SLOTS; i++) {
      const s = this.bag[i];
      if (!s) continue;
      const can = Math.min(ITEM_DEFS[s.id].stack, this.count(s.id) - this.planned(s.id, i));
      if (can <= 0) this.bag[i] = null; else s.n = Math.min(s.n, can);
    }
    if (this.bagWeapon >= this.weapons.length) this.bagWeapon = -1;
  }
  setBagWeapon(i) { this.bagWeapon = i >= 0 && i < this.weapons.length ? i : -1; this.save(); }
  get bagWeaponDef() { const w = this.weapons[this.bagWeapon]; return w ? { def: WEAPONS[w.id], lvl: w.lvl } : null; }
  setDuration(min) { if ([5, 7, 10].includes(min)) { this.duration = min; this.save(); } }

  // ---------------------------------------------------------------- VÀO / RA TRẬN
  /**
   * LÊN MÁY BAY: đồ trong túi rời Kho (từ đây có rủi ro mất).
   * Trả về bộ đồ mang theo { slots: [{ id, n } | null x4], weapon: { id, lvl } | null }.
   */
  checkout() {
    this.normalizeBag();
    const slots = this.bag.map((s) => {
      if (!s) return null;
      const n = this.take(s.id, s.n);
      return n > 0 ? { id: s.id, n } : null;
    });
    let weapon = null;
    if (this.bagWeapon >= 0) { weapon = this.weapons.splice(this.bagWeapon, 1)[0] ?? null; this.bagWeapon = -1; }
    this.stats.runs++;
    this.save();
    return { slots, weapon };
  }
  /** RÚT QUÂN THÀNH CÔNG: cất mọi thứ mang về. loot = { items: { id: n }, weapons: [{ id, lvl }] } */
  deposit(loot) {
    let total = 0;
    for (const [id, n] of Object.entries(loot.items ?? {})) { this.add(id, n); total += n; }
    for (const w of loot.weapons ?? []) if (WEAPONS[w.id]) { this.weapons.push({ id: w.id, lvl: w.lvl ?? 1 }); total++; }
    if (this.weapons.length > 40) this.weapons.splice(0, this.weapons.length - 40);   // kho súng tối đa 40 khẩu
    this.stats.extracted++;
    this.stats.bestLoot = Math.max(this.stats.bestLoot, total);
    this.normalizeBag();
    this.save();
    return total;
  }
  /** TỬ TRẬN: đồ đã mang theo đã mất từ lúc checkout -> chỉ ghi thống kê */
  lose() { this.stats.died++; this.normalizeBag(); this.save(); }
  /** Bán súng trong kho lấy Ngọc (Kho đầy hoặc súng không dùng) — trả về số Ngọc */
  sellWeapon(i) {
    const w = this.weapons[i];
    if (!w) return 0;
    const val = { common: 4, rare: 8, epic: 14, legend: 24, mythic: 40 }[WEAPONS[w.id]?.rarity] ?? 4;
    this.weapons.splice(i, 1);
    if (this.bagWeapon === i) this.bagWeapon = -1; else if (this.bagWeapon > i) this.bagWeapon--;
    this.save();
    return val * w.lvl;
  }
}

// =====================================================================================
//  ICON PIXEL VẬT PHẨM (16x16 ô logic) — dùng cho HUD (canvas game) và giao diện Kho Đồ (canvas nhỏ trong HTML)
// =====================================================================================
const ICON_ROWS = {
  medkit: [
    "................",
    "......####......",
    ".....#....#.....",
    ".##############.",
    "#wwwwwwwwwwwwww#",
    "#wwwwwwrrwwwwwg#",
    "#wwwwwwrrwwwwwg#",
    "#wwwwrrrrrrwwwg#",
    "#wwwwrrrrrrwwwg#",
    "#wwwwwwrrwwwwwg#",
    "#wwwwwwrrwwwwwg#",
    "#wwwwwwwwwwwwwg#",
    "#gggggggggggggg#",
    ".##############.",
    "................",
    "................",
  ],
  energyCell: [
    "......####......",
    ".....#ssss#.....",
    "....########....",
    "...#bbbbbbbb#...",
    "...#bBBbbbbb#...",
    "...#bBbbbybb#...",
    "...#bbbbyybb#...",
    "...#bbbyyybb#...",
    "...#bbyyyybb#...",
    "...#bbbbyybb#...",
    "...#bbbbybbb#...",
    "...#bbbybbbb#...",
    "...#bbbbbbbb#...",
    "...#dddddddd#...",
    "....########....",
    "................",
  ],
  grenade: [
    "........ss......",
    ".......s..s.....",
    "......####s.....",
    ".....#hhhh#.....",
    "....##########..",
    "...#ggGgggGggg#.",
    "..#gGGggGGggGGg#",
    "..#ggggggggggggg",
    "..#gGGggGGggGGg#",
    "..#ggggggggggggg",
    "..#gGGggGGggGGg#",
    "...#gggggggggg#.",
    "....##########..",
    "................",
    "................",
    "................",
  ],
  mine: [
    "................",
    "................",
    "................",
    "................",
    ".......rr.......",
    "......#rr#......",
    "....########....",
    "..##yyyyyyyy##..",
    ".#yyykkkkkkyyy#.",
    "#yyykyyyyyykyyy#",
    "#ddddddddddddddd",
    ".#dddddddddddd#.",
    "..############..",
    "................",
    "................",
    "................",
  ],
  stim: [
    "..............##",
    ".............#s#",
    "............#s#.",
    "........###ss#..",
    ".......#wwwww#..",
    "......#wooooo#..",
    ".....#wooooo#...",
    "....#wooooo#....",
    "...#wooooo#.....",
    "..#wwwwww#......",
    ".##wwwww#.......",
    "#k##www#........",
    ".#k.###.........",
    "#...............",
    "................",
    "................",
  ],
};
const ICON_PAL = {
  medkit: { "#": "#1a1018", w: "#f2ecf6", g: "#b8b0c8", r: "#e8343f" },
  energyCell: { "#": "#0c1830", s: "#c8d2e8", b: "#2f7ae8", B: "#9fd8ff", y: "#ffe26b", d: "#1c4aa8" },
  grenade: { "#": "#10180c", s: "#c8c0b0", h: "#5a5a64", g: "#4a6a2a", G: "#2c4218" },
  mine: { "#": "#14100a", r: "#ff3b3b", y: "#c8a030", k: "#3a2a10", d: "#5a4a2a" },
  stim: { "#": "#2a1410", s: "#c8d2e8", w: "#f2ecf6", o: "#ff8a2a", k: "#8a8296" },
};

/**
 * Vẽ icon vật phẩm `id` vào ô (x, y) cỡ `size` px (bội số của 16 cho nét nhất; 16 = 1 px/ô).
 * images: ảnh đã tải (nếu bạn chèn ảnh ở ITEM_IMAGES thì vẽ ảnh của bạn).
 */
const iconCache = new Map();
export function drawItemIcon(g, id, x, y, size = 16, images = null) {
  const img = images?.[`item:${id}`];
  if (img) { g.drawImage(img, Math.round(x), Math.round(y), size, size); return; }   // >>> ẢNH ICON CỦA BẠN
  if (typeof document !== "undefined") {   // vẽ sẵn 1 lần vào canvas nhỏ rồi dùng lại (HUD vẽ mỗi frame)
    const key = `${id}|${size}`;
    let cv = iconCache.get(key);
    if (!cv) { cv = document.createElement("canvas"); cv.width = cv.height = size; paintIcon(cv.getContext("2d"), id, 0, 0, size); iconCache.set(key, cv); }
    g.drawImage(cv, Math.round(x), Math.round(y));
    return;
  }
  paintIcon(g, id, x, y, size);
}
function paintIcon(g, id, x, y, size) {
  const rows = ICON_ROWS[id], pal = ICON_PAL[id];
  if (!rows) return;
  const k = size / 16;
  for (let j = 0; j < 16; j++) {
    const r = rows[j];
    for (let i = 0; i < 16; i++) {
      const col = pal[r[i]];
      if (!col) continue;
      g.fillStyle = col;
      g.fillRect(Math.round(x + i * k), Math.round(y + j * k), Math.ceil(k), Math.ceil(k));
    }
  }
}

/** Vẽ icon súng trong Kho Đồ (dùng icon vũ khí của weapons.js) */
export function drawStashWeaponIcon(g, w, x, y, bw, bh) {
  const def = WEAPONS[w.id];
  if (def) drawWeaponIcon(g, def, x, y, bw, bh, 1);
}

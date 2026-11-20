// =====================================================================================
//  TIẾN TRÌNH VĨNH VIỄN (lưu trong localStorage) — NGỌC (Gems), nâng cấp nhân vật, kho vũ khí
//
//  * Hết mỗi trận nhận NGỌC theo kết quả (gemsForRun).
//  * Bàn Nâng Cấp (Sảnh chờ): mỗi NHÂN VẬT nâng riêng 4 chỉ số (UPGRADES) bằng Ngọc.
//  * Kho Vũ Khí (Sảnh chờ): dùng Ngọc CHẾ TẠO (mở khóa) vũ khí, rồi chọn 1 khẩu làm VŨ KHÍ PHỤ mang vào trận.
//  Muốn đổi giá / số cấp: sửa UPGRADES và CRAFT_COST bên dưới.
// =====================================================================================
const KEY = "pixelArena.progress.v1";

/** Nâng cấp vĩnh viễn cho từng nhân vật. cost[i] = giá lên cấp i+1 */
export const UPGRADES = [
  { id: "hp",     name: "Sinh Lực",       desc: "+1 Máu tối đa mỗi cấp",                 max: 3, cost: [30, 60, 100], color: "#ff5a6a", icon: "♥" },
  { id: "armor",  name: "Giáp Rèn",       desc: "+1 Giáp tối đa mỗi cấp",                max: 3, cost: [30, 60, 100], color: "#7fa2d8", icon: "◆" },
  { id: "cd",     name: "Tĩnh Tâm",       desc: "-8% hồi chiêu kỹ năng mỗi cấp",          max: 3, cost: [40, 80, 120], color: "#c48cff", icon: "⟳" },
  { id: "weapon", name: "Rèn Vũ Khí",     desc: "Vũ khí khởi đầu +1★ (+25% sát thương)",  max: 2, cost: [60, 140],     color: "#ffb030", icon: "★" },
];
export const UPGRADE_BY_ID = Object.fromEntries(UPGRADES.map((u) => [u.id, u]));

/** Giá CHẾ TẠO vũ khí ở Kho Vũ Khí theo độ hiếm (Thần Thoại không chế được — phải GHÉP trong trận) */
export const CRAFT_COST = { common: 20, rare: 45, epic: 80, legend: 150 };

/** Ngọc nhận được sau 1 trận */
export function gemsForRun({ score = 0, bossKills = 0, wave = 1, kills = 0 }) {
  return Math.max(1, Math.floor(score / 200) + bossKills * 5 + (wave - 1) * 3 + Math.floor(kills / 40));
}

export class Progress {
  constructor() {
    this.gems = 40;                 // quà khởi đầu để thử Bàn Nâng Cấp / Kho Vũ Khí
    this.upgrades = {};             // { [charId]: { hp, armor, cd, weapon } }
    this.unlocked = [];             // id vũ khí đã chế tạo
    this.secondary = null;          // id vũ khí phụ mang vào trận (null = không mang)
    this.totalGems = 0;
    this.load();
  }

  load() {
    try {
      const d = JSON.parse(localStorage.getItem(KEY) ?? "null");
      if (!d || typeof d !== "object") return;
      if (Number.isFinite(d.gems)) this.gems = Math.max(0, Math.floor(d.gems));
      if (d.upgrades && typeof d.upgrades === "object") this.upgrades = d.upgrades;
      if (Array.isArray(d.unlocked)) this.unlocked = d.unlocked.filter((x) => typeof x === "string");
      if (typeof d.secondary === "string") this.secondary = d.secondary;
      if (Number.isFinite(d.totalGems)) this.totalGems = d.totalGems;
    } catch { /* dữ liệu hỏng: dùng mặc định */ }
  }
  save() {
    try { localStorage.setItem(KEY, JSON.stringify({ gems: this.gems, upgrades: this.upgrades, unlocked: this.unlocked, secondary: this.secondary, totalGems: this.totalGems })); } catch { /* bỏ qua */ }
  }

  /** Cấp nâng cấp `id` của nhân vật */
  level(charId, id) {
    const v = this.upgrades[charId]?.[id] ?? 0;
    return Math.max(0, Math.min(UPGRADE_BY_ID[id]?.max ?? 0, Math.trunc(v) || 0));
  }
  /** Giá lên cấp tiếp theo (null = đã tối đa) */
  nextCost(charId, id) {
    const u = UPGRADE_BY_ID[id], lv = this.level(charId, id);
    return lv >= u.max ? null : u.cost[lv];
  }
  /** Mua nâng cấp: trả về true nếu thành công */
  buyUpgrade(charId, id) {
    const cost = this.nextCost(charId, id);
    if (cost === null || this.gems < cost) return false;
    this.gems -= cost;
    (this.upgrades[charId] ??= {})[id] = this.level(charId, id) + 1;
    this.save();
    return true;
  }

  isUnlocked(wid) { return this.unlocked.includes(wid); }
  /** Chế tạo (mở khóa) vũ khí: trả về true nếu thành công */
  craft(wid, rarity) {
    const cost = CRAFT_COST[rarity];
    if (this.isUnlocked(wid) || cost === undefined || this.gems < cost) return false;
    this.gems -= cost;
    this.unlocked.push(wid);
    this.save();
    return true;
  }
  setSecondary(wid) {
    this.secondary = wid && this.isUnlocked(wid) ? wid : null;
    this.save();
  }

  addGems(n) {
    this.gems += n; this.totalGems += n;
    this.save();
  }
}

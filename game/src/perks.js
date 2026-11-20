// =====================================================================================
//  THẺ NÂNG CẤP ROGUELIKE — đầy thanh EXP thì chọn 1 trong 3 thẻ ngẫu nhiên
//
//  LUẬT CÂN BẰNG (bản 3.0):
//    * Mỗi thẻ có GIỚI HẠN cộng dồn (`max`). Đủ cấp thì thẻ không xuất hiện nữa.
//    * Thẻ có ĐỘ HIẾM: Thường / Hiếm / Sử Thi / Huyền Thoại — hiếm hơn thì ít gặp hơn.
//    * Chỉ số cộng theo kiểu CỘNG DỒN TUYẾN TÍNH (không nhân lũy thừa) -> không bao giờ "hack game".
//    * Đạn Phân Tách: tối đa 2 tia phụ, mỗi tia yếu đi (xem SPLIT_DMG) -> tổng sát thương chỉ tăng vừa phải.
//    * Mọi số liệu nằm ở đây: muốn chỉnh độ mạnh thì sửa trong file này.
// =====================================================================================

/** Độ hiếm: weight = trọng số bốc thẻ (càng lớn càng hay gặp) */
import { RARITY } from "./rarity.js";
export { RARITY };

/**
 * Hệ số sát thương MỖI tia khi có thêm tia phụ (Đạn Phân Tách).
 *   0 tia phụ: 1 tia x100%          = 100%
 *   1 tia phụ: 2 tia x 70%          = 140% (nếu cả 2 cùng trúng 1 mục tiêu)
 *   2 tia phụ: 3 tia x 55%          = 165%
 */
export const SPLIT_DMG = [1, 0.7, 0.55];

/** Ngưỡng hạ gục để hồi Giáp (Hấp Thụ) / hồi Máu (Ma Cà Rồng) theo cấp thẻ */
export const ABSORB_EVERY = [0, 8, 5];
export const VAMP_EVERY = [0, 30, 20];

/**
 * Bộ chỉ số nâng cấp của người chơi. Thẻ chỉ cộng vào các "bonus", còn hệ số thật được tính qua getter
 * (có trần / sàn) -> các chỗ khác trong game chỉ đọc mods.damageMul, mods.rateMul ...
 */
export class Mods {
  constructor(baseDamage = 1, char = {}) {
    this.baseDamage = baseDamage;
    this.dmgBonus = 0;      // +% sát thương (cộng dồn tuyến tính)
    this.rateBonus = 0;     // +% tốc độ tấn công
    this.speedBonus = 0;    // +% tốc chạy
    this.critBase = char.crit ?? 0.05;
    this.critBonus = 0;
    this.split = 0;         // số tia phụ (tối đa 2)
    this.pierce = 0;        // xuyên thêm quái
    this.bounce = 0;        // nảy tường
    this.absorb = 0;        // cấp thẻ Hấp Thụ
    this.cdCut = 0;         // giảm hồi chiêu kỹ năng
    this.dashCut = 0;       // giảm hồi chiêu Lướt
    this.dashDmg = 0;       // sát thương khi lướt qua quái
    this.vamp = 0;          // cấp thẻ Ma Cà Rồng
    this.thorns = 0;        // Giáp Gai
    this.luck = 0;          // Bùa May Mắn
    this.phoenix = 0;       // Lông Phượng Hoàng (hồi sinh)
    // Bùa tạm thời từ Đền Thờ (main.js đặt/xóa)
    this.buffDmg = 1; this.buffRate = 1; this.buffSpeed = 1;
  }
  get damageMul() { return this.baseDamage * (1 + this.dmgBonus) * this.buffDmg; }
  get knockMul() { return 1 + this.dmgBonus * 0.5; }
  /** Nhân vào thời gian giữa 2 phát (nhỏ hơn = bắn nhanh hơn). Sàn 0.6 */
  get rateMul() { return Math.max(0.6, 1 / ((1 + this.rateBonus) * this.buffRate)); }
  get speedMul() { return Math.min(1.45, (1 + this.speedBonus) * this.buffSpeed); }
  /** Hệ số hồi chiêu kỹ năng — sàn 0.64 (không bao giờ spam chiêu cuối được) */
  get cdMul() { return Math.max(0.64, 1 - this.cdCut); }
  get crit() { return Math.min(0.6, this.critBase + this.critBonus); }
  get splitDmg() { return SPLIT_DMG[Math.min(this.split, SPLIT_DMG.length - 1)]; }
  /** Các chỉ số dạng "cấp" luôn được kẹp trong giới hạn (an toàn kể cả khi bị cộng quá tay) */
  get absorbLv() { return Math.min(this.absorb, ABSORB_EVERY.length - 1); }
  get vampLv() { return Math.min(this.vamp, VAMP_EVERY.length - 1); }
  get dashCutC() { return Math.min(0.5, this.dashCut); }
}

export const PERKS = [
  // ---------------- THƯỜNG ----------------
  { id: "heavy",  name: "Đầu Đạn Nặng",       rarity: "common", max: 5, icon: "heavy",  color: "#ff6a4a",
    desc: "+15% sát thương mọi đòn đánh & kỹ năng, đẩy lùi mạnh hơn.", apply: (p) => { p.mods.dmgBonus += 0.15; } },
  { id: "rapid",  name: "Tay Nhanh",          rarity: "common", max: 4, icon: "rapid",  color: "#ffd34a",
    desc: "+10% tốc độ tấn công.", apply: (p) => { p.mods.rateBonus += 0.10; } },
  { id: "swift",  name: "Bước Chân Thần Tốc", rarity: "common", max: 3, icon: "swift",  color: "#5fdc8c",
    desc: "+8% tốc độ di chuyển.", apply: (p) => { p.mods.speedBonus += 0.08; } },
  { id: "vital",  name: "Tim Sắt",            rarity: "common", max: 4, icon: "vital",  color: "#ff4a5a",
    desc: "+1 Máu tối đa và hồi ngay 1 Máu.", apply: (p) => { p.maxHp++; p.hp = Math.min(p.maxHp, p.hp + 1); } },
  { id: "plate",  name: "Giáp Dày",           rarity: "common", max: 4, icon: "plate",  color: "#7fa2d8",
    desc: "+1 Giáp tối đa, giáp tự hồi nhanh hơn 10%.", apply: (p) => { p.maxArmor++; p.armor++; p.regen.interval *= 0.9; if (p.regenSaved) p.regenSaved.interval *= 0.9; } },
  { id: "magnet", name: "Nam Châm Ma Thuật",  rarity: "common", max: 3, icon: "magnet", color: "#ff7ad8",
    desc: "+35% tầm hút ngọc kinh nghiệm.", apply: (p) => { p.pickupRange *= 1.35; } },
  // ---------------- HIẾM ----------------
  { id: "crit",   name: "Mắt Đại Bàng",       rarity: "rare", max: 4, icon: "crit",   color: "#ffb030",
    desc: "+6% tỉ lệ CHÍ MẠNG (gây x2 sát thương).", apply: (p) => { p.mods.critBonus += 0.06; } },
  { id: "split",  name: "Đạn Phân Tách",      rarity: "rare", max: 2, icon: "split",  color: "#ffe26b",
    desc: "+1 tia đạn phụ. Mỗi tia yếu đi: 2 tia x70%, 3 tia x55%.", apply: (p) => { p.mods.split += 1; } },
  { id: "pierce", name: "Đạn Xuyên Giáp",     rarity: "rare", max: 2, icon: "pierce", color: "#e8e2f6",
    desc: "Đạn bay xuyên thêm 1 quái (súng, trượng, cung, phi tiêu).", apply: (p) => { p.mods.pierce += 1; } },
  { id: "bounce", name: "Đạn Nảy Tường",      rarity: "rare", max: 2, icon: "bounce", color: "#7cd8ff",
    desc: "Đạn chạm tường / cột đá nảy lại thêm 1 lần.", apply: (p) => { p.mods.bounce += 1; } },
  { id: "master", name: "Bậc Thầy Kỹ Năng",   rarity: "rare", max: 3, icon: "master", color: "#c48cff",
    desc: "-12% thời gian hồi chiêu kỹ năng (tối đa -36%).", apply: (p) => { p.mods.cdCut += 0.12; } },
  { id: "absorb", name: "Hấp Thụ Năng Lượng", rarity: "rare", max: 2, icon: "absorb", color: "#9fc4ff",
    desc: "Hồi 1 Giáp mỗi 8 quái hạ gục (cấp 2: mỗi 5 quái).", apply: (p) => { p.mods.absorb += 1; } },
  { id: "phantom", name: "Lướt Ảo Ảnh",       rarity: "rare", max: 2, icon: "phantom", color: "#a8dcff",
    desc: "-20% hồi chiêu Lướt; lướt xuyên qua quái gây 2 sát thương.", apply: (p) => { p.mods.dashCut += 0.2; p.mods.dashDmg += 2; } },
  // ---------------- SỬ THI ----------------
  { id: "vamp",   name: "Ma Cà Rồng",         rarity: "epic", max: 2, icon: "vamp",   color: "#e0304a",
    desc: "Hồi 1 Máu mỗi 30 quái hạ gục (cấp 2: mỗi 20 quái).", apply: (p) => { p.mods.vamp += 1; } },
  { id: "thorns", name: "Giáp Gai",           rarity: "epic", max: 2, icon: "thorns", color: "#c8a24a",
    desc: "Khi bị đánh: phản 3 sát thương và hất văng quái xung quanh.", apply: (p) => { p.mods.thorns += 1; } },
  { id: "luck",   name: "Bùa May Mắn",        rarity: "epic", max: 2, icon: "luck",   color: "#5fff7a",
    desc: "Rương xuất hiện nhanh hơn 20%, quái rơi Tim hồi máu nhiều hơn.", apply: (p) => { p.mods.luck += 1; } },
  // ---------------- HUYỀN THOẠI ----------------
  { id: "phoenix", name: "Lông Phượng Hoàng", rarity: "legend", max: 1, icon: "phoenix", color: "#ff8a2a",
    desc: "Khi gục ngã: HỒI SINH 1 lần với nửa Máu, bất tử 2 giây.", apply: (p) => { p.mods.phoenix = 1; } },
];

/** Thẻ dự phòng khi mọi thẻ đã đủ cấp (không giới hạn) */
export const FALLBACK_PERKS = [
  { id: "potion", name: "Bình Máu Lớn", rarity: "common", max: Infinity, icon: "vital", color: "#ff7a8a", fallback: true,
    desc: "Hồi 3 Máu và đầy Giáp.", apply: (p) => { p.hp = Math.min(p.maxHp, p.hp + 3); p.armor = p.maxArmor; } },
  { id: "bounty", name: "Kho Báu", rarity: "common", max: Infinity, icon: "luck", color: "#ffe26b", fallback: true,
    desc: "+300 điểm.", apply: (p, game) => { if (game) game.score += 300; } },
  { id: "forge", name: "Lò Rèn Thần", rarity: "rare", max: Infinity, icon: "heavy", color: "#ffb030", fallback: true,
    desc: "Nâng vũ khí đang cầm lên 1 sao ★ (đã tối đa thì +1 Giáp tối đa).", apply: (p, game) => { if (game && p.upgradeWeapon) p.upgradeWeapon(game); } },
];

export const PERK_BY_ID = Object.fromEntries([...PERKS, ...FALLBACK_PERKS].map((p) => [p.id, p]));

/**
 * Bốc n thẻ KHÁC NHAU theo trọng số độ hiếm, bỏ qua thẻ đã đủ cấp.
 * taken: { id: số lần đã chọn }. Thiếu thẻ thì bù bằng thẻ dự phòng.
 */
export function rollPerks(n = 3, taken = {}) {
  const pool = PERKS.filter((p) => (taken[p.id] ?? 0) < p.max);
  const out = [];
  while (out.length < n && pool.length) {
    const total = pool.reduce((s, p) => s + RARITY[p.rarity].weight, 0);
    let r = Math.random() * total, i = 0;
    for (; i < pool.length - 1; i++) { r -= RARITY[pool[i].rarity].weight; if (r <= 0) break; }
    out.push(pool.splice(i, 1)[0]);
  }
  for (const f of FALLBACK_PERKS) if (out.length < n) out.push(f);
  return out;
}

/** EXP cần để lên cấp tiếp theo — tăng dần (cấp càng cao càng lâu, tránh lên cấp liên tục về cuối trận) */
export const expToNext = (level) => Math.round(5 + (level - 1) * 4 + Math.max(0, level - 8) ** 1.6);

// Icon 10x10 cho thẻ: "#" = màu thẻ, "o" = sáng hơn, "*" = trắng
export const PERK_ICONS = {
  split:  ["........#.", ".......##.", "......#...", "*oo##o....", "*oo#######", "*oo##o....", "......#...", ".......##.", "........#.", ".........."],
  bounce: ["#.........", "##........", ".##.......", "..##....**", "...##..##.", "....####..", ".....##...", "..........", "##########", "oooooooooo"],
  absorb: ["##########", "#oooooooo#", "#oo*oo*oo#", "#oooooooo#", "#ooo**ooo#", ".#oooooo#.", "..#oooo#..", "...#oo#...", "....##....", ".........."],
  master: ["....**....", "...*oo*...", "..##oo##..", ".#..oo..#.", "#...oo...#", "#...ooo..#", "#........#", ".#......#.", "..##..##..", "....##...."],
  swift:  ["....####..", "...####...", "..####....", ".#######..", "....###...", "...###....", "..##......", ".##.......", "##........", "#........."],
  heavy:  ["...####...", "..#oooo#..", ".#oo**oo#.", ".#o*oooo#.", ".#oooooo#.", ".#oooooo#.", ".########.", ".#......#.", ".########.", ".........."],
  rapid:  ["#..#..#...", ".#..#..#..", "..#..#..#.", "...#..#..#", "..#..#..#.", ".#..#..#..", "#..#..#...", "..........", "oooooooooo", "**********"],
  vital:  [".##...##..", "#oo#.#oo#.", "#o*oooooo#", "#oooooooo#", ".#oooooo#.", "..#oooo#..", "...#oo#...", "....##....", "..........", ".........."],
  plate:  ["##########", "#oooooooo#", "#o**oooo##", "#o*ooooo#.", "#oooooo#..", ".#oooo#...", "..#oo#....", "...##.....", "..........", ".........."],
  magnet: ["##....##..", "##....##..", "oo....oo..", "##....##..", "##....##..", "##....##..", ".##..##...", "..####....", "..........", "*..*..*..."],
  crit:   ["....#.....", "....#.....", "..#ooo#...", "#oo***oo#.", "..#ooo#...", "....#.....", "....#.....", "..........", "#........#", ".#......#."],
  pierce: ["..........", "#.........", "##........", "*##ooooooo", "**###*####", "*##ooooooo", "##........", "#.........", "..........", ".........."],
  phantom:["....####..", "..##oooo#.", ".#o**ooo#.", "#ooooooo#.", "#oo.oo.o#.", "#ooooooo#.", "#o#o#o#o..", "..........", "*.*.*.*...", ".........."],
  vamp:   ["#........#", "##......##", "#o#....#o#", "#oo####oo#", "#o*oooo*o#", ".#oooooo#.", "..#o##o#..", "..*.##.*..", "..........", ".........."],
  thorns: ["#...#...#.", ".#..#..#..", "..#ooo#...", "##o***o##.", "..#ooo#...", ".#..#..#..", "#...#...#.", "..........", "oooooooooo", "##########"],
  luck:   [".##...##..", "#oo#.#oo#.", "#oo###oo#.", ".##o*o##..", ".##o*o##..", "#oo###oo#.", "#oo#.#oo#.", ".##...##..", "....#.....", "...#......"],
  phoenix:["#...##...#", "##.#oo#.##", "#o#o**o#o#", ".#oooooo#.", "..#oooo#..", "...#oo#...", "..#o..o#..", ".#o....o#.", "#........#", ".........."],
};

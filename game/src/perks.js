// =====================================================================================
//  THẺ NÂNG CẤP ROGUELIKE — đầy thanh EXP thì chọn 1 trong 3 thẻ ngẫu nhiên
//  Mỗi thẻ có thể chọn nhiều lần (cộng dồn). apply(p) chỉnh p.mods / chỉ số của người chơi.
// =====================================================================================
export const PERKS = [
  { id: "split",  name: "Đạn Phân Tách",       desc: "Bắn thêm +1 tia đạn phụ mỗi phát bắn.",         color: "#ffe26b", icon: "split",  apply: (p) => { p.mods.split += 1; } },
  { id: "bounce", name: "Đạn Nảy Tường",       desc: "Đạn va vào tường hoặc cột đá nảy lại 1 lần.",    color: "#7cd8ff", icon: "bounce", apply: (p) => { p.mods.bounce += 1; } },
  { id: "absorb", name: "Hấp Thụ Năng Lượng",  desc: "Hồi 1 điểm Giáp sau mỗi 6 quái vật hạ gục.",     color: "#7fa2d8", icon: "absorb", apply: (p) => { p.mods.absorb += 1; } },
  { id: "master", name: "Bậc Thầy Kỹ Năng",    desc: "Giảm 25% thời gian hồi chiêu kỹ năng (Space).",  color: "#c48cff", icon: "master", apply: (p) => { p.mods.cdMul *= 0.75; } },
  { id: "swift",  name: "Bước Chân Thần Tốc",  desc: "Tăng vĩnh viễn +15% tốc độ di chuyển.",          color: "#5fdc8c", icon: "swift",  apply: (p) => { p.mods.speedMul *= 1.15; } },
  { id: "heavy",  name: "Đầu Đạn Nặng",        desc: "Tăng +25% sát thương và lực đẩy lùi.",           color: "#ff6a4a", icon: "heavy",  apply: (p) => { p.mods.damageMul *= 1.25; p.mods.knockMul *= 1.25; } },
];

/** 3 thẻ khác nhau ngẫu nhiên */
export function rollPerks(n = 3) {
  const pool = [...PERKS], out = [];
  while (out.length < n && pool.length) out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  return out;
}

/** EXP cần để lên cấp tiếp theo */
export const expToNext = (level) => 5 + (level - 1) * 4;

// Icon 10x10 cho thẻ: "#" = màu thẻ, "o" = sáng hơn, "*" = trắng
export const PERK_ICONS = {
  split:  ["........#.", ".......##.", "......#...", "*oo##o....", "*oo#######", "*oo##o....", "......#...", ".......##.", "........#.", ".........."],
  bounce: ["#.........", "##........", ".##.......", "..##....**", "...##..##.", "....####..", ".....##...", "..........", "##########", "oooooooooo"],
  absorb: ["##########", "#oooooooo#", "#oo*oo*oo#", "#oooooooo#", "#ooo**ooo#", ".#oooooo#.", "..#oooo#..", "...#oo#...", "....##....", ".........."],
  master: ["....**....", "...*oo*...", "..##oo##..", ".#..oo..#.", "#...oo...#", "#...ooo..#", "#........#", ".#......#.", "..##..##..", "....##...."],
  swift:  ["....####..", "...####...", "..####....", ".#######..", "....###...", "...###....", "..##......", ".##.......", "##........", "#........."],
  heavy:  ["...####...", "..#oooo#..", ".#oo**oo#.", ".#o*oooo#.", ".#oooooo#.", ".#oooooo#.", ".########.", ".#......#.", ".########.", ".........."],
};


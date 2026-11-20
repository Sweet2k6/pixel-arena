// =====================================================================================
//  ĐỘ HIẾM — dùng chung cho VŨ KHÍ và THẺ NÂNG CẤP (cùng 1 bảng màu)
//
//    Thường (Trắng) → Hiếm (Xanh lá) → Sử Thi (Xanh dương) → Huyền Thoại (Cam) → Thần Thoại (Đỏ)
//
//  weight: trọng số bốc thẻ nâng cấp (src/perks.js). Thần Thoại không có thẻ — chỉ có vũ khí ghép / Boss.
// =====================================================================================
export const RARITY = {
  common: { name: "Thường",      color: "#e8e8f0", dark: "#5a5a6a", weight: 60, rank: 0 },
  rare:   { name: "Hiếm",        color: "#5fdc5f", dark: "#1e5a24", weight: 27, rank: 1 },
  epic:   { name: "Sử Thi",      color: "#4aa8ff", dark: "#173a6a", weight: 10, rank: 2 },
  legend: { name: "Huyền Thoại", color: "#ff9a2a", dark: "#6a3408", weight: 3,  rank: 3 },
  mythic: { name: "Thần Thoại",  color: "#ff3b3b", dark: "#6a0e14", weight: 0,  rank: 4 },
};
export const RARITY_ORDER = ["common", "rare", "epic", "legend", "mythic"];

/** Màu theo độ hiếm (không có độ hiếm -> trắng xám) */
export const rarityColor = (r) => RARITY[r]?.color ?? "#c4cede";
export const rarityName = (r) => RARITY[r]?.name ?? "";

// =====================================================================================
//  DỮ LIỆU NHÂN VẬT — >>> FILE NÀY LÀ CHỖ BẠN THÊM / SỬA / XÓA NHÂN VẬT <<<
//
//  Mỗi phần tử trong mảng CHARACTERS là 1 nhân vật. Muốn thêm nhân vật mới:
//    1. Copy nguyên 1 khối { ... } bên dưới, dán vào cuối mảng.
//    2. Đổi `id` (không trùng, không dấu, không khoảng trắng), tên, mô tả, chỉ số.
//    3. Chọn `weapon.type`  : "gun" (súng bắn đạn) | "melee" (đấm/chém cận chiến) | "magic" (trượng bắn cầu năng lượng)
//       Chọn `skill.type`   : "rage" (Cuồng Nộ) | "dash" (Lướt Xung Kích) | "nova" (Bão Cầu Năng Lượng)
//       (logic của từng loại nằm trong main.js, mục SKILL_HANDLERS / Player.attack)
//    4. Chèn ảnh của bạn vào 3 ô `sprite`, `weaponImg`, `skillIcon` (để "" thì game tự vẽ hình pixel thay thế).
//
//  Đường dẫn ảnh tính từ thư mục  game/  — ví dụ "assets/images/gunner.png"
// =====================================================================================

/** Giá trị tối đa để vẽ độ dài các thanh chỉ số trong Màn hình chính (không ảnh hưởng gameplay). */
export const STAT_MAX = { hp: 10, armor: 10, speed: 130 };

/**
 * Giáp tự hồi phục (kiểu Soul Knight): nếu KHÔNG nhận sát thương trong `delay` giây,
 * giáp hồi 1 điểm mỗi `interval` giây cho tới khi đầy. Từng nhân vật có thể ghi đè bằng `armorRegen`.
 */
export const ARMOR_REGEN = { delay: 3, interval: 0.6 };

export const CHARACTERS = [
  // -----------------------------------------------------------------------------------
  // NHÂN VẬT 1 — XẠ THỦ (kiểu Knight của Soul Knight): cân bằng, bắn súng
  // -----------------------------------------------------------------------------------
  {
    id: "gunner",
    name: "Xạ Thủ",
    title: "Hiệp sĩ súng lục",
    desc: "Lính đánh thuê bền bỉ, máu và giáp cân bằng. Dễ chơi, hợp cho người mới.",

    // >>> CHÈN ẢNH NHÂN VẬT: PNG nền trong suốt, quay mặt sang PHẢI, chân chạm mép dưới ảnh (~24x38 px là vừa)
    sprite: "",          // ví dụ: "assets/images/gunner.png"
    // >>> CHÈN ẢNH VŨ KHÍ: nằm ngang, nòng/đầu chĩa sang PHẢI, tay cầm ở mép TRÁI
    weaponImg: "",       // ví dụ: "assets/images/gun.png"
    // >>> CHÈN ICON KỸ NĂNG: ảnh vuông (16x16, 20x20 hoặc 32x32 px)
    skillIcon: "",       // ví dụ: "assets/images/skill_rage.png"

    // Màu hình pixel thay thế (chỉ dùng khi `sprite` để trống). A = sáng nhất ... J = tối nhất, m = điểm nhấn
    fallback: {
      hat: "plume",      // phụ kiện trên đầu: "plume" (chùm lông) | "band" (băng đô) | "wizard" (mũ phù thủy) | ""
      accent: "#ff4a3a", // màu phụ kiện
      palette: { A: "#dde7ff", B: "#a3b8ec", C: "#6f89c9", D: "#4c619f", E: "#5b70b1", F: "#3b4b82", G: "#2d3967", J: "#1f2851", m: "#ffd34a" },
    },

    stats: { hp: 6, armor: 5, speed: 95 },   // Máu, Giáp, Tốc độ (pixel/giây)

    weapon: {
      name: "Súng Lục Cũ",
      desc: "Bắn nhanh, đạn bay xa",
      type: "gun",
      damage: 1,
      fireRate: 0.16,      // giây giữa 2 phát (càng nhỏ bắn càng nhanh)
      bulletSpeed: 330,
      bulletRadius: 3,
      spread: 0.08,        // độ lệch ngẫu nhiên (radian)
      color: "#ffe26b",    // màu đạn vẽ thay thế
      sound: "shoot",
    },

    skill: {
      type: "rage",
      name: "Cuồng Nộ",
      desc: "Tăng gấp đôi tốc độ bắn / tấn công trong 4 giây.",
      cooldown: 12,        // giây hồi chiêu
      duration: 4,         // giây hiệu lực
      fireRateMult: 0.5,   // 0.5 = thời gian giữa 2 phát còn một nửa -> bắn nhanh gấp đôi
      color: "#ff4a3a",    // màu viền ô kỹ năng & icon thay thế
    },
  },

  // -----------------------------------------------------------------------------------
  // NHÂN VẬT 2 — VÕ SƯ (kiểu Dan the Man): máu cao, chạy nhanh, đánh cận chiến
  // -----------------------------------------------------------------------------------
  {
    id: "monk",
    name: "Võ Sư",
    title: "Quyền thủ đường phố",
    desc: "Cận chiến hung hãn: lao thẳng vào đám đông và đấm bay mọi thứ. Máu trâu, chân nhanh.",

    sprite: "",          // >>> CHÈN ẢNH NHÂN VẬT, ví dụ: "assets/images/monk.png"
    weaponImg: "",       // >>> CHÈN ẢNH VŨ KHÍ (găng tay), ví dụ: "assets/images/gauntlet.png"
    skillIcon: "",       // >>> CHÈN ICON KỸ NĂNG, ví dụ: "assets/images/skill_dash.png"

    fallback: {
      hat: "band",
      accent: "#ff3b4a",
      palette: { A: "#ffe3b8", B: "#f2b26e", C: "#d9853c", D: "#a95b25", E: "#b9692d", F: "#8a4519", G: "#6a3313", J: "#4a230d", m: "#ff3b4a" },
    },

    stats: { hp: 9, armor: 3, speed: 118 },

    weapon: {
      name: "Găng Sắt",
      desc: "Đấm cận chiến, đẩy lùi mạnh",
      type: "melee",
      damage: 2,
      fireRate: 0.3,       // giây giữa 2 cú đấm (giữ chuột trái để đấm liên tục)
      range: 40,           // tầm đấm (pixel)
      arc: 1.1,            // nửa góc vùng đánh (radian)
      knockback: 200,
      color: "#ffb347",
      slashPalette: ["#3a1408", "#7a2a10", "#c4501a", "#f08a2a", "#ffc94a", "#fff2a8", "#ffffff"], // màu vệt đấm (tối -> sáng)
      sound: "punch",
    },

    skill: {
      type: "dash",
      name: "Lướt Xung Kích",
      desc: "Lướt cực nhanh về phía con trỏ, miễn nhiễm sát thương khi lướt; hất tung và gây sát thương mọi kẻ địch trên đường.",
      cooldown: 5,
      dashSpeed: 520,      // pixel/giây khi lướt
      dashTime: 0.24,      // giây lướt (quãng đường ≈ dashSpeed × dashTime)
      damage: 3,
      knockback: 260,
      launchHeight: 18,    // độ cao hất tung (pixel)
      color: "#ffb347",
    },
  },

  // -----------------------------------------------------------------------------------
  // NHÂN VẬT 3 — PHÁP SƯ NĂNG LƯỢNG: giáp cao, máu thấp, bắn cầu năng lượng
  // -----------------------------------------------------------------------------------
  {
    id: "mage",
    name: "Pháp Sư Năng Lượng",
    title: "Học giả hư không",
    desc: "Lá chắn năng lượng dày nhưng thân thể mỏng manh. Giữ khoảng cách và quét sạch bầy quái.",

    sprite: "",          // >>> CHÈN ẢNH NHÂN VẬT, ví dụ: "assets/images/mage.png"
    weaponImg: "",       // >>> CHÈN ẢNH VŨ KHÍ (trượng), ví dụ: "assets/images/staff.png"
    skillIcon: "",       // >>> CHÈN ICON KỸ NĂNG, ví dụ: "assets/images/skill_nova.png"

    fallback: {
      hat: "wizard",
      accent: "#7a52d6",
      palette: { A: "#ece0ff", B: "#bea2f2", C: "#9070d8", D: "#6649aa", E: "#7454ba", F: "#4c3489", G: "#38256b", J: "#27194f", m: "#5ef0ff" },
    },

    stats: { hp: 4, armor: 8, speed: 90 },

    weapon: {
      name: "Trượng Năng Lượng",
      desc: "Cầu năng lượng chậm nhưng mạnh",
      type: "magic",
      damage: 2,
      fireRate: 0.34,
      bulletSpeed: 230,
      bulletRadius: 4,
      spread: 0.04,
      color: "#5ef0ff",
      sound: "magicShoot",
    },

    skill: {
      type: "nova",
      name: "Bão Cầu Năng Lượng",
      desc: "Phóng ra 12 cầu năng lượng tỏa tròn 360° quanh nhân vật.",
      cooldown: 7,
      count: 12,           // số viên đạn
      damage: 2,
      bulletSpeed: 210,
      color: "#5ef0ff",
    },
  },
];

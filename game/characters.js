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
//       `sprite` là 1 ảnh TĨNH. Muốn nhân vật có hoạt ảnh từ SPRITESHEET của bạn: thêm khối `spritesheet`
//       (xem nhân vật Thanh Xuân ở cuối file làm mẫu: đường dẫn ảnh, kích thước ô, hàng/frame của từng hoạt ảnh).
//       Không có `spritesheet` thì game vẽ nhân vật CHIBI theo khối `chibi` (kiểu đầu, màu tóc, áo, quần...).
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

    // Ngoại hình CHIBI kiểu Soul Knight (vẽ bằng code, xem src/chibi.js):
    //   head: "knight" (mũ sắt + chùm lông) | "monk" (tóc dựng + băng đô) | "wizard" (mũ phù thủy) | "helm" | "skull" | "" (tóc thường)
    chibi: { head: "knight", helm: "#c4cede", accent: "#ff4a3a", outfit: "#4c6ab0", outfit2: "#6c84c4", belt: "#ffd34a", pants: "#323a5a", shoes: "#22243a" },
    // Màu hình người pixelfx kiểu cũ (dự phòng). A = sáng nhất ... J = tối nhất, m = điểm nhấn
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

    chibi: { head: "monk", hair: "#2a1c18", accent: "#ff3b4a", skin: "#ffcfa0", outfit: "#f08a2a", outfit2: "#ffcfa0", armSkin: true, belt: "#2a2028", pants: "#c86a20", shoes: "#2a2028" },
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

    chibi: { head: "wizard", hair: "#e8e0ff", accent: "#7a52d6", accent2: "#ffd34a", outfit: "#6649aa", outfit2: "#7a5ac0", robe: true, belt: "#ffd34a", shoes: "#2a1c40" },
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

  // -----------------------------------------------------------------------------------
  // NHÂN VẬT 4 — THANH XUÂN: tay không bắn gai băng, đóng băng quái; tuyệt chiêu Ngại Ngùng
  // -----------------------------------------------------------------------------------
  {
    id: "thanhxuan",
    name: "Thanh Xuân",
    title: "Cô nàng băng giá hay ngại",
    desc: "Đeo balo đi học mà lạc vào hầm ngục. Tay không bắn gai băng đóng băng quái; hễ ngại là trời đất nổi băng sét.",

    sprite: "", weaponImg: "", skillIcon: "",

    // >>> SPRITESHEET CỦA BẠN — làm sạch từ ảnh gốc thanhxuan-goc.png bằng lệnh:
    //     python game/tools/prepare_spritesheet.py game/assets/images/actors/thanhxuan-goc.png game/assets/images/actors/thanhxuan.png 40 4 8 4 --shy=0:3 --colors=14 --outline --erase=393:79:428:97 --head=0.85
    //     Mỗi hàng 1 hoạt ảnh, mỗi cột 1 frame. Lệch thì chỉnh frameW/frameH, anchorX/anchorY (vị trí CHÂN trong 1 ô).
    spritesheet: {
      src: "assets/images/actors/thanhxuan.png",
      frameW: 39, frameH: 41,          // kích thước 1 ô (pixel)
      anchorX: 19, anchorY: 39,        // điểm chân trong ô
      hand: [7, -15],                  // bàn tay phát gai băng (tính từ chân, quay mặt sang phải)
      anims: {
        idle:  { row: 0, seq: [0, 1, 2, 1], fps: 4 },          // seq = thứ tự cột phát lặp lại
        run:   { row: 1, frames: 8, fps: 14, contact: [2, 6] }, // contact = frame chân chạm đất (tung bụi)
        skill: { row: 2, frames: 4, fps: 12 },                  // lướt (Shift)
        shy:   { row: 3, frames: 4, fps: 10 },                  // ôm mặt ngại ngùng (tuyệt chiêu)
      },
    },
    // >>> SKIN THAY ĐỔI: mỗi lần dùng tuyệt chiêu đổi sang skin kế tiếp, hết danh sách thì về skin gốc.
    //     Mỗi skin là 1 spritesheet CÙNG bố cục với `spritesheet` ở trên (chỉ khác màu áo quần).
    //     Hoodie đen mở khóa + áo trắng + quần đen: tạo bằng  python game/tools/make_hoodie_skin.py <sheet gốc> <sheet mới>
    skins: [
      { name: "Hoodie đen", src: "assets/images/actors/thanhxuan-hoodie.png" },
    ],
    chibi: { head: "", hair: "#2a2630", outfit: "#1e1c26", outfit2: "#1e1c26", pants: "#c8ccd8", shoes: "#3a3a48" },
    fallback: { hat: "", accent: "#7cd8ff", palette: { A: "#e8f4ff", B: "#b8d4ec", C: "#88a8cc", D: "#5c7aa4", E: "#6c88b0", F: "#465e86", G: "#34486a", J: "#24324e", m: "#7cd8ff" } },

    stats: { hp: 8, armor: 7, speed: 108 },

    weapon: {
      name: "Tay Không · Đường Băng",
      desc: "Triệu hồi đường gai băng dài xuyên qua mọi quái, đóng băng 3 giây",
      type: "frostHand",
      damage: 3,           // mỗi con trên đường băng trúng 1 lần
      fireRate: 0.42,
      range: 210,          // >>> ĐỘ DÀI ĐƯỜNG BĂNG (pixel)
      width: 20,           // độ rộng vùng sát thương
      speed: 650,          // tốc độ băng lan ra (pixel/giây)
      freeze: 3,           // giây đóng băng quái (Mini-Boss chỉ bị 1 giây)
      color: "#a6ecff",
      sound: "iceShot",
    },

    skill: {
      type: "shy",
      name: "Ngại Ngùng",
      desc: "Ôm mặt ngại ngùng — băng giá đóng băng rồi sấm sét xóa sổ mọi quái trên màn hình (Mini-Boss mất 30% máu). Bất tử khi đang ngại.",
      cooldown: 10,
      duration: 1.5,       // giây ôm mặt
      bossDamage: 0.3,     // Mini-Boss mất 30% máu tối đa
      color: "#7cd8ff",
    },
  },
];

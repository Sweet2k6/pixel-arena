// =====================================================================================
//  DỮ LIỆU NHÂN VẬT — >>> FILE NÀY LÀ CHỖ BẠN THÊM / SỬA / XÓA NHÂN VẬT <<<
//
//  Mỗi phần tử trong mảng CHARACTERS là 1 nhân vật. Muốn thêm nhân vật mới:
//    1. Copy nguyên 1 khối { ... } bên dưới, dán vào cuối mảng.
//    2. Đổi `id` (không trùng, không dấu, không khoảng trắng), tên, mô tả, chỉ số.
//    3. Chọn `weapon.type`  : "gun" (súng) | "melee" (đấm) | "magic" (trượng cầu năng lượng) | "frostHand" (đường băng)
//                              | "hammer" (búa nện + choáng) | "bow" (cung xuyên) | "soul" (cầu linh hồn đuổi mục tiêu) | "shuriken" (phi tiêu nảy)
//                              ... hoặc bất kỳ loại nào trong src/weapons.js (shotgun, laser, sniper, rocket...)
//       Chọn `skill.type`   : "rage" (Cuồng Nộ) | "dash" (Lướt Xung Kích) | "nova" (Bão Cầu) | "shy" (Ngại Ngùng)
//                              | "holy" (Khiên Thánh Quang) | "arrowRain" (Mưa Tên) | "summon" (Triệu Hồi Vong Linh) | "blink" (Ảnh Sát)
//       `passive`: dòng mô tả nội tại hiển thị ở menu · `crit`: tỉ lệ chí mạng gốc (mặc định 0.05 = 5%)
//       (logic của từng loại nằm trong main.js, mục SKILL_HANDLERS / Player.attack)
//    4. Chèn ảnh của bạn vào 3 ô `sprite`, `weaponImg`, `skillIcon` (để "" thì game tự vẽ hình pixel thay thế).
//       `sprite` là 1 ảnh TĨNH. Muốn nhân vật có hoạt ảnh từ SPRITESHEET của bạn: thêm khối `spritesheet`
//       (xem nhân vật Bạch Ngưng Băng ở cuối file làm mẫu: đường dẫn ảnh, kích thước ô, hàng/frame của từng hoạt ảnh).
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

// 9 nhân vật SINH VIÊN (tỉ lệ người thật) nằm riêng trong students.js — được nối vào cuối danh sách bên dưới
import { STUDENTS } from "./students.js";
import { CLASSMATES } from "./classmates.js";   // 23 bạn cùng lớp (nhân vật phụ)

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

    stats: { hp: 6, armor: 5, speed: 95, energy: 180 },   // Máu, Giáp, Tốc độ (pixel/giây), Năng Lượng tối đa
    crit: 0.08,
    passive: "Tay súng lão luyện: 8% chí mạng gốc.",

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

    stats: { hp: 9, armor: 3, speed: 118, energy: 140 },
    passive: "Da thép: mỗi lần mất Máu được bất tử lâu hơn (1.1 giây).",
    invuln: 1.1,

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

    stats: { hp: 4, armor: 8, speed: 90, energy: 240 },
    passive: "Lá chắn năng lượng: Giáp tự hồi nhanh gấp rưỡi.",
    armorRegen: { delay: 2.4, interval: 0.4 },

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
    id: "thanhxuan", group: "student",   // Bạch Ngưng Băng = Thanh Xuân (nhân vật chính)
    name: "Bạch Ngưng Băng",
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

    stats: { hp: 7, armor: 6, speed: 104, energy: 200 },
    passive: "Máu lạnh: quái đang đóng băng nhận thêm 20% sát thương.",
    frozenBonus: 0.2,

    weapon: {
      name: "Tay Không · Đường Băng",
      desc: "Đường gai băng xuyên mọi quái, đóng băng 1.6 giây",
      type: "frostHand",
      damage: 2.4,         // mỗi con trên đường băng trúng 1 lần
      fireRate: 0.5,
      range: 200,          // >>> ĐỘ DÀI ĐƯỜNG BĂNG (pixel)
      width: 20,           // độ rộng vùng sát thương
      speed: 650,          // tốc độ băng lan ra (pixel/giây)
      freeze: 1.6,         // giây đóng băng quái (Boss tối đa 0.8s; tan băng xong miễn nhiễm 1.2s)
      color: "#a6ecff",
      sound: "iceShot",
    },

    skill: {
      type: "shy",
      name: "Ngại Ngùng",
      desc: "Ôm mặt ngại ngùng — băng giá đóng băng rồi sấm sét xóa sổ quái thường trên màn hình (Tinh Anh mất 50%, Boss mất 20% máu). Bất tử khi đang ngại.",
      cooldown: 16,
      duration: 1.5,       // giây ôm mặt
      eliteDamage: 0.5,    // quái Tinh Anh mất 50% máu tối đa
      bossDamage: 0.2,     // Boss mất 20% máu tối đa
      color: "#7cd8ff",
    },
  },

  // -----------------------------------------------------------------------------------
  // NHÂN VẬT 5 — THÁNH KỴ SĨ: trâu bò, búa nện choáng, khiên thánh bất tử + hồi máu
  // -----------------------------------------------------------------------------------
  {
    id: "paladin",
    name: "Thánh Kỵ Sĩ",
    title: "Người gác cổng ánh sáng",
    desc: "Giáp vàng dày, búa thánh nặng trịch nện choáng cả đám quái. Chậm chạp nhưng cực kỳ khó gục.",
    sprite: "", weaponImg: "", skillIcon: "",
    chibi: { head: "paladin", helm: "#f0c040", accent: "#ff4a3a", accent2: "#ffffff", outfit: "#e8e2d0", outfit2: "#c8a24a", belt: "#8a5a2a", pants: "#7a6a4a", shoes: "#3a2a1a", cape: "#c8343f", chest: "#f0c040" },
    fallback: { hat: "helm", accent: "#f0c040", palette: { A: "#fff8e0", B: "#f0d890", C: "#d8b050", D: "#a88030", E: "#b89040", F: "#806020", G: "#5a4418", J: "#3a2c10", m: "#ff4a3a" } },
    stats: { hp: 8, armor: 7, speed: 86, energy: 160 },
    passive: "Phúc lành: mỗi khi lên cấp hồi 1 Máu.",
    levelHeal: 1,
    weapon: {
      name: "Búa Thánh",
      desc: "Nện xuống trước mặt, choáng quái 0.5 giây",
      type: "hammer",
      damage: 3.5,
      fireRate: 0.62,
      range: 46,           // khoảng cách tâm cú nện
      aoe: 34,             // bán kính vùng nện
      knockback: 280,
      stun: 0.5,
      color: "#ffe26b",
      sound: "hammer",
    },
    skill: {
      type: "holy",
      name: "Khiên Thánh Quang",
      desc: "Cột sáng thánh giáng xuống: bất tử 3 giây, hồi 2 Máu, hất văng quái xung quanh (5 sát thương) và xóa đạn địch.",
      cooldown: 16,
      duration: 3,
      heal: 2,
      damage: 5,
      radius: 95,
      color: "#ffd25e",
    },
  },

  // -----------------------------------------------------------------------------------
  // NHÂN VẬT 6 — THỢ SĂN: cung xuyên thấu, chí mạng cao, Mưa Tên diện rộng
  // -----------------------------------------------------------------------------------
  {
    id: "ranger",
    name: "Thợ Săn",
    title: "Xạ thủ rừng sâu",
    desc: "Nhanh nhẹn, mũi tên xuyên 2 quái và hay trúng chỗ hiểm. Gọi mưa tên trút xuống bầy quái.",
    sprite: "", weaponImg: "", skillIcon: "",
    chibi: { head: "hood", accent: "#3e7a38", accent2: "#e8343f", skin: "#ffd2a8", outfit: "#5a7a3a", outfit2: "#7a5a34", belt: "#3a2416", pants: "#4a3a28", shoes: "#2a1c12", cape: "#2e5a2a" },
    fallback: { hat: "hood", accent: "#3e7a38", palette: { A: "#e0f0c8", B: "#b0d090", C: "#80a860", D: "#5a7a3a", E: "#68884a", F: "#46602c", G: "#344820", J: "#243414", m: "#e8343f" } },
    stats: { hp: 5, armor: 4, speed: 112, energy: 180 },
    crit: 0.12,
    passive: "Mắt diều hâu: 12% chí mạng gốc.",
    weapon: {
      name: "Cung Săn",
      desc: "Tên gỗ xuyên 1 quái, +10% chí mạng. GIỮ chuột để kéo căng: tên xuyên thấu cực mạnh",
      type: "bow",
      charge: { time: 0.85, min: 0.18, dmg: 2 },   // >>> TÍCH LỰC: giữ 0.85s = mạnh nhất (x3 sát thương)
      damage: 2.4,
      fireRate: 0.42,
      bulletSpeed: 430,
      bulletRadius: 3,
      pierce: 1,
      critBonus: 0.1,
      knockback: 110,
      color: "#e8343f",
      sound: "bow",
    },
    skill: {
      type: "arrowRain",
      name: "Mưa Tên",
      desc: "Trút 30 mũi tên xuống vùng đang ngắm (bán kính 75px) trong 1.4 giây, mỗi mũi 2 sát thương + làm chậm.",
      cooldown: 9,
      arrows: 30,
      duration: 1.4,
      radius: 75,
      range: 230,
      damage: 2,
      color: "#e8343f",
    },
  },

  // -----------------------------------------------------------------------------------
  // NHÂN VẬT 7 — TỬ LINH SƯ: cầu linh hồn tự đuổi quái, triệu hồi vong linh, hút hồn hồi máu
  // -----------------------------------------------------------------------------------
  {
    id: "necro",
    name: "Tử Linh Sư",
    title: "Kẻ gọi hồn nghĩa địa",
    desc: "Cầu linh hồn tự bay theo quái nên không bao giờ trượt. Triệu hồi vong linh lao vào nổ tung kẻ địch.",
    sprite: "", weaponImg: "", skillIcon: "",
    chibi: { head: "skull", skin: "#e4f2ea", accent: "#1c3a36", eyes: "#45f0b0", outfit: "#22383a", outfit2: "#2c4a44", robe: true, belt: "#45c4a0", shoes: "#14201e", chest: "#45c4a0" },
    fallback: { hat: "hood", accent: "#1c3a36", palette: { A: "#d8f4e8", B: "#a0d0c0", C: "#68a090", D: "#3c6a60", E: "#4a7a70", F: "#2c4a44", G: "#1e3430", J: "#122420", m: "#45f0b0" } },
    stats: { hp: 5, armor: 6, speed: 92, energy: 220 },
    passive: "Hút hồn: cứ 15 quái hạ gục hồi 1 Máu.",
    soulHeal: 15,
    weapon: {
      name: "Trượng Linh Hồn",
      desc: "Cầu linh hồn tự đuổi theo quái gần nhất",
      type: "soul",
      damage: 1.8,
      fireRate: 0.38,
      bulletSpeed: 190,
      bulletRadius: 3,
      homing: 4.5,
      life: 2.2,
      knockback: 70,
      color: "#45f0b0",
      sound: "soul",
    },
    skill: {
      type: "summon",
      name: "Triệu Hồi Vong Linh",
      desc: "Gọi 4 vong linh bay quanh mình trong 10 giây; thấy quái là lao tới nổ tung (4 sát thương diện rộng).",
      cooldown: 13,
      count: 4,
      life: 10,
      damage: 4,
      radius: 28,
      color: "#45f0b0",
    },
  },

  // -----------------------------------------------------------------------------------
  // NHÂN VẬT 8 — BÓNG ĐÊM (NINJA): cực nhanh, phi tiêu nảy, dịch chuyển chém xuyên đường
  // -----------------------------------------------------------------------------------
  {
    id: "ninja",
    name: "Bóng Đêm",
    title: "Sát thủ vô ảnh",
    desc: "Máu giấy nhưng nhanh như gió. Phi tiêu bật qua lại giữa các quái, Ảnh Sát lướt xuyên đội hình chém tất cả.",
    sprite: "", weaponImg: "", skillIcon: "",
    chibi: { head: "ninja", hair: "#26232f", accent: "#e8343f", skin: "#ffd2a8", outfit: "#2c2a38", outfit2: "#3a3848", belt: "#e8343f", pants: "#24222e", shoes: "#16141c", cape: "#e8343f" },
    fallback: { hat: "band", accent: "#e8343f", palette: { A: "#c8c4d8", B: "#8a86a0", C: "#5a5670", D: "#3a3848", E: "#46445a", F: "#2c2a38", G: "#201e2a", J: "#14121c", m: "#e8343f" } },
    stats: { hp: 5, armor: 3, speed: 126, energy: 160 },
    crit: 0.18,
    passive: "Sát thủ: 18% chí mạng gốc, Lướt (Shift) hồi nhanh hơn 30%.",
    rollCut: 0.3,
    weapon: {
      name: "Phi Tiêu",
      desc: "Ném cực nhanh, mỗi phi tiêu bật sang 1 quái khác",
      type: "shuriken",
      damage: 1.25,
      fireRate: 0.19,
      bulletSpeed: 400,
      bulletRadius: 3,
      ricochet: 1,
      spread: 0.05,
      life: 1.1,
      knockback: 60,
      color: "#e8343f",
      sound: "shuriken",
    },
    skill: {
      type: "blink",
      name: "Ảnh Sát",
      desc: "Dịch chuyển tức thời 150px về hướng ngắm, chém mọi quái trên đường đi (6 sát thương, +50% chí mạng). Bất tử khi lướt.",
      cooldown: 5,
      range: 150,
      damage: 6,
      width: 18,
      color: "#e8343f",
    },
  },

  // -----------------------------------------------------------------------------------
  // NHÂN VẬT 9 — MINH HUY: tân binh lùn, tóc ngố bết mồ hôi, 2 răng thỏ, đi giày trắng. YẾU NHẤT game (đã nerf),
  //              bù lại nhỏ con khó trúng + lục đồ cực nhanh (hợp chế độ Rút Quân). Sợ quá thì xả đạn loạn xạ.
  // -----------------------------------------------------------------------------------
  {
    id: "tingo", group: "student",
    name: "Minh Huy",
    title: "Tân binh run rẩy",
    desc: "Lính mới lùn tịt, tóc ngố bết mồ hôi, hai răng thỏ, đôi giày trắng tinh. Máu mỏng, bắn yếu, tay run — nhưng nhỏ con khó trúng và lục đồ cực nhanh. Sợ quá thì nhắm mắt xả đạn loạn xạ.",
    sprite: "", weaponImg: "", skillIcon: "",
    // short: 2 = lùn hơn 2 pixel · head "bowl" = tóc ngố bát úp + 2 răng thỏ (src/chibi.js) · vest = áo giáp chiến thuật · shoes + sole = giày trắng đế xám
    chibi: { head: "bowl", short: 2, hair: "#1a1c22", skin: "#f0c79c", eyes: "#2a1a12", outfit: "#2c3038", outfit2: "#3a3f48", vest: "#1e2127", pouch: "#5c5638", belt: "#3a3428", pants: "#25282e", shoes: "#f4f4ef", sole: "#a9aeb8" },
    fallback: { hat: "", accent: "#5c5638", palette: { A: "#c8ccd4", B: "#8a909c", C: "#5a606c", D: "#3a3f48", E: "#44495a", F: "#2c3038", G: "#202328", J: "#15171b", m: "#5c5638" } },
    stats: { hp: 4, armor: 3, speed: 98, energy: 150 },   // YẾU: thấp nhất game
    crit: 0.03,
    dodge: 0.15,         // nhỏ con: 15% né đòn (đòn sượt qua đầu)
    searchMul: 0.5,      // lục hòm / túi y tế nhanh gấp đôi (chế độ Rút Quân)
    lootBonus: 1,        // mỗi hòm tiếp tế có thêm 1 hộp đạn
    passive: "Nhỏ con: 15% né đòn. Lục lọi giỏi: mở hòm nhanh gấp đôi, hòm có thêm 1 hộp đạn. Tay run: súng lệch nhiều.",
    weapon: {
      name: "Súng Trường Tập Bắn",
      desc: "M4 cũ của đơn vị — tay run nên đạn lệch, sát thương thấp",
      type: "gun",
      sprite: "carbine",   // dùng ảnh súng M4A1 (src/guns.js)
      damage: 0.75,
      fireRate: 0.15,
      bulletSpeed: 320,
      bulletRadius: 2,
      spread: 0.17,        // tay run
      color: "#ffe08a",
      sound: "shoot",
    },
    skill: {
      type: "panic",
      name: "Hoảng Loạn Xả Đạn",
      desc: "Sợ quá nhắm mắt bóp cò: 2.5 giây xả 40 viên tỏa khắp xung quanh (1 sát thương mỗi viên), hất lùi quái sát bên lúc bắt đầu. Đi chậm 40% khi đang xả.",
      cooldown: 11,
      duration: 2.5,
      count: 40,
      damage: 1,
      bulletSpeed: 300,
      color: "#ffd27a",
    },
  },
  // ---------------- NHÓM SINH VIÊN (students.js) ----------------
  ...STUDENTS,
  // ---------------- BẠN CÙNG LỚP — nhân vật phụ (classmates.js) ----------------
  ...CLASSMATES,
];

/** Nhóm hiển thị ở màn chọn nhân vật (Giải Trí): "student" nhóm chính · "classmate" bạn cùng lớp · còn lại "hero" */
export const CHAR_GROUPS = [
  { id: "student", name: "Nhóm Sinh Viên" },
  { id: "classmate", name: "Bạn Cùng Lớp" },
  { id: "hero", name: "Anh Hùng Giả Tưởng" },
];
export const groupOf = (c) => c.group ?? "hero";

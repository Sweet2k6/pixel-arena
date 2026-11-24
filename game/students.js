// =====================================================================================
//  NHÓM SINH VIÊN — 9 nhân vật vẽ theo TỈ LỆ NGƯỜI THẬT (src/human.js), không chibi
//
//  >>> SỬA NGOẠI HÌNH: khối `human` (xem danh sách tham số ở đầu src/human.js) rồi nướng lại ảnh:
//        node game/tools/bake-sprites.mjs phong trung duy quyet tando vinhthinh nhu lethinh thiennhan
//      (không nướng lại thì game vẫn tự vẽ từ khối `human` lúc chạy, chỉ chậm hơn chút khi mở game)
//  >>> KỸ NĂNG: tạm thời tất cả dùng "Cuồng Nộ" (giống Xạ Thủ). Muốn đổi: sửa khối `skill` (xem chú thích đầu characters.js)
//  Chiều cao: 1m67 -> 33 px · 1m73 -> 35 · 1m77 -> 36 · 1m80 -> 37 (tính từ chân tới đỉnh sọ, chưa tính tóc)
// =====================================================================================

/** Kỹ năng chung tạm thời: Cuồng Nộ bắn nhanh gấp đôi (giống Xạ Thủ) */
const RAGE = (color = "#ff4a3a", desc = "Nổi điên: bắn nhanh gấp đôi trong 4 giây.") => ({
  type: "rage", name: "Cuồng Nộ", desc, cooldown: 12, duration: 4, fireRateMult: 0.5, color,
});
const NO_IMG = { sprite: "", weaponImg: "", skillIcon: "" };
/** Màu hình người pixelfx kiểu cũ (dự phòng khi không vẽ được sprite) */
const FB = (a, b, c) => ({ hat: "", accent: c, palette: { A: a, B: a, C: b, D: b, E: b, F: c, G: c, J: "#15171b", m: c } });

export const STUDENTS = [
  // ------------------------------------------------------------------------- DIỆU PHONG (ảnh 2)
  {
    id: "phong", group: "student", name: "Diệu Phong", title: "Gấu bự cười ngờ nghệch", ...NO_IMG,
    desc: "Sinh viên to cao, béo tròn, đeo kính, tóc mái chéo bù xù, nốt ruồi to trên má. Lúc nào cũng cười ngờ nghệch — nhưng ôm khẩu Tommy thì không ai dám cười lại.",
    human: {
      height: 37, build: "fat", skin: "#e4ae84", hair: "#2a1d16", hairStyle: "sweep", face: "goofy", glasses: "rect", mole: true,
      top: { kind: "tee", color: "#93b8c8" }, bottom: { kind: "pants", color: "#3a3f4c" }, shoes: "#2e2c30", gesture: "laugh",
    },
    fallback: FB("#b6d2de", "#93b8c8", "#3a3f4c"),
    stats: { hp: 8, armor: 4, speed: 84, energy: 170 },
    crit: 0.05,
    passive: "Người to: máu trâu, đứng vững — nhưng chạy chậm.",
    weapon: { name: "Tiểu Liên Tommy", desc: "Băng đạn tròn, xả liên tục", type: "gun", sprite: "a_tommy", damage: 0.9, fireRate: 0.11, bulletSpeed: 320, bulletRadius: 2, spread: 0.14, color: "#ffd27a", sound: "shoot" },
    skill: RAGE("#ff6a3a", "Cười xong là nổi điên: bắn nhanh gấp đôi trong 4 giây."),
  },
  // ------------------------------------------------------------------------- TRUNG
  {
    id: "trung", group: "student", name: "Trung", title: "Bộ não của nhóm", ...NO_IMG,
    desc: "To cao, béo hơn cả Phong, mặt to nhưng ánh mắt sắc lẹm — người thông minh nhất hội. Tóc mái chéo chải gọn, râu lún phún. Bắn ít nhưng phát nào trúng phát đó.",
    human: {
      height: 37, build: "fatter", skin: "#e8b48a", hair: "#16120e", hairStyle: "sweepNeat", face: "smart", glasses: "rect", stubble: true,
      top: { kind: "shirt", color: "#c9d3e0", collar: "#eef2f6", tucked: true }, belt: "#2a221c", bottom: { kind: "pants", color: "#4e4a3e" }, shoes: "#231e1a", gesture: "chin",
    },
    fallback: FB("#e2e8f0", "#c9d3e0", "#4e4a3e"),
    stats: { hp: 8, armor: 5, speed: 80, energy: 200 },
    crit: 0.15,
    passive: "Tính toán đường đạn: 15% chí mạng gốc, đạn gần như không lệch.",
    weapon: { name: "Súng Trường M24", desc: "Bắn chậm, cực chuẩn, đạn nặng", type: "gun", sprite: "a_m24", damage: 2.4, fireRate: 0.5, bulletSpeed: 470, bulletRadius: 3, spread: 0.01, color: "#bfe4ff", sound: "shoot" },
    skill: RAGE("#4aa8ff", "Đã tính xong: bắn nhanh gấp đôi trong 4 giây."),
  },
  // ------------------------------------------------------------------------- PHƯƠNG DUY (ảnh 1)
  {
    id: "duy", group: "student", name: "Phương Duy", title: "Tay chơi ngầu lòi", ...NO_IMG,
    desc: "Cao 1m73, tóc dựng vuốt ngược, mắt lim dim nhếch mép, ngậm kẹo mút, khuyên tai, dây chuyền bạc, kính móc cổ áo, túi đeo chéo. Áo ARIZONA 82, jean đen rách gối. Nghịch mà ngầu, chạy nhanh, né giỏi.",
    human: {
      height: 35, build: "slim", skin: "#eab98c", hair: "#141012", hairStyle: "spiky", face: "cool",
      top: { kind: "tee", color: "#f2f0ea", print: "arizona" }, bottom: { kind: "pants", color: "#1c1e24", ripped: true }, shoes: "#f0eee8", shoeSole: "#22242a", hiTop: true,
      acc: ["lollipop", "earring", "chain", "glassesHang", "crossbag"], bag: "#4e5a32", gesture: "hair",
    },
    fallback: FB("#ffffff", "#f2f0ea", "#4e5a32"),
    stats: { hp: 5, armor: 4, speed: 106, energy: 170 },
    crit: 0.07,
    dodge: 0.1,
    passive: "Lanh chanh: 10% né đòn, chạy nhanh.",
    weapon: { name: "Vector Mini", desc: "Bắn cực nhanh, hơi lệch", type: "gun", sprite: "a_vector", damage: 0.7, fireRate: 0.085, bulletSpeed: 330, bulletRadius: 2, spread: 0.18, color: "#ffe26b", sound: "shoot" },
    skill: RAGE("#ff4a8a", "Hết kẹo là cáu: bắn nhanh gấp đôi trong 4 giây."),
  },
  // ------------------------------------------------------------------------- ĐẶNG QUYẾT (ảnh 3)
  {
    id: "quyet", group: "student", name: "Đặng Quyết", title: "Mái bằng trầm tính", ...NO_IMG,
    desc: "Cao 1m77, mặt tròn, tóc mái bằng dày phủ tới lông mày, áo dệt tổ ong trắng. Ít nói, mắt lim dim, nhưng giữ súng rất vững.",
    human: {
      height: 36, build: "normal", round: true, skin: "#e2aa82", hair: "#1a1614", hairStyle: "bangs", face: "calm",
      top: { kind: "tee", color: "#ecebe4", print: "waffle" }, bottom: { kind: "pants", color: "#24262c" }, shoes: "#3a3a40", gesture: "tilt",
    },
    fallback: FB("#ffffff", "#ecebe4", "#24262c"),
    stats: { hp: 6, armor: 5, speed: 96, energy: 180 },
    crit: 0.08,
    passive: "Vững tay: súng trường giật ít, cân bằng mọi mặt.",
    weapon: { name: "Súng Trường G36C", desc: "Bắn đều, chuẩn", type: "gun", sprite: "a_g36c", damage: 1.2, fireRate: 0.15, bulletSpeed: 360, bulletRadius: 2, spread: 0.06, color: "#ffe26b", sound: "shoot" },
    skill: RAGE("#ff4a3a", "Người hiền nổi giận: bắn nhanh gấp đôi trong 4 giây."),
  },
  // ------------------------------------------------------------------------- TẤN ĐÔ (ảnh 4)
  {
    id: "tando", group: "student", name: "Tấn Đô", title: "Cứng đầu 1m80", ...NO_IMG,
    desc: "Cao 1m80, mặt hơi bướng, tóc cạo trắng 2 bên, phần trên vuốt rẽ ngôi gọn gàng. Áo polo tím sọc xanh lá, quần đùi số 21. Đã bắn là bắn phát to.",
    human: {
      height: 37, build: "normal", skin: "#d9a378", hair: "#1c1916", hairStyle: "undercut", face: "stubborn",
      top: { kind: "polo", color: "#5a40b4", collar: "#4a32a0", print: "stripes" }, bottom: { kind: "shorts", color: "#1c1e26", label: "21" }, shoes: "#f0eee8", shoeSole: "#8a8e96", gesture: "point",
    },
    fallback: FB("#7a62d0", "#5a40b4", "#46c85a"),
    stats: { hp: 6, armor: 6, speed: 98, energy: 170 },
    crit: 0.1,
    passive: "Lì đòn: giáp dày, 10% chí mạng gốc.",
    weapon: { name: "Desert Eagle", desc: "Súng lục nặng, phát nào đau phát đó", type: "gun", sprite: "deagle", damage: 2.2, fireRate: 0.34, bulletSpeed: 400, bulletRadius: 3, spread: 0.05, color: "#ffb347", sound: "shoot" },
    skill: RAGE("#46c85a", "Cứng đầu tới cùng: bắn nhanh gấp đôi trong 4 giây."),
  },
  // ------------------------------------------------------------------------- VĨNH THỊNH (ảnh 5)
  {
    id: "vinhthinh", group: "student", name: "Vĩnh Thịnh", title: "Bóng đen khẩu trang", ...NO_IMG,
    desc: "Mũ đen, khẩu trang đen, áo khoác đen, quần túi hộp nâu, ba lô đeo TRƯỚC NGỰC. Lầm lì, không ai thấy mặt — chỉ nghe tiếng P90.",
    human: {
      height: 35, build: "normal", skin: "#dcab84", hair: "#121214", hairStyle: "cap", cap: "#18181c", face: "neutral", mask: "#141416",
      top: { kind: "jacket", color: "#22232a" }, bottom: { kind: "cargo", color: "#6a5a44" }, shoes: "#2a2a2e", acc: ["frontpack"], pack: "#3a3a44", gesture: "strap",
    },
    fallback: FB("#3a3b44", "#22232a", "#6a5a44"),
    stats: { hp: 6, armor: 5, speed: 96, energy: 180 },
    crit: 0.06,
    dodge: 0.05,
    passive: "Ba lô trước ngực đỡ đạn: 5% né đòn.",
    weapon: { name: "Tiểu Liên P90", desc: "Băng đạn dài, bắn nhanh", type: "gun", sprite: "a_p90", damage: 0.85, fireRate: 0.1, bulletSpeed: 340, bulletRadius: 2, spread: 0.1, color: "#d8f0ff", sound: "shoot" },
    skill: RAGE("#8a8aa0", "Kéo khẩu trang lên: bắn nhanh gấp đôi trong 4 giây."),
  },
  // ------------------------------------------------------------------------- NHU
  {
    id: "nhu", group: "student", name: "Nhu", title: "Cô nàng ngơ ngơ", ...NO_IMG,
    desc: "Cô gái duy nhất của nhóm: tóc dài đen hơi nâu buộc gọn, đuôi tóc dài nhuộm vàng. Mặt lúc nào cũng ngơ ngơ — nhưng khẩu súng tia của cô thì không ngơ chút nào.",
    human: {
      height: 32, female: true, build: "slim", skin: "#f0c7a2", hair: "#2e2018", hairTip: "#e8c04c", hairStyle: "ponytail", face: "dazed",
      top: { kind: "hoodie", color: "#bba8d8", color2: "#a894c8" }, bottom: { kind: "pants", color: "#4a5c80" }, shoes: "#f2f0ea", shoeSole: "#c0c4cc", gesture: "look",
    },
    fallback: FB("#d4c6ea", "#bba8d8", "#e8c04c"),
    stats: { hp: 5, armor: 4, speed: 104, energy: 200 },
    crit: 0.06,
    dodge: 0.08,
    passive: "Ngơ mà nhanh: 8% né đòn, năng lượng dồi dào.",
    weapon: { name: "Súng Tia Ray", desc: "Đạn năng lượng hồng, bay nhanh", type: "gun", sprite: "a_raygun", damage: 1.1, fireRate: 0.17, bulletSpeed: 380, bulletRadius: 3, spread: 0.05, color: "#ff8ad8", sound: "shoot" },
    skill: RAGE("#ff8ad8", "Hết ngơ rồi: bắn nhanh gấp đôi trong 4 giây."),
  },
  // ------------------------------------------------------------------------- LÊ THỊNH (ảnh 6)
  {
    id: "lethinh", group: "student", name: "Lê Thịnh", title: "Mặt lưỡi liềm tóc mì tôm", ...NO_IMG,
    desc: "Cao 1m77, tóc xoăn tít như mì tôm, mặt lưỡi liềm cằm dài, kính gọng đen to bản. Hay cười nhếch mép, bắn khẩu SCAR rất ác.",
    human: {
      height: 36, build: "normal", crescent: true, skin: "#d69f78", hair: "#17110e", hairStyle: "curly", face: "grin", glasses: "big",
      top: { kind: "tee", color: "#3e5c48" }, bottom: { kind: "pants", color: "#3a4560" }, shoes: "#2a2624", gesture: "laugh",
    },
    fallback: FB("#5a7c66", "#3e5c48", "#3a4560"),
    stats: { hp: 6, armor: 4, speed: 100, energy: 180 },
    crit: 0.1,
    passive: "Cười nhếch mép: 10% chí mạng gốc.",
    weapon: { name: "Súng Trường SCAR", desc: "Đạn to, giật mạnh", type: "gun", sprite: "a_scar", damage: 1.4, fireRate: 0.17, bulletSpeed: 370, bulletRadius: 2, spread: 0.07, color: "#ffcf6b", sound: "shoot" },
    skill: RAGE("#ffb03a", "Hết cười: bắn nhanh gấp đôi trong 4 giây."),
  },
  // ------------------------------------------------------------------------- THIỆN NHÂN
  {
    id: "thiennhan", group: "student", name: "Thiện Nhân", title: "Thầy giáo nhí", ...NO_IMG,
    desc: "Lùn 1m67, đeo kính, tóc rẽ 2 mái ép xẹp bết dính. Một tay LUÔN xách cặp ngang như thầy giáo, tay kia hay đẩy gọng kính. Áo sơ mi trắng sơ vin, súng lục Colt bắn rất chuẩn.",
    human: {
      height: 33, build: "slim", skin: "#e6b68e", hair: "#1a1612", hairStyle: "flatPart", face: "neutral", glasses: "rect",
      top: { kind: "shirt", color: "#eeeef2", collar: "#ffffff", tucked: true }, belt: "#1e1a18", bottom: { kind: "pants", color: "#2c303c" }, shoes: "#1c1a18",
      acc: ["briefcase"], briefcase: "#6a4428", gesture: "glasses",
    },
    fallback: FB("#ffffff", "#eeeef2", "#6a4428"),
    stats: { hp: 5, armor: 6, speed: 92, energy: 190 },
    crit: 0.12,
    passive: "Nhỏ con: khó trúng (6% né đòn). Cặp da chắn đạn: giáp dày.",
    dodge: 0.06,
    weapon: { name: "Colt M1911", desc: "Súng lục chuẩn xác", type: "gun", sprite: "a_colt", damage: 1.5, fireRate: 0.22, bulletSpeed: 380, bulletRadius: 2, spread: 0.03, color: "#ffe9a8", sound: "shoot" },
    skill: RAGE("#c8a060", "Thầy nổi giận: bắn nhanh gấp đôi trong 4 giây."),
  },
];

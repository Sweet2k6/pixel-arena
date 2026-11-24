// =====================================================================================
//  BẠN CÙNG LỚP — nhân vật PHỤ (lớp CNTT6), vẽ đơn giản bằng src/human.js
//
//  Dùng làm nhân vật phụ trong CỐT TRUYỆN (NPC) và vẫn chọn chơi được ở phần GIẢI TRÍ.
//  >>> SỬA NGOẠI HÌNH: đổi các tham số trong lời gọi M(...) bên dưới, rồi nướng lại ảnh:
//        node game/tools/bake-sprites.mjs <id>        (vd: node game/tools/bake-sprites.mjs ducanh ngan)
//  Tham số ngoại hình: xem danh sách ở đầu src/human.js (hairStyle, face, glasses, top, bottom...)
// =====================================================================================

const RAGE = { type: "rage", name: "Cuồng Nộ", desc: "Nổi điên: bắn nhanh gấp đôi trong 4 giây.", cooldown: 12, duration: 4, fireRateMult: 0.5, color: "#ff4a3a" };

/** Bộ súng cho nhân vật phụ (chỉ số vừa phải) */
const GUN = {
  pistol:   { name: "Súng Lục Glock", desc: "Súng lục bán tự động", sprite: "pistol", damage: 1.1, fireRate: 0.2, bulletSpeed: 360, spread: 0.05, color: "#ffe26b" },
  beretta:  { name: "Súng Lục Beretta", desc: "Gọn, bắn đều", sprite: "a_beretta", damage: 1.15, fireRate: 0.21, bulletSpeed: 360, spread: 0.04, color: "#ffe26b" },
  revolver: { name: "Súng Ổ Quay", desc: "Chậm nhưng đau", sprite: "revolver", damage: 2, fireRate: 0.36, bulletSpeed: 390, spread: 0.04, color: "#ffb347" },
  uzi:      { name: "Tiểu Liên Uzi", desc: "Xả nhanh, hơi lệch", sprite: "machinepistol", damage: 0.7, fireRate: 0.09, bulletSpeed: 320, spread: 0.17, color: "#ffe26b" },
  mp5:      { name: "Tiểu Liên MP5", desc: "Bắn nhanh, ổn định", sprite: "smg", damage: 0.85, fireRate: 0.1, bulletSpeed: 340, spread: 0.1, color: "#ffe26b" },
  m4:       { name: "Súng Trường M4", desc: "Cân bằng", sprite: "carbine", damage: 1.15, fireRate: 0.15, bulletSpeed: 360, spread: 0.06, color: "#ffe26b" },
  ak:       { name: "Súng Trường AK", desc: "Đạn nặng, giật mạnh", sprite: "rifle", damage: 1.35, fireRate: 0.17, bulletSpeed: 360, spread: 0.08, color: "#ffcf6b" },
  famas:    { name: "Súng Trường FAMAS", desc: "Bắn nhanh", sprite: "a_famas", damage: 1.05, fireRate: 0.13, bulletSpeed: 360, spread: 0.07, color: "#ffe26b" },
  rpk:      { name: "Súng Máy RPK", desc: "Băng dài, xả liên tục", sprite: "a_rpk", damage: 1, fireRate: 0.12, bulletSpeed: 340, spread: 0.12, color: "#ffcf6b" },
  dragunov: { name: "Súng Bắn Tỉa Dragunov", desc: "Chậm, cực chuẩn", sprite: "a_dragunov", damage: 2.2, fireRate: 0.45, bulletSpeed: 470, spread: 0.01, color: "#bfe4ff" },
};

/** Màu da hay gặp */
const SK = { a: "#e8b88a", b: "#e2ad82", c: "#d9a378", d: "#f0c6a0", e: "#dcab84" };

/**
 * M(id, tên, chức danh, ngoại hình, súng, chỉ số)
 * ngoại hình rút gọn: h chiều cao · b vóc dáng · s da · hair màu tóc · st kiểu tóc · f nét mặt · g kính · top / bot / shoes / acc / f(emale)
 */
function M(id, name, title, L, gun, st = {}) {
  const top = typeof L.top === "string" ? { kind: "tee", color: L.top } : L.top;
  const bot = typeof L.bot === "string" ? { kind: "pants", color: L.bot } : L.bot ?? { kind: "pants", color: "#2c303c" };
  const human = {
    height: L.h ?? 35, build: L.b ?? "normal", female: !!L.fem, skin: L.s ?? SK.a, hair: L.hair ?? "#1a1512", hairStyle: L.st ?? "short",
    face: L.f ?? "neutral", glasses: L.g ?? "", top, bottom: bot, shoes: L.shoes ?? "#2a2a2e", ...(L.extra ?? {}),
  };
  const c = top.color;
  return {
    id, name, title, group: "classmate", side: true,
    sprite: "", weaponImg: "", skillIcon: "",
    human,
    fallback: { hat: "", accent: c, palette: { A: c, B: c, C: c, D: c, E: c, F: bot.color, G: bot.color, J: "#15171b", m: c } },
    stats: { hp: st.hp ?? 6, armor: st.armor ?? 4, speed: st.speed ?? 98, energy: 170 },
    crit: st.crit ?? 0.06,
    ...(st.dodge ? { dodge: st.dodge } : {}),
    passive: st.passive ?? "Sinh viên bình thường — không có nội tại đặc biệt.",
    weapon: { type: "gun", bulletRadius: 2, sound: "shoot", ...GUN[gun] },
    skill: RAGE,
  };
}

export const CLASSMATES = [
  M("ducanh", "Đức Anh", "Lớp trưởng gương mẫu", { h: 36, st: "sidePart", f: "smart", top: "#2c3e66", bot: "#2a2c34" }, "m4", { armor: 5 }),
  M("tuananh", "Tuấn Anh", "Cú đêm chơi game", { h: 35, b: "slim", st: "spiky", f: "mischief", top: { kind: "hoodie", color: "#6a6e78" }, bot: "#1e2028", hair: "#16110e" }, "uzi", { speed: 104, dodge: 0.06 }),
  M("hoaibao", "Hoài Bão", "Gấu hiền", { g: "rect", h: 35, b: "fat", s: SK.b, st: "short", f: "goofy", top: "#8a3a32", bot: "#3a3f4c" }, "rpk", { hp: 8, speed: 86 }),
  M("quoccuong", "Quốc Cường", "Dân thể thao", { h: 37, st: "undercut", s: SK.c, f: "stubborn", top: { kind: "jacket", color: "#4a5a34" }, bot: { kind: "cargo", color: "#3a3628" } }, "ak", { hp: 7, armor: 5 }),
  M("ducdung", "Đức Dũng", "Ít nói", { h: 36, st: "short", f: "calm", top: { kind: "polo", color: "#e8e8e2", collar: "#ffffff" }, bot: "#34384a" }, "beretta"),
  M("tiendat", "Tiến Đạt", "Láu cá", { g: "rect", h: 34, b: "slim", st: "messy", f: "mischief", top: "#1e1e24", bot: "#3a4560", shoes: "#f0eee8" }, "mp5", { speed: 104 }),
  M("truonggiang", "Trường Giang", "Học bá", { h: 37, st: "sweepNeat", f: "smart", top: { kind: "shirt", color: "#9cb4d8", collar: "#dce6f4", tucked: true }, extra: { belt: "#2a221c" }, bot: "#2e2a26" }, "dragunov", { crit: 0.12 }),
  M("khaihoan", "Khải Hoàn", "Tay chơi bóng rổ", { h: 35, st: "cap", f: "grin", top: "#f0efe8", bot: { kind: "shorts", color: "#c83a3a" }, extra: { cap: "#e8e6e0" }, shoes: "#e8e6e0" }, "famas", { speed: 102 }),
  M("nhathuy", "Nhật Huy", "Mọt sách", { h: 34, b: "slim", st: "bangs", f: "neutral", top: { kind: "hoodie", color: "#2c3450" }, bot: "#2a2e38" }, "pistol", { dodge: 0.05 }),
  M("dangkhoa", "Đăng Khoa", "Dân code", { g: "rect", h: 36, st: "sidePart", f: "neutral", top: { kind: "shirt", color: "#bcd4e6", collar: "#e6f0f8" }, bot: "#2c303c" }, "m4"),
  M("trongkhoa", "Trọng Khoa", "Ăn khỏe ngủ khỏe", { g: "rect", h: 36, b: "fat", st: "sweep", f: "goofy", top: "#3e6a48", bot: "#3a3f4c" }, "rpk", { hp: 8, speed: 85 }),
  M("tuankiet", "Tuấn Kiệt", "Lạnh lùng", { g: "rect", h: 37, st: "spiky", f: "cool", top: { kind: "jacket", color: "#1c1d22" }, bot: "#1e2028", hair: "#121014" }, "revolver", { crit: 0.1 }),
  M("ngan", "Ngân", "Cô bạn hiền", { h: 31, fem: true, b: "slim", s: SK.d, st: "long", hair: "#24180f", f: "neutral", top: { kind: "hoodie", color: "#e6b8c8" }, bot: "#4a5c80", shoes: "#f2f0ea" }, "beretta", { dodge: 0.08, speed: 102 }),
  M("congnguyen", "Công Nguyên", "Hài hước", { h: 35, b: "slim", st: "messy", f: "goofy", top: "#e8c040", bot: "#2c3240" }, "uzi"),
  M("quison", "Quí Sơn", "Thật thà", { h: 36, st: "short", s: SK.c, f: "calm", top: { kind: "polo", color: "#2e5a3e", collar: "#24482f" }, bot: "#2e2e34" }, "ak"),
  M("minhthat", "Minh Thật", "Nghiêm túc", { h: 35, st: "flatPart", f: "neutral", top: { kind: "shirt", color: "#f0f0f2", collar: "#ffffff", tucked: true }, extra: { belt: "#1e1a18" }, bot: "#2c303c" }, "pistol", { armor: 5 }),
  M("quoctien", "Quốc Tiến", "To con", { g: "rect", h: 37, b: "fat", s: SK.b, st: "short", f: "calm", top: { kind: "hoodie", color: "#22232a" }, bot: "#3a3f4c" }, "ak", { hp: 8, speed: 86 }),
  M("ductien", "Đức Tiến", "Hay ngủ gật", { h: 36, b: "slim", st: "sweep", f: "calm", top: "#8a8e98", bot: "#2a2e38" }, "mp5"),
  M("trongtri", "Trọng Trí", "Thích sửa máy", { h: 36, st: "undercut", f: "smart", top: { kind: "shirt", color: "#d8cdb4", collar: "#ece4d0" }, bot: { kind: "cargo", color: "#4a4436" } }, "famas"),
  M("dinhtrong", "Đình Trọng", "Phượt thủ", { h: 37, st: "cap", s: SK.c, f: "stubborn", top: { kind: "jacket", color: "#2c4a7a" }, bot: "#24262c", extra: { cap: "#1c1c22" } }, "m4", { speed: 102 }),
  M("quocviet", "Quốc Việt", "Hiền lành", { h: 35, b: "slim", st: "bangs", f: "dazed", top: "#e8e8e2", bot: "#3a4560" }, "pistol", { dodge: 0.06 }),
  M("vanvinh", "Văn Vĩnh", "Lém lỉnh", { h: 34, st: "short", s: SK.e, f: "grin", top: "#d8743a", bot: "#2c3240" }, "uzi", { speed: 102 }),
];

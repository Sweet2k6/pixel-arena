// =====================================================================================
//  ĐẠN THEO LOẠI — chế độ Nhảy Dù Rút Quân
//
//  Mỗi khẩu súng có băng đạn dùng 1 LOẠI ĐẠN. Thay băng (R hoặc tự động) chỉ lấy từ ĐẠN DỰ TRỮ của loại đó.
//  Hết đạn dự trữ = không thay băng được -> phải nhặt HỘP ĐẠN: trong hòm tiếp tế, zombie rơi ra, súng nhặt được.
//  Lên máy bay: mỗi khẩu súng mang theo được cấp sẵn START_MAGS băng dự trữ.
//  Chế độ Giải Trí: AMMO.pool = null -> đạn dự trữ vô hạn (như cũ).
//  Vũ khí khởi đầu của nhân vật (không có id) luôn vô hạn đạn -> không bao giờ bị kẹt tay không.
//
//  >>> THÊM SÚNG MỚI: thêm `ammoType: "rifle"` vào vũ khí trong weapons.js, hoặc thêm id vào AMMO_OF bên dưới.
//      Không khai báo thì game tự đoán theo loại đạn bắn / âm thanh / cỡ băng (xem guessType).
// =====================================================================================

/** 8 loại đạn: tên, chữ in trên hộp, màu, số viên trong 1 hộp nhặt được */
export const AMMO_TYPES = {
  pistol:    { name: "Đạn Súng Lục",    short: "9MM",  color: "#e2c878", box: 24 },
  smg:       { name: "Đạn Tiểu Liên",   short: "SMG",  color: "#f0a24e", box: 45 },
  rifle:     { name: "Đạn Súng Trường", short: "5.56", color: "#c8d05a", box: 30 },
  sniper:    { name: "Đạn Bắn Tỉa",     short: ".338", color: "#7fd0ff", box: 8 },
  shell:     { name: "Đạn Hoa Cải",     short: "12G",  color: "#ff6a50", box: 12 },
  lmg:       { name: "Đạn Súng Máy",    short: "BELT", color: "#a8c870", box: 60 },
  energy:    { name: "Pin Năng Lượng",  short: "PIN",  color: "#5ad8ff", box: 30 },
  explosive: { name: "Đạn Nổ",          short: "HE",   color: "#ff9a2a", box: 3 },
};
export const AMMO_ORDER = Object.keys(AMMO_TYPES);
/** Số băng dự trữ được cấp cho mỗi khẩu mang lên máy bay */
export const START_MAGS = 2;
/** Tỉ lệ rơi hộp đạn: zombie thường / zombie to (Boss, Phát Nổ) · số hộp trong 1 hòm tiếp tế */
export const AMMO_DROP = { zombie: 0.07, big: 0.6, crateBoxes: [1, 2], crateMatchChance: 0.75 };

/** Loại đạn của từng khẩu (id trong weapons.js) */
const AMMO_OF = {
  pistol: ["gPistol", "gColt", "gBeretta", "gRevolver", "gDeagle"],
  smg: ["gUzi", "gMp5", "gP90", "gTommy", "gVector"],
  rifle: ["gG36c", "gM4", "gAk47", "gFamas", "gScar"],
  sniper: ["gAwp", "gDragunov", "gM24", "gBarrett", "gIntervention"],
  shell: ["gPump", "gSawedoff", "gCombatSg", "gDoubleBarrel", "gAutoShotgun"],
  lmg: ["gRpk", "gM249", "gStoner", "gMinigun", "gM60", "gMg42"],
  energy: ["gPlasma", "gShockRifle", "gLaserRifle", "gEmp", "gFutureRifle", "gRayGun", "gIonCannon", "gQuantumRifle", "gProtoX1", "gProtoX2"],
  explosive: ["gM79", "gBazooka"],
};
const TYPE_OF_ID = {};
for (const [t, ids] of Object.entries(AMMO_OF)) for (const id of ids) TYPE_OF_ID[id] = t;

function guessType(d) {
  if (d.proj === "laser" || d.proj === "plasma") return "energy";
  if (d.proj === "rocket" || d.proj === "grenade" || d.lob) return "explosive";
  if (d.proj === "pellet" || (d.pellets ?? 1) > 1) return "shell";
  if (d.sound === "sniper" || d.beam) return "sniper";
  if (d.spinUp || d.mag >= 45) return "lmg";
  if (d.sound === "pistol") return d.mag <= 18 ? "pistol" : "smg";
  return "rifle";
}

/** Loại đạn của 1 vũ khí (bản thể hoặc định nghĩa). null = không dùng đạn dự trữ (vô hạn). */
export function ammoTypeOf(w) {
  const d = w?.def ?? w;
  if (!d?.mag || !d.id) return null;
  return d.ammoType ?? TYPE_OF_ID[d.id] ?? guessType(d);
}

/** Kho đạn dự trữ của ván Rút Quân đang chơi. pool = null -> vô hạn (Giải Trí / sảnh). */
export const AMMO = { pool: null, onEmpty: null };

export function newAmmoPool() {
  const p = {};
  for (const t of AMMO_ORDER) p[t] = 0;
  return p;
}
/** Bắt đầu ván Rút Quân: mỗi khẩu súng đang cầm được START_MAGS băng dự trữ */
export function startAmmoPool(weapons) {
  AMMO.pool = newAmmoPool();
  for (const w of weapons) { const t = ammoTypeOf(w); if (t) AMMO.pool[t] += (w.mag ?? w.def?.mag ?? 0) * START_MAGS; }
  return AMMO.pool;
}
export function stopAmmoPool() { AMMO.pool = null; }

/** Còn bao nhiêu viên dự trữ cho khẩu này (Infinity nếu vô hạn) */
export function reserveOf(w) {
  const t = ammoTypeOf(w);
  if (!AMMO.pool || !t) return Infinity;
  return AMMO.pool[t] ?? 0;
}
/** Lấy tối đa n viên loại t khỏi kho dự trữ, trả về số viên thực lấy được */
export function takeAmmo(t, n) {
  if (!AMMO.pool || !t) return n;
  const k = Math.max(0, Math.min(n, AMMO.pool[t] ?? 0));
  AMMO.pool[t] -= k;
  return k;
}
/** Thêm đạn vào kho dự trữ (nhặt hộp đạn). Trả về số viên đã thêm. */
export function addAmmo(t, n) {
  if (!AMMO.pool || !AMMO_TYPES[t] || n <= 0) return 0;
  AMMO.pool[t] += n;
  return n;
}

/**
 * Chọn loại hộp đạn để rơi ra: matchChance (0..1) ưu tiên đúng loại súng người chơi đang có,
 * còn lại bốc ngẫu nhiên (để người chơi có lý do đổi súng).
 */
export function rollAmmoType(weapons, matchChance = AMMO_DROP.crateMatchChance) {
  const held = weapons.map(ammoTypeOf).filter(Boolean);
  if (held.length && Math.random() < matchChance) return held[Math.floor(Math.random() * held.length)];
  const all = AMMO_ORDER.filter((t) => t !== "explosive" || Math.random() < 0.3);
  return all[Math.floor(Math.random() * all.length)];
}

/** Vẽ hộp đạn pixel (cỡ ~12x9) tại (x,y) = tâm đáy. Dùng cho vật phẩm rơi + HUD. */
export function drawAmmoBox(c, t, x, y, k = 1) {
  const def = AMMO_TYPES[t] ?? AMMO_TYPES.rifle;
  const w = 12 * k, h = 9 * k, x0 = Math.round(x - w / 2), y0 = Math.round(y - h);
  c.fillStyle = "#0e0c14"; c.fillRect(x0 - 1, y0 - 1, w + 2, h + 2);
  c.fillStyle = "#3f4a2a"; c.fillRect(x0, y0, w, h);                 // hộp sắt ô-liu
  c.fillStyle = "#5a6a3a"; c.fillRect(x0, y0, w, Math.max(1, k));    // mép sáng
  c.fillStyle = def.color; c.fillRect(x0, y0 + 3 * k, w, 3 * k);     // dải màu loại đạn
  c.fillStyle = "#2a3119"; c.fillRect(x0 + 4 * k, y0 - 2 * k, 4 * k, 2 * k);   // quai xách
  // đầu đạn ló lên
  c.fillStyle = "#e8c860"; for (let i = 0; i < 3; i++) c.fillRect(x0 + (2 + i * 3) * k, y0 - k, k, k);
}

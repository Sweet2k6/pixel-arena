// =====================================================================================
//  KHO SÚNG "PIXEL ARMORY" — ảnh súng, đạn, lửa đầu nòng, vỏ đạn, tia chạm tường
//
//  >>> ĐỔI ẢNH SÚNG: thay file PNG trong  game/assets/images/guns/…  (giữ nguyên tên file).
//      Ảnh súng quay sang PHẢI, nền trong suốt. Sau khi đổi ảnh, nếu kích thước khác thì sửa
//      `w, h, grip, muzzle` của khẩu đó trong GUN_DATA bên dưới (grip = điểm tay cầm, muzzle = đầu nòng,
//      đều tính theo pixel của ẢNH GỐC). Đạn / lửa nòng / vỏ đạn nằm trong  game/assets/images/guns/fx/…
//  >>> CHỈNH KÍCH THƯỚC TRONG TRẬN: sửa `scale` của khẩu súng (nhân vật chibi cao ~30px nên ~0.3–0.45).
//
//  Cách dùng (do main.js nối sẵn):
//    GUN_IMAGES            -> trộn vào danh sách ảnh cần tải
//    prepareGunSprites()   -> gọi 1 lần sau khi tải ảnh: thu nhỏ + ngưỡng alpha để giữ viền pixel sắc nét
//    updateGunFx / drawGunFx -> lửa đầu nòng, vỏ đạn, tia chạm tường (mảng cố định, KHÔNG tạo object mới mỗi phát)
//  weapons.js gọi: drawGunSprite, drawGunIcon, gunMuzzleLength, gunSpan, gunCenterY,
//                  gunFlash, gunShell, gunImpact, drawGunProjectile
// =====================================================================================
import { clamp, rand, TAU } from "./util.js";

const BASE = "assets/images/guns/";

// ------------------------------------------------------------------ 14 KHẨU PIXEL ARMORY (chép từ manifest.json)
/** w,h = kích thước ảnh gốc · grip = điểm tay cầm · muzzle = đầu nòng · scale = hệ số thu nhỏ trong trận · fx = kiểu lửa nòng */
export const GUN_DATA = {
  pistol:        { file: "pistol.png",        w: 45,  h: 30, grip: [14, 21], muzzle: [43, 9],   scale: 0.40, fx: "small" },
  revolver:      { file: "revolver.png",      w: 71,  h: 31, grip: [14, 22], muzzle: [69, 9],   scale: 0.30, fx: "small" },
  machinepistol: { file: "machinepistol.png", w: 47,  h: 39, grip: [11, 21], muzzle: [45, 9],   scale: 0.40, fx: "small" },
  smg:           { file: "smg.png",           w: 73,  h: 39, grip: [33, 22], muzzle: [71, 9],   scale: 0.38, fx: "small" },
  carbine:       { file: "carbine.png",       w: 87,  h: 39, grip: [37, 21], muzzle: [85, 8],   scale: 0.36, fx: "rifle" },
  rifle:         { file: "rifle.png",         w: 97,  h: 28, grip: [33, 20], muzzle: [95, 9],   scale: 0.36, fx: "rifle" },
  shotgun:       { file: "shotgun.png",       w: 102, h: 31, grip: [32, 23], muzzle: [100, 6],  scale: 0.35, fx: "heavy" },
  sawedoff:      { file: "sawedoff.png",      w: 55,  h: 27, grip: [14, 19], muzzle: [53, 6],   scale: 0.38, fx: "heavy" },
  sniper:        { file: "sniper.png",        w: 126, h: 39, grip: [40, 26], muzzle: [124, 17], scale: 0.30, fx: "rifle" },
  grenade:       { file: "grenade.png",       w: 85,  h: 33, grip: [31, 25], muzzle: [83, 13],  scale: 0.38, fx: "heavy" },
  rocket:        { file: "rocket.png",        w: 95,  h: 35, grip: [20, 27], muzzle: [93, 14],  scale: 0.36, fx: "heavy" },
  minigun:       { file: "minigun.png",       w: 95,  h: 33, grip: [11, 25], muzzle: [93, 10],  scale: 0.36, fx: "rifle" },
  laser:         { file: "laser.png",         w: 95,  h: 28, grip: [31, 20], muzzle: [93, 9],   scale: 0.38, fx: "energy" },
  plasma:        { file: "plasma.png",        w: 57,  h: 29, grip: [12, 21], muzzle: [55, 8],   scale: 0.40, fx: "energy" },
};

// ------------------------------------------------------------------ KHO 45 VŨ KHÍ (ảnh "kho vũ khí" của bạn, 9 hàng x 5 cột)
/**
 * >>> ĐỔI ẢNH: thay file PNG trong  game/assets/images/guns/armory/…  (giữ nguyên tên file).
 *     Ảnh quay nòng sang PHẢI, nền trong suốt. Kích thước khác thì sửa `w, h, grip, muzzle` (pixel của ảnh gốc).
 *     grip = chỗ tay cầm (cận chiến: cán bên trái) · muzzle = đầu nòng / mũi lưỡi · scale = hệ số thu nhỏ trong trận.
 * Các ảnh này được cắt tự động từ tấm kho vũ khí 45 khẩu: tách nền xám, xoá nhãn chữ, vá chỗ chữ đè lên súng.
 */
export const SHEET_GUNS = {
  glock:        { file: "armory/glock.png",         w:  73, h: 44, grip: [ 25, 23], muzzle: [ 72,  5], scale: 0.24, fx: "small" },   // Glock 17
  colt:         { file: "armory/colt.png",          w:  80, h: 44, grip: [ 28, 14], muzzle: [ 79,  4], scale: 0.24, fx: "small" },   // Colt M1911
  revolver:     { file: "armory/revolver.png",      w:  77, h: 42, grip: [ 26, 22], muzzle: [ 76,  6], scale: 0.24, fx: "small" },   // Ổ quay Magnum
  beretta:      { file: "armory/beretta.png",       w:  66, h: 43, grip: [ 23, 28], muzzle: [ 65,  6], scale: 0.24, fx: "small" },   // Beretta M9
  deagle:       { file: "armory/deagle.png",        w:  82, h: 43, grip: [ 28, 19], muzzle: [ 81,  5], scale: 0.24, fx: "small" },   // Desert Eagle

  sawedoff:     { file: "armory/sawedoff.png",      w: 123, h: 29, grip: [ 43, 19], muzzle: [122,  4], scale: 0.21, fx: "heavy" },   // Sawed-off
  pump:         { file: "armory/pump.png",          w: 150, h: 34, grip: [ 52, 19], muzzle: [149,  2], scale: 0.21, fx: "heavy" },   // Pump-Action
  combatsg:     { file: "armory/combatsg.png",      w: 165, h: 36, grip: [ 57, 18], muzzle: [164,  4], scale: 0.21, fx: "heavy" },   // Combat Shotgun
  autoshotgun:  { file: "armory/autoshotgun.png",   w: 166, h: 35, grip: [ 58, 19], muzzle: [165,  2], scale: 0.21, fx: "heavy" },   // Auto Shotgun
  doublebarrel: { file: "armory/doublebarrel.png",  w: 121, h: 34, grip: [ 42, 16], muzzle: [120,  3], scale: 0.21, fx: "heavy" },   // Double Barrel

  m4:           { file: "armory/m4.png",            w: 166, h: 44, grip: [ 50, 28], muzzle: [165, 11], scale: 0.21, fx: "rifle" },   // M4A1
  ak:           { file: "armory/ak.png",            w: 172, h: 39, grip: [ 53, 26], muzzle: [171, 11], scale: 0.21, fx: "rifle" },   // AK-47
  scar:         { file: "armory/scar.png",          w: 171, h: 46, grip: [ 73, 32], muzzle: [170, 14], scale: 0.21, fx: "rifle" },   // SCAR-H
  famas:        { file: "armory/famas.png",         w: 153, h: 48, grip: [ 40, 32], muzzle: [152, 17], scale: 0.21, fx: "rifle" },   // FAMAS
  g36c:         { file: "armory/g36c.png",          w: 158, h: 46, grip: [ 68, 32], muzzle: [157, 16], scale: 0.21, fx: "rifle" },   // G36C

  mp5:          { file: "armory/mp5.png",           w:  96, h: 42, grip: [ 52, 26], muzzle: [ 95,  9], scale: 0.24, fx: "small" },   // MP5
  uzi:          { file: "armory/uzi.png",           w:  71, h: 42, grip: [ 32, 26], muzzle: [ 70, 12], scale: 0.24, fx: "small" },   // UZI
  p90:          { file: "armory/p90.png",           w:  84, h: 38, grip: [ 29, 37], muzzle: [ 83, 25], scale: 0.24, fx: "small" },   // P90
  tommy:        { file: "armory/tommy.png",         w: 118, h: 41, grip: [ 60, 29], muzzle: [117,  8], scale: 0.21, fx: "small" },   // Tommy Gun
  vector:       { file: "armory/vector.png",        w:  90, h: 42, grip: [ 25, 23], muzzle: [ 89,  7], scale: 0.24, fx: "small" },   // Vector

  awp:          { file: "armory/awp.png",           w: 178, h: 34, grip: [ 62, 24], muzzle: [177, 10], scale: 0.21, fx: "rifle" },   // AWP
  barrett:      { file: "armory/barrett.png",       w: 176, h: 33, grip: [ 61, 24], muzzle: [175,  8], scale: 0.21, fx: "rifle" },   // Barrett .50cal
  dragunov:     { file: "armory/dragunov.png",      w: 177, h: 33, grip: [ 82, 24], muzzle: [176, 11], scale: 0.21, fx: "rifle" },   // Dragunov
  m24:          { file: "armory/m24.png",           w: 165, h: 34, grip: [ 57, 24], muzzle: [164, 11], scale: 0.21, fx: "rifle" },   // M24
  intervention: { file: "armory/intervention.png",  w: 174, h: 34, grip: [ 52, 27], muzzle: [173, 13], scale: 0.21, fx: "rifle" },   // Intervention

  m249:         { file: "armory/m249.png",          w: 165, h: 48, grip: [ 48, 36], muzzle: [164, 16], scale: 0.21, fx: "rifle" },   // M249 SAW
  rpk:          { file: "armory/rpk.png",           w: 159, h: 46, grip: [ 48, 26], muzzle: [158,  8], scale: 0.21, fx: "rifle" },   // RPK
  m60:          { file: "armory/m60.png",           w: 174, h: 38, grip: [ 46, 29], muzzle: [173,  9], scale: 0.21, fx: "rifle" },   // M60
  mg42:         { file: "armory/mg42.png",          w: 187, h: 40, grip: [ 54, 31], muzzle: [186, 14], scale: 0.21, fx: "rifle" },   // MG42
  stoner:       { file: "armory/stoner.png",        w: 153, h: 43, grip: [ 61, 28], muzzle: [152, 12], scale: 0.21, fx: "rifle" },   // Stoner 63

  laserrifle:   { file: "armory/laserrifle.png",    w: 153, h: 41, grip: [ 46, 32], muzzle: [152, 16], scale: 0.21, fx: "energy" },  // Laser Rifle
  plasmagun:    { file: "armory/plasmagun.png",     w:  67, h: 41, grip: [ 23, 34], muzzle: [ 66, 16], scale: 0.24, fx: "energy" },  // Plasma Gun
  raygun:       { file: "armory/raygun.png",        w:  77, h: 41, grip: [ 26, 25], muzzle: [ 76, 14], scale: 0.24, fx: "energy" },  // Ray Gun
  ioncannon:    { file: "armory/ioncannon.png",     w: 114, h: 33, grip: [ 44, 28], muzzle: [113, 14], scale: 0.21, fx: "energy" },  // Ion Cannon
  emp:          { file: "armory/emp.png",           w:  82, h: 40, grip: [ 28, 31], muzzle: [ 81, 14], scale: 0.24, fx: "energy" },  // EMP Blaster

  scifi1:       { file: "armory/scifi1.png",        w: 135, h: 44, grip: [ 33, 37], muzzle: [134, 15], scale: 0.21, fx: "energy" },  // Sci-Fi 1
  scifi2:       { file: "armory/scifi2.png",        w: 133, h: 44, grip: [ 42, 35], muzzle: [132, 14], scale: 0.21, fx: "energy" },  // Sci-Fi 2
  futurerifle:  { file: "armory/futurerifle.png",   w: 147, h: 45, grip: [ 44, 37], muzzle: [146, 18], scale: 0.21, fx: "energy" },  // Futuristic Rifle
  proto1:       { file: "armory/proto1.png",        w: 125, h: 44, grip: [ 52, 33], muzzle: [124, 14], scale: 0.21, fx: "energy" },  // Prototype 1
  proto2:       { file: "armory/proto2.png",        w: 110, h: 40, grip: [ 42, 31], muzzle: [109, 14], scale: 0.21, fx: "energy" },  // Prototype 2

  knife:        { file: "armory/knife.png",         w: 101, h: 20, grip: [ 16,  7], muzzle: [100,  6], scale: 0.19, fx: "small" },   // Combat Knife
  crowbar:      { file: "armory/crowbar.png",       w: 129, h: 20, grip: [ 28,  6], muzzle: [128, 12], scale: 0.19, fx: "small" },   // Crowbar
  machete:      { file: "armory/machete.png",       w: 126, h: 26, grip: [ 20,  9], muzzle: [125,  5], scale: 0.19, fx: "small" },   // Machete
  hatchet:      { file: "armory/hatchet.png",       w: 109, h: 32, grip: [ 17, 10], muzzle: [108, 26], scale: 0.19, fx: "small" },   // Hatchet
  baton:        { file: "armory/baton.png",         w: 113, h: 11, grip: [ 18,  4], muzzle: [112,  4], scale: 0.19, fx: "small" },   // Baton
};

/** Sprite trong game -> ảnh nào trong SHEET_GUNS. Thêm súng mới: thêm 1 dòng rồi trỏ `sprite` của vũ khí (weapons.js) vào tên bên trái. */
const SHEET_SPRITES = {
  deagle: "deagle", autoshotgun: "autoshotgun", barrett: "barrett",          // thay 3 ảnh tô màu tạm của bản trước
  a_colt: "colt", a_beretta: "beretta",
  a_combatsg: "combatsg", a_doublebarrel: "doublebarrel",
  a_scar: "scar", a_famas: "famas", a_g36c: "g36c",
  a_p90: "p90", a_tommy: "tommy", a_vector: "vector",
  a_dragunov: "dragunov", a_m24: "m24", a_intervention: "intervention",
  a_m249: "m249", a_rpk: "rpk", a_m60: "m60", a_mg42: "mg42", a_stoner: "stoner",
  a_raygun: "raygun", a_ioncannon: "ioncannon", a_emp: "emp",
  a_scifi1: "scifi1", a_scifi2: "scifi2", a_futurerifle: "futurerifle", a_proto1: "proto1", a_proto2: "proto2",
  a_knife: "knife", a_crowbar: "crowbar", a_machete: "machete", a_hatchet: "hatchet", a_baton: "baton",   // cận chiến
};

/**
 * >>> true = 11 khẩu cổ điển (Pistol 17, UZI, MP5, M4A1, AK-47, Hoa Cải Bơm, Sawed-off, AWP, Ổ Quay, Laser, Plasma)
 *     cũng dùng ảnh từ tấm kho vũ khí thay cho ảnh Pixel Armory. Mặc định false (ảnh Pixel Armory sắc nét hơn).
 */
export const CLASSIC_USE_SHEET_ART = false;
const CLASSIC_TO_SHEET = { pistol: "glock", revolver: "revolver", machinepistol: "uzi", smg: "mp5", carbine: "m4", rifle: "ak", shotgun: "pump", sawedoff: "sawedoff", sniper: "awp", laser: "laserrifle", plasma: "plasmagun" };

for (const [sprite, sheetId] of Object.entries(SHEET_SPRITES)) GUN_DATA[sprite] = SHEET_GUNS[sheetId];
if (CLASSIC_USE_SHEET_ART) for (const [sprite, sheetId] of Object.entries(CLASSIC_TO_SHEET)) GUN_DATA[sprite] = SHEET_GUNS[sheetId];

/**
 * BIẾN THỂ TÔ MÀU: dùng lại ảnh khẩu khác nhưng đổi bảng màu (tối -> giữa -> sáng) và kích thước.
 * Ví dụ: `goldAk: { base: "rifle", scale: 0.36, tint: ["#3a2604", "#d09a1c", "#fff2a8"] }` rồi trỏ `sprite: "goldAk"`.
 */
export const GUN_VARIANTS = {};

/** Đạn / vỏ đạn / tia chạm: file + kích thước gốc + điểm neo (tâm đạn) + hệ số thu nhỏ */
const PROJ_DATA = {
  bullet:  { file: "fx/bullet.png",  w: 19, h: 8,  anchor: [13, 4],  scale: 0.5 },    // neo gần mũi đạn
  pellet:  { file: "fx/pellet.png",  w: 9,  h: 9,  anchor: [4, 4],   scale: 0.5 },
  rocket:  { file: "fx/rocket.png",  w: 28, h: 14, anchor: [22, 7],  scale: 0.6 },
  grenade: { file: "fx/grenade.png", w: 18, h: 17, anchor: [9, 8],   scale: 0.6 },
  laser:   { file: "fx/laser.png",   w: 21, h: 9,  anchor: [15, 4],  scale: 0.55 },
  plasma:  { file: "fx/plasma.png",  w: 15, h: 15, anchor: [7, 7],   scale: 0.7 },
  shell:   { file: "fx/shell.png",   w: 13, h: 8,  anchor: [7, 4],   scale: 0.5 },
  impact0: { file: "fx/impact-0.png", w: 5,  h: 5,  anchor: [2, 2],  scale: 0.9 },
  impact1: { file: "fx/impact-1.png", w: 9,  h: 9,  anchor: [4, 4],  scale: 0.9 },
  impact2: { file: "fx/impact-2.png", w: 13, h: 13, anchor: [6, 6],  scale: 0.9 },
  impact3: { file: "fx/impact-3.png", w: 7,  h: 7,  anchor: [3, 3],  scale: 0.9 },
};

/** Lửa đầu nòng 4 khung (sprite sheet ngang, mỗi khung là 1 rect) */
const MUZZLE_DATA = {
  small:  { file: "fx/muzzle-small-sheet.png",  scale: 0.6,  rects: [[0, 0, 7, 6], [7, 0, 10, 8], [17, 0, 13, 12], [30, 0, 5, 6]] },
  rifle:  { file: "fx/muzzle-rifle-sheet.png",  scale: 0.65, rects: [[0, 0, 9, 8], [9, 0, 13, 12], [22, 0, 17, 14], [39, 0, 6, 6]] },
  heavy:  { file: "fx/muzzle-heavy-sheet.png",  scale: 0.7,  rects: [[0, 0, 10, 12], [10, 0, 15, 16], [25, 0, 20, 22], [45, 0, 7, 8]] },
  energy: { file: "fx/muzzle-energy-sheet.png", scale: 0.65, rects: [[0, 0, 10, 8], [10, 0, 14, 12], [24, 0, 18, 14], [42, 0, 6, 6]] },
};

/** Danh sách ảnh cần tải (main.js trộn vào IMAGE_MANIFEST) */
export const GUN_IMAGES = {};
for (const [id, g] of Object.entries(GUN_DATA)) GUN_IMAGES[`gun:${id}`] = BASE + g.file;
for (const [id, p] of Object.entries(PROJ_DATA)) GUN_IMAGES[`gunfx:${id.replace(/^impact(\d)$/, "impact-$1")}`] = BASE + p.file;
for (const [id, m] of Object.entries(MUZZLE_DATA)) GUN_IMAGES[`gunfx:muzzle-${id}`] = BASE + m.file;

// ------------------------------------------------------------------ THU NHỎ ẢNH PIXEL
/** Điểm cầm vẽ lệch về phía trục nòng bao nhiêu (0 = đúng tay cầm, 1 = đúng trục nòng). Giúp đạn bay ra đúng đầu nòng. */
const AIM_BLEND = 0.75;

const SPR = {};          // id súng -> { cv, w, h, gx, gy, oy, mx, my, fx }
const PROJ = {};         // id đạn -> { cv, w, h, ax, ay }
const MUZ = {};          // kiểu lửa nòng -> [{ cv, w, h }] x4
let ready = false;

function newCanvas(w, h) { const c = document.createElement("canvas"); c.width = Math.max(1, w); c.height = Math.max(1, h); return c; }

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

/** Đổi màu theo độ sáng: tối -> giữa -> sáng (tint = 3 mã màu #rrggbb) */
function tintData(d, tint) {
  const [a, b, c] = tint.map(hex);
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    const L = clamp(((0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2]) / 255 - 0.08) / 0.8, 0, 1);
    const [p, q, k] = L < 0.5 ? [a, b, L * 2] : [b, c, (L - 0.5) * 2];
    d[i] = p[0] + (q[0] - p[0]) * k; d[i + 1] = p[1] + (q[1] - p[1]) * k; d[i + 2] = p[2] + (q[2] - p[2]) * k;
  }
}

/**
 * Thu nhỏ bằng lấy trung bình theo diện tích (làm mịn) rồi NGƯỠNG alpha (>=128 -> 255, còn lại 0)
 * để giữ viền pixel sắc nét, không bị mờ.
 */
function shrink(src, sx, sy, sw, sh, dw, dh, tint) {
  const tmp = newCanvas(sw, sh), tg = tmp.getContext("2d", { willReadFrequently: true });
  tg.drawImage(src, sx, sy, sw, sh, 0, 0, sw, sh);
  const id = tg.getImageData(0, 0, sw, sh), s = id.data;
  if (tint) tintData(s, tint);
  const out = newCanvas(dw, dh), og = out.getContext("2d"), od = og.createImageData(dw, dh), o = od.data;
  const kx = sw / dw, ky = sh / dh;
  for (let y = 0; y < dh; y++) for (let x = 0; x < dw; x++) {
    const x0 = x * kx, x1 = (x + 1) * kx, y0 = y * ky, y1 = (y + 1) * ky;
    let r = 0, g = 0, b = 0, a = 0, area = 0;
    for (let yy = Math.floor(y0); yy < Math.ceil(y1); yy++) for (let xx = Math.floor(x0); xx < Math.ceil(x1); xx++) {
      const wgt = (Math.min(x1, xx + 1) - Math.max(x0, xx)) * (Math.min(y1, yy + 1) - Math.max(y0, yy));
      if (wgt <= 0 || xx >= sw || yy >= sh) continue;
      const i = (yy * sw + xx) * 4, al = (s[i + 3] / 255) * wgt;
      r += s[i] * al; g += s[i + 1] * al; b += s[i + 2] * al; a += al; area += wgt;
    }
    const k = (y * dw + x) * 4;
    if (area > 0 && a / area >= 0.5) { o[k] = r / a; o[k + 1] = g / a; o[k + 2] = b / a; o[k + 3] = 255; }
  }
  og.putImageData(od, 0, 0);
  return out;
}

function buildGun(img, def, scale, tint) {
  const dw = Math.max(4, Math.round(def.w * scale)), dh = Math.max(4, Math.round(def.h * scale));
  const rx = dw / def.w, ry = dh / def.h;
  const gx = Math.round(def.grip[0] * rx), gy = Math.round(def.grip[1] * ry), mx = Math.round(def.muzzle[0] * rx), my = Math.round(def.muzzle[1] * ry);
  return { cv: shrink(img, 0, 0, img.width, img.height, dw, dh, tint), w: dw, h: dh, gx, gy, mx, my, oy: Math.round(gy + (my - gy) * AIM_BLEND), fx: def.fx };
}

/** Gọi 1 lần sau khi tải xong ảnh. Thiếu ảnh nào thì bỏ qua khẩu đó (weapons.js vẽ dự phòng bằng code). */
export function prepareGunSprites(images) {
  if (ready) return;
  ready = true;
  for (const [id, def] of Object.entries(GUN_DATA)) {
    const img = images[`gun:${id}`];
    if (img) SPR[id] = buildGun(img, def, def.scale, null);
  }
  for (const [id, v] of Object.entries(GUN_VARIANTS)) {
    const img = images[`gun:${v.base}`];
    if (img) SPR[id] = buildGun(img, GUN_DATA[v.base], v.scale, v.tint);
  }
  for (const [id, p] of Object.entries(PROJ_DATA)) {
    const img = images[`gunfx:${id.replace(/^impact(\d)$/, "impact-$1")}`];
    if (!img) continue;
    const dw = Math.max(2, Math.round(p.w * p.scale)), dh = Math.max(2, Math.round(p.h * p.scale));
    PROJ[id] = { cv: shrink(img, 0, 0, img.width, img.height, dw, dh, null), w: dw, h: dh, ax: Math.round(p.anchor[0] * dw / p.w), ay: Math.round(p.anchor[1] * dh / p.h) };
  }
  for (const [id, m] of Object.entries(MUZZLE_DATA)) {
    const img = images[`gunfx:muzzle-${id}`];
    if (!img) continue;
    MUZ[id] = m.rects.map(([x, y, w, h]) => {
      const dw = Math.max(2, Math.round(w * m.scale)), dh = Math.max(2, Math.round(h * m.scale));
      return { cv: shrink(img, x, y, w, h, dw, dh, null), w: dw, h: dh };
    });
  }
}

// ------------------------------------------------------------------ TRUY VẤN / VẼ SÚNG
const sprOf = (w) => SPR[typeof w === "string" ? w : w?.sprite];

/** Khẩu súng này có ảnh sẵn sàng không (chưa tải thì weapons.js vẽ dự phòng) */
export const hasGunSprite = (w) => !!sprOf(w);

/** Vẽ súng: gốc = bàn tay, nòng sang PHẢI. Trả về false nếu chưa có ảnh. */
export function drawGunSprite(c, w) {
  const s = sprOf(w);
  if (!s) return false;
  c.drawImage(s.cv, -s.gx, -s.oy);
  return true;
}

/** Khoảng cách từ tay cầm tới đầu nòng + 4 (khớp công thức Player.muzzle trong main.js) */
export function gunMuzzleLength(w) { const s = sprOf(w); return s ? s.mx - s.gx + 4 : null; }
/** Bề ngang [trái, phải] so với gốc (căn giữa icon) */
export function gunSpan(w) { const s = sprOf(w); return s ? [-s.gx, s.w - s.gx] : null; }
/** Độ lệch dọc từ gốc tới tâm ảnh (căn giữa vật phẩm rơi trên đất) */
export function gunCenterY(w) { const s = sprOf(w); return s ? Math.round(s.h / 2 - s.oy) : 0; }

/** Icon trong ô (bw x bh) tại (x,y): căn giữa, tự co nếu quá to so với ô; scale > 1 phóng nguyên (pixel nở đều) */
export function drawGunIcon(g, w, x, y, bw, bh, scale = 1) {
  const s = sprOf(w);
  if (!s) return false;
  let k = Math.min(scale, (bw - 2) / s.w, (bh - 2) / s.h);
  if (k >= 1) k = Math.floor(k);
  const dw = Math.max(1, Math.round(s.w * k)), dh = Math.max(1, Math.round(s.h * k));
  g.save();
  g.imageSmoothingEnabled = false;
  g.drawImage(s.cv, Math.round(x + (bw - dw) / 2), Math.round(y + (bh - dh) / 2), dw, dh);
  g.restore();
  return true;
}

/**
 * Vẽ đạn sprite của viên `b` (c đã dịch tới vị trí đạn). b: { sprite, angle, age, life, arc }.
 * Lựu đạn / plasma có bóng đổ dưới đất + bay vòng cung (arc = độ cao đỉnh, px).
 */
export function drawGunProjectile(c, b) {
  const p = PROJ[b.sprite];
  if (!p) return false;
  const kind = b.sprite;
  let lift = 0;
  if (b.arc) {
    const u = clamp(b.age / b.life, 0, 1);
    lift = b.arc * 4 * u * (1 - u);
    c.fillStyle = "rgba(0,0,0,0.3)"; c.fillRect(-3, 1, 6, 2);   // bóng dưới đất
  }
  c.save();
  c.translate(0, -Math.round(lift));
  if (kind === "grenade") c.rotate(b.age * 12); else c.rotate(b.angle);
  if (kind === "laser" || kind === "plasma") {   // quầng sáng
    const pulse = Math.sin(b.age * 40) > 0 ? 1 : 0;
    c.fillStyle = kind === "laser" ? "rgba(90,240,255,0.25)" : "rgba(190,110,255,0.3)";
    if (kind === "laser") c.fillRect(-p.ax - 1, -p.ay - 1, p.w + 2, p.h + 2);
    else c.fillRect(-p.ax - 2 - pulse, -p.ay - 2 - pulse, p.w + 4 + pulse * 2, p.h + 4 + pulse * 2);
  }
  c.drawImage(p.cv, -p.ax, -p.ay);
  c.restore();
  return true;
}

// ------------------------------------------------------------------ HIỆU ỨNG (mảng tái sử dụng, giới hạn số lượng)
const MAX_FLASH = 24, MAX_SHELL = 36, MAX_IMPACT = 28;
const mk = (n, f) => Array.from({ length: n }, f);
const flashes = mk(MAX_FLASH, () => ({ on: false, x: 0, y: 0, a: 0, t: 0, dur: 0.075, kind: "small", sc: 1 }));
const shells = mk(MAX_SHELL, () => ({ on: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, rot: 0, vr: 0, life: 0, bounced: 0, big: false }));
const impacts = mk(MAX_IMPACT, () => ({ on: false, x: 0, y: 0, t: 0, dur: 0.18 }));
let flashI = 0, shellI = 0, impactI = 0;

/** Lửa đầu nòng tại (x,y) quay theo góc `a`; kind = "small" | "rifle" | "heavy" | "energy" */
export function gunFlash(x, y, a, kind = "small", sc = 1) {
  const f = flashes[flashI]; flashI = (flashI + 1) % MAX_FLASH;
  f.on = true; f.x = x; f.y = y; f.a = a; f.t = 0; f.kind = kind; f.sc = sc;
  f.dur = kind === "heavy" ? 0.095 : 0.075;
}

/** Vỏ đạn văng ra từ khe súng (cùng quy ước với Game.ejectShell: (x,y) = điểm khe súng trên tay) */
export function gunShell(x, y, aim, big = false) {
  const s = shells[shellI]; shellI = (shellI + 1) % MAX_SHELL;
  const side = Math.cos(aim) < 0 ? 1 : -1, a = aim + Math.PI * 0.62 * side + rand(-0.25, 0.25), sp = rand(50, 90);
  s.on = true; s.x = x; s.y = y + 12; s.z = 12; s.vx = Math.cos(a) * sp; s.vy = Math.sin(a) * sp * 0.5; s.vz = rand(60, 100);
  s.rot = rand(0, TAU); s.vr = rand(-18, 18); s.life = 2.4; s.bounced = 0; s.big = big;
}

/** Tia lửa khi đạn chạm tường */
export function gunImpact(x, y) {
  const f = impacts[impactI]; impactI = (impactI + 1) % MAX_IMPACT;
  f.on = true; f.x = x; f.y = y; f.t = 0;
}

export function updateGunFx(dt) {
  for (const f of flashes) if (f.on && (f.t += dt) >= f.dur) f.on = false;
  for (const f of impacts) if (f.on && (f.t += dt) >= f.dur) f.on = false;
  for (const s of shells) {
    if (!s.on) continue;
    if ((s.life -= dt) <= 0) { s.on = false; continue; }
    if (s.z > 0 || s.vz > 0) {
      s.vz -= 420 * dt; s.z += s.vz * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.rot += s.vr * dt;
      if (s.z <= 0) {
        s.z = 0;
        if (s.bounced++ < 2 && s.vz < -40) { s.vz = -s.vz * 0.4; s.vx *= 0.5; s.vy *= 0.5; s.vr *= 0.5; } else { s.vz = 0; s.vx = s.vy = 0; s.vr = 0; }
      }
    }
  }
}

export function drawGunFx(ctx) {
  const sh = PROJ.shell;
  if (sh) {
    for (const s of shells) {
      if (!s.on) continue;
      ctx.globalAlpha = Math.min(1, s.life / 0.6);
      ctx.save();
      ctx.translate(Math.round(s.x), Math.round(s.y - s.z));
      ctx.rotate(Math.round(s.rot * 2) / 2);
      if (s.big) ctx.scale(1.4, 1.4);
      ctx.drawImage(sh.cv, -sh.ax, -sh.ay);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
  for (const f of impacts) {
    if (!f.on) continue;
    const p = PROJ["impact" + Math.min(3, Math.floor((f.t / f.dur) * 4))];
    if (p) ctx.drawImage(p.cv, Math.round(f.x) - p.ax, Math.round(f.y) - p.ay);
  }
  for (const f of flashes) {
    if (!f.on) continue;
    const fr = MUZ[f.kind]?.[Math.min(3, Math.floor((f.t / f.dur) * 4))];
    if (!fr) continue;
    ctx.save();
    ctx.translate(Math.round(f.x), Math.round(f.y));
    ctx.rotate(f.a);
    if (f.sc !== 1) ctx.scale(f.sc, f.sc);
    ctx.drawImage(fr.cv, -1, -Math.round(fr.h / 2));
    ctx.restore();
  }
}

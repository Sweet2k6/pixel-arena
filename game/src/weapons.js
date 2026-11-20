// =====================================================================================
//  KHO VŨ KHÍ + ĐẠN (bản 4.0)
//
//  Vũ khí khởi đầu của từng nhân vật nằm trong characters.js (luôn tốn 0 Năng Lượng).
//  File này chứa VŨ KHÍ NHẶT TỪ RƯƠNG / MUA / CHẾ TẠO (WEAPONS) + cách bắn của mọi loại vũ khí.
//
//  ĐỘ HIẾM (src/rarity.js): Thường (trắng) · Hiếm (xanh lá) · Sử Thi (xanh dương) · Huyền Thoại (cam) · Thần Thoại (đỏ)
//  NĂNG LƯỢNG: `cost` = năng lượng mỗi phát (cận chiến = 0). Hết năng lượng thì không bắn được — đổi sang vũ khí khởi đầu.
//  NHÓM VŨ KHÍ:
//    * Cận chiến (melee/sword/scythe/gauntlet/hammer/dragon): combo 3 đòn — đòn 3 hất văng diện rộng + chí mạng;
//      mọi nhát chém PHẢN ĐẠN quái trong vùng chém.
//    * Tích lực (`charge`): GIỮ chuột để tụ lực (vòng sáng quanh nhân vật), THẢ ra để tung đòn cực mạnh xuyên thấu.
//    * Súng: giật nòng, văng vỏ đạn xuống đất; laser xuyên thấu.
//  GHÉP (MERGE): 2 khẩu giống nhau cùng ★ -> ★+1 · 2 khẩu ★3 có `evolve` -> vũ khí Thần Thoại · công thức RECIPES.
//  Muốn chỉnh chỉ số (sát thương, tốc độ bắn, năng lượng...): sửa trong WEAPONS bên dưới.
// =====================================================================================
import { angleDiff, circleHit, pointSegDist2, withAlpha, rand, TAU } from "./util.js";
import { Pool } from "./pool.js";
import { RARITY, rarityColor } from "./rarity.js";
import { drawGunSprite, drawGunIcon, drawGunProjectile, gunMuzzleLength, gunSpan, gunCenterY, gunFlash, gunShell, gunImpact } from "./guns.js";

/** Màu nhãn độ hiếm vũ khí (giữ tên cũ cho các file khác) */
export const WEAPON_RARITY = Object.fromEntries(Object.entries(RARITY).map(([k, v]) => [k, v.color]));
export { RARITY, rarityColor };

export const WEAPONS = {
  // ---------------- THƯỜNG (trắng) ----------------
  shotgun: {
    id: "shotgun", name: "Shotgun Săn Quái", desc: "5 viên tỏa hình nón 30°, đẩy lùi cực mạnh ở tầm gần",
    type: "shotgun", rarity: "common", cost: 2, shells: true,
    damage: 2, fireRate: 0.72, pellets: 5, cone: (30 * Math.PI) / 180,
    bulletSpeed: 380, range: 150, bulletRadius: 2, knockback: 340,
    color: "#ffb347", sound: "shotgun",
  },
  sword: {
    id: "sword", name: "Kiếm Năng Lượng", desc: "Combo 3 nhát, sóng kiếm khí bán nguyệt — phản đạn của quái",
    type: "sword", rarity: "common", cost: 0, evolve: "dragonBlade",
    damage: 3, fireRate: 0.34, range: 48, arc: Math.PI / 2, knockback: 240,
    color: "#7cd8ff", sound: "sword",
    slashPalette: ["#061a2e", "#0e3a66", "#1c6cb0", "#3aa8e8", "#7cd8ff", "#c8f2ff", "#ffffff"],
  },
  boomerang: {
    id: "boomerang", name: "Boomerang Hồi Quy", desc: "Bay ra 190px rồi quay về tay, cắt xuyên mọi quái trên đường",
    type: "boomerang", rarity: "common", cost: 1,
    damage: 2, fireRate: 0.55, bulletSpeed: 300, range: 190, bulletRadius: 6, knockback: 140,
    color: "#e8b030", sound: "sword",
  },
  poison: {
    id: "poison", name: "Súng Phun Độc", desc: "Cầu độc vỡ thành đám mây độc 3s: rút máu & làm chậm quái",
    type: "poison", rarity: "common", cost: 2,
    damage: 1, fireRate: 0.6, bulletSpeed: 240, range: 210, bulletRadius: 4, knockback: 40,
    cloud: { r: 34, life: 3, tick: 0.4, dmg: 0.45, slow: 1 },
    color: "#a6f06a", sound: "poison",
  },
  disc: {
    id: "disc", name: "Đĩa Năng Lượng", desc: "Lưỡi cưa năng lượng bật qua lại giữa 3 quái liên tiếp",
    type: "disc", rarity: "common", cost: 1,
    damage: 2, fireRate: 0.5, bulletSpeed: 300, bulletRadius: 5, ricochet: 3, knockback: 100,
    color: "#7cc8ff", sound: "disc",
  },
  // ---------------- HIẾM (xanh lá) ----------------
  frostbow: {
    id: "frostbow", name: "Cung Băng", desc: "Tên băng tốc độ cao xuyên 2 quái, làm chậm 50% trong 2.5s",
    type: "frostbow", rarity: "rare", cost: 1,
    damage: 3, fireRate: 0.5, bulletSpeed: 460, bulletRadius: 3, pierce: 2, slow: 2.5, knockback: 90,
    color: "#7cd8ff", sound: "arrow",
  },
  minigun: {
    id: "minigun", name: "Súng Máy Gatling", desc: "Giữ chuột để nòng quay nhanh dần — xả đạn như mưa",
    type: "minigun", rarity: "rare", cost: 0.25, shells: true,
    damage: 0.6, fireRate: 0.055, spinUp: 1.1, bulletSpeed: 380, bulletRadius: 2, spread: 0.2, knockback: 50,
    color: "#ffd34a", sound: "shoot",
  },
  flamethrower: {
    id: "flamethrower", name: "Súng Phun Lửa", desc: "Luồng lửa xuyên qua quái, đốt cháy 1 sát thương/giây trong 3s",
    type: "flamethrower", rarity: "rare", cost: 0.2,
    damage: 0.3, fireRate: 0.05, bulletSpeed: 210, range: 95, knockback: 15, burn: 3,
    color: "#ff8a2a", sound: "flame",
  },
  gauntlet: {
    id: "gauntlet", name: "Găng Bão Tố", desc: "Đấm liên hoàn cực nhanh — combo 3 cú, cú cuối nổ sóng xung kích",
    type: "gauntlet", rarity: "rare", cost: 0,
    damage: 2.2, fireRate: 0.2, range: 34, arc: 1.1, knockback: 200,
    color: "#ffd34a", sound: "punch",
  },
  longbow: {
    id: "longbow", name: "Cung Dài Thợ Săn", desc: "GIỮ chuột để kéo căng dây: thả ra bắn tên xuyên thấu cực mạnh",
    type: "longbow", rarity: "rare", cost: 2, evolve: "stormBow",
    charge: { time: 0.85, min: 0.16, dmg: 2.2 },
    damage: 2.6, fireRate: 0.32, bulletSpeed: 440, bulletRadius: 3, pierce: 1, knockback: 120,
    color: "#c8f070", sound: "bow",
  },
  // ---------------- SỬ THI (xanh dương) ----------------
  laser: {
    id: "laser", name: "Súng Laser Xuyên Thấu", desc: "Tia năng lượng tức thì, xuyên qua mọi quái trên đường",
    type: "laser", rarity: "epic", cost: 2,
    damage: 3, fireRate: 0.42, range: 420, width: 3, knockback: 60,
    color: "#ff4ad8", sound: "laser",
  },
  grenade: {
    id: "grenade", name: "Súng Phóng Lựu", desc: "Cầu năng lượng nổ diện rộng bán kính 90px",
    type: "grenade", rarity: "epic", cost: 4,
    damage: 5, fireRate: 0.9, bulletSpeed: 230, range: 260, bulletRadius: 4, aoe: 90, knockback: 260,
    color: "#7cffb0", sound: "grenadeShoot",
  },
  lightning: {
    id: "lightning", name: "Súng Sét Xích", desc: "Tia sét nhảy qua 4 quái liên tiếp, xuyên cả khiên",
    type: "lightning", rarity: "epic", cost: 2,
    damage: 2.2, fireRate: 0.42, range: 210, chains: 4, chainRange: 95, knockback: 40,
    color: "#a8e0ff", sound: "zap",
  },
  scythe: {
    id: "scythe", name: "Lưỡi Hái Tử Thần", desc: "Quét vòng cung 270° — cứ 10 quái bị chém gục hồi 1 Máu",
    type: "scythe", rarity: "epic", cost: 0,
    damage: 3.2, fireRate: 0.6, range: 56, arc: 2.35, knockback: 200, reap: 10,
    color: "#7fd6c0", sound: "scythe",
  },
  sniper: {
    id: "sniper", name: "Súng Bắn Tỉa", desc: "Phát bắn tức thì xuyên 3 quái, +25% tỉ lệ chí mạng",
    type: "sniper", rarity: "epic", cost: 4, shells: true,
    damage: 7, fireRate: 0.95, range: 560, pierce: 3, critBonus: 0.25, knockback: 160,
    color: "#fff3a6", sound: "sniper",
  },
  thunderHammer: {
    id: "thunderHammer", name: "Búa Sấm Sét", desc: "Nện choáng. GIỮ chuột tụ lực: thả ra giáng sấm diện rộng",
    type: "hammer", rarity: "epic", cost: 0, chargeCost: 5,
    charge: { time: 1.1, min: 0.22, dmg: 2.6 },
    damage: 3.6, fireRate: 0.6, range: 46, aoe: 36, knockback: 300, stun: 0.6,
    color: "#7ce0ff", sound: "hammer", thunder: true,
  },
  // ---------------- HUYỀN THOẠI (cam) ----------------
  rocket: {
    id: "rocket", name: "Bệ Phóng Tên Lửa", desc: "Tên lửa tầm nhiệt tự đuổi theo quái, nổ diện rộng 70px",
    type: "rocket", rarity: "legend", cost: 5,
    damage: 7, fireRate: 1.0, bulletSpeed: 150, maxSpeed: 340, homing: 3.4, range: 2.4, bulletRadius: 4, aoe: 70, knockback: 280,
    color: "#ff7a3a", sound: "rocket",
  },
  meteor: {
    id: "meteor", name: "Trượng Thiên Thạch", desc: "Gọi thiên thạch rơi xuống chỗ ngắm: nổ 62px + thiêu đốt",
    type: "meteor", rarity: "legend", cost: 6,
    damage: 8, fireRate: 1.2, range: 240, aoe: 62, delay: 0.55, burn: 2, knockback: 300,
    color: "#ff8a2a", sound: "meteorCast",
  },
  energyCannon: {
    id: "energyCannon", name: "Pháo Năng Lượng", desc: "GIỮ chuột nạp năng lượng: thả ra bắn quả cầu khổng lồ xuyên mọi thứ",
    type: "cannon", rarity: "legend", cost: 7, evolve: "voidCannon",
    charge: { time: 1.2, min: 0.2, dmg: 3 },
    damage: 4, fireRate: 0.5, bulletSpeed: 250, bulletRadius: 5, knockback: 320,
    color: "#5ef0ff", sound: "laser",
  },
  // ---------------- THẦN THOẠI (đỏ) — chỉ có từ GHÉP vũ khí hoặc Rương Boss ----------------
  dragonBlade: {
    id: "dragonBlade", name: "Long Kiếm Diệt Thần", desc: "Mỗi nhát chém phóng sóng lửa rồng xuyên thấu; đòn 3 thiêu rụi cả vùng",
    type: "dragon", rarity: "mythic", cost: 1,
    damage: 5, fireRate: 0.32, range: 56, arc: 1.75, knockback: 280, burn: 2.5,
    color: "#ff5a2a", sound: "sword",
    slashPalette: ["#2a0604", "#5a0e08", "#a8200e", "#e84a1a", "#ff8a2a", "#ffd25e", "#ffffff"],
  },
  voidCannon: {
    id: "voidCannon", name: "Pháo Hư Không", desc: "Nạp lực bắn lỗ đen: hút quái vào tâm rồi phát nổ hủy diệt",
    type: "cannon", rarity: "mythic", cost: 10, void: true,
    charge: { time: 1.1, min: 0.2, dmg: 3.2 },
    damage: 5, fireRate: 0.5, bulletSpeed: 210, bulletRadius: 6, knockback: 200,
    color: "#b05aff", sound: "laser",
  },
  stormBow: {
    id: "stormBow", name: "Cung Thần Bão", desc: "Tên sấm sét: trúng quái thì sét nhảy sang 3 quái khác. Tích lực bắn 5 tên",
    type: "longbow", rarity: "mythic", cost: 3, zap: 3,
    charge: { time: 0.8, min: 0.16, dmg: 2.2 },
    damage: 3.6, fireRate: 0.3, bulletSpeed: 520, bulletRadius: 3, pierce: 2, knockback: 130,
    color: "#a8e0ff", sound: "bow",
  },
  // =====================================================================================
  //  KHO SÚNG PIXEL ARMORY (type "firearm") — dùng BĂNG ĐẠN thay vì Năng Lượng (cost 0)
  //  mag = đạn / băng · reload = giây nạp · noise = bán kính tiếng ồn (px) thu hút zombie
  //  sprite = tên ảnh trong src/guns.js (GUN_DATA / GUN_VARIANTS) · proj = ảnh đạn (bullet|pellet|rocket|grenade|laser|plasma)
  //  fireRate = 60 / phát-mỗi-phút · bulletSpeed px/giây · range px · aoe = bán kính nổ · pierce = xuyên thêm · beam = tia tức thì
  //  >>> CHỈNH CHỈ SỐ SÚNG Ở ĐÂY. Quy đổi: sát thương ≈ sát thương manifest / 14.
  // =====================================================================================
  // ---------------- SÚNG: THƯỜNG ----------------
  gPistol: {
    id: "gPistol", name: "Súng Lục Pistol 17", desc: "Nhẹ, gọn, băng 12 viên. Khẩu mở đầu đáng tin cậy.",
    type: "firearm", sprite: "pistol", proj: "bullet", rarity: "common", cost: 0, shells: true,
    damage: 1.6, fireRate: 60 / 380, mag: 12, reload: 0.85, auto: false, noise: 260,
    bulletSpeed: 520, range: 300, spread: 0.02, bulletRadius: 2, knockback: 110, kick: 4, shake: [0.05, 1], color: "#ffe26b", sound: "pistol", muzzleFx: "small",
  },
  gUzi: {
    id: "gUzi", name: "Tiểu Liên UZI", desc: "Xả đạn liên thanh cực nhanh, tầm gần. Băng 24 viên.",
    type: "firearm", sprite: "machinepistol", proj: "bullet", rarity: "common", cost: 0, shells: true,
    damage: 0.75, fireRate: 60 / 720, mag: 24, reload: 1.15, auto: true, noise: 300,
    bulletSpeed: 480, range: 240, spread: 0.075, bulletRadius: 2, knockback: 60, kick: 2, shake: [0.04, 0.8], color: "#ffe26b", sound: "pistol", muzzleFx: "small",
  },
  gBaton: {
    id: "gBaton", name: "Dùi Cui", desc: "Gậy cao su cứng: đánh đẩy lùi mạnh và làm quái choáng 1 giây",
    type: "blade", sprite: "a_baton", look: "baton", rarity: "common", cost: 0, noise: 0,
    damage: 1.6, fireRate: 0.3, range: 38, arc: 1.2, knockback: 430, stun: 1.0, color: "#c8cde0", sound: "punch",
  },
  gKnife: {
    id: "gKnife", name: "Dao Găm Combat Knife", desc: "Đâm cực nhanh, im lặng. Sát thương nhỏ nhưng liên hoàn",
    type: "blade", sprite: "a_knife", look: "knife", rarity: "common", cost: 0, noise: 0,
    damage: 1.3, fireRate: 0.14, range: 30, arc: 1.0, knockback: 70, color: "#e8ecff", sound: "sword",
  },
  gColt: {
    id: "gColt", name: "Colt M1911", desc: "Súng lục .45 huyền thoại: 7 viên, mỗi phát đau hơn Pistol 17.",
    type: "firearm", sprite: "a_colt", proj: "bullet", rarity: "common", cost: 0, shells: true,
    damage: 2.2, fireRate: 60 / 300, mag: 7, reload: 1.0, auto: false, noise: 280,
    bulletSpeed: 540, range: 310, spread: 0.015, bulletRadius: 2, knockback: 150, kick: 5, shake: [0.07, 1.4], color: "#ffe26b", sound: "pistol", muzzleFx: "small",
  },
  gBeretta: {
    id: "gBeretta", name: "Beretta M9", desc: "Súng lục 15 viên, nhịp bắn nhanh, mỗi phát nhẹ nhưng liên tục.",
    type: "firearm", sprite: "a_beretta", proj: "bullet", rarity: "common", cost: 0, shells: true,
    damage: 1.2, fireRate: 60 / 520, mag: 15, reload: 1.0, auto: false, noise: 270,
    bulletSpeed: 520, range: 290, spread: 0.03, bulletRadius: 2, knockback: 90, kick: 3, shake: [0.05, 1], color: "#ffe26b", sound: "pistol", muzzleFx: "small",
  },
  // ---------------- SÚNG: HIẾM ----------------
  gMp5: {
    id: "gMp5", name: "Tiểu Liên MP5", desc: "Băng thẳng 32 viên, tốc độ bắn cao, giật nhẹ, bắn chính xác hơn UZI.",
    type: "firearm", sprite: "smg", proj: "bullet", rarity: "rare", cost: 0, shells: true,
    damage: 0.75, fireRate: 60 / 860, mag: 32, reload: 1.25, auto: true, noise: 300,
    bulletSpeed: 500, range: 280, spread: 0.055, bulletRadius: 2, knockback: 60, kick: 2, shake: [0.04, 0.8], color: "#ffe26b", sound: "pistol", muzzleFx: "small",
  },
  gRevolver: {
    id: "gRevolver", name: "Ổ Quay Magnum", desc: "Nòng dài, 6 viên. Chậm nhưng từng phát rất đau.",
    type: "firearm", sprite: "revolver", proj: "bullet", rarity: "rare", cost: 0, shells: true,
    damage: 3.4, fireRate: 60 / 140, mag: 6, reload: 1.35, auto: false, noise: 280, pierce: 1,
    bulletSpeed: 560, range: 340, spread: 0.01, bulletRadius: 2, knockback: 200, kick: 6, shake: [0.08, 2], color: "#ffd34a", sound: "pistol", muzzleFx: "small",
  },
  gPump: {
    id: "gPump", name: "Hoa Cải Bơm", desc: "Mỗi phát 6 viên chì tỏa chùm, hất lùi mạnh. Băng 6 viên.",
    type: "firearm", sprite: "shotgun", proj: "pellet", rarity: "rare", cost: 0, shells: true, shellBig: true,
    damage: 1.5, fireRate: 60 / 80, mag: 6, reload: 1.5, auto: false, noise: 380, pellets: 6,
    bulletSpeed: 440, range: 170, spread: 0.2, bulletRadius: 2, knockback: 300, kick: 8, shake: [0.14, 3], color: "#ffb347", sound: "shotgun", muzzleFx: "heavy",
  },
  gSawedoff: {
    id: "gSawedoff", name: "Hai Nòng Cụt Sawed-off", desc: "Hai nòng cưa ngắn, 8 viên chì. Sát mặt là hết chuyện.",
    type: "firearm", sprite: "sawedoff", proj: "pellet", rarity: "rare", cost: 0, shells: true, shellBig: true,
    damage: 1.2, fireRate: 60 / 110, mag: 2, reload: 1.4, auto: false, noise: 380, pellets: 8,
    bulletSpeed: 420, range: 130, spread: 0.34, bulletRadius: 2, knockback: 340, kick: 10, shake: [0.16, 3.5], color: "#ffb347", sound: "shotgun", muzzleFx: "heavy",
  },
  gCrowbar: {
    id: "gCrowbar", name: "Xà Beng Crowbar", desc: "Thanh thép dài: đập choáng quái 0.8 giây, tầm xa hơn dao",
    type: "blade", sprite: "a_crowbar", look: "crowbar", rarity: "rare", cost: 0, noise: 0,
    damage: 2.2, fireRate: 0.38, range: 40, arc: 1.1, knockback: 260, stun: 0.8, color: "#d84a3a", sound: "punch",
  },
  gMachete: {
    id: "gMachete", name: "Dao Rựa Machete", desc: "Lưỡi dài chém vòng cung rộng, quét được cả đám quái",
    type: "blade", sprite: "a_machete", look: "machete", rarity: "rare", cost: 0, noise: 0,
    damage: 2.6, fireRate: 0.3, range: 46, arc: 1.55, knockback: 200, color: "#d8e0f0", sound: "sword",
  },
  gPlasma: {
    id: "gPlasma", name: "Súng Plasma", desc: "Cuộn từ tím, đạn chậm nổ nhỏ gây sát thương lan 30px.",
    type: "firearm", sprite: "plasma", proj: "plasma", rarity: "rare", cost: 0,
    damage: 2.6, fireRate: 60 / 220, mag: 8, reload: 1.3, auto: false, noise: 220, aoe: 30, explodeSource: "cannon",
    bulletSpeed: 380, range: 280, spread: 0.03, bulletRadius: 3, knockback: 180, kick: 5, shake: [0.06, 1.5], color: "#c88aff", sound: "energyGun", muzzleFx: "energy",
  },
  gCombatSg: {
    id: "gCombatSg", name: "Hoa Cải Combat", desc: "Hoa cải bán tự động 8 viên, 6 chì mỗi phát, nhịp bắn nhanh hơn Hoa Cải Bơm.",
    type: "firearm", sprite: "a_combatsg", proj: "pellet", rarity: "rare", cost: 0, shells: true, shellBig: true, pellets: 6,
    damage: 1.3, fireRate: 60 / 150, mag: 8, reload: 2.0, auto: false, noise: 380,
    bulletSpeed: 440, range: 180, spread: 0.19, bulletRadius: 2, knockback: 260, kick: 7, shake: [0.12, 2.6], color: "#ffb347", sound: "shotgun", muzzleFx: "heavy",
  },
  gDoubleBarrel: {
    id: "gDoubleBarrel", name: "Hai Nòng Dài Double Barrel", desc: "Hai nòng dài chỉ 2 viên nhưng 10 chì mỗi phát, tầm xa hơn Sawed-off.",
    type: "firearm", sprite: "a_doublebarrel", proj: "pellet", rarity: "rare", cost: 0, shells: true, shellBig: true, pellets: 10,
    damage: 1.3, fireRate: 60 / 100, mag: 2, reload: 1.5, auto: false, noise: 400,
    bulletSpeed: 420, range: 170, spread: 0.28, bulletRadius: 2, knockback: 380, kick: 10, shake: [0.17, 3.6], color: "#ffb347", sound: "shotgun", muzzleFx: "heavy",
  },
  gG36c: {
    id: "gG36c", name: "Carbine G36C", desc: "Carbine chính xác, băng 30 viên, giật cực nhẹ.",
    type: "firearm", sprite: "a_g36c", proj: "bullet", rarity: "rare", cost: 0, shells: true,
    damage: 1.1, fireRate: 60 / 560, mag: 30, reload: 1.3, auto: true, noise: 360,
    bulletSpeed: 520, range: 350, spread: 0.02, bulletRadius: 2, knockback: 80, kick: 2, shake: [0.04, 0.9], color: "#ffe26b", sound: "rifle", muzzleFx: "rifle",
  },
  gP90: {
    id: "gP90", name: "Tiểu Liên P90", desc: "Băng 50 viên, tốc độ bắn cao, rất êm tay.",
    type: "firearm", sprite: "a_p90", proj: "bullet", rarity: "rare", cost: 0, shells: true,
    damage: 0.7, fireRate: 60 / 900, mag: 50, reload: 1.7, auto: true, noise: 280,
    bulletSpeed: 500, range: 270, spread: 0.06, bulletRadius: 2, knockback: 50, kick: 1, shake: [0.03, 0.6], color: "#ffe26b", sound: "pistol", muzzleFx: "small",
  },
  gTommy: {
    id: "gTommy", name: "Tommy Gun", desc: "Hộp đạn trống 50 viên, đạn tản rộng, rền vang như phim xã hội đen.",
    type: "firearm", sprite: "a_tommy", proj: "bullet", rarity: "rare", cost: 0, shells: true,
    damage: 0.9, fireRate: 60 / 640, mag: 50, reload: 2.0, auto: true, noise: 340,
    bulletSpeed: 470, range: 250, spread: 0.1, bulletRadius: 2, knockback: 70, kick: 2, shake: [0.05, 1], color: "#ffd34a", sound: "pistol", muzzleFx: "small",
  },
  gRpk: {
    id: "gRpk", name: "Súng Máy RPK", desc: "Súng máy hạng nhẹ băng 45 viên, mỗi viên đau hơn tiểu liên.",
    type: "firearm", sprite: "a_rpk", proj: "bullet", rarity: "rare", cost: 0, shells: true,
    damage: 1.5, fireRate: 60 / 500, mag: 45, reload: 2.0, auto: true, noise: 400,
    bulletSpeed: 540, range: 340, spread: 0.05, bulletRadius: 2, knockback: 100, kick: 3, shake: [0.05, 1.2], color: "#ffd34a", sound: "rifle", muzzleFx: "rifle",
  },
  gShockRifle: {
    id: "gShockRifle", name: "Súng Xung Kích", desc: "Bắn xung năng lượng laser đều đặn, êm hơn súng đạn.",
    type: "firearm", sprite: "a_scifi1", proj: "laser", rarity: "rare", cost: 0,
    damage: 1.0, fireRate: 60 / 480, mag: 24, reload: 1.2, auto: true, noise: 170,
    bulletSpeed: 600, range: 320, spread: 0.02, bulletRadius: 3, knockback: 40, kick: 1, shake: [0, 0], color: "#7affd8", sound: "energyGun", muzzleFx: "energy",
  },
  // ---------------- SỬ THI ----------------
  gM4: {
    id: "gM4", name: "Trường M4A1", desc: "Carbine liên thanh gọn nhẹ, đều tay, băng 30 viên.",
    type: "firearm", sprite: "carbine", proj: "bullet", rarity: "epic", cost: 0, shells: true,
    damage: 1.3, fireRate: 60 / 620, mag: 30, reload: 1.35, auto: true, noise: 380,
    bulletSpeed: 540, range: 360, spread: 0.028, bulletRadius: 2, knockback: 90, kick: 3, shake: [0.05, 1.2], color: "#ffe26b", sound: "rifle", muzzleFx: "rifle",
  },
  gAk47: {
    id: "gAk47", name: "Trường AK-47", desc: "Báng gỗ, băng cong. Mỗi viên đau, giật mạnh, tiếng nổ vang xa.",
    type: "firearm", sprite: "rifle", proj: "bullet", rarity: "epic", cost: 0, shells: true,
    damage: 1.8, fireRate: 0.12, mag: 30, reload: 1.45, auto: true, noise: 400,
    bulletSpeed: 550, range: 380, spread: 0.04, bulletRadius: 2, knockback: 120, kick: 4, shake: [0.06, 1.6], color: "#ffd34a", sound: "rifle", muzzleFx: "rifle",
  },
  gDeagle: {
    id: "gDeagle", name: "Desert Eagle", desc: "Súng lục bạc cỡ nòng khủng, báng cam: 7 viên, mỗi phát xuyên 1 quái.",
    type: "firearm", sprite: "deagle", proj: "bullet", rarity: "epic", cost: 0, shells: true,
    damage: 4.2, fireRate: 60 / 150, mag: 7, reload: 1.5, auto: false, noise: 320, pierce: 1,
    bulletSpeed: 580, range: 360, spread: 0.012, bulletRadius: 2, knockback: 240, kick: 7, shake: [0.09, 2.2], color: "#ffd34a", sound: "pistol", muzzleFx: "small",
  },
  gAutoShotgun: {
    id: "gAutoShotgun", name: "Hoa Cải Tự Động", desc: "Hoa cải xả liên tục, 5 viên mỗi phát, băng 10 viên.",
    type: "firearm", sprite: "autoshotgun", proj: "pellet", rarity: "epic", cost: 0, shells: true, shellBig: true,
    damage: 1.2, fireRate: 0.2, mag: 10, reload: 2.0, auto: true, noise: 380, pellets: 5,
    bulletSpeed: 440, range: 160, spread: 0.2, bulletRadius: 2, knockback: 220, kick: 6, shake: [0.1, 2.5], color: "#ffb347", sound: "shotgun", muzzleFx: "heavy",
  },
  gAwp: {
    id: "gAwp", name: "Bắn Tỉa AWP", desc: "Một viên một bia: tia tức thì xuyên 3 quái, +25% chí mạng. Băng 5 viên.",
    type: "firearm", sprite: "sniper", proj: "bullet", rarity: "epic", cost: 0, shells: true, shellBig: true, beam: true,
    damage: 7, fireRate: 60 / 50, mag: 5, reload: 1.8, auto: false, noise: 560, pierce: 2, range: 600, critBonus: 0.25,
    spread: 0.002, knockback: 220, kick: 9, shake: [0.14, 3.5], color: "#fff3a6", sound: "sniper", muzzleFx: "rifle",
  },
  gLaserRifle: {
    id: "gLaserRifle", name: "Súng Laser Rifle", desc: "Tia năng lượng cyan rất thẳng, bắn nhanh, xuyên 1 quái. Êm hơn súng đạn.",
    type: "firearm", sprite: "laser", proj: "laser", rarity: "epic", cost: 0,
    damage: 0.9, fireRate: 60 / 900, mag: 40, reload: 1.2, auto: true, noise: 160, pierce: 1,
    bulletSpeed: 640, range: 360, spread: 0.01, bulletRadius: 3, knockback: 40, kick: 1, shake: [0, 0], color: "#5af0ff", sound: "energyGun", muzzleFx: "energy",
  },
  gHatchet: {
    id: "gHatchet", name: "Rìu Hatchet", desc: "Bổ một nhát sát thương lớn, hất văng mạnh",
    type: "blade", sprite: "a_hatchet", look: "hatchet", rarity: "epic", cost: 0, noise: 0,
    damage: 4.2, fireRate: 0.5, range: 40, arc: 1.2, knockback: 320, color: "#c8cde0", sound: "punch",
  },
  gFamas: {
    id: "gFamas", name: "FAMAS", desc: "Bullpup bắn cực nhanh 1000 phát/phút, băng 25 viên.",
    type: "firearm", sprite: "a_famas", proj: "bullet", rarity: "epic", cost: 0, shells: true,
    damage: 1.0, fireRate: 60 / 1000, mag: 25, reload: 1.4, auto: true, noise: 380,
    bulletSpeed: 540, range: 320, spread: 0.035, bulletRadius: 2, knockback: 70, kick: 3, shake: [0.04, 1], color: "#ffe26b", sound: "rifle", muzzleFx: "rifle",
  },
  gVector: {
    id: "gVector", name: "KRISS Vector", desc: "Tiểu liên bắn nhanh nhất kho súng, băng 25 viên.",
    type: "firearm", sprite: "a_vector", proj: "bullet", rarity: "epic", cost: 0, shells: true,
    damage: 0.8, fireRate: 60 / 1100, mag: 25, reload: 1.3, auto: true, noise: 300,
    bulletSpeed: 500, range: 240, spread: 0.07, bulletRadius: 2, knockback: 50, kick: 1, shake: [0.03, 0.6], color: "#ffe26b", sound: "pistol", muzzleFx: "small",
  },
  gScar: {
    id: "gScar", name: "SCAR-H", desc: "Súng trường 7.62mm băng 20 viên, mỗi phát đau và giật mạnh.",
    type: "firearm", sprite: "a_scar", proj: "bullet", rarity: "epic", cost: 0, shells: true,
    damage: 2.6, fireRate: 60 / 420, mag: 20, reload: 1.6, auto: true, noise: 430,
    bulletSpeed: 570, range: 400, spread: 0.035, bulletRadius: 2, knockback: 150, kick: 5, shake: [0.07, 1.8], color: "#ffd34a", sound: "rifle", muzzleFx: "rifle",
  },
  gDragunov: {
    id: "gDragunov", name: "Bắn Tỉa Dragunov SVD", desc: "Bắn tỉa bán tự động băng 10 viên, tia tức thì xuyên 1 quái.",
    type: "firearm", sprite: "a_dragunov", proj: "bullet", rarity: "epic", cost: 0, shells: true, shellBig: true, beam: true,
    damage: 4.5, fireRate: 60 / 150, mag: 10, reload: 2.0, auto: false, noise: 520, pierce: 1, critBonus: 0.15,
    range: 520, spread: 0.004, knockback: 180, kick: 6, shake: [0.1, 2.4], color: "#fff3a6", sound: "sniper", muzzleFx: "rifle",
  },
  gM24: {
    id: "gM24", name: "Bắn Tỉa M24", desc: "Khóa nòng 5 viên, tia tức thì xuyên 2 quái, chí mạng +20%.",
    type: "firearm", sprite: "a_m24", proj: "bullet", rarity: "epic", cost: 0, shells: true, shellBig: true, beam: true,
    damage: 6.5, fireRate: 60 / 55, mag: 5, reload: 2.1, auto: false, noise: 540, pierce: 2, critBonus: 0.2,
    range: 600, spread: 0.002, knockback: 210, kick: 8, shake: [0.13, 3.2], color: "#fff3a6", sound: "sniper", muzzleFx: "rifle",
  },
  gM249: {
    id: "gM249", name: "Súng Máy M249 SAW", desc: "Băng 100 viên, xả liên tục không ngại nóng nòng.",
    type: "firearm", sprite: "a_m249", proj: "bullet", rarity: "epic", cost: 0, shells: true,
    damage: 0.9, fireRate: 60 / 780, mag: 100, reload: 2.8, auto: true, noise: 420,
    bulletSpeed: 530, range: 320, spread: 0.07, bulletRadius: 2, knockback: 60, kick: 2, shake: [0.04, 0.9], color: "#ffd34a", sound: "rifle", muzzleFx: "rifle",
  },
  gStoner: {
    id: "gStoner", name: "Súng Máy Stoner 63", desc: "Súng máy băng 75 viên, nhịp đều, tản vừa phải.",
    type: "firearm", sprite: "a_stoner", proj: "bullet", rarity: "epic", cost: 0, shells: true,
    damage: 1.0, fireRate: 60 / 700, mag: 75, reload: 2.4, auto: true, noise: 410,
    bulletSpeed: 540, range: 340, spread: 0.06, bulletRadius: 2, knockback: 70, kick: 2, shake: [0.04, 1], color: "#ffd34a", sound: "rifle", muzzleFx: "rifle",
  },
  gEmp: {
    id: "gEmp", name: "EMP Blaster", desc: "Tia điện xanh xuyên 3 quái, êm và nhanh nạp.",
    type: "firearm", sprite: "a_emp", proj: "laser", rarity: "epic", cost: 0,
    damage: 1.8, fireRate: 60 / 300, mag: 20, reload: 1.4, auto: true, noise: 180, pierce: 3,
    bulletSpeed: 620, range: 380, spread: 0.015, bulletRadius: 3, knockback: 70, kick: 2, shake: [0.03, 0.6], color: "#4aa8ff", sound: "energyGun", muzzleFx: "energy",
  },
  gFutureRifle: {
    id: "gFutureRifle", name: "Súng Trường Tương Lai", desc: "Súng trường năng lượng liên thanh, tia laser xuyên 1 quái.",
    type: "firearm", sprite: "a_futurerifle", proj: "laser", rarity: "epic", cost: 0,
    damage: 1.2, fireRate: 60 / 700, mag: 36, reload: 1.3, auto: true, noise: 170, pierce: 1,
    bulletSpeed: 640, range: 360, spread: 0.015, bulletRadius: 3, knockback: 50, kick: 1, shake: [0, 0], color: "#7affd8", sound: "energyGun", muzzleFx: "energy",
  },
  // ---------------- SÚNG: HUYỀN THOẠI ----------------
  gBarrett: {
    id: "gBarrett", name: "Barrett .50cal", desc: "Cỡ nòng 12.7mm sơn xanh rêu: tia tức thì xuyên 5 quái, tiếng nổ vang cả vùng.",
    type: "firearm", sprite: "barrett", proj: "bullet", rarity: "legend", cost: 0, shells: true, shellBig: true, beam: true,
    damage: 9, fireRate: 60 / 70, mag: 10, reload: 2.4, auto: false, noise: 600, pierce: 4, range: 640, critBonus: 0.3,
    spread: 0.002, knockback: 300, kick: 11, shake: [0.18, 4.5], color: "#ffe9a6", sound: "sniper", muzzleFx: "heavy",
  },
  gM79: {
    id: "gM79", name: "Phóng Lựu M79", desc: "Lựu đạn bay vòng cung tới chỗ trỏ chuột rồi nổ bán kính 60px.",
    type: "firearm", sprite: "grenade", proj: "grenade", rarity: "legend", cost: 0, lob: true,
    damage: 5, fireRate: 60 / 70, mag: 4, reload: 1.7, auto: false, noise: 480, aoe: 60, explodeSource: "rocket",
    bulletSpeed: 300, range: 240, spread: 0.02, bulletRadius: 3, knockback: 280, kick: 7, shake: [0.14, 3], color: "#8ad23a", sound: "heavy", muzzleFx: "heavy",
  },
  gBazooka: {
    id: "gBazooka", name: "Bazooka", desc: "Đạn tên lửa tăng tốc, nổ lớn bán kính 70px. Chỉ 1 quả mỗi lần nạp.",
    type: "firearm", sprite: "rocket", proj: "rocket", rarity: "legend", cost: 0, trail: "smoke",
    damage: 7, fireRate: 60 / 45, mag: 1, reload: 2.1, auto: false, noise: 480, aoe: 70, explodeSource: "rocket",
    bulletSpeed: 220, maxSpeed: 430, accel: 380, life: 1.7, spread: 0.02, bulletRadius: 4, knockback: 320, kick: 11, shake: [0.22, 4.5], color: "#ff7a3a", sound: "rocket", muzzleFx: "heavy",
  },
  gMinigun: {
    id: "gMinigun", name: "Súng Máy Quay M134", desc: "Giữ cò để nòng quay nhanh dần rồi xả như mưa. Băng 120 viên.",
    type: "firearm", sprite: "minigun", proj: "bullet", rarity: "legend", cost: 0, shells: true,
    damage: 0.6, fireRate: 0.05, mag: 120, reload: 2.6, auto: true, spinUp: 0.5, noise: 420,
    bulletSpeed: 520, range: 300, spread: 0.1, bulletRadius: 2, knockback: 50, kick: 2, shake: [0.04, 0.9], color: "#ffd34a", sound: "rifle", muzzleFx: "rifle",
  },
  gIntervention: {
    id: "gIntervention", name: "Bắn Tỉa Intervention", desc: "Bắn tỉa huyền thoại: tia tức thì xuyên 4 quái, chí mạng +45%.",
    type: "firearm", sprite: "a_intervention", proj: "bullet", rarity: "legend", cost: 0, shells: true, shellBig: true, beam: true,
    damage: 10, fireRate: 60 / 50, mag: 7, reload: 2.6, auto: false, noise: 600, pierce: 3, critBonus: 0.45,
    range: 700, spread: 0.001, knockback: 320, kick: 11, shake: [0.18, 4.5], color: "#ffe9a6", sound: "sniper", muzzleFx: "heavy",
  },
  gM60: {
    id: "gM60", name: "Súng Máy M60", desc: "Súng máy băng 100 viên, nhịp chậm nhưng mỗi viên rất đau.",
    type: "firearm", sprite: "a_m60", proj: "bullet", rarity: "legend", cost: 0, shells: true,
    damage: 1.5, fireRate: 60 / 500, mag: 100, reload: 3.0, auto: true, noise: 450,
    bulletSpeed: 540, range: 340, spread: 0.08, bulletRadius: 2, knockback: 90, kick: 3, shake: [0.06, 1.5], color: "#ffd34a", sound: "rifle", muzzleFx: "heavy",
  },
  gMg42: {
    id: "gMg42", name: "MG42 Cưa Xương", desc: "1200 phát/phút, băng 50 viên: cưa đôi mọi thứ trước mặt.",
    type: "firearm", sprite: "a_mg42", proj: "bullet", rarity: "legend", cost: 0, shells: true,
    damage: 0.65, fireRate: 60 / 1200, mag: 50, reload: 2.2, auto: true, noise: 450,
    bulletSpeed: 540, range: 300, spread: 0.1, bulletRadius: 2, knockback: 60, kick: 2, shake: [0.05, 1], color: "#ffd34a", sound: "rifle", muzzleFx: "heavy",
  },
  gRayGun: {
    id: "gRayGun", name: "Ray Gun", desc: "Đạn plasma xanh lá nổ lan 45px, 12 viên mỗi băng.",
    type: "firearm", sprite: "a_raygun", proj: "plasma", rarity: "legend", cost: 0, aoe: 45, explodeSource: "cannon",
    damage: 3.0, fireRate: 60 / 180, mag: 12, reload: 1.6, auto: false, noise: 220,
    bulletSpeed: 400, range: 300, spread: 0.02, bulletRadius: 3, knockback: 200, kick: 5, shake: [0.07, 1.6], color: "#7aff5a", sound: "energyGun", muzzleFx: "energy",
  },
  gIonCannon: {
    id: "gIonCannon", name: "Ion Cannon", desc: "Pháo ion: tia laser dày xuyên tới 8 quái, mỗi băng 10 phát.",
    type: "firearm", sprite: "a_ioncannon", proj: "laser", rarity: "legend", cost: 0, pierce: 7,
    damage: 3.0, fireRate: 60 / 120, mag: 10, reload: 2.0, auto: false, noise: 240,
    bulletSpeed: 760, range: 520, spread: 0.005, bulletRadius: 4, knockback: 160, kick: 5, shake: [0.08, 1.8], color: "#5af0ff", sound: "laser", muzzleFx: "energy",
  },
  gQuantumRifle: {
    id: "gQuantumRifle", name: "Súng Trường Lượng Tử", desc: "Liên thanh plasma, mỗi viên nổ lan nhỏ 28px.",
    type: "firearm", sprite: "a_scifi2", proj: "plasma", rarity: "legend", cost: 0, aoe: 28, explodeSource: "cannon",
    damage: 1.6, fireRate: 60 / 360, mag: 30, reload: 1.6, auto: true, noise: 200,
    bulletSpeed: 420, range: 320, spread: 0.03, bulletRadius: 3, knockback: 100, kick: 2, shake: [0.04, 1], color: "#6affd0", sound: "energyGun", muzzleFx: "energy",
  },
  gProtoX1: {
    id: "gProtoX1", name: "Nguyên Mẫu X-1", desc: "Nguyên mẫu plasma tự động, nổ lan 36px, hơi lệch tâm.",
    type: "firearm", sprite: "a_proto1", proj: "plasma", rarity: "legend", cost: 0, aoe: 36, explodeSource: "cannon",
    damage: 2.4, fireRate: 60 / 240, mag: 16, reload: 1.5, auto: true, noise: 220,
    bulletSpeed: 400, range: 300, spread: 0.05, bulletRadius: 3, knockback: 140, kick: 3, shake: [0.05, 1.2], color: "#ff9a3a", sound: "energyGun", muzzleFx: "energy",
  },
  gProtoX2: {
    id: "gProtoX2", name: "Nguyên Mẫu X-2", desc: "Nguyên mẫu laser: tia tức thì xuyên 3 quái, chí mạng +20%.",
    type: "firearm", sprite: "a_proto2", proj: "laser", rarity: "legend", cost: 0, beam: true,
    damage: 5.0, fireRate: 60 / 100, mag: 8, reload: 2.0, auto: false, noise: 220, pierce: 3, critBonus: 0.2,
    range: 560, spread: 0.003, knockback: 160, kick: 4, shake: [0.08, 1.6], color: "#ff5af0", sound: "laser", muzzleFx: "energy",
  },
};

/** Vũ khí theo độ hiếm (rương bốc từ các danh sách này) */
export const WEAPONS_BY_RARITY = { common: [], rare: [], epic: [], legend: [], mythic: [] };
for (const w of Object.values(WEAPONS)) WEAPONS_BY_RARITY[w.rarity].push(w.id);
export const COMMON_WEAPONS = WEAPONS_BY_RARITY.common;
export const RARE_WEAPONS = WEAPONS_BY_RARITY.rare;
export const EPIC_WEAPONS = WEAPONS_BY_RARITY.epic;
export const LEGEND_WEAPONS = WEAPONS_BY_RARITY.legend;
export const MYTHIC_WEAPONS = WEAPONS_BY_RARITY.mythic;

/** Cấp sao vũ khí: sát thương x, thời gian giữa 2 phát x */
export const WEAPON_LEVELS = [null, { dmg: 1, rate: 1 }, { dmg: 1.25, rate: 0.95 }, { dmg: 1.5, rate: 0.9 }];
export const WEAPON_MAX_LEVEL = 3;

/** Loại vũ khí cận chiến (combo 3 đòn + phản đạn) */
export const MELEE_TYPES = new Set(["melee", "sword", "hammer", "scythe", "gauntlet", "dragon", "blade"]);
export const isMelee = (w) => MELEE_TYPES.has(w.type);
/** Vũ khí có vỏ đạn văng ra khi bắn */
export const ejectsShells = (w) => !!w.shells || w.type === "gun";

/**
 * Tạo 1 "bản thể" vũ khí từ định nghĩa (để nâng cấp ★ riêng từng khẩu mà không sửa định nghĩa gốc).
 * Bản thể giữ mọi trường của định nghĩa + def (gốc) + lvl (cấp sao) + label (tên hiển thị).
 * Vũ khí khởi đầu của nhân vật không có `cost` -> tốn 0 năng lượng.
 */
export function makeWeapon(def, lvl = 1) {
  const base = def.def ?? def;
  const L = WEAPON_LEVELS[Math.min(WEAPON_MAX_LEVEL, Math.max(1, lvl))];
  return {
    ...base, def: base, lvl,
    cost: base.cost ?? 0,
    damage: base.damage * L.dmg,
    fireRate: base.fireRate * L.rate,
    label: lvl > 1 ? `${base.name} ${"★".repeat(lvl)}` : base.name,
    ...(base.mag ? { ammo: base.mag, reloadT: 0 } : null),   // súng dùng băng đạn: đầy đạn, không đang nạp
  };
}

/**
 * CÔNG THỨC GHÉP 2 vũ khí KHÁC NHAU (cả 2 phải từ ★2 trở lên) -> vũ khí Thần Thoại.
 * (2 vũ khí GIỐNG NHAU cùng ★ luôn ghép được thành ★+1; 2 khẩu ★3 có `evolve` -> tiến hóa)
 */
export const RECIPES = [
  { a: "sword", b: "flamethrower", out: "dragonBlade" },
  { a: "energyCannon", b: "laser", out: "voidCannon" },
  { a: "longbow", b: "lightning", out: "stormBow" },
];

/** Kết quả ghép 2 bản thể vũ khí -> { def, lvl, kind: "star" | "evolve" | "recipe" } hoặc null */
export function mergeResult(a, b) {
  if (!a || !b) return null;
  const da = a.def ?? a, db = b.def ?? b;
  if (!da.id || !db.id) return null;                         // vũ khí khởi đầu của nhân vật không ghép được
  if (da === db) {
    if (a.lvl !== b.lvl) return null;
    if (a.lvl < WEAPON_MAX_LEVEL) return { def: da, lvl: a.lvl + 1, kind: "star" };
    if (da.evolve && WEAPONS[da.evolve]) return { def: WEAPONS[da.evolve], lvl: 1, kind: "evolve" };
    return null;
  }
  if (a.lvl < 2 || b.lvl < 2) return null;
  const r = RECIPES.find((x) => (x.a === da.id && x.b === db.id) || (x.a === db.id && x.b === da.id));
  return r ? { def: WEAPONS[r.out], lvl: 1, kind: "recipe" } : null;
}

// =====================================================================================
//  BĂNG ĐẠN + NẠP ĐẠN + TIẾNG ỒN (súng Pixel Armory)
//  Bản thể súng có `mag` thì có `ammo` (đạn còn) và `reloadT` (giây nạp còn lại; 0 = không nạp).
//  main.js: mỗi frame gọi tickReload(); trước mỗi phát bắn gọi tryConsumeAmmo() (false = không bắn).
// =====================================================================================
/** Bắt đầu nạp đạn (chỉ khi còn thiếu đạn và chưa đang nạp). Trả về true nếu vừa bắt đầu. */
export function startReload(w, game) {
  if (!w || !w.mag || w.reloadT > 0 || w.ammo >= w.mag) return false;
  w.reloadT = w.reload ?? 1.2;
  void game;
  return true;
}
/** Đếm lùi thời gian nạp; xong thì đầy băng + âm "reload" */
export function tickReload(w, dt, game) {
  if (!w || !(w.reloadT > 0)) return;
  w.reloadT -= dt;
  if (w.reloadT <= 0) { w.reloadT = 0; w.ammo = w.mag; game?.sound?.play("reload", 0.5); }
}
/** Trừ 1 viên cho 1 phát bắn. false = KHÔNG được bắn (đang nạp / hết đạn -> tự nạp + tiếng "tạch"). Vũ khí không có băng luôn true. */
export function tryConsumeAmmo(w, game) {
  if (!w?.mag) return true;
  if (w.reloadT > 0) return false;
  if (w.ammo <= 0) { startReload(w, game); game?.sound?.play("gunEmpty", 0.5); return false; }
  w.ammo--;
  if (w.ammo <= 0) startReload(w, game);
  return true;
}
/** Chữ hiển thị đạn: "12/30" · đang nạp "NẠP 0.6s" · không có băng -> null */
export function ammoLabel(w) {
  if (!w?.mag) return null;
  if (w.reloadT > 0) return `NẠP ${w.reloadT.toFixed(1)}s`;
  return `${w.ammo}/${w.mag}`;
}
/** Bán kính tiếng ồn (px) khi bắn: zombie nghe thấy trong vòng này. Cận chiến = 0 (im lặng). */
export function weaponNoise(w) {
  if (!w) return 0;
  if (w.noise !== undefined) return w.noise;
  if (isMelee(w)) return 0;
  return { gun: 300, minigun: 340, shotgun: 380, sniper: 480, rocket: 480, grenade: 440, laser: 200, cannon: 300, flamethrower: 200, meteor: 220,
    lightning: 160, magic: 140, frostHand: 100, bow: 100, longbow: 100, frostbow: 100, boomerang: 60, disc: 80, shuriken: 40, poison: 120, soul: 140 }[w.type] ?? 140;
}

/** Độ dài nòng (tính từ tâm thân) theo loại vũ khí */
export function muzzleLength(w) {
  if (w.sprite) { const L = gunMuzzleLength(w); if (L !== null) return L; }
  return { frostHand: 5, magic: 22, shotgun: 19, laser: 19, grenade: 18, sword: 20, melee: 14, minigun: 20, flamethrower: 18, frostbow: 12, boomerang: 10, lightning: 18,
    poison: 17, disc: 14, scythe: 22, sniper: 24, rocket: 20, meteor: 22, hammer: 18, bow: 12, soul: 22, shuriken: 8,
    gauntlet: 12, longbow: 12, cannon: 21, dragon: 24, blade: 16, firearm: 18 }[w.type] ?? 16;
}

// =====================================================================================
//  HÌNH VẼ VŨ KHÍ (pixel) — gốc = tay cầm, nòng hướng sang PHẢI
// =====================================================================================
export function drawWeaponFallback(c, weapon) {
  const col = weapon.color;
  if (weapon.sprite && drawGunSprite(c, weapon)) return;   // súng Pixel Armory: ảnh thật (src/guns.js)
  switch (weapon.type) {
    case "blade": drawBlade(c, weapon); break;
    case "firearm": drawFirearmFallback(c, weapon); break;
    case "frostHand":       // tay không: icon gai băng (trên tay nhân vật chỉ là đốm băng sáng, xem main.js)
      c.fillStyle = "#2c58aa"; c.fillRect(0, -1, 12, 3);
      c.fillStyle = "#a6ecff"; c.fillRect(1, -1, 10, 2); c.fillRect(11, 0, 2, 1);
      c.fillStyle = "#ffffff"; c.fillRect(2, -1, 7, 1); c.fillRect(13, 0, 1, 1);
      c.fillStyle = "#62c8f4"; c.fillRect(3, -3, 1, 2); c.fillRect(6, 2, 1, 2);
      break;
    case "melee":           // găng tay sắt
      c.fillStyle = "#3a2a20"; c.fillRect(0, -3, 4, 6);
      c.fillStyle = "#8a8fa8"; c.fillRect(3, -4, 7, 8);
      c.fillStyle = "#c8cde0"; c.fillRect(4, -4, 5, 2);
      c.fillStyle = "#4a4e66"; c.fillRect(9, -3, 1, 6); c.fillRect(5, 0, 4, 1);
      c.fillStyle = col; c.fillRect(1, -3, 2, 6);
      break;
    case "magic":           // trượng năng lượng
      c.fillStyle = "#4a2f1c"; c.fillRect(-2, -1, 16, 2);
      c.fillStyle = "#7a5230"; c.fillRect(-2, -1, 16, 1);
      c.fillStyle = "#c8a24a"; c.fillRect(13, -3, 2, 6);
      c.fillStyle = col; c.fillRect(15, -2, 4, 4);
      c.fillStyle = "#ffffff"; c.fillRect(16, -1, 2, 2);
      c.fillStyle = withAlpha(col, 0.35); c.fillRect(14, -4, 6, 8);
      break;
    case "shotgun":         // shotgun nòng đôi, báng gỗ
      c.fillStyle = "#5a3418"; c.fillRect(-3, -1, 7, 4);
      c.fillStyle = "#8a5428"; c.fillRect(-3, -1, 7, 1);
      c.fillStyle = "#2b2b3a"; c.fillRect(3, -3, 15, 4);
      c.fillStyle = "#6c6c88"; c.fillRect(3, -3, 15, 1);
      c.fillStyle = "#1a1a24"; c.fillRect(17, -3, 1, 4); c.fillRect(5, 1, 4, 2);
      c.fillStyle = col; c.fillRect(9, 1, 5, 1);
      break;
    case "laser":           // súng laser: thân trắng, cuộn năng lượng hồng
      c.fillStyle = "#2b2b3a"; c.fillRect(0, -1, 4, 5);
      c.fillStyle = "#d8dcf0"; c.fillRect(2, -3, 14, 4);
      c.fillStyle = "#8a8fa8"; c.fillRect(2, 0, 14, 1);
      c.fillStyle = col; c.fillRect(5, -2, 2, 2); c.fillRect(9, -2, 2, 2); c.fillRect(16, -2, 2, 2);
      c.fillStyle = "#ffffff"; c.fillRect(17, -2, 1, 1);
      c.fillStyle = withAlpha(col, 0.35); c.fillRect(15, -4, 4, 6);
      break;
    case "grenade":         // ống phóng lựu ngắn, miệng rộng
      c.fillStyle = "#2a3a2a"; c.fillRect(0, -1, 5, 5);
      c.fillStyle = "#3e5a40"; c.fillRect(3, -4, 12, 7);
      c.fillStyle = "#6a8a6a"; c.fillRect(3, -4, 12, 1);
      c.fillStyle = "#1a241a"; c.fillRect(14, -4, 2, 7);
      c.fillStyle = col; c.fillRect(6, -2, 6, 1); c.fillRect(15, -2, 1, 3);
      break;
    case "sword":           // kiếm năng lượng: chuôi vàng, lưỡi phát sáng
      c.fillStyle = "#5a3418"; c.fillRect(-2, -1, 4, 2);
      c.fillStyle = "#e8b030"; c.fillRect(2, -4, 2, 8);
      c.fillStyle = withAlpha(col, 0.35); c.fillRect(4, -3, 19, 6);
      c.fillStyle = col; c.fillRect(4, -2, 18, 4);
      c.fillStyle = "#ffffff"; c.fillRect(4, -1, 17, 1); c.fillRect(22, -1, 1, 2);
      break;
    case "minigun":         // gatling 3 nòng
      c.fillStyle = "#2a2a36"; c.fillRect(-2, -1, 6, 6);
      c.fillStyle = "#4a4a5e"; c.fillRect(3, -4, 6, 8);
      c.fillStyle = "#8a8fa8"; c.fillRect(9, -4, 11, 2); c.fillRect(9, -1, 11, 2); c.fillRect(9, 2, 11, 2);
      c.fillStyle = "#c8cde0"; c.fillRect(9, -4, 11, 1);
      c.fillStyle = "#1a1a24"; c.fillRect(13, -4, 1, 8); c.fillRect(19, -4, 1, 8);
      c.fillStyle = col; c.fillRect(4, -3, 2, 2);
      break;
    case "flamethrower":    // bình nhiên liệu + vòi phun
      c.fillStyle = "#7c1a1e"; c.fillRect(-2, -3, 6, 7);
      c.fillStyle = "#b02a26"; c.fillRect(-2, -3, 6, 2);
      c.fillStyle = "#3a3a4a"; c.fillRect(4, -2, 11, 3);
      c.fillStyle = "#6c6c88"; c.fillRect(4, -2, 11, 1);
      c.fillStyle = "#2a2a36"; c.fillRect(15, -3, 3, 5);
      c.fillStyle = col; c.fillRect(17, -2, 1, 3);
      c.fillStyle = "#ffe26b"; c.fillRect(17, -1, 1, 1);
      break;
    case "frostbow":        // cung băng cong
      c.fillStyle = "#3a8bd8"; c.fillRect(6, -8, 2, 3); c.fillRect(7, -5, 2, 10); c.fillRect(6, 5, 2, 3);
      c.fillStyle = "#a6ecff"; c.fillRect(7, -8, 1, 16);
      c.fillStyle = "#e8f6ff"; c.fillRect(5, -7, 1, 14);
      c.fillStyle = "#5a3418"; c.fillRect(0, -1, 6, 2);
      c.fillStyle = col; c.fillRect(9, -1, 1, 2);
      break;
    case "boomerang":       // boomerang chữ V
      c.fillStyle = "#5a3418"; c.fillRect(0, 1, 6, 3); c.fillRect(4, -4, 3, 6); c.fillRect(6, -7, 3, 4);
      c.fillStyle = col; c.fillRect(0, 1, 6, 1); c.fillRect(4, -4, 1, 6); c.fillRect(6, -7, 1, 4);
      c.fillStyle = "#ffffff"; c.fillRect(7, -7, 1, 1);
      break;
    case "lightning":       // súng sét: cuộn dây đồng + đầu tesla
      c.fillStyle = "#2b2b3a"; c.fillRect(0, -1, 5, 5);
      c.fillStyle = "#3a3a4a"; c.fillRect(3, -3, 10, 5);
      c.fillStyle = "#c48412"; for (let i = 4; i < 13; i += 2) c.fillRect(i, -3, 1, 5);
      c.fillStyle = "#d8dcf0"; c.fillRect(13, -4, 4, 7);
      c.fillStyle = col; c.fillRect(17, -2, 1, 3); c.fillRect(14, -3, 2, 1);
      c.fillStyle = "#ffffff"; c.fillRect(15, -1, 1, 1);
      break;
    case "poison":          // bình độc xanh + vòi phun
      c.fillStyle = "#2a3a20"; c.fillRect(-2, -1, 5, 5);
      c.fillStyle = "#3a4a30"; c.fillRect(2, -3, 10, 5);
      c.fillStyle = "#6a8a4a"; c.fillRect(2, -3, 10, 1);
      c.fillStyle = "#1a2416"; c.fillRect(4, -7, 5, 4);
      c.fillStyle = col; c.fillRect(5, -6, 3, 3); c.fillRect(12, -2, 4, 3);
      c.fillStyle = "#ffffff"; c.fillRect(5, -6, 1, 1);
      break;
    case "disc":            // bệ phóng đĩa: tay cầm + lưỡi cưa xanh
      c.fillStyle = "#2b2b3a"; c.fillRect(0, -1, 6, 4);
      c.fillStyle = "#4a4e66"; c.fillRect(4, -3, 5, 6);
      c.fillStyle = "#1a2a5a"; c.fillRect(9, -5, 7, 10);
      c.fillStyle = col; c.fillRect(10, -4, 5, 8); c.fillRect(8, -1, 9, 2);
      c.fillStyle = "#ffffff"; c.fillRect(12, -1, 1, 1);
      break;
    case "scythe":          // lưỡi hái: cán dài + lưỡi cong
      c.fillStyle = "#3a2416"; c.fillRect(-4, -1, 22, 2);
      c.fillStyle = "#5a3a20"; c.fillRect(-4, -1, 22, 1);
      c.fillStyle = "#1a1424"; c.fillRect(16, -8, 3, 10);
      c.fillStyle = "#c8d8d0"; c.fillRect(17, -9, 2, 4); c.fillRect(13, -10, 5, 2); c.fillRect(9, -9, 5, 2); c.fillRect(7, -8, 3, 1);
      c.fillStyle = col; c.fillRect(10, -8, 7, 1);
      break;
    case "sniper":          // súng bắn tỉa: nòng dài + ống ngắm
      c.fillStyle = "#4a3018"; c.fillRect(-4, -1, 7, 4);
      c.fillStyle = "#2b2b3a"; c.fillRect(2, -2, 22, 3);
      c.fillStyle = "#6c6c88"; c.fillRect(2, -2, 22, 1);
      c.fillStyle = "#1a1a24"; c.fillRect(6, -5, 8, 3); c.fillRect(4, 1, 3, 3);
      c.fillStyle = col; c.fillRect(13, -5, 1, 2);
      break;
    case "rocket":          // ống phóng tên lửa vác vai
      c.fillStyle = "#2a3a2a"; c.fillRect(2, 1, 4, 4);
      c.fillStyle = "#4a5a3a"; c.fillRect(-4, -4, 24, 6);
      c.fillStyle = "#6a7a5a"; c.fillRect(-4, -4, 24, 1);
      c.fillStyle = "#1a2216"; c.fillRect(19, -4, 2, 6); c.fillRect(-5, -4, 2, 6);
      c.fillStyle = col; c.fillRect(17, -3, 2, 4);
      c.fillStyle = "#ffe26b"; c.fillRect(6, -3, 4, 1);
      break;
    case "meteor":          // trượng thiên thạch: cán gỗ đen + đá lửa
      c.fillStyle = "#2a1610"; c.fillRect(-2, -1, 17, 2);
      c.fillStyle = "#5a2a18"; c.fillRect(-2, -1, 17, 1);
      c.fillStyle = "#3a2a2a"; c.fillRect(14, -4, 6, 7);
      c.fillStyle = col; c.fillRect(15, -3, 4, 5);
      c.fillStyle = "#ffe26b"; c.fillRect(16, -2, 2, 2);
      c.fillStyle = withAlpha(col, 0.4); c.fillRect(13, -6, 8, 11);
      break;
    case "hammer":          // búa thánh (vàng) / búa sấm sét (thép xanh + tia điện)
      c.fillStyle = "#5a3418"; c.fillRect(-2, -1, 15, 2);
      c.fillStyle = "#8a5428"; c.fillRect(-2, -1, 15, 1);
      c.fillStyle = "#3a2a10"; c.fillRect(12, -7, 8, 14);
      c.fillStyle = weapon.thunder ? "#4a5a78" : "#f0c040"; c.fillRect(13, -6, 6, 12);
      c.fillStyle = weapon.thunder ? "#a8c0e0" : "#fff0a0"; c.fillRect(13, -6, 6, 2); c.fillRect(15, -3, 2, 6);
      c.fillStyle = col; c.fillRect(19, -5, 1, 10);
      if (weapon.thunder) { c.fillRect(14, 1, 1, 2); c.fillRect(15, 3, 1, 1); c.fillRect(17, -4, 1, 2); c.fillStyle = "#ffffff"; c.fillRect(16, 2, 1, 1); }
      break;
    case "gauntlet":        // găng bão tố: găng vàng + khớp điện
      c.fillStyle = "#3a2a20"; c.fillRect(0, -3, 4, 6);
      c.fillStyle = "#c89a2a"; c.fillRect(3, -4, 8, 8);
      c.fillStyle = "#ffe26b"; c.fillRect(4, -4, 6, 2);
      c.fillStyle = "#6a4a10"; c.fillRect(10, -3, 1, 6); c.fillRect(5, 0, 5, 1);
      c.fillStyle = "#ffffff"; c.fillRect(11, -2, 1, 1); c.fillRect(11, 1, 1, 1);
      break;
    case "longbow":         // cung dài: thân cong lớn
      c.fillStyle = "#3a2416"; c.fillRect(6, -11, 2, 4); c.fillRect(7, -7, 2, 14); c.fillRect(6, 7, 2, 4);
      c.fillStyle = weapon.zap ? "#5a6a9a" : "#6a8a2a"; c.fillRect(8, -11, 1, 22);
      c.fillStyle = "#e8e2d0"; c.fillRect(5, -10, 1, 20);
      c.fillStyle = "#3a2416"; c.fillRect(0, -1, 6, 2);
      c.fillStyle = col; c.fillRect(9, -1, 2, 2); c.fillRect(7, -12, 1, 1); c.fillRect(7, 11, 1, 1);
      break;
    case "cannon":          // pháo năng lượng: nòng to + lõi phát sáng
      c.fillStyle = "#1a1a2a"; c.fillRect(-2, -2, 6, 6);
      c.fillStyle = "#3a3e58"; c.fillRect(2, -5, 15, 9);
      c.fillStyle = "#6a7090"; c.fillRect(2, -5, 15, 2);
      c.fillStyle = "#14141e"; c.fillRect(16, -5, 3, 9);
      c.fillStyle = col; c.fillRect(6, -2, 7, 3); c.fillRect(19, -2, 2, 3);
      c.fillStyle = "#ffffff"; c.fillRect(8, -1, 2, 1);
      c.fillStyle = withAlpha(col, 0.35); c.fillRect(17, -5, 6, 9);
      break;
    case "dragon":          // long kiếm: lưỡi đỏ lửa, chuôi rồng vàng
      c.fillStyle = "#5a1a10"; c.fillRect(-2, -1, 4, 2);
      c.fillStyle = "#ffc23d"; c.fillRect(2, -5, 2, 10); c.fillRect(1, -3, 1, 6);
      c.fillStyle = "#2a0604"; c.fillRect(4, -2, 19, 4);
      c.fillStyle = "#c8281a"; c.fillRect(4, -2, 18, 3);
      c.fillStyle = "#ff8a2a"; c.fillRect(5, -2, 17, 1); c.fillRect(22, -1, 2, 1);
      c.fillStyle = "#ffe26b"; c.fillRect(6, -1, 14, 1);
      c.fillStyle = withAlpha("#ff5a2a", 0.35); c.fillRect(4, -4, 21, 8);
      break;
    case "bow":             // cung gỗ
      c.fillStyle = "#5a3418"; c.fillRect(6, -8, 2, 3); c.fillRect(7, -5, 2, 10); c.fillRect(6, 5, 2, 3);
      c.fillStyle = "#8a5428"; c.fillRect(7, -8, 1, 16);
      c.fillStyle = "#e8e2d0"; c.fillRect(5, -7, 1, 14);
      c.fillStyle = "#3a2416"; c.fillRect(0, -1, 6, 2);
      c.fillStyle = col; c.fillRect(9, -1, 2, 2);
      break;
    case "soul":            // trượng linh hồn: cán đen + đầu lâu xanh
      c.fillStyle = "#1a1424"; c.fillRect(-2, -1, 17, 2);
      c.fillStyle = "#3a2a4a"; c.fillRect(-2, -1, 17, 1);
      c.fillStyle = "#c8e8d8"; c.fillRect(14, -4, 6, 6);
      c.fillStyle = "#14201e"; c.fillRect(15, -2, 1, 2); c.fillRect(18, -2, 1, 2);
      c.fillStyle = col; c.fillRect(15, -2, 1, 1); c.fillRect(18, -2, 1, 1);
      c.fillStyle = withAlpha(col, 0.35); c.fillRect(13, -6, 8, 10);
      break;
    case "shuriken":        // phi tiêu 4 cánh
      c.fillStyle = "#3a3a4a"; c.fillRect(2, -1, 7, 3); c.fillRect(4, -3, 3, 7);
      c.fillStyle = "#c8cde0"; c.fillRect(1, 0, 9, 1); c.fillRect(5, -4, 1, 9);
      c.fillStyle = col; c.fillRect(5, 0, 1, 1);
      break;
    default:                // súng lục
      c.fillStyle = "#2b2b3a"; c.fillRect(0, -2, 13, 4);
      c.fillStyle = "#6c6c88"; c.fillRect(0, -2, 13, 1);
      c.fillStyle = "#2b2b3a"; c.fillRect(1, 1, 3, 4);
      c.fillStyle = col; c.fillRect(11, -2, 2, 1);
  }
}

/** Vũ khí cận chiến mới (dao găm / xà beng / dao rựa / rìu / dùi cui) vẽ bằng code, gốc = tay cầm, lưỡi sang PHẢI */
function drawBlade(c, w) {
  switch (w.look) {
    case "knife":
      c.fillStyle = "#1a1a22"; c.fillRect(-2, -1, 6, 3);
      c.fillStyle = "#4a4a5e"; c.fillRect(-2, -1, 6, 1); c.fillRect(0, 1, 1, 1); c.fillRect(2, 1, 1, 1);
      c.fillStyle = "#c89a2a"; c.fillRect(4, -3, 1, 6);
      c.fillStyle = "#8a8fa8"; c.fillRect(5, -1, 9, 3);
      c.fillStyle = "#e8ecff"; c.fillRect(5, -1, 9, 1); c.fillRect(14, 0, 1, 1);
      c.fillStyle = "#6c6c88"; c.fillRect(6, 1, 7, 1);
      break;
    case "crowbar":
      c.fillStyle = "#4a4e66"; c.fillRect(-4, -1, 4, 3);
      c.fillStyle = "#b8321e"; c.fillRect(0, 0, 17, 2);
      c.fillStyle = "#e8654a"; c.fillRect(0, 0, 17, 1);
      c.fillStyle = "#7c1a1e"; c.fillRect(0, 1, 17, 1);
      c.fillStyle = "#b8321e"; c.fillRect(16, -3, 3, 3); c.fillRect(18, -4, 2, 2); c.fillRect(17, 2, 2, 1);
      c.fillStyle = "#e8654a"; c.fillRect(16, -3, 3, 1);
      c.fillStyle = "#1a1a24"; c.fillRect(19, -4, 1, 1);
      break;
    case "machete":
      c.fillStyle = "#3a2416"; c.fillRect(-3, -1, 7, 3);
      c.fillStyle = "#6a4426"; c.fillRect(-3, -1, 7, 1); c.fillRect(0, 1, 1, 1); c.fillRect(2, 1, 1, 1);
      c.fillStyle = "#8a8fa8"; c.fillRect(4, -2, 1, 5);
      c.fillStyle = "#6c6c88"; c.fillRect(5, 1, 15, 1);
      c.fillStyle = "#c8cde0"; c.fillRect(5, -1, 15, 2); c.fillRect(13, -2, 7, 1); c.fillRect(20, -1, 1, 1);
      c.fillStyle = "#ffffff"; c.fillRect(6, -1, 12, 1); c.fillRect(14, -2, 5, 1);
      break;
    case "hatchet":
      c.fillStyle = "#5a3418"; c.fillRect(-3, 0, 16, 2);
      c.fillStyle = "#8a5428"; c.fillRect(-3, 0, 16, 1);
      c.fillStyle = "#3a2a10"; c.fillRect(-4, -1, 2, 4);
      c.fillStyle = "#4a4e66"; c.fillRect(10, -4, 4, 9);
      c.fillStyle = "#8a8fa8"; c.fillRect(11, -5, 4, 11);
      c.fillStyle = "#e8ecff"; c.fillRect(15, -6, 2, 13); c.fillRect(11, -5, 4, 1);
      c.fillStyle = "#ffffff"; c.fillRect(16, -4, 1, 9);
      break;
    default:   // baton
      c.fillStyle = "#1a1a24"; c.fillRect(-2, -1, 17, 3);
      c.fillStyle = "#3a3a4a"; c.fillRect(-2, -1, 17, 1);
      c.fillStyle = "#6c6c88"; c.fillRect(-2, 1, 6, 1);
      c.fillStyle = "#c8cde0"; c.fillRect(4, -1, 1, 3); c.fillRect(15, -1, 1, 3);
      c.fillStyle = "#ff4a4a"; c.fillRect(10, 0, 2, 1);
  }
}

/** Súng Pixel Armory khi CHƯA tải được ảnh: hình khối đơn giản */
function drawFirearmFallback(c, w) {
  c.fillStyle = "#3a2a20"; c.fillRect(-1, -1, 5, 4);
  c.fillStyle = "#2b2b3a"; c.fillRect(2, -3, 16, 4);
  c.fillStyle = "#6c6c88"; c.fillRect(2, -3, 16, 1);
  c.fillStyle = w.color ?? "#ffe26b"; c.fillRect(16, -3, 2, 1);
}

/** Bề ngang hình vẽ thay thế [trái, phải] để căn giữa icon */
export function weaponSpan(w) {
  if (w.sprite) { const sp = gunSpan(w); if (sp) return sp; }
  if (w.type === "blade") return { knife: [-2, 15], crowbar: [-4, 20], machete: [-3, 21], hatchet: [-4, 17] }[w.look] ?? [-2, 16];
  return { frostHand: [0, 14], gun: [0, 13], melee: [0, 10], magic: [-2, 20], shotgun: [-3, 18], laser: [0, 19], grenade: [0, 16], sword: [-2, 23],
    minigun: [-2, 20], flamethrower: [-2, 18], frostbow: [0, 10], boomerang: [0, 10], lightning: [0, 18],
    poison: [-2, 16], disc: [0, 17], scythe: [-4, 19], sniper: [-4, 24], rocket: [-5, 21], meteor: [-2, 21], hammer: [-2, 20], bow: [0, 11], soul: [-2, 21], shuriken: [1, 10],
    gauntlet: [0, 12], longbow: [0, 11], cannon: [-2, 23], dragon: [-2, 25], firearm: [-1, 18] }[w.type] ?? [0, 13];
}

/** Độ lệch dọc (px) từ gốc vẽ tới tâm hình — loot.js dùng để súng sprite nằm đúng tâm khi rơi trên đất */
export function weaponCenterY(w) { return w.sprite ? gunCenterY(w) : 0; }

const pulseOf = (age) => (Math.sin(age * 26) > 0 ? 1 : 0);

// =====================================================================================
//  ĐẠN CỦA NGƯỜI CHƠI
// =====================================================================================
export class Bullet {
  /**
   * Lấy 1 viên đạn từ Object Pool. opts: { speed, damage, radius, color, style, life, knock, bounces, explosive:{radius,damage},
   *   pierce, burn, slow, freeze, boomerang, critBonus, homing (rad/giây), accel, maxSpeed, ricochet, cloud, stun, trail }
   */
  static obtain(x, y, angle, opts) { return Bullet.pool.obtain().init(x, y, angle, opts); }

  /** Đặt lại toàn bộ trạng thái (viên đạn có thể là đạn cũ được dùng lại) */
  init(x, y, angle, opts) {
    this.x = x; this.y = y;
    this.angle = angle;
    this.speed = opts.speed;
    this.vx = Math.cos(angle) * opts.speed;
    this.vy = Math.sin(angle) * opts.speed;
    this.radius = opts.radius ?? 3;
    this.damage = opts.damage ?? 1;
    this.color = opts.color ?? "#ffe26b";
    this.style = opts.style ?? "bullet";        // xem draw()
    this.life = opts.life ?? 2.2;               // giây tối đa (hết tầm bay)
    this.knock = opts.knock ?? 120;
    this.bounces = opts.bounces ?? 0;           // thẻ "Đạn Nảy Tường"
    this.explosive = opts.explosive ?? null;    // súng phóng lựu / tên lửa
    this.pierce = opts.pierce ?? 0;             // số quái xuyên qua thêm (Infinity = xuyên hết)
    this.ricochet = opts.ricochet ?? 0;         // số lần bật sang quái khác (Đĩa Năng Lượng, Phi Tiêu)
    if (this.pierce || this.ricochet) { (this.hitSet = this.ownSet ??= new Set()).clear(); } else this.hitSet = null;
    this.burn = opts.burn ?? 0;                 // giây đốt cháy khi trúng (Súng Phun Lửa)
    this.slow = opts.slow ?? 0;                 // giây làm chậm khi trúng (Cung Băng)
    this.freeze = opts.freeze ?? 0;             // giây ĐÓNG BĂNG khi trúng
    this.stun = opts.stun ?? 0;                 // giây choáng
    this.critBonus = opts.critBonus ?? 0;       // + tỉ lệ chí mạng riêng của vũ khí
    this.homing = opts.homing ?? 0;             // tốc độ bẻ lái (rad/giây) — đạn đuổi mục tiêu
    this.accel = opts.accel ?? 0; this.maxSpeed = opts.maxSpeed ?? opts.speed;
    this.target = null; this.targetSerial = 0; this.retarget = 0;
    this.cloud = opts.cloud ?? null;            // vỡ ra thành mây độc (Súng Phun Độc)
    this.trail = opts.trail ?? null;            // "smoke" | "soul" | "poison" — để lại vệt hạt
    this.trailT = 0;
    this.ghostWalls = !!opts.ghostWalls;        // bay xuyên tường (Boomerang lúc quay về)
    this.zap = opts.zap ?? 0;                   // trúng quái thì sét nhảy sang `zap` quái khác (Cung Thần Bão)
    this.pull = opts.pull ?? 0;                 // bán kính hút quái về tâm (Pháo Hư Không)
    this.grow = opts.grow ?? 0;                 // sóng lửa rồng to dần
    this.sprite = opts.sprite ?? null;          // style "gun": tên ảnh đạn trong src/guns.js (bullet | pellet | rocket | grenade | laser | plasma)
    this.arc = opts.arc ?? 0;                   // độ cao đỉnh vòng cung (px) — lựu đạn bay cầu vồng
    if (opts.boomerang) {
      const b = (this.boomerang = this.ownBoom ??= {});
      b.range = opts.boomerang; b.sx = x; b.sy = y; b.back = false; b.speed = opts.speed;
    } else this.boomerang = null;
    this.age = 0;
    this.dead = false;
    return this;
  }

  /** Trúng 1 quái: trả về true nếu đạn tiếp tục bay (xuyên / bật sang quái khác) */
  onHitEnemy(e, game) {
    if (this.burn) { e.burnT = Math.max(e.burnT ?? 0, this.burn); }
    if (this.zap) game.zapChain?.(e, this.damage * 0.5, this.zap, this.color);
    if (this.slow) { e.slowT = Math.max(e.slowT ?? 0, this.slow); }
    if (this.stun) e.stun?.(this.stun);
    if (this.freeze && e.freeze(this.freeze)) { game.fx.freezeBurst?.(e.cx, e.y); game.sound.play("freeze", 0.4); }
    if (this.hitSet) this.hitSet.add(e);
    // Bật sang quái gần nhất chưa trúng
    if (this.ricochet > 0) {
      let next = null, best = 150 * 150;
      for (const o of game.enemiesNear(e.cx, e.cy, 150)) {
        if (o.dead || o === e || this.hitSet.has(o)) continue;
        const d2 = (o.cx - e.cx) ** 2 + (o.cy - e.cy) ** 2;
        if (d2 < best) { best = d2; next = o; }
      }
      if (next) {
        this.ricochet--;
        const a = Math.atan2(next.cy - e.cy, next.cx - e.cx);
        this.x = e.cx + Math.cos(a) * (e.radius + 2); this.y = e.cy + Math.sin(a) * (e.radius + 2);
        this.angle = a; this.vx = Math.cos(a) * this.speed; this.vy = Math.sin(a) * this.speed;
        this.life = Math.max(this.life, this.age + 0.8);
        return true;
      }
    }
    if (!this.pierce) return false;
    if (this.pierce !== Infinity) this.pierce--;
    return this.pierce > 0 || this.pierce === Infinity;
  }
  canHit(e) { return !this.hitSet || !this.hitSet.has(e); }

  /** Boomerang: bay ra hết tầm (hoặc chạm tường) thì quay về tay người chơi */
  updateBoomerang(dt, game) {
    const b = this.boomerang, p = game.player;
    if (!b.back && (this.x - b.sx) ** 2 + (this.y - b.sy) ** 2 >= b.range * b.range) this.turnBack();
    if (b.back) {
      const dx = p.cx - this.x, dy = p.cy - this.y, d = Math.hypot(dx, dy) || 1;
      const sp = b.speed * 1.15;
      this.vx += ((dx / d) * sp - this.vx) * Math.min(1, dt * 9);
      this.vy += ((dy / d) * sp - this.vy) * Math.min(1, dt * 9);
      if (d < 12) { this.dead = true; game.sound.play("catch", 0.3); }
    }
  }
  turnBack() {
    if (this.boomerang.back) return;
    this.boomerang.back = true;
    this.ghostWalls = true;
    this.hitSet?.clear();    // lượt về được chém trúng lại
  }

  /** Đạn đuổi mục tiêu: khóa quái gần nhất phía trước, bẻ lái tối đa `homing` rad/giây */
  updateHoming(dt, game) {
    this.retarget -= dt;
    const t = this.target;
    if (!t || t.dead || t.serial !== this.targetSerial || this.retarget <= 0) {
      this.retarget = 0.25;
      this.target = null;
      let best = Infinity;
      for (const e of game.enemiesNear(this.x, this.y, 260)) {
        if (e.dead || e.spawnTime > 0.2 || (this.hitSet && this.hitSet.has(e))) continue;
        const dx = e.cx - this.x, dy = e.cy - this.y, d2 = dx * dx + dy * dy;
        if (d2 > 260 * 260) continue;
        const da = Math.abs(angleDiff(Math.atan2(dy, dx), this.angle));
        if (da > 1.7) continue;
        const score = d2 + da * da * 9000;
        if (score < best) { best = score; this.target = e; this.targetSerial = e.serial; }
      }
    }
    if (this.target) {
      const want = Math.atan2(this.target.cy - this.y, this.target.cx - this.x), step = this.homing * dt;
      this.angle += Math.max(-step, Math.min(step, angleDiff(want, this.angle)));
    }
    if (this.accel) this.speed = Math.min(this.maxSpeed, this.speed + this.accel * dt);
    this.vx = Math.cos(this.angle) * this.speed;
    this.vy = Math.sin(this.angle) * this.speed;
  }

  update(dt, game) {
    this.age += dt;
    if (this.boomerang) this.updateBoomerang(dt, game);
    else if (this.homing) this.updateHoming(dt, game);
    else if (this.accel && this.speed < this.maxSpeed) {    // tăng tốc thẳng (Bazooka)
      this.speed = Math.min(this.maxSpeed, this.speed + this.accel * dt);
      this.vx = Math.cos(this.angle) * this.speed; this.vy = Math.sin(this.angle) * this.speed;
    }
    if (this.dead) return;
    if (this.pull) game.pullEnemies?.(this.x, this.y, this.pull, dt);
    if (this.grow) this.radius = Math.min(this.radius + this.grow * dt, 16);
    const px = this.x, py = this.y;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.boomerang || this.style === "shuriken" || this.style === "disc") this.angle += dt * 22;
    if (this.trail) {
      this.trailT -= dt;
      if (this.trailT <= 0) { this.trailT = this.trail === "smoke" ? 0.025 : 0.05; game.puff?.(this.x - this.vx * 0.02, this.y - this.vy * 0.02, this.trail); }
    }
    if (this.age >= this.life) { this.finish(game); return; }
    if (this.ghostWalls) return;

    const hit = game.world.bulletHit(this.x, this.y, this.radius);
    if (!hit) return;
    if (this.boomerang) {   // boomerang chạm vật cản: bật lại quay về
      if (hit.kind === "barrel") game.igniteBarrel(hit.obj);
      else if (hit.kind === "crystal") game.hitCrystal(hit.obj, this.damage, this.angle);
      else if (hit.kind === "prop") game.hitProp(hit.obj, this.damage, this.angle);
      this.x = px; this.y = py;
      this.turnBack();
      return;
    }
    if (hit.kind === "barrel") { game.igniteBarrel(hit.obj); this.finish(game); return; }
    if (hit.kind === "crystal") { game.hitCrystal(hit.obj, this.damage, this.angle); this.finish(game); return; }
    if (hit.kind === "prop") {   // thùng gỗ / lọ năng lượng / bụi cây: đạn xuyên thấu đi tiếp sau khi phá
      const broke = game.hitProp(hit.obj, this.damage, this.angle);
      if (broke && (this.pierce === Infinity || this.style === "flame")) return;
      if (this.style === "flame") { this.dead = true; return; }
      this.finish(game); return;
    }
    // tường / cột đá
    if (this.bounces > 0 && !this.explosive && !this.cloud) {
      this.bounces--;
      // nảy: xem bị chặn theo trục nào thì đảo vận tốc trục đó
      const blockX = game.world.solidAt(this.x, py, this.radius);
      const blockY = game.world.solidAt(px, this.y, this.radius);
      if (blockX || !blockY) this.vx = -this.vx;
      if (blockY || !blockX) this.vy = -this.vy;
      this.x = px; this.y = py;
      this.angle = Math.atan2(this.vy, this.vx);
      if (this.homing) this.target = null;
      game.fx.hit(this.x, this.y, this.angle + Math.PI);
      return;
    }
    this.x = px; this.y = py;
    if (this.sprite && !this.explosive) gunImpact(this.x + Math.cos(this.angle) * 2, this.y + Math.sin(this.angle) * 2);   // tia lửa chạm tường
    this.finish(game);
  }

  /** Đạn kết thúc (chạm tường / hết tầm / trúng quái): lựu đạn & tên lửa phát nổ, cầu độc vỡ thành mây */
  finish(game) {
    if (this.dead) return;
    this.dead = true;
    if (this.explosive) game.explode(this.x, this.y, { radius: this.explosive.radius, damage: this.explosive.damage ?? this.damage, knock: this.knock, source: this.explosive.source ?? "grenade" });
    if (this.cloud) game.addZone(this.x, this.y + 4, { ...this.cloud, owner: "player", kind: "poison" });
  }

  draw(c, game) {
    c.save();
    c.translate(Math.round(this.x), Math.round(this.y));
    const st = this.style;
    if (st === "gun" && drawGunProjectile(c, this)) {
      // đạn sprite của súng Pixel Armory (ảnh trong src/guns.js)
    } else if (st === "gun") {   // chưa tải ảnh: chấm sáng
      c.rotate(this.angle);
      c.fillStyle = this.color; c.fillRect(-3, -1, 6, 2); c.fillStyle = "#ffffff"; c.fillRect(1, -1, 2, 2);
    } else if (st === "orb" || st === "grenade") {
      const r = this.radius + (Math.sin(this.age * 30) > 0 ? 1 : 0);
      c.fillStyle = withAlpha(this.color, 0.25); c.fillRect(-r - 2, -r - 2, (r + 2) * 2, (r + 2) * 2);
      c.fillStyle = this.color; c.fillRect(-r, -r + 1, r * 2, r * 2 - 2); c.fillRect(-r + 1, -r, r * 2 - 2, r * 2);
      c.fillStyle = "#ffffff"; c.fillRect(-1, -1, 2, 2);
      if (st === "grenade") { c.fillStyle = "#1a241a"; c.fillRect(-r, -1, r * 2, 1); }
    } else if (st === "pellet") {
      c.rotate(this.angle);
      c.fillStyle = withAlpha(this.color, 0.4); c.fillRect(-6, -1, 7, 2);
      c.fillStyle = "#ffffff"; c.fillRect(0, -1, 2, 2);
    } else if (st === "flame") {
      // hạt lửa: to dần, đổi màu trắng -> vàng -> cam -> đỏ -> khói
      const k = this.age / this.life, r = Math.round(2 + k * 6);
      const col = k < 0.15 ? "#fff3a6" : k < 0.4 ? "#ffc23d" : k < 0.65 ? "#ff8a2a" : k < 0.85 ? "#c9281f" : "#4a3f4a";
      c.globalAlpha = 1 - k * 0.6;
      c.fillStyle = col; c.fillRect(-r, -r + 1, r * 2, r * 2 - 2); c.fillRect(-r + 1, -r, r * 2 - 2, r * 2);
      if (k < 0.5) { c.fillStyle = "#ffffff"; c.fillRect(-1, -1, 2, 2); }
    } else if (st === "iceArrow") {
      c.rotate(this.angle);
      c.fillStyle = withAlpha("#7cd8ff", 0.35); c.fillRect(-12, -2, 12, 4);
      c.fillStyle = "#c8f2ff"; c.fillRect(-9, -0.5, 10, 1);
      c.fillStyle = "#ffffff"; c.fillRect(1, -1, 4, 2); c.fillRect(5, -0.5, 1, 1);
      c.fillStyle = "#3a8bd8"; c.fillRect(-10, -2, 2, 1); c.fillRect(-10, 1, 2, 1);
    } else if (st === "arrow") {          // tên gỗ của Thợ Săn
      c.rotate(this.angle);
      c.fillStyle = withAlpha("#ffffff", 0.25); c.fillRect(-14, -1, 8, 1);
      c.fillStyle = "#8a5428"; c.fillRect(-9, -0.5, 11, 1);
      c.fillStyle = "#e8e2f6"; c.fillRect(2, -1, 3, 2); c.fillRect(5, -0.5, 1, 1);
      c.fillStyle = this.color; c.fillRect(-10, -2, 3, 1); c.fillRect(-10, 1, 3, 1);
    } else if (st === "boomerang") {
      c.rotate(this.angle);
      c.fillStyle = "#3a1f10"; c.fillRect(-6, -2, 12, 4); c.fillRect(-2, -6, 4, 12);
      c.fillStyle = this.color; c.fillRect(-5, -1, 10, 2); c.fillRect(-1, -5, 2, 10);
      c.fillStyle = "#ffffff"; c.fillRect(-1, -1, 2, 2);
    } else if (st === "shuriken") {       // phi tiêu xoay tít
      c.rotate(this.angle);
      c.fillStyle = "#1a1a24"; c.fillRect(-5, -1, 10, 3); c.fillRect(-1, -5, 3, 10);
      c.fillStyle = "#c8cde0"; c.fillRect(-4, 0, 8, 1); c.fillRect(0, -4, 1, 8);
      c.fillStyle = this.color; c.fillRect(0, 0, 1, 1);
    } else if (st === "disc") {           // lưỡi cưa năng lượng
      c.rotate(this.angle);
      c.fillStyle = withAlpha(this.color, 0.3); c.fillRect(-7, -7, 14, 14);
      c.fillStyle = "#1c3a8a"; c.fillRect(-5, -4, 10, 8); c.fillRect(-4, -5, 8, 10);
      c.fillStyle = this.color; c.fillRect(-4, -3, 8, 6); c.fillRect(-3, -4, 6, 8);
      c.fillStyle = "#ffffff"; c.fillRect(-1, -1, 2, 2); c.fillRect(5, -1, 2, 1); c.fillRect(-7, 0, 2, 1); c.fillRect(0, 5, 1, 2); c.fillRect(-1, -7, 1, 2);
    } else if (st === "rocket") {         // tên lửa + lửa đuôi
      c.rotate(this.angle);
      const f = Math.floor(this.age * 30) % 2;
      c.fillStyle = "#ffe26b"; c.fillRect(-11 - f * 2, -1, 4 + f * 2, 2);
      c.fillStyle = "#ff7a3a"; c.fillRect(-9, -2, 3, 4);
      c.fillStyle = "#3e4058"; c.fillRect(-7, -2, 10, 4);
      c.fillStyle = "#8e97b0"; c.fillRect(-7, -2, 10, 1);
      c.fillStyle = "#bd2f2c"; c.fillRect(3, -2, 3, 4); c.fillRect(6, -1, 1, 2); c.fillRect(-7, -4, 2, 2); c.fillRect(-7, 2, 2, 2);
    } else if (st === "poisonBlob") {     // cầu độc sủi bọt
      const r = this.radius + (Math.sin(this.age * 24) > 0 ? 1 : 0);
      c.fillStyle = withAlpha("#a6f06a", 0.3); c.fillRect(-r - 2, -r - 2, (r + 2) * 2, (r + 2) * 2);
      c.fillStyle = "#2f8f2a"; c.fillRect(-r, -r + 1, r * 2, r * 2 - 2); c.fillRect(-r + 1, -r, r * 2 - 2, r * 2);
      c.fillStyle = "#a6f06a"; c.fillRect(-r + 1, -r + 1, r * 2 - 3, r * 2 - 3);
      c.fillStyle = "#f0ffd2"; c.fillRect(-1, -2, 2, 2);
    } else if (st === "soulOrb") {        // linh hồn xanh lục có đuôi
      const r = this.radius;
      c.fillStyle = withAlpha("#45f0b0", 0.25); c.fillRect(-r - 3, -r - 3, (r + 3) * 2, (r + 3) * 2);
      c.fillStyle = "#16615f"; c.fillRect(-r, -r + 1, r * 2, r * 2 - 2); c.fillRect(-r + 1, -r, r * 2 - 2, r * 2);
      c.fillStyle = "#45f0b0"; c.fillRect(-r + 1, -r + 1, r * 2 - 2, r * 2 - 2);
      c.fillStyle = "#e8fff4"; c.fillRect(-2, -1, 1, 2); c.fillRect(1, -1, 1, 2);
    } else if (st === "chargeArrow") {    // tên tích lực: vệt sáng dài
      c.rotate(this.angle);
      const L = 10 + this.radius * 3;
      c.fillStyle = withAlpha(this.color, 0.22); c.fillRect(-L - 6, -3, L + 6, 6);
      c.fillStyle = withAlpha(this.color, 0.6); c.fillRect(-L, -1, L, 2);
      c.fillStyle = "#8a5428"; c.fillRect(-9, -0.5, 11, 1);
      c.fillStyle = "#ffffff"; c.fillRect(2, -1, 4, 2); c.fillRect(6, -0.5, 2, 1);
      c.fillStyle = this.color; c.fillRect(-10, -2, 3, 1); c.fillRect(-10, 1, 3, 1);
    } else if (st === "cannon" || st === "void") {   // quả cầu năng lượng / lỗ đen
      const r = Math.round(this.radius), pulse = Math.sin(this.age * 28) > 0 ? 1 : 0, v = st === "void";
      c.fillStyle = withAlpha(this.color, 0.18); c.beginPath(); c.arc(0, 0, r + 5 + pulse, 0, TAU); c.fill();
      c.fillStyle = withAlpha(this.color, 0.45); c.beginPath(); c.arc(0, 0, r + 2, 0, TAU); c.fill();
      c.fillStyle = v ? "#12061e" : this.color; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill();
      c.strokeStyle = v ? this.color : "#ffffff"; c.lineWidth = 1;
      c.beginPath(); c.arc(0, 0, Math.max(1, r - 1), this.age * 9, this.age * 9 + 4); c.stroke();
      if (!v) { c.fillStyle = "#ffffff"; c.fillRect(-Math.ceil(r / 3), -Math.ceil(r / 3), Math.ceil(r / 1.5), Math.ceil(r / 1.5)); }
      else { c.fillStyle = "#e8c8ff"; c.fillRect(-1, -1, 2, 2); }
    } else if (st === "reflect") {        // đạn quái bị PHẢN lại: viền vàng
      const r = this.radius + pulseOf(this.age);
      c.fillStyle = withAlpha("#ffe26b", 0.35); c.fillRect(-r - 2, -r - 2, (r + 2) * 2, (r + 2) * 2);
      c.fillStyle = "#ffe26b"; c.fillRect(-r, -r + 1, r * 2, r * 2 - 2); c.fillRect(-r + 1, -r, r * 2 - 2, r * 2);
      c.fillStyle = "#ffffff"; c.fillRect(-1, -1, 2, 2);
    } else if (st === "flameWave") {      // sóng lửa rồng hình lưỡi liềm
      c.rotate(this.angle);
      const r = this.radius, k = 1 - this.age / this.life;
      c.globalAlpha = 0.4 + 0.6 * k;
      c.strokeStyle = "#ff5a2a"; c.lineWidth = 4;
      c.beginPath(); c.arc(-r, 0, r * 1.4, -0.9, 0.9); c.stroke();
      c.strokeStyle = "#ffc23d"; c.lineWidth = 2;
      c.beginPath(); c.arc(-r, 0, r * 1.4, -0.75, 0.75); c.stroke();
      c.strokeStyle = "#ffffff"; c.lineWidth = 1;
      c.beginPath(); c.arc(-r, 0, r * 1.4, -0.4, 0.4); c.stroke();
    } else if (st === "iceSpike") {
      c.rotate(this.angle);
      const t = Math.floor(this.age * 30) % 2;
      c.fillStyle = "rgba(166,236,255,0.35)"; c.fillRect(-12, -2, 9, 4);
      c.fillStyle = "#ffffff"; c.fillRect(-14 + t, -1 + t, 1, 1); c.fillRect(-10, 1 - t, 1, 1);
      c.fillStyle = "#1c3a78"; c.fillRect(-6, -3, 10, 6); c.fillRect(4, -2, 3, 4); c.fillRect(7, -1, 2, 2);
      c.fillStyle = "#62c8f4"; c.fillRect(-5, -2, 9, 4); c.fillRect(4, -1, 3, 2);
      c.fillStyle = "#c8f2ff"; c.fillRect(-4, -2, 8, 1); c.fillRect(4, -1, 3, 1); c.fillRect(7, -1, 1, 1);
      c.fillStyle = "#ffffff"; c.fillRect(-2, -2, 4, 1); c.fillRect(8, -1, 1, 1);
    } else if (st === "shard") {
      c.rotate(this.angle);
      c.fillStyle = "#a6ecff"; c.fillRect(-4, -1, 7, 2);
      c.fillStyle = "#ffffff"; c.fillRect(1, -1, 2, 1);
    } else {
      c.rotate(this.angle);
      const img = game.assets.images.bullet;
      if (img) {
        // >>> ẢNH ĐẠN CỦA BẠN được vẽ ở đây
        c.drawImage(img, -img.width / 2, -img.height / 2);
      } else {
        c.fillStyle = withAlpha(this.color, 0.35); c.fillRect(-9, -2, 12, 4);
        c.fillStyle = this.color; c.fillRect(-6, -1, 8, 2);
        c.fillStyle = "#ffffff"; c.fillRect(0, -1, 3, 2);
      }
    }
    c.restore();
  }
}

// =====================================================================================
//  ĐẠN CỦA QUÁI (tên, cầu tím, cầu lửa, axit...) — bị Kiếm Năng Lượng chém rụng
// =====================================================================================
export class EnemyBullet {
  static obtain(x, y, angle, opts) { return EnemyBullet.pool.obtain().init(x, y, angle, opts); }
  init(x, y, angle, opts) {
    this.x = x; this.y = y; this.angle = angle;
    this.speed = opts.speed;
    this.vx = Math.cos(angle) * opts.speed; this.vy = Math.sin(angle) * opts.speed;
    this.radius = opts.radius ?? 3;
    this.damage = opts.damage ?? 1;
    this.color = opts.color ?? "#ff5a5a";
    this.style = opts.style ?? "arrow";   // "arrow" | "orb" | "fireball" | "acid"
    this.life = opts.life ?? 3;
    this.slow = opts.slow ?? 0;           // giây làm chậm người chơi khi trúng (axit)
    this.accel = opts.accel ?? 0;         // tăng / giảm tốc theo thời gian
    this.curve = opts.curve ?? 0;         // bẻ cong quỹ đạo (rad/giây)
    this.age = 0;
    this.dead = false;
    return this;
  }
  update(dt, game) {
    this.age += dt;
    if (this.accel || this.curve) {
      this.speed = Math.max(40, this.speed + this.accel * dt);
      this.angle += this.curve * dt;
      this.vx = Math.cos(this.angle) * this.speed; this.vy = Math.sin(this.angle) * this.speed;
    }
    this.x += this.vx * dt; this.y += this.vy * dt;
    if (this.age >= this.life) { this.dead = true; return; }
    const hit = game.world.bulletHit(this.x, this.y, this.radius);
    if (hit) {
      this.dead = true;
      if (hit.kind === "barrel") game.igniteBarrel(hit.obj);
      else if (hit.kind === "crystal") game.hitCrystal(hit.obj, 1, this.angle);
      else if (hit.kind === "prop") game.hitProp(hit.obj, 1, this.angle, false);
    }
  }
  draw(c) {
    c.save();
    c.translate(Math.round(this.x), Math.round(this.y));
    if (this.style === "orb" || this.style === "fireball" || this.style === "acid") {
      const r = this.radius + (Math.sin(this.age * 26) > 0 ? 1 : 0);
      const col = this.style === "fireball" ? "#ff8a2a" : this.style === "acid" ? "#8ad23a" : this.color;
      c.fillStyle = withAlpha(col, 0.3); c.fillRect(-r - 2, -r - 2, (r + 2) * 2, (r + 2) * 2);
      c.fillStyle = "#0e0c14"; c.fillRect(-r - 1, -r, r * 2 + 2, r * 2); c.fillRect(-r, -r - 1, r * 2, r * 2 + 2);
      c.fillStyle = col; c.fillRect(-r, -r + 1, r * 2, r * 2 - 2); c.fillRect(-r + 1, -r, r * 2 - 2, r * 2);
      c.fillStyle = this.style === "fireball" ? "#ffe26b" : "#ffffff"; c.fillRect(-1, -1, 2, 2);
    } else {
      c.rotate(this.angle);
      c.fillStyle = "#6a4a2a"; c.fillRect(-8, -0.5, 10, 1);      // thân tên
      c.fillStyle = "#e8e2d0"; c.fillRect(2, -1, 3, 2);           // mũi tên
      c.fillStyle = "#c83a3a"; c.fillRect(-9, -2, 2, 1); c.fillRect(-9, 1, 2, 1); // lông đuôi
    }
    c.restore();
  }
}

// =====================================================================================
//  BẮN THEO TỪNG LOẠI VŨ KHÍ — p = Player, w = vũ khí đang cầm
// =====================================================================================
/** Góc của các tia phụ (thẻ "Đạn Phân Tách"): 0, +a, -a, +2a ... */
function splitAngles(extra, step) {
  const out = [0];
  for (let i = 1; i <= extra; i++) out.push((i % 2 ? 1 : -1) * Math.ceil(i / 2) * step);
  return out;
}
/** Shotgun: thêm 2 viên mỗi cấp Phân Tách, mỗi viên yếu đi */
const SHOTGUN_SPLIT = [1, 0.8, 0.68];

export function fireWeapon(p, game, w) {
  if (w.type === "firearm") { fireFirearm(p, game, w); return; }
  const m = p.muzzle, mods = p.mods;
  const per = w.type === "shotgun" ? SHOTGUN_SPLIT[Math.min(2, mods.split)] : mods.splitDmg;   // hệ số mỗi tia
  const dmg = w.damage * mods.damageMul * per;
  const knock = (w.knockback ?? 120) * mods.knockMul;
  const pierce = mods.pierce;
  game.flashMuzzle(m.x, m.y, w.color, w.type === "shotgun" || w.type === "grenade" || w.type === "rocket" ? 7 : w.type === "frostHand" ? 3 : 4);
  game.noteWeaponUsed(w);
  game.sound.play(w.sound ?? "shoot", 0.4);

  switch (w.type) {
    case "shotgun": {
      p.recoil = 5;
      const n = w.pellets + mods.split * 2;
      for (let i = 0; i < n; i++) {
        const a = p.aim - w.cone / 2 + (w.cone * i) / Math.max(1, n - 1) + rand(-0.03, 0.03);
        const speed = w.bulletSpeed * rand(0.9, 1.1);
        game.bullets.push(Bullet.obtain(m.x, m.y, a, { speed, damage: dmg, radius: w.bulletRadius, color: w.color, style: "pellet", life: w.range / speed, knock, bounces: mods.bounce }));
      }
      game.fx.muzzleShotgun(m.x, m.y, p.aim);
      game.shake(0.14, 3, p.aim + Math.PI);
      break;
    }
    case "laser": {
      p.recoil = 2;
      for (const off of splitAngles(mods.split, 0.12)) fireLaser(game, m.x, m.y, p.aim + off, w, dmg, knock);
      break;
    }
    case "grenade": {
      p.recoil = 5;
      for (const off of splitAngles(mods.split, 0.14)) {
        game.bullets.push(Bullet.obtain(m.x, m.y, p.aim + off, {
          speed: w.bulletSpeed, damage: dmg, radius: w.bulletRadius, color: w.color, style: "grenade", life: w.range / w.bulletSpeed,
          knock, explosive: { radius: w.aoe, source: "grenade" },
        }));
      }
      game.shake(0.12, 3, p.aim + Math.PI);
      break;
    }
    case "rocket": {
      p.recoil = 6;
      for (const off of splitAngles(mods.split, 0.3)) {
        game.bullets.push(Bullet.obtain(m.x, m.y, p.aim + off, {
          speed: w.bulletSpeed, maxSpeed: w.maxSpeed, accel: 420, homing: w.homing, damage: dmg, radius: w.bulletRadius, color: w.color,
          style: "rocket", life: w.range, knock, explosive: { radius: w.aoe, source: "rocket" }, trail: "smoke",
        }));
      }
      game.shake(0.16, 3, p.aim + Math.PI);
      break;
    }
    case "flamethrower": {
      p.recoil = 1;
      for (const off of splitAngles(mods.split, 0.22)) {
        const a = p.aim + off + rand(-0.18, 0.18), speed = w.bulletSpeed * rand(0.85, 1.15);
        game.bullets.push(Bullet.obtain(m.x, m.y, a, { speed, damage: dmg, radius: 4, color: w.color, style: "flame", life: w.range / speed, knock, pierce: Infinity, burn: w.burn }));
      }
      break;
    }
    case "frostbow": case "bow": case "longbow": {
      p.recoil = 3;
      const bow = w.type !== "frostbow";
      for (const off of splitAngles(mods.split, 0.1)) {
        game.bullets.push(Bullet.obtain(m.x, m.y, p.aim + off, {
          speed: w.bulletSpeed, damage: dmg, radius: w.bulletRadius, color: w.color, style: bow ? "arrow" : "iceArrow", knock,
          pierce: (w.pierce ?? 0) + pierce, slow: w.slow ?? 0, bounces: mods.bounce, critBonus: w.critBonus ?? 0, life: 1.6, zap: w.zap ?? 0,
        }));
      }
      break;
    }
    case "boomerang": {
      p.recoil = -3;
      for (const off of splitAngles(mods.split, 0.3)) {
        game.bullets.push(Bullet.obtain(m.x, m.y, p.aim + off, { speed: w.bulletSpeed, damage: dmg, radius: w.bulletRadius, color: w.color, style: "boomerang", life: 4, knock, pierce: Infinity, boomerang: w.range }));
      }
      break;
    }
    case "frostHand": {   // tay không: triệu hồi ĐƯỜNG GAI BĂNG chạy dọc mặt đất (main.js -> Game.castIceLine)
      p.recoil = 2;
      for (const off of splitAngles(mods.split, 0.3)) game.castIceLine(p, w, dmg, knock, p.aim + off);
      game.shake(0.08, 1);
      break;
    }
    case "lightning": {
      p.recoil = 2;
      for (const off of splitAngles(mods.split, 0.35)) fireLightning(game, m.x, m.y, p.aim + off, w, dmg, knock);
      break;
    }
    case "sniper": {
      p.recoil = 7;
      for (const off of splitAngles(mods.split, 0.08)) fireSniper(game, m.x, m.y, p.aim + off, w, dmg, knock, pierce);
      game.fx.muzzle(m.x, m.y, p.aim);
      game.shake(0.12, 3, p.aim + Math.PI);
      break;
    }
    case "poison": {
      p.recoil = 3;
      const cloud = { ...w.cloud, dmg: w.cloud.dmg * mods.damageMul * per };
      for (const off of splitAngles(mods.split, 0.2)) {
        game.bullets.push(Bullet.obtain(m.x, m.y, p.aim + off, {
          speed: w.bulletSpeed, damage: dmg, radius: w.bulletRadius, color: w.color, style: "poisonBlob", life: w.range / w.bulletSpeed, knock, cloud, trail: "poison",
        }));
      }
      break;
    }
    case "disc": case "shuriken": {
      p.recoil = w.type === "disc" ? 3 : -2;
      for (const off of splitAngles(mods.split, 0.16)) {
        game.bullets.push(Bullet.obtain(m.x, m.y, p.aim + off + (w.spread ? rand(-w.spread, w.spread) : 0), {
          speed: w.bulletSpeed, damage: dmg, radius: w.bulletRadius, color: w.color, style: w.type, life: w.life ?? 1.4, knock,
          ricochet: w.ricochet ?? 0, pierce, bounces: (w.type === "disc" ? 2 : 0) + mods.bounce, critBonus: w.critBonus ?? 0,
        }));
      }
      break;
    }
    case "soul": {
      p.recoil = 2;
      for (const off of splitAngles(mods.split, 0.35)) {
        game.bullets.push(Bullet.obtain(m.x, m.y, p.aim + off, {
          speed: w.bulletSpeed, damage: dmg, radius: w.bulletRadius, color: w.color, style: "soulOrb", life: w.life ?? 2.2, knock,
          homing: w.homing, pierce, trail: "soul",
        }));
      }
      break;
    }
    case "cannon": {   // bắn nhanh (không tích lực): cầu năng lượng nhỏ
      p.recoil = 4;
      for (const off of splitAngles(mods.split, 0.14)) {
        game.bullets.push(Bullet.obtain(m.x, m.y, p.aim + off, { speed: w.bulletSpeed * 1.2, damage: dmg, radius: 3, color: w.color, style: "cannon", life: 1.2, knock, pierce }));
      }
      game.shake(0.08, 2, p.aim + Math.PI);
      break;
    }
    case "meteor": {   // gọi thiên thạch rơi xuống điểm ngắm (tối đa w.range px)
      p.recoil = -2;
      const aim = game.aimTarget(p), dx = aim.x - p.x, dy = aim.y - p.y, d = Math.hypot(dx, dy) || 1, r = Math.min(d, w.range);
      const tx = p.x + (dx / d) * r, ty = p.y + (dy / d) * r;
      splitAngles(mods.split, 1).forEach((off) => {
        const ox = -dy / d * off * 46, oy = dx / d * off * 46;
        game.addStrike({ kind: "meteor", x: tx + ox, y: ty + oy, r: w.aoe, delay: w.delay, damage: dmg, knock, burn: w.burn, owner: "player" });
      });
      break;
    }
    default: {   // "gun" | "magic" | "minigun"
      p.recoil = w.type === "minigun" ? 2 : 3;
      if (w.type === "minigun") game.shake(0.04, 1);
      const spread = (Math.random() - 0.5) * (w.spread ?? 0.08);
      for (const off of splitAngles(mods.split, 0.1)) {
        game.bullets.push(Bullet.obtain(m.x, m.y, p.aim + spread + off, {
          speed: w.bulletSpeed, damage: dmg, radius: w.bulletRadius, color: w.color, style: w.type === "magic" ? "orb" : "bullet",
          knock, bounces: mods.bounce, pierce, critBonus: w.critBonus ?? 0,
        }));
      }
      if (w.type === "gun" || (w.type === "minigun" && Math.random() < 0.35)) game.fx.muzzle(m.x, m.y, p.aim);
    }
  }
  // vỏ đạn văng ra khỏi khe súng, rơi lạch cạch xuống đất
  if (ejectsShells(w)) game.ejectShell?.(p.handX, p.handY - 1, p.aim, w.type === "shotgun" ? "shell" : w.type === "sniper" ? "big" : "brass");
}

/**
 * >>> SÚNG PIXEL ARMORY <<< (type "firearm"): đạn sprite, lửa nòng sprite, vỏ đạn sprite, giật nòng, rung màn hình.
 * Không tự trừ đạn: main.js gọi tryConsumeAmmo(w, game) TRƯỚC khi gọi hàm này.
 *   beam     -> tia tức thì xuyên `pierce` quái (bắn tỉa)
 *   pellets  -> chùm đạn chì tỏa trong ±spread
 *   lob      -> bay vòng cung tới chỗ trỏ chuột rồi nổ (phóng lựu)
 */
function fireFirearm(p, game, w) {
  const m = p.muzzle, mods = p.mods;
  const multi = (w.pellets ?? 1) > 1;
  const per = multi ? SHOTGUN_SPLIT[Math.min(2, mods.split)] : mods.splitDmg;
  const dmg = w.damage * mods.damageMul * per;
  const knock = (w.knockback ?? 100) * mods.knockMul;
  game.noteWeaponUsed(w);
  game.sound.play(w.sound ?? "shoot", 0.4);
  gunFlash(m.x, m.y, p.aim, w.muzzleFx ?? "small");
  game.flashMuzzle(m.x, m.y, w.color, w.beam || multi ? 5 : 3);
  p.recoil = w.kick ?? 3;
  const sk = w.shake ?? [0.05, 1];
  if (sk[1] > 0) game.shake(sk[0], sk[1], p.aim + Math.PI);

  if (w.beam) {   // bắn tỉa: tia tức thì
    for (const off of splitAngles(mods.split, 0.08)) fireSniper(game, m.x, m.y, p.aim + off + rand(-w.spread, w.spread), w, dmg, knock, mods.pierce);
  } else if (multi) {   // hoa cải: chùm chì
    const n = w.pellets + mods.split * 2;
    for (let i = 0; i < n; i++) {
      const a = p.aim + ((i / Math.max(1, n - 1)) - 0.5) * w.spread * 2 + rand(-0.03, 0.03);
      const speed = w.bulletSpeed * rand(0.92, 1.08);
      game.bullets.push(Bullet.obtain(m.x, m.y, a, { speed, damage: dmg, radius: w.bulletRadius ?? 2, color: w.color, style: "gun", sprite: w.proj, life: w.range / speed, knock, bounces: mods.bounce, critBonus: w.critBonus ?? 0 }));
    }
  } else {
    let life = w.life ?? w.range / w.bulletSpeed, speed = w.bulletSpeed, arc = 0;
    if (w.lob) {   // lựu đạn: rơi đúng chỗ trỏ chuột (70–w.range px)
      const aim = game.aimTarget?.(p), d = aim ? Math.hypot(aim.x - m.x, aim.y - m.y) : w.range * 0.7;
      life = Math.max(0.2, Math.min(w.range, Math.max(70, d)) / speed);
      arc = 14;
    }
    const explosive = w.aoe ? { radius: w.aoe, source: w.explodeSource ?? "rocket" } : null;
    for (const off of splitAngles(mods.split, 0.1)) {
      const a = p.aim + off + (w.spread ? rand(-w.spread, w.spread) : 0);
      game.bullets.push(Bullet.obtain(m.x, m.y, a, {
        speed, damage: dmg, radius: w.bulletRadius ?? 2, color: w.color, style: "gun", sprite: w.proj, life, knock, bounces: explosive ? 0 : mods.bounce,
        pierce: (w.pierce ?? 0) + (explosive ? 0 : mods.pierce), critBonus: w.critBonus ?? 0, explosive, trail: w.trail ?? null, arc,
        accel: w.accel ?? 0, maxSpeed: w.maxSpeed ?? speed,
      }));
    }
  }
  if (w.shells) gunShell(p.handX, p.handY - 1, p.aim, !!w.shellBig);   // vỏ đạn văng ra, rơi lạch cạch xuống đất
}

/**
 * >>> ĐÒN TÍCH LỰC <<< (Cung Dài, Cung Săn, Cung Thần Bão, Búa Sấm Sét, Pháo Năng Lượng, Pháo Hư Không)
 * k = mức tụ lực 0..1 (1 = đầy). Sát thương x(1 + charge.dmg * k).
 */
export function fireCharged(p, game, w, k) {
  const mods = p.mods, C = w.charge, full = k >= 0.999;
  const dmg = w.damage * mods.damageMul * (1 + (C.dmg ?? 2) * k), knock = (w.knockback ?? 150) * mods.knockMul * (1 + k);
  const m = p.muzzle;
  game.noteWeaponUsed(w);
  switch (w.type) {
    case "bow": case "longbow": {
      p.recoil = 4 + 3 * k;
      const fan = w.zap && full ? [-0.16, -0.08, 0, 0.08, 0.16] : [0];
      for (const off of splitAngles(mods.split, 0.1)) for (const f of fan) {
        game.bullets.push(Bullet.obtain(m.x, m.y, p.aim + off + f, {
          speed: (w.bulletSpeed ?? 430) * (1 + 0.5 * k), damage: dmg * (fan.length > 1 ? 0.6 : 1), radius: (w.bulletRadius ?? 3) + (full ? 2 : 1), color: w.color,
          style: "chargeArrow", knock, pierce: full ? Infinity : (w.pierce ?? 0) + 1 + Math.round(k * 3) + mods.pierce,
          critBonus: (w.critBonus ?? 0) + 0.15 * k, life: 1.8, zap: w.zap ?? 0, slow: w.slow ?? 0,
        }));
      }
      game.flashMuzzle(m.x, m.y, w.color, 5 + Math.round(3 * k));
      game.sound.play(full ? "sniper" : "bow", 0.5);
      game.shake(0.1, 2 + 3 * k, p.aim + Math.PI);
      break;
    }
    case "cannon": {
      p.recoil = 6 + 4 * k;
      const r = (w.bulletRadius ?? 5) + 7 * k, v = !!w.void;
      game.bullets.push(Bullet.obtain(m.x, m.y, p.aim, {
        speed: (w.bulletSpeed ?? 250) * (1 + 0.3 * k), damage: dmg, radius: r, color: w.color, style: v ? "void" : "cannon",
        pierce: Infinity, life: v ? 1.5 : 1.6, knock: v ? knock * 0.3 : knock,
        explosive: full || v ? { radius: 48 + 42 * k, source: v ? "void" : "cannon", damage: dmg * 0.7 } : null,
        pull: v ? 80 + 70 * k : 0,
      }));
      game.flashMuzzle(m.x, m.y, w.color, 8 + Math.round(6 * k));
      game.sound.play(full ? "explosion" : "laser", 0.55);
      game.shake(0.22, 3 + 4 * k, p.aim + Math.PI);
      game.hitStop(0.02 + 0.03 * k);
      break;
    }
    case "hammer": {   // BÚA SẤM SÉT: giáng búa + sấm sét đánh xuống mọi quái trong vùng
      p.recoil = -6;
      p.startSwing?.(w, true);
      const reach = w.range * 0.7, R = (w.aoe ?? 36) * (1 + 1.2 * k);
      const hx = p.cx + Math.cos(p.aim) * reach, hy = p.cy + Math.sin(p.aim) * reach + 8;
      game.fx.hammer(hx, hy + 6, p.aim);
      game.fx.slam?.(hx, hy + 4, 0.4 + 0.35 * k);
      game.shocks.push({ x: hx, y: hy, r: R, life: 0.4, max: 0.4, color: w.color });
      let bolts = Math.round(3 + 4 * k);
      for (const e of game.enemiesNear(hx, hy, R)) {
        if (e.dead) continue;
        const rr = R + e.radius;
        if ((e.cx - hx) ** 2 + (e.cy - hy) ** 2 > rr * rr) continue;
        if (bolts-- > 0) { game.fx.lightning(e.x, e.y - e.z); game.fx.zap?.(e.cx, e.cy); }
        game.damageEnemy(e, dmg, Math.atan2(e.cy - p.cy, e.cx - p.cx), knock, { pierce: true, critBonus: 0.1 * k });
        if (!e.dead) e.stun?.((w.stun ?? 0.5) * (1 + k));
      }
      game.hitArea?.(hx, hy, R, dmg, p.aim);
      game.sound.play("thunder", 0.6);
      game.sound.play("bossSlam", 0.5);
      game.screenFlash?.("#c8f2ff", 0.12 + 0.1 * k);
      game.shake(0.3, 4 + 4 * k, p.aim);
      game.hitStop(0.04 + 0.04 * k);
      break;
    }
  }
}

/** Tia laser tức thì: xuyên mọi quái tới khi gặp tường / cột / tinh thể */
function fireLaser(game, x0, y0, angle, w, dmg, knock) {
  const x1 = x0 + Math.cos(angle) * w.range, y1 = y0 + Math.sin(angle) * w.range;
  const ray = game.world.raycast(x0, y0, x1, y1);
  const ex = x0 + (x1 - x0) * ray.t, ey = y0 + (y1 - y0) * ray.t;
  for (const e of game.enemies) {
    if (e.dead) continue;
    const r = e.radius + w.width;
    if (pointSegDist2(e.cx, e.cy, x0, y0, ex, ey) <= r * r) game.damageEnemy(e, dmg, angle, knock, { pierce: true });
  }
  for (const b of ray.barrels) game.igniteBarrel(b);
  if (ray.crystal) game.hitCrystal(ray.crystal, dmg, angle);
  if (ray.prop) game.hitProp(ray.prop, dmg, angle);
  game.beams.push({ x0, y0, x1: ex, y1: ey, life: 0.22, max: 0.22, color: w.color, width: w.width });
  game.fx.hit(ex, ey, angle);
}

/** Súng Bắn Tỉa: tia tức thì, trúng tối đa (pierce + 1 + thẻ xuyên) quái GẦN NHẤT trên đường bắn */
function fireSniper(game, x0, y0, angle, w, dmg, knock, extraPierce) {
  const c = Math.cos(angle), s = Math.sin(angle);
  const x1 = x0 + c * w.range, y1 = y0 + s * w.range;
  const ray = game.world.raycast(x0, y0, x1, y1);
  let ex = x0 + (x1 - x0) * ray.t, ey = y0 + (y1 - y0) * ray.t;
  const hits = [];
  for (const e of game.enemies) {
    if (e.dead) continue;
    const r = e.radius + 2;
    if (pointSegDist2(e.cx, e.cy, x0, y0, ex, ey) <= r * r) hits.push({ e, t: (e.cx - x0) * c + (e.cy - y0) * s });
  }
  hits.sort((a, b) => a.t - b.t);
  const max = (w.pierce ?? 0) + 1 + extraPierce;
  hits.slice(0, max).forEach(({ e }, i) => game.damageEnemy(e, dmg * (i ? 0.85 : 1), angle, knock, { pierce: true, critBonus: w.critBonus ?? 0 }));
  if (hits.length >= max) { const last = hits[max - 1]; ex = x0 + c * (last.t + 6); ey = y0 + s * (last.t + 6); }
  else { for (const b of ray.barrels) game.igniteBarrel(b); if (ray.crystal) game.hitCrystal(ray.crystal, dmg, angle); if (ray.prop) game.hitProp(ray.prop, dmg, angle); }
  game.beams.push({ x0, y0, x1: ex, y1: ey, life: 0.16, max: 0.16, color: w.color, width: 1 });
  game.fx.hit(ex, ey, angle);
}

/**
 * Súng Sét Xích: khóa quái gần nhất trong hình nón trước mặt rồi nhảy sang `chains` quái kế tiếp.
 * Sét là năng lượng nên xuyên khiên Hiệp Sĩ (pierce).
 */
function fireLightning(game, x0, y0, angle, w, dmg, knock) {
  let target = null, best = Infinity;
  const R2 = w.range * w.range;
  for (const e of game.enemies) {
    if (e.dead) continue;
    const dx = e.cx - x0, dy = e.cy - y0, d2 = dx * dx + dy * dy;
    if (d2 > R2) continue;                                  // loại nhanh bằng khoảng cách bình phương
    const da = Math.abs(angleDiff(Math.atan2(dy, dx), angle));
    if (da > 0.45 || !game.world.lineOfSight(x0, y0, e.cx, e.cy)) continue;
    const score = Math.sqrt(d2) + da * 120;                 // chỉ tính căn cho vài quái nằm trong nón bắn
    if (score < best) { best = score; target = e; }
  }
  const pts = [[x0, y0]];
  if (!target) {   // không có mục tiêu: tia sét phóng thẳng tới vật cản
    const x1 = x0 + Math.cos(angle) * w.range * 0.7, y1 = y0 + Math.sin(angle) * w.range * 0.7;
    const ray = game.world.raycast(x0, y0, x1, y1);
    pts.push([x0 + (x1 - x0) * ray.t, y0 + (y1 - y0) * ray.t]);
    for (const b of ray.barrels) game.igniteBarrel(b);
  } else {
    const hit = new Set();
    let cur = target, k = 1;
    while (cur && hit.size <= w.chains) {
      hit.add(cur);
      pts.push([cur.cx, cur.cy]);
      game.damageEnemy(cur, dmg * k, Math.atan2(cur.cy - pts[pts.length - 2][1], cur.cx - pts[pts.length - 2][0]), knock, { pierce: true });
      k *= 0.85;   // mỗi lần nhảy yếu đi 15%
      let next = null, nd = w.chainRange * w.chainRange;
      for (const e of game.enemiesNear(cur.cx, cur.cy, w.chainRange)) {
        if (e.dead || hit.has(e)) continue;
        const d2 = (e.cx - cur.cx) ** 2 + (e.cy - cur.cy) ** 2;
        if (d2 < nd) { nd = d2; next = e; }
      }
      cur = next;
    }
  }
  game.bolts.push({ pts: jaggedPath(pts), life: 0.18, max: 0.18, color: w.color });
}

/** Đường zigzag giữa các điểm (vẽ tia sét) */
export function jaggedPath(pts, jag = 9) {
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
    const n = Math.max(2, Math.round(Math.hypot(bx - ax, by - ay) / 10));
    for (let j = 1; j < n; j++) {
      const t = j / n, jx = (Math.random() - 0.5) * jag, jy = (Math.random() - 0.5) * jag;
      out.push([ax + (bx - ax) * t + jx, ay + (by - ay) * t + jy]);
    }
    out.push([bx, by]);
  }
  return out;
}

/**
 * >>> ĐÒN CẬN CHIẾN — COMBO 3 NHÁT (kiểu Dan the Man) <<<
 *   step 0, 1: nhát thường (nhát 2 mạnh hơn 10%)
 *   step 2   : ĐÒN KẾT THÚC — x1.6 sát thương, luôn CHÍ MẠNG, vùng chém rộng + hất văng mạnh, khựng hình (hitstop)
 * Găng ("melee"/"gauntlet"), Kiếm ("sword"), Long Kiếm ("dragon"), Lưỡi Hái ("scythe"): trúng mọi quái trong bán kính + cung trước mặt.
 * Búa ("hammer"): nện 1 vùng tròn trước mặt, gây choáng.
 * MỌI vũ khí cận chiến đều PHẢN đạn quái nằm trong vùng chém (đạn bay ngược về hướng đang ngắm).
 */
export function meleeSwing(p, game, w, step = 0) {
  const mods = p.mods, fin = step >= 2;
  const mul = fin ? 1.6 : step === 1 ? 1.1 : 1;
  const dmg = w.damage * mods.damageMul * mul, knock = (w.knockback ?? 170) * mods.knockMul * (fin ? 1.8 : 1);
  const kind = w.type, sword = kind === "sword" || kind === "dragon";
  const hitOpts = fin ? { critBonus: 1, finisher: true } : {};
  p.recoil = fin ? -8 : -5;
  p.startSwing?.(w, fin);        // vũ khí vung theo cung (main.js -> Player.startSwing)
  game.noteWeaponUsed(w);
  game.sound.play(w.sound ?? "punch", 0.5);
  if (fin) game.sound.play("slam", 0.45);

  if (kind === "hammer") {   // BÚA: vùng tròn trước mặt + choáng
    const reach = w.range * 0.62, R = (w.aoe ?? 34) * (fin ? 1.45 : 1);
    const hx = p.cx + Math.cos(p.aim) * reach, hy = p.cy + Math.sin(p.aim) * reach + 8;
    game.fx.hammer(hx, hy + 6, p.aim);
    if (fin) game.fx.slam?.(hx, hy + 4, 0.45);
    game.shocks.push({ x: hx, y: hy, r: R, life: 0.3, max: 0.3, color: w.color });
    game.shake(fin ? 0.2 : 0.12, fin ? 5 : 3, p.aim);
    for (const e of game.enemiesNear(hx, hy, R)) {
      if (e.dead) continue;
      const rr = R + e.radius;
      if ((e.cx - hx) ** 2 + (e.cy - hy) ** 2 > rr * rr) continue;
      const a = Math.atan2(e.cy - p.cy, e.cx - p.cx);
      game.damageEnemy(e, dmg, a, knock, hitOpts);
      if (!e.dead) e.stun?.((w.stun ?? 0.5) * (fin ? 1.5 : 1));
    }
    game.hitArea?.(hx, hy, R, dmg, p.aim);
    reflectBullets(p, game, reach + R, 1.2, dmg);
    if (fin) game.hitStop(0.05);
    return;
  }

  const range = w.range * (fin ? 1.25 : 1), arc = fin ? Math.max(w.arc ?? 1, 2.4) : (w.arc ?? 1);
  if (kind === "scythe") game.fx.scythe(p.cx, p.cy, p.aim, range);
  else game.fx.slash(p.cx, p.cy, p.aim, range * (sword ? 0.85 : 0.7), w.slashPalette ?? (kind === "gauntlet" ? true : undefined));
  if (fin) game.fx.spinSlash?.(p.cx, p.cy + 4, 0.32 + range / 220);
  if (sword) game.waves.push({ x: p.cx, y: p.cy, a: p.aim, r: range, arc, life: 0.18, max: 0.18, color: w.color });
  // chỉ xét quái ở gần (lưới không gian) + so khoảng cách BÌNH PHƯƠNG, không Math.hypot
  for (const e of game.enemiesNear(p.cx, p.cy, range + 30)) {
    if (e.dead) continue;
    const ex = e.cx - p.cx, ey = e.cy - p.cy, r = range + e.radius;
    if (ex * ex + ey * ey > r * r) continue;
    if (Math.abs(angleDiff(Math.atan2(ey, ex), p.aim)) > arc) continue;
    if (w.burn) e.burnT = Math.max(e.burnT ?? 0, w.burn);
    const killed = game.damageEnemy(e, dmg, fin || kind === "scythe" ? Math.atan2(ey, ex) : p.aim, knock, hitOpts);
    if (killed && w.reap) p.reap(game, w.reap);
    if (w.stun && !killed && !e.dead) e.stun?.(w.stun * (fin ? 1.6 : 1));   // Xà Beng / Dùi Cui: choáng
  }
  // Long Kiếm: phóng sóng lửa rồng (đòn kết thúc: 3 sóng hình quạt)
  if (kind === "dragon") {
    for (const off of fin ? [-0.35, 0, 0.35] : [0]) {
      game.bullets.push(Bullet.obtain(p.cx + Math.cos(p.aim) * 10, p.cy + Math.sin(p.aim) * 10, p.aim + off, {
        speed: 300, damage: dmg * 0.6, radius: 7, grow: 14, color: w.color, style: "flameWave", life: 0.5, knock: knock * 0.4, pierce: Infinity, burn: w.burn ?? 2,
      }));
    }
  }
  // đánh trúng thùng nổ / tinh thể / thùng gỗ trong tầm
  game.hitArc?.(p.cx, p.cy, range, arc, p.aim, dmg);
  reflectBullets(p, game, range + 10, arc + 0.2, dmg);
  if (fin) {
    game.shocks.push({ x: p.cx, y: p.cy + 6, r: range, life: 0.25, max: 0.25, color: w.color });
    game.shake(0.18, 4, p.aim);
    game.hitStop(0.05);
  }
}

/** PHẢN ĐẠN: đạn quái trong vùng chém (bán kính r, nửa cung arc quanh hướng ngắm) bay ngược về phía đang ngắm */
function reflectBullets(p, game, r, arc, dmg) {
  let n = 0;
  for (const b of game.enemyBullets) {
    if (b.dead) continue;
    const dx = b.x - p.cx, dy = b.y - p.cy;
    if (dx * dx + dy * dy > r * r) continue;
    if (Math.abs(angleDiff(Math.atan2(dy, dx), p.aim)) > arc) continue;
    b.dead = true;
    game.fx.parry(b.x, b.y);
    if (n++ < 12) {
      game.bullets.push(Bullet.obtain(b.x, b.y, p.aim + rand(-0.12, 0.12), {
        speed: Math.max(280, b.speed * 1.3), damage: Math.max(1.5, dmg * 0.6), radius: Math.max(3, b.radius), color: "#ffe26b",
        style: "reflect", life: 1.2, knock: 120, pierce: 1,
      }));
    }
  }
  if (n) { game.sound.play("deflect", 0.5); game.hitStop(0.03); game.banner?.(n > 2 ? `PHẢN ĐẠN x${n}!` : "PHẢN ĐẠN!", "#ffe26b", false, 0.8); }
}

/** Kiểm tra đạn quái có trúng người chơi */
export const enemyBulletHitsPlayer = (b, p) => circleHit(b.x, b.y, b.radius, p.cx, p.cy, p.radius);

/** Icon nhỏ cho thẻ / HUD: vẽ vũ khí vào giữa ô (w x h) */
export function drawWeaponIcon(g, weapon, x, y, w, h, scale = 1) {
  if (weapon.sprite && drawGunIcon(g, weapon, x, y, w, h, scale)) return;   // súng ảnh thật
  const span = weaponSpan(weapon);
  g.save();
  g.beginPath(); g.rect(x, y, w, h); g.clip();
  g.translate(Math.round(x + w / 2 - ((span[0] + span[1]) / 2) * scale), Math.round(y + h / 2));
  if (scale !== 1) g.scale(scale, scale);
  drawWeaponFallback(g, weapon);
  g.restore();
}

// Object Pool cho đạn: tạo sẵn để lúc xả đạn không phải `new` liên tục
Bullet.pool = new Pool(() => new Bullet(), 256);
EnemyBullet.pool = new Pool(() => new EnemyBullet(), 96);
export { TAU };

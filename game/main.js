// =====================================================================================
//  PIXEL ARENA — game 2D (HTML5 Canvas + JavaScript thuần)
//  Phong cách: chém/bắn "đã tay" kiểu Dan the Man + đấu trường sinh tồn kiểu Soul Knight
//
//  Cấu trúc:
//    characters.js          — DỮ LIỆU NHÂN VẬT (thêm/sửa nhân vật ở đó)
//    src/util.js            — toán học, va chạm hình học, màu
//    src/world.js           — BẢN ĐỒ 2400x1600, 5 BIOME, vật cản, thùng nổ, bẫy, đền thờ, nguồn sáng, CAMERA
//    src/weapons.js         — KHO VŨ KHÍ (21 vũ khí, 5 độ hiếm, cận chiến combo, tích lực, ghép ★), đạn người chơi & đạn quái
//    src/enemies.js         — 11 LOẠI QUÁI + quái TINH ANH có tố chất + 4 BOSS luân phiên mỗi đợt
//    src/loot.js            — RƯƠNG BÁU, vật phẩm, tim, ngọc EXP, Vàng & Ngọc Năng Lượng
//    src/lobby.js           — SẢNH CHỜ: căn phòng đi lại được, đổi nhân vật, Kho Vũ Khí, Bàn Nâng Cấp, Cổng Dịch Chuyển
//    src/progress.js        — NGỌC & nâng cấp vĩnh viễn (localStorage)
//    src/shop.js            — Thương Nhân Bí Ẩn & Tượng Thần trong trận (tiêu Vàng)
//    src/rarity.js          — 5 độ hiếm (Thường → Thần Thoại) dùng chung
//    src/perks.js           — THẺ NÂNG CẤP ROGUELIKE (độ hiếm, giới hạn cộng dồn — chống "hack game")
//    src/ambient.js         — ÁNH SÁNG, thời tiết, viền tối
//    src/hud.js             — HUD, minimap, mũi tên chỉ hướng, thanh máu Boss
//    src/actors.js          — hình người pixel (nhân vật / quái hình người)
//  --- bản 5.0: NHẢY DÙ – NHIỆM VỤ – RÚT QUÂN (chế độ chính; lối chơi cũ = Chế Độ Giải Trí) ---
//    src/stash.js           — KHO ĐỒ vĩnh viễn + TÚI CHIẾN THUẬT 4 ô (Z X C V), icon vật phẩm
//    src/extractMap.js      — bản đồ 3200x2240, 4 khu, hòm tiếp tế, điểm nhảy dù, bãi rút quân
//    src/hordeAI.js         — zombie tuần tra theo ĐÀN 5–6 con, hú lên khi phát hiện, nghe tiếng súng
//    src/missions.js        — nhiệm vụ: chiếm cứ điểm, cứu người, phá ổ dịch, tải dữ liệu
//    src/deploy.js          — bản đồ chiến thuật chọn điểm nhảy, máy bay + bung dù + sóng xung kích
//    src/extraction.js      — đồng hồ ván, dùng đồ, pháo sáng, trực thăng, vùng độc, tổng kết
//    src/guns.js            — kho súng Pixel Armory (ảnh súng thật, lửa nòng, vỏ đạn)
//
//    fx-config.js           — >>> MAP SPRITESHEET HIỆU ỨNG / NHÂN VẬT (số cột, hàng, fps, điểm gốc)
//    src/effects.js         — EffectManager: phát hiệu ứng theo frame, Object Pool, tối đa MAX_EFFECTS
//    src/animation.js       — AnimationController (Idle / Run / Skill theo deltaTime) + nạp spritesheet
//    src/fxbake.js          — "nướng" hiệu ứng pixelfx & dựng tư thế nhân vật thành spritesheet
//    src/spritesheet.js     — cắt frame từ ảnh spritesheet, vẽ có lật / xoay
//    src/pool.js, spatial.js— Object Pool, lưới không gian cho va chạm
//
//  Trong file này:
//    1. CẤU HÌNH   2. TÀI NGUYÊN   3. HIỆU ỨNG (EffectManager)   4. ÂM THANH   5. INPUT (+ chuột -> tọa độ thế giới)
//    6. ICON KỸ NĂNG   7. KỸ NĂNG   8. NGƯỜI CHƠI   9. GAME   10. GIAO DIỆN MENU (DOM)   11. GAME LOOP
// =====================================================================================

// Thư viện hiệu ứng pixelfx (thư mục pixelfx-main nằm cạnh thư mục game)
import { createFrame, composite, painterFor, hex } from "../pixelfx-main/src/core/index.js";
import * as fxDamageNumber from "../pixelfx-main/src/fx/ui/damage-number.js";
import * as fxRage from "../pixelfx-main/src/fx/status/rage.js";          // hào quang kỹ năng Cuồng Nộ (chạy trực tiếp)
// --- Mọi hiệu ứng còn lại đã được "nướng" thành spritesheet PNG: cấu hình trong fx-config.js ---
import { EFFECTS, ACTORS, MAX_EFFECTS } from "./fx-config.js";

import { CHARACTERS, STAT_MAX, ARMOR_REGEN } from "./characters.js";
import { TAU, clamp, circleHit, pointSegDist2, angleDiff, rand, rndSeed, lighten, withAlpha, fmtNum } from "./src/util.js";
import { BIOMES, ENV, World, Camera, WORLD } from "./src/world.js";
import { fireWeapon, fireCharged, meleeSwing, isMelee, mergeResult, muzzleLength, drawWeaponFallback, drawWeaponIcon, enemyBulletHitsPlayer, jaggedPath, Bullet, EnemyBullet, WEAPONS, RECIPES, makeWeapon, WEAPON_MAX_LEVEL,
  tickReload, tryConsumeAmmo, startReload, ammoLabel, weaponNoise } from "./src/weapons.js";
import { Enemy, pickEnemyType, MAX_ENEMY_RADIUS, CROWD, BOSS_ROTATION, ENEMY_TYPES } from "./src/enemies.js";
import { Chest, Pickup, ExpOrb, Drop, rollChest, CHEST_TIERS } from "./src/loot.js";
import { RARITY_ORDER, rarityColor, rarityName } from "./src/rarity.js";
import { Progress, UPGRADES, CRAFT_COST, gemsForRun } from "./src/progress.js";
import { Lobby } from "./src/lobby.js";
import { Cabin, CABIN_IMAGES, CABIN_ETA } from "./src/cabin.js";
import { ATTACHMENTS, ATTACH_SLOTS, hdGunUrl } from "./src/attachments.js";   // phụ kiện + ảnh súng chi tiết (Kho Vũ Khí)
import { AMMO, AMMO_TYPES, AMMO_DROP, ammoTypeOf, startAmmoPool, stopAmmoPool, addAmmo, rollAmmoType } from "./src/ammo.js";   // đạn theo loại (Rút Quân)   // khoang máy bay: sảnh chờ trước khi nhảy dù (Rút Quân)
import { Merchant, GodStatue, STATUE } from "./src/shop.js";
import { rollPerks, expToNext, PERK_ICONS, Mods, RARITY, PERK_BY_ID, ABSORB_EVERY, VAMP_EVERY } from "./src/perks.js";
import { LightLayer, Ambient, makeVignette } from "./src/ambient.js";
import { makeActor, LiveFx } from "./src/actors.js";
import * as HUD from "./src/hud.js";
import { TouchControls, isTouchDevice } from "./src/touch.js";
import { EffectManager } from "./src/effects.js";
import { loadSprites } from "./src/animation.js";
import { sweep, sweepLife } from "./src/pool.js";
import { SpatialGrid } from "./src/spatial.js";
import { GUN_IMAGES, prepareGunSprites, updateGunFx, drawGunFx, gunFlash } from "./src/guns.js";
// --- bản 5.0: chế độ NHẢY DÙ – NHIỆM VỤ – RÚT QUÂN ---
import { ExtractionWorld } from "./src/extractMap.js";          // bản đồ chiến thuật 3200x2240, 4 khu
import { HordeManager } from "./src/hordeAI.js";                // zombie tuần tra theo đàn 5–6 con
import { Stash, ITEM_IMAGES, ITEM_DEFS, ITEM_ORDER, BAG_KEYS, BAG_SLOTS, drawItemIcon } from "./src/stash.js";   // Kho Đồ vĩnh viễn + Túi Chiến Thuật
import { ExtractionRun, EXTRACT_IMAGES, EXTRACT } from "./src/extraction.js";   // vòng đời 1 ván rút quân (+ missions.js, deploy.js)

// =====================================================================================
// 1. CẤU HÌNH
// =====================================================================================
const W = 480;                 // độ phân giải pixel của khung hình (phóng to cho vừa cửa sổ)
const H = 270;

/** Kích thước đấu trường Chế độ Giải Trí (chế độ Rút Quân dùng bản đồ 3200x2240 trong src/extractMap.js) */
const ARCADE_WORLD = { w: 2400, h: 1600 };

/** Trạng thái chính của game. (Tạm dừng / chọn thẻ là cờ bên trong PLAYING.) */
const GAME_STATE = Object.freeze({
  MENU: "MENU",           // SẢNH CHỜ: căn phòng đi lại, đổi nhân vật, nâng cấp, chọn bản đồ
  CABIN: "CABIN",         // KHOANG MÁY BAY (Rút Quân): chọn đồ mang theo trước khi nhảy dù
  PLAYING: "PLAYING",     // Đang chiến đấu
  GAME_OVER: "GAME_OVER", // Thua cuộc
});

const PLAYER_CFG = {
  invuln: 0.8,          // giây bất tử sau khi bị đánh
  radius: 8,            // bán kính va chạm thân
  footR: 6,             // nửa cạnh hộp va chạm ở chân (với tường, cột đá)
  pickupRange: 42,      // bán kính tự hút ngọc EXP
  damageMul: 1.3,       // >>> SÁT THƯƠNG người chơi x1.3 (mọi vũ khí & kỹ năng). Muốn mạnh hơn nữa thì tăng số này
};

/** Kỹ năng Lướt Nhanh (Shift) — mọi nhân vật đều có */
const ROLL = { distance: 140, time: 0.16, cooldown: 2.5, iframes: 0.25 };

/** Hoạt ảnh nhân vật (AnimationController) */
const ANIM_CFG = {
  runAbove: 18,        // px/giây: chạy nhanh hơn mức này -> hoạt ảnh Run
  idleBelow: 10,       // chậm hơn mức này -> về Idle (2 ngưỡng khác nhau để không giật qua lại)
  runRefSpeed: 95,     // tốc độ ứng với nhịp bước chân chuẩn (chạy nhanh hơn thì bước nhanh hơn)
  castTime: 0.3,       // giây giữ dáng Skill khi tung Cuồng Nộ / Bão Cầu Năng Lượng
};

/** Cầm vũ khí: giật lùi (recoil) & vung chém (swing) */
const WEAPON_CFG = {
  grip: 1,             // px: tay cầm nằm cách điểm bàn tay bao nhiêu
  recoilReturn: 18,    // tốc độ súng trở về sau khi giật (càng lớn càng nhanh)
  climb: 0.05,         // rad / 1px giật: nòng hếch lên khi bắn
  climbReturn: 14,
  swingTime: 0.16,     // giây vung kiếm hết cung
  swingSettle: 0.12,   // giây thu kiếm về
  behindAbove: -0.45,  // sin(góc ngắm) nhỏ hơn mức này (ngắm lên trên) -> vũ khí vẽ SAU lưng
};

/** Tản đội hình quái & lưới va chạm */
const GRID_CELL = 32;

/** Đang chơi bằng cảm ứng (điện thoại / tablet) — laptop cảm ứng bật khi chạm màn hình lần đầu */
let TOUCH = isTouchDevice();

/** >>> SỐ LƯỢNG QUÁI — muốn đông / thưa hơn thì chỉnh ở đây */
const SPAWN = {
  maxEnemies: TOUCH ? 18 : 22,   // tối đa cùng lúc ở đợt 1 (mỗi đợt +perWave, tới maxCap)
  perWave: 2, maxCap: TOUCH ? 28 : 36,
  startInterval: 2.2,   // giây giữa 2 lần sinh quái lúc đầu trận
  minInterval: 0.8,     // nhanh nhất về sau
  rampPerSec: 0.012,    // mỗi giây sống sót rút ngắn khoảng cách sinh quái bao nhiêu
  extraAfter: 45, extraChance: 0.15,   // sau 45s, 15% cơ hội sinh 2 con 1 lúc
  chestEvery: 25,       // giây: rương ngẫu nhiên xuất hiện
  maxChests: 4,
  bossEvery: 60,        // giây: mỗi ĐỢT dài 60 giây, hết đợt thì Boss xuất hiện
  eliteAfter: 30, eliteChance: 0.08,
  eventEvery: [40, 55], eventAfter: 50,   // sự kiện ngẫu nhiên (bầy dơi, mưa thiên thạch, rương vàng, Tượng Thần...)
  heartChance: 0.02,    // tỉ lệ quái thường rơi Tim (Tinh Anh 30%)
  // >>> BÁO HIỆU SINH QUÁI: biểu tượng ngắm đỏ hiện dưới đất trước khi quái xuất hiện
  telegraph: 0.5,       // giây (quái thường, quái triệu hồi)
  bossTelegraph: 1.1,   // giây (Boss — vòng ngắm to hơn)
  minD: 125, maxD: 300, // quái mới sinh cách người chơi bao xa (ưu tiên trong khung hình để thấy vòng ngắm)
};

/** >>> NĂNG LƯỢNG (thanh xanh dương) — vũ khí mạnh tốn năng lượng mỗi phát, vũ khí khởi đầu & cận chiến thì không */
const ENERGY = {
  regen: 2,             // năng lượng tự hồi mỗi giây
  orbChance: 0.35,      // tỉ lệ quái rơi Ngọc Năng Lượng
  orbValue: 5,          // mỗi ngọc hồi bao nhiêu
  potion: 60,           // Bình Năng Lượng (rương)
};
/** >>> VÀNG trong trận (tiêu ở Thương Nhân / Tượng Thần) */
const GOLD = { chance: 0.45, elite: 12, boss: 40 };

/**
 * >>> LUẬT ĐỢT QUÁI: mỗi đợt máu quái +16%, tốc độ +3% (tối đa +25%).
 *     Ác Mộng: từ đợt 4 quái đánh mạnh hơn 1.
 */
const WAVE = { hpPerWave: 0.16, speedPerWave: 0.03, speedCap: 1.25 };

/** >>> ĐỘ KHÓ (chọn ở Cổng Dịch Chuyển trong Sảnh chờ) */
const DIFFICULTY = [
  { id: "easy",   name: "Dễ",      desc: "Quái yếu hơn 25%, ra chậm hơn. Điểm x0.7",               hp: 0.75, spawn: 0.8,  elite: 0.6, dmgFrom: 99, score: 0.7, color: "#5fdc8c" },
  { id: "normal", name: "Thường",  desc: "Cân bằng chuẩn.",                                        hp: 1,    spawn: 1,    elite: 1,   dmgFrom: 99, score: 1,   color: "#ffe26b" },
  { id: "hard",   name: "Ác Mộng", desc: "Quái trâu hơn 40%, đông hơn, từ đợt 4 đánh đau hơn. Điểm x1.6", hp: 1.4, spawn: 1.25, elite: 1.8, dmgFrom: 4, score: 1.6, color: "#ff5a5a" },
];

/** Combo: hạ quái liên tiếp trong COMBO.window giây -> nhân điểm (tối đa x2) */
const COMBO = { window: 2.6, maxBonus: 1, perKill: 0.02, milestones: [10, 25, 50, 100] };

/** Bùa Đền Thờ (chạm vào đền thờ sáng để nhận 1 bùa ngẫu nhiên trong ENV.shrine.buffTime giây) */
const BLESSINGS = [
  { id: "power", name: "Sức Mạnh Thần Thánh", desc: "+40% sát thương", color: "#ff6a4a" },
  { id: "haste", name: "Gió Lốc", desc: "+25% tốc chạy & tốc bắn", color: "#5fdc8c" },
  { id: "guard", name: "Hộ Thể", desc: "+2 Giáp, giáp hồi cực nhanh", color: "#7fa2d8" },
];

// =====================================================================================
// 2. TÀI NGUYÊN (ASSETS) — >>> ĐÂY LÀ CHỖ BẠN CHÈN FILE HÌNH ẢNH & ÂM THANH CỦA MÌNH <<<
// =====================================================================================
// Đặt file vào thư mục  game/assets/images  và  game/assets/sounds  rồi điền đường dẫn bên dưới.
// Để chuỗi rỗng "" = chưa có file -> game tự dùng hình/âm thanh thay thế (pixelfx + tiếng bíp tổng hợp).
// * Ảnh NHÂN VẬT / VŨ KHÍ / ICON KỸ NĂNG: điền trong file  characters.js.
// * Ảnh NỀN MÀN HÌNH CHÍNH: đặt file tại  game/assets/menu-bg.png  (khai báo trong style.css, mục #menu).
const IMAGE_MANIFEST = {
  // >>> CHÈN ẢNH KẺ ĐỊCH. Quay mặt sang PHẢI, chân ở mép dưới.
  enemySlime: "",    // ví dụ: "assets/images/slime.png"   (Slime khổng lồ dùng chung, tự phóng to x1.6)
  enemyBat: "",      // ví dụ: "assets/images/bat.png"
  enemyGhost: "",    // ví dụ: "assets/images/ghost.png"
  enemyArcher: "",   // ví dụ: "assets/images/archer.png"
  enemyKnight: "",   // ví dụ: "assets/images/knight.png"
  enemyBoss: "",     // ví dụ: "assets/images/boss.png"    (tự phóng to x2.2)
  // >>> CHÈN ẢNH ĐẠN SÚNG (nằm ngang, hướng sang PHẢI). Cầu năng lượng luôn tự vẽ.
  bullet: "",        // ví dụ: "assets/images/bullet.png"
  // >>> CHÈN ẢNH SÀN: 1 ô gạch (tile) lặp kín bản đồ (thay cho sàn vẽ sẵn của mọi biome)
  floorTile: "",     // ví dụ: "assets/images/floor.png"
};
for (const ch of CHARACTERS) {
  IMAGE_MANIFEST[`${ch.id}.sprite`] = ch.sprite || "";
  IMAGE_MANIFEST[`${ch.id}.weapon`] = ch.weaponImg || "";
  IMAGE_MANIFEST[`${ch.id}.skill`] = ch.skillIcon || "";
}
// Spritesheet hiệu ứng & nhân vật/quái — đường dẫn khai báo trong fx-config.js
for (const [name, cfg] of Object.entries(EFFECTS)) if (cfg.src) IMAGE_MANIFEST[`fx:${name}`] = cfg.src;
for (const [name, cfg] of Object.entries(ACTORS)) if (cfg.src) IMAGE_MANIFEST[`actor:${name}`] = cfg.src;
// Ảnh súng Pixel Armory (đường dẫn khai báo trong src/guns.js -> GUN_IMAGES)
Object.assign(IMAGE_MANIFEST, GUN_IMAGES);
// Ảnh chế độ Rút Quân (máy bay, dù, trực thăng, hòm đồ, pháo sáng...) & icon vật phẩm — để "" thì game tự vẽ
Object.assign(IMAGE_MANIFEST, EXTRACT_IMAGES, ITEM_IMAGES);
if (CABIN_IMAGES.background) IMAGE_MANIFEST["cabin:bg"] = CABIN_IMAGES.background;   // ảnh nền khoang máy bay của bạn (src/cabin.js)

const SOUND_MANIFEST = {
  // >>> CHÈN FILE ÂM THANH (.mp3 / .wav / .ogg)
  // --- Chiến đấu ---
  shoot: "", punch: "", magicShoot: "",           // vũ khí khởi đầu của 3 nhân vật
  shotgun: "", laser: "", grenadeShoot: "", sword: "", // 4 vũ khí mới
  flame: "", zap: "", catch: "",                       // phun lửa, súng sét, bắt boomerang
  hit: "", enemyDie: "", playerHurt: "", armorHit: "", gameOver: "",
  explosion: "",     // thùng nổ / lựu đạn
  deflect: "",       // kiếm chém rụng đạn
  shieldBlock: "",   // trúng khiên Hiệp Sĩ
  arrow: "",         // Cung Thủ Xương bắn
  batArm: "",        // Dơi Cảm Tử chuẩn bị nổ
  iceBreak: "",      // tinh thể băng vỡ
  iceShot: "", freeze: "", shyCast: "", thunder: "",   // Bạch Ngưng Băng: gai băng, đóng băng, Ngại Ngùng, sét
  bossWarn: "", bossShoot: "", bossCharge: "", bossSlam: "",
  // --- Vũ khí mới (bản 3.0) ---
  poison: "", disc: "", scythe: "", sniper: "", rocket: "", meteorCast: "", meteor: "", hammer: "", bow: "", soul: "", shuriken: "",
  crit: "",
  // --- Kỹ năng ---
  skillRage: "", skillDash: "", skillNova: "", skillDenied: "", roll: "",
  holy: "", arrowRain: "", summon: "", blink: "", heal: "", revive: "",
  // --- Rương / vật phẩm / cấp độ / sự kiện ---
  chestSpawn: "", chestOpen: "", pickup: "", expPickup: "", levelUp: "", swap: "", upgrade: "",
  waveStart: "", combo: "", shrine: "", event: "", grab: "",
  // --- Giao diện ---
  uiSelect: "", uiStart: "",
  // --- Nhạc nền (lặp) ---
  menuMusic: "",     // ví dụ: "assets/sounds/menu_bgm.mp3"
  music: "",         // ví dụ: "assets/sounds/battle_bgm.mp3"
};

/** Tải trước toàn bộ ảnh và âm thanh. File lỗi/thiếu không làm game dừng. */
class AssetLoader {
  constructor() { this.images = {}; this.sounds = {}; this.total = 0; this.loaded = 0; }
  get progress() { return this.total === 0 ? 1 : this.loaded / this.total; }
  loadImage(name, src) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => { this.images[name] = img; this.loaded++; resolve(); };
      img.onerror = () => { console.warn(`[Asset] Không tải được ảnh "${name}": ${src}`); this.loaded++; resolve(); };
      img.src = src;
    });
  }
  loadSound(name, src) {
    return new Promise((resolve) => {
      const audio = new Audio();
      const done = (ok) => {
        if (ok) this.sounds[name] = audio; else console.warn(`[Asset] Không tải được âm thanh "${name}": ${src}`);
        this.loaded++; resolve();
      };
      audio.addEventListener("canplaythrough", () => done(true), { once: true });
      audio.addEventListener("error", () => done(false), { once: true });
      audio.preload = "auto"; audio.src = src; audio.load();
    });
  }
  async loadAll(imageManifest, soundManifest, onProgress = () => {}) {
    const jobs = [], track = (p) => p.then(() => onProgress(this.progress));
    for (const [name, src] of Object.entries(imageManifest)) if (src) { this.total++; jobs.push(track(this.loadImage(name, src))); }
    for (const [name, src] of Object.entries(soundManifest)) if (src) { this.total++; jobs.push(track(this.loadSound(name, src))); }
    await Promise.all(jobs);
    onProgress(1);
  }
}

// =====================================================================================
// 3. HIỆU ỨNG — EffectManager phát spritesheet theo frame (Object Pool, tối đa MAX_EFFECTS = 150)
//    Vị trí truyền vào luôn là TỌA ĐỘ THẾ GIỚI. Đổi ảnh / số cột hàng: fx-config.js
// =====================================================================================
const effects = new EffectManager(MAX_EFFECTS);
effects.textMod = fxDamageNumber;
/** Spritesheet nhân vật & quái (tên -> ActorSprite), nạp trong main() */
let ACTOR_SPRITES = new Map();
/** Spritesheet hiệu ứng (tên -> { sheet, cfg }) — dùng khi cần vẽ trực tiếp (khiên thánh lặp, vong linh...) */
let FX_SHEETS = new Map();

/** Bán kính vệt chém lúc xuất ảnh (fx-config.js) — chém to/nhỏ hơn thì phóng ảnh theo tỉ lệ */
const SLASH_BAKED = { slash: 30, slashFist: 28, slashSword: 41 };
const CHEST_FX = { wood: "chestWood", silver: "chestSilver", gold: "chestGold" };
/** Thiên thạch trong spritesheet "meteor" chạm đất ở giây thứ ... (để khớp hình với sát thương) */
const METEOR_IMPACT = 0.62;

/** Bảng tra hiệu ứng: game gọi FX.xxx(...), muốn đổi hình thì sửa fx-config.js chứ không cần sửa logic. */
const FX = {
  hit: (x, y, aim) => effects.play("hit", x, y, { aim }),                     // trúng đòn (xoay theo hướng đòn)
  iceHit: (x, y, aim) => effects.play("iceHit", x, y, { aim }),               // gai băng trúng đòn
  freezeBurst: (x, y) => effects.play("freezeBurst", x, y, { scale: 0.6 }),  // quái vừa bị đóng băng
  frostNova: (x, y) => effects.play("frostNova", x, y),                       // Ngại Ngùng: sóng băng
  lightning: (x, y) => effects.play("lightning", x, y, { scale: 0.7 }),      // Ngại Ngùng: sét đánh xuống
  zap: (x, y) => effects.play("zap", x, y),
  death: (x, y, scale = 1) => effects.play("death", x, y + 10 * scale, { scale }), // quái chết: tan biến
  muzzle: (x, y, aim) => effects.play("muzzle", x, y, { aim }),               // tia lửa đầu nòng
  muzzleShotgun: (x, y, aim) => effects.play("muzzleShotgun", x, y, { aim }),
  /** Vệt chém cận chiến: radius = tầm chém, palette = màu (găng của Võ Sư / Kiếm Năng Lượng) */
  slash: (x, y, aim, radius = 30, palette) => {
    const name = palette === WEAPONS.sword.slashPalette ? "slashSword" : palette ? "slashFist" : "slash";
    const left = Math.cos(aim) < 0, ang = left ? aim - Math.PI : aim, off = radius * 0.66;
    return effects.play(name, x - off * Math.sin(ang), y + off * Math.cos(ang), { aim, scale: radius / SLASH_BAKED[name] });
  },
  damage: (x, y, amount) => effects.text(`-${fmtNum(amount)}`, x, y),          // số TRẮNG
  dust: (x, y, flip) => effects.play("dust", x, y, { flip }),                 // bụi chân khi chạy
  spawn: (x, y) => effects.play("spawn", x, y),
  nova: (x, y) => effects.play("nova", x, y),
  // >>> NỔ: thùng thuốc nổ (size = độ to) / dơi cảm tử / lựu đạn năng lượng
  explosion: (x, y, size = 0.8) => effects.play(size < 0.6 ? "explosionSmall" : "explosion", x, y),
  plasma: (x, y) => effects.play("plasma", x, y),
  iceShatter: (x, y, aim) => effects.play("iceShatter", x, y, { aim }),
  parry: (x, y) => effects.play("parry", x, y),
  chestOpen: (x, y, tier) => effects.play(CHEST_FX[tier] ?? "chestWood", x, y),
  // ---------------- bản 3.0 ----------------
  /** Thiên thạch rơi: `lead` = còn bao nhiêu giây nữa thì chạm đất */
  meteor: (x, y, lead = 0.55, scale = 0.62) => effects.play("meteor", x, y, { time: Math.max(0, METEOR_IMPACT - lead), scale }),
  holyPillar: (x, y, scale = 0.7) => effects.play("holyPillar", x, y, { scale }),
  healRing: (x, y, scale = 0.45) => effects.play("healRing", x, y, { scale }),
  hammer: (x, y, aim) => effects.play("hammer", x, y, { aim, scale: 0.5 }),
  scythe: (x, y, aim, range = 56) => effects.play("scythe", x + Math.cos(aim) * range * 0.25, y + 10, { aim, scale: range / 70 }),
  spinSlash: (x, y, scale = 0.45) => effects.play("spinSlash", x, y, { scale }),
  darkExplosion: (x, y, scale = 0.35) => effects.play("darkExplosion", x, y, { scale }),
  crit: (x, y, aim) => effects.play("crit", x, y, { aim, scale: 0.4 }),
  slam: (x, y, scale = 0.6) => effects.play("slam", x, y, { scale }),
  acidSplash: (x, y, scale = 0.45) => effects.play("acidSplash", x, y, { scale }),
  portal: (x, y, scale = 0.5) => effects.play("portal", x, y, { scale }),
  grasp: (x, y) => effects.play("grasp", x, y + 4, { scale: 0.42 }),
  levelUp: (x, y) => effects.play("levelUp", x, y, { scale: 0.42 }),
  critText: (x, y, amount) => effects.text(`-${fmtNum(amount)}!`, x, y, "crit", 1.5),   // CHÍ MẠNG: số to vàng/đỏ có "!"
  healText: (x, y, amount) => effects.text(`+${fmtNum(amount)}`, x, y, "heal"),
};

/** Màu hạt nhỏ theo loại */
const PARTICLE_COLORS = { soul: "#45f0b0", poison: "#a6f06a", leaf: "#56a83a", wood: "#a8743a", glass: "#7cc8ff", void: "#c48cff" };

// =====================================================================================
// 4. ÂM THANH (+ nút Bật/Tắt tiếng)
// =====================================================================================
class SoundManager {
  constructor(sounds) {
    this.sounds = sounds;
    this.ctx = null;
    this.music = null; this.musicName = ""; this.wantMusic = "";
    this.muted = loadPref("pixelArena.muted", "0") === "1";
    this.lastPlay = {};  // chống phát 1 tiếng quá dày đặc trong cùng 1 frame
  }
  unlock() {
    if (!this.ctx) { const AC = window.AudioContext || window.webkitAudioContext; if (AC) this.ctx = new AC(); }
    if (this.ctx && this.ctx.state === "suspended") this.ctx.resume();
    if (this.wantMusic && !this.music) this.setMusic(this.wantMusic);
  }
  setMusic(name) {
    this.wantMusic = name;
    if (this.musicName === name && this.music) return;
    if (this.music) { this.music.pause(); this.music.currentTime = 0; }
    this.music = null; this.musicName = name;
    const src = this.sounds[name];
    if (!src) return;
    this.music = src; this.music.loop = true; this.music.volume = 0.4; this.music.muted = this.muted;
    this.music.play().catch(() => { this.music = null; this.musicName = ""; });
  }
  toggleMute() {
    this.muted = !this.muted;
    savePref("pixelArena.muted", this.muted ? "1" : "0");
    if (this.music) this.music.muted = this.muted;
    return this.muted;
  }
  play(name, volume = 0.5) {
    if (this.muted) return;
    const now = performance.now();
    if (now - (this.lastPlay[name] ?? 0) < ({ flame: 110, shoot: 45, hit: 40, enemyDie: 45, crit: 60, explosion: 60, shuriken: 50 }[name] ?? 30)) return;
    this.lastPlay[name] = now;
    const s = this.sounds[name];
    if (s) { const a = s.cloneNode(); a.volume = volume; a.play().catch(() => {}); return; }
    this.synth(name, volume);
  }
  // Tiếng 8-bit thay thế — có thể xóa khi đã chèn đủ file âm thanh
  synth(name, volume) {
    if (!this.ctx) return;
    const presets = {
      shoot:       { type: "square",   f0: 880,  f1: 220,  dur: 0.07, vol: 0.12 },
      punch:       { type: "sawtooth", f0: 260,  f1: 70,   dur: 0.09, vol: 0.16 },
      magicShoot:  { type: "sine",     f0: 520,  f1: 1040, dur: 0.12, vol: 0.14 },
      shotgun:     { type: "sawtooth", f0: 300,  f1: 40,   dur: 0.22, vol: 0.24, noise: true },
      laser:       { type: "sawtooth", f0: 1800, f1: 300,  dur: 0.16, vol: 0.12 },
      grenadeShoot:{ type: "square",   f0: 180,  f1: 420,  dur: 0.14, vol: 0.14 },
      sword:       { type: "triangle", f0: 1400, f1: 400,  dur: 0.12, vol: 0.14 },
      flame:       { type: "sawtooth", f0: 90,   f1: 60,   dur: 0.14, vol: 0.10, noise: true },
      zap:         { type: "square",   f0: 2400, f1: 200,  dur: 0.16, vol: 0.12, noise: true },
      catch:       { type: "triangle", f0: 600,  f1: 900,  dur: 0.05, vol: 0.08 },
      hit:         { type: "square",   f0: 220,  f1: 90,   dur: 0.06, vol: 0.15 },
      enemyDie:    { type: "triangle", f0: 520,  f1: 60,   dur: 0.25, vol: 0.22 },
      playerHurt:  { type: "sawtooth", f0: 160,  f1: 50,   dur: 0.30, vol: 0.20 },
      armorHit:    { type: "square",   f0: 700,  f1: 320,  dur: 0.08, vol: 0.12 },
      gameOver:    { type: "triangle", f0: 400,  f1: 40,   dur: 1.00, vol: 0.30 },
      explosion:   { type: "sawtooth", f0: 120,  f1: 30,   dur: 0.50, vol: 0.30, noise: true },
      deflect:     { type: "square",   f0: 2200, f1: 1600, dur: 0.06, vol: 0.10 },
      shieldBlock: { type: "square",   f0: 900,  f1: 600,  dur: 0.05, vol: 0.10 },
      arrow:       { type: "triangle", f0: 900,  f1: 1500, dur: 0.08, vol: 0.10 },
      batArm:      { type: "square",   f0: 1200, f1: 1250, dur: 0.30, vol: 0.08 },
      iceBreak:    { type: "triangle", f0: 2400, f1: 600,  dur: 0.25, vol: 0.16, noise: true },
      bossWarn:    { type: "sawtooth", f0: 90,   f1: 180,  dur: 0.90, vol: 0.25 },
      iceShot:     { type: "triangle", f0: 1900, f1: 950,  dur: 0.08, vol: 0.10 },
      freeze:      { type: "sine",     f0: 2600, f1: 1300, dur: 0.18, vol: 0.10, noise: true },
      shyCast:     { type: "sine",     f0: 520,  f1: 1500, dur: 0.55, vol: 0.18 },
      thunder:     { type: "sawtooth", f0: 170,  f1: 40,   dur: 0.35, vol: 0.20, noise: true },
      bossShoot:   { type: "sine",     f0: 300,  f1: 700,  dur: 0.20, vol: 0.18 },
      bossCharge:  { type: "sawtooth", f0: 80,   f1: 260,  dur: 0.60, vol: 0.20 },
      skillRage:   { type: "sawtooth", f0: 110,  f1: 520,  dur: 0.40, vol: 0.18 },
      skillDash:   { type: "square",   f0: 1200, f1: 180,  dur: 0.18, vol: 0.12 },
      skillNova:   { type: "triangle", f0: 220,  f1: 1400, dur: 0.35, vol: 0.22 },
      skillDenied: { type: "square",   f0: 130,  f1: 110,  dur: 0.08, vol: 0.10 },
      roll:        { type: "triangle", f0: 700,  f1: 220,  dur: 0.14, vol: 0.10 },
      chestSpawn:  { type: "sine",     f0: 660,  f1: 1320, dur: 0.40, vol: 0.14 },
      chestOpen:   { type: "triangle", f0: 520,  f1: 1560, dur: 0.35, vol: 0.20 },
      pickup:      { type: "square",   f0: 880,  f1: 1760, dur: 0.12, vol: 0.12 },
      expPickup:   { type: "sine",     f0: 1400, f1: 1800, dur: 0.04, vol: 0.05 },
      levelUp:     { type: "triangle", f0: 440,  f1: 1760, dur: 0.50, vol: 0.22 },
      swap:        { type: "square",   f0: 500,  f1: 700,  dur: 0.05, vol: 0.08 },
      uiSelect:    { type: "square",   f0: 660,  f1: 990,  dur: 0.05, vol: 0.08 },
      uiStart:     { type: "triangle", f0: 330,  f1: 1320, dur: 0.30, vol: 0.20 },
      // --- bản 3.0 ---
      bossSlam:    { type: "sawtooth", f0: 140,  f1: 30,   dur: 0.45, vol: 0.28, noise: true },
      poison:      { type: "sine",     f0: 300,  f1: 120,  dur: 0.14, vol: 0.12, noise: true },
      disc:        { type: "triangle", f0: 1600, f1: 900,  dur: 0.10, vol: 0.10 },
      scythe:      { type: "sawtooth", f0: 520,  f1: 160,  dur: 0.18, vol: 0.12 },
      sniper:      { type: "square",   f0: 1400, f1: 60,   dur: 0.25, vol: 0.20, noise: true },
      rocket:      { type: "sawtooth", f0: 220,  f1: 90,   dur: 0.30, vol: 0.16, noise: true },
      meteorCast:  { type: "sine",     f0: 200,  f1: 600,  dur: 0.25, vol: 0.14 },
      meteor:      { type: "sawtooth", f0: 160,  f1: 25,   dur: 0.60, vol: 0.30, noise: true },
      hammer:      { type: "square",   f0: 180,  f1: 50,   dur: 0.16, vol: 0.18, noise: true },
      bow:         { type: "triangle", f0: 700,  f1: 1300, dur: 0.07, vol: 0.10 },
      soul:        { type: "sine",     f0: 700,  f1: 350,  dur: 0.12, vol: 0.10 },
      shuriken:    { type: "triangle", f0: 2000, f1: 1200, dur: 0.05, vol: 0.07 },
      crit:        { type: "square",   f0: 1800, f1: 2600, dur: 0.07, vol: 0.10 },
      holy:        { type: "triangle", f0: 440,  f1: 1760, dur: 0.70, vol: 0.22 },
      arrowRain:   { type: "triangle", f0: 1200, f1: 400,  dur: 0.40, vol: 0.14, noise: true },
      summon:      { type: "sine",     f0: 180,  f1: 520,  dur: 0.50, vol: 0.18 },
      blink:       { type: "square",   f0: 1600, f1: 300,  dur: 0.14, vol: 0.12 },
      heal:        { type: "sine",     f0: 660,  f1: 1320, dur: 0.30, vol: 0.14 },
      revive:      { type: "triangle", f0: 220,  f1: 1760, dur: 1.00, vol: 0.28 },
      upgrade:     { type: "square",   f0: 660,  f1: 1980, dur: 0.30, vol: 0.16 },
      waveStart:   { type: "sawtooth", f0: 110,  f1: 330,  dur: 0.60, vol: 0.18 },
      combo:       { type: "square",   f0: 880,  f1: 1760, dur: 0.15, vol: 0.10 },
      shrine:      { type: "triangle", f0: 523,  f1: 2093, dur: 0.60, vol: 0.20 },
      event:       { type: "sawtooth", f0: 300,  f1: 150,  dur: 0.50, vol: 0.16 },
      grab:        { type: "sawtooth", f0: 90,   f1: 60,   dur: 0.35, vol: 0.18, noise: true },
      // --- bản 5.0: Nhảy Dù Rút Quân ---
      zombieHowl:  { type: "sawtooth", f0: 140,  f1: 420,  dur: 0.70, vol: 0.20, noise: true },
      zombieGroan: { type: "sawtooth", f0: 95,   f1: 70,   dur: 0.45, vol: 0.12 },
      planeEngine: { type: "sawtooth", f0: 70,   f1: 64,   dur: 1.20, vol: 0.16, noise: true },
      heliRotor:   { type: "square",   f0: 48,   f1: 44,   dur: 0.30, vol: 0.14, noise: true },
      flare:       { type: "sawtooth", f0: 900,  f1: 300,  dur: 0.60, vol: 0.16, noise: true },
      missionDone: { type: "triangle", f0: 523,  f1: 2093, dur: 0.80, vol: 0.24 },
      capture:     { type: "square",   f0: 660,  f1: 880,  dur: 0.06, vol: 0.06 },
      reload:      { type: "square",   f0: 420,  f1: 900,  dur: 0.10, vol: 0.10 },
      gunEmpty:    { type: "square",   f0: 1300, f1: 1200, dur: 0.04, vol: 0.08 },
      pistol:      { type: "square",   f0: 760,  f1: 160,  dur: 0.08, vol: 0.14, noise: true },
      rifle:       { type: "sawtooth", f0: 520,  f1: 90,   dur: 0.10, vol: 0.16, noise: true },
      heavy:       { type: "sawtooth", f0: 260,  f1: 40,   dur: 0.22, vol: 0.22, noise: true },
      energyGun:   { type: "sine",     f0: 1600, f1: 500,  dur: 0.12, vol: 0.12 },
      parachute:   { type: "triangle", f0: 300,  f1: 180,  dur: 0.35, vol: 0.14, noise: true },
      land:        { type: "sawtooth", f0: 160,  f1: 30,   dur: 0.45, vol: 0.26, noise: true },
      search:      { type: "square",   f0: 300,  f1: 520,  dur: 0.12, vol: 0.08 },
      useItem:     { type: "triangle", f0: 600,  f1: 1400, dur: 0.20, vol: 0.14 },
    };
    const p = presets[name];
    if (!p) return;
    const t = this.ctx.currentTime;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(p.vol * volume * 2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + p.dur);
    gain.connect(this.ctx.destination);
    const osc = this.ctx.createOscillator();
    osc.type = p.type;
    osc.frequency.setValueAtTime(p.f0, t);
    osc.frequency.exponentialRampToValueAtTime(p.f1, t + p.dur);
    osc.connect(gain); osc.start(t); osc.stop(t + p.dur);
    if (p.noise) {   // thêm tiếng rè cho nổ / shotgun
      const len = Math.floor(this.ctx.sampleRate * p.dur), buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource(); src.buffer = buf;
      const ng = this.ctx.createGain(); ng.gain.value = p.vol * volume * 1.6;
      src.connect(ng).connect(this.ctx.destination); src.start(t);
    }
  }
}

function loadPref(key, def) { try { return localStorage.getItem(key) ?? def; } catch { return def; } }
function savePref(key, val) { try { localStorage.setItem(key, val); } catch { /* bỏ qua */ } }
function parseJSON(str, def = {}) { try { const v = JSON.parse(str); return v && typeof v === "object" ? v : def; } catch { return def; } }
/** 75.3 -> "1:15" */
function fmtTime(t) { const s = Math.floor(t); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; }

// =====================================================================================
// 5. INPUT — chuột lưu TỌA ĐỘ MÀN HÌNH; ngắm bắn dùng worldMouse() = chuột + camera
// =====================================================================================
const stage = document.getElementById("stage");
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;

const input = {
  keys: new Set(),
  mouse: { x: W / 2, y: H / 2, left: false },   // tọa độ MÀN HÌNH (0..W, 0..H)
  pressed: new Set(),
  wheel: 0,
  joy: { x: 0, y: 0 },   // cần di chuyển cảm ứng
  touchAim: null,         // góc ngắm cảm ứng (null = không ngắm)
};

window.addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase();
  if (!input.keys.has(k)) input.pressed.add(k);
  input.keys.add(k);
  if (game?.state === GAME_STATE.PLAYING && (k === " " || k.startsWith("arrow") || k === "tab")) e.preventDefault();
});
window.addEventListener("keyup", (e) => input.keys.delete(e.key.toLowerCase()));
window.addEventListener("blur", () => { input.keys.clear(); input.mouse.left = false; });

function updateMouse(e) {
  const r = canvas.getBoundingClientRect();
  input.mouse.x = ((e.clientX - r.left) / r.width) * W;
  input.mouse.y = ((e.clientY - r.top) / r.height) * H;
}
canvas.addEventListener("mousemove", updateMouse);
canvas.addEventListener("mousedown", (e) => {
  updateMouse(e);
  if (e.button === 0) { input.mouse.left = true; input.pressed.add("mouse0"); }
  if (e.button === 2) input.pressed.add("mouse2");
});
window.addEventListener("mouseup", (e) => { if (e.button === 0) input.mouse.left = false; });
// Lăn chuột = đổi vũ khí
canvas.addEventListener("wheel", (e) => {
  if (game?.state !== GAME_STATE.PLAYING) return;
  e.preventDefault();
  input.wheel += Math.sign(e.deltaY);
}, { passive: false });
stage.addEventListener("contextmenu", (e) => e.preventDefault());

/**
 * >>> CHUYỂN TỌA ĐỘ CHUỘT (màn hình) SANG TỌA ĐỘ THẾ GIỚI <<<
 *     worldMouseX = mouseX + camera.x ,  worldMouseY = mouseY + camera.y
 * Mọi phép ngắm (đạn, laser, kỹ năng lướt) đều phải dùng hàm này.
 */
function worldMouse() {
  const cam = game?.camera;
  return cam ? { x: input.mouse.x + cam.x, y: input.mouse.y + cam.y } : { x: input.mouse.x, y: input.mouse.y };
}

/** Điểm đang ngắm (thế giới): chuột trên máy tính, hoặc theo hướng ngắm của nhân vật trên điện thoại */
function aimPoint(p) {
  if (!TOUCH) return worldMouse();
  return { x: p.cx + Math.cos(p.aim) * 120, y: p.cy + Math.sin(p.aim) * 120 };
}

// ---------- Điện thoại: chặn cuộn/zoom, vừa khít màn hình ngang ----------
function enableTouchMode() {
  if (TOUCH && document.body.classList.contains("is-touch")) return;
  TOUCH = true;
  document.body.classList.add("is-touch");
  fitCanvas();
}
window.addEventListener("touchstart", () => enableTouchMode(), { once: true, passive: true });
const isPortrait = () => window.innerHeight > window.innerWidth;

/** Toàn màn hình + khóa xoay ngang (Android Chrome hỗ trợ; iPhone bỏ qua an toàn) */
function goFullscreenLandscape() {
  if (!TOUCH) return;
  const el = document.documentElement;
  const req = el.requestFullscreen ?? el.webkitRequestFullscreen;
  if (!document.fullscreenElement && req) {
    Promise.resolve(req.call(el, { navigationUI: "hide" }))
      .then(() => screen.orientation?.lock?.("landscape"))
      .catch(() => {});
  }
}

function fitCanvas() {
  const vw = window.visualViewport?.width ?? window.innerWidth, vh = window.visualViewport?.height ?? window.innerHeight;
  // Máy tính: phóng to theo bội số nguyên cho pixel sắc nét. Điện thoại: phóng vừa khít toàn màn hình.
  const scale = TOUCH
    ? Math.max(0.5, Math.min(vw / W, vh / H))
    : Math.max(1, Math.floor(Math.min((vw - 16) / W, (vh - 44) / H)));
  canvas.style.width = `${W * scale}px`;
  canvas.style.height = `${H * scale}px`;
  stage.style.fontSize = `${(W * scale) / 60}px`;
}
window.addEventListener("resize", fitCanvas);
window.addEventListener("orientationchange", () => setTimeout(fitCanvas, 250));
document.addEventListener("fullscreenchange", () => setTimeout(fitCanvas, 60));
// Điện thoại: lần chạm đầu (ngay ở SẢNH, không đợi vào trận) -> bật toàn màn hình + khóa ngang để game phủ kín màn hình.
// Dùng "touchend" vì trình duyệt chỉ cho mở toàn màn hình trong sự kiện kết thúc chạm. Lỡ thoát ra thì chạm lại là vào lại.
window.addEventListener("touchend", () => { enableTouchMode(); goFullscreenLandscape(); }, { passive: true });
window.visualViewport?.addEventListener("resize", fitCanvas);
if (TOUCH) document.body.classList.add("is-touch");
fitCanvas();

// =====================================================================================
// 6. ICON KỸ NĂNG (pixel) — dùng khi chưa chèn ảnh icon
// =====================================================================================
const SKILL_ICON_BITMAPS = {
  panic: [".#..*..#..", "..#.*.#...", "#..***..#.", ".#*#o#*#..", "**#ooo#***", ".#*#o#*#..", "#..***..#.", "..#.*.#...", ".#..*..#..", ".........."],
  rage: ["....#.....", "...##...#.", "..###..##.", "..####.##.", ".#####o##.", ".##o##oo#.", "##oo#ooo##", "#oo*oo*oo#", ".#o****o#.", "..######.."],
  dash: ["#....#....", "##...##...", "o##..o##..", ".o##..o##.", "..*##..*##", "..*##..*##", ".o##..o##.", "o##..o##..", "##...##...", "#....#...."],
  nova: ["....**....", ".#..oo..#.", "..#.oo.#..", "...oooo...", "*oooo*ooo*", "*ooo*oooo*", "...oooo...", "..#.oo.#..", ".#..oo..#.", "....**...."],
  shy: ["..######..", ".#oooooo#.", "#oooooooo#", "#o*#oo#*o#", "#oooooooo#", "#pp.oo.pp#", "#pp.oo.pp#", "#ooo##ooo#", ".#oooooo#.", "..######.."],   // mặt đỏ ửng
  holy: ["....**....", "....oo....", "..######..", ".#oooooo#.", "#oo*##*oo#", "#ooo##ooo#", "#oo####oo#", ".#oo##oo#.", "..#oooo#..", "...####..."],   // khiên thánh
  arrowRain: ["#..#..#..#", "#..#..#..#", "#..#..#..#", "o..o..o..o", "*..*..*..*", "..........", "#..#..#...", "#..#..#...", "o..o..o...", "*..*..*..."],
  summon: ["...####...", "..#oooo#..", ".#o*oo*o#.", ".#oooooo#.", ".#o#oo#o#.", "..#oooo#..", "..#.##.#..", ".#o#..#o#.", "#oo#..#oo#", ".##....##."],   // đầu lâu
  blink: ["#.........", ".#........", "..#oo.....", "...#oo....", "....*##...", "....##*...", "....oo#...", ".....oo#..", "........#.", ".........#"],   // vệt chém chéo
};
const iconCache = new Map();
function getSkillIcon(char, images) {
  if (iconCache.has(char.id)) return iconCache.get(char.id);
  const c = document.createElement("canvas");
  c.width = c.height = 20;
  const g = c.getContext("2d");
  g.imageSmoothingEnabled = false;
  const img = images[`${char.id}.skill`];
  if (img) g.drawImage(img, 0, 0, 20, 20);   // >>> ICON KỸ NĂNG CỦA BẠN
  else paintBitmap(g, SKILL_ICON_BITMAPS[char.skill.type] ?? SKILL_ICON_BITMAPS.nova, char.skill.color, 2);
  iconCache.set(char.id, c);
  return c;
}
/** Vẽ bitmap 10x10 ("#" màu, "o" sáng, "*" trắng) với cỡ ô `k` */
function paintBitmap(g, rows, color, k) {
  const pal = { "#": color, o: lighten(color, 0.4), "*": "#ffffff", p: "#ff7aa8" };
  rows.forEach((r, y) => [...r].forEach((ch, x) => { if (pal[ch]) { g.fillStyle = pal[ch]; g.fillRect(x * k, y * k, k, k); } }));
}

// =====================================================================================
// 7. KỸ NĂNG CHỦ ĐỘNG (Space / chuột phải) — mỗi `skill.type` trong characters.js ứng với 1 hàm
// =====================================================================================
const SKILL_HANDLERS = {
  /** CUỒNG NỘ: tốc độ tấn công x2 trong `duration` giây */
  rage(p, game, s) {
    p.rageTime = s.duration;
    p.castTime = ANIM_CFG.castTime;
    p.aura?.stop();
    p.aura = new LiveFx(fxRage, { flip: p.facingLeft, actor: p.maskActor, seed: rndSeed() });
    game.sound.play("skillRage", 0.6);
    game.shake(0.2, 2);
  },
  /** LƯỚT XUNG KÍCH: lao về phía con trỏ (tọa độ thế giới), bất tử khi lướt, hất tung kẻ địch */
  dash(p, game, s) {
    const m = aimPoint(p);
    const a = Math.atan2(m.y - p.cy, m.x - p.cx);
    p.dash = { t: 0, dur: s.dashTime, vx: Math.cos(a) * s.dashSpeed, vy: Math.sin(a) * s.dashSpeed, angle: a, hit: new Set(), trail: 0 };
    p.kx = p.ky = 0;
    game.sound.play("skillDash", 0.6);
    game.shake(0.12, 2);
  },
  /**
   * NGẠI NGÙNG (Bạch Ngưng Băng): ôm mặt ngại `duration` giây (bất tử, đứng yên). Trong lúc đó:
   *   0.25s — sóng băng đóng băng mọi quái trên màn hình, xóa đạn của quái
   *   0.5s..hết — sét đánh xuống từng con (gần trước, xa sau): quái thường chết ngay,
   *               Tinh Anh mất `eliteDamage`, Boss mất `bossDamage` máu tối đa
   */
  shy(p, game, s) {
    const cam = game.camera, targets = [];
    for (const e of game.enemies) if (!e.dead && cam.inView(e.x, e.cy, 12)) targets.push({ e, serial: e.serial, d: (e.x - p.x) ** 2 + (e.y - p.y) ** 2 });
    targets.sort((a, b) => a.d - b.d);
    p.shy = { t: 0, dur: s.duration, targets, next: 0, frozen: false, skill: s };
    p.roll = null; p.vx = p.vy = p.kx = p.ky = 0;
    p.castTime = s.duration;
    game.sound.play("shyCast", 0.6);
    p.nextSkin(game);                 // mỗi lần dùng tuyệt chiêu: gốc -> hoodie -> gốc ...
    game.banner("Ư... ngại quá đi mất!", "#ff8fc0");
  },
  /** HOẢNG LOẠN XẢ ĐẠN (Minh Huy): `duration` giây xả `count` viên theo hướng ngẫu nhiên, hất lùi quái sát bên, đi chậm */
  panic(p, game, s) {
    p.panic = { t: 0, dur: s.duration, acc: 0, skill: s };
    p.castTime = ANIM_CFG.castTime;
    for (const e of game.enemies) {
      if (e.dead || (e.x - p.x) ** 2 + (e.y - p.y) ** 2 > 42 * 42) continue;
      game.damageEnemy(e, 0.5, Math.atan2(e.cy - p.cy, e.cx - p.cx), 200, { quiet: true, noCrit: true });
    }
    game.sound.play("skillRage", 0.5);
    game.shake(0.15, 2);
    game.banner("Á Á Á! ĐỪNG LẠI GẦN!!", "#ffd27a");
  },
  /** BÃO CẦU NĂNG LƯỢNG: bắn `count` viên tỏa đều 360 độ */
  nova(p, game, s) {
    const n = s.count ?? 12;
    p.castTime = ANIM_CFG.castTime;
    for (let i = 0; i < n; i++) {
      const a = p.aim + (i / n) * TAU;
      game.bullets.push(Bullet.obtain(p.cx + Math.cos(a) * 6, p.cy + Math.sin(a) * 6, a, {
        speed: s.bulletSpeed, damage: s.damage * p.mods.damageMul, radius: 4, color: s.color, style: "orb", bounces: p.mods.bounce, pierce: p.mods.pierce,
      }));
    }
    FX.nova(p.x, p.y);
    game.sound.play("skillNova", 0.6);
    game.shake(0.2, 3);
  },
  /** KHIÊN THÁNH QUANG (Thánh Kỵ Sĩ): bất tử `duration` giây, hồi máu, hất văng + sát thương quanh mình, xóa đạn địch */
  holy(p, game, s) {
    p.holyTime = s.duration;
    p.castTime = ANIM_CFG.castTime;
    FX.holyPillar(p.x, p.y + 2);
    game.healPlayer(s.heal);
    game.screenFlash("#fff0a0", 0.3);
    game.shake(0.3, 4);
    game.shocks.push({ x: p.x, y: p.cy, r: s.radius, life: 0.45, max: 0.45, color: s.color });
    for (const e of game.enemiesNear(p.cx, p.cy, s.radius)) {
      if (e.dead) continue;
      const rr = s.radius + e.radius;
      if ((e.cx - p.cx) ** 2 + (e.cy - p.cy) ** 2 > rr * rr) continue;
      game.damageEnemy(e, s.damage * p.mods.damageMul, Math.atan2(e.cy - p.cy, e.cx - p.cx), 360, { pierce: true });
    }
    for (const b of game.enemyBullets) if ((b.x - p.cx) ** 2 + (b.y - p.cy) ** 2 < (s.radius + 30) ** 2) { b.dead = true; FX.parry(b.x, b.y); }
    game.sound.play("holy", 0.7);
  },
  /** MƯA TÊN (Thợ Săn): trút `arrows` mũi tên xuống vùng đang ngắm trong `duration` giây */
  arrowRain(p, game, s) {
    const m = aimPoint(p), dx = m.x - p.x, dy = m.y - p.y, d = Math.hypot(dx, dy) || 1, r = Math.min(d, s.range);
    const x = p.x + (dx / d) * r, y = p.y + (dy / d) * r;
    game.rains.push({ x, y, r: s.radius, t: 0, dur: s.duration, left: s.arrows, every: s.duration / s.arrows, acc: 0, dmg: s.damage * p.mods.damageMul, falling: [] });
    p.castTime = ANIM_CFG.castTime;
    game.sound.play("arrowRain", 0.6);
  },
  /** TRIỆU HỒI VONG LINH (Tử Linh Sư): `count` vong linh bay quanh, thấy quái thì lao vào nổ */
  summon(p, game, s) {
    for (let i = 0; i < s.count; i++) {
      const a = (i / s.count) * TAU;
      game.minions.push({ x: p.x + Math.cos(a) * 20, y: p.cy + Math.sin(a) * 14, a, t: 0, life: s.life, target: null, serial: 0, dmg: s.damage * p.mods.damageMul, r: s.radius, delay: 0.4 + i * 0.15, dead: false, ph: Math.random() * 10 });
    }
    FX.portal(p.x, p.y + 4, 0.45);
    p.castTime = ANIM_CFG.castTime;
    game.sound.play("summon", 0.7);
  },
  /** ẢNH SÁT (Bóng Đêm): dịch chuyển tức thời theo hướng ngắm, chém mọi quái trên đường */
  blink(p, game, s) {
    const m = aimPoint(p), a = Math.atan2(m.y - p.cy, m.x - p.cx), want = Math.min(s.range, Math.hypot(m.x - p.x, m.y - p.y) + 20);
    const sx = p.x, sy = p.y;
    let ex = sx, ey = sy;
    for (let d = 6; d <= want; d += 6) {          // đi từng bước 6px, dừng trước tường / hố
      const nx = sx + Math.cos(a) * d, ny = sy + Math.sin(a) * d;
      if (!game.world.walkable(nx, ny, PLAYER_CFG.footR)) break;
      ex = nx; ey = ny;
    }
    FX.death(p.cx, p.cy, 0.55);
    for (let k = 0; k < 5; k++) { const u = k / 5; p.ghosts.push({ x: sx + (ex - sx) * u, y: sy + (ey - sy) * u, flip: Math.cos(a) < 0, life: 0.3 + u * 0.15, max: 0.45, color: s.color, row: p.anim?.row ?? 0, frame: p.anim?.col ?? 0 }); }
    const hit = new Set();
    const ax = sx, ay = sy - 17, bx = ex, by = ey - 17, w = s.width;
    for (const e of game.enemiesNear((ax + bx) / 2, (ay + by) / 2, s.range / 2 + w + 10)) {
      if (e.dead || hit.has(e)) continue;
      const r = w + e.radius;
      if (pointSegDist2(e.cx, e.cy, ax, ay, bx, by) > r * r) continue;
      hit.add(e);
      game.damageEnemy(e, s.damage * p.mods.damageMul, a, 160, { pierce: true, critBonus: 0.5 });
    }
    p.x = ex; p.y = ey; p.vx = p.vy = p.kx = p.ky = 0;
    p.rollInv = Math.max(p.rollInv, 0.4);
    game.beams.push({ x0: ax, y0: ay, x1: bx, y1: by, life: 0.2, max: 0.2, color: s.color, width: 2 });
    FX.spinSlash(p.x, p.y - 6);
    game.sound.play("blink", 0.6);
    game.shake(0.12, 2);
    if (hit.size) game.hitStop(0.05);
  },
};

// =====================================================================================
// 8. NGƯỜI CHƠI
// =====================================================================================
class Player {
  /** boost: nâng cấp vĩnh viễn từ Sảnh chờ { hp, armor, cd, weapon, secondary } (xem src/progress.js) */
  constructor(char, spawn, boost = {}) {
    this.char = char;
    this.skill = char.skill;
    this.actor = null;                    // dáng đứng (cho hào quang Cuồng Nộ ôm theo thân) — tạo khi cần
    this.x = spawn.x; this.y = spawn.y;   // CHÂN nhân vật (tọa độ thế giới)
    this.radius = PLAYER_CFG.radius;
    this.vx = 0; this.vy = 0;             // vận tốc (Tàn Tích Băng Giá có quán tính)

    this.maxHp = char.stats.hp + (boost.hp ?? 0);          this.hp = this.maxHp;
    this.maxArmor = char.stats.armor + (boost.armor ?? 0); this.armor = this.maxArmor;
    this.cdBoost = 1 - 0.08 * (boost.cd ?? 0);             // Tĩnh Tâm: -8% hồi chiêu mỗi cấp
    // --- NĂNG LƯỢNG (thanh xanh dương): vũ khí mạnh tốn năng lượng mỗi phát ---
    this.maxEnergy = char.stats.energy ?? 180; this.energy = this.maxEnergy;
    this.noEnergyT = 0;                                    // chớp thanh năng lượng khi thiếu
    this.baseSpeed = char.stats.speed;
    this.regen = { ...ARMOR_REGEN, ...(char.armorRegen ?? {}) };
    this.sinceHit = 99; this.regenTick = 0; this.armorFlash = 0;

    // --- 2 ô vũ khí (mỗi ô là 1 "bản thể" vũ khí, có cấp sao ★ riêng) ---
    this.weapons = [makeWeapon(char.weapon, 1 + (boost.weapon ?? 0)), boost.secondary ? makeWeapon(boost.secondary) : null];
    this.slot = 0;
    this.comboStep = 2; this.lastSwing = -9;   // combo cận chiến 3 nhát
    this.charge = null;                        // đang tụ lực { t, w }

    // --- Thẻ nâng cấp (xem src/perks.js -> Mods: có trần/sàn, không cộng lũy thừa) ---
    this.mods = new Mods(PLAYER_CFG.damageMul, char);
    this.perksTaken = {};
    this.killCount = { absorb: 0, vamp: 0, soul: 0, reap: 0 };   // đếm quái hạ gục cho các nội tại / thẻ
    this.pickupRange = PLAYER_CFG.pickupRange;
    this.invulnTime = char.invuln ?? PLAYER_CFG.invuln;
    // --- Hiệu ứng mới ---
    this.holyTime = 0;     // Khiên Thánh Quang: bất tử
    this.slowT = 0;        // bị làm chậm (axit của Ếch Độc / Vua Slime)
    this.rootT = 0;        // bị bàn tay ma giữ chân
    this.blessing = null;  // bùa Đền Thờ { id, t, max }
    this.phantomHit = new Set();   // thẻ Lướt Ảo Ảnh: quái đã bị lướt qua trong lần lướt này

    this.aim = 0; this.fireTimer = 0; this.hurtTimer = 0; this.walkTime = 0;
    this.kx = 0; this.ky = 0;

    // --- HOẠT ẢNH: spritesheet Idle / Run / Skill + bộ điều khiển theo deltaTime ---
    this.sprite = ACTOR_SPRITES.get(char.id) ?? null;
    this.skin = 0;                        // 0 = skin gốc, 1.. = skin trong characters.js -> skins
    this.anim = this.sprite?.controller() ?? null;
    this.moveSpeed = 0;                   // tốc độ thực tế (px/giây) đo từ vị trí -> chọn Idle / Run
    this.moveDir = 1;                     // hướng chạy ngang (bụi bay ngược lại)
    this.castTime = 0;                    // đang giữ dáng tung kỹ năng
    this.shy = null;                      // đang Ngại Ngùng (tuyệt chiêu Bạch Ngưng Băng)
    // --- VŨ KHÍ TRÊN TAY ---
    this.handX = this.x; this.handY = this.y - 19;   // vị trí bàn tay (tọa độ thế giới), cập nhật mỗi frame
    this.recoil = 0;                      // px giật lùi theo nòng (âm = đâm tới trước)
    this.recoilRot = 0;                   // rad nòng hếch lên khi bắn
    this.swing = null;                    // { t, dur, from, to } khi vung vũ khí cận chiến
    this.swingDir = 1;                    // đổi chiều mỗi nhát -> combo qua lại

    // --- Kỹ năng riêng ---
    this.skillCd = 0; this.rageTime = 0; this.aura = null; this.dash = null;
    // --- Lướt nhanh (Shift) ---
    this.roll = null; this.rollCd = 0; this.rollInv = 0;
    this.ghosts = [];
    // --- Hiệu ứng tạm thời ---
    this.spin = 0;         // Súng Máy Gatling: độ quay nòng 0..1
    this.frenzy = 0;       // Thuốc Cuồng Nộ
    this.acidTick = 0;     // thời gian đứng trong axit
    this.inAcid = false;
    this.updateHand();
  }

  get weapon() { return this.weapons[this.slot]; }
  get cx() { return this.x; }
  get cy() { return this.y - 17; }
  get facingLeft() { return Math.cos(this.aim) < 0; }
  get invulnerable() { return this.hurtTimer > 0 || !!this.dash || this.rollInv > 0 || !!this.shy || this.holyTime > 0; }
  get skillActive() { return this.rageTime > 0 || !!this.dash || !!this.shy || this.holyTime > 0 || !!this.panic; }
  /** Hồi chiêu Lướt (Shift): nội tại nhân vật + thẻ Lướt Ảo Ảnh */
  get rollCdMax() { return ROLL.cooldown * (1 - (this.char.rollCut ?? 0)) * (1 - this.mods.dashCutC); }
  /** Hồi chiêu kỹ năng hiện tại (đã tính thẻ Bậc Thầy Kỹ Năng) */
  get skillCdMax() { return this.skill.cooldown * this.mods.cdMul * this.cdBoost; }
  /** Mức tụ lực hiện tại 0..1 */
  get chargeK() { const c = this.charge; return c ? clamp(c.t / c.w.charge.time, 0, 1) : 0; }

  /** Đếm quái gục để kích hoạt thẻ / nội tại (gọi từ Game.killEnemy) */
  onKill(game) {
    const K = this.killCount, m = this.mods;
    if (m.absorb > 0 && ++K.absorb >= ABSORB_EVERY[m.absorbLv]) {      // Hấp Thụ Năng Lượng: +1 giáp
      K.absorb = 0;
      if (this.armor < this.maxArmor) { this.armor++; this.armorFlash = 0.4; }
    }
    if (m.vamp > 0 && ++K.vamp >= VAMP_EVERY[m.vampLv]) { K.vamp = 0; game.healPlayer(1); }   // Ma Cà Rồng
    if (this.char.soulHeal && ++K.soul >= this.char.soulHeal) { K.soul = 0; game.healPlayer(1); }   // Tử Linh Sư: hút hồn
  }
  /** Lưỡi Hái: cứ `n` quái bị chém gục hồi 1 Máu */
  reap(game, n) { if (++this.killCount.reap >= n) { this.killCount.reap = 0; game.healPlayer(1); } }
  /**
   * ĐỔI SKIN: sang skin kế tiếp trong `skins` của nhân vật (hết thì quay về skin gốc).
   * Giữ nguyên hoạt ảnh đang chạy, chỉ thay spritesheet. Trả về false nếu nhân vật không có skin phụ.
   */
  nextSkin(game) {
    const n = (this.char.skins?.length ?? 0) + 1;
    if (n < 2) return false;
    this.skin = (this.skin + 1) % n;
    const key = this.skin ? `${this.char.id}#${this.skin}` : this.char.id;
    const sp = ACTOR_SPRITES.get(key);
    if (!sp) return false;
    this.sprite = sp;
    this.actor = null;
    FX.freezeBurst(this.x, this.y);   // lấp lánh băng lúc thay đồ
    game.banner(this.skin ? `Đổi trang phục: ${this.char.skins[this.skin - 1].name}` : "Trang phục gốc", "#c8f2ff");
    return true;
  }

  /** Dáng nhân vật cho hiệu ứng pixelfx ôm theo thân (lấy từ spritesheet) */
  get maskActor() { return (this.actor ??= this.sprite ? this.sprite.maskActor() : makeActor(this.char)); }
  get speed() {
    return this.baseSpeed * this.mods.speedMul * (this.frenzy > 0 ? 1.3 : 1) * (this.inAcid ? 1 - ENV.acid.slow : 1)
      * (this.slowT > 0 ? 0.6 : 1) * (this.rootT > 0 ? 0.2 : 1) * (this.panic ? 0.6 : 1);
  }
  /** Đầu nòng (tọa độ thế giới): từ bàn tay đi dọc hướng ngắm đúng bằng chiều dài vũ khí */
  get muzzle() {
    const len = muzzleLength(this.weapon) - 4 + WEAPON_CFG.grip;
    return { x: this.handX + Math.cos(this.aim) * len, y: this.handY + Math.sin(this.aim) * len };
  }

  update(dt, game) {
    const world = game.world;
    const px = this.x, py = this.y;
    this.hurtTimer -= dt;
    this.fireTimer -= dt;
    this.skillCd = Math.max(0, this.skillCd - dt);
    this.rollCd = Math.max(0, this.rollCd - dt);
    this.rollInv = Math.max(0, this.rollInv - dt);
    this.frenzy = Math.max(0, this.frenzy - dt);
    this.castTime = Math.max(0, this.castTime - dt);
    this.armorFlash = Math.max(0, this.armorFlash - dt);
    this.holyTime = Math.max(0, this.holyTime - dt);
    this.slowT = Math.max(0, this.slowT - dt);
    this.rootT = Math.max(0, this.rootT - dt);
    if (this.blessing && (this.blessing.t -= dt) <= 0) this.endBlessing(game);
    this.updateArmor(dt);
    this.energy = Math.min(this.maxEnergy, this.energy + ENERGY.regen * dt);
    for (const w of this.weapons) if (w) tickReload(w, dt, game);   // súng thật: đếm thời gian nạp đạn (cả khẩu đang cất)
    this.noEnergyT = Math.max(0, this.noEnergyT - dt);
    if (this.rageTime > 0) { this.rageTime -= dt; if (this.rageTime <= 0) { this.rageTime = 0; this.aura?.stop(); } }
    if (this.panic) {   // Hoảng Loạn Xả Đạn: rải đạn đều trong thời gian hiệu lực, hướng ngẫu nhiên
      const P = this.panic, s = P.skill, every = P.dur / s.count;
      P.t += dt; P.acc += dt;
      while (P.acc >= every && P.t <= P.dur + every) {
        P.acc -= every;
        const a = Math.random() * TAU;
        game.bullets.push(Bullet.obtain(this.cx + Math.cos(a) * 6, this.cy + Math.sin(a) * 6, a, { speed: s.bulletSpeed * (0.85 + Math.random() * 0.3), damage: s.damage * this.mods.damageMul, radius: 2, color: s.color, knock: 60 }));
        gunFlash(this.cx + Math.cos(a) * 9, this.cy + Math.sin(a) * 9, a, "small");   // lửa nòng lốp bốp theo từng viên
        if (Math.random() < 0.3) game.ejectShell(this.cx, this.cy, a);
        if (Math.random() < 0.35) game.sound.play("shoot", 0.25);
      }
      if (P.t >= P.dur) this.panic = null;
    }

    // --- Ngắm: chuột (TỌA ĐỘ THẾ GIỚI) hoặc cần ngắm cảm ứng ---
    if (TOUCH) this.aim = this.touchAim(game);
    else { const m = worldMouse(); this.aim = Math.atan2(m.y - this.cy, m.x - this.cx); }

    // --- Đổi vũ khí: Q / lăn chuột / phím 1-2 ---
    if (input.pressed.has("q") || input.wheel !== 0) this.swapWeapon(game);
    if (input.pressed.has("1") && this.slot !== 0) this.swapWeapon(game, 0);
    if (input.pressed.has("2") && this.slot !== 1 && this.weapons[1]) this.swapWeapon(game, 1);
    input.wheel = 0;

    // --- Địa hình: vũng axit ---
    this.inAcid = world.inAcid(this.x, this.y);
    if (this.inAcid) {
      this.acidTick += dt;
      if (this.acidTick >= ENV.acid.drainEvery) {
        this.acidTick -= ENV.acid.drainEvery;
        if (this.armor > 0) { this.armor--; this.armorFlash = 0.3; game.sound.play("armorHit", 0.35); FX.hit(this.cx, this.y - 2, -Math.PI / 2); }
        this.sinceHit = 0;
      }
    } else this.acidTick = 0;

    // --- Di chuyển (WASD / mũi tên / cần cảm ứng) ---
    let dx = 0, dy = 0;
    if (input.keys.has("w") || input.keys.has("arrowup")) dy -= 1;
    if (input.keys.has("s") || input.keys.has("arrowdown")) dy += 1;
    if (input.keys.has("a") || input.keys.has("arrowleft")) dx -= 1;
    if (input.keys.has("d") || input.keys.has("arrowright")) dx += 1;
    dx += input.joy.x; dy += input.joy.y;           // cần di chuyển cảm ứng (có lực nhẹ / mạnh)
    let len = Math.hypot(dx, dy);
    if (len < 0.15) { dx = dy = 0; len = 0; }
    if (len > 1) { dx /= len; dy /= len; len = 1; }

    if (input.pressed.has("shift") && !this.dash && !this.shy) this.startRoll(game, dx, dy);

    if (this.shy) this.updateShy(dt, game);
    else if (this.dash) this.updateDash(dt, game);
    else if (this.roll) this.updateRoll(dt, game);
    else {
      // Băng giá: tăng tốc chậm -> quán tính trượt khi đổi hướng
      const k = 1 - Math.exp(-world.biome.accel * dt), sp = this.speed * (this.charge ? 0.65 : 1);   // đang tụ lực: đi chậm
      this.vx += (dx * sp - this.vx) * k;
      this.vy += (dy * sp - this.vy) * k;
      world.moveBody(this, (this.vx + this.kx) * dt, (this.vy + this.ky) * dt, PLAYER_CFG.footR);
      this.walkTime = len ? this.walkTime + dt : 0;
    }
    this.kx *= Math.pow(0.001, dt); this.ky *= Math.pow(0.001, dt);

    // --- Súng máy: giữ cò thì nòng quay nhanh dần, thả ra thì chậm lại ---
    const firing = input.mouse.left && !this.dash && !this.roll && !this.shy;
    if (this.weapon.spinUp) this.spin = clamp(this.spin + (firing ? dt / this.weapon.spinUp : -dt * 1.5), 0, 1);
    else this.spin = 0;

    // --- Tấn công & kỹ năng ---
    const busy = !!(this.dash || this.roll || this.shy);
    if (this.weapon.charge) this.updateCharge(dt, game, input.mouse.left && !busy);
    else if (input.mouse.left && this.fireTimer <= 0 && !busy) this.attack(game);
    if (input.pressed.has(" ") || input.pressed.has("mouse2")) this.useSkill(game);

    // --- Hoạt ảnh + vũ khí trên tay ---
    this.updateAnimation(dt, game, this.x - px, this.y - py);
    this.updateWeaponPose(dt);

    for (const g of this.ghosts) g.life -= dt;
    sweepLife(this.ghosts);
    if (this.aura) {
      this.aura.update(dt);
      if (this.aura.done()) this.aura = null;
    }
  }

  /**
   * >>> BỘ ĐIỀU KHIỂN HOẠT ẢNH <<<
   * Đo tốc độ thật (kể cả trượt trên băng, bị đẩy lùi) rồi chọn trạng thái:
   *   Skill — đang Lướt (Shift), Lướt Xung Kích, hoặc vừa tung kỹ năng
   *   Run   — tốc độ > runAbove (về Idle khi < idleBelow: 2 ngưỡng để không nhấp nháy qua lại)
   *   Idle  — còn lại
   * Nhịp bước chân tăng theo tốc độ chạy; mỗi lần chân chạm đất tung 1 làn bụi.
   */
  updateAnimation(dt, game, mx, my) {
    if (dt > 0) this.moveSpeed = Math.sqrt(mx * mx + my * my) / dt;
    if (Math.abs(mx) > 0.05) this.moveDir = mx < 0 ? -1 : 1;
    const a = this.anim;
    if (!a) return;
    let state;
    if (this.shy) state = a.anims.shy ? "shy" : "skill";
    else if (this.dash || this.roll || this.castTime > 0) state = "skill";
    else if (this.moveSpeed > (a.state === "run" ? ANIM_CFG.idleBelow : ANIM_CFG.runAbove)) state = "run";
    else state = "idle";
    a.set(state, (state === "skill" || state === "shy") && a.state !== state);
    a.update(dt, state === "run" ? clamp(this.moveSpeed / ANIM_CFG.runRefSpeed, 0.7, 1.7) : 1);
    if (a.contact && state === "run") FX.dust(this.x - this.moveDir * 3, this.y, this.moveDir < 0);
    this.updateHand();
  }

  /** Tuyệt chiêu NGẠI NGÙNG: đếm thời gian, đóng băng cả màn hình rồi gọi sét đánh từng con */
  updateShy(dt, game) {
    const S = this.shy, sk = S.skill;
    S.t += dt;
    this.walkTime = 0;
    if (!S.frozen && S.t >= 0.25) {
      S.frozen = true;
      FX.frostNova(this.x, this.y);
      game.sound.play("freeze", 0.6);
      game.shake(0.25, 3);
      game.screenFlash("#a6ecff", 0.35);
      let shown = 0;
      for (const T of S.targets) {
        const e = T.e;
        if (e.dead || e.serial !== T.serial) continue;
        e.freeze(3);
        if (shown++ < 24) FX.freezeBurst(e.cx, e.y);
      }
      for (const b of game.enemyBullets) if (game.camera.inView(b.x, b.y, 16)) b.dead = true;   // đạn quái hóa băng rơi
    }
    const n = S.targets.length, from = 0.5, to = S.dur - 0.2;
    if (S.t >= from) {
      const due = S.t >= S.dur ? n : Math.min(n, Math.ceil(((S.t - from) / (to - from)) * n));
      while (S.next < due) this.shyStrike(game, S.targets[S.next++], sk);
    }
    if (S.t >= S.dur) {
      while (S.next < n) this.shyStrike(game, S.targets[S.next++], sk);
      this.shy = null;
      this.castTime = 0;
      this.hurtTimer = Math.max(this.hurtTimer, 0.3);
    }
  }
  shyStrike(game, T, sk) {
    const e = T.e;
    if (e.dead || e.serial !== T.serial) return;
    FX.lightning(e.x, e.y - e.z);
    FX.zap(e.cx, e.cy);
    game.sound.play("thunder", 0.5);
    game.shake(0.1, 2);
    game.screenFlash("#ffffff", 0.12);
    // quái thường: đúng bằng máu còn lại -> chết ngay; Tinh Anh / Boss: mất 1 phần máu tối đa
    const dmg = e.boss ? e.maxHp * (sk.bossDamage ?? 0.2) : e.elite ? Math.min(e.hp, e.maxHp * (sk.eliteDamage ?? 0.5)) : e.hp;
    game.damageEnemy(e, dmg, -Math.PI / 2, 0, { pierce: true, explosive: true, quiet: true });
  }

  /** Vị trí bàn tay (tọa độ thế giới) ở frame hiện tại — vũ khí gắn vào đây */
  updateHand() {
    const h = this.sprite ? this.sprite.handAt(this.anim.row, this.anim.frame) : [0, -15];
    this.handX = this.x + (this.facingLeft ? -h[0] : h[0]);
    this.handY = this.y + h[1];
  }

  /** Giật lùi lò xo + cung vung kiếm, tất cả theo deltaTime */
  updateWeaponPose(dt) {
    this.recoil *= Math.exp(-WEAPON_CFG.recoilReturn * dt);
    this.recoilRot *= Math.exp(-WEAPON_CFG.climbReturn * dt);
    if (this.swing) {
      this.swing.t += dt;
      if (this.swing.t >= this.swing.dur + WEAPON_CFG.swingSettle) this.swing = null;
    }
  }

  /** Bắt đầu vung vũ khí cận chiến (gọi từ meleeSwing trong weapons.js) */
  startSwing(w, fin = false) {
    this.swingDir = -this.swingDir;
    const big = fin || w.type === "sword" || w.type === "scythe" || w.type === "hammer" || w.type === "dragon" || (w.type === "blade" && (w.arc ?? 0) >= 1.3);
    const arc = big ? Math.min(1.7, (w.arc ?? 1.2) + 0.3) : 0.45;   // găng tay: đấm thẳng + lắc nhẹ
    this.swing = { t: 0, dur: Math.min(WEAPON_CFG.swingTime, w.fireRate * 0.6), from: -arc * this.swingDir, to: arc * 0.85 * this.swingDir };
  }

  /** Góc lệch hiện tại của vũ khí do vung chém (rad, trong hệ tọa độ của vũ khí) */
  get swingAngle() {
    const s = this.swing;
    if (!s) return 0;
    if (s.t < s.dur) { const u = s.t / s.dur, e = 1 - (1 - u) ** 3; return s.from + (s.to - s.from) * e; }
    return s.to * (1 - (s.t - s.dur) / WEAPON_CFG.swingSettle);   // thu kiếm về vị trí nghỉ
  }

  /**
   * Hướng ngắm trên điện thoại: theo cần ngắm (có hỗ trợ ngắm: hút về quái gần hướng kéo trong 22°),
   * không kéo cần ngắm thì nhìn theo hướng di chuyển.
   */
  touchAim(game) {
    const a = input.touchAim;
    if (a === null) {
      const jx = input.joy.x, jy = input.joy.y;
      return jx * jx + jy * jy > 0.09 ? Math.atan2(jy, jx) : this.aim;
    }
    let best = null, bs = Infinity;
    for (const e of game.enemiesNear(this.cx, this.cy, 260)) {
      if (e.dead) continue;
      const ex = e.cx - this.cx, ey = e.cy - this.cy, d2 = ex * ex + ey * ey;
      if (d2 > 260 * 260) continue;
      const da = Math.abs(angleDiff(Math.atan2(ey, ex), a));
      if (da > 0.38) continue;
      const score = da * 300 + Math.sqrt(d2);
      if (score < bs) { bs = score; best = e; }
    }
    return best ? Math.atan2(best.cy - this.cy, best.cx - this.cx) : a;
  }

  /** Giáp tự hồi: chờ `regen.delay` giây không trúng đòn rồi hồi 1 điểm mỗi `regen.interval` giây */
  updateArmor(dt) {
    this.sinceHit += dt;
    if (this.armor >= this.maxArmor || this.sinceHit < this.regen.delay) { this.regenTick = 0; return; }
    this.regenTick += dt;
    if (this.regenTick >= this.regen.interval) {
      this.regenTick -= this.regen.interval;
      this.armor = Math.min(this.maxArmor, this.armor + 1);
      this.armorFlash = 0.25;
    }
  }

  // ---------- Vũ khí ----------
  swapWeapon(game, to) {
    if (!this.weapons[1]) return;
    const next = to ?? 1 - this.slot;
    if (next === this.slot) return;
    this.slot = next;
    this.fireTimer = Math.max(this.fireTimer, 0.12);
    this.swing = null;
    this.charge = null;
    game.sound.play("swap", 0.5);
  }

  /**
   * Nhặt vũ khí (bấm E khi đứng cạnh):
   *   - còn trống ô 2 thì trang bị vào đó; đã đủ 2 thì THAY vũ khí đang cầm và thả vũ khí cũ xuống đất
   *   - 2 ô cùng 1 vũ khí, cùng ★ (hoặc đúng công thức) -> hiện lời nhắc GHÉP (phím G / nút GHÉP)
   * Trả về chuỗi thông báo.
   */
  pickWeapon(w, game) {
    const inst = w.def ? w : makeWeapon(w);
    if (!this.weapons[1]) { this.weapons[1] = inst; this.slot = 1; }
    else {
      const old = this.weapons[this.slot];
      this.weapons[this.slot] = inst;
      game.pickups.push(new Pickup(this.x, this.y + 2, "weapon", old, { vx: 0, vy: 0, blockedUntilLeave: true }));
    }
    this.fireTimer = 0.15;
    this.charge = null;
    const m = this.mergeable;
    return m ? `Nhặt: ${inst.label} — bấm ${TOUCH ? "GHÉP" : "G"} để GHÉP → ${m.def.name}${m.lvl > 1 ? " " + "★".repeat(m.lvl) : ""}` : `Nhặt: ${inst.label}`;
  }

  /** Kết quả ghép 2 vũ khí đang mang (null nếu không ghép được) */
  get mergeable() { return mergeResult(this.weapons[0], this.weapons[1]); }

  /** GHÉP 2 vũ khí: 2 khẩu giống nhau cùng ★ -> ★+1 · ★3 + ★3 -> tiến hóa Thần Thoại · công thức RECIPES */
  mergeWeapons(game) {
    const r = this.mergeable;
    if (!r) return false;
    this.weapons = [makeWeapon(r.def, r.lvl), null];
    this.slot = 0;
    this.charge = null;
    FX.levelUp(this.x, this.y);
    FX.holyPillar(this.x, this.y + 2, r.kind === "star" ? 0.4 : 0.7);
    game.sound.play("upgrade", 0.7);
    game.screenFlash(rarityColor(r.def.rarity), 0.25);
    game.hitStop(0.06);
    game.banner(r.kind === "star" ? `GHÉP THÀNH CÔNG: ${this.weapons[0].label}` : `TIẾN HÓA THẦN THOẠI: ${r.def.name}!`, rarityColor(r.def.rarity), true, 3);
    return true;
  }

  /** Thẻ Lò Rèn Thần: nâng vũ khí đang cầm 1 sao */
  upgradeWeapon(game) {
    const w = this.weapon;
    if (w.lvl >= WEAPON_MAX_LEVEL) { this.maxArmor++; this.armor++; game.banner("Vũ khí đã ★ tối đa — +1 Giáp tối đa", "#7fa2d8"); return; }
    this.weapons[this.slot] = makeWeapon(w.def ?? w, w.lvl + 1);
    FX.levelUp(this.x, this.y);
    game.sound.play("upgrade", 0.6);
    game.banner(`NÂNG CẤP: ${this.weapons[this.slot].label}`, "#ffb030");
  }

  /** Bùa Đền Thờ */
  startBlessing(game, b, time = ENV.shrine.buffTime) {
    this.endBlessing(game, true);
    this.blessing = { id: b.id, name: b.name, color: b.color, t: time, max: time };
    if (b.id === "power") this.mods.buffDmg = 1.4;
    if (b.id === "haste") { this.mods.buffSpeed = 1.25; this.mods.buffRate = 1.25; }
    if (b.id === "guard") { this.armor = Math.min(this.maxArmor + 2, this.armor + 2); this.regenSaved = this.regen; this.regen = { delay: 0.6, interval: 0.25 }; }
  }
  endBlessing(game, silent = false) {
    const b = this.blessing;
    if (!b) return;
    this.mods.buffDmg = this.mods.buffRate = this.mods.buffSpeed = 1;
    if (b.id === "guard") { if (this.regenSaved) this.regen = this.regenSaved; this.armor = Math.min(this.armor, this.maxArmor); }
    this.blessing = null;
    if (!silent) game.banner(`Hết bùa: ${b.name}`, "#8a82a8");
  }

  /** Hệ số thời gian giữa 2 đòn (Cuồng Nộ, thuốc, Gatling, thẻ Tay Nhanh) */
  rateMul(w) {
    let m = 1;
    if (this.rageTime > 0) m *= this.skill.fireRateMult ?? 0.5;   // kỹ năng Cuồng Nộ
    if (this.frenzy > 0) m /= 1.4;                                // Thuốc Cuồng Nộ +40% tốc bắn
    if (w.spinUp) m *= 4 - 3 * this.spin;                         // Gatling: chậm gấp 4 lúc mới quay
    return m * this.mods.rateMul;                                 // thẻ Tay Nhanh + bùa Gió Lốc (có sàn)
  }

  /** Trừ năng lượng; thiếu thì báo hiệu & trả về false */
  spendEnergy(game, cost) {
    if (cost <= 0) return true;
    if (this.energy + 1e-6 < cost) {
      if (this.noEnergyT <= 0) { game.sound.play("skillDenied", 0.4); game.banner(`HẾT NĂNG LƯỢNG! Đổi vũ khí (${TOUCH ? "ĐỔI SÚNG" : "Q"}) hoặc nhặt ngọc xanh`, "#4aa8ff", false, 1.2); }
      this.noEnergyT = 0.6;
      this.fireTimer = 0.25;
      return false;
    }
    this.energy -= cost;
    return true;
  }

  attack(game) {
    const w = this.weapon;
    // súng thật (Pixel Armory): hết băng thì tự nạp đạn, không bắn được trong lúc nạp
    if (!tryConsumeAmmo(w, game)) { this.fireTimer = Math.max(this.fireTimer, 0.12); return; }
    if (!this.spendEnergy(game, w.cost ?? 0)) return;
    // TIẾNG ỒN: súng càng to càng vang xa -> chế độ Rút Quân: bầy zombie nghe thấy sẽ kéo tới
    const nz = weaponNoise(w);
    if (nz > 0) game.makeNoise(this.x, this.y, nz);
    const rateMul = this.rateMul(w);
    this.fireTimer = w.fireRate * rateMul;
    if (isMelee(w)) {
      // >>> COMBO 3 NHÁT: đánh tiếp trong khoảng nghỉ ngắn thì sang nhát kế; nhát 3 = đòn kết thúc
      const t = game.time;
      this.comboStep = t - this.lastSwing <= this.fireTimer + 0.45 ? (this.comboStep + 1) % 3 : 0;
      this.lastSwing = t;
      meleeSwing(this, game, w, this.comboStep);
      if (this.comboStep === 2) this.fireTimer *= 1.6;   // ngắt nhịp sau đòn kết thúc
    } else {
      fireWeapon(this, game, w);
      // weapons.js đặt p.recoil (px giật lùi) -> thêm nòng hếch lên tỉ lệ theo lực giật
      if (this.recoil > 0) this.recoilRot = Math.min(0.35, this.recoilRot + this.recoil * WEAPON_CFG.climb);
    }
  }

  /**
   * >>> VŨ KHÍ TÍCH LỰC <<< giữ chuột = tụ lực (vòng sáng quanh chân), thả ra = tung đòn.
   * Nhấp nhanh (chưa tới charge.min giây) = đòn thường.
   */
  updateCharge(dt, game, holding) {
    const w = this.weapon, C = w.charge;
    if (holding) {
      if (!this.charge && this.fireTimer <= 0) { this.charge = { t: 0, w, full: false }; game.sound.play("swap", 0.25); }
      if (this.charge) {
        this.charge.t += dt * (this.rageTime > 0 || this.frenzy > 0 ? 1.4 : 1);
        if (!this.charge.full && this.charge.t >= C.time) { this.charge.full = true; game.sound.play("upgrade", 0.35); FX.crit(this.cx, this.cy, -Math.PI / 2); }
      }
      return;
    }
    const ch = this.charge;
    if (!ch) return;
    this.charge = null;
    if (ch.w !== w) return;
    if (ch.t < C.min) { this.attack(game); return; }           // nhấp nhanh: đòn thường
    const k = clamp(ch.t / C.time, 0, 1);
    if (!this.spendEnergy(game, (w.chargeCost ?? w.cost ?? 0) * (0.4 + 0.6 * k))) return;
    this.fireTimer = w.fireRate * this.rateMul(w);
    fireCharged(this, game, w, k);
    const nz = weaponNoise(w);
    if (nz > 0) game.makeNoise(this.x, this.y, nz * (0.6 + 0.6 * k));
    if (this.recoil > 0) this.recoilRot = Math.min(0.4, this.recoilRot + this.recoil * WEAPON_CFG.climb);
  }

  // ---------- Kỹ năng ----------
  useSkill(game) {
    if (this.skillCd > 0 || this.dash) { game.sound.play("skillDenied", 0.4); return; }
    const handler = SKILL_HANDLERS[this.skill.type];
    if (!handler) { console.warn(`[Skill] Chưa có kỹ năng loại "${this.skill.type}" trong SKILL_HANDLERS`); return; }
    handler(this, game, this.skill);
    this.skillCd = this.skillCdMax;   // thẻ "Bậc Thầy Kỹ Năng" (sàn 64%)
  }

  /** Bóng mờ lưu đúng frame hoạt ảnh lúc đó */
  pushGhost(flip, life, color) {
    this.ghosts.push({ x: this.x, y: this.y, flip, life, max: life, color, row: this.anim?.row ?? 0, frame: this.anim?.col ?? 0 });
  }

  updateDash(dt, game) {
    const d = this.dash, s = this.skill;
    d.t += dt;
    game.world.moveBody(this, d.vx * dt, d.vy * dt, PLAYER_CFG.footR);
    this.walkTime += dt;
    d.trail -= dt;
    if (d.trail <= 0) { d.trail = 0.025; this.pushGhost(Math.cos(d.angle) < 0, 0.25, s.color); }
    for (const e of game.enemiesNear(this.cx, this.cy, this.radius + 8 + MAX_ENEMY_RADIUS)) {
      if (e.dead || d.hit.has(e)) continue;
      if (circleHit(this.cx, this.cy, this.radius + 8, e.cx, e.cy, e.radius)) {
        d.hit.add(e);
        game.damageEnemy(e, s.damage * this.mods.damageMul, d.angle, s.knockback * this.mods.knockMul);
        e.launch(s.launchHeight);
      }
    }
    if (d.t >= d.dur) { this.dash = null; this.hurtTimer = Math.max(this.hurtTimer, 0.12); }
  }

  // ---------- LƯỚT NHANH (Shift): 140px theo hướng di chuyển, 0.25s bất tử, để lại bóng mờ ----------
  startRoll(game, dx, dy) {
    if (this.rollCd > 0 || this.roll) return;
    if (!dx && !dy) { dx = Math.cos(this.aim); dy = Math.sin(this.aim); }   // đứng yên: lướt theo hướng ngắm
    const l = Math.hypot(dx, dy); dx /= l; dy /= l;                        // cần cảm ứng nghiêng nhẹ vẫn lướt đủ 140px
    const v = ROLL.distance / ROLL.time;
    this.roll = { t: 0, vx: dx * v, vy: dy * v, trail: 0 };
    this.phantomHit.clear();
    this.rollCd = this.rollCdMax;
    this.rollInv = ROLL.iframes;
    this.kx = this.ky = 0;
    FX.dust(this.x, this.y, dx > 0);          // tung bụi ở chỗ bật đi
    game.sound.play("roll", 0.5);
  }
  updateRoll(dt, game) {
    const r = this.roll;
    r.t += dt;
    game.world.moveBody(this, r.vx * dt, r.vy * dt, PLAYER_CFG.footR);
    this.walkTime += dt;
    r.trail -= dt;
    if (r.trail <= 0) { r.trail = 0.03; this.pushGhost(this.facingLeft, 0.3, this.mods.dashDmg > 0 ? "#e0b0ff" : "#a8dcff"); }
    // thẻ Lướt Ảo Ảnh: lướt xuyên qua quái gây sát thương (mỗi con 1 lần / lần lướt)
    if (this.mods.dashDmg > 0) {
      for (const e of game.enemiesNear(this.cx, this.cy, this.radius + 6)) {
        if (e.dead || this.phantomHit.has(e) || !circleHit(this.cx, this.cy, this.radius + 6, e.cx, e.cy, e.radius)) continue;
        this.phantomHit.add(e);
        game.damageEnemy(e, this.mods.dashDmg * this.mods.damageMul, Math.atan2(r.vy, r.vx), 120);
      }
    }
    if (r.t >= ROLL.time) {
      // giữ lại chút quán tính (rõ nhất trên băng)
      this.vx = r.vx * 0.25; this.vy = r.vy * 0.25;
      this.roll = null;
    }
  }

  hurt(game, fromX, fromY, dmg = 1) {
    if (this.invulnerable || this.hp <= 0) return;
    if (this.char.dodge && Math.random() < this.char.dodge) {   // Minh Huy: nhỏ con, đòn sượt qua đầu
      this.hurtTimer = 0.25;
      effects.text("MISS", this.x, this.y - 30, "heal");
      game.sound.play("swap", 0.35);
      return;
    }
    this.sinceHit = 0;
    this.hurtTimer = this.invulnTime;
    if (this.mods.thorns > 0) game.thornsBurst(this, 3 * this.mods.thorns);   // Giáp Gai: phản đòn
    const a = Math.atan2(this.cy - fromY, this.cx - fromX);
    this.kx = Math.cos(a) * 260; this.ky = Math.sin(a) * 260;
    const absorbed = Math.min(this.armor, dmg);
    this.armor -= absorbed;
    const toHp = dmg - absorbed;
    this.hp = Math.max(0, this.hp - toHp);
    if (toHp > 0) { navigator.vibrate?.(70); game.shake(0.28, 5, a); game.hitStop(0.08); game.sound.play("playerHurt", 0.6); game.hurtFlash = 0.25; }
    else { this.armorFlash = 0.3; game.shake(0.16, 3, a); game.hitStop(0.04); game.sound.play("armorHit", 0.5); }
    this.charge = null;
    FX.hit(this.cx, this.cy, a);
  }

  get blinking() { return this.hurtTimer > 0 && !this.dash && Math.floor(this.hurtTimer * 20) % 2 === 0; }
  get bob() { return this.walkTime > 0 ? -Math.abs(Math.sin(this.walkTime * 14)) * 2 : 0; }

  // ---------- VẼ (ctx đang ở TỌA ĐỘ THẾ GIỚI) ----------
  /** Thân nhân vật + bóng mờ + hào quang + vũ khí (vũ khí ra sau lưng khi ngắm lên trên) */
  draw(c, game) {
    const img = game.assets.images[`${this.char.id}.sprite`];   // ảnh tĩnh riêng của bạn (characters.js -> sprite)
    const S = this.sprite, flip = this.facingLeft;

    // bóng mờ khi lướt: cùng frame hoạt ảnh, tô 1 màu
    for (const g of this.ghosts) {
      c.globalAlpha = (g.life / g.max) * (img ? 0.4 : 0.55);
      if (img) { c.save(); c.translate(Math.round(g.x), Math.round(g.y)); if (g.flip) c.scale(-1, 1); c.drawImage(img, -img.width / 2, -img.height); c.restore(); }
      else if (S) S.sheet.tinted(g.color).draw(c, g.frame, g.row, g.x, g.y, g.flip);
    }
    c.globalAlpha = 1;

    if (this.aura) { this.aura.render(flip); this.aura.draw(c, this.x, this.y, "back"); }
    const behind = Math.sin(this.aim) < WEAPON_CFG.behindAbove;
    if (behind) this.drawWeapon(c, game);

    const hidden = this.blinking || (this.aura && this.rageTime > 0 && fxRage.actorAlpha(this.aura.t % fxRage.meta.duration) === 0);
    if (!hidden) {
      if (this.rollInv > 0) c.globalAlpha = 0.75;
      if (img) {
        // >>> ẢNH NHÂN VẬT CỦA BẠN (1 ảnh tĩnh) được vẽ ở đây (chân đặt tại this.x, this.y)
        c.save();
        c.translate(Math.round(this.x), Math.round(this.y + this.bob));
        if (flip) c.scale(-1, 1);
        c.drawImage(img, -img.width / 2, -img.height);
        c.restore();
      } else if (S) S.sheet.draw(c, this.anim.col, this.anim.row, this.x, this.y, flip);
      c.globalAlpha = 1;
    }
    if (!behind) this.drawWeapon(c, game);
    if (this.aura && !img) this.aura.draw(c, this.x, this.y, "front");
    if (this.shy) this.drawShyHearts(c, game);
    // Khiên Thánh Quang: bong bóng vàng bao quanh (spritesheet lặp), nhấp nháy khi sắp hết
    if (this.holyTime > 0 && (this.holyTime > 0.6 || Math.floor(game.time * 14) % 2 === 0)) {
      const sh = FX_SHEETS.get("divineShield")?.sheet;
      if (sh) sh.draw(c, Math.floor(game.time * sh.fps) % sh.frames, 0, this.x, this.y + 3, false, 1);
    }
    // Bùa Đền Thờ: đốm sáng màu bùa xoay quanh chân
    if (this.blessing) {
      c.fillStyle = this.blessing.color;
      for (let i = 0; i < 3; i++) { const a = game.time * 4 + (i * TAU) / 3; c.fillRect(Math.round(this.x + Math.cos(a) * 11), Math.round(this.y - 2 + Math.sin(a) * 4), 2, 2); }
    }
    // Bị làm chậm (axit) / bị giữ chân (bàn tay ma)
    if (this.slowT > 0 || this.rootT > 0) {
      c.fillStyle = this.rootT > 0 ? "#b06cff" : "#8ad23a";
      for (let i = 0; i < 4; i++) { const u = (game.time * 1.5 + i / 4) % 1; c.fillRect(Math.round(this.x - 6 + i * 4), Math.round(this.y - 4 - u * 10), 1, 2); }
    }
  }

  /** Tim hồng bay lên + vạch "///" đỏ mặt + CON MÈO ngồi trên đầu khi đang Ngại Ngùng */
  drawShyHearts(c, game) {

    const t = this.shy.t, HEART = [".x.x.", "xxxxx", "xxxxx", ".xxx.", "..x.."];
    for (let i = 0; i < 3; i++) {
      const u = (t * 0.9 + i / 3) % 1, x = Math.round(this.x + (i - 1) * 9 + Math.sin(t * 6 + i * 2) * 2), y = Math.round(this.y - 48 - u * 16);
      if (u > 0.85 && Math.floor(t * 20) % 2) continue;
      HEART.forEach((r, j) => [...r].forEach((ch, k) => { if (ch === "x") { c.fillStyle = j === 1 && k === 1 ? "#ffd0e0" : "#ff6aa0"; c.fillRect(x + k - 2, y + j, 1, 1); } }));
    }
    c.fillStyle = "#ff5a8a";
    const sx = Math.round(this.x + (this.facingLeft ? -10 : 8)), sy = Math.round(this.y - 34);
    for (let i = 0; i < 3; i++) { c.fillRect(sx + i * 2, sy + 2, 1, 1); c.fillRect(sx + i * 2 + 1, sy + 1, 1, 1); c.fillRect(sx + i * 2 + 2, sy, 1, 1); }
  }

  /**
   * >>> VŨ KHÍ TRÊN TAY <<<
   * Gốc = bàn tay ở frame hiện tại. Xoay 360° theo chuột; khi quay sang trái thì lật TRỤC DỌC (scale(1,-1))
   * để súng/kiếm không bị lộn ngược. Trong hệ tọa độ đã lật: vung chém xoay quanh tay, giật lùi đẩy dọc nòng.
   */
  drawWeapon(c, game) {
    if (this.shy) return;                       // đang ôm mặt: không cầm gì
    if (this.weapon.type === "frostHand") {     // TAY KHÔNG: chỉ có đốm băng lấp lánh ở bàn tay
      const x = Math.round(this.handX + Math.cos(this.aim) * 2), y = Math.round(this.handY + Math.sin(this.aim) * 2);
      const k = Math.floor(game.time * 10) % 3, big = this.recoil > 0.5;
      c.fillStyle = "rgba(166,236,255,0.35)"; c.fillRect(x - 3, y - 3, 6, 6);
      c.fillStyle = "#62c8f4"; c.fillRect(x - 1, y - 1, big ? 3 : 2, big ? 3 : 2);
      c.fillStyle = "#ffffff"; c.fillRect(x - (k === 0 ? 2 : 0), y - (k === 1 ? 2 : 0), 1, 1);
      return;
    }
    c.save();
    c.translate(Math.round(this.handX), Math.round(this.handY));
    c.rotate(this.aim);
    if (this.facingLeft) c.scale(1, -1);
    const rot = this.swingAngle - this.recoilRot;
    if (rot) c.rotate(rot);
    c.translate(Math.round(WEAPON_CFG.grip - this.recoil), 0);
    const img = (this.weapon.def ?? this.weapon) === this.char.weapon ? game.assets.images[`${this.char.id}.weapon`] : null;
    if (img) c.drawImage(img, 0, -img.height / 2);   // >>> ẢNH VŨ KHÍ KHỞI ĐẦU CỦA BẠN (tay cầm ở mép trái)
    else drawWeaponFallback(c, this.weapon);
    c.restore();
  }
}

// =====================================================================================
// 9. GAME
// =====================================================================================
class Game {
  constructor(assets, sound) {
    this.assets = assets;
    this.sound = sound;
    this.fx = FX;
    this.state = GAME_STATE.MENU;
    this.paused = false;
    this.debug = false;
    this.best = Number(loadPref("pixelArena.best", "0")) || 0;
    this.bestByChar = parseJSON(loadPref("pixelArena.bestByChar", "{}"));
    this.charIndex = clamp(Math.trunc(Number(loadPref("pixelArena.char", "0"))) || 0, 0, CHARACTERS.length - 1);
    this.mapIndex = clamp(Math.trunc(Number(loadPref("pixelArena.map", "0"))) || 0, 0, BIOMES.length - 1);
    const d = Number(loadPref("pixelArena.diff", "1"));
    this.diffIndex = Number.isInteger(d) ? clamp(d, 0, DIFFICULTY.length - 1) : 1;
    this.ui = null;
    this.lobby = null;
    this.progress = new Progress();   // Ngọc + nâng cấp vĩnh viễn (localStorage)
    this.player = null;
    this.camera = new Camera(W, H);
    this.time = 0;
    // Lưới không gian cho va chạm (tạo 1 lần) + các mảng kết quả dùng lại (không tạo mảng mới mỗi frame)
    this.grid = new SpatialGrid(WORLD.w, WORLD.h, GRID_CELL);
    this.qNear = []; this.qBullet = []; this.qExplode = []; this.qSep = []; this.qContact = []; this.qZone = [];
    this.drawList = [];
    this.bullets = []; this.enemyBullets = []; this.enemies = []; this.orbs = [];
    this.zones = []; this.strikes = []; this.rains = []; this.minions = []; this.particles = [];
    this.drops = []; this.shells = []; this.pending = []; this.npcs = [];
    // Ánh sáng & thời tiết
    this.light = new LightLayer(W, H);
    this.vignette = makeVignette(W, H);
    this.lightList = []; this.lightPool = [];
    this.ambient = null;
    // >>> CHẾ ĐỘ CHƠI: "extract" = NHẢY DÙ – NHIỆM VỤ – RÚT QUÂN (chính) · "arcade" = CHẾ ĐỘ GIẢI TRÍ (sinh tồn theo đợt như cũ)
    this.mode = loadPref("pixelArena.mode", "extract") === "arcade" ? "arcade" : "extract";
    this.stash = new Stash();   // Kho Đồ vĩnh viễn + kế hoạch Túi Chiến Thuật (localStorage)
    this.horde = null;          // HordeManager (chỉ có ở chế độ Rút Quân)
    this.run = null;            // ExtractionRun — ván rút quân đang chơi
  }

  /** Đang chơi bằng cảm ứng (để HUD hiện đúng tên nút) */
  get touchMode() { return TOUCH; }
  /** Vẽ icon vật phẩm (dùng cho nút cảm ứng Túi Chiến Thuật) */
  drawItemIcon(g, id, x, y, size) { drawItemIcon(g, id, x, y, size, this.assets.images); }
  setMode(mode) {
    this.mode = mode === "arcade" ? "arcade" : "extract";
    savePref("pixelArena.mode", this.mode);
  }

  get diff() { return DIFFICULTY[this.diffIndex]; }
  /** Hệ số theo ĐỢT + ĐỘ KHÓ (xem WAVE, DIFFICULTY ở đầu file) */
  get hpMul() { return this.diff.hp * (1 + WAVE.hpPerWave * (this.wave - 1)); }
  get enemySpeedMul() { return Math.min(WAVE.speedCap, 1 + WAVE.speedPerWave * (this.wave - 1)); }
  get enemyDmgBonus() { return this.wave >= this.diff.dmgFrom ? 1 : 0; }
  get maxEnemies() { return Math.min(SPAWN.maxCap, SPAWN.maxEnemies + SPAWN.perWave * (this.wave - 1)); }
  enemyOpts(extra = {}) { return { hpMul: this.hpMul, speedMul: this.enemySpeedMul, dmgBonus: this.enemyDmgBonus, ...extra }; }
  /** Điểm đang ngắm (tọa độ thế giới) — dùng cho Trượng Thiên Thạch, Mưa Tên */
  aimTarget(p) { return aimPoint(p); }

  // ---------------- Chuyển trạng thái ----------------
  /** Nút "XUẤT KÍCH" / "LÊN MÁY BAY" / "Chơi lại": Rút Quân -> vào KHOANG MÁY BAY trước; Giải Trí -> vào trận luôn */
  launch(charIndex = this.charIndex) {
    if (this.mode === "extract") return this.enterCabin(charIndex);
    return this.start(charIndex);
  }

  /** KHOANG MÁY BAY: sảnh chờ trên máy bay — chọn đồ trong Kho bỏ vào Túi, rồi CHỌN ĐIỂM NHẢY */
  enterCabin(charIndex = this.charIndex) {
    this.charIndex = charIndex;
    savePref("pixelArena.char", String(charIndex));
    this.state = GAME_STATE.CABIN;
    this.paused = false;
    input.mouse.left = false;
    input.pressed.clear();
    this.ui.closePanels?.();
    const char = CHARACTERS[charIndex], sp = ACTOR_SPRITES.get(char.id) ?? null;
    this.cabin.enter({ sprite: sp, anim: sp?.controller() ?? null }, this.assets.images, !AUTOPLAY);   // có cảnh LÊN MÁY BAY
    this.ui.showCabin();
    this.sound.unlock();
    goFullscreenLandscape();
    this.sound.play("uiStart", 0.6);
    this.sound.setMusic("menuMusic");
  }
  /** Từ khoang: nhảy dù -> lấy đồ khỏi Kho, mở bản đồ chiến thuật */
  jumpFromCabin() {
    if (this.state !== GAME_STATE.CABIN) return;
    this.ui.hideCabin();
    this.startExtraction(this.charIndex);
  }

  start(charIndex = this.charIndex) {
    if (this.mode === "extract") return this.startExtraction(charIndex);
    this.charIndex = charIndex;
    savePref("pixelArena.char", String(charIndex));
    this.reset(CHARACTERS[charIndex], BIOMES[this.mapIndex]);
    this.state = GAME_STATE.PLAYING;
    this.ui.closePanels?.();
    this.paused = false;
    input.mouse.left = false;
    input.pressed.clear();
    this.ui.hideAll();
    this.sound.unlock();
    goFullscreenLandscape();
    this.sound.play("uiStart", 0.6);
    this.sound.setMusic("music");
    canvas.focus();
  }

  /**
   * XUẤT KÍCH (chế độ Rút Quân): lấy đồ trong Túi Chiến Thuật ra khỏi Kho, sinh bản đồ + bầy zombie + nhiệm vụ,
   * mở BẢN ĐỒ CHIẾN THUẬT để chọn điểm nhảy dù (src/deploy.js).
   */
  startExtraction(charIndex = this.charIndex) {
    this.charIndex = charIndex;
    savePref("pixelArena.char", String(charIndex));
    drawLoading(0.5, "Đang dựng vùng dịch Z-07...");
    const kit = this.stash.checkout();
    this.reset(CHARACTERS[charIndex], null, { extract: true, kit });
    this.state = GAME_STATE.PLAYING;
    this.ui.closePanels?.();
    this.paused = false;
    input.mouse.left = false;
    input.pressed.clear();
    this.ui.hideAll();
    stage.classList.remove("in-game");   // bản đồ chiến thuật: hiện chuột để chọn điểm nhảy
    this.sound.unlock();
    goFullscreenLandscape();
    this.sound.play("uiStart", 0.6);
    this.sound.setMusic("menuMusic");
    canvas.focus();
  }

  /** Thoát từ bản đồ chiến thuật (chưa nhảy dù): trả nguyên đồ mang theo về Kho */
  abortExtraction() { this.refundKit(); this.goMenu(); }
  refundKit() {
    const run = this.run;
    if (run && (run.phase === "tacmap" || run.phase === "jumpcut")) {
      for (const s of run.bag) if (s) this.stash.add(s.id, s.n);
      if (run.kitWeapon) this.stash.weapons.push(run.kitWeapon);
      this.stash.stats.runs = Math.max(0, this.stash.stats.runs - 1);
      this.stash.save();
      run.phase = "done";
    }
  }

  /** RÚT QUÂN THÀNH CÔNG (gọi từ ExtractionRun.success) -> bảng tổng kết */
  endExtraction(result) {
    this.state = GAME_STATE.GAME_OVER;
    this.overTimer = 0.4;
    this.overShown = false;
    this.best = Math.max(this.best, this.score);
    savePref("pixelArena.best", String(this.best));
    this.gemsEarned = result.gems;
    this.sound.play("levelUp", 0.7);
    this.sound.setMusic("");
    input.mouse.left = false;
  }

  /** Zombie Đột Biến Khổng Lồ xuất hiện (chế độ Rút Quân, theo lịch EXTRACT.bossAt) */
  spawnZombieBoss() {
    const p = this.player;
    const pt = this.world.randomFreePoint({ near: { x: p.x, y: p.y }, minD: 190, maxD: 280, margin: 30 }) ?? this.world.randomFreePoint({ margin: 30 });
    if (!pt) return;
    this.bossCount++;
    this.queueSpawn("zBoss", pt.x, pt.y, { hpMul: this.diff.hp * (1 + (this.bossCount - 1) * 0.35), dmgBonus: this.diffIndex === 2 ? 1 : 0, speedMul: 1 }, SPAWN.bossTelegraph, { boss: true });
    this.banner("ZOMBIE ĐỘT BIẾN KHỔNG LỒ XUẤT HIỆN!", "#7cff5a", true, 3.2);
    this.sound.play("bossWarn", 0.8);
    this.sound.play("zombieHowl", 0.7);
    this.shake(0.5, 4);
  }

  goMenu() {
    // rời trận Rút Quân giữa chừng = coi như tử trận (mất đồ mang theo)
    if (this.run && this.run.phase !== "done") {
      if (this.run.phase === "tacmap" || this.run.phase === "jumpcut") this.refundKit();
      else { this.run.fail("abandon"); this.stash.normalizeBag(); }
    }
    this.state = GAME_STATE.MENU;
    this.ui.hideCabin?.();
    this.paused = false;
    this.choosing = false;
    this.shopping = null;
    effects.clear();
    this.lobby?.enter(this.charIndex);
    this.ui.showMenu();
    this.sound.setMusic("menuMusic");
  }

  gameOver() {
    this.state = GAME_STATE.GAME_OVER;
    this.overTimer = 0.9;
    this.overShown = false;
    this.newRecord = this.score > this.best;
    this.best = Math.max(this.best, this.score);
    savePref("pixelArena.best", String(this.best));
    const id = this.player.char.id;
    this.newCharRecord = this.score > (this.bestByChar[id] ?? 0);
    this.bestByChar[id] = Math.max(this.bestByChar[id] ?? 0, this.score);
    savePref("pixelArena.bestByChar", JSON.stringify(this.bestByChar));
    // >>> NGỌC: phần thưởng vĩnh viễn dùng ở Sảnh chờ
    if (this.run) {   // Rút Quân: TỬ TRẬN -> mất toàn bộ đồ mang theo trong ván (ExtractionRun.fail)
      this.run.fail("dead");
      this.gemsEarned = this.run.result.gems;
    } else {
      this.gemsEarned = gemsForRun({ score: this.score, bossKills: this.bossKills, wave: this.wave, kills: this.kills });
      this.progress.addGems(this.gemsEarned);
    }
    this.shopping = null; this.ui.hideShop?.();
    this.sound.play("gameOver", 0.7);
    this.sound.setMusic("");
    FX.death(this.player.cx, this.player.cy);
    this.player.aura?.stop();
    input.mouse.left = false;
  }

  /** opts: { extract: true, kit } -> ván Rút Quân (bản đồ chiến thuật + zombie + nhiệm vụ) */
  reset(char, biome, opts = {}) {
    const extract = !!opts.extract;
    effects.clear();
    // trả đạn / quái / ngọc của trận trước về Object Pool
    for (const b of this.bullets) Bullet.pool.release(b);
    for (const b of this.enemyBullets) EnemyBullet.pool.release(b);
    for (const e of this.enemies) Enemy.pool.release(e);
    for (const o of this.orbs) ExpOrb.pool.release(o);
    for (const d of this.drops) Drop.pool.release(d);
    if (extract) this.world = new ExtractionWorld(this.assets.images);   // tự đổi WORLD thành 3200x2240
    else { Object.assign(WORLD, ARCADE_WORLD); this.world = new World(biome, this.assets.images); }
    // lưới va chạm theo kích thước bản đồ hiện tại
    if (this.grid.cols !== Math.ceil(WORLD.w / GRID_CELL) || this.grid.rows !== Math.ceil(WORLD.h / GRID_CELL)) this.grid = new SpatialGrid(WORLD.w, WORLD.h, GRID_CELL);
    HUD.MINIMAP.h = Math.round(HUD.MINIMAP.w * WORLD.h / WORLD.w);
    this.minimap = this.world.renderMinimap(HUD.MINIMAP.w, HUD.MINIMAP.h);
    // nâng cấp vĩnh viễn từ Sảnh chờ + vũ khí phụ đã chọn ở Kho Vũ Khí
    const pr = this.progress, sec = pr.secondary && pr.isUnlocked(pr.secondary) ? WEAPONS[pr.secondary] : null;
    this.player = new Player(char, this.world.spawn, { hp: pr.level(char.id, "hp"), armor: pr.level(char.id, "armor"), cd: pr.level(char.id, "cd"), weapon: pr.level(char.id, "weapon"), secondary: sec });
    if (this.player.weapons[1]) this.player.weapons[1].crafted = true;   // vũ khí chế tạo bằng Ngọc: vĩnh viễn, không mang về Kho Đồ
    const kitW = extract && opts.kit?.weapon && WEAPONS[opts.kit.weapon.id];
    if (kitW) this.player.weapons[1] = makeWeapon(kitW, opts.kit.weapon.lvl ?? 1);   // súng mang từ Kho Đồ (mất nếu tử trận)
    // ĐẠN THEO LOẠI: Rút Quân có kho đạn dự trữ (mỗi súng mang theo 2 băng) — Giải Trí vô hạn như cũ
    if (extract) {
      startAmmoPool(this.player.weapons.filter(Boolean));
      AMMO.onEmpty = (w) => { const t = ammoTypeOf(w); this.banner(`Hết ${AMMO_TYPES[t]?.name ?? "đạn"}! Tìm hộp đạn hoặc đổi súng`, "#ff7a5a", false, 1.8); };
    } else { stopAmmoPool(); AMMO.onEmpty = null; }
    this.camera = new Camera(W, H);
    this.camera.snap(this.player.x, this.player.cy);
    this.bullets = []; this.enemyBullets = []; this.enemies = [];
    this.chests = []; this.pickups = []; this.orbs = [];
    this.beams = []; this.waves = []; this.shocks = []; this.flashes = []; this.banners = []; this.bolts = [];
    this.iceLines = []; this.zones = []; this.strikes = []; this.rains = []; this.minions = []; this.particles = [];
    this.drops = []; this.shells = []; this.pending = []; this.npcs = [];
    this.gold = 0; this.goldTotal = 0; this.shopping = null; this.gemsEarned = 0;
    this.weaponsUsed = new Set([char.weapon.name]);
    this.perkLog = [];
    this.score = 0; this.kills = 0; this.time = 0;
    this.level = 1; this.exp = 0; this.expNeed = expToNext(1); this.pendingLevels = 0;
    this.choosing = false; this.perkChoices = []; this.rerolls = 3;
    this.wave = 1; this.bossKills = 0;
    this.combo = 0; this.comboT = 0; this.bestCombo = 0;
    this.spawnTimer = 1;
    this.chestTimer = SPAWN.chestEvery;
    this.bossTimer = SPAWN.bossEvery;
    this.bossCount = 0;
    this.eventTimer = SPAWN.eventAfter; this.event = null; this.lastEvent = "";
    this.freeze = 0;
    this.hurtFlash = 0;
    this.flashFx = null;
    this.reviveUsed = false;
    this.ambient = new Ambient(this.world.biome.weather);
    this.mode = extract ? "extract" : "arcade";
    this.horde = extract ? new HordeManager(this) : null;
    this.run = null;
    if (extract) {
      this.run = new ExtractionRun(this, { minutes: this.stash.duration, kit: opts.kit ?? { slots: [], weapon: null }, stash: this.stash, progress: this.progress });
      return;
    }
    this.banner(`ĐỢT 1 · ${biome.name}`, "#ffe26b", true, 2.6);
    this.banner(`Độ khó: ${this.diff.name}`, this.diff.color, false, 2.6);
  }

  /** Rung màn hình. angle (tùy chọn) = rung CÓ HƯỚNG: khung hình bị đẩy theo hướng đó (giật súng, vụ nổ, trúng đòn) */
  shake(time, amp, angle) {
    if (angle === undefined) { this.camera.shake(time, amp); return; }
    this.camera.shake(time, amp * 0.45);
    this.camera.kick(angle, amp * 0.9);
  }
  /** Chớp màn hình 1 màu (giảm dần trong `time` giây) */
  screenFlash(color, time) {
    const v = parseInt(color.slice(1), 16);
    if (!this.flashFx || time >= this.flashFx.t) this.flashFx = { r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255, t: time, max: time };
  }
  hitStop(t) { this.freeze = Math.max(this.freeze, t); }
  /** Tiếng ồn (súng nổ, vụ nổ) — chế độ Rút Quân: bầy zombie trong bán kính sẽ nghe thấy và kéo tới */
  makeNoise(x, y, radius) { if (radius > 0) this.horde?.noise(x, y, radius); }
  get boss() { for (const e of this.enemies) if (e.boss && !e.dead) return e; return null; }

  /**
   * Quái có thể nằm trong bán kính r quanh (x, y) — lấy từ lưới không gian (chỉ vài ô xung quanh).
   * Người gọi vẫn phải tự lọc bằng khoảng cách bình phương. Mảng trả về được dùng lại ở lần gọi sau.
   */
  enemiesNear(x, y, r) { return this.grid.query(x, y, r + MAX_ENEMY_RADIUS, this.qNear); }

  banner(text, color = "#ffe26b", big = false, life = 2.2) {
    this.banners.push({ text, color, big, life });
    if (this.banners.length > 5) this.banners.shift();
  }
  flashMuzzle(x, y, color, size) { this.flashes.push({ x, y, color, size, life: 0.06 }); }
  noteWeaponUsed(w) { this.weaponsUsed.add(w.name); }

  /** Hạt nhỏ (khói tên lửa, vệt linh hồn, bọt độc) — tọa độ thế giới */
  puff(x, y, kind = "smoke") {
    if (this.particles.length > 320) return;
    const sm = kind === "smoke";
    this.particles.push({ x: x + rand(-1, 1), y: y + rand(-1, 1), vx: rand(-8, 8), vy: sm ? rand(-14, -4) : rand(-6, 6), life: sm ? rand(0.4, 0.7) : rand(0.25, 0.45), max: 0.7, kind });
  }

  /** Hồi máu cho người chơi (kèm hiệu ứng). Trả về số máu thực hồi. */
  healPlayer(n) {
    const p = this.player, before = p.hp;
    p.hp = Math.min(p.maxHp, p.hp + n);
    const got = p.hp - before;
    if (got > 0) { FX.healRing(p.x, p.y + 2); FX.healText(p.cx, p.cy - 14, got); this.sound.play("heal", 0.5); }
    return got;
  }

  // ---------- SINH QUÁI (có BÁO HIỆU: vòng ngắm đỏ dưới đất SPAWN.telegraph giây trước khi quái hiện ra) ----------
  /**
   * Xếp lịch sinh 1 con quái tại (x, y) sau `delay` giây. Trong lúc chờ: vẽ biểu tượng ngắm đỏ nhấp nháy ở chỗ đó.
   * o: { kx, ky (lực đẩy khi hiện ra), boss (vòng to + banner), onSpawn(e) }
   */
  queueSpawn(type, x, y, opts, delay = SPAWN.telegraph, o = {}) {
    this.pending.push({ type, x, y, opts, t: delay, max: delay, big: !!o.boss || (ENEMY_TYPES[type]?.scale ?? 1) >= 1.5 || !!opts.elite, color: opts.elite ? "#ff8a2a" : "#ff3b3b", o });
  }
  updatePending(dt) {
    const P = this.pending;
    for (let i = P.length - 1; i >= 0; i--) {
      const s = P[i];
      s.t -= dt;
      if (s.t > 0) continue;
      P[i] = P[P.length - 1]; P.pop();
      const e = Enemy.obtain(s.type, s.x, s.y, s.opts, ACTOR_SPRITES);
      if (s.o.kx || s.o.ky) { e.kx = s.o.kx ?? 0; e.ky = s.o.ky ?? 0; }
      if (s.opts.minion) e.spawnTime = 0.3;
      this.enemies.push(e);
      if (s.o.boss) { FX.portal(e.x, e.y + 4, 0.9); this.shake(0.5, 4); this.sound.play("bossSlam", 0.5); }
      else FX.spawn(e.cx, e.cy + 8);
      s.o.onSpawn?.(e);
    }
  }
  get pendingCount() { return this.pending.length; }

  /** Chỗ sinh quái: ưu tiên TRONG khung hình (để thấy vòng ngắm đỏ), cách người chơi ít nhất SPAWN.minD */
  spawnPoint() {
    const p = this.player, cam = this.camera;
    for (let i = 0; i < 10; i++) {
      const pt = this.world.randomFreePoint({ near: { x: p.x, y: p.y }, minD: SPAWN.minD * 0.85, maxD: SPAWN.maxD * 0.8, margin: 12 });
      if (pt && pt.x > cam.x + 16 && pt.x < cam.x + cam.w - 16 && pt.y > cam.y + 22 && pt.y < cam.y + cam.h - 8) return pt;
    }
    return this.world.randomFreePoint({ near: { x: p.x, y: p.y }, minD: SPAWN.minD, maxD: SPAWN.maxD, margin: 12 });
  }

  spawnEnemy() {
    const pt = this.spawnPoint();
    if (!pt) return;
    const type = pickEnemyType(this.time, this.world.biome.spawnBias);
    const elite = this.time > SPAWN.eliteAfter && type !== "bat" && Math.random() < SPAWN.eliteChance * this.diff.elite;
    this.queueSpawn(type, pt.x, pt.y, this.enemyOpts({ elite }));
  }

  /** Quái được TRIỆU HỒI (Pháp Sư Xương, Boss...): không rơi EXP, có giới hạn số lượng. Cũng có vòng ngắm báo trước. */
  spawnMinion(type, x, y, o = {}) {
    if (this.enemies.length + this.pending.length >= this.maxEnemies + 12) return null;
    let pt = { x, y };
    if (!ENEMY_TYPES[type].flying && !this.world.isFree(x, y, 8)) pt = this.world.randomFreePoint({ near: { x, y }, minD: 0, maxD: 50, margin: 10 });
    if (!pt) return null;
    this.queueSpawn(type, clamp(pt.x, WORLD.wall + 12, WORLD.w - WORLD.wall - 12), clamp(pt.y, WORLD.wallTop + 16, WORLD.h - WORLD.wall - 4), this.enemyOpts({ minion: true }), SPAWN.telegraph, { kx: o.kx, ky: o.ky });
    return pt;
  }

  // ---------- ĐƯỜNG GAI BĂNG (đòn đánh thường Bạch Ngưng Băng) ----------
  /**
   * Băng lan dọc mặt đất từ chân nhân vật theo hướng ngắm, dài w.range px với tốc độ w.speed.
   * Cứ mỗi ICE_STEP px mọc 1 cụm gai (spritesheet "iceSpikes"); mọi quái trên đường bị trúng 1 lần + đóng băng.
   * Gặp tường / cột đá thì dừng. (Cụm gai đầu tiên mọc cách chân 24px để không che nhân vật.)
   */
  castIceLine(p, w, dmg, knock, ang) {
    const c = Math.cos(ang), s = Math.sin(ang);
    this.iceLines.push({ x0: p.x + c * 14, y0: p.y + s * 8, c, s, ang, d: 0, next: 22, range: w.range ?? 200, speed: w.speed ?? 600,
      width: w.width ?? 20, dmg, knock, freeze: w.freeze ?? 1.6, hit: new Set(), dead: false });
  }
  updateIceLines(dt) {
    const ICE_STEP = 40;
    for (const L of this.iceLines) {
      if (L.dead) continue;
      const prev = L.d;
      L.d = Math.min(L.range, L.d + L.speed * dt);
      // mọc cụm gai mới
      while (L.next <= L.d) {
        const x = L.x0 + L.c * L.next, y = L.y0 + L.s * L.next;
        if (this.world.solidAt(x, y, 3)) { L.range = L.d = L.next; break; }
        const flip = L.c < 0, half = 26;   // cụm gai dài ~56px nằm ngang: dời để tâm cụm trùng điểm trên đường
        effects.play("iceSpikes", x - (flip ? -half : half) + (flip ? 4 : -4), y, { flip, time: 0.12, scale: 0.85 });
        L.next += ICE_STEP;
      }
      // sát thương đoạn vừa lan tới
      const ax = L.x0 + L.c * prev, ay = L.y0 + L.s * prev, bx = L.x0 + L.c * L.d, by = L.y0 + L.s * L.d;
      const mx = (ax + bx) / 2, my = (ay + by) / 2, half = (L.d - prev) / 2 + L.width;
      for (const e of this.grid.query(mx, my - 8, half + 16 + MAX_ENEMY_RADIUS, this.qExplode)) {
        if (e.dead || L.hit.has(e)) continue;
        const r = L.width / 2 + e.radius;
        if (pointSegDist2(e.x, e.y - 6 + e.z, ax, ay, bx, by) > r * r) continue;
        L.hit.add(e);
        if (e.freeze(L.freeze)) FX.freezeBurst(e.cx, e.y);
        this.damageEnemy(e, L.dmg, L.ang, L.knock * 0.4, { ice: true, pierce: true });
      }
      for (const b of this.world.barrels) if (!b.dead && pointSegDist2(b.x, b.y, ax, ay, bx, by) < (L.width / 2 + b.r) ** 2) this.igniteBarrel(b);
      for (const k of this.world.crystals) if (!k.dead && pointSegDist2(k.x, k.y, ax, ay, bx, by) < (L.width / 2 + k.r) ** 2) this.hitCrystal(k, L.dmg, L.ang);
      for (const k of this.world.props) if (!k.dead && pointSegDist2(k.x, k.y, ax, ay, bx, by) < (L.width / 2 + k.r) ** 2) this.hitProp(k, L.dmg, L.ang);
      if (L.d >= L.range) L.dead = true;
    }
    sweep(this.iceLines);
  }

  /** Thử hiệu năng: sinh ngay n quái quanh người chơi (phím J khi bật debug H, hoặc #stress-300 trên URL) */
  spawnHorde(n) {
    const p = this.player;
    for (let i = 0; i < n; i++) {
      const pt = this.world.randomFreePoint({ near: { x: p.x, y: p.y }, minD: 120, maxD: 520, margin: 12 });
      if (!pt) continue;
      this.enemies.push(Enemy.obtain(pickEnemyType(60 + Math.random() * 60, this.world.biome.spawnBias), pt.x, pt.y, this.enemyOpts(), ACTOR_SPRITES));
    }
  }

  /** BOSS cuối mỗi đợt: luân phiên 4 loại (BOSS_ROTATION), mỗi lần xuất hiện mạnh hơn */
  spawnBoss() {
    const p = this.player;
    const pt = this.world.randomFreePoint({ near: { x: p.x, y: p.y }, minD: 150, maxD: 250, margin: 30 })
      ?? this.world.randomFreePoint({ margin: 30 });
    if (!pt) return;
    const type = BOSS_ROTATION[this.bossCount % BOSS_ROTATION.length], cycle = Math.floor(this.bossCount / BOSS_ROTATION.length);
    this.bossCount++;
    this.queueSpawn(type, pt.x, pt.y, { hpMul: this.diff.hp * (1 + (this.bossCount - 1) * 0.45) * (1 + cycle * 0.25), dmgBonus: this.enemyDmgBonus, speedMul: 1 + cycle * 0.08 }, SPAWN.bossTelegraph, { boss: true });
    this.banner(`BOSS: ${ENEMY_TYPES[type].name.toUpperCase()}!`, "#e0a8ff", true, 3);
    this.sound.play("bossWarn", 0.7);
    this.shake(0.5, 4);
    // Thương Nhân thu dọn quầy khi Boss mới tới
    for (const n of this.npcs) if (n.kind === "merchant" && !n.dead) { n.dead = true; this.puff(n.x, n.y - 10); FX.portal(n.x, n.y, 0.4); }
  }

  // ---------- Rương báu ----------
  spawnChest(tier, x, y, far = false) {
    let pt = x !== undefined ? { x, y } : null;
    if (!pt) {
      const p = this.player;
      pt = this.world.randomFreePoint({ near: { x: p.x, y: p.y }, minD: far ? 420 : 180, maxD: far ? 800 : 650, margin: 14 });
    } else if (!this.world.isFree(pt.x, pt.y, 10)) {
      pt = this.world.randomFreePoint({ near: pt, minD: 0, maxD: 60, margin: 12 }) ?? pt;
    }
    if (!pt) return null;
    const c = new Chest(pt.x, pt.y, tier);
    this.chests.push(c);
    this.sound.play("chestSpawn", 0.5);
    this.banner(`${CHEST_TIERS[tier].name} xuất hiện!`, CHEST_TIERS[tier].glow);
    return c;
  }

  openChest(c) {
    c.opened = true; c.dead = true;
    FX.chestOpen(c.x, c.y, c.tier);
    this.sound.play("chestOpen", 0.6);
    const r = rollChest(c.tier, !!c.boss);
    this.pickups.push(new Pickup(c.x, c.y + 6, r.kind, r.weapon ?? null, { vx: rand(-30, 30), vy: 50 }));
    // rương còn văng ra ít Vàng
    const n = c.tier === "gold" ? 6 : c.tier === "silver" ? 3 : 1;
    for (let i = 0; i < n; i++) this.drops.push(Drop.obtain(c.x, c.y - 4, "gold", c.tier === "gold" ? 3 : 2));
  }

  /** Thả 1 hộp đạn loại t (mặc định đủ 1 hộp, xem AMMO_TYPES[t].box) */
  dropAmmo(x, y, t, n = AMMO_TYPES[t]?.box ?? 20) {
    if (!AMMO_TYPES[t]) return;
    this.pickups.push(new Pickup(x, y, "ammo", null, { vx: rand(-35, 35), vy: rand(-35, 35), ammo: { t, n } }));
  }

  collectPickup(pk) {
    const p = this.player;
    pk.dead = true;
    let msg = pk.label;
    switch (pk.kind) {
      case "potionHp": this.healPlayer(2); break;
      case "heart": this.healPlayer(1); break;
      case "potionArmor": p.armor = Math.min(p.maxArmor, p.armor + 3); p.armorFlash = 0.4; break;
      case "potionEnergy": p.energy = Math.min(p.maxEnergy, p.energy + ENERGY.potion); break;
      case "magnet": for (const o of this.orbs) o.magnet = true; break;
      case "rage": p.frenzy = 8; break;
      case "maxUp": p.maxHp++; p.hp++; p.maxArmor++; p.armor++; break;
      case "weapon": msg = p.pickWeapon(pk.weapon, this); break;
      case "ammo": { const a = pk.ammo, def = AMMO_TYPES[a.t]; addAmmo(a.t, a.n); msg = `+${a.n} ${def.name}`; break; }
    }
    this.banner(msg, pk.color);
    this.sound.play("pickup", 0.6);
  }

  // ---------- Sát thương ----------
  /**
   * Gây sát thương lên quái. Trả về true nếu quái chết.
   * opts: { pierce: tia xuyên thấu, explosive: vụ nổ (2 loại này xuyên khiên Hiệp Sĩ), quiet: không hiệu ứng,
   *         ice: hiệu ứng băng, noCrit: không chí mạng (sát thương môi trường), critBonus: + tỉ lệ chí mạng }
   */
  damageEnemy(e, dmg, angle, knock, opts = {}) {
    if (e.dead) return false;
    this.horde?.onEnemyHurt(e);   // zombie bị bắn mà đàn chưa phát hiện -> cả đàn hú lên lao tới
    const p = this.player;
    // CHÍ MẠNG: x2 sát thương (tỉ lệ gốc của nhân vật + thẻ Mắt Đại Bàng + vũ khí)
    let crit = false;
    if (!opts.noCrit && !opts.quiet && Math.random() < p.mods.crit + (opts.critBonus ?? 0)) { crit = true; dmg *= 2; }
    if (e.freezeT > 0 && p.char.frozenBonus) dmg *= 1 + p.char.frozenBonus;   // Bạch Ngưng Băng: Máu lạnh
    // Khiên Hiệp Sĩ: đòn đến từ chính diện bị giảm 75%
    if (e.cfg.shieldArc && !opts.pierce && !opts.explosive) {
      const from = angle + Math.PI;   // hướng đòn đánh tới (nhìn từ quái)
      if (Math.abs(angleDiff(from, e.facing)) < e.cfg.shieldArc) {
        dmg *= 1 - e.cfg.shieldReduce;
        knock *= 0.3;
        this.sound.play("shieldBlock", 0.4);
        FX.parry(e.cx + Math.cos(e.facing) * 8, e.cy + 10);
      }
    }
    e.hp -= dmg;
    e.flash = 0.08;
    const km = e.boss ? 0.12 : 1;
    e.kx += Math.cos(angle) * knock * km;
    e.ky += Math.sin(angle) * knock * km;
    if (!opts.quiet) {
      if (opts.ice) FX.iceHit(e.cx, e.cy, angle); else FX.hit(e.cx, e.cy, angle);
      this.sound.play("hit", 0.4);
    }
    // >>> GAME JUICE: chí mạng = khựng hình 25ms + số to vàng/đỏ có "!"
    if (crit) { FX.crit(e.cx, e.cy, angle); FX.critText(e.cx, e.cy - 12, dmg); this.sound.play("crit", 0.45); this.hitStop(0.025); }
    else if (!opts.quiet || Math.random() < 0.3) FX.damage(e.cx, e.cy - 10, dmg);
    if (e.hp <= 0) { this.killEnemy(e); return true; }
    return false;
  }

  killEnemy(e, opts = {}) {
    if (e.dead) return;
    e.dead = true;
    this.horde?.onEnemyKilled(e);
    // Zombie Phun Độc (Bloater): chết thì NỔ TUNG túi độc
    if (e.cfg.deathBlast) {
      const b = e.cfg.deathBlast;
      this.explode(e.x, e.cy, { radius: b.radius, damage: b.damage, knock: 220, source: "bloater", hurtPlayer: true, playerRadius: b.radius * 0.8, playerDamage: b.playerDamage });
    }
    if (e.boss) { FX.darkExplosion(e.cx, e.y + 6, 0.75); this.shake(0.6, 6); this.screenFlash("#ffffff", 0.3); this.hitStop(0.14); }
    else if (e.freezeT > 0) effects.play("iceShatter", e.cx, e.y, { aim: 0, scale: 0.5 * Math.min(1.6, e.cfg.scale ?? 1) });   // tượng băng vỡ vụn
    else FX.death(e.cx, e.cy, Math.min(1.6, e.cfg.scale ?? 1));
    this.sound.play("enemyDie", 0.5);
    this.shake(0.12, 2);
    // Tinh Anh "Bạo Liệt": nổ tung bắn cầu lửa ra xung quanh (kể cả bị giết bởi môi trường)
    if (e.affix === "volatile") {
      const n = 8, a0 = Math.random() * TAU;
      for (let i = 0; i < n; i++) this.enemyBullets.push(EnemyBullet.obtain(e.cx, e.cy, a0 + (i / n) * TAU, { speed: 110, radius: 3, style: "fireball", damage: 1 + e.dmgBonus, life: 2.6 }));
      FX.explosion(e.cx, e.cy + 8, 0.5);
    }
    if (opts.noReward) return;
    const p = this.player;
    this.kills++;
    // --- COMBO ---
    this.combo = this.comboT > 0 ? this.combo + 1 : 1;
    this.comboT = COMBO.window;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    if (COMBO.milestones.includes(this.combo)) this.comboReward(this.combo);
    const mult = (1 + Math.min(COMBO.maxBonus, this.combo * COMBO.perKill)) * this.diff.score;
    this.score += Math.round(e.cfg.score * (e.elite ? 3 : 1) * (e.minion ? 0.5 : 1) * mult);
    // rơi ngọc EXP (quái triệu hồi không rơi)
    if (!e.minion) {
      let exp = e.cfg.exp * (e.elite ? 3 : 1);
      while (exp > 0) { const v = exp >= 5 ? 5 : 1; exp -= v; this.orbs.push(ExpOrb.obtain(e.x, e.y - 6, v)); }
    }
    p.onKill(this);   // thẻ Hấp Thụ / Ma Cà Rồng / nội tại Hút Hồn
    // rơi VÀNG & NGỌC NĂNG LƯỢNG (Tinh Anh rơi nhiều, quái triệu hồi rơi ít)
    if (!e.boss) {
      const luck = 1 + p.mods.luck * 0.3;
      if (e.elite) { for (let i = 0; i < 4; i++) this.drops.push(Drop.obtain(e.x, e.y - 6, "gold", GOLD.elite / 4)); for (let i = 0; i < 3; i++) this.drops.push(Drop.obtain(e.x, e.y - 6, "energy", ENERGY.orbValue)); }
      else {
        if (Math.random() < GOLD.chance * luck * (e.minion ? 0.4 : 1)) this.drops.push(Drop.obtain(e.x, e.y - 6, "gold", e.cfg.exp >= 3 ? 2 : 1));
        if (Math.random() < ENERGY.orbChance * (e.minion ? 0.5 : 1)) this.drops.push(Drop.obtain(e.x, e.y - 6, "energy", ENERGY.orbValue));
      }
    }
    // Rút Quân: zombie rơi HỘP ĐẠN (ưu tiên đúng loại súng đang cầm; zombie to rơi nhiều hơn)
    if (AMMO.pool && !e.minion) {
      const big = e.boss || e.cfg.boss || e.cfg.deathBlast || e.elite;
      if (Math.random() < (big ? AMMO_DROP.big : AMMO_DROP.zombie)) this.dropAmmo(e.x, e.y - 2, rollAmmoType(p.weapons.filter(Boolean), 0.8));
    }
    // rơi Tim hồi máu
    const hc = e.elite ? 0.3 : SPAWN.heartChance * (1 + p.mods.luck * 0.75);
    if (!e.minion && !e.boss && Math.random() < hc && this.pickups.filter((k) => k.kind === "heart").length < 4) this.pickups.push(new Pickup(e.x, e.y - 2, "heart", null, { vx: rand(-30, 30), vy: rand(-30, 30) }));
    // Slime khổng lồ tách đôi
    if (e.cfg.split) {
      for (const s of [-1, 1]) {
        const c = Enemy.obtain(e.cfg.split, e.x + s * 8, e.y, this.enemyOpts(), ACTOR_SPRITES);
        c.kx = s * 160; c.spawnTime = 0.2;
        this.enemies.push(c);
      }
    }
    // Ếch Độc: để lại vũng axit
    if (e.cfg.acidOnDeath) { this.addZone(e.x, e.y, { kind: "acid", owner: "enemy", r: 20, life: 4 }); FX.acidSplash(e.x, e.y, 0.35); }
    if (e.elite) this.spawnChest("silver", e.x, e.y);
    if (e.boss) {
      this.bossKills++;
      const ch = this.spawnChest("gold", e.x, e.y);
      if (ch) ch.boss = true;   // rương Boss: vũ khí Sử Thi trở lên (có thể ra Thần Thoại)
      for (let i = 0; i < 8; i++) this.drops.push(Drop.obtain(e.x, e.y - 8, "gold", GOLD.boss / 8));
      for (let i = 0; i < 4; i++) this.drops.push(Drop.obtain(e.x, e.y - 8, "energy", ENERGY.orbValue * 2));
      if (this.mode === "arcade") this.merchantT = 2.2;     // Thương Nhân Bí Ẩn hiện ra ngay sau đó (Chế độ Giải Trí)
      for (const o of this.orbs) o.magnet = true;
      p.armor = p.maxArmor; p.armorFlash = 0.5;
      this.healPlayer(1);
      this.banner(`ĐÃ HẠ ${e.cfg.name.toUpperCase()}! +1 Máu, đầy Giáp`, "#ffe26b", true, 3);
    }
  }

  /** Phần thưởng mốc combo */
  comboReward(n) {
    const p = this.player;
    this.sound.play("combo", 0.6);
    if (n >= 100) { this.healPlayer(1); this.banner(`COMBO x${n}! +1 Máu`, "#ff7ad8", true); }
    else if (n >= 50) { p.armor = Math.min(p.maxArmor, p.armor + 1); p.armorFlash = 0.4; this.banner(`COMBO x${n}! +1 Giáp`, "#7fc8ff", true); }
    else if (n >= 25) { for (const o of this.orbs) o.magnet = true; this.banner(`COMBO x${n}! Hút sạch ngọc`, "#7cf0ff", true); }
    else this.banner(`COMBO x${n}!`, "#ffe26b", true, 1.6);
  }

  /** Vụ nổ diện rộng: { radius, damage, knock, source: "grenade" | "rocket" | "meteor" | "barrel" | "bat", hurtPlayer, playerRadius, burn } */
  explode(x, y, o) {
    const src = o.source;
    if (src === "grenade" || src === "cannon") FX.plasma(x, y);
    else if (src === "void") FX.darkExplosion(x, y + 6, 0.45);
    else if (src === "meteor") { /* hình thiên thạch đã phát từ lúc gọi (addStrike) */ }
    else if (src === "bloater") { FX.acidSplash(x, y + 6, 0.6); FX.explosion(x, y + 8, 0.5); }
    else FX.explosion(x, y + 8, src === "bat" ? 0.45 : src === "rocket" ? 0.55 : 0.8);
    const col = src === "grenade" ? "#7cffb0" : src === "cannon" ? "#5ef0ff" : src === "void" ? "#b05aff" : src === "bloater" ? "#8aff4a" : "#ffb03a";
    this.makeNoise(x, y, src === "bat" || src === "bloater" ? 220 : 460);   // tiếng nổ kéo zombie tới
    this.shocks.push({ x, y, r: o.radius, life: 0.35, max: 0.35, color: col });
    const big = src === "barrel" || src === "meteor" || src === "void";
    const P = this.player;
    this.shake(src === "bat" ? 0.2 : big ? 0.4 : 0.3, src === "bat" ? 3 : big ? 7 : 5, Math.atan2(P.cy - y, P.cx - x));   // đẩy khung hình ra xa tâm nổ
    this.hitStop(0.03);
    this.sound.play(src === "meteor" ? "meteor" : "explosion", 0.7);
    const env = src === "barrel" || src === "bat";
    // chỉ xét quái trong các ô lưới quanh tâm nổ, so khoảng cách BÌNH PHƯƠNG
    const R2 = (r) => r * r;
    for (const e of this.grid.query(x, y, o.radius + MAX_ENEMY_RADIUS, this.qExplode)) {
      if (e.dead) continue;
      if ((e.cx - x) ** 2 + (e.cy - y) ** 2 > R2(o.radius + e.radius)) continue;
      if (o.burn) e.burnT = Math.max(e.burnT, o.burn);
      this.damageEnemy(e, o.damage, Math.atan2(e.cy - y, e.cx - x), o.knock ?? 260, { explosive: true, noCrit: env });
    }
    for (const b of this.world.barrels) if (!b.dead && (b.x - x) ** 2 + (b.y - 6 - y) ** 2 <= R2(o.radius)) this.igniteBarrel(b);
    for (const c of this.world.crystals) if (!c.dead && (c.x - x) ** 2 + (c.y - 8 - y) ** 2 <= R2(o.radius)) this.hitCrystal(c, 99, Math.atan2(c.y - y, c.x - x));
    for (const c of this.world.props) if (!c.dead && (c.x - x) ** 2 + (c.y - c.cy - y) ** 2 <= R2(o.radius + c.r)) this.hitProp(c, 99, Math.atan2(c.y - y, c.x - x), !env || src === "barrel");
    const p = this.player;
    if (o.hurtPlayer && (p.cx - x) ** 2 + (p.cy - y) ** 2 <= R2(o.playerRadius ?? o.radius)) p.hurt(this, x, y, o.playerDamage ?? 1);
  }

  igniteBarrel(b) { if (!b.dead && b.fuse < 0) { b.fuse = ENV.barrel.fuse; b.flash = 0.1; } }

  /**
   * Đánh trúng THÙNG GỖ / LỌ NĂNG LƯỢNG / BỤI CÂY. Trả về true nếu vật vừa vỡ.
   * byPlayer = false: bị đạn quái bắn vỡ (không rơi đồ).
   */
  hitProp(o, dmg, angle, byPlayer = true) {
    if (o.dead) return false;
    o.hp -= dmg >= 99 ? o.hp : Math.max(0.25, dmg);
    o.flash = 0.08;
    if (o.hp > 0) { if (byPlayer) FX.hit(o.x, o.y - o.cy, angle); return false; }
    o.dead = true;
    if (o.kind === "bush") { for (let i = 0; i < 8; i++) this.puff(o.x + rand(-8, 8), o.y - rand(2, 12), "leaf"); this.sound.play("hit", 0.3); }
    else { FX.death(o.x, o.y - 4, 0.6); this.sound.play(o.kind === "jar" ? "iceBreak" : "shieldBlock", 0.4); for (let i = 0; i < 6; i++) this.puff(o.x + rand(-6, 6), o.y - rand(2, 10), o.kind === "jar" ? "glass" : "wood"); }
    if (!byPlayer) return true;
    const P = this.player;
    if (o.kind === "crate") {
      const n = 1 + ((Math.random() * 3) | 0);
      for (let i = 0; i < n; i++) this.drops.push(Drop.obtain(o.x, o.y - 6, "gold", 1));
      if (Math.random() < 0.35) this.drops.push(Drop.obtain(o.x, o.y - 6, "energy", ENERGY.orbValue));
      if (Math.random() < 0.12 && P.hp < P.maxHp) this.pickups.push(new Pickup(o.x, o.y - 2, "heart", null, { vx: rand(-30, 30), vy: rand(-30, 30) }));
    } else if (o.kind === "jar") {
      for (let i = 0; i < 3; i++) this.drops.push(Drop.obtain(o.x, o.y - 5, "energy", ENERGY.orbValue));
      if (Math.random() < 0.18) this.pickups.push(new Pickup(o.x, o.y - 2, "heart", null, { vx: rand(-30, 30), vy: rand(-30, 30) }));
    } else if (Math.random() < 0.15) this.drops.push(Drop.obtain(o.x, o.y - 6, "gold", 1));
    return true;
  }

  /** Đòn đánh vùng tròn (búa): thùng nổ, tinh thể, thùng gỗ trong bán kính R */
  hitArea(x, y, R, dmg, aim) {
    for (const b of this.world.barrels) if (!b.dead && (b.x - x) ** 2 + (b.y - 6 - y) ** 2 < (R + b.r) ** 2) this.igniteBarrel(b);
    for (const c of this.world.crystals) if (!c.dead && (c.x - x) ** 2 + (c.y - 8 - y) ** 2 < (R + c.r) ** 2) this.hitCrystal(c, dmg, aim);
    for (const c of this.world.props) if (!c.dead && (c.x - x) ** 2 + (c.y - c.cy - y) ** 2 < (R + c.r) ** 2) this.hitProp(c, dmg, aim);
  }
  /** Đòn chém hình quạt (kiếm, găng...): vật thể trong bán kính r và nửa cung arc quanh hướng aim */
  hitArc(cx, cy, r, arc, aim, dmg) {
    const inArc = (ox, oy, rr) => (ox - cx) ** 2 + (oy - cy) ** 2 < rr * rr && Math.abs(angleDiff(Math.atan2(oy - cy, ox - cx), aim)) <= arc;
    for (const b of this.world.barrels) if (!b.dead && inArc(b.x, b.y - 6, r + b.r)) this.igniteBarrel(b);
    for (const c of this.world.crystals) if (!c.dead && inArc(c.x, c.y - 8, r + c.r)) this.hitCrystal(c, dmg, aim);
    for (const c of this.world.props) if (!c.dead && inArc(c.x, c.y - c.cy, r + c.r)) this.hitProp(c, dmg, aim);
  }

  /** Nhặt Vàng / Ngọc Năng Lượng (Drop tự bay về) */
  collectDrop(d) {
    const p = this.player;
    if (d.kind === "gold") {
      this.gold += d.value; this.goldTotal += d.value;
      this.goldFlash = 0.3;
      this.sound.play("expPickup", 0.25);
    } else {
      p.energy = Math.min(p.maxEnergy, p.energy + d.value);
      p.energyFlash = 0.25;
      this.sound.play("expPickup", 0.3);
    }
  }

  /** Sét nhảy từ quái `from` sang n quái gần nhất (Cung Thần Bão) */
  zapChain(from, dmg, n, color = "#a8e0ff") {
    const hit = new Set([from]), pts = [[from.cx, from.cy]];
    let cur = from;
    for (let k = 0; k < n; k++) {
      let next = null, nd = 110 * 110;
      for (const e of this.enemiesNear(cur.cx, cur.cy, 110)) {
        if (e.dead || hit.has(e)) continue;
        const d2 = (e.cx - cur.cx) ** 2 + (e.cy - cur.cy) ** 2;
        if (d2 < nd) { nd = d2; next = e; }
      }
      if (!next) break;
      hit.add(next); pts.push([next.cx, next.cy]);
      this.damageEnemy(next, dmg, Math.atan2(next.cy - cur.cy, next.cx - cur.cx), 40, { pierce: true, quiet: true });
      FX.zap(next.cx, next.cy);
      cur = next;
    }
    if (pts.length > 1) { this.bolts.push({ pts: jaggedPath(pts), life: 0.16, max: 0.16, color }); this.sound.play("zap", 0.3); }
  }

  /** Lỗ đen (Pháo Hư Không): hút quái trong bán kính r về tâm */
  pullEnemies(x, y, r, dt) {
    for (const e of this.enemiesNear(x, y, r)) {
      if (e.dead) continue;
      const dx = x - e.cx, dy = y - e.cy, d2 = dx * dx + dy * dy;
      if (d2 > r * r || d2 < 16) continue;
      const d = Math.sqrt(d2), f = (e.boss ? 120 : 900) * dt * (1 - d / r + 0.3);
      e.kx += (dx / d) * f; e.ky += (dy / d) * f;
    }
    if (Math.random() < dt * 30) this.puff(x + rand(-r, r) * 0.5, y + rand(-r, r) * 0.4, "void");
  }

  /** Vỏ đạn văng ra khỏi súng, nảy trên sàn rồi nằm lại một lúc */
  ejectShell(x, y, aim, kind = "brass") {
    if (this.shells.length > 90) this.shells.shift();
    const side = Math.cos(aim) < 0 ? 1 : -1, a = aim + Math.PI * 0.62 * side + rand(-0.25, 0.25), sp = rand(50, 90);
    this.shells.push({ x, y: y + 12, z: 12, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.5, vz: rand(60, 100), rot: rand(0, TAU), vr: rand(-18, 18), life: 2.6, kind, bounced: 0 });
  }
  updateShells(dt) {
    for (const s of this.shells) {
      s.life -= dt;
      if (s.z > 0 || s.vz > 0) {
        s.vz -= 420 * dt; s.z += s.vz * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.rot += s.vr * dt;
        if (s.z <= 0) { s.z = 0; if (s.bounced++ < 2 && s.vz < -40) { s.vz = -s.vz * 0.4; s.vx *= 0.5; s.vy *= 0.5; s.vr *= 0.5; } else { s.vz = 0; s.vx = s.vy = 0; } }
      }
    }
    sweepLife(this.shells);
  }

  hitCrystal(c, dmg, angle) {
    if (c.dead) return;
    c.hp -= dmg >= 99 ? c.hp : 1;
    c.flash = 0.08;
    if (c.hp > 0) { FX.hit(c.x, c.y - 8, angle); this.sound.play("shieldBlock", 0.3); return; }
    // vỡ: bắn mảnh băng tỏa tròn (gây sát thương lên quái)
    c.dead = true;
    FX.iceShatter(c.x, c.y, angle);
    this.sound.play("iceBreak", 0.6);
    this.shake(0.15, 2);
    const n = ENV.crystal.shards;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + rand(-0.15, 0.15);
      this.bullets.push(Bullet.obtain(c.x, c.y - 8, a, { speed: 260, damage: ENV.crystal.shardDamage, radius: 2, style: "shard", life: 0.55, knock: 120 }));
    }
  }

  batExplode(e) {
    this.explode(e.cx, e.cy, { radius: e.cfg.blast, damage: 2, knock: 200, source: "bat", hurtPlayer: true, playerRadius: e.cfg.blast, playerDamage: 1 + e.dmgBonus });
    this.killEnemy(e, { noReward: true });
  }

  /** Vua Slime đáp đất: sóng chấn động gây sát thương người chơi trong bán kính r */
  bossSlam(x, y, r, dmg) {
    FX.slam(x, y, 0.65);
    this.shocks.push({ x, y: y - 6, r, life: 0.4, max: 0.4, color: "#ff5a5a" });
    this.sound.play("bossSlam", 0.8);
    this.shake(0.4, 6);
    const p = this.player;
    if ((p.x - x) ** 2 + ((p.y - y) * 1.6) ** 2 <= r * r) p.hurt(this, x, y, dmg);
  }

  /** Giáp Gai / hồi sinh: hất văng + sát thương quái quanh người chơi */
  thornsBurst(p, dmg, R = 52) {
    this.shocks.push({ x: p.cx, y: p.cy, r: R, life: 0.3, max: 0.3, color: "#c8a24a" });
    for (const e of this.enemiesNear(p.cx, p.cy, R)) {
      if (e.dead) continue;
      const rr = R + e.radius;
      if ((e.cx - p.cx) ** 2 + (e.cy - p.cy) ** 2 > rr * rr) continue;
      this.damageEnemy(e, dmg * p.mods.damageMul, Math.atan2(e.cy - p.cy, e.cx - p.cx), 320, { pierce: true, noCrit: true });
    }
  }

  // ---------- VÙNG HIỆU ỨNG (mây độc của người chơi, vũng axit của quái) ----------
  addZone(x, y, o) {
    if (this.zones.length > 40) this.zones.shift();
    this.zones.push({ x, y, r: o.r ?? 30, life: o.life ?? 3, max: o.life ?? 3, tick: o.tick ?? 0.4, acc: 0, dmg: o.dmg ?? 0.4, slow: o.slow ?? 0, kind: o.kind ?? "poison", owner: o.owner ?? "player", seed: Math.random() * 10 });
  }
  updateZones(dt) {
    const p = this.player;
    for (const z of this.zones) {
      z.life -= dt; z.acc -= dt;
      if (z.owner === "player") {
        if (z.acc > 0) continue;
        z.acc = z.tick;
        for (const e of this.grid.query(z.x, z.y - 8, z.r + MAX_ENEMY_RADIUS, this.qZone)) {
          if (e.dead) continue;
          if ((e.x - z.x) ** 2 + ((e.y - z.y) * 1.4) ** 2 > (z.r + e.radius * 0.5) ** 2) continue;
          if (z.slow) e.slowT = Math.max(e.slowT, z.slow);
          this.damageEnemy(e, z.dmg, 0, 0, { quiet: true, pierce: true, noCrit: true });
        }
      } else if ((p.x - z.x) ** 2 + ((p.y - z.y) * 1.4) ** 2 < z.r * z.r) {   // axit của quái: làm chậm + rút giáp
        p.slowT = Math.max(p.slowT, 0.3);
        if (z.acc <= 0) { z.acc = 1; if (!p.invulnerable && p.armor > 0) { p.armor--; p.armorFlash = 0.3; p.sinceHit = 0; this.sound.play("armorHit", 0.3); } }
      }
    }
    sweepLife(this.zones);
  }

  // ---------- ĐÒN ĐÁNH CHẬM (thiên thạch): vòng cảnh báo rồi nổ ----------
  addStrike(o) {
    const s = { t: 0, ...o };
    this.strikes.push(s);
    if (s.kind === "meteor") { FX.meteor(s.x, s.y, s.delay, s.r / 100); this.sound.play("meteorCast", 0.4); }
  }
  updateStrikes(dt) {
    for (const s of this.strikes) {
      s.t += dt;
      if (s.t < s.delay) continue;
      s.dead = true;
      const fromPlayer = s.owner === "player";
      this.explode(s.x, s.y - 4, { radius: s.r, damage: s.damage, knock: s.knock ?? 260, source: "meteor", burn: s.burn ?? 0, hurtPlayer: !fromPlayer, playerRadius: s.r * 0.8, playerDamage: 1 });
      if (!fromPlayer) FX.explosion(s.x, s.y + 4, 0.45);
    }
    sweep(this.strikes);
  }

  // ---------- MƯA TÊN (Thợ Săn) ----------
  updateRains(dt) {
    for (const R of this.rains) {
      R.t += dt; R.acc += dt;
      while (R.acc >= R.every && R.left > 0) {
        R.acc -= R.every; R.left--;
        let tx, ty;
        const cands = [];
        for (const e of this.enemiesNear(R.x, R.y, R.r)) if (!e.dead && (e.x - R.x) ** 2 + (e.y - R.y) ** 2 < R.r * R.r) cands.push(e);
        if (cands.length && Math.random() < 0.75) { const e = cands[(Math.random() * cands.length) | 0]; tx = e.x + rand(-3, 3); ty = e.y + rand(-2, 2); }
        else { const a = rand(0, TAU), d = Math.sqrt(Math.random()) * R.r; tx = R.x + Math.cos(a) * d; ty = R.y + Math.sin(a) * d * 0.7; }
        R.falling.push({ x: tx, y: ty, t: 0, dur: 0.2, done: false });
      }
      for (const f of R.falling) {
        f.t += dt;
        if (f.done || f.t < f.dur) continue;
        f.done = true;
        for (const e of this.enemiesNear(f.x, f.y, 12)) {
          if (e.dead || (e.x - f.x) ** 2 + ((e.y - f.y) * 1.3) ** 2 > (11 + e.radius * 0.5) ** 2) continue;
          e.slowT = Math.max(e.slowT, 1);
          this.damageEnemy(e, R.dmg, -Math.PI / 2, 30);
        }
        for (const b of this.world.barrels) if (!b.dead && (b.x - f.x) ** 2 + (b.y - f.y) ** 2 < 100) this.igniteBarrel(b);
      }
      if (R.falling.length > 40) R.falling.splice(0, R.falling.length - 40);
      if (R.left <= 0 && R.t > R.dur + 0.9) R.dead = true;
    }
    sweep(this.rains);
  }

  // ---------- VONG LINH (Tử Linh Sư) ----------
  updateMinions(dt) {
    const p = this.player;
    for (const m of this.minions) {
      m.t += dt; m.life -= dt;
      if (m.life <= 0) { FX.death(m.x, m.y + 6, 0.4); m.dead = true; continue; }
      const t = m.target;
      if (t && (t.dead || t.serial !== m.serial)) m.target = null;
      if (m.delay > 0) m.delay -= dt;
      else if (!m.target) {
        let best = 230 * 230;
        for (const e of this.enemiesNear(p.cx, p.cy, 230)) {
          if (e.dead || e.spawnTime > 0.2) continue;
          const d2 = (e.cx - m.x) ** 2 + (e.cy - m.y) ** 2;
          if (d2 < best) { best = d2; m.target = e; m.serial = e.serial; }
        }
      }
      let tx, ty, sp;
      if (m.target) { tx = m.target.cx; ty = m.target.cy; sp = 185; }
      else { m.a += dt * 2.6; tx = p.cx + Math.cos(m.a) * 24; ty = p.cy - 4 + Math.sin(m.a) * 13; sp = 140; }
      const dx = tx - m.x, dy = ty - m.y, d = Math.hypot(dx, dy) || 1;
      const step = Math.min(d, sp * dt);
      m.x += (dx / d) * step; m.y += (dy / d) * step;
      if (Math.random() < dt * 14) this.puff(m.x, m.y, "soul");
      if (m.target && d < m.target.radius + 6) {   // chạm quái: NỔ
        m.dead = true;
        FX.darkExplosion(m.x, m.y + 10, 0.3);
        this.sound.play("explosion", 0.35);
        this.shocks.push({ x: m.x, y: m.y, r: m.r, life: 0.25, max: 0.25, color: "#45f0b0" });
        for (const e of this.grid.query(m.x, m.y, m.r + MAX_ENEMY_RADIUS, this.qExplode)) {
          if (e.dead || (e.cx - m.x) ** 2 + (e.cy - m.y) ** 2 > (m.r + e.radius) ** 2) continue;
          this.damageEnemy(e, m.dmg, Math.atan2(e.cy - m.y, e.cx - m.x), 180, { explosive: true });
        }
      }
    }
    sweep(this.minions);
  }

  // ---------- SỰ KIỆN NGẪU NHIÊN ----------
  startEvent() {
    const p = this.player, list = ["bats", "meteors", "treasure", "elites", "statue"].filter((k) => k !== this.lastEvent);
    const kind = list[(Math.random() * list.length) | 0];
    this.lastEvent = kind;
    this.sound.play("event", 0.7);
    switch (kind) {
      case "bats": {
        const n = 5 + Math.min(8, this.wave);
        for (let i = 0; i < n; i++) {
          const a = (i / n) * TAU, x = clamp(p.x + Math.cos(a) * 240, WORLD.wall + 20, WORLD.w - WORLD.wall - 20), y = clamp(p.y + Math.sin(a) * 150, WORLD.wallTop + 30, WORLD.h - WORLD.wall - 10);
          this.queueSpawn("bat", x, y, this.enemyOpts(), SPAWN.telegraph + i * 0.05);
        }
        this.banner("SỰ KIỆN: BẦY DƠI CẢM TỬ ĐANG TỚI!", "#ff7a7a", true, 3);
        break;
      }
      case "meteors":
        this.event = { kind, t: 7, acc: 0.6 };
        this.banner("SỰ KIỆN: MƯA THIÊN THẠCH! Tránh vòng đỏ!", "#ff8a2a", true, 3);
        break;
      case "statue": {   // TƯỢNG THẦN: dâng vàng cầu phúc
        const pt = this.world.randomFreePoint({ near: { x: p.x, y: p.y }, minD: 70, maxD: 150, margin: 16 });
        if (!pt) break;
        this.npcs.push(new GodStatue(pt.x, pt.y));
        FX.holyPillar(pt.x, pt.y + 2, 0.6);
        this.banner("SỰ KIỆN: TƯỢNG THẦN HIỆN RA!", "#ffe26b", true, 3.2);
        this.banner(`Lại gần bấm ${TOUCH ? "nút E" : "E"}, dâng ${STATUE.prices[0]} Vàng để nhận bùa ${STATUE.buffTime}s · biến mất sau ${STATUE.life}s`, "#fff2a8", false, 3.2);
        break;
      }
      case "treasure":
        this.spawnChest("gold", undefined, undefined, true);
        this.banner("SỰ KIỆN: RƯƠNG VÀNG xuất hiện đâu đó — theo mũi tên!", "#ffe26b", true, 3);
        break;
      case "elites": {
        for (let i = 0; i < 2; i++) {
          const pt = this.world.randomFreePoint({ near: { x: p.x, y: p.y }, minD: 160, maxD: 300, margin: 14 });
          if (!pt) continue;
          const type = pickEnemyType(this.time, this.world.biome.spawnBias);
          this.queueSpawn(type === "bat" ? "knight" : type, pt.x, pt.y, this.enemyOpts({ elite: true }), 0.8);
        }
        this.banner("SỰ KIỆN: QUÁI TINH ANH SĂN ĐUỔI! (rơi Vàng & Rương Bạc)", "#ffb030", true, 3);
        break;
      }
    }
  }
  updateEvent(dt) {
    this.eventTimer -= dt;
    if (this.eventTimer <= 0) {
      this.eventTimer = rand(SPAWN.eventEvery[0], SPAWN.eventEvery[1]);
      if (!this.boss && this.time > SPAWN.eventAfter) this.startEvent();
    }
    const E = this.event;
    if (!E) return;
    E.t -= dt; E.acc -= dt;
    if (E.kind === "meteors" && E.acc <= 0) {
      E.acc = 0.42;
      const p = this.player, a = rand(0, TAU), d = rand(20, 210);
      const x = clamp(p.x + Math.cos(a) * d, WORLD.wall + 30, WORLD.w - WORLD.wall - 30), y = clamp(p.y + Math.sin(a) * d * 0.75, WORLD.wallTop + 40, WORLD.h - WORLD.wall - 20);
      this.addStrike({ kind: "meteor", x, y, r: 46, delay: 0.9, damage: 6, knock: 240, burn: 1.5, owner: "event" });
    }
    if (E.t <= 0) this.event = null;
  }

  // ---------- EXP & lên cấp ----------
  gainExp(v) {
    this.exp += v;
    this.sound.play("expPickup", 0.4);
    while (this.exp >= this.expNeed) {
      this.exp -= this.expNeed;
      this.level++;
      this.expNeed = expToNext(this.level);
      this.pendingLevels++;
      if (this.player.char.levelHeal) this.healPlayer(this.player.char.levelHeal);   // Thánh Kỵ Sĩ: Phúc lành
    }
    if (this.pendingLevels > 0 && !this.choosing) this.openLevelUp();
  }

  openLevelUp() {
    this.choosing = true;
    this.perkChoices = rollPerks(3, this.player.perksTaken);
    input.mouse.left = false;
    this.sound.play("levelUp", 0.7);
    FX.levelUp(this.player.x, this.player.y + 2);
    this.ui.showLevelUp(this.level - this.pendingLevels + 1, this.perkChoices, this.player.perksTaken, this.rerolls);
  }

  choosePerk(i) {
    const perk = this.perkChoices[i];
    if (!this.choosing || !perk) return;
    perk.apply(this.player, this);
    if (!perk.fallback) this.player.perksTaken[perk.id] = (this.player.perksTaken[perk.id] ?? 0) + 1;
    this.perkLog.push(perk.id);
    this.pendingLevels--;
    this.sound.play("pickup", 0.6);
    this.banner(`+ ${perk.name}`, perk.color);
    if (this.pendingLevels > 0) { this.perkChoices = rollPerks(3, this.player.perksTaken); this.ui.showLevelUp(this.level - this.pendingLevels + 1, this.perkChoices, this.player.perksTaken, this.rerolls); }
    else { this.choosing = false; this.ui.hideLevelUp(); input.mouse.left = false; }
  }

  /** Đổi bộ thẻ khác (tối đa 3 lần / trận) */
  rerollPerks() {
    if (!this.choosing || this.rerolls <= 0) return;
    this.rerolls--;
    this.perkChoices = rollPerks(3, this.player.perksTaken);
    this.sound.play("swap", 0.6);
    this.ui.showLevelUp(this.level - this.pendingLevels + 1, this.perkChoices, this.player.perksTaken, this.rerolls);
  }

  // ---------- UPDATE ----------
  update(dt) {
    this.touch?.sync(this, TOUCH && this.state === GAME_STATE.PLAYING && (!this.run || this.run.playing));
    if (input.pressed.has("m")) this.ui.toggleMute();
    if (input.pressed.has("h")) this.debug = !this.debug;
    if (input.pressed.has("l") && this.state === GAME_STATE.PLAYING) { this.light.enabled = !this.light.enabled; this.banner(this.light.enabled ? "Ánh sáng: BẬT" : "Ánh sáng: TẮT (nhẹ máy hơn)", "#b8b0d0"); }
    switch (this.state) {
      case GAME_STATE.MENU: effects.update(dt); return this.ui.updateMenu(dt);
      case GAME_STATE.CABIN: return this.ui.updateCabin(dt, this.cabin.update(dt, this.sound, input, true));
      case GAME_STATE.GAME_OVER: return this.updateGameOver(dt);
      case GAME_STATE.PLAYING: return this.updatePlaying(dt);
    }
  }

  updateGameOver(dt) {
    this.camera.updateShake(dt);
    this.updateFx(dt);
    if (!this.overShown) {
      this.overTimer -= dt;
      if (this.overTimer <= 0) { this.overShown = true; if (this.run?.result) this.ui.showExtractResult(this.run.result); else this.ui.showGameOver(); }
      return;
    }
    if (input.pressed.has("enter") || input.pressed.has("r")) this.start(this.charIndex);
    else if (input.pressed.has("escape")) this.goMenu();
  }

  updatePlaying(dt) {
    // Đang chọn thẻ nâng cấp: game tạm dừng
    if (this.choosing) {
      if (AUTOPLAY) this.choosePerk(0);
      for (const k of ["1", "2", "3"]) if (input.pressed.has(k)) this.choosePerk(Number(k) - 1);
      if (input.pressed.has("r")) this.rerollPerks();
      return;
    }
    // Đang mở quầy Thương Nhân: game tạm dừng
    if (this.shopping) {
      if (AUTOPLAY) this.closeShop();
      for (const k of ["1", "2", "3", "4"]) if (input.pressed.has(k)) this.buyItem(Number(k) - 1);
      if (input.pressed.has("escape") || input.pressed.has("e")) this.closeShop();
      return;
    }
    // Rút Quân: bản đồ chiến thuật / đang thả dù
    if (this.run && (this.run.phase === "tacmap" || this.run.phase === "jumpcut" || this.run.phase === "airdrop")) return this.updateDeploy(dt);
    if (input.pressed.has("p") || input.pressed.has("escape")) this.paused = !this.paused;
    if (this.debug && input.pressed.has("j")) this.spawnHorde(50);   // thử tải: +50 quái
    if (TOUCH && isPortrait()) this.paused = true;   // cầm dọc điện thoại: tự tạm dừng, chờ xoay ngang
    if (this.paused) { if (input.pressed.has("q") && !TOUCH) this.goMenu(); return; }

    this.camera.updateShake(dt);
    this.hurtFlash = Math.max(0, this.hurtFlash - dt);
    if (this.flashFx && (this.flashFx.t -= dt) <= 0) this.flashFx = null;
    if (this.freeze > 0) { this.freeze -= dt; return; }

    this.time += dt;
    const p = this.player, world = this.world;
    world.update(dt);
    if (AUTOPLAY) autoplay(this);
    this.grid.rebuild(this.enemies);          // để đòn đánh / lướt của người chơi tìm quái nhanh
    p.update(dt, this);
    if (this.comboT > 0 && (this.comboT -= dt) <= 0) this.combo = 0;

    if (this.mode === "arcade") this.updateArcadeSpawns(dt, p);
    this.updatePending(dt);

    // Rút Quân: não bộ các đàn zombie chạy TRƯỚC khi cập nhật từng con
    this.horde?.update(dt);
    // VIEWPORT CULLING: zombie đi tuần ở xa camera chỉ cập nhật rẻ (không va chạm / hoạt ảnh), quái gần cập nhật đầy đủ
    const H = this.horde;
    for (const e of this.enemies) { if (H && !H.shouldUpdate(e)) H.cheapUpdate(e, dt); else e.update(dt, this); }
    this.afterEnemies(dt, p);
  }

  /** CHẾ ĐỘ GIẢI TRÍ: sinh quái lẻ quanh người chơi, rương, đợt + Boss, sự kiện, Thương Nhân (logic cũ, giữ nguyên) */
  updateArcadeSpawns(dt, p) {
    // --- Sinh quái: nhanh dần theo thời gian, đông dần theo đợt; khi có Boss thì thưa hơn ---
    const boss = this.boss;
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && this.enemies.length + this.pending.length < this.maxEnemies) {
      this.spawnEnemy();
      if (this.time > SPAWN.extraAfter && Math.random() < SPAWN.extraChance * this.diff.spawn) this.spawnEnemy();
      this.spawnTimer = Math.max(SPAWN.minInterval, SPAWN.startInterval - this.time * SPAWN.rampPerSec) / this.diff.spawn * (boss ? 1.8 : 1);
    }
    // --- Rương mỗi 25 giây (Bùa May Mắn: nhanh hơn) ---
    this.chestTimer -= dt;
    if (this.chestTimer <= 0) {
      this.chestTimer = SPAWN.chestEvery * (1 - 0.2 * p.mods.luck);
      if (this.chests.filter((c) => !c.opened).length < SPAWN.maxChests) this.spawnChest(Math.random() < 0.7 ? "wood" : "silver");
    }
    // --- Hết ĐỢT (60 giây): Boss xuất hiện, sang đợt mới ---
    this.bossTimer -= dt;
    if (this.bossTimer <= 0) {
      if (!boss) {
        this.spawnBoss();
        this.wave++;
        this.bossTimer = SPAWN.bossEvery;
        this.banner(`ĐỢT ${this.wave} — quái mạnh hơn!`, "#ff9a5a", true, 3);
        this.sound.play("waveStart", 0.6);
        this.score += 100 * (this.wave - 1);
      } else this.bossTimer = 5;
    }
    this.updateEvent(dt);
    // Thương Nhân Bí Ẩn xuất hiện sau khi hạ Boss
    if (this.merchantT > 0 && (this.merchantT -= dt) <= 0) this.spawnMerchant();
  }

  /** Phần chung của 2 chế độ sau khi quái đã di chuyển: va chạm, vật phẩm, hiệu ứng, camera */
  afterEnemies(dt, p) {
    const world = this.world;
    // quái đã di chuyển -> xếp lại lưới không gian, rồi tản đội hình
    this.grid.rebuild(this.enemies);
    this.separateEnemies(dt);
    for (const b of this.bullets) b.update(dt, this);
    for (const b of this.enemyBullets) b.update(dt, this);

    // --- Va chạm: đạn người chơi -> quái (chỉ xét quái trong các ô lưới quanh viên đạn) ---
    for (const b of this.bullets) {
      if (b.dead) continue;
      const near = this.grid.query(b.x, b.y, b.radius + MAX_ENEMY_RADIUS, this.qBullet);
      for (let i = 0; i < near.length; i++) {
        const e = near[i];
        if (e.dead || e.spawnTime > 0.2 || !b.canHit(e)) continue;
        const dx = b.x - e.cx, dy = b.y - e.cy, rr = b.radius + e.radius;
        if (dx * dx + dy * dy <= rr * rr) {        // khoảng cách bình phương, không Math.sqrt
          const angle = Math.atan2(b.vy, b.vx);
          const keepFlying = b.onHitEnemy(e, this);   // đốt / làm chậm / xuyên / bật sang quái khác
          this.damageEnemy(e, b.damage, angle, b.knock, { quiet: b.style === "flame", ice: b.style === "iceSpike", critBonus: b.critBonus });
          if (!keepFlying) { b.finish(this); break; }
        }
      }
    }
    // --- Va chạm: đạn quái -> người chơi ---
    for (const b of this.enemyBullets) {
      if (!b.dead && enemyBulletHitsPlayer(b, p)) {
        if (!p.invulnerable) {
          b.dead = true;
          if (b.slow) p.slowT = Math.max(p.slowT, b.slow);
          p.hurt(this, b.x - b.vx, b.y - b.vy, b.damage);
        }
      }
    }
    // --- Va chạm: thân quái -> người chơi ---
    for (const e of this.grid.query(p.cx, p.cy, p.radius + MAX_ENEMY_RADIUS, this.qContact)) {
      if (!e.dead && e.canHurt && circleHit(p.cx, p.cy, p.radius, e.cx, e.cy, e.radius)) p.hurt(this, e.cx, e.cy, e.contactDamage);
    }

    this.updateHazards(dt);
    this.updateIceLines(dt);
    this.updateZones(dt);
    this.updateStrikes(dt);
    this.updateRains(dt);
    this.updateMinions(dt);
    // Rút Quân: đồng hồ, nhiệm vụ, hòm đồ, mìn, lựu đạn, pháo sáng, trực thăng, vùng độc
    if (this.run) {
      this.run.update(dt);
      for (let i = 0; i < BAG_SLOTS; i++) if (BAG_KEYS[i].some((k) => input.pressed.has(k))) this.run.useSlot(i);   // Túi Chiến Thuật Z X C V / 3 4 5 6
    }
    if (input.pressed.has("r")) startReload(p.weapon, this);   // nạp đạn tay (súng thật)

    // --- Rương, vật phẩm, ngọc EXP ---
    for (const c of this.chests) { c.update(dt); if (!c.opened && circleHit(p.x, p.y - 6, p.radius, c.x, c.y - 6, c.radius)) this.openChest(c); }
    for (const pk of this.pickups) {
      pk.update(dt, this);
      if (pk.kind === "weapon") continue;                       // vũ khí: bấm E để nhặt (xem interact)
      const touching = circleHit(p.x, p.y - 4, p.radius + 2, pk.x, pk.y - 4, pk.radius);
      if (pk.blockedUntilLeave) { if (!touching) pk.blockedUntilLeave = false; }
      else if (touching && pk.age > 0.35) {
        if (pk.kind === "heart" && p.hp >= p.maxHp) continue;   // đầy máu thì để dành tim
        this.collectPickup(pk);
      }
    }
    for (const o of this.orbs) o.update(dt, this);
    for (const d of this.drops) d.update(dt, this);
    this.updateShells(dt);
    updateGunFx(dt);
    for (const n of this.npcs) n.update(dt);
    sweep(this.npcs);
    // --- Tương tác (E): nhặt vũ khí, mở quầy Thương Nhân, cầu phúc Tượng Thần · GHÉP vũ khí (G) ---
    this.interactTarget = this.findInteract();
    if (input.pressed.has("e") && this.interactTarget) this.interact(this.interactTarget);
    if (input.pressed.has("g") && p.mergeable) p.mergeWeapons(this);
    this.goldFlash = Math.max(0, (this.goldFlash ?? 0) - dt);
    p.energyFlash = Math.max(0, (p.energyFlash ?? 0) - dt);
    for (const q of this.particles) { q.life -= dt; q.x += q.vx * dt; q.y += q.vy * dt; }

    // --- Hiệu ứng ngắn ---
    for (const list of [this.beams, this.waves, this.shocks, this.flashes, this.banners, this.bolts]) for (const b of list) b.life -= dt;

    // --- Dọn mảng TẠI CHỖ + trả đối tượng chết về Object Pool (không .filter() tạo mảng mới mỗi frame) ---
    sweep(this.bullets, Bullet.pool);
    sweep(this.enemyBullets, EnemyBullet.pool);
    sweep(this.enemies, Enemy.pool);
    sweep(this.orbs, ExpOrb.pool);
    sweep(this.drops, Drop.pool);
    sweep(this.chests);
    sweep(this.pickups);
    for (const list of [this.beams, this.bolts, this.waves, this.shocks, this.flashes, this.banners, this.particles]) sweepLife(list);
    this.updateFx(dt);
    this.ambient?.update(dt, this.camera);

    // --- Camera bám theo, nhìn hơi lệch theo hướng chuột ---
    const m = aimPoint(p);
    this.camera.follow(p.x, p.cy, dt, clamp((m.x - p.x) * 0.18, -40, 40), clamp((m.y - p.cy) * 0.18, -26, 26));

    if (p.hp <= 0) {
      if (p.mods.phoenix > 0 && !this.reviveUsed) this.revive();
      else this.gameOver();
    }
  }

  // ---------- RÚT QUÂN: BẢN ĐỒ CHIẾN THUẬT & THẢ DÙ ----------
  updateDeploy(dt) {
    const run = this.run, p = this.player;
    this.camera.updateShake(dt);
    this.updateFx(dt);
    if (this.flashFx && (this.flashFx.t -= dt) <= 0) this.flashFx = null;
    if (run.phase === "tacmap") {
      if (!AUTOPLAY) this.cabin.ambience(dt, this.sound);   // vẫn đang trên máy bay: giữ tiếng động cơ, gió, nổ
      const r = AUTOPLAY ? "jump" : run.tacmap.update(dt, input);
      if (r === "jump") {
        stage.classList.add("in-game"); this.sound.play("uiStart", 0.5);
        if (AUTOPLAY) run.beginAirdrop(run.tacmap.chosen);
        else { run.phase = "jumpcut"; run.jumpLZ = run.tacmap.chosen; this.cabin.startJump(); }   // CẢNH NHẢY KHỎI MÁY BAY trước khi thả dù
      }
      else if (r === "back") this.abortExtraction();
      return;
    }
    if (run.phase === "jumpcut") {
      let ev = this.cabin.update(dt, this.sound, null, false);
      const k = input.pressed;
      if (!ev && this.cabin.seq?.t > 0.3 && (k.has("enter") || k.has(" ") || k.has("escape") || k.has("mouse0"))) ev = this.cabin.skip();
      if (ev === "jumped") run.beginAirdrop(run.jumpLZ);
      return;
    }
    // đang thả dù: thế giới vẫn sống (đuốc, mây...), zombie đứng chờ
    this.time += dt;
    this.world.update(dt);
    this.ambient?.update(dt, this.camera);
    for (const list of [this.shocks, this.banners]) for (const b of list) b.life -= dt;
    sweepLife(this.shocks); sweepLife(this.banners);
    this.grid.rebuild(this.enemies);
    const ev = run.airdrop.update(dt);
    if (ev === "landed") { this.grid.rebuild(this.enemies); }
    if (ev === "done") run.landed();
    void p;
  }

  // ---------- TƯƠNG TÁC (E) ----------
  /** Vật gần nhất có thể tương tác: { kind: "weapon" | "merchant" | "statue", ref } */
  findInteract() {
    const p = this.player;
    let best = null, bd = 26 * 26;
    for (const pk of this.pickups) {
      if (pk.kind !== "weapon" || pk.dead || pk.age < 0.3) continue;
      const d = (pk.x - p.x) ** 2 + (pk.y - p.y) ** 2;
      if (pk.blockedUntilLeave) { if (d > 30 * 30) pk.blockedUntilLeave = false; continue; }
      if (d < bd) { bd = d; best = { kind: "weapon", ref: pk }; }
    }
    for (const n of this.npcs) {
      if (n.dead || n.spawnT > 0) continue;
      const d = (n.x - p.x) ** 2 + (n.y - p.y) ** 2;
      if (d < 34 * 34 && d < bd + 400) { bd = d; best = { kind: n.kind, ref: n }; }
    }
    // Rút Quân: hòm tiếp tế / túi y tế, giải cứu, trạm phát sóng, gọi trực thăng (ưu tiên khi không có vũ khí ngay chân)
    const r = this.run?.findInteract(p);
    if (r && (!best || r.kind === "extract" || bd > 14 * 14)) best = r;
    return best;
  }
  interact(t) {
    const p = this.player;
    if (t.kind === "weapon") {
      t.ref.dead = true;
      const at = ammoTypeOf(t.ref.weapon);
      if (AMMO.pool && at && !t.ref.ammoGiven) { t.ref.ammoGiven = true; addAmmo(at, t.ref.weapon.mag); }   // súng nhặt được kèm 1 băng dự trữ
      const msg = p.pickWeapon(t.ref.weapon, this);
      this.banner(msg, t.ref.color);
      this.sound.play("pickup", 0.6);
    } else if (t.kind === "merchant") this.openShop(t.ref);
    else if (t.kind === "statue") this.pray(t.ref);
    else this.run?.interact(t);
  }

  /** Thương Nhân Bí Ẩn hiện ra cạnh người chơi */
  spawnMerchant() {
    const p = this.player;
    const pt = this.world.randomFreePoint({ near: { x: p.x, y: p.y }, minD: 50, maxD: 110, margin: 16 }) ?? this.world.randomFreePoint({ near: { x: p.x, y: p.y }, minD: 0, maxD: 200, margin: 12 });
    if (!pt) return;
    for (const n of this.npcs) if (n.kind === "merchant") n.dead = true;
    this.npcs.push(new Merchant(pt.x, pt.y, this.wave));
    FX.portal(pt.x, pt.y + 2, 0.5);
    this.sound.play("chestSpawn", 0.6);
    this.banner("THƯƠNG NHÂN BÍ ẨN GHÉ THĂM!", "#c48cff", true, 3.2);
    this.banner(`Lại gần bấm ${TOUCH ? "nút E" : "E"} để mua đồ bằng Vàng (đang có ${this.gold}) · ở lại tới Boss sau`, "#e0c8ff", false, 3.2);
  }
  openShop(m) {
    this.shopping = m;
    input.mouse.left = false;
    this.player.charge = null;
    this.sound.play("uiSelect", 0.6);
    this.ui.showShop(m, this.gold);
  }
  closeShop() {
    if (!this.shopping) return;
    this.shopping = null;
    this.ui.hideShop();
    input.mouse.left = false;
  }
  /** Mua món thứ i ở quầy đang mở */
  buyItem(i) {
    const m = this.shopping, it = m?.stock[i], p = this.player;
    if (!it || it.sold) return;
    if (this.gold < it.price) { this.sound.play("skillDenied", 0.5); this.ui.shopMessage("Không đủ Vàng!", "#ff5a5a"); return; }
    if (it.id === "potionHp" && p.hp >= p.maxHp) { this.ui.shopMessage("Máu đang đầy!", "#ffb030"); return; }
    this.gold -= it.price;
    it.sold = true;
    switch (it.id) {
      case "potionHp": this.healPlayer(2); break;
      case "potionArmor": p.armor = Math.min(p.maxArmor, p.armor + 3); p.armorFlash = 0.4; break;
      case "potionEnergy": p.energy = Math.min(p.maxEnergy, p.energy + 80); p.energyFlash = 0.4; break;
      case "maxHp": p.maxHp++; this.healPlayer(1); break;
      case "weapon": this.pickups.push(new Pickup(m.x, m.y + 10, "weapon", it.weapon, { vx: rand(-20, 20), vy: 40 })); break;
      default: if (it.blessing) p.startBlessing(this, { ...BLESSINGS.find((b) => b.id === it.blessing), name: it.name }, 45);
    }
    this.sound.play("upgrade", 0.6);
    this.ui.showShop(m, this.gold);
    this.ui.shopMessage(it.id === "weapon" ? `Đã mua ${it.name} — vũ khí nằm dưới chân Thương Nhân (bấm E để nhặt)` : `Đã mua ${it.name}!`, "#5fdc8c");
  }
  /** Tượng Thần: dâng vàng nhận bùa mạnh */
  pray(st) {
    const price = st.price;
    if (price === null) { this.banner("Tượng Thần đã cạn phép lành", "#8a82a8"); return; }
    if (this.gold < price) { this.sound.play("skillDenied", 0.5); this.banner(`Cần ${price} Vàng để cầu phúc (đang có ${this.gold})`, "#ff7a7a"); return; }
    this.gold -= price;
    st.uses++;
    const b = BLESSINGS[(Math.random() * BLESSINGS.length) | 0];
    this.player.startBlessing(this, b, STATUE.buffTime);
    if (Math.random() < 0.5) this.healPlayer(1);
    FX.holyPillar(st.x, st.y + 2, 0.7);
    this.screenFlash("#ffe26b", 0.2);
    this.sound.play("shrine", 0.7);
    this.banner(`TƯỢNG THẦN BAN PHƯỚC: ${b.name} — ${b.desc} (${STATUE.buffTime}s)`, b.color, true, 3);
  }

  /** Lông Phượng Hoàng: hồi sinh 1 lần */
  revive() {
    const p = this.player;
    this.reviveUsed = true;
    p.mods.phoenix = 0;
    p.hp = Math.ceil(p.maxHp / 2); p.armor = p.maxArmor;
    p.hurtTimer = 2; p.armorFlash = 0.5;
    FX.holyPillar(p.x, p.y + 2, 0.8);
    this.thornsBurst(p, 5, 100);
    for (const b of this.enemyBullets) b.dead = true;
    this.screenFlash("#ffb030", 0.5);
    this.shake(0.5, 5);
    this.sound.play("revive", 0.8);
    this.banner("PHƯỢNG HOÀNG TÁI SINH!", "#ff8a2a", true, 3);
  }

  /** Thùng nổ hẹn giờ, bẫy lửa, bàn tay ma, đền thờ */
  updateHazards(dt) {
    const p = this.player, world = this.world;
    for (const b of world.barrels) {
      if (b.dead || b.fuse < 0) continue;
      b.fuse -= dt;
      if (b.fuse <= 0) {
        b.dead = true;
        this.explode(b.x, b.y - 6, { radius: ENV.barrel.radius, damage: ENV.barrel.damage, knock: 320, source: "barrel", hurtPlayer: true, playerRadius: ENV.barrel.playerRadius });
      }
    }
    for (const t of world.traps) {
      t.burnTick -= dt;
      if (world.trapState(t) !== "fire") continue;
      const tr = ENV.trap.r + 4;
      if ((p.x - t.x) ** 2 + ((p.y - t.y) * 1.3) ** 2 < tr * tr) p.hurt(this, t.x, t.y + 10, ENV.trap.damage);
      if (t.burnTick <= 0) {
        t.burnTick = 0.4;
        for (const e of this.grid.query(t.x, t.y - 10, ENV.trap.r + MAX_ENEMY_RADIUS, this.qExplode)) {
          const rr = ENV.trap.r + e.radius * 0.5;
          if (!e.dead && !e.cfg.flying && (e.x - t.x) ** 2 + (e.y - t.y) ** 2 < rr * rr) this.damageEnemy(e, 1.5, -Math.PI / 2, 60, { noCrit: true });
        }
      }
    }
    // Bàn tay ma (Nghĩa Trang): vồ lên giữ chân + gây sát thương
    for (const h of world.hands) {
      const st = world.handState(h);
      if (st !== "grab") { h.fired = false; continue; }
      if (h.fired) continue;
      h.fired = true;
      if (!this.camera.inView(h.x, h.y, 80)) continue;
      FX.grasp(h.x, h.y);
      this.sound.play("grab", 0.4);
      const r = ENV.hands.r + 4;
      if ((p.x - h.x) ** 2 + ((p.y - h.y) * 1.6) ** 2 < r * r && !p.invulnerable) { p.rootT = ENV.hands.root; p.hurt(this, h.x, h.y + 10, ENV.hands.damage); }
    }
    // Đền Thờ: chạm vào đền đang sáng để nhận bùa
    for (const s of world.shrines) {
      if (s.cool > 0 || (p.x - s.x) ** 2 + (p.y - s.y) ** 2 > (s.r + 10) ** 2) continue;
      const b = BLESSINGS[(Math.random() * BLESSINGS.length) | 0];
      p.startBlessing(this, b);
      s.cool = ENV.shrine.cooldown;
      FX.holyPillar(s.x, s.y + 2, 0.5);
      this.sound.play("shrine", 0.7);
      this.banner(`ĐỀN THỜ: ${b.name} — ${b.desc} (${ENV.shrine.buffTime}s)`, b.color, true, 3);
    }
  }

  updateFx(dt) { effects.update(dt); }

  /**
   * >>> TẢN ĐỘI HÌNH (Soft Separation) <<<
   * Mỗi cặp quái chồng lên nhau bị đẩy ra NHẸ (một phần độ chồng mỗi frame, theo CROWD.stiffness)
   * thay vì bật mạnh -> đám đông dàn hàng mềm mại quanh người chơi, không dồn cục, không rung giật.
   * Chỉ xét cặp ở ô lưới lân cận; phép thử dùng khoảng cách BÌNH PHƯƠNG, chỉ tính căn khi đã chắc chắn chồng nhau.
   * Boss không bị đẩy (nó đẩy quái nhỏ ra).
   */
  separateEnemies(dt) {
    const es = this.enemies, k = Math.min(0.5, dt * CROWD.stiffness), gap = CROWD.gap;
    for (let i = 0; i < es.length; i++) {
      const a = es[i];
      if (a.dead || a.air || a.jump) continue;
      const near = this.grid.query(a.cx, a.cy, a.radius + MAX_ENEMY_RADIUS + gap, this.qSep);
      for (let j = 0; j < near.length; j++) {
        const b = near[j];
        if (b.gridId <= a.gridId || b.dead || b.air || b.jump) continue;   // mỗi cặp xét 1 lần
        let dx = b.x - a.x, dy = b.cy - a.cy;
        const min = a.radius + b.radius + gap, d2 = dx * dx + dy * dy;
        if (d2 >= min * min) continue;
        let d = Math.sqrt(d2);
        if (d < 0.01) { dx = (a.gridId & 1) ? 1 : -1; dy = 0.3; d = 1.05; }   // trùng khít: tách theo 1 hướng cố định
        const push = (min - d) * k / d;
        const wa = a.boss ? 0 : b.boss ? 1 : 0.5, wb = b.boss ? 0 : a.boss ? 1 : 0.5;
        a.x -= dx * push * wa; a.y -= dy * push * wa;
        b.x += dx * push * wb; b.y += dy * push * wb;
      }
    }
  }

  // ---------- ÁNH SÁNG ----------
  addLight(x, y, r, color = null, a = 1, glow = 0.14) {
    if (this.lightList.length >= 90) return;
    const L = this.lightPool[this.lightList.length] ??= {};
    L.x = x; L.y = y; L.r = r; L.color = color; L.a = a; L.glow = glow;
    this.lightList.push(L);
  }
  /** Gom nguồn sáng trong khung hình cho frame này */
  collectLights() {
    const cam = this.camera, t = this.time, p = this.player;
    this.lightList.length = 0;
    if (this.state === GAME_STATE.PLAYING) this.addLight(p.x, p.cy, p.holyTime > 0 ? 150 : 118, p.holyTime > 0 ? "#ffd25e" : null, 1, 0.12);
    for (const L of this.world.lights) {
      if (!cam.inView(L.x, L.y, L.r)) continue;
      if (L.crystal?.dead || L.prop?.dead) continue;
      const a = L.shrine && L.shrine.cool > 0 ? 0.4 : 1;
      this.addLight(L.x, L.y, L.r * (1 + 0.05 * Math.sin(t * 11 + L.flicker) + 0.03 * Math.sin(t * 23 + L.flicker * 3)), L.color, a, 0.16);
    }
    for (const s of this.shocks) this.addLight(s.x, s.y, s.r * 1.3, s.color, s.life / s.max, 0.3);
    for (const s of this.strikes) this.addLight(s.x, s.y, s.r * 1.1, "#ff6a1e", Math.min(1, s.t / s.delay) * 0.7, 0.25);
    for (const z of this.zones) if (cam.inView(z.x, z.y, z.r)) this.addLight(z.x, z.y, z.r * 1.5, z.owner === "player" ? "#a6f06a" : "#8ad23a", Math.min(1, z.life / 0.6) * 0.6, 0.15);
    for (const m of this.minions) this.addLight(m.x, m.y, 30, "#45f0b0", 0.8, 0.25);
    for (const s of this.pending) if (cam.inView(s.x, s.y, 40)) this.addLight(s.x, s.y - 4, s.big ? 50 : 30, s.color, 0.8, 0.3);   // vòng ngắm đỏ luôn sáng rõ
    for (const n of this.npcs) this.addLight(n.x, n.y - 14, n.kind === "merchant" ? 56 : 64, n.kind === "merchant" ? "#ffb04a" : "#ffe26b", 1, 0.2);
    this.run?.lights(this.lightAdder ??= (x, y, r, col, a, glow) => this.addLight(x, y, r, col, a, glow), cam);
    if (p.charge && this.state === GAME_STATE.PLAYING) this.addLight(p.x, p.cy, 40 + 40 * p.chargeK, p.weapon.color, 0.6 + 0.4 * p.chargeK, 0.3);
    for (const b of this.beams) this.addLight((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, 60, b.color, b.life / b.max, 0.2);
    for (const b of this.bolts) { const q = b.pts[b.pts.length - 1]; this.addLight(q[0], q[1], 50, b.color, b.life / b.max, 0.3); }
    for (const c of this.chests) if (cam.inView(c.x, c.y, 30)) this.addLight(c.x, c.y - 6, 30, CHEST_TIERS[c.tier].glow, 1, 0.2);
    for (const e of this.enemies) {
      if (e.dead || !cam.inView(e.x, e.y, 60)) continue;
      if (e.boss) this.addLight(e.cx, e.cy, 76, e.cfg.aura, 0.9, 0.22);
      else if (e.type === "skull") this.addLight(e.cx, e.cy - 6, 30, "#ff8a2a", 0.9, 0.25);
      else if (e.burnT > 0) this.addLight(e.cx, e.cy, 22, "#ff8a2a", 0.7, 0.2);
    }
    let n = 0;
    for (const b of this.bullets) {
      if (n > 24) break;
      const st = b.style;
      if ((st === "orb" || st === "grenade" || st === "rocket" || st === "soulOrb" || st === "poisonBlob" || st === "disc" || (st === "flame" && (b.age * 30 | 0) % 3 === 0)) && cam.inView(b.x, b.y, 24)) { this.addLight(b.x, b.y, 24, b.color, 0.9, 0.3); n++; }
    }
  }

  // ---------- DRAW ----------
  draw() {
    if (this.state === GAME_STATE.MENU) { this.lobby?.draw(ctx, { touch: TOUCH }); effects.draw(ctx, null, 0); effects.draw(ctx, null, 1); return; }
    if (this.state === GAME_STATE.CABIN) { this.cabin.draw(ctx); return; }
    if (!this.player) return;
    const run = this.run;
    if (run?.phase === "tacmap" && this.state === GAME_STATE.PLAYING) { run.tacmap.draw(ctx, W, H); return; }   // BẢN ĐỒ CHIẾN THUẬT
    if (run?.phase === "jumpcut" && this.state === GAME_STATE.PLAYING) { this.cabin.draw(ctx); return; }      // CẢNH NHẢY KHỎI MÁY BAY
    const drop = run?.phase === "airdrop" ? run.airdrop : null;
    const alive = this.state === GAME_STATE.PLAYING && !(run && run.boarded);
    const cam = this.camera, cx = cam.rx, cy = cam.ry;

    // Nền tĩnh (cắt theo camera)
    ctx.fillStyle = "#0d0b14"; ctx.fillRect(0, 0, W, H);
    this.world.drawFloor(ctx, cam, W, H);

    // ---- LỚP 1 (bị ánh sáng che tối): bản đồ động, vùng hiệu ứng, vật phẩm, người & quái ----
    ctx.save();
    ctx.translate(-cx, -cy);
    this.world.drawDynamic(ctx, cam);
    drop?.drawGround(ctx);                         // bóng máy bay + bóng người đang rơi
    this.drawZones();
    run?.drawGround(ctx);                          // bãi rút quân, hòm tiếp tế, mìn, vùng nhiệm vụ
    this.drawStrikes();
    this.drawSpawnMarks();
    this.drawShells();
    for (const o of this.orbs) if (cam.inView(o.x, o.y, 8)) o.draw(ctx);
    for (const d of this.drops) if (cam.inView(d.x, d.y, 8)) d.draw(ctx);
    for (const c of this.chests) if (cam.inView(c.x, c.y, 150)) c.draw(ctx, this.time);
    for (const pk of this.pickups) if (cam.inView(pk.x, pk.y, 40)) pk.draw(ctx, this.time);
    for (const e of this.enemies) if (!e.dead && cam.inView(e.x, e.y, 80)) e.drawGround(ctx, this);
    effects.draw(ctx, cam, 0);                     // bụi chân: dưới nhân vật

    // Người + quái: sắp theo trục Y (ai đứng thấp hơn vẽ sau, che người phía trên). Mảng dùng lại mỗi frame.
    const actors = this.drawList;
    actors.length = 0;
    for (const e of this.enemies) if (!e.dead && cam.inView(e.x, e.y, 120)) actors.push(e);
    for (const n of this.npcs) if (cam.inView(n.x, n.y, 60)) actors.push(n);
    run?.collectActors(actors);                    // người sống sót, kén ổ dịch, trạm phát sóng, cờ cứ điểm
    if (alive && (!drop || drop.landed)) actors.push(this.player);
    actors.sort(byFeetY);
    for (const a of actors) a.draw(ctx, this);     // spritesheet theo frame hoạt ảnh (+ vũ khí của người chơi)
    ctx.restore();

    // ---- ÁNH SÁNG: phủ tối + đục lỗ sáng quanh nguồn sáng ----
    this.collectLights();
    this.light.render(ctx, cam, this.world.biome.light, this.lightList);

    // ---- LỚP 2 (phát sáng, luôn rõ): đạn, tia, nổ, số sát thương, thời tiết ----
    ctx.save();
    ctx.translate(-cx, -cy);
    for (const a of actors) if (a !== this.player) a.drawOverlay?.(ctx, this);
    if (alive) this.drawChargeRing();
    this.drawMinions();
    for (const b of this.bullets) if (cam.inView(b.x, b.y, 16)) b.draw(ctx, this);
    for (const b of this.enemyBullets) if (cam.inView(b.x, b.y, 16)) b.draw(ctx);
    this.drawRains();
    this.horde?.drawOverlay(ctx);                  // dấu "!" khi cả đàn zombie hú lên
    run?.drawOverlay(ctx);                         // lựu đạn, khói pháo sáng, trực thăng, thanh tiến độ nhiệm vụ
    this.drawBeams();
    HUD.drawShockwaves(ctx, this.shocks);
    this.drawParticles();
    effects.draw(ctx, cam, 1);                     // tia lửa, vệt chém, trúng đòn, nổ... (spritesheet)
    drawGunFx(ctx);                                // lửa đầu nòng / vỏ đạn dạng sprite của súng Pixel Armory
    const P = this.player;                         // con mèo trên đầu lúc Ngại Ngùng: vẽ đè lên hiệu ứng cho dễ thấy
    if (alive && P.shy) drawCat(ctx, P.x + (P.facingLeft ? -1 : 1), P.y - 33, P.facingLeft, P.shy.t);
    for (const f of this.flashes) {    // chớp sáng đầu nòng
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.fillRect(Math.round(f.x - f.size / 2), Math.round(f.y - f.size / 2), f.size, f.size);
      ctx.fillStyle = withAlpha(f.color.startsWith("#") ? f.color : "#ffe26b", 0.5);
      ctx.fillRect(Math.round(f.x - f.size), Math.round(f.y - f.size), f.size * 2, f.size * 2);
    }
    this.ambient?.draw(ctx);
    drop?.drawSky(ctx);                            // người + dù đang rơi, máy bay bay ngang
    this.drawPickupLabels();
    if (this.debug) this.drawDebug();
    ctx.restore();

    // ---- HUD (tọa độ màn hình) ----
    ctx.drawImage(this.vignette, 0, 0);
    if (this.hurtFlash > 0) { ctx.fillStyle = `rgba(200,20,40,${this.hurtFlash * 0.6})`; ctx.fillRect(0, 0, W, H); }
    const F = this.flashFx;
    if (F) { ctx.fillStyle = `rgba(${F.r},${F.g},${F.b},${(F.t / F.max) * 0.45})`; ctx.fillRect(0, 0, W, H); }
    if (this.player.inAcid) { ctx.fillStyle = "rgba(60,200,40,0.10)"; ctx.fillRect(0, 0, W, H); }
    if (alive && this.player.hp <= Math.max(1, this.player.maxHp * 0.2) && this.player.armor === 0) {   // sắp chết (≤20% máu): viền đỏ nhịp tim
      ctx.strokeStyle = `rgba(255,30,50,${0.25 + 0.2 * Math.sin(this.time * 8)})`; ctx.lineWidth = 6; ctx.strokeRect(3, 3, W - 6, H - 6);
    }
    this.drawHUD();
    if (alive && !this.paused && !this.choosing && !drop) { if (TOUCH) this.drawAimGuide(); else this.drawCrosshair(); }
  }

  /** Vùng mây độc / vũng axit (dưới chân) */
  drawZones() {
    for (const z of this.zones) {
      if (!this.camera.inView(z.x, z.y, z.r + 10)) continue;
      const k = Math.min(1, z.life / 0.6, (z.max - z.life) / 0.25 + 0.3), t = this.time + z.seed;
      if (z.kind === "acid") {
        ctx.fillStyle = withAlpha("#1c5a1a", 0.6 * k); ctx.beginPath(); ctx.ellipse(z.x, z.y, z.r, z.r * 0.55, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = withAlpha("#56d23a", 0.55 * k); ctx.beginPath(); ctx.ellipse(z.x - 2, z.y - 1, z.r * 0.7, z.r * 0.35, 0, 0, TAU); ctx.fill();
        for (let i = 0; i < 3; i++) { const u = (t * 0.9 + i / 3) % 1; ctx.fillStyle = withAlpha("#c8ff8a", (1 - u) * k); ctx.fillRect(Math.round(z.x - z.r * 0.5 + i * z.r * 0.45), Math.round(z.y - u * 4), 2, 2); }
      } else {
        for (let i = 0; i < 5; i++) {
          const a = t * 0.8 + i * 1.3, bx = z.x + Math.cos(a) * z.r * 0.45, by = z.y - 6 + Math.sin(a * 1.3) * z.r * 0.22, br = z.r * (0.45 + 0.12 * Math.sin(t * 2 + i));
          ctx.fillStyle = withAlpha(i % 2 ? "#96aa30" : "#5a3a62", 0.28 * k); ctx.beginPath(); ctx.ellipse(bx, by, br, br * 0.6, 0, 0, TAU); ctx.fill();
        }
        ctx.fillStyle = withAlpha("#cce040", 0.25 * k); ctx.beginPath(); ctx.ellipse(z.x, z.y - 4, z.r * 0.6, z.r * 0.3, 0, 0, TAU); ctx.fill();
      }
    }
  }
  /** Vòng cảnh báo thiên thạch */
  drawStrikes() {
    for (const s of this.strikes) {
      const k = Math.min(1, s.t / s.delay), blink = Math.floor(this.time * 16) % 2;
      ctx.strokeStyle = withAlpha(s.owner === "player" ? "#ffb03a" : "#ff3b3b", 0.5 + 0.4 * blink); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(s.x, s.y, s.r, s.r * 0.45, 0, 0, TAU); ctx.stroke();
      ctx.fillStyle = withAlpha(s.owner === "player" ? "#ff8a2a" : "#ff3b3b", 0.12 + 0.2 * k);
      ctx.beginPath(); ctx.ellipse(s.x, s.y, s.r * k, s.r * 0.45 * k, 0, 0, TAU); ctx.fill();
    }
  }
  /** Mưa tên: vùng mục tiêu + mũi tên rơi + tên cắm đất */
  drawRains() {
    for (const R of this.rains) {
      if (R.left > 0) { ctx.strokeStyle = withAlpha("#e8343f", 0.35 + 0.2 * Math.sin(this.time * 10)); ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(R.x, R.y, R.r, R.r * 0.7, 0, 0, TAU); ctx.stroke(); }
      for (const f of R.falling) {
        const u = Math.min(1, f.t / f.dur);
        if (!f.done) {
          const x = Math.round(f.x + (1 - u) * 26), y = Math.round(f.y - (1 - u) * 90);
          ctx.fillStyle = "#8a5428"; ctx.fillRect(x, y - 9, 1, 9); ctx.fillRect(x + 1, y - 9, 1, 3);
          ctx.fillStyle = "#e8e2f6"; ctx.fillRect(x - 1, y, 3, 2);
          ctx.fillStyle = "#e8343f"; ctx.fillRect(x, y - 11, 2, 2);
        } else {
          const a = 1 - Math.min(1, (f.t - f.dur) / 0.7);
          if (a <= 0) continue;
          ctx.globalAlpha = a;
          ctx.fillStyle = "#8a5428"; ctx.fillRect(Math.round(f.x), Math.round(f.y - 6), 1, 6);
          ctx.fillStyle = "#e8343f"; ctx.fillRect(Math.round(f.x), Math.round(f.y - 7), 2, 1);
          ctx.globalAlpha = 1;
        }
      }
    }
  }
  /** Vong linh: spritesheet "spirit" (pixelfx wisp) */
  drawMinions() {
    const sp = ACTOR_SPRITES.get("spirit");
    for (const m of this.minions) {
      if (!this.camera.inView(m.x, m.y, 30)) continue;
      if (m.life < 1 && Math.floor(this.time * 16) % 2) continue;
      if (sp) { const sh = sp.sheet, f = Math.floor((m.t + m.ph) * sh.fps) % sh.frames; sh.draw(ctx, f, 0, m.x, m.y + 12, m.target ? m.target.cx < m.x : false, 0.55); }
      else { ctx.fillStyle = "#45f0b0"; ctx.fillRect(Math.round(m.x) - 2, Math.round(m.y) - 2, 4, 4); }
    }
  }
  /** Hạt nhỏ: khói tên lửa, vệt linh hồn, bọt độc */
  drawParticles() {
    for (const q of this.particles) {
      const k = Math.max(0, q.life / q.max);
      if (q.kind === "smoke") { const r = Math.round(1 + (1 - k) * 3); ctx.fillStyle = withAlpha(k > 0.6 ? "#a7a1ad" : "#5a5463", 0.6 * k + 0.1); ctx.fillRect(Math.round(q.x) - r, Math.round(q.y) - r, r * 2, r * 2); }
      else { ctx.fillStyle = withAlpha(PARTICLE_COLORS[q.kind] ?? "#a6f06a", k); ctx.fillRect(Math.round(q.x), Math.round(q.y), q.kind === "leaf" || q.kind === "wood" ? 2 : 1, 1); }
    }
  }

  /**
   * >>> BIỂU TƯỢNG NGẮM ĐỎ báo trước chỗ quái sắp xuất hiện (SPAWN.telegraph giây)
   * Vòng tròn co lại + 4 vạch xoay + chấm tâm, nhấp nháy nhanh dần khi sắp tới lúc.
   */
  drawSpawnMarks() {
    for (const s of this.pending) {
      if (!this.camera.inView(s.x, s.y, 40)) continue;
      const k = 1 - s.t / s.max, R = (s.big ? 26 : 13) * (1.35 - 0.35 * k), rot = this.time * 4 + s.x;
      const blink = s.t < 0.18 ? Math.floor(this.time * 30) % 2 === 0 : true;
      const x = Math.round(s.x), y = Math.round(s.y);
      ctx.fillStyle = withAlpha(s.color, 0.12 + 0.25 * k);
      ctx.beginPath(); ctx.ellipse(x, y, R, R * 0.5, 0, 0, TAU); ctx.fill();
      if (!blink) continue;
      ctx.strokeStyle = withAlpha(s.color, 0.55 + 0.45 * k); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(x, y, R, R * 0.5, 0, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(x, y, R * 0.45, R * 0.22, 0, 0, TAU); ctx.stroke();
      ctx.fillStyle = withAlpha(s.color, 0.9);
      for (let i = 0; i < 4; i++) {   // 4 vạch ngắm xoay quanh
        const a = rot + (i * TAU) / 4, cx = Math.cos(a), cy = Math.sin(a) * 0.5;
        for (let d = R * 0.62; d < R * 1.08; d += 1) ctx.fillRect(Math.round(x + cx * d), Math.round(y + cy * d), 1, 1);
      }
      ctx.fillRect(x - 1, y, 3, 1); ctx.fillRect(x, y - 1, 1, 3);
    }
  }

  /** Vỏ đạn trên sàn */
  drawShells() {
    for (const s of this.shells) {
      if (!this.camera.inView(s.x, s.y, 10)) continue;
      const a = Math.min(1, s.life / 0.6), x = Math.round(s.x), y = Math.round(s.y - s.z);
      ctx.globalAlpha = a;
      const horiz = Math.abs(Math.cos(s.rot)) > 0.5;
      if (s.kind === "shell") { ctx.fillStyle = "#c8281a"; ctx.fillRect(x, y, horiz ? 3 : 2, horiz ? 2 : 3); ctx.fillStyle = "#e8b030"; ctx.fillRect(x, y, 1, 1); }
      else { ctx.fillStyle = s.kind === "big" ? "#e8c040" : "#d8a830"; ctx.fillRect(x, y, horiz ? (s.kind === "big" ? 3 : 2) : 1, horiz ? 1 : (s.kind === "big" ? 3 : 2)); }
      ctx.globalAlpha = 1;
    }
  }

  /** Vòng tụ lực quanh chân khi giữ chuột với vũ khí tích lực */
  drawChargeRing() {
    const p = this.player;
    if (!p.charge) return;
    const k = p.chargeK, col = p.weapon.color, full = k >= 1, x = Math.round(p.x), y = Math.round(p.y);
    const R = 13 + (full ? Math.sin(this.time * 24) : 0);
    ctx.strokeStyle = withAlpha("#000000", 0.5); ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(x, y, R, R * 0.45, 0, 0, TAU); ctx.stroke();
    ctx.strokeStyle = full ? "#ffffff" : col; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(x, y, R, R * 0.45, 0, -Math.PI / 2, -Math.PI / 2 + TAU * k); ctx.stroke();
    if (full || k > 0.3) {   // hạt sáng xoáy vào tâm
      ctx.fillStyle = full ? "#ffffff" : col;
      for (let i = 0; i < 4; i++) {
        const a = this.time * 9 + (i * TAU) / 4, d = R * (1 - ((this.time * 2 + i / 4) % 1));
        ctx.fillRect(Math.round(x + Math.cos(a) * d), Math.round(p.cy + Math.sin(a) * d * 0.7), 1, 1);
      }
    }
    if (full) { ctx.fillStyle = withAlpha(col, 0.25 + 0.15 * Math.sin(this.time * 20)); ctx.beginPath(); ctx.ellipse(x, p.cy, 12, 16, 0, 0, TAU); ctx.fill(); }
  }

  drawBeams() {
    for (const b of this.beams) {
      const k = b.life / b.max;
      ctx.strokeStyle = withAlpha(b.color, 0.35 * k); ctx.lineWidth = b.width + 4;
      ctx.beginPath(); ctx.moveTo(b.x0, b.y0); ctx.lineTo(b.x1, b.y1); ctx.stroke();
      ctx.strokeStyle = withAlpha(b.color, k); ctx.lineWidth = Math.max(1, b.width * k);
      ctx.beginPath(); ctx.moveTo(b.x0, b.y0); ctx.lineTo(b.x1, b.y1); ctx.stroke();
      ctx.strokeStyle = withAlpha("#ffffff", k); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(b.x0, b.y0); ctx.lineTo(b.x1, b.y1); ctx.stroke();
    }
    // tia sét xích (Súng Sét Xích)
    for (const b of this.bolts) {
      const k = b.life / b.max;
      for (const [w, col, a] of [[4, b.color, 0.3], [2, b.color, 1], [1, "#ffffff", 1]]) {
        ctx.strokeStyle = withAlpha(col, a * k); ctx.lineWidth = w;
        ctx.beginPath(); b.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
      }
    }
    // sóng kiếm khí hình bán nguyệt
    for (const s of this.waves) {
      const k = 1 - s.life / s.max, r = s.r * (0.6 + 0.5 * k);
      ctx.strokeStyle = withAlpha(s.color, 1 - k); ctx.lineWidth = 3 * (1 - k) + 1;
      ctx.beginPath(); ctx.arc(s.x, s.y, r, s.a - s.arc, s.a + s.arc); ctx.stroke();
      ctx.strokeStyle = withAlpha("#ffffff", (1 - k) * 0.8); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(s.x, s.y, r - 2, s.a - s.arc * 0.8, s.a + s.arc * 0.8); ctx.stroke();
    }
  }

  /** Tên vũ khí trên đất (màu độ hiếm) + lời nhắc tương tác [E] */
  drawPickupLabels() {
    const p = this.player, tgt = this.interactTarget;
    ctx.font = "7px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "top";
    for (const pk of this.pickups) {
      if ((pk.x - p.x) ** 2 + (pk.y - p.y) ** 2 > 60 * 60) continue;
      let label = pk.label;
      if (pk.kind === "weapon") {
        const w = pk.weapon, r = rarityName(w.rarity);
        label = `${w.label ?? w.name}${r ? ` · ${r}` : ""}${w.cost ? ` · ${w.cost} NL` : ""}`;
      }
      HUD.text(ctx, label, Math.round(pk.x), Math.round(pk.y - 26), pk.color);
    }
    if (tgt) {
      const key = TOUCH ? "Nút E" : "[E]";
      let txt, x = tgt.ref.x, y = tgt.ref.y;
      if (tgt.kind === "weapon") { const own = p.weapons[1] ? ` (thay ${p.weapon.label})` : ""; txt = `${key} Nhặt${own}`; y -= 16; }
      else if (tgt.kind === "merchant") { txt = `${key} Mua đồ · Vàng ${this.gold}`; y -= 52; }
      else if (tgt.kind === "statue") { const pr = tgt.ref.price; txt = pr === null ? "Tượng Thần đã cạn phép lành" : `${key} Cầu phúc · ${pr} Vàng`; y -= 46; }
      else { txt = tgt.label === "Đang lục soát..." ? tgt.label : `${key} ${tgt.label}`; x = tgt.x; y = tgt.y; }
      const w = Math.ceil(ctx.measureText(txt).width) + 8;
      ctx.fillStyle = "rgba(12,10,20,0.85)"; ctx.fillRect(Math.round(x - w / 2), Math.round(y - 1), w, 10);
      ctx.fillStyle = "#ffe26b"; ctx.fillRect(Math.round(x - w / 2), Math.round(y + 9), w, 1);
      HUD.text(ctx, txt, Math.round(x), Math.round(y), "#ffffff");
    }
    ctx.textAlign = "left"; ctx.font = "8px monospace";
  }

  drawDebug() {
    ctx.strokeStyle = "#0f0"; ctx.lineWidth = 1;
    const circle = (x, y, r) => { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke(); };
    circle(this.player.cx, this.player.cy, this.player.radius);
    ctx.strokeStyle = "#f44"; for (const e of this.enemies) circle(e.cx, e.cy, e.radius);
    ctx.strokeStyle = "#ff0"; for (const b of this.bullets) circle(b.x, b.y, b.radius);
    ctx.strokeStyle = "#0ff"; for (const s of this.world.solids) if (this.camera.inView(s.x + s.w / 2, s.y + s.h / 2, Math.max(s.w, s.h))) ctx.strokeRect(s.x + 0.5, s.y + 0.5, s.w, s.h);
  }

  // ---------- HUD ----------
  drawHUD() {
    const p = this.player;
    ctx.font = "8px monospace";
    ctx.textBaseline = "top";

    HUD.drawExpBar(ctx, W, this.exp, this.expNeed, this.level);

    // Khung Máu / Giáp / Năng Lượng / Kỹ năng (góc trên trái)
    const X = 4, Y = 6;
    HUD.panel(ctx, X, Y, 126, 41);
    HUD.drawHeart(ctx, X + 4, Y + 5, true);
    // >>> 3 thanh hiển thị theo %: Máu · Giáp · Năng Lượng
    HUD.drawBar(ctx, X + 14, Y + 4, 80, 9, p.hp / p.maxHp, "#e8343f", "#ff8a92", HUD.pct(p.hp, p.maxHp));
    HUD.drawShield(ctx, X + 4, Y + 16);
    HUD.drawBar(ctx, X + 14, Y + 16, 80, 9, p.maxArmor ? Math.min(1, p.armor / p.maxArmor) : 0, p.armorFlash > 0 ? "#e6f0ff" : "#7fa2d8", "#c4d6f4", HUD.pct(p.armor, p.maxArmor));
    if (p.armor < p.maxArmor && p.sinceHit < p.regen.delay) {
      ctx.fillStyle = "#3d4a66"; ctx.fillRect(X + 14, Y + 26, 80, 1);
      ctx.fillStyle = "#9fb8e0"; ctx.fillRect(X + 14, Y + 26, Math.round(80 * (p.sinceHit / p.regen.delay)), 1);
    }
    // NĂNG LƯỢNG (xanh dương) — nháy đỏ khi thiếu
    HUD.drawBolt(ctx, X + 5, Y + 29);
    const eLow = p.noEnergyT > 0 && Math.floor(this.time * 16) % 2 === 0;
    HUD.drawBar(ctx, X + 14, Y + 29, 80, 8, p.energy / p.maxEnergy, eLow ? "#ff3b3b" : p.energyFlash > 0 ? "#c8f2ff" : "#2f7ae8", "#7cc8ff", HUD.pct(Math.floor(p.energy), p.maxEnergy));
    this.drawSkillSlot(X + 99, Y + 3, p);

    // 2 ô vũ khí (+ năng lượng mỗi phát) + Lướt
    HUD.drawWeaponSlots(ctx, X, Y + 43, p, this.time);
    HUD.drawDashPip(ctx, X + 1, Y + 72, p, TOUCH ? "LƯỚT" : "SHIFT LƯỚT");
    let fy = Y + 81;
    ctx.font = "7px monospace";
    const mg = p.mergeable;
    if (mg) {   // lời nhắc GHÉP vũ khí
      const pulse = Math.floor(this.time * 4) % 2 === 0;
      HUD.text(ctx, `${TOUCH ? "▶ GHÉP" : "[G] GHÉP"} → ${mg.def.name}${mg.lvl > 1 ? " " + "★".repeat(mg.lvl) : ""}`, X + 1, fy, pulse ? rarityColor(mg.def.rarity) : "#ffffff"); fy += 10;
    }
    if (p.blessing) { HUD.text(ctx, `${p.blessing.name} ${p.blessing.t.toFixed(0)}s`, X + 1, fy, p.blessing.color); ctx.fillStyle = "#2a2338"; ctx.fillRect(X + 1, fy + 8, 76, 1); ctx.fillStyle = p.blessing.color; ctx.fillRect(X + 1, fy + 8, Math.round(76 * p.blessing.t / p.blessing.max), 1); fy += 11; }
    if (p.frenzy > 0) { HUD.text(ctx, `CUỒNG NỘ ${p.frenzy.toFixed(1)}s`, X + 1, fy, "#ff8a2a"); fy += 9; }
    if (p.inAcid) { HUD.text(ctx, "AXIT! -1 GIÁP / 1.5s", X + 1, fy, "#8aff5a"); fy += 9; }
    if (p.rootT > 0) { HUD.text(ctx, "BỊ BÀN TAY MA GIỮ CHÂN!", X + 1, fy, "#c48cff"); fy += 9; }
    else if (p.slowT > 0) { HUD.text(ctx, "BỊ LÀM CHẬM", X + 1, fy, "#8ad23a"); fy += 9; }
    if (p.mods.phoenix > 0) { HUD.text(ctx, "♥ PHƯỢNG HOÀNG: sẵn sàng", X + 1, fy, "#ff8a2a"); fy += 9; }
    ctx.font = "8px monospace";

    // Góc trên phải: bộ đếm FPS, rồi Điểm, thời gian, đợt, cấp độ (điện thoại: dời trái nhường chỗ nút tạm dừng)
    drawFps(ctx);
    if (this.run) { this.drawExtractHUD(); return; }
    ctx.textAlign = "right";
    const RX = TOUCH ? W - 36 : W - 6;
    HUD.text(ctx, `ĐIỂM ${this.score}`, RX, 16, "#ffe26b");
    HUD.text(ctx, `${fmtTime(this.time)} · hạ ${this.kills}`, RX, 27, "#b8b0d0");
    HUD.text(ctx, `ĐỢT ${this.wave} · ${this.diff.name}`, RX, 38, this.diff.color);
    HUD.text(ctx, `CẤP ${this.level}  ${this.exp}/${this.expNeed}`, RX, 49, "#7cc0ff");
    HUD.text(ctx, `● VÀNG ${this.gold}`, RX, 60, this.goldFlash > 0 ? "#ffffff" : "#ffd34a");
    const nb = Math.ceil(this.bossTimer);
    if (!this.boss) HUD.text(ctx, `Boss sau ${nb}s`, RX, 71, nb <= 5 ? "#ff7ad8" : "#7a6a9a");
    if (this.combo >= 3) {
      ctx.font = "bold 10px monospace";
      HUD.text(ctx, `COMBO x${this.combo}`, RX, 83, this.combo >= 25 ? "#ff7ad8" : "#ffb030");
      ctx.fillStyle = "#2a2338"; ctx.fillRect(RX - 60, 96, 60, 2);
      ctx.fillStyle = "#ffb030"; ctx.fillRect(RX - 60, 96, Math.round(60 * this.comboT / COMBO.window), 2);
      ctx.font = "8px monospace";
    }
    ctx.textAlign = "left";

    const boss = this.boss;
    if (boss) HUD.drawBossBar(ctx, W, boss, this.time);
    HUD.drawMinimap(ctx, W, H, this);
    HUD.drawOffscreenIndicators(ctx, W, H, this);
    if (!this.paused) HUD.drawBanners(ctx, W, H, this.banners);
    if (this.debug) {
      HUD.text(ctx, `hiệu ứng ${effects.count}/${effects.max} (bỏ ${effects.dropped})  quái ${this.enemies.length}+${this.pending.length}/${this.maxEnemies}  đạn ${this.bullets.length}  ngọc ${this.orbs.length}+${this.drops.length}  đèn ${this.lightList.length}`, 6, H - 22, "#8f8");
      HUD.text(ctx, `pool: đạn ${Bullet.pool.size}/${Bullet.pool.made} · quái ${Enemy.pool.size}/${Enemy.pool.made} · ngọc ${ExpOrb.pool.size}/${ExpOrb.pool.made}   [J] +50 quái  [L] tắt/bật ánh sáng`, 6, H - 12, "#8f8");
    }

    if (this.paused) {
      if (TOUCH && isPortrait()) this.overlay("XOAY NGANG", "Xoay ngang điện thoại để chơi tiếp", "");
      else if (TOUCH) { ctx.fillStyle = "rgba(10,8,18,0.6)"; ctx.fillRect(0, 0, W, H); }   // nút Tiếp tục là HTML
      else { this.overlay("TẠM DỪNG", "P / Esc: tiếp tục", "Q: về Sảnh chờ"); this.drawPerkSummary(); }
    }
  }

  /** HUD chế độ Rút Quân: đồng hồ, bảng nhiệm vụ, túi chiến thuật (src/extraction.js) + cấp độ, hạ gục, Boss, thông báo */
  drawExtractHUD() {
    const run = this.run, p = this.player;
    if (this.state === GAME_STATE.PLAYING || run.phase === "done") run.drawHUD(ctx, W, H);
    ctx.font = "7px monospace"; ctx.textAlign = "right"; ctx.textBaseline = "top";
    const RX = TOUCH ? W - 38 : W - 6, by = 17 + 12 + run.missions.list.length * 15 + 3;
    HUD.text(ctx, `CẤP ${this.level} · hạ ${this.kills} · ● ${this.gold}`, RX, by, this.goldFlash > 0 ? "#ffffff" : "#b8b0d0");
    const xp = Math.round(60 * this.exp / this.expNeed);
    ctx.fillStyle = "#2a2338"; ctx.fillRect(RX - 60, by + 9, 60, 1); ctx.fillStyle = "#3a8bff"; ctx.fillRect(RX - 60, by + 9, xp, 1);
    if (this.combo >= 3) { ctx.font = "bold 9px monospace"; HUD.text(ctx, `COMBO x${this.combo}`, RX, by + 13, this.combo >= 25 ? "#ff7ad8" : "#ffb030"); }
    ctx.textAlign = "left"; ctx.font = "8px monospace";
    const boss = this.boss;
    if (boss) HUD.drawBossBar(ctx, W, boss, this.time, run.flare && !run.heli ? 62 : 44);
    HUD.drawMinimap(ctx, W, H, this);
    HUD.drawOffscreenIndicators(ctx, W, H, this);
    // thông báo: giữa phía dưới nhân vật (không đè bảng máu / bảng nhiệm vụ), tối đa 4 dòng
    if (!this.paused) HUD.drawBanners(ctx, W, H, this.banners.slice(-4), 176, 284, true);
    if (this.paused && this.state === GAME_STATE.PLAYING) {
      if (TOUCH && isPortrait()) this.overlay("XOAY NGANG", "Xoay ngang điện thoại để chơi tiếp", "");
      else if (TOUCH) { ctx.fillStyle = "rgba(10,8,18,0.6)"; ctx.fillRect(0, 0, W, H); }
      else { this.overlay("TẠM DỪNG", "P / Esc: tiếp tục", "Q: rời trận (MẤT đồ mang theo)"); this.drawPerkSummary(); }
    }
    void p;
  }

  /** Danh sách thẻ đã chọn (màn hình tạm dừng) */
  drawPerkSummary() {
    const taken = Object.entries(this.player.perksTaken);
    ctx.font = "7px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "top";
    if (!taken.length) { HUD.text(ctx, "Chưa có thẻ nâng cấp nào", W / 2, H / 2 + 40, "#8a82a8"); }
    else {
      const parts = taken.map(([id, n]) => `${PERK_BY_ID[id]?.name ?? id} ${n}/${PERK_BY_ID[id]?.max ?? "?"}`);
      for (let i = 0; i < parts.length; i += 3) HUD.text(ctx, parts.slice(i, i + 3).join("  ·  "), W / 2, H / 2 + 40 + (i / 3) * 10, "#c4cede");
    }
    const w = this.player.weapons.filter(Boolean).map((x) => x.label).join("  |  ");
    HUD.text(ctx, `Vũ khí: ${w}`, W / 2, H / 2 + 30, "#ffe26b");
    ctx.textAlign = "left"; ctx.font = "8px monospace";
  }

  drawSkillSlot(x, y, p) {
    const S = 24, s = p.skill, ready = p.skillCd <= 0;
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 160);
    ctx.fillStyle = p.skillActive ? s.color : ready ? (pulse > 0.5 ? "#ffe26b" : "#c8a83a") : "#4a4066";
    ctx.fillRect(x - 1, y - 1, S + 2, S + 2);
    ctx.fillStyle = "#15111f"; ctx.fillRect(x, y, S, S);
    ctx.drawImage(getSkillIcon(p.char, this.assets.images), x + 2, y + 2, 20, 20);
    if (!ready) {
      const k = p.skillCd / p.skillCdMax;
      ctx.save();
      ctx.beginPath(); ctx.rect(x, y, S, S); ctx.clip();
      ctx.fillStyle = "rgba(8,6,14,0.72)";
      ctx.beginPath(); ctx.moveTo(x + S / 2, y + S / 2);
      ctx.arc(x + S / 2, y + S / 2, S, -Math.PI / 2, -Math.PI / 2 + TAU * k);
      ctx.closePath(); ctx.fill();
      ctx.restore();
      ctx.font = "bold 10px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      HUD.text(ctx, p.skillCd >= 1 ? String(Math.ceil(p.skillCd)) : p.skillCd.toFixed(1), x + S / 2, y + S / 2 + 1, "#ffffff");
      ctx.font = "8px monospace"; ctx.textBaseline = "top"; ctx.textAlign = "left";
    }
    const act = Math.min(1, p.rageTime > 0 ? p.rageTime / s.duration : p.holyTime > 0 ? p.holyTime / s.duration : 0) || 0;
    if (act > 0) {
      ctx.fillStyle = "#2a1520"; ctx.fillRect(x, y + S + 1, S, 2);
      ctx.fillStyle = s.color; ctx.fillRect(x, y + S + 1, Math.round(S * act), 2);
    }
  }

  overlay(title, line1, line2 = "") {
    ctx.fillStyle = "rgba(10,8,18,0.6)"; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = "center";
    ctx.font = "bold 24px monospace"; HUD.text(ctx, title, W / 2, H / 2 - 46, "#ffffff");
    ctx.font = "10px monospace"; HUD.text(ctx, line1, W / 2, H / 2 - 8, "#ffe26b");
    HUD.text(ctx, line2, W / 2, H / 2 + 6, "#b8b0d0");
    ctx.textAlign = "left"; ctx.font = "8px monospace";
  }

  /** Điện thoại: mũi tên hướng ngắm quanh nhân vật thay cho tâm ngắm chuột */
  drawAimGuide() {
    const p = this.player, cam = this.camera;
    const sx = p.cx - cam.rx, sy = p.cy - cam.ry, a = p.aim, aiming = input.touchAim !== null;
    ctx.fillStyle = aiming ? "rgba(255,226,107,0.85)" : "rgba(255,255,255,0.35)";
    for (let i = 0; i < 4; i++) {
      const d = 20 + i * 7;
      ctx.fillRect(Math.round(sx + Math.cos(a) * d) - 1, Math.round(sy + Math.sin(a) * d) - 1, 2, 2);
    }
    const tx = sx + Math.cos(a) * 50, ty = sy + Math.sin(a) * 50;
    ctx.beginPath();
    ctx.moveTo(tx + Math.cos(a) * 4, ty + Math.sin(a) * 4);
    ctx.lineTo(tx + Math.cos(a + 2.4) * 4, ty + Math.sin(a + 2.4) * 4);
    ctx.lineTo(tx + Math.cos(a - 2.4) * 4, ty + Math.sin(a - 2.4) * 4);
    ctx.closePath(); ctx.fill();
  }

  drawCrosshair() {
    const cx = Math.round(input.mouse.x), cy = Math.round(input.mouse.y);
    ctx.fillStyle = "#000000";
    ctx.fillRect(cx - 6, cy - 1, 4, 3); ctx.fillRect(cx + 3, cy - 1, 4, 3); ctx.fillRect(cx - 1, cy - 6, 3, 4); ctx.fillRect(cx - 1, cy + 3, 3, 4);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(cx - 5, cy, 3, 1); ctx.fillRect(cx + 3, cy, 3, 1);
    ctx.fillRect(cx, cy - 5, 1, 3); ctx.fillRect(cx, cy + 3, 1, 3);
    ctx.fillStyle = "#ff3b30"; ctx.fillRect(cx, cy, 1, 1);
  }
}

// =====================================================================================
//  CON MÈO ngồi trên đầu Bạch Ngưng Băng lúc Ngại Ngùng (pixel art vẽ tay, quay mặt sang PHẢI)
//    k viền · o cam · O vằn cam đậm · w trắng · p hồng · e mắt
// =====================================================================================
const CAT_PAL = { k: "#1a1420", o: "#f2a04a", O: "#c0662a", w: "#fff4e6", p: "#ff9ab8", e: "#1a1420", y: "#7cf0ff" };
const CAT_BODY = [
  ".k.....k.....",
  "kok...kok....",
  "kpokkkkopk...",
  "koOoOoOook...",
  "kooeoooeok...",
  "kowwopowwk...",
  ".kwwwwwwk....",
  "kooOoooook...",
  "kowoOooowk...",
  "kowwkkkwwk...",
  ".kk.....kk...",
];
const CAT_TAIL = [   // 2 dáng đuôi phe phẩy (vẽ đè lên cột bên phải)
  [[9, 7, "k"], [10, 7, "k"], [10, 6, "o"], [11, 6, "k"], [11, 5, "o"], [12, 5, "k"], [10, 5, "k"], [11, 4, "k"], [9, 8, "o"], [10, 8, "k"]],
  [[9, 8, "o"], [10, 8, "o"], [11, 8, "k"], [11, 7, "o"], [12, 7, "k"], [12, 6, "k"], [11, 6, "k"], [10, 7, "k"], [10, 9, "k"], [9, 9, "k"]],
];
function drawCat(c, footX, headTopY, flip, t) {
  const W0 = 13, H0 = CAT_BODY.length;
  const pop = Math.min(1, t / 0.12);                 // bật ra từ hư không
  const x0 = Math.round(footX - 5), y0 = Math.round(headTopY - H0 + 1 + (1 - pop) * 4 + (Math.floor(t * 4) % 2 ? 0 : -1 * 0));
  const blink = (t % 1.1) > 0.98 || (t > 0.45 && t < 0.55), glow = t > 0.5;   // nháy mắt; lúc sét đánh: mắt sáng xanh
  const px = (x, y, ch) => {
    const col = ch === "e" ? (blink ? CAT_PAL.o : glow ? CAT_PAL.y : CAT_PAL.e) : CAT_PAL[ch];
    if (!col) return;
    c.fillStyle = col;
    c.fillRect(flip ? x0 + (W0 - 1 - x) - 3 : x0 + x, y0 + y, 1, 1);
  };
  CAT_BODY.forEach((r, y) => [...r].forEach((ch, x) => ch !== "." && px(x, y, ch)));
  for (const [x, y, ch] of CAT_TAIL[Math.floor(t * 5) % 2]) px(x, y, ch);
}

/** Sắp xếp người/quái theo vị trí chân (hàm dựng sẵn, không tạo closure mới mỗi frame) */
const byFeetY = (a, b) => a.y - b.y;

// =====================================================================================
//  BỘ ĐẾM FPS (góc trên phải) — đếm số khung hình thật mỗi 0.5 giây
//  Xanh >= 55 · Vàng >= 40 · Đỏ < 40.  Bật thêm thông số pool/hiệu ứng: phím H (debug)
// =====================================================================================
const fpsMeter = { frames: 0, acc: 0, value: 0, low: 0, slowest: 0 };
function tickFps(realDt) {
  window.__fps = fpsMeter.value;
  fpsMeter.frames++;
  fpsMeter.acc += realDt;
  fpsMeter.slowest = Math.max(fpsMeter.slowest, realDt);
  if (fpsMeter.acc >= 0.5) {
    fpsMeter.value = fpsMeter.frames / fpsMeter.acc;
    fpsMeter.low = 1 / Math.max(1e-3, fpsMeter.slowest);   // frame chậm nhất trong 0.5s (bắt được giật khựng)
    fpsMeter.frames = 0; fpsMeter.acc = 0; fpsMeter.slowest = 0;
  }
}
function drawFps(c) {
  const v = Math.round(fpsMeter.value);
  const col = v >= 55 ? "#5fdc8c" : v >= 40 ? "#ffd34a" : "#ff5a5a";
  c.font = "7px monospace"; c.textBaseline = "top"; c.textAlign = "right";
  c.fillStyle = "rgba(12,10,20,0.72)"; c.fillRect(W - 46, 4, 42, 10);
  HUD.text(c, `FPS ${v}`, W - 7, 6, col);
  c.font = "8px monospace"; c.textAlign = "left";
}

// Chế độ tự chơi để kiểm tra: .../game/#autoplay-<nhân vật>-<bản đồ>  (ví dụ #autoplay-1-3)
//   thêm "-god" = bất tử, "-wave-5" = bắt đầu từ đợt 5, "-diff-2" = độ khó Ác Mộng
// Thử tải hàng trăm quái: .../game/#stress-300  (có thể ghép: #autoplay-0-0-stress-300)
const STRESS = Number((location.hash.match(/stress-(\d+)/) ?? [])[1] ?? 0);
const AUTOPLAY = location.hash.startsWith("#autoplay");
const GOD = /god/.test(location.hash);
const EXTRACT_TEST = /extract/.test(location.hash);
function autoplay(game) {
  const p = game.player, cam = game.camera;
  if (GOD) { p.hp = p.maxHp; }
  let best = null, bd = Infinity;
  for (const e of game.enemies) { if (e.dead) continue; const d = Math.hypot(e.cx - p.cx, e.cy - p.cy); if (d < bd) { bd = d; best = e; } }
  // mục tiêu di chuyển: rương -> tim / ngọc gần -> đền thờ -> đi lòng vòng
  let goal = game.chests[0] ?? null;
  const run = game.run;
  if (run?.playing) {   // Rút Quân: tới nhiệm vụ gần nhất, xong thì tới bãi đáp
    goal = null;
    if (run.padOpen && run.pad && (run.missions.doneCount >= run.missions.list.length || run.flare || run.timeLeft < 60 || run.missions.doneCount >= 1)) goal = run.pad;
    else { let bd2 = Infinity; for (const m of run.missions.active) { const d2 = (m.x - p.x) ** 2 + (m.y - p.y) ** 2; if (d2 < bd2) { bd2 = d2; goal = m.type === "rescue" ? m.survivor : m; } } }
    const it = game.interactTarget;
    if (it && ["loot", "rescue", "download", "extract"].includes(it.kind)) input.pressed.add("e");
    if (p.hp < p.maxHp * 0.5) { const i = run.bag.findIndex((s) => s?.id === "medkit"); if (i >= 0) run.useSlot(i); }
  }
  if (!goal) for (const pk of game.pickups) if (!pk.blockedUntilLeave && !(pk.kind === "heart" && p.hp >= p.maxHp)) { goal = pk; break; }
  if (!goal) { let od = 260 * 260; for (const o of game.orbs) { const d2 = (o.x - p.x) ** 2 + (o.y - p.y) ** 2; if (d2 < od) { od = d2; goal = o; } } }
  if (!goal) goal = game.world.shrines.find((s) => s.cool <= 0) ?? null;
  for (const k of ["w", "a", "s", "d"]) input.keys.delete(k);
  if (goal && run?.playing && (goal.x - p.x) ** 2 + (goal.y - p.y) ** 2 < 16 * 16) goal = null;
  let tx = goal ? goal.x : p.x + (Math.floor(game.time / 3) % 2 ? 80 : -80), ty = goal ? goal.y : p.y + (Math.floor(game.time / 5) % 2 ? 40 : -40);
  if (best && bd < 55) { tx = p.x - (best.x - p.x) * 3; ty = p.y - (best.y - p.y) * 3; }   // bị áp sát: lùi ra
  if (tx > p.x + 6) input.keys.add("d"); else if (tx < p.x - 6) input.keys.add("a");
  if (ty > p.y + 6) input.keys.add("s"); else if (ty < p.y - 6) input.keys.add("w");
  if (!best) { input.mouse.left = false; return; }
  // >>> nhắm bằng tọa độ MÀN HÌNH = thế giới - camera
  input.mouse.x = clamp(best.cx - cam.x, 0, W); input.mouse.y = clamp(best.cy - cam.y, 0, H);
  input.mouse.left = true;
  if (p.weapon.charge && p.charge && p.chargeK >= (p.charge.t % 2 < 1 ? 1 : 0.4)) input.mouse.left = false;   // vũ khí tích lực: thả chuột khi đủ lực
  if (p.noEnergyT > 0 && p.weapons[1]) input.pressed.add("q");                                                    // hết năng lượng: đổi vũ khí
  if (game.interactTarget?.kind === "weapon" && Math.random() < 0.05) input.pressed.add("e");                    // nhặt vũ khí
  if (p.mergeable) input.pressed.add("g");                                                                         // ghép vũ khí
  if (p.skillCd <= 0 && (bd < 80 || game.enemies.length > 5)) input.pressed.add(" ");
  if (bd < 40 && p.rollCd <= 0) input.pressed.add("shift");
  if (Math.random() < 0.004) input.pressed.add("q");
}

// =====================================================================================
// 10. GIAO DIỆN MENU (DOM) — chọn nhân vật, chọn bản đồ, chọn thẻ nâng cấp, Game Over
// =====================================================================================
const $ = (id) => document.getElementById(id);

class MenuUI {
  constructor(game) {
    this.game = game;
    this.time = 0;
    this.panel = null;        // "armory" | "upgrade" | "portal" | null
    this.infoT = 0;           // còn bao lâu thì ẩn thẻ thông tin (sau khi đổi nhân vật)
    this.infoChar = -1;
    this.el = {
      menu: $("menu"), gameover: $("gameover"), levelup: $("levelup"), shop: $("shop"),
      start: $("start-btn"), quick: $("quick-btn"), quickSub: $("quick-sub"), mute: $("mute-btn"), gems: $("gem-count"),
      info: $("info-card"), infoHint: $("info-hint"), infoUps: $("info-ups"),
      name: $("info-name"), title: $("info-title"), desc: $("info-desc"),
      hpBar: $("stat-hp"), hpVal: $("stat-hp-val"), armorBar: $("stat-armor"), armorVal: $("stat-armor-val"),
      speedBar: $("stat-speed"), speedVal: $("stat-speed-val"),
      weaponIcon: $("weapon-icon"), weaponName: $("weapon-name"), weaponDesc: $("weapon-desc"),
      skillIcon: $("skill-icon"), skillName: $("skill-name"), skillDesc: $("skill-desc"), skillCd: $("skill-cd"),
      mapPrev: $("map-prev"), mapNext: $("map-next"), mapName: $("map-name"), mapDesc: $("map-desc"), mapPreview: $("map-preview"),
      goScore: $("go-score"), goBest: $("go-best"), goKills: $("go-kills"), goTime: $("go-time"),
      goMap: $("go-map"), goLevel: $("go-level"), goWeapons: $("go-weapons"),
      goWave: $("go-wave"), goCombo: $("go-combo"), goPerks: $("go-perks"), goGems: $("go-gems"), goGold: $("go-gold"),
      goChar: $("go-char"), goRecord: $("go-record"), retry: $("retry-btn"), home: $("home-btn"),
      lvNum: $("lv-num"), perkList: $("perk-list"), reroll: $("reroll-btn"), rerollLeft: $("reroll-left"),
      title2: $("title-canvas"),
      passive: $("info-passive"), infoBest: $("info-best"),
      diffPrev: $("diff-prev"), diffNext: $("diff-next"), diffName: $("diff-name"), diffDesc: $("diff-desc"),
      rulesBtn: $("rules-btn"), rules: $("rules"), rulesClose: $("rules-close"),
      lp: $("lobby-panel"), lpTitle: $("lp-title"), lpGems: $("lp-gems"), lpClose: $("lp-close"),
      lpArmory: $("lp-armory"), lpUpgrade: $("lp-upgrade"), lpPortal: $("lp-portal"),
      armoryGrid: $("armory-grid"), recipeList: $("recipe-list"), partsRow: $("parts-row"), upgradeList: $("upgrade-list"), upChar: $("up-char"),
      portalChar: $("portal-char"), loadout: $("portal-loadout"),
      shopList: $("shop-list"), shopGold: $("shop-gold"), shopMsg: $("shop-msg"), shopClose: $("shop-close"),
      // --- bản 5.0: Cổng Xuất Kích (chế độ + Túi Chiến Thuật) & bảng Tổng kết Rút Quân ---
      quickLabel: $("quick-label"), startLabel: $("start-label"), portalHint: $("portal-hint"),
      modeExtract: $("mode-extract"), modeArcade: $("mode-arcade"), ppExtract: $("pp-extract"),
      stashItems: $("stash-items"), stashWeapons: $("stash-weapons"), stashWCount: $("stash-wcount"),
      bagSlots: $("bag-slots"), bagWeapon: $("bag-weapon"), durBtns: $("dur-btns"),
      xresult: $("xresult"), xrKicker: $("xr-kicker"), xrTitle: $("xr-title"), xrSub: $("xr-sub"), xrMissions: $("xr-missions"),
      xrTime: $("xr-time"), xrKills: $("xr-kills"), xrScore: $("xr-score"), xrGems: $("xr-gems"), xrHaulH: $("xr-haul-h"), xrHaul: $("xr-haul"),
      xrAgain: $("xr-again"), xrHome: $("xr-home"),
      // --- bản 5.2: tab giới thiệu chế độ + KHOANG MÁY BAY ---
      ppBrief: $("pp-brief"), ppArcade: $("pp-arcade"), briefStash: $("brief-stash"),
      cabin: $("cabin"), cabChar: $("cab-char"), cabDiff: $("cab-diff"), cabAlt: $("cab-alt"), cabSpd: $("cab-spd"),
      cabEta: $("cab-eta"), cabEtaWrap: $("cab-eta-wrap"), cabLight: $("cab-light"), cabAmmo: $("cab-ammo"),
      cabBack: $("cab-back"), cabJump: $("cab-jump"), cabToggle: $("cab-toggle"), cabKitX: $("cab-kit-x"), cabSkip: $("cab-skip"),
    };
    this.buildTitle();
    this.bindEvents();
    this.syncMute();
    this.selectMap(game.mapIndex, false);
    this.selectDiff(game.diffIndex, false);
  }

  buildTitle() {
    const c = this.el.title2, fw = 96, fh = 14;
    c.width = fw; c.height = fh;
    const frame = createFrame(fw, fh), img = new ImageData(fw, fh);
    const p = painterFor(frame);
    p.text("PIXEL ARENA", fw / 2, 3, hex("#ffe26b"), { font: "big", align: "center", outline: hex("#3a1a08") }); // >>> ĐỔI TÊN GAME Ở ĐÂY (chữ không dấu)
    composite(frame, img.data, null);
    c.getContext("2d").putImageData(img, 0, 0);
  }

  bindEvents() {
    const g = this.game;
    this.el.mapPrev.addEventListener("click", () => { g.sound.unlock(); this.stepMap(-1); });
    this.el.mapNext.addEventListener("click", () => { g.sound.unlock(); this.stepMap(1); });
    this.el.start.addEventListener("click", () => g.launch(g.charIndex));
    this.el.quick.addEventListener("click", () => g.launch(g.charIndex));
    this.el.mute.addEventListener("click", () => { g.sound.unlock(); this.toggleMute(); });
    this.el.retry.addEventListener("click", () => g.start(g.charIndex));
    this.el.home.addEventListener("click", () => g.goMenu());
    this.el.diffPrev.addEventListener("click", () => { g.sound.unlock(); this.stepDiff(-1); });
    this.el.diffNext.addEventListener("click", () => { g.sound.unlock(); this.stepDiff(1); });
    this.el.rulesBtn.addEventListener("click", () => { g.sound.unlock(); this.showRules(true); });
    this.el.rulesClose.addEventListener("click", () => this.showRules(false));
    this.el.reroll.addEventListener("click", () => g.rerollPerks());
    this.el.lpClose.addEventListener("click", () => this.closePanels());
    this.el.lp.addEventListener("click", (e) => { if (e.target === this.el.lp) this.closePanels(); });   // bấm ra ngoài bảng = đóng
    this.el.shopClose.addEventListener("click", () => g.closeShop());
    // Cổng Xuất Kích: chọn chế độ, thời lượng · Tổng kết rút quân
    this.el.modeExtract.addEventListener("click", () => { g.setMode("extract"); g.sound.play("uiSelect", 0.5); this.renderPanel(); });
    this.el.modeArcade.addEventListener("click", () => { g.setMode("arcade"); g.sound.play("uiSelect", 0.5); this.renderPanel(); });
    this.el.durBtns.addEventListener("click", (e) => { const m = Number(e.target.closest("button")?.dataset.min); if (m) { g.stash.setDuration(m); g.sound.play("uiSelect", 0.5); this.refreshKit(); } });
    this.el.xrAgain.addEventListener("click", () => g.launch(g.charIndex));
    // KHOANG MÁY BAY: về sảnh / nhảy dù
    this.el.cabBack.addEventListener("click", () => { g.sound.play("uiSelect", 0.5); g.goMenu(); });
    this.el.cabJump.addEventListener("click", () => g.jumpFromCabin());
    this.el.cabToggle.addEventListener("click", () => this.toggleKit());
    this.el.cabKitX.addEventListener("click", () => this.toggleKit(false));
    this.el.cabSkip.addEventListener("click", () => { const ev = g.cabin.skip(); if (ev === "boarded") this.setCabinCutscene(false); });
    // Tab trong khoang = bật/tắt bảng trang bị (không để trình duyệt nhảy ô)
    window.addEventListener("keydown", (e) => { if (e.key === "Tab" && g.state === GAME_STATE.CABIN) e.preventDefault(); });
    this.el.xrHome.addEventListener("click", () => g.goMenu());
    window.addEventListener("pointerdown", () => g.sound.unlock(), { once: true });
  }

  stepMap(dir) { const n = BIOMES.length; this.selectMap((this.game.mapIndex + dir + n) % n); }
  stepDiff(dir) { const n = DIFFICULTY.length; this.selectDiff((this.game.diffIndex + dir + n) % n); }

  /** Chọn độ khó */
  selectDiff(i, playSound = true) {
    const g = this.game, d = DIFFICULTY[i];
    g.diffIndex = i;
    savePref("pixelArena.diff", String(i));
    if (playSound) g.sound.play("uiSelect", 0.5);
    this.el.diffName.textContent = d.name;
    this.el.diffDesc.textContent = d.desc;
    this.el.diffName.parentElement.style.setProperty("--diff-color", d.color);
  }

  /** Chọn bản đồ: cập nhật tên, mô tả và ảnh xem trước */
  selectMap(i, playSound = true) {
    const g = this.game, b = BIOMES[i];
    g.mapIndex = i;
    savePref("pixelArena.map", String(i));
    if (playSound) g.sound.play("uiSelect", 0.5);
    this.el.mapName.textContent = b.name;
    this.el.mapDesc.textContent = b.desc;
    this.el.mapPreview.parentElement.title = b.desc;
    drawMapPreview(this.el.mapPreview, b);
  }

  /** Mở / đóng màn hình Luật Chơi */
  showRules(on) {
    this.el.rules.classList.toggle("hidden", !on);
    if (on) this.el.rulesClose.focus();
  }
  get rulesOpen() { return !this.el.rules.classList.contains("hidden"); }

  // ---------------- SẢNH CHỜ ----------------
  /** Sảnh báo: vừa đổi sang nhân vật i */
  onSwitch(i) {
    const g = this.game;
    g.charIndex = i;
    savePref("pixelArena.char", String(i));
    this.showInfo(i, false);
    this.infoT = 3.5;
    this.updateQuick();
    const me = this.game.lobby?.me;
    if (me) FX.levelUp(me.x, me.y + 2);
  }
  /** Sảnh báo: đang đứng gần nhân vật i (null = không gần ai) */
  onFocus(i) {
    if (i === null) { if (this.infoT <= 0) this.hideInfo(); return; }
    this.infoT = 0;
    this.showInfo(i, true);
  }
  /** Điền thẻ thông tin nhân vật. near = đang đứng gần (hiện lời nhắc E) */
  showInfo(i, near) {
    const g = this.game, char = CHARACTERS[i], e = this.el, s = char.stats, pr = g.progress;
    this.infoChar = i;
    e.name.textContent = char.name;
    e.title.textContent = char.title ?? "";
    e.desc.textContent = char.desc ?? "";
    e.passive.textContent = char.passive ?? "—";
    e.infoBest.textContent = g.bestByChar[char.id] ?? 0;
    const hpUp = pr.level(char.id, "hp"), arUp = pr.level(char.id, "armor");
    setStat(e.hpBar, e.hpVal, s.hp + hpUp, STAT_MAX.hp);
    setStat(e.armorBar, e.armorVal, s.armor + arUp, STAT_MAX.armor);
    setStat(e.speedBar, e.speedVal, s.speed, STAT_MAX.speed);
    const ups = UPGRADES.map((u) => pr.level(char.id, u.id)).filter(Boolean).length;
    e.infoUps.textContent = ups ? UPGRADES.map((u) => `${u.icon}${pr.level(char.id, u.id)}`).join(" ") : "chưa có";
    const wl = 1 + pr.level(char.id, "weapon");
    e.weaponName.textContent = `${char.weapon.name}${wl > 1 ? " " + "★".repeat(wl) : ""}`;
    e.weaponDesc.textContent = `${char.weapon.desc} · Sát thương ${fmtNum(char.weapon.damage * WEAPON_LEVELS_DMG[wl])}${char.weapon.charge ? " · giữ chuột để tích lực" : ""}`;
    drawWeaponPreview(e.weaponIcon, char, g.assets.images);
    e.skillName.textContent = char.skill.name;
    e.skillDesc.textContent = char.skill.desc;
    e.skillCd.textContent = `${fmtNum(char.skill.cooldown * (1 - 0.08 * pr.level(char.id, "cd")))}s`;
    const ic = e.skillIcon.getContext("2d");
    ic.imageSmoothingEnabled = false;
    ic.clearRect(0, 0, 20, 20);
    ic.drawImage(getSkillIcon(char, g.assets.images), 0, 0);
    e.skillIcon.parentElement.style.setProperty("--skill-color", char.skill.color);
    e.menu.style.setProperty("--hero-accent", char.skill.color);
    const me = i === g.charIndex;
    e.infoHint.innerHTML = me ? "★ Đang điều khiển" : TOUCH ? "Chạm vào nhân vật để điều khiển" : "Bấm <kbd>E</kbd> (hoặc click) để điều khiển nhân vật này";
    e.infoHint.classList.toggle("me", me);
    e.info.classList.remove("hidden");
    void near;
  }
  hideInfo() { this.el.info.classList.add("hidden"); this.infoChar = -1; }

  updateQuick() {
    const g = this.game;
    this.el.quickLabel.textContent = g.mode === "extract" ? "XUẤT KÍCH" : "VÀO TRẬN NHANH";
    this.el.quickSub.textContent = g.mode === "extract"
      ? `Rút Quân · ${CHARACTERS[g.charIndex].name} · ${String(g.stash.duration).padStart(2, "0")}:00 · ${DIFFICULTY[g.diffIndex].name}`
      : `Giải Trí · ${CHARACTERS[g.charIndex].name} · ${BIOMES[g.mapIndex].name} · ${DIFFICULTY[g.diffIndex].name}`;
    this.el.gems.textContent = g.progress.gems;
  }

  /** Mở bảng của 1 trạm trong phòng */
  openPanel(id) {
    const e = this.el;
    this.panel = id;
    this.game.lobby.blocked = true;
    this.hideInfo();
    e.lpArmory.classList.toggle("hidden", id !== "armory");
    e.lpUpgrade.classList.toggle("hidden", id !== "upgrade");
    e.lpPortal.classList.toggle("hidden", id !== "portal");
    e.lpTitle.textContent = { armory: "KHO VŨ KHÍ", upgrade: "BÀN NÂNG CẤP", portal: "CỔNG XUẤT KÍCH" }[id];
    e.lp.dataset.kind = id;
    e.lp.classList.remove("is-portal");
    this.renderPanel();
    e.lp.classList.remove("hidden");
    (id === "portal" ? e.start : e.lpClose).focus();
  }
  closePanels() {
    if (!this.panel) return;
    this.panel = null;
    if (this.game.lobby) this.game.lobby.blocked = false;
    this.el.lp.classList.add("hidden");
    document.activeElement?.blur?.();
    this.updateQuick();
  }
  renderPanel() {
    const g = this.game;
    this.el.lpGems.textContent = g.progress.gems;
    if (this.panel === "armory") this.renderArmory();
    else if (this.panel === "upgrade") this.renderUpgrade();
    else if (this.panel === "portal") this.renderPortal();
    this.updateQuick();
  }

  /** KHO VŨ KHÍ: thẻ vũ khí theo độ hiếm — Chế tạo (Ngọc) / Mang theo */
  renderArmory() {
    const g = this.game, pr = g.progress, grid = this.el.armoryGrid;
    grid.replaceChildren();
    const none = document.createElement("button");
    none.type = "button";
    none.className = `arm-card arm-none${pr.secondary ? "" : " equipped"}`;
    none.innerHTML = `<strong>Không mang</strong><span class="arm-desc">Chỉ dùng vũ khí khởi đầu (ô 2 trống, nhặt trong trận)</span><span class="arm-btn">${pr.secondary ? "CHỌN" : "✓ ĐANG CHỌN"}</span>`;
    none.addEventListener("click", () => { pr.setSecondary(null); g.sound.play("swap", 0.5); this.renderPanel(); });
    grid.append(none);
    const list = Object.values(WEAPONS).filter((w) => CRAFT_COST[w.rarity] !== undefined).sort((a, b) => RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity));
    for (const w of list) {
      const own = pr.isUnlocked(w.id), eq = pr.secondary === w.id, cost = CRAFT_COST[w.rarity];
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `arm-card${own ? " owned" : ""}${eq ? " equipped" : ""}`;
      btn.style.setProperty("--r-color", rarityColor(w.rarity));
      // khung ảnh: ảnh CHI TIẾT nếu có (src/attachments.js HD_GUNS), không thì ảnh pixel phóng to
      const pic = document.createElement("span"); pic.className = "arm-pic";
      const hd = hdGunUrl(w);
      if (hd) { const im = document.createElement("img"); im.src = hd; im.alt = ""; im.loading = "lazy"; im.decoding = "async"; pic.append(im); pic.classList.add("hd"); }
      else { const cv = document.createElement("canvas"); cv.width = 64; cv.height = 26; const c2 = cv.getContext("2d"); c2.imageSmoothingEnabled = false; drawWeaponIcon(c2, w, 0, 0, 64, 26, 2); pic.append(cv); }
      const cv = pic;
      const nm = document.createElement("strong"); nm.textContent = w.name;
      const meta = document.createElement("span"); meta.className = "arm-meta";
      meta.textContent = `${rarityName(w.rarity)} · ${w.mag ? `băng ${w.mag} viên · nạp ${w.reload}s` : w.cost ? `${w.cost} năng lượng/phát` : "không tốn năng lượng"}${w.charge ? " · tích lực" : ""}${isMelee(w) ? " · cận chiến" : ""}`;
      const ds = document.createElement("span"); ds.className = "arm-desc"; ds.textContent = w.desc;
      const act = document.createElement("span"); act.className = "arm-btn";
      act.textContent = eq ? "✓ ĐANG MANG" : own ? "MANG THEO" : `CHẾ TẠO · ${cost} NGỌC`;
      if (!own && pr.gems < cost) btn.classList.add("poor");
      btn.append(cv, nm, meta, ds, act);
      btn.addEventListener("click", () => {
        if (own) { pr.setSecondary(eq ? null : w.id); g.sound.play("swap", 0.5); }
        else if (pr.craft(w.id, w.rarity)) { pr.setSecondary(w.id); g.sound.play("upgrade", 0.6); }
        else { g.sound.play("skillDenied", 0.5); btn.classList.add("shake"); setTimeout(() => btn.classList.remove("shake"), 300); return; }
        this.renderPanel();
      });
      grid.append(btn);
    }
    // phụ kiện (xem trước cho Xưởng Vũ Khí)
    const pr2 = this.el.partsRow;
    if (!pr2.childElementCount) for (const [id, a] of Object.entries(ATTACHMENTS)) {
      const d = document.createElement("div"); d.className = "part-card"; d.dataset.id = id;
      d.innerHTML = `<span class="part-pic"><img src="${a.img}" alt="" loading="lazy"></span><b>${a.name}</b><small>${ATTACH_SLOTS[a.slot]}</small><span>${a.desc}</span>`;
      pr2.append(d);
    }
    // công thức ghép
    const rl = this.el.recipeList;
    rl.replaceChildren();
    const li = (html) => { const x = document.createElement("li"); x.innerHTML = html; rl.append(x); };
    const tag = (w) => `<b style="color:${rarityColor(w.rarity)}">${w.name}</b>`;
    li(`2 khẩu <b>giống nhau, cùng ★</b> → lên <b class="c-gold">★+1</b> (tối đa ★3)`);
    for (const w of Object.values(WEAPONS)) if (w.evolve) li(`${tag(w)} ★3 + ${tag(w)} ★3 → ${tag(WEAPONS[w.evolve])}`);
    for (const r of RECIPES) li(`${tag(WEAPONS[r.a])} + ${tag(WEAPONS[r.b])} → ${tag(WEAPONS[r.out])}`);
  }

  /** BÀN NÂNG CẤP: 4 chỉ số vĩnh viễn của nhân vật đang chọn */
  renderUpgrade() {
    const g = this.game, pr = g.progress, char = CHARACTERS[g.charIndex], list = this.el.upgradeList;
    this.el.upChar.textContent = char.name;
    list.replaceChildren();
    for (const u of UPGRADES) {
      const lv = pr.level(char.id, u.id), cost = pr.nextCost(char.id, u.id);
      const row = document.createElement("div");
      row.className = "up-row";
      row.style.setProperty("--u-color", u.color);
      const pips = Array.from({ length: u.max }, (_, k) => `<i class="pip${k < lv ? " on" : ""}"></i>`).join("");
      row.innerHTML = `<span class="up-icon">${u.icon}</span><div class="up-text"><strong>${u.name}</strong><span>${u.desc}</span><span class="pips">${pips}</span></div>`;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn-secondary up-buy";
      btn.textContent = cost === null ? "TỐI ĐA" : `NÂNG · ${cost} NGỌC`;
      btn.disabled = cost === null || pr.gems < cost;
      btn.addEventListener("click", () => {
        if (pr.buyUpgrade(char.id, u.id)) { g.sound.play("upgrade", 0.7); FX.levelUp(g.lobby.me.x, g.lobby.me.y); this.renderPanel(); }
        else g.sound.play("skillDenied", 0.5);
      });
      row.append(btn);
      list.append(row);
    }
  }

  renderPortal() {
    const g = this.game, pr = g.progress, char = CHARACTERS[g.charIndex], e = this.el, ex = g.mode === "extract";
    e.portalChar.textContent = char.name;
    e.lp.classList.toggle("is-portal", this.panel === "portal");   // bảng Cổng: cùng 1 kích thước cho cả 2 tab
    e.modeExtract.setAttribute("aria-selected", String(ex));
    e.modeArcade.setAttribute("aria-selected", String(!ex));
    e.ppBrief.classList.toggle("hidden", !ex);
    e.ppArcade.classList.toggle("hidden", ex);
    e.lpPortal.classList.toggle("is-arcade", !ex);
    e.startLabel.textContent = ex ? "LÊN MÁY BAY" : "VÀO TRẬN";
    e.portalHint.innerHTML = ex
      ? `Xuất kích cùng <b class="c-gold">${char.name}</b>. Phím <kbd>↑</kbd><kbd>↓</kbd>: độ khó · <kbd>Enter</kbd>: lên máy bay (chọn đồ trong khoang).`
      : `Chọn nơi xuất trận cho <b class="c-gold">${char.name}</b>. Phím <kbd>←</kbd><kbd>→</kbd>: bản đồ · <kbd>↑</kbd><kbd>↓</kbd>: độ khó · <kbd>Enter</kbd>: vào trận.`;
    const crafted = pr.secondary ? WEAPONS[pr.secondary] : null, kit = ex ? g.stash.bagWeaponDef : null, sec = kit?.def ?? crafted;
    const lvl = pr.level(char.id, "weapon");
    e.loadout.innerHTML = `Mang vào trận: <b>${char.weapon.name}${lvl ? " " + "★".repeat(1 + lvl) : ""}</b>${sec ? ` + <b style="color:${rarityColor(sec.rarity)}">${sec.name}</b>` : " · ô 2 trống"} · Máu, Giáp, Năng lượng 100%`;
    if (ex) {
      const st = g.stash, items = ITEM_ORDER.reduce((n, id) => n + st.count(id), 0), bagN = st.bag.filter(Boolean).length;
      e.briefStash.innerHTML = `Kho Đồ: <b>${items}</b> món · <b>${st.weapons.length}</b> súng · Túi đang xếp <b>${bagN}/4</b> ô · ván <b>${String(st.duration).padStart(2, "0")}:00</b>`;
    } else e.briefStash.textContent = "";
  }

  /** Làm mới khối chọn đồ (nằm trong khoang máy bay; trong sảnh thì làm mới bảng đang mở) */
  refreshKit() { if (this.game.state === GAME_STATE.CABIN) this.renderCabin(); else this.renderPanel(); }

  // ---------------- KHOANG MÁY BAY ----------------
  showCabin() {
    const e = this.el;
    e.menu.classList.add("hidden"); e.xresult.classList.add("hidden"); e.gameover.classList.add("hidden");
    stage.classList.remove("in-game");
    e.cabin.classList.remove("hidden");
    this.toggleKit(true, false);
    this.setCabinCutscene(!!this.game.cabin.cutscene);
    this.renderCabin();
  }
  /** Đang chiếu cảnh LÊN MÁY BAY: ẩn hết bảng, chỉ hiện nút bỏ qua */
  setCabinCutscene(on) {
    this.el.cabin.classList.toggle("cutscene", on);
    if (!on) this.el.cabJump.focus();
  }
  /** Bật / tắt bảng TRANG BỊ trong khoang (Tab · I · nút · đứng cạnh thùng hàng bấm E) */
  toggleKit(on = this.el.cabin.classList.contains("kit-off"), sound = true) {
    this.el.cabin.classList.toggle("kit-off", !on);
    this.el.cabToggle.innerHTML = on ? "Ẩn trang bị <small>Tab</small>" : "Mở trang bị <small>Tab</small>";
    this.el.cabToggle.setAttribute("aria-pressed", String(on));
    if (sound) this.game.sound.play("uiSelect", 0.4);
    if (on) this.renderCabin();
  }
  hideCabin() { this.el.cabin.classList.add("hidden"); }
  renderCabin() {
    const g = this.game, e = this.el, char = CHARACTERS[g.charIndex], d = DIFFICULTY[g.diffIndex];
    e.cabChar.textContent = char.name;
    e.cabDiff.textContent = d.name; e.cabDiff.style.color = d.color;
    this.renderKit();
    e.cabAmmo.innerHTML = "Đạn: mỗi khẩu súng mang theo <b>2 băng dự trữ</b> (vạch màu cạnh số đạn = loại đạn). Trong trận nhặt hộp đạn đúng loại (súng lục, tiểu liên, súng trường, bắn tỉa, hoa cải, súng máy, pin năng lượng, đạn nổ).";
  }
  updateCabin(dt, ev = null) {
    const g = this.game, k = input.pressed, e = this.el, cab = g.cabin;
    if (cab.cutscene) {   // cảnh LÊN MÁY BAY: Enter / Space / Esc / click để bỏ qua
      if (cab.seq.t > 0.3 && (k.has("enter") || k.has(" ") || k.has("escape") || k.has("mouse0"))) ev = cab.skip();
      if (ev === "boarded") this.setCabinCutscene(false);
      return;
    }
    if (ev === "boarded") this.setCabinCutscene(false);
    if (ev === "gear") this.toggleKit();
    if (ev === "door") { g.jumpFromCabin(); return; }
    if (k.has("tab") || k.has("i")) this.toggleKit();
    if (k.has("escape")) { g.goMenu(); return; }
    if (k.has("enter") && document.activeElement?.tagName !== "BUTTON") { g.jumpFromCabin(); return; }
    // đồng hồ trong khoang (chỉ để trang trí)
    this.cabT = (this.cabT ?? 0) - dt;
    if (this.cabT <= 0) {
      this.cabT = 0.25;
      const eta = Math.ceil(cab.eta);
      e.cabAlt.textContent = (3200 + Math.round(Math.sin(cab.t * 0.6) * 18 + (cab.turbulent ? (Math.random() - 0.5) * 60 : 0))).toLocaleString("vi-VN");
      e.cabSpd.textContent = String(520 + Math.round(Math.sin(cab.t * 0.9) * 6));
      e.cabEta.textContent = `00:${String(eta).padStart(2, "0")}`;
      e.cabEtaWrap.classList.toggle("ready", cab.ready);
      e.cabLight.textContent = cab.ready ? "ĐÈN XANH · sẵn sàng nhảy" : cab.turbulent ? "Nhiễu động · bám chắc!" : "Đèn đỏ · chuẩn bị";
      e.cabLight.classList.toggle("go", cab.ready);
      e.cabin.classList.toggle("shake", cab.turbulent);
    }
  }

  /** CỔNG XUẤT KÍCH — chế độ Rút Quân: Kho Đồ (bấm để bỏ vào túi) · Túi Chiến Thuật 4 ô · súng trong Kho · thời lượng */
  renderKit() {
    const g = this.game, st = g.stash, e = this.el, imgs = g.assets.images;
    const icon = (id, size = 16) => { const cv = document.createElement("canvas"); cv.width = cv.height = size; const c2 = cv.getContext("2d"); c2.imageSmoothingEnabled = false; drawItemIcon(c2, id, 0, 0, size, imgs); return cv; };
    e.stashItems.replaceChildren();
    for (const id of ITEM_ORDER) {
      const d = ITEM_DEFS[id], have = st.count(id), free = st.free(id);
      const b = document.createElement("button");
      b.type = "button"; b.className = "stash-item"; b.title = `${d.name}: ${d.desc}`;
      b.disabled = free <= 0 || !st.bag.some((s) => !s || (s.id === id && s.n < d.stack));
      const n = document.createElement("b"); n.textContent = `x${have}`;
      const nm = document.createElement("span"); nm.textContent = d.name;
      b.append(icon(id), n, nm);
      if (free > 0 && free !== have) { const f = document.createElement("i"); f.className = "free"; f.textContent = `+${free}`; b.append(f); }
      b.addEventListener("click", () => { if (st.addToBag(id)) g.sound.play("swap", 0.5); else g.sound.play("skillDenied", 0.4); this.refreshKit(); });
      e.stashItems.append(b);
    }
    e.bagSlots.replaceChildren();
    const keys = TOUCH ? ["1", "2", "3", "4"] : ["Z", "X", "C", "V"];
    st.bag.forEach((s, i) => {
      const b = document.createElement("button");
      b.type = "button"; b.className = `bag-slot${s ? "" : " empty"}`;
      const k = document.createElement("span"); k.className = "key"; k.textContent = keys[i];
      b.append(k);
      if (s) {
        b.title = `${ITEM_DEFS[s.id].name} x${s.n} — bấm để bớt 1`;
        const c = document.createElement("span"); c.className = "cnt"; c.textContent = `x${s.n}`;
        b.append(icon(s.id), c);
        b.addEventListener("click", () => { st.removeFromBag(i); g.sound.play("swap", 0.4); this.refreshKit(); });
      } else b.title = "Ngăn trống — bấm món trong Kho Đồ để bỏ vào";
      e.bagSlots.append(b);
    });
    // súng trong kho (mang theo 1 khẩu làm vũ khí phụ — mất nếu tử trận)
    e.stashWeapons.replaceChildren();
    e.stashWCount.textContent = `${st.weapons.length} khẩu`;
    if (!st.weapons.length) { const p = document.createElement("p"); p.className = "stash-empty"; p.textContent = "Chưa có. Nhặt súng trong trận rồi rút quân để mang về."; e.stashWeapons.append(p); }
    st.weapons.forEach((w, i) => {
      const def = WEAPONS[w.id]; if (!def) return;
      const b = document.createElement("button");
      b.type = "button"; b.className = `stash-weapon${st.bagWeapon === i ? " on" : ""}`;
      b.style.setProperty("--r-color", rarityColor(def.rarity));
      b.title = `${def.name}${w.lvl > 1 ? " " + "★".repeat(w.lvl) : ""} — ${def.desc}`;
      const hd = hdGunUrl(def);   // ảnh chi tiết nếu có
      let cv;
      if (hd) { cv = document.createElement("img"); cv.src = hd; cv.alt = ""; }
      else { cv = document.createElement("canvas"); cv.width = 36; cv.height = 22; const c2 = cv.getContext("2d"); c2.imageSmoothingEnabled = false; drawWeaponIcon(c2, def, 0, 0, 36, 22, 1); }
      const t = document.createElement("span"); t.textContent = `${def.name}${w.lvl > 1 ? " " + "★".repeat(w.lvl) : ""}`;
      b.append(cv, t);
      b.addEventListener("click", () => { st.setBagWeapon(st.bagWeapon === i ? -1 : i); g.sound.play("swap", 0.5); this.refreshKit(); });
      e.stashWeapons.append(b);
    });
    const bw = st.bagWeaponDef;
    e.bagWeapon.innerHTML = bw ? `Vũ khí phụ: <b style="color:${rarityColor(bw.def.rarity)}">${bw.def.name}${bw.lvl > 1 ? " " + "★".repeat(bw.lvl) : ""}</b> (mang từ Kho — có rủi ro)` : "Vũ khí phụ: chọn 1 súng trong Kho, hoặc dùng vũ khí chế tạo ở Kho Vũ Khí.";
    for (const b of e.durBtns.querySelectorAll("button")) b.classList.toggle("on", Number(b.dataset.min) === st.duration);
  }

  toggleMute() { this.game.sound.toggleMute(); this.syncMute(); }
  syncMute() {
    const m = this.game.sound.muted;
    this.el.mute.textContent = m ? "🔇" : "🔊";
    this.el.mute.title = m ? "Bật âm thanh (M)" : "Tắt âm thanh (M)";
    this.el.mute.setAttribute("aria-pressed", String(m));
  }

  updateMenu(dt) {
    this.time += dt;
    const g = this.game, k = input.pressed;
    if (this.rulesOpen) { if (k.has("escape") || k.has("enter")) this.showRules(false); g.lobby.blocked = true; g.lobby.update(dt, input); g.lobby.blocked = !!this.panel; return; }
    if (this.panel) {
      if (k.has("escape") || (k.has("e") && document.activeElement?.tagName !== "INPUT")) { this.closePanels(); return; }
      if (this.panel === "portal") {
        if (g.mode === "arcade" && (k.has("arrowleft") || k.has("a"))) this.stepMap(-1);
        if (g.mode === "arcade" && (k.has("arrowright") || k.has("d"))) this.stepMap(1);
        if (k.has("arrowup") || k.has("w")) this.stepDiff(-1);
        if (k.has("arrowdown") || k.has("s")) this.stepDiff(1);
        if (k.has("enter") && document.activeElement !== this.el.start) { g.launch(g.charIndex); return; }
      }
      g.lobby.update(dt, input);
      return;
    }
    if (k.has("?") || k.has("/")) { this.showRules(true); return; }
    if (k.has("enter") && document.activeElement?.tagName !== "BUTTON") { g.launch(g.charIndex); return; }
    g.lobby.update(dt, input);
    if (this.infoT > 0 && (this.infoT -= dt) <= 0 && g.lobby.focus < 0) this.hideInfo();
  }

  showMenu() {
    this.el.gameover.classList.add("hidden");
    this.el.xresult.classList.add("hidden");
    this.el.levelup.classList.add("hidden");
    this.el.shop.classList.add("hidden");
    this.el.menu.classList.remove("hidden");
    stage.classList.remove("in-game");
    this.closePanels();
    this.updateQuick();
    this.showInfo(this.game.charIndex, false);
    this.infoT = 3.5;
  }

  showGameOver() {
    const g = this.game, e = this.el;
    e.goChar.textContent = CHARACTERS[g.charIndex].name;
    e.goScore.textContent = g.score;
    e.goBest.textContent = g.best;
    e.goKills.textContent = g.kills;
    e.goTime.textContent = `${g.time.toFixed(1)}s`;
    e.goMap.textContent = `${g.world.biome.name} · ${g.diff.name}`;
    e.goLevel.textContent = g.level;
    e.goWave.textContent = `${g.wave} · ${g.bossKills}`;
    e.goCombo.textContent = `x${g.bestCombo}`;
    e.goGems.textContent = `+${g.gemsEarned} (có ${g.progress.gems})`;
    e.goGold.textContent = g.goldTotal;
    e.goWeapons.textContent = [...g.weaponsUsed].join(" · ");
    const taken = Object.entries(g.player.perksTaken);
    e.goPerks.textContent = taken.length ? taken.map(([id, n]) => `${PERK_BY_ID[id]?.name ?? id}${n > 1 ? ` x${n}` : ""}`).join(" · ") : "—";
    e.goRecord.textContent = g.newRecord ? "★ KỶ LỤC MỚI ★" : "★ KỶ LỤC MỚI CỦA NHÂN VẬT ★";
    e.goRecord.classList.toggle("hidden", !g.newRecord && !g.newCharRecord);
    e.levelup.classList.add("hidden");
    e.shop.classList.add("hidden");
    e.gameover.classList.remove("hidden");
    stage.classList.remove("in-game");
  }

  /** TỔNG KẾT RÚT QUÂN: thành công (đồ mang về Kho) / tử trận (đồ đã mất) */
  showExtractResult(r) {
    const g = this.game, e = this.el, imgs = g.assets.images;
    e.xresult.classList.toggle("fail", !r.success);
    e.xrKicker.textContent = `${g.world.biome?.name ?? "Vùng dịch"} · ${CHARACTERS[g.charIndex].name} · ${g.diff.name}`;
    e.xrTitle.textContent = r.success ? "RÚT QUÂN THÀNH CÔNG" : r.reason === "abandon" ? "BỎ NHIỆM VỤ" : "TỬ TRẬN";
    e.xrSub.textContent = r.success
      ? (r.done === r.all ? "Hoàn thành mọi nhiệm vụ. Toàn bộ chiến lợi phẩm đã cất vào Kho Đồ." : "Trực thăng đã đưa bạn về căn cứ. Chiến lợi phẩm đã cất vào Kho Đồ.")
      : "Toàn bộ đồ mang theo trong ván đã mất. Nhân vật, vũ khí khởi đầu và đồ cất ở nhà vẫn còn.";
    e.xrMissions.textContent = `${r.done}/${r.all}`;
    e.xrTime.textContent = fmtTime(r.time);
    e.xrKills.textContent = r.kills;
    e.xrScore.textContent = r.score;
    e.xrGems.textContent = `+${r.gems}`;
    e.xrGems.title = `Đang có ${g.progress.gems} Ngọc`;
    const haul = r.success ? r.haul : r.lost;
    e.xrHaulH.textContent = r.success ? "Mang về Kho Đồ" : "Đồ đã mất";
    e.xrHaul.replaceChildren();
    let any = false;
    for (const [id, n] of Object.entries(haul?.items ?? {})) {
      if (!n) continue; any = true;
      const d = document.createElement("span"); d.className = "hi"; d.title = ITEM_DEFS[id]?.name ?? id;
      const cv = document.createElement("canvas"); cv.width = cv.height = 16; const c2 = cv.getContext("2d"); c2.imageSmoothingEnabled = false; drawItemIcon(c2, id, 0, 0, 16, imgs);
      d.append(cv, document.createTextNode(`x${n}`));
      e.xrHaul.append(d);
    }
    for (const w of haul?.weapons ?? []) {
      const def = WEAPONS[w.id]; if (!def) continue; any = true;
      const d = document.createElement("span"); d.className = "hi"; d.title = def.name;
      const cv = document.createElement("canvas"); cv.width = 36; cv.height = 22; cv.className = "wide"; const c2 = cv.getContext("2d"); c2.imageSmoothingEnabled = false; drawWeaponIcon(c2, def, 0, 0, 36, 22, 1);
      d.append(cv, document.createTextNode(def.name));
      e.xrHaul.append(d);
    }
    if (!any) { const n = document.createElement("span"); n.className = "none"; n.textContent = r.success ? "Túi rỗng — lần sau lục thêm hòm tiếp tế!" : "Không mang theo gì."; e.xrHaul.append(n); }
    e.levelup.classList.add("hidden");
    e.shop.classList.add("hidden");
    e.gameover.classList.add("hidden");
    e.xresult.classList.remove("hidden");
    stage.classList.remove("in-game");
    e.xrAgain.focus();
  }

  /** Giao diện Lên Cấp: 3 thẻ nâng cấp ngẫu nhiên (click hoặc phím 1/2/3), nút Đổi bộ thẻ (R) */
  showLevelUp(level, perks, taken, rerolls = 0) {
    const e = this.el;
    e.lvNum.textContent = level;
    e.perkList.replaceChildren();
    perks.forEach((perk, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `perk-card rarity-${perk.rarity}`;
      btn.style.setProperty("--perk-color", perk.color);
      const rar = document.createElement("span"); rar.className = "perk-rarity";
      rar.textContent = RARITY[perk.rarity]?.name ?? ""; rar.style.setProperty("--rarity-color", RARITY[perk.rarity]?.color ?? "#fff");
      const icon = document.createElement("canvas");
      icon.width = icon.height = 20;
      icon.className = "perk-icon";
      const g = icon.getContext("2d");
      g.imageSmoothingEnabled = false;
      paintBitmap(g, PERK_ICONS[perk.icon] ?? PERK_ICONS.heavy, perk.color, 2);
      const key = document.createElement("kbd"); key.textContent = String(i + 1);
      const name = document.createElement("strong"); name.textContent = perk.name;
      const desc = document.createElement("span"); desc.className = "perk-desc"; desc.textContent = perk.desc;
      const stack = document.createElement("span"); stack.className = "perk-stack";
      const have = taken[perk.id] ?? 0;
      stack.textContent = perk.fallback ? "Thẻ dự phòng" : `Cấp ${have} → ${have + 1} / ${perk.max}`;
      btn.append(key, rar, icon, name, desc, stack);
      btn.addEventListener("click", () => this.game.choosePerk(i));
      e.perkList.append(btn);
    });
    e.rerollLeft.textContent = rerolls;
    e.reroll.disabled = rerolls <= 0;
    e.levelup.classList.remove("hidden");
    stage.classList.remove("in-game");   // hiện chuột để bấm thẻ
  }

  hideLevelUp() {
    this.el.levelup.classList.add("hidden");
    stage.classList.add("in-game");
    canvas.focus();
  }

  // ---------------- QUẦY THƯƠNG NHÂN ----------------
  showShop(m, gold) {
    const e = this.el;
    e.shopGold.textContent = gold;
    e.shopList.replaceChildren();
    m.stock.forEach((it, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `perk-card shop-item${it.sold ? " sold" : ""}${gold < it.price && !it.sold ? " poor" : ""}`;
      btn.style.setProperty("--perk-color", it.weapon ? rarityColor(it.weapon.rarity) : it.color);
      const key = document.createElement("kbd"); key.textContent = String(i + 1);
      const cv = document.createElement("canvas"); cv.width = 30; cv.height = 20; cv.className = "perk-icon shop-icon";
      const c2 = cv.getContext("2d"); c2.imageSmoothingEnabled = false;
      if (it.weapon) drawWeaponIcon(c2, it.weapon, 0, 0, 30, 20, 1); else drawPotionIcon(c2, it.color, it.id);
      const name = document.createElement("strong"); name.textContent = it.name;
      const desc = document.createElement("span"); desc.className = "perk-desc";
      desc.textContent = it.weapon ? `${rarityName(it.weapon.rarity)} · ${it.desc}` : it.desc;
      const price = document.createElement("span"); price.className = "perk-stack shop-price";
      price.textContent = it.sold ? "ĐÃ BÁN" : `● ${it.price} VÀNG`;
      btn.append(key, cv, name, desc, price);
      btn.disabled = it.sold;
      btn.addEventListener("click", () => this.game.buyItem(i));
      e.shopList.append(btn);
    });
    e.shop.classList.remove("hidden");
    stage.classList.remove("in-game");
  }
  shopMessage(text, color) { this.el.shopMsg.textContent = text; this.el.shopMsg.style.color = color; }
  hideShop() {
    this.el.shop.classList.add("hidden");
    this.el.shopMsg.innerHTML = "&nbsp;";
    if (this.game.state === GAME_STATE.PLAYING) { stage.classList.add("in-game"); canvas.focus(); }
  }

  hideAll() {
    this.el.menu.classList.add("hidden");
    this.el.cabin.classList.add("hidden");
    this.el.xresult.classList.add("hidden");
    this.el.rules.classList.add("hidden");
    this.el.gameover.classList.add("hidden");
    this.el.levelup.classList.add("hidden");
    this.el.shop.classList.add("hidden");
    stage.classList.add("in-game");
    document.activeElement?.blur?.();
  }
}

/** Hệ số sát thương theo ★ (để hiện trong thẻ thông tin) */
const WEAPON_LEVELS_DMG = [1, 1, 1.25, 1.5];

/** Icon bình thuốc nhỏ cho quầy hàng */
function drawPotionIcon(g, color, id) {
  g.fillStyle = "#0e0c14"; g.fillRect(10, 5, 10, 13); g.fillRect(12, 1, 6, 4);
  g.fillStyle = "#e8e2f6"; g.fillRect(13, 2, 4, 3);
  g.fillStyle = color; g.fillRect(11, 8, 8, 9);
  g.fillStyle = "#ffffff"; g.fillRect(12, 9, 2, 3);
  if (id === "maxHp") { g.fillStyle = "#ffe26b"; g.fillRect(14, 11, 2, 4); g.fillRect(13, 12, 4, 2); }
}

function setStat(bar, label, value, max) {
  bar.style.width = `${Math.round(clamp(value / max, 0, 1) * 100)}%`;
  label.textContent = value;
}

function drawWeaponPreview(cv, char, images) {
  const g = cv.getContext("2d");
  g.imageSmoothingEnabled = false;
  g.clearRect(0, 0, cv.width, cv.height);
  const img = images[`${char.id}.weapon`];
  if (img) {
    const sc = Math.min(cv.width / img.width, cv.height / img.height);
    g.drawImage(img, (cv.width - img.width * sc) / 2, (cv.height - img.height * sc) / 2, img.width * sc, img.height * sc);
  } else drawWeaponIcon(g, char.weapon, 0, 0, cv.width, cv.height, 1);
}

/** Ảnh xem trước bản đồ (vẽ thu nhỏ màu nền + vật cản đặc trưng) */
function drawMapPreview(cv, b) {
  const g = cv.getContext("2d"), w = cv.width, h = cv.height;
  g.imageSmoothingEnabled = false;
  for (let y = 0; y < h; y += 4) for (let x = 0; x < w; x += 4) { g.fillStyle = ((x + y) / 4) % 2 ? b.floor.a : b.floor.b; g.fillRect(x, y, 4, 4); }
  g.fillStyle = b.wall.dark; g.fillRect(0, 0, w, 3); g.fillRect(0, h - 2, w, 2); g.fillRect(0, 0, 2, h); g.fillRect(w - 2, 0, 2, h);
  g.fillStyle = b.wall.top; g.fillRect(0, 3, w, 1);
  const pillar = (x, y, s) => { g.fillStyle = b.wall.pillarFace; g.fillRect(x, y + s - 2, s, 2); g.fillStyle = b.wall.pillarTop; g.fillRect(x, y, s, s - 2); };
  pillar(7, 7, 5); pillar(30, 12, 6); pillar(18, 16, 4);
  if (b.id === "forest") { g.fillStyle = "#56d23a"; g.fillRect(10, 15, 6, 3); g.fillRect(26, 6, 5, 3); }
  if (b.id === "lava") { g.fillStyle = "#f2561d"; g.fillRect(4, 12, 14, 3); g.fillRect(22, 5, 3, 9); g.fillStyle = "#ffc23d"; g.fillRect(6, 13, 3, 1); }
  if (b.id === "ice") { g.fillStyle = "#3a8bd8"; g.fillRect(13, 6, 2, 4); g.fillRect(33, 4, 2, 4); g.fillStyle = "#ffffff"; g.fillRect(13, 6, 1, 1); }
  if (b.id === "grave") { g.fillStyle = "#6a6e78"; for (const [x, y] of [[9, 12], [15, 13], [27, 7], [33, 14]]) { g.fillRect(x, y, 3, 4); g.fillRect(x + 1, y - 1, 1, 1); } g.fillStyle = "rgba(200,210,230,0.25)"; g.fillRect(2, 15, 36, 3); g.fillStyle = "#7a3cc8"; g.fillRect(21, 15, 4, 2); }
  g.fillStyle = "#b02a26"; g.fillRect(24, 16, 3, 3);   // thùng nổ
}

// =====================================================================================
// 11. GAME LOOP
// =====================================================================================
function drawLoading(progress, label = "Đang tải tài nguyên...") {
  ctx.fillStyle = "#0d0b14"; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#2e2840"; ctx.fillRect(W / 2 - 80, H / 2, 160, 8);
  ctx.fillStyle = "#ffe26b"; ctx.fillRect(W / 2 - 80, H / 2, 160 * progress, 8);
  ctx.font = "10px monospace"; ctx.textAlign = "center";
  HUD.text(ctx, label, W / 2, H / 2 - 16, "#b8b0d0");
  ctx.textAlign = "left";
}

let game = null;

async function main() {
  const assets = new AssetLoader();
  drawLoading(0);
  await assets.loadAll(IMAGE_MANIFEST, SOUND_MANIFEST, (k) => drawLoading(k * 0.7));

  // Spritesheet hiệu ứng + nhân vật: dùng PNG đã tải; file nào thiếu thì tự nướng lại từ pixelfx
  const sprites = await loadSprites(assets.images, EFFECTS, ACTORS, (k) => drawLoading(0.7 + k * 0.3, "Đang dựng hoạt ảnh..."));
  for (const [name, { sheet, cfg }] of sprites.effects) effects.register(name, sheet, cfg);
  FX_SHEETS = sprites.effects;
  // nướng sẵn các số sát thương hay gặp nhất (số lạ sẽ được nướng dần trong trận, không khựng)
  for (const v of [0.3, 0.5, 0.6, 1, 1.5, 2, 2.2, 2.5, 3, 4, 5]) effects.prepareText(`-${fmtNum(v * PLAYER_CFG.damageMul)}`, true);
  ACTOR_SPRITES = sprites.actors;
  window.SPRITES = sprites;   // xem trong Console (F12): SPRITES.effects.get("hit").sheet
  window.DEBUG = { WEAPONS, makeWeapon, EnemyBullet };   // thử vũ khí trong Console: game.player.pickWeapon(DEBUG.WEAPONS.rocket, game)

  prepareGunSprites(assets.images);   // thu nhỏ ảnh súng Pixel Armory cho vừa nhân vật (src/guns.js)
  game = new Game(assets, new SoundManager(assets.sounds));
  game.actorSprites = ACTOR_SPRITES;
  game.ui = new MenuUI(game);
  // SẢNH CHỜ: căn phòng đi lại được (src/lobby.js)
  game.lobby = new Lobby({
    characters: CHARACTERS, sprites: ACTOR_SPRITES, sound: game.sound,
    onSwitch: (i) => game.ui.onSwitch(i),
    onStation: (id) => game.ui.openPanel(id),
    onFocus: (i) => game.ui.onFocus(i),
  });
  game.lobby.enter(game.charIndex);
  game.cabin = new Cabin();   // KHOANG MÁY BAY (src/cabin.js)
  game.touch = new TouchControls(stage, input, {
    press: (k) => { game.sound.unlock(); input.pressed.add(k); },
    goMenu: () => game.goMenu(),
  });
  window.game = game; // tiện debug trong Console (F12)

  if (AUTOPLAY || EXTRACT_TEST) {
    // #extract... = thử chế độ Rút Quân · #autoplay... (không có "extract") = Chế độ Giải Trí như cũ
    game.setMode(EXTRACT_TEST ? "extract" : "arcade");
    const [, c, m] = location.hash.split("-");
    game.mapIndex = clamp(Number(m) || 0, 0, BIOMES.length - 1);
    const dm = location.hash.match(/diff-(\d)/); if (dm) game.diffIndex = clamp(Number(dm[1]), 0, DIFFICULTY.length - 1);
    game.start(clamp(Number(c) || 0, 0, CHARACTERS.length - 1));
    const wm = location.hash.match(/wave-(\d+)/);
    if (wm) { const n = Math.max(1, Number(wm[1])); game.wave = n; game.bossCount = n - 1; game.time = 60 * (n - 1) + 1; game.bossTimer = 4; }
  } else if (STRESS) game.start(game.charIndex);
  else game.goMenu();
  if (STRESS && game.state === GAME_STATE.PLAYING) { game.spawnHorde(STRESS); game.debug = true; }

  let last = performance.now();
  function frame(now) {
    const real = (now - last) / 1000;
    const dt = Math.min(real, 1 / 30);   // deltaTime (giới hạn để tab bị treo không làm nhân vật "dịch chuyển")
    last = now;
    tickFps(real);
    game.update(dt);
    game.draw();
    input.pressed.clear();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

main();


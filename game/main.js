// =====================================================================================
//  PIXEL ARENA — game 2D (HTML5 Canvas + JavaScript thuần)
//  Phong cách: chém/bắn "đã tay" kiểu Dan the Man + đấu trường sinh tồn kiểu Soul Knight
//
//  Cấu trúc:
//    characters.js          — DỮ LIỆU NHÂN VẬT (thêm/sửa nhân vật ở đó)
//    src/util.js            — toán học, va chạm hình học, màu
//    src/world.js           — BẢN ĐỒ 2400x1600, 4 BIOME, vật cản, thùng nổ, bẫy, CAMERA
//    src/weapons.js         — KHO VŨ KHÍ (4 vũ khí mới), đạn người chơi & đạn quái
//    src/enemies.js         — QUÁI CHIẾN THUẬT + MINI-BOSS
//    src/loot.js            — RƯƠNG BÁU, vật phẩm, ngọc EXP
//    src/perks.js           — THẺ NÂNG CẤP ROGUELIKE
//    src/hud.js             — HUD, minimap, mũi tên chỉ hướng, thanh máu Boss
//    src/actors.js          — hình người pixel (nhân vật / quái hình người)
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
import { fireWeapon, meleeSwing, muzzleLength, drawWeaponFallback, drawWeaponIcon, enemyBulletHitsPlayer, Bullet, EnemyBullet, WEAPONS } from "./src/weapons.js";
import { Enemy, pickEnemyType, MAX_ENEMY_RADIUS, CROWD } from "./src/enemies.js";
import { Chest, Pickup, ExpOrb, rollChest, CHEST_TIERS, ITEMS } from "./src/loot.js";
import { rollPerks, expToNext, PERK_ICONS } from "./src/perks.js";
import { makeActor, LiveFx } from "./src/actors.js";
import * as HUD from "./src/hud.js";
import { TouchControls, isTouchDevice } from "./src/touch.js";
import { EffectManager } from "./src/effects.js";
import { loadSprites, HERO_FRAME } from "./src/animation.js";
import { sweep, sweepLife } from "./src/pool.js";
import { SpatialGrid } from "./src/spatial.js";

// =====================================================================================
// 1. CẤU HÌNH
// =====================================================================================
const W = 480;                 // độ phân giải pixel của khung hình (phóng to cho vừa cửa sổ)
const H = 270;

/** Trạng thái chính của game. (Tạm dừng / chọn thẻ là cờ bên trong PLAYING.) */
const GAME_STATE = Object.freeze({
  MENU: "MENU",           // Màn hình chính + chọn nhân vật + chọn bản đồ
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
  maxEnemies: TOUCH ? 18 : 22,   // tối đa cùng lúc (trước đây 46)
  startInterval: 2.2,   // giây giữa 2 lần sinh quái lúc đầu trận (trước đây 1.5)
  minInterval: 0.9,     // nhanh nhất về sau (trước đây 0.35)
  rampPerSec: 0.012,    // mỗi giây sống sót rút ngắn khoảng cách sinh quái bao nhiêu
  extraAfter: 45, extraChance: 0.15,   // sau 45s, 15% cơ hội sinh 2 con 1 lúc (trước đây 30s, 35%)
  chestEvery: 25,       // giây: rương ngẫu nhiên xuất hiện
  maxChests: 4,
  bossEvery: 60,        // giây: Mini-Boss xuất hiện
  eliteAfter: 30, eliteChance: 0.08,
};

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
  iceShot: "", freeze: "", shyCast: "", thunder: "",   // Thanh Xuân: gai băng, đóng băng, Ngại Ngùng, sét
  bossWarn: "", bossShoot: "", bossCharge: "",
  // --- Kỹ năng ---
  skillRage: "", skillDash: "", skillNova: "", skillDenied: "", roll: "",
  // --- Rương / vật phẩm / cấp độ ---
  chestSpawn: "", chestOpen: "", pickup: "", expPickup: "", levelUp: "", swap: "",
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

/** Bán kính vệt chém lúc xuất ảnh (fx-config.js) — chém to/nhỏ hơn thì phóng ảnh theo tỉ lệ */
const SLASH_BAKED = { slash: 30, slashFist: 28, slashSword: 41 };
const CHEST_FX = { wood: "chestWood", silver: "chestSilver", gold: "chestGold" };

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
  damage: (x, y, amount) => effects.text(`-${fmtNum(amount)}`, x, y),
  dust: (x, y, flip) => effects.play("dust", x, y, { flip }),                 // bụi chân khi chạy
  spawn: (x, y) => effects.play("spawn", x, y),
  nova: (x, y) => effects.play("nova", x, y),
  // >>> NỔ: thùng thuốc nổ (size = độ to) / dơi cảm tử / lựu đạn năng lượng
  explosion: (x, y, size = 0.8) => effects.play(size < 0.6 ? "explosionSmall" : "explosion", x, y),
  plasma: (x, y) => effects.play("plasma", x, y),
  iceShatter: (x, y, aim) => effects.play("iceShatter", x, y, { aim }),
  parry: (x, y) => effects.play("parry", x, y),
  chestOpen: (x, y, tier) => effects.play(CHEST_FX[tier] ?? "chestWood", x, y),
};

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
    if (now - (this.lastPlay[name] ?? 0) < ({ flame: 110, shoot: 45 }[name] ?? 30)) return;
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
window.visualViewport?.addEventListener("resize", fitCanvas);
if (TOUCH) document.body.classList.add("is-touch");
fitCanvas();

// =====================================================================================
// 6. ICON KỸ NĂNG (pixel) — dùng khi chưa chèn ảnh icon
// =====================================================================================
const SKILL_ICON_BITMAPS = {
  rage: ["....#.....", "...##...#.", "..###..##.", "..####.##.", ".#####o##.", ".##o##oo#.", "##oo#ooo##", "#oo*oo*oo#", ".#o****o#.", "..######.."],
  dash: ["#....#....", "##...##...", "o##..o##..", ".o##..o##.", "..*##..*##", "..*##..*##", ".o##..o##.", "o##..o##..", "##...##...", "#....#...."],
  nova: ["....**....", ".#..oo..#.", "..#.oo.#..", "...oooo...", "*oooo*ooo*", "*ooo*oooo*", "...oooo...", "..#.oo.#..", ".#..oo..#.", "....**...."],
  shy: ["..######..", ".#oooooo#.", "#oooooooo#", "#o*#oo#*o#", "#oooooooo#", "#pp.oo.pp#", "#pp.oo.pp#", "#ooo##ooo#", ".#oooooo#.", "..######.."],   // mặt đỏ ửng
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
   * NGẠI NGÙNG (Thanh Xuân): ôm mặt ngại `duration` giây (bất tử, đứng yên). Trong lúc đó:
   *   0.25s — sóng băng đóng băng mọi quái trên màn hình, xóa đạn của quái
   *   0.5s..hết — sét đánh xuống từng con (gần trước, xa sau): quái thường chết ngay, Mini-Boss mất `bossDamage` máu
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
  /** BÃO CẦU NĂNG LƯỢNG: bắn `count` viên tỏa đều 360 độ */
  nova(p, game, s) {
    const n = s.count ?? 12;
    p.castTime = ANIM_CFG.castTime;
    for (let i = 0; i < n; i++) {
      const a = p.aim + (i / n) * TAU;
      game.bullets.push(Bullet.obtain(p.cx + Math.cos(a) * 6, p.cy + Math.sin(a) * 6, a, {
        speed: s.bulletSpeed, damage: s.damage * p.mods.damageMul, radius: 4, color: s.color, style: "orb", bounces: p.mods.bounce,
      }));
    }
    FX.nova(p.x, p.y);
    game.sound.play("skillNova", 0.6);
    game.shake(0.2, 3);
  },
};

// =====================================================================================
// 8. NGƯỜI CHƠI
// =====================================================================================
class Player {
  constructor(char, spawn) {
    this.char = char;
    this.skill = char.skill;
    this.actor = null;                    // dáng đứng (cho hào quang Cuồng Nộ ôm theo thân) — tạo khi cần
    this.x = spawn.x; this.y = spawn.y;   // CHÂN nhân vật (tọa độ thế giới)
    this.radius = PLAYER_CFG.radius;
    this.vx = 0; this.vy = 0;             // vận tốc (Tàn Tích Băng Giá có quán tính)

    this.maxHp = char.stats.hp;       this.hp = this.maxHp;
    this.maxArmor = char.stats.armor; this.armor = this.maxArmor;
    this.baseSpeed = char.stats.speed;
    this.regen = { ...ARMOR_REGEN, ...(char.armorRegen ?? {}) };
    this.sinceHit = 99; this.regenTick = 0; this.armorFlash = 0;

    // --- 2 ô vũ khí ---
    this.weapons = [char.weapon, null];
    this.slot = 0;

    // --- Thẻ nâng cấp ---
    this.mods = { split: 0, bounce: 0, absorb: 0, damageMul: PLAYER_CFG.damageMul, knockMul: 1, cdMul: 1, speedMul: 1 };
    this.perksTaken = {};
    this.absorbCount = 0;
    this.pickupRange = PLAYER_CFG.pickupRange;

    this.aim = 0; this.fireTimer = 0; this.hurtTimer = 0; this.walkTime = 0;
    this.kx = 0; this.ky = 0;

    // --- HOẠT ẢNH: spritesheet Idle / Run / Skill + bộ điều khiển theo deltaTime ---
    this.sprite = ACTOR_SPRITES.get(char.id) ?? null;
    this.skin = 0;                        // 0 = skin gốc, 1.. = skin trong characters.js -> skins
    this.anim = this.sprite?.controller() ?? null;
    this.moveSpeed = 0;                   // tốc độ thực tế (px/giây) đo từ vị trí -> chọn Idle / Run
    this.moveDir = 1;                     // hướng chạy ngang (bụi bay ngược lại)
    this.castTime = 0;                    // đang giữ dáng tung kỹ năng
    this.shy = null;                      // đang Ngại Ngùng (tuyệt chiêu Thanh Xuân)
    // --- VŨ KHÍ TRÊN TAY ---
    this.handX = this.x; this.handY = this.y - 19;   // vị trí bàn tay (tọa độ thế giới), cập nhật mỗi frame
    this.recoil = 0;                      // px giật lùi theo nòng (âm = đâm tới trước)
    this.recoilRot = 0;                   // rad nòng hếch lên khi bắn
    this.swing = null;                    // { t, dur, from, to } khi vung vũ khí cận chiến
    this.swingDir = 1;                    // đổi chiều mỗi nhát -> combo qua lại

    // --- Kỹ năng riêng ---
    this.skillCd = 0; this.rageTime = 0; this.aura = null; this.dash = null;
    // --- Lướt nhanh (Shift) ---
    this.roll = null; this.rollCd = 0; this.rollCdMax = ROLL.cooldown; this.rollInv = 0;
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
  get invulnerable() { return this.hurtTimer > 0 || !!this.dash || this.rollInv > 0 || !!this.shy; }
  get skillActive() { return this.rageTime > 0 || !!this.dash || !!this.shy; }
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
  get speed() { return this.baseSpeed * this.mods.speedMul * (this.frenzy > 0 ? 1.3 : 1) * (this.inAcid ? 1 - ENV.acid.slow : 1); }
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
    this.updateArmor(dt);
    if (this.rageTime > 0) { this.rageTime -= dt; if (this.rageTime <= 0) { this.rageTime = 0; this.aura?.stop(); } }

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
      const k = 1 - Math.exp(-world.biome.accel * dt);
      this.vx += (dx * this.speed - this.vx) * k;
      this.vy += (dy * this.speed - this.vy) * k;
      world.moveBody(this, (this.vx + this.kx) * dt, (this.vy + this.ky) * dt, PLAYER_CFG.footR);
      this.walkTime = len ? this.walkTime + dt : 0;
    }
    this.kx *= Math.pow(0.001, dt); this.ky *= Math.pow(0.001, dt);

    // --- Súng máy: giữ cò thì nòng quay nhanh dần, thả ra thì chậm lại ---
    const firing = input.mouse.left && !this.dash && !this.roll && !this.shy;
    if (this.weapon.spinUp) this.spin = clamp(this.spin + (firing ? dt / this.weapon.spinUp : -dt * 1.5), 0, 1);
    else this.spin = 0;

    // --- Tấn công & kỹ năng ---
    if (input.mouse.left && this.fireTimer <= 0 && !this.dash && !this.roll && !this.shy) this.attack(game);
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
    const dmg = e.boss ? e.maxHp * (sk.bossDamage ?? 0.3) : e.hp;   // quái thường: đúng bằng máu còn lại -> chết ngay
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
  startSwing(w) {
    this.swingDir = -this.swingDir;
    const big = w.type === "sword";
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
    game.sound.play("swap", 0.5);
  }

  /** Nhặt vũ khí: còn trống ô 2 thì trang bị vào đó; đã đủ 2 thì thay vũ khí đang cầm và thả vũ khí cũ xuống đất */
  pickWeapon(def, game) {
    if (!this.weapons[1]) { this.weapons[1] = def; this.slot = 1; }
    else {
      const old = this.weapons[this.slot];
      this.weapons[this.slot] = def;
      game.pickups.push(new Pickup(this.x, this.y + 2, "weapon", old, { vx: 0, vy: 0, blockedUntilLeave: true }));
    }
    this.fireTimer = 0.15;
  }

  attack(game) {
    const w = this.weapon;
    let rateMul = 1;
    if (this.rageTime > 0) rateMul *= this.skill.fireRateMult ?? 0.5;  // kỹ năng Cuồng Nộ
    if (this.frenzy > 0) rateMul /= 1.4;                               // Thuốc Cuồng Nộ +40% tốc bắn
    if (w.spinUp) rateMul *= 4 - 3 * this.spin;                        // Gatling: chậm gấp 4 lúc mới quay
    this.fireTimer = w.fireRate * rateMul;
    if (w.type === "melee" || w.type === "sword") meleeSwing(this, game, w);
    else {
      fireWeapon(this, game, w);
      // weapons.js đặt p.recoil (px giật lùi) -> thêm nòng hếch lên tỉ lệ theo lực giật
      if (this.recoil > 0) this.recoilRot = Math.min(0.35, this.recoilRot + this.recoil * WEAPON_CFG.climb);
    }
  }

  // ---------- Kỹ năng ----------
  useSkill(game) {
    if (this.skillCd > 0 || this.dash) { game.sound.play("skillDenied", 0.4); return; }
    const handler = SKILL_HANDLERS[this.skill.type];
    if (!handler) { console.warn(`[Skill] Chưa có kỹ năng loại "${this.skill.type}" trong SKILL_HANDLERS`); return; }
    handler(this, game, this.skill);
    this.skillCd = this.skill.cooldown * this.mods.cdMul;   // thẻ "Bậc Thầy Kỹ Năng"
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
    if (r.trail <= 0) { r.trail = 0.03; this.pushGhost(this.facingLeft, 0.3, "#a8dcff"); }
    if (r.t >= ROLL.time) {
      // giữ lại chút quán tính (rõ nhất trên băng)
      this.vx = r.vx * 0.25; this.vy = r.vy * 0.25;
      this.roll = null;
    }
  }

  hurt(game, fromX, fromY, dmg = 1) {
    if (this.invulnerable || this.hp <= 0) return;
    this.sinceHit = 0;
    this.hurtTimer = PLAYER_CFG.invuln;
    const a = Math.atan2(this.cy - fromY, this.cx - fromX);
    this.kx = Math.cos(a) * 260; this.ky = Math.sin(a) * 260;
    const absorbed = Math.min(this.armor, dmg);
    this.armor -= absorbed;
    const toHp = dmg - absorbed;
    this.hp = Math.max(0, this.hp - toHp);
    if (toHp > 0) { navigator.vibrate?.(70); game.shake(0.28, 5); game.hitStop(0.08); game.sound.play("playerHurt", 0.6); game.hurtFlash = 0.25; }
    else { this.armorFlash = 0.3; game.shake(0.16, 3); game.hitStop(0.04); game.sound.play("armorHit", 0.5); }
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
    const img = this.weapon === this.char.weapon ? game.assets.images[`${this.char.id}.weapon`] : null;
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
    this.charIndex = 0;
    this.mapIndex = clamp(Number(loadPref("pixelArena.map", "0")) || 0, 0, BIOMES.length - 1);
    this.ui = null;
    this.player = null;
    this.camera = new Camera(W, H);
    this.time = 0;
    // Lưới không gian cho va chạm (tạo 1 lần) + các mảng kết quả dùng lại (không tạo mảng mới mỗi frame)
    this.grid = new SpatialGrid(WORLD.w, WORLD.h, GRID_CELL);
    this.qNear = []; this.qBullet = []; this.qExplode = []; this.qSep = []; this.qContact = [];
    this.drawList = [];
    this.bullets = []; this.enemyBullets = []; this.enemies = []; this.orbs = [];
  }

  // ---------------- Chuyển trạng thái ----------------
  start(charIndex = this.charIndex) {
    this.charIndex = charIndex;
    this.reset(CHARACTERS[charIndex], BIOMES[this.mapIndex]);
    this.state = GAME_STATE.PLAYING;
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

  goMenu() {
    this.state = GAME_STATE.MENU;
    this.paused = false;
    this.choosing = false;
    effects.clear();
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
    this.sound.play("gameOver", 0.7);
    this.sound.setMusic("");
    FX.death(this.player.cx, this.player.cy);
    this.player.aura?.stop();
    input.mouse.left = false;
  }

  reset(char, biome) {
    effects.clear();
    // trả đạn / quái / ngọc của trận trước về Object Pool
    for (const b of this.bullets) Bullet.pool.release(b);
    for (const b of this.enemyBullets) EnemyBullet.pool.release(b);
    for (const e of this.enemies) Enemy.pool.release(e);
    for (const o of this.orbs) ExpOrb.pool.release(o);
    this.world = new World(biome, this.assets.images);
    this.minimap = this.world.renderMinimap(HUD.MINIMAP.w, HUD.MINIMAP.h);
    this.player = new Player(char, this.world.spawn);
    this.camera = new Camera(W, H);
    this.camera.snap(this.player.x, this.player.cy);
    this.bullets = []; this.enemyBullets = []; this.enemies = [];
    this.chests = []; this.pickups = []; this.orbs = [];
    this.beams = []; this.waves = []; this.shocks = []; this.flashes = []; this.banners = []; this.bolts = [];
    this.iceLines = [];
    this.weaponsUsed = new Set([char.weapon.name]);
    this.score = 0; this.kills = 0; this.time = 0;
    this.level = 1; this.exp = 0; this.expNeed = expToNext(1); this.pendingLevels = 0;
    this.choosing = false; this.perkChoices = [];
    this.spawnTimer = 1;
    this.chestTimer = SPAWN.chestEvery;
    this.bossTimer = SPAWN.bossEvery;
    this.bossCount = 0;
    this.freeze = 0;
    this.hurtFlash = 0;
    this.flashFx = null;
  }

  shake(time, amp) { this.camera.shake(time, amp); }
  /** Chớp màn hình 1 màu (giảm dần trong `time` giây) */
  screenFlash(color, time) {
    const v = parseInt(color.slice(1), 16);
    if (!this.flashFx || time >= this.flashFx.t) this.flashFx = { r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255, t: time, max: time };
  }
  hitStop(t) { this.freeze = Math.max(this.freeze, t); }
  get boss() { for (const e of this.enemies) if (e.boss && !e.dead) return e; return null; }

  /**
   * Quái có thể nằm trong bán kính r quanh (x, y) — lấy từ lưới không gian (chỉ vài ô xung quanh).
   * Người gọi vẫn phải tự lọc bằng khoảng cách bình phương. Mảng trả về được dùng lại ở lần gọi sau.
   */
  enemiesNear(x, y, r) { return this.grid.query(x, y, r + MAX_ENEMY_RADIUS, this.qNear); }

  banner(text, color = "#ffe26b", big = false, life = 2.2) {
    this.banners.push({ text, color, big, life });
    if (this.banners.length > 4) this.banners.shift();
  }
  flashMuzzle(x, y, color, size) { this.flashes.push({ x, y, color, size, life: 0.06 }); }
  noteWeaponUsed(w) { this.weaponsUsed.add(w.name); }

  // ---------- Sinh quái ngoài khung hình ----------
  spawnEnemy() {
    const p = this.player;
    const pt = this.world.randomFreePoint({ near: { x: p.x, y: p.y }, minD: 270, maxD: 460, outsideView: this.camera, margin: 12 });
    if (!pt) return;
    const type = pickEnemyType(this.time);
    const elite = this.time > SPAWN.eliteAfter && type !== "bat" && Math.random() < SPAWN.eliteChance;
    const e = Enemy.obtain(type, pt.x, pt.y, { elite }, ACTOR_SPRITES);
    this.enemies.push(e);
    FX.spawn(e.cx, e.cy + 8);
  }

  // ---------- ĐƯỜNG GAI BĂNG (đòn đánh thường Thanh Xuân) ----------
  /**
   * Băng lan dọc mặt đất từ chân nhân vật theo hướng ngắm, dài w.range px với tốc độ w.speed.
   * Cứ mỗi ICE_STEP px mọc 1 cụm gai (spritesheet "iceSpikes"); mọi quái trên đường bị trúng 1 lần + đóng băng.
   * Gặp tường / cột đá thì dừng.
   */
  castIceLine(p, w, dmg, knock, ang) {
    const c = Math.cos(ang), s = Math.sin(ang);
    this.iceLines.push({ x0: p.x + c * 10, y0: p.y + s * 6, c, s, ang, d: 0, next: 0, range: w.range ?? 200, speed: w.speed ?? 600,
      width: w.width ?? 20, dmg, knock, freeze: w.freeze ?? 3, hit: new Set(), dead: false });
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
        const flip = L.c < 0, half = 30;   // cụm gai dài ~64px nằm ngang: dời để tâm cụm trùng điểm trên đường
        effects.play("iceSpikes", x - (flip ? -half : half) + (flip ? 4 : -4), y, { flip, time: 0.12 });
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
      this.enemies.push(Enemy.obtain(pickEnemyType(60 + Math.random() * 30), pt.x, pt.y, {}, ACTOR_SPRITES));
    }
  }

  spawnBoss() {
    const p = this.player;
    const pt = this.world.randomFreePoint({ near: { x: p.x, y: p.y }, minD: 200, maxD: 320, margin: 26 })
      ?? this.world.randomFreePoint({ margin: 26 });
    if (!pt) return;
    this.bossCount++;
    const e = Enemy.obtain("boss", pt.x, pt.y, { hpMul: 1 + (this.bossCount - 1) * 0.5 }, ACTOR_SPRITES);
    this.enemies.push(e);
    FX.spawn(e.cx, e.cy + 20);
    this.banner("MINI-BOSS XUẤT HIỆN!", "#e0a8ff", true, 3);
    this.sound.play("bossWarn", 0.7);
    this.shake(0.5, 4);
  }

  // ---------- Rương báu ----------
  spawnChest(tier, x, y) {
    let pt = x !== undefined ? { x, y } : null;
    if (!pt) {
      const p = this.player;
      pt = this.world.randomFreePoint({ near: { x: p.x, y: p.y }, minD: 180, maxD: 650, margin: 14 });
    } else if (!this.world.isFree(pt.x, pt.y, 10)) {
      pt = this.world.randomFreePoint({ near: pt, minD: 0, maxD: 60, margin: 12 }) ?? pt;
    }
    if (!pt) return;
    this.chests.push(new Chest(pt.x, pt.y, tier));
    this.sound.play("chestSpawn", 0.5);
    this.banner(`${CHEST_TIERS[tier].name} xuất hiện!`, CHEST_TIERS[tier].glow);
  }

  openChest(c) {
    c.opened = true; c.dead = true;
    FX.chestOpen(c.x, c.y, c.tier);
    this.sound.play("chestOpen", 0.6);
    const r = rollChest(c.tier);
    this.pickups.push(new Pickup(c.x, c.y + 6, r.kind, r.weapon ?? null, { vx: rand(-30, 30), vy: 50 }));
  }

  collectPickup(pk) {
    const p = this.player;
    pk.dead = true;
    switch (pk.kind) {
      case "potionHp": p.hp = Math.min(p.maxHp, p.hp + 2); break;
      case "potionArmor": p.armor = Math.min(p.maxArmor, p.armor + 3); p.armorFlash = 0.4; break;
      case "magnet": for (const o of this.orbs) o.magnet = true; break;
      case "rage": p.frenzy = 8; break;
      case "maxUp": p.maxHp++; p.hp++; p.maxArmor++; p.armor++; break;
      case "weapon": p.pickWeapon(pk.weapon, this); break;
    }
    this.banner(pk.kind === "weapon" ? `Nhặt: ${pk.weapon.name}` : pk.label, pk.kind === "weapon" ? pk.weapon.color : ITEMS[pk.kind].color);
    this.sound.play("pickup", 0.6);
  }

  // ---------- Sát thương ----------
  /** opts: { pierce: tia xuyên thấu, explosive: vụ nổ } — 2 loại này xuyên khiên Hiệp Sĩ */
  damageEnemy(e, dmg, angle, knock, opts = {}) {
    if (e.dead) return;
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
      this.hitStop(0.03);
    }
    if (!opts.quiet || Math.random() < 0.3) FX.damage(e.cx, e.cy - 10, dmg);
    if (e.hp <= 0) this.killEnemy(e);
  }

  killEnemy(e, opts = {}) {
    if (e.dead) return;
    e.dead = true;
    if (e.freezeT > 0) effects.play("iceShatter", e.cx, e.y, { aim: 0, scale: 0.5 * Math.min(1.6, e.cfg.scale ?? 1) });   // tượng băng vỡ vụn
    else FX.death(e.cx, e.cy, Math.min(1.6, e.cfg.scale ?? 1));
    this.sound.play("enemyDie", 0.5);
    this.shake(0.12, 2);
    this.hitStop(0.05);
    if (opts.noReward) return;
    this.kills++;
    this.score += e.cfg.score * (e.elite ? 3 : 1);
    // rơi ngọc EXP
    let exp = e.cfg.exp * (e.elite ? 3 : 1);
    while (exp > 0) { const v = exp >= 5 ? 5 : 1; exp -= v; this.orbs.push(ExpOrb.obtain(e.x, e.y - 6, v)); }
    // thẻ Hấp Thụ Năng Lượng: +1 giáp mỗi 6 quái
    const p = this.player;
    if (p.mods.absorb > 0 && ++p.absorbCount >= 6) {
      p.absorbCount = 0;
      p.armor = Math.min(p.maxArmor, p.armor + p.mods.absorb);
      p.armorFlash = 0.4;
    }
    // Slime khổng lồ tách đôi
    if (e.cfg.split) {
      for (const s of [-1, 1]) {
        const c = Enemy.obtain(e.cfg.split, e.x + s * 8, e.y, {}, ACTOR_SPRITES);
        c.kx = s * 160; c.spawnTime = 0.2;
        this.enemies.push(c);
      }
    }
    if (e.elite) this.spawnChest("silver", e.x, e.y);
    if (e.boss) {
      this.spawnChest("gold", e.x, e.y);
      this.banner("ĐÃ HẠ MINI-BOSS!", "#ffe26b", true, 3);
      this.shake(0.5, 6);
    }
  }

  /** Vụ nổ diện rộng: { radius, damage, knock, source: "grenade" | "barrel" | "bat", hurtPlayer, playerRadius } */
  explode(x, y, o) {
    if (o.source === "grenade") FX.plasma(x, y); else FX.explosion(x, y + 8, o.source === "bat" ? 0.45 : 0.8);
    this.shocks.push({ x, y, r: o.radius, life: 0.35, max: 0.35, color: o.source === "grenade" ? "#7cffb0" : "#ffb03a" });
    this.shake(o.source === "bat" ? 0.2 : 0.4, o.source === "bat" ? 3 : 7);
    this.hitStop(0.05);
    this.sound.play("explosion", 0.7);
    // chỉ xét quái trong các ô lưới quanh tâm nổ, so khoảng cách BÌNH PHƯƠNG
    const R2 = (r) => r * r;
    for (const e of this.grid.query(x, y, o.radius + MAX_ENEMY_RADIUS, this.qExplode)) {
      if (e.dead) continue;
      if ((e.cx - x) ** 2 + (e.cy - y) ** 2 <= R2(o.radius + e.radius)) this.damageEnemy(e, o.damage, Math.atan2(e.cy - y, e.cx - x), o.knock ?? 260, { explosive: true });
    }
    for (const b of this.world.barrels) if (!b.dead && (b.x - x) ** 2 + (b.y - 6 - y) ** 2 <= R2(o.radius)) this.igniteBarrel(b);
    for (const c of this.world.crystals) if (!c.dead && (c.x - x) ** 2 + (c.y - 8 - y) ** 2 <= R2(o.radius)) this.hitCrystal(c, 99, Math.atan2(c.y - y, c.x - x));
    const p = this.player;
    if (o.hurtPlayer && (p.cx - x) ** 2 + (p.cy - y) ** 2 <= R2(o.playerRadius ?? o.radius)) p.hurt(this, x, y, 1);
  }

  igniteBarrel(b) { if (!b.dead && b.fuse < 0) { b.fuse = ENV.barrel.fuse; b.flash = 0.1; } }

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
    this.explode(e.cx, e.cy, { radius: e.cfg.blast, damage: 2, knock: 200, source: "bat", hurtPlayer: true, playerRadius: e.cfg.blast });
    this.killEnemy(e, { noReward: true });
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
    }
    if (this.pendingLevels > 0 && !this.choosing) this.openLevelUp();
  }

  openLevelUp() {
    this.choosing = true;
    this.perkChoices = rollPerks(3);
    input.mouse.left = false;
    this.sound.play("levelUp", 0.7);
    this.ui.showLevelUp(this.level - this.pendingLevels + 1, this.perkChoices, this.player.perksTaken);
  }

  choosePerk(i) {
    const perk = this.perkChoices[i];
    if (!this.choosing || !perk) return;
    perk.apply(this.player);
    this.player.perksTaken[perk.id] = (this.player.perksTaken[perk.id] ?? 0) + 1;
    this.pendingLevels--;
    this.sound.play("pickup", 0.6);
    this.banner(`+ ${perk.name}`, perk.color);
    if (this.pendingLevels > 0) { this.perkChoices = rollPerks(3); this.ui.showLevelUp(this.level - this.pendingLevels + 1, this.perkChoices, this.player.perksTaken); }
    else { this.choosing = false; this.ui.hideLevelUp(); input.mouse.left = false; }
  }

  // ---------- UPDATE ----------
  update(dt) {
    this.touch?.sync(this, TOUCH && this.state === GAME_STATE.PLAYING);
    if (input.pressed.has("m")) this.ui.toggleMute();
    if (input.pressed.has("h")) this.debug = !this.debug;
    switch (this.state) {
      case GAME_STATE.MENU: return this.ui.updateMenu(dt);
      case GAME_STATE.GAME_OVER: return this.updateGameOver(dt);
      case GAME_STATE.PLAYING: return this.updatePlaying(dt);
    }
  }

  updateGameOver(dt) {
    this.camera.updateShake(dt);
    this.updateFx(dt);
    if (!this.overShown) {
      this.overTimer -= dt;
      if (this.overTimer <= 0) { this.overShown = true; this.ui.showGameOver(); }
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
      return;
    }
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

    // --- Sinh quái: nhanh dần theo thời gian ---
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && this.enemies.length < SPAWN.maxEnemies) {
      this.spawnEnemy();
      if (this.time > SPAWN.extraAfter && Math.random() < SPAWN.extraChance) this.spawnEnemy();
      this.spawnTimer = Math.max(SPAWN.minInterval, SPAWN.startInterval - this.time * SPAWN.rampPerSec);
    }
    // --- Rương mỗi 25 giây ---
    this.chestTimer -= dt;
    if (this.chestTimer <= 0) {
      this.chestTimer = SPAWN.chestEvery;
      if (this.chests.filter((c) => !c.opened).length < SPAWN.maxChests) this.spawnChest(Math.random() < 0.7 ? "wood" : "silver");
    }
    // --- Mini-Boss mỗi 60 giây ---
    this.bossTimer -= dt;
    if (this.bossTimer <= 0) {
      if (!this.boss) { this.spawnBoss(); this.bossTimer = SPAWN.bossEvery; }
      else this.bossTimer = 5;
    }

    for (const e of this.enemies) e.update(dt, this);
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
          const keepFlying = b.onHitEnemy(e, this);   // đốt / làm chậm / xuyên
          this.damageEnemy(e, b.damage, Math.atan2(b.vy, b.vx), b.knock, { quiet: b.style === "flame", ice: b.style === "iceSpike" });
          if (!keepFlying) { b.finish(this); break; }
        }
      }
    }
    // --- Va chạm: đạn quái -> người chơi ---
    for (const b of this.enemyBullets) {
      if (!b.dead && enemyBulletHitsPlayer(b, p)) {
        if (!p.invulnerable) { b.dead = true; p.hurt(this, b.x - b.vx, b.y - b.vy, b.damage); }
      }
    }
    // --- Va chạm: thân quái -> người chơi ---
    for (const e of this.grid.query(p.cx, p.cy, p.radius + MAX_ENEMY_RADIUS, this.qContact)) {
      if (!e.dead && e.canHurt && circleHit(p.cx, p.cy, p.radius, e.cx, e.cy, e.radius)) p.hurt(this, e.cx, e.cy, e.contactDamage);
    }

    this.updateHazards(dt);
    this.updateIceLines(dt);

    // --- Rương, vật phẩm, ngọc EXP ---
    for (const c of this.chests) { c.update(dt); if (!c.opened && circleHit(p.x, p.y - 6, p.radius, c.x, c.y - 6, c.radius)) this.openChest(c); }
    for (const pk of this.pickups) {
      pk.update(dt, this);
      const touching = circleHit(p.x, p.y - 4, p.radius + 2, pk.x, pk.y - 4, pk.radius);
      if (pk.blockedUntilLeave) { if (!touching) pk.blockedUntilLeave = false; }
      else if (touching && pk.age > 0.35) this.collectPickup(pk);
    }
    for (const o of this.orbs) o.update(dt, this);

    // --- Hiệu ứng ngắn ---
    for (const list of [this.beams, this.waves, this.shocks, this.flashes, this.banners, this.bolts]) for (const b of list) b.life -= dt;

    // --- Dọn mảng TẠI CHỖ + trả đối tượng chết về Object Pool (không .filter() tạo mảng mới mỗi frame) ---
    sweep(this.bullets, Bullet.pool);
    sweep(this.enemyBullets, EnemyBullet.pool);
    sweep(this.enemies, Enemy.pool);
    sweep(this.orbs, ExpOrb.pool);
    sweep(this.chests);
    sweep(this.pickups);
    for (const list of [this.beams, this.bolts, this.waves, this.shocks, this.flashes, this.banners]) sweepLife(list);
    this.updateFx(dt);

    // --- Camera bám theo, nhìn hơi lệch theo hướng chuột ---
    const m = aimPoint(p);
    this.camera.follow(p.x, p.cy, dt, clamp((m.x - p.x) * 0.18, -40, 40), clamp((m.y - p.cy) * 0.18, -26, 26));

    if (p.hp <= 0) this.gameOver();
  }

  /** Thùng nổ hẹn giờ, bẫy lửa */
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
          if (!e.dead && !e.cfg.flying && (e.x - t.x) ** 2 + (e.y - t.y) ** 2 < rr * rr) this.damageEnemy(e, 1.5, -Math.PI / 2, 60);
        }
      }
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
      if (a.dead || a.air) continue;
      const near = this.grid.query(a.cx, a.cy, a.radius + MAX_ENEMY_RADIUS + gap, this.qSep);
      for (let j = 0; j < near.length; j++) {
        const b = near[j];
        if (b.gridId <= a.gridId || b.dead || b.air) continue;   // mỗi cặp xét 1 lần
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

  // ---------- DRAW ----------
  draw() {
    if (this.state === GAME_STATE.MENU || !this.player) return;
    const alive = this.state === GAME_STATE.PLAYING;
    const cam = this.camera, cx = cam.rx, cy = cam.ry;

    // Nền tĩnh (cắt theo camera)
    ctx.fillStyle = "#0d0b14"; ctx.fillRect(0, 0, W, H);
    this.world.drawFloor(ctx, cam, W, H);

    // ---- Mọi thứ dưới đây vẽ theo TỌA ĐỘ THẾ GIỚI ----
    ctx.save();
    ctx.translate(-cx, -cy);
    this.world.drawDynamic(ctx, cam);
    for (const o of this.orbs) if (cam.inView(o.x, o.y, 8)) o.draw(ctx);
    for (const c of this.chests) if (cam.inView(c.x, c.y, 150)) c.draw(ctx, this.time);
    for (const pk of this.pickups) if (cam.inView(pk.x, pk.y, 20)) pk.draw(ctx, this.time);
    for (const e of this.enemies) if (cam.inView(e.x, e.y, 30)) e.drawShadow(ctx);
    effects.draw(ctx, cam, 0);                     // bụi chân: dưới nhân vật

    // Người + quái: sắp theo trục Y (ai đứng thấp hơn vẽ sau, che người phía trên). Mảng dùng lại mỗi frame.
    const actors = this.drawList;
    actors.length = 0;
    for (const e of this.enemies) if (!e.dead && cam.inView(e.x, e.y, 120)) actors.push(e);
    if (alive) actors.push(this.player);
    actors.sort(byFeetY);
    for (const a of actors) a.draw(ctx, this);     // spritesheet theo frame hoạt ảnh (+ vũ khí của người chơi)
    for (const a of actors) if (a !== this.player) a.drawOverlay(ctx, this);

    for (const b of this.bullets) if (cam.inView(b.x, b.y, 16)) b.draw(ctx, this);
    for (const b of this.enemyBullets) if (cam.inView(b.x, b.y, 16)) b.draw(ctx);
    this.drawBeams();
    HUD.drawShockwaves(ctx, this.shocks);
    effects.draw(ctx, cam, 1);                     // tia lửa, vệt chém, trúng đòn, nổ... (spritesheet)
    const P = this.player;                         // con mèo trên đầu lúc Ngại Ngùng: vẽ đè lên hiệu ứng cho dễ thấy
    if (alive && P.shy) drawCat(ctx, P.x + (P.facingLeft ? -1 : 1), P.y - 33, P.facingLeft, P.shy.t);
    for (const f of this.flashes) {    // chớp sáng đầu nòng
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.fillRect(Math.round(f.x - f.size / 2), Math.round(f.y - f.size / 2), f.size, f.size);
      ctx.fillStyle = withAlpha(f.color.startsWith("#") ? f.color : "#ffe26b", 0.5);
      ctx.fillRect(Math.round(f.x - f.size), Math.round(f.y - f.size), f.size * 2, f.size * 2);
    }
    this.drawPickupLabels();
    if (this.debug) this.drawDebug();
    ctx.restore();

    // ---- HUD (tọa độ màn hình) ----
    if (this.hurtFlash > 0) { ctx.fillStyle = `rgba(200,20,40,${this.hurtFlash * 0.6})`; ctx.fillRect(0, 0, W, H); }
    const F = this.flashFx;
    if (F) { ctx.fillStyle = `rgba(${F.r},${F.g},${F.b},${(F.t / F.max) * 0.45})`; ctx.fillRect(0, 0, W, H); }
    if (this.player.inAcid) { ctx.fillStyle = "rgba(60,200,40,0.10)"; ctx.fillRect(0, 0, W, H); }
    this.drawHUD();
    if (alive && !this.paused && !this.choosing) { if (TOUCH) this.drawAimGuide(); else this.drawCrosshair(); }
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

  /** Tên vũ khí trên đất khi người chơi lại gần */
  drawPickupLabels() {
    const p = this.player;
    ctx.font = "7px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "top";
    for (const pk of this.pickups) {
      if ((pk.x - p.x) ** 2 + (pk.y - p.y) ** 2 > 50 * 50) continue;
      HUD.text(ctx, pk.label, Math.round(pk.x), Math.round(pk.y - 22), pk.kind === "weapon" ? pk.weapon.color : ITEMS[pk.kind].color);
    }
    ctx.textAlign = "left"; ctx.font = "8px monospace";
  }

  drawDebug() {
    ctx.strokeStyle = "#0f0"; ctx.lineWidth = 1;
    const circle = (x, y, r) => { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke(); };
    circle(this.player.cx, this.player.cy, this.player.radius);
    ctx.strokeStyle = "#f44"; for (const e of this.enemies) circle(e.cx, e.cy, e.radius);
    ctx.strokeStyle = "#ff0"; for (const b of this.bullets) circle(b.x, b.y, b.radius);
    ctx.strokeStyle = "#0ff"; for (const s of this.world.solids) ctx.strokeRect(s.x + 0.5, s.y + 0.5, s.w, s.h);
  }

  // ---------- HUD ----------
  drawHUD() {
    const p = this.player;
    ctx.font = "8px monospace";
    ctx.textBaseline = "top";

    HUD.drawExpBar(ctx, W, this.exp, this.expNeed, this.level);

    // Khung Máu / Giáp / Kỹ năng (góc trên trái)
    const X = 4, Y = 6;
    HUD.panel(ctx, X, Y, 126, 30);
    HUD.drawHeart(ctx, X + 4, Y + 5, true);
    HUD.drawBar(ctx, X + 14, Y + 4, 80, 9, p.hp / p.maxHp, "#e8343f", "#ff8a92", `${p.hp}/${p.maxHp}`);
    HUD.drawShield(ctx, X + 4, Y + 16);
    HUD.drawBar(ctx, X + 14, Y + 16, 80, 9, p.maxArmor ? p.armor / p.maxArmor : 0, p.armorFlash > 0 ? "#e6f0ff" : "#7fa2d8", "#c4d6f4", `${p.armor}/${p.maxArmor}`);
    if (p.armor < p.maxArmor && p.sinceHit < p.regen.delay) {
      ctx.fillStyle = "#3d4a66"; ctx.fillRect(X + 14, Y + 26, 80, 1);
      ctx.fillStyle = "#9fb8e0"; ctx.fillRect(X + 14, Y + 26, Math.round(80 * (p.sinceHit / p.regen.delay)), 1);
    }
    this.drawSkillSlot(X + 99, Y + 3, p);

    // 2 ô vũ khí + Lướt
    HUD.drawWeaponSlots(ctx, X, Y + 32, p, this.time);
    HUD.drawDashPip(ctx, X + 1, Y + 61, p, TOUCH ? "LƯỚT" : "SHIFT LƯỚT");
    let fy = Y + 70;
    ctx.font = "7px monospace";
    if (p.frenzy > 0) { HUD.text(ctx, `CUỒNG NỘ ${p.frenzy.toFixed(1)}s`, X + 1, fy, "#ff8a2a"); fy += 9; }
    if (p.inAcid) { HUD.text(ctx, "AXIT! -1 GIÁP / 1.5s", X + 1, fy, "#8aff5a"); fy += 9; }
    ctx.font = "8px monospace";

    // Góc trên phải: bộ đếm FPS, rồi Điểm, thời gian, cấp độ
    drawFps(ctx);
    ctx.textAlign = "right";
    HUD.text(ctx, `ĐIỂM ${this.score}`, W - 6, 16, "#ffe26b");
    HUD.text(ctx, `${this.time.toFixed(1)}s · hạ ${this.kills}`, W - 6, 27, "#b8b0d0");
    HUD.text(ctx, `CẤP ${this.level}  ${this.exp}/${this.expNeed}`, W - 6, 38, "#7cc0ff");
    const nb = Math.ceil(this.bossTimer);
    if (!this.boss) HUD.text(ctx, `Boss sau ${nb}s`, W - 6, 49, nb <= 5 ? "#ff7ad8" : "#7a6a9a");
    ctx.textAlign = "left";

    const boss = this.boss;
    if (boss) HUD.drawBossBar(ctx, W, boss, this.time);
    HUD.drawMinimap(ctx, W, H, this);
    HUD.drawOffscreenIndicators(ctx, W, H, this);
    HUD.drawBanners(ctx, W, H, this.banners);
    if (this.debug) {
      HUD.text(ctx, `hiệu ứng ${effects.count}/${effects.max} (bỏ ${effects.dropped})  quái ${this.enemies.length}  đạn ${this.bullets.length}  ngọc ${this.orbs.length}`, 6, H - 22, "#8f8");
      HUD.text(ctx, `pool: đạn ${Bullet.pool.size}/${Bullet.pool.made} · quái ${Enemy.pool.size}/${Enemy.pool.made} · ngọc ${ExpOrb.pool.size}/${ExpOrb.pool.made}   [J] +50 quái`, 6, H - 12, "#8f8");
    }

    if (this.paused) {
      if (TOUCH && isPortrait()) this.overlay("XOAY NGANG", "Xoay ngang điện thoại để chơi tiếp", "");
      else if (TOUCH) { ctx.fillStyle = "rgba(10,8,18,0.6)"; ctx.fillRect(0, 0, W, H); }   // nút Tiếp tục là HTML
      else this.overlay("TẠM DỪNG", "P / Esc: tiếp tục", "Q: về Màn hình chính");
    }
  }

  drawSkillSlot(x, y, p) {
    const S = 24, s = p.skill, ready = p.skillCd <= 0;
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 160);
    ctx.fillStyle = p.skillActive ? s.color : ready ? (pulse > 0.5 ? "#ffe26b" : "#c8a83a") : "#4a4066";
    ctx.fillRect(x - 1, y - 1, S + 2, S + 2);
    ctx.fillStyle = "#15111f"; ctx.fillRect(x, y, S, S);
    ctx.drawImage(getSkillIcon(p.char, this.assets.images), x + 2, y + 2, 20, 20);
    if (!ready) {
      const k = p.skillCd / (s.cooldown * p.mods.cdMul);
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
    if (p.rageTime > 0) {
      ctx.fillStyle = "#2a1520"; ctx.fillRect(x, y + S + 1, S, 2);
      ctx.fillStyle = s.color; ctx.fillRect(x, y + S + 1, Math.round(S * (p.rageTime / s.duration)), 2);
    }
  }

  overlay(title, line1, line2 = "") {
    ctx.fillStyle = "rgba(10,8,18,0.6)"; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = "center";
    ctx.font = "bold 24px monospace"; HUD.text(ctx, title, W / 2, H / 2 - 36, "#ffffff");
    ctx.font = "10px monospace"; HUD.text(ctx, line1, W / 2, H / 2 + 2, "#ffe26b");
    HUD.text(ctx, line2, W / 2, H / 2 + 18, "#b8b0d0");
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
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(cx - 5, cy, 3, 1); ctx.fillRect(cx + 3, cy, 3, 1);
    ctx.fillRect(cx, cy - 5, 1, 3); ctx.fillRect(cx, cy + 3, 1, 3);
    ctx.fillStyle = "#ff3b30"; ctx.fillRect(cx, cy, 1, 1);
  }
}

// =====================================================================================
//  CON MÈO ngồi trên đầu Thanh Xuân lúc Ngại Ngùng (pixel art vẽ tay, quay mặt sang PHẢI)
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
// Thử tải hàng trăm quái: .../game/#stress-300  (có thể ghép: #autoplay-0-0-stress-300)
const STRESS = Number((location.hash.match(/stress-(\d+)/) ?? [])[1] ?? 0);
const AUTOPLAY = location.hash.startsWith("#autoplay");
function autoplay(game) {
  const p = game.player, cam = game.camera;
  let best = null, bd = Infinity;
  for (const e of game.enemies) { const d = Math.hypot(e.cx - p.cx, e.cy - p.cy); if (d < bd) { bd = d; best = e; } }
  // di chuyển về phía rương gần nhất (thử va chạm + camera)
  const chest = game.chests[0];
  for (const k of ["w", "a", "s", "d"]) input.keys.delete(k);
  if (chest) {
    if (chest.x > p.x + 6) input.keys.add("d"); else if (chest.x < p.x - 6) input.keys.add("a");
    if (chest.y > p.y + 6) input.keys.add("s"); else if (chest.y < p.y - 6) input.keys.add("w");
  } else if (Math.floor(game.time / 3) % 4 === 0) input.keys.add("d"); else if (Math.floor(game.time / 3) % 4 === 2) input.keys.add("a");
  if (!best) { input.mouse.left = false; return; }
  // >>> nhắm bằng tọa độ MÀN HÌNH = thế giới - camera
  input.mouse.x = best.cx - cam.x; input.mouse.y = best.cy - cam.y;
  input.mouse.left = true;
  if (p.skillCd <= 0 && (bd < 60 || game.enemies.length > 5)) input.pressed.add(" ");
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
    this.cards = [];
    this.time = 0;
    this.el = {
      menu: $("menu"), gameover: $("gameover"), levelup: $("levelup"), roster: $("roster"),
      prev: $("prev-btn"), next: $("next-btn"), start: $("start-btn"), mute: $("mute-btn"),
      name: $("info-name"), title: $("info-title"), desc: $("info-desc"),
      hpBar: $("stat-hp"), hpVal: $("stat-hp-val"), armorBar: $("stat-armor"), armorVal: $("stat-armor-val"),
      speedBar: $("stat-speed"), speedVal: $("stat-speed-val"),
      weaponIcon: $("weapon-icon"), weaponName: $("weapon-name"), weaponDesc: $("weapon-desc"),
      skillIcon: $("skill-icon"), skillName: $("skill-name"), skillDesc: $("skill-desc"), skillCd: $("skill-cd"),
      mapPrev: $("map-prev"), mapNext: $("map-next"), mapName: $("map-name"), mapDesc: $("map-desc"), mapPreview: $("map-preview"),
      goScore: $("go-score"), goBest: $("go-best"), goKills: $("go-kills"), goTime: $("go-time"),
      goMap: $("go-map"), goLevel: $("go-level"), goWeapons: $("go-weapons"),
      goChar: $("go-char"), goRecord: $("go-record"), retry: $("retry-btn"), home: $("home-btn"),
      lvNum: $("lv-num"), perkList: $("perk-list"),
      title2: $("title-canvas"),
    };
    this.buildTitle();
    this.buildRoster();
    this.bindEvents();
    this.syncMute();
    this.select(game.charIndex, false);
    this.selectMap(game.mapIndex, false);
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

  buildRoster() {
    const imgs = this.game.assets.images;
    CHARACTERS.forEach((char, i) => {
      const btn = document.createElement("button");
      btn.className = "hero-card"; btn.type = "button";
      btn.setAttribute("aria-label", `Chọn ${char.name}`);
      const cv = document.createElement("canvas");
      cv.width = 48; cv.height = 56; cv.className = "hero-canvas";
      const name = document.createElement("span");
      name.className = "hero-name"; name.textContent = char.name;
      btn.append(cv, name);
      btn.addEventListener("click", () => { this.game.sound.unlock(); this.select(i); });
      btn.addEventListener("dblclick", () => this.game.start(i));
      this.el.roster.append(btn);
      const g = cv.getContext("2d");
      g.imageSmoothingEnabled = false;
      // Thẻ nhân vật dùng chung spritesheet với trận đấu: thẻ đang chọn chạy tại chỗ (Run), thẻ khác thở nhẹ (Idle)
      const sheet = ACTOR_SPRITES.get(char.id) ?? null;
      const anim = sheet?.controller() ?? null;
      anim?.randomize();
      this.cards.push({ el: btn, canvas: cv, ctx: g, char, sheet, anim, sprite: imgs[`${char.id}.sprite`] ?? null, phase: Math.random() * 6 });
    });
  }

  bindEvents() {
    const g = this.game;
    this.el.prev.addEventListener("click", () => { g.sound.unlock(); this.step(-1); });
    this.el.next.addEventListener("click", () => { g.sound.unlock(); this.step(1); });
    this.el.mapPrev.addEventListener("click", () => { g.sound.unlock(); this.stepMap(-1); });
    this.el.mapNext.addEventListener("click", () => { g.sound.unlock(); this.stepMap(1); });
    this.el.start.addEventListener("click", () => g.start(g.charIndex));
    this.el.mute.addEventListener("click", () => { g.sound.unlock(); this.toggleMute(); });
    this.el.retry.addEventListener("click", () => g.start(g.charIndex));
    this.el.home.addEventListener("click", () => g.goMenu());
    window.addEventListener("pointerdown", () => g.sound.unlock(), { once: true });
  }

  step(dir) { const n = CHARACTERS.length; this.select((this.game.charIndex + dir + n) % n); }
  stepMap(dir) { const n = BIOMES.length; this.selectMap((this.game.mapIndex + dir + n) % n); }

  select(i, playSound = true) {
    const g = this.game, char = CHARACTERS[i];
    g.charIndex = i;
    this.cards.forEach((c, j) => { c.el.classList.toggle("selected", j === i); c.el.setAttribute("aria-pressed", String(j === i)); });
    this.cards[i]?.el.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
    if (playSound) g.sound.play("uiSelect", 0.5);
    const e = this.el, s = char.stats;
    e.name.textContent = char.name;
    e.title.textContent = char.title ?? "";
    e.desc.textContent = char.desc ?? "";
    setStat(e.hpBar, e.hpVal, s.hp, STAT_MAX.hp);
    setStat(e.armorBar, e.armorVal, s.armor, STAT_MAX.armor);
    setStat(e.speedBar, e.speedVal, s.speed, STAT_MAX.speed);
    e.weaponName.textContent = char.weapon.name;
    e.weaponDesc.textContent = `${char.weapon.desc} · Sát thương ${char.weapon.damage}`;
    drawWeaponPreview(e.weaponIcon, char, g.assets.images);
    e.skillName.textContent = char.skill.name;
    e.skillDesc.textContent = char.skill.desc;
    e.skillCd.textContent = `${char.skill.cooldown}s`;
    const ic = e.skillIcon.getContext("2d");
    ic.imageSmoothingEnabled = false;
    ic.clearRect(0, 0, 20, 20);
    ic.drawImage(getSkillIcon(char, g.assets.images), 0, 0);
    e.skillIcon.parentElement.style.setProperty("--skill-color", char.skill.color);
    e.menu.style.setProperty("--hero-accent", char.skill.color);
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

  toggleMute() { this.game.sound.toggleMute(); this.syncMute(); }
  syncMute() {
    const m = this.game.sound.muted;
    this.el.mute.textContent = m ? "🔇" : "🔊";
    this.el.mute.title = m ? "Bật âm thanh (M)" : "Tắt âm thanh (M)";
    this.el.mute.setAttribute("aria-pressed", String(m));
  }

  updateMenu(dt) {
    this.time += dt;
    const k = input.pressed;
    if (k.has("arrowleft") || k.has("a")) this.step(-1);
    if (k.has("arrowright") || k.has("d")) this.step(1);
    if (k.has("arrowup") || k.has("w")) this.stepMap(-1);
    if (k.has("arrowdown") || k.has("s")) this.stepMap(1);
    if (k.has("enter") && document.activeElement?.tagName !== "BUTTON") this.game.start(this.game.charIndex);
    this.drawCards(dt);
  }

  drawCards(dt = 0) {
    this.cards.forEach((c, i) => {
      const sel = i === this.game.charIndex;
      c.ctx.clearRect(0, 0, 48, 56);
      if (c.sprite) {   // ảnh tĩnh riêng của bạn: nhún nhẹ
        const t = this.time * (sel ? 1 : 0.6) + c.phase;
        const bob = Math.round(Math.sin(t * (sel ? 5 : 2.5)) * (sel ? 1.5 : 0.6) - (sel ? 0.5 : 0));
        const img = c.sprite, sc = Math.min(1, 44 / img.width, 50 / img.height);
        c.ctx.drawImage(img, 24 - (img.width * sc) / 2, 52 + bob - img.height * sc, img.width * sc, img.height * sc);
        return;
      }
      if (!c.anim) return;
      c.anim.set(sel ? "run" : "idle");
      c.anim.update(dt, sel ? 0.8 : 1);
      c.sheet.sheet.draw(c.ctx, c.anim.col, c.anim.row, 24, 52, false);   // chân đặt ở (24, 52) của thẻ 48x56
    });
  }

  showMenu() {
    this.el.gameover.classList.add("hidden");
    this.el.levelup.classList.add("hidden");
    this.el.menu.classList.remove("hidden");
    stage.classList.remove("in-game");
    this.select(this.game.charIndex, false);
  }

  showGameOver() {
    const g = this.game, e = this.el;
    e.goChar.textContent = CHARACTERS[g.charIndex].name;
    e.goScore.textContent = g.score;
    e.goBest.textContent = g.best;
    e.goKills.textContent = g.kills;
    e.goTime.textContent = `${g.time.toFixed(1)}s`;
    e.goMap.textContent = g.world.biome.name;
    e.goLevel.textContent = g.level;
    e.goWeapons.textContent = [...g.weaponsUsed].join(" · ");
    e.goRecord.classList.toggle("hidden", !g.newRecord);
    e.levelup.classList.add("hidden");
    e.gameover.classList.remove("hidden");
    stage.classList.remove("in-game");
  }

  /** Giao diện Lên Cấp: 3 thẻ nâng cấp ngẫu nhiên (click hoặc phím 1/2/3) */
  showLevelUp(level, perks, taken) {
    const e = this.el;
    e.lvNum.textContent = level;
    e.perkList.replaceChildren();
    perks.forEach((perk, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "perk-card";
      btn.style.setProperty("--perk-color", perk.color);
      const icon = document.createElement("canvas");
      icon.width = icon.height = 20;
      icon.className = "perk-icon";
      const g = icon.getContext("2d");
      g.imageSmoothingEnabled = false;
      paintBitmap(g, PERK_ICONS[perk.icon], perk.color, 2);
      const key = document.createElement("kbd"); key.textContent = String(i + 1);
      const name = document.createElement("strong"); name.textContent = perk.name;
      const desc = document.createElement("span"); desc.className = "perk-desc"; desc.textContent = perk.desc;
      const stack = document.createElement("span"); stack.className = "perk-stack";
      stack.textContent = taken[perk.id] ? `Đã có: ×${taken[perk.id]}` : "Mới";
      btn.append(key, icon, name, desc, stack);
      btn.addEventListener("click", () => this.game.choosePerk(i));
      e.perkList.append(btn);
    });
    e.levelup.classList.remove("hidden");
    stage.classList.remove("in-game");   // hiện chuột để bấm thẻ
  }

  hideLevelUp() {
    this.el.levelup.classList.add("hidden");
    stage.classList.add("in-game");
    canvas.focus();
  }

  hideAll() {
    this.el.menu.classList.add("hidden");
    this.el.gameover.classList.add("hidden");
    this.el.levelup.classList.add("hidden");
    stage.classList.add("in-game");
    document.activeElement?.blur?.();
  }
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
  // nướng sẵn các số sát thương hay gặp nhất (số lạ sẽ được nướng dần trong trận, không khựng)
  for (const v of [0.3, 0.5, 0.6, 1, 1.5, 2, 2.2, 2.5, 3, 4, 5]) effects.prepareText(`-${fmtNum(v * PLAYER_CFG.damageMul)}`, true);
  ACTOR_SPRITES = sprites.actors;
  window.SPRITES = sprites;   // xem trong Console (F12): SPRITES.effects.get("hit").sheet

  game = new Game(assets, new SoundManager(assets.sounds));
  game.ui = new MenuUI(game);
  game.touch = new TouchControls(stage, input, {
    press: (k) => { game.sound.unlock(); input.pressed.add(k); },
    goMenu: () => game.goMenu(),
  });
  window.game = game; // tiện debug trong Console (F12)

  if (AUTOPLAY) {
    const [, c, m] = location.hash.split("-");
    game.mapIndex = clamp(Number(m) || 0, 0, BIOMES.length - 1);
    game.start(clamp(Number(c) || 0, 0, CHARACTERS.length - 1));
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


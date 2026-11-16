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
//  Trong file này:
//    1. CẤU HÌNH   2. TÀI NGUYÊN   3. HIỆU ỨNG (pixelfx)   4. ÂM THANH   5. INPUT (+ chuột -> tọa độ thế giới)
//    6. ICON KỸ NĂNG   7. KỸ NĂNG   8. NGƯỜI CHƠI   9. GAME   10. GIAO DIỆN MENU (DOM)   11. GAME LOOP
// =====================================================================================

// Thư viện hiệu ứng pixelfx (thư mục pixelfx-main nằm cạnh thư mục game)
import { createFrame, clearFrame, createFx, composite, painterFor, hex } from "../pixelfx-main/src/core/index.js";
// --- Các hiệu ứng lấy từ pixelfx. Muốn đổi hiệu ứng: đổi đường dẫn import ở đây (xem docs/CATALOG.md) ---
import * as fxHitSpark from "../pixelfx-main/src/fx/impacts/hit-spark.js";
import * as fxPoof from "../pixelfx-main/src/fx/spawn/poof.js";
import * as fxMuzzle from "../pixelfx-main/src/fx/projectiles/muzzle-pistol.js";
import * as fxMuzzleShotgun from "../pixelfx-main/src/fx/projectiles/muzzle-shotgun.js";
import * as fxSlash from "../pixelfx-main/src/fx/melee/sword-slash.js";
import * as fxDamageNumber from "../pixelfx-main/src/fx/ui/damage-number.js";
import * as fxBlinkIn from "../pixelfx-main/src/fx/arcane/blink-in.js";
import * as fxRage from "../pixelfx-main/src/fx/status/rage.js";          // hào quang kỹ năng Cuồng Nộ
import * as fxManaBurst from "../pixelfx-main/src/fx/arcane/mana-burst.js"; // vụ nổ kỹ năng Bão Cầu Năng Lượng
import * as fxExplosion from "../pixelfx-main/src/fx/explosions/small-explosion.js";  // thùng thuốc nổ, dơi cảm tử
import * as fxPlasma from "../pixelfx-main/src/fx/explosions/plasma-explosion.js";    // súng phóng lựu
import * as fxIceShatter from "../pixelfx-main/src/fx/ice/ice-shatter.js";           // tinh thể băng vỡ
import * as fxParry from "../pixelfx-main/src/fx/impacts/parry.js";                  // kiếm chém rụng đạn
import * as fxChestOpen from "../pixelfx-main/src/fx/pickups/chest-open.js";         // mở rương

import { CHARACTERS, STAT_MAX, ARMOR_REGEN } from "./characters.js";
import { TAU, clamp, circleHit, angleDiff, rand, rndSeed, lighten, withAlpha, fmtNum } from "./src/util.js";
import { BIOMES, ENV, World, Camera } from "./src/world.js";
import { fireWeapon, meleeSwing, muzzleLength, drawWeaponFallback, drawWeaponIcon, enemyBulletHitsPlayer, Bullet } from "./src/weapons.js";
import { Enemy, pickEnemyType } from "./src/enemies.js";
import { Chest, Pickup, ExpOrb, rollChest, CHEST_TIERS, ITEMS } from "./src/loot.js";
import { rollPerks, expToNext, PERK_ICONS } from "./src/perks.js";
import { makeActor, drawHero } from "./src/actors.js";
import * as HUD from "./src/hud.js";

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
};

/** Kỹ năng Lướt Nhanh (Shift) — mọi nhân vật đều có */
const ROLL = { distance: 140, time: 0.16, cooldown: 2.5, iframes: 0.25 };

const SPAWN = {
  maxEnemies: 46,
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

const SOUND_MANIFEST = {
  // >>> CHÈN FILE ÂM THANH (.mp3 / .wav / .ogg)
  // --- Chiến đấu ---
  shoot: "", punch: "", magicShoot: "",           // vũ khí khởi đầu của 3 nhân vật
  shotgun: "", laser: "", grenadeShoot: "", sword: "", // 4 vũ khí mới
  hit: "", enemyDie: "", playerHurt: "", armorHit: "", gameOver: "",
  explosion: "",     // thùng nổ / lựu đạn
  deflect: "",       // kiếm chém rụng đạn
  shieldBlock: "",   // trúng khiên Hiệp Sĩ
  arrow: "",         // Cung Thủ Xương bắn
  batArm: "",        // Dơi Cảm Tử chuẩn bị nổ
  iceBreak: "",      // tinh thể băng vỡ
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
// 3. HIỆU ỨNG (pixelfx) — vị trí truyền vào luôn là TỌA ĐỘ THẾ GIỚI; lúc vẽ mới trừ camera
// =====================================================================================
const fxFrame = createFrame(W, H);
const fxImage = new ImageData(W, H);
const fxCanvas = document.createElement("canvas");
fxCanvas.width = W; fxCanvas.height = H;
const fxCtx = fxCanvas.getContext("2d");

/** Hiệu ứng one-shot đang chạy. Tự xóa khi xong. */
const activeFx = [];

/** Góc ngắm -> { flip, angle } cho pixelfx (hiệu ứng mặc định hướng sang PHẢI) */
function faceOpts(aim) {
  const left = Math.cos(aim) < 0;
  return { flip: left, angle: left ? aim - Math.PI : aim };
}

/** Bảng tra hiệu ứng: đổi module / tham số ở đây để thay hiệu ứng mà không cần sửa logic game. */
const FX = {
  hit: (x, y, aim) => spawnFx(fxHitSpark, { x, y, height: 0, ...faceOpts(aim), seed: rndSeed() }),
  death: (x, y) => spawnFx(fxPoof, { x, y: y + 10, seed: rndSeed() }),
  muzzle: (x, y, aim) => spawnFx(fxMuzzle, { x, y, height: 0, ...faceOpts(aim), seed: rndSeed() }),
  muzzleShotgun: (x, y, aim) => spawnFx(fxMuzzleShotgun, { x, y, height: 0, ...faceOpts(aim), seed: rndSeed() }),
  slash: (x, y, aim, radius = 30, palette) => {
    const f = faceOpts(aim), off = radius * 0.66;
    return spawnFx(fxSlash, { x: x - off * Math.sin(f.angle), y: y + off * Math.cos(f.angle), radius, ...f, ...(palette ? { palette } : {}), seed: rndSeed() });
  },
  damage: (x, y, amount) => spawnFx(fxDamageNumber, { x, y, text: `-${fmtNum(amount)}`, seed: rndSeed() }),
  spawn: (x, y) => spawnFx(fxBlinkIn, { x, y, seed: rndSeed() }),
  nova: (x, y) => spawnFx(fxManaBurst, { x, y, seed: rndSeed() }),
  // >>> NỔ: thùng thuốc nổ (size = độ to) / lựu đạn năng lượng
  explosion: (x, y, size = 0.8) => spawnFx(fxExplosion, { x, y, size, seed: rndSeed() }),
  plasma: (x, y) => spawnFx(fxPlasma, { x, y, seed: rndSeed() }),
  iceShatter: (x, y, aim) => spawnFx(fxIceShatter, { x, y, ...faceOpts(aim), seed: rndSeed() }),
  parry: (x, y) => spawnFx(fxParry, { x, y, height: 0, seed: rndSeed() }),
  chestOpen: (x, y, tier) => spawnFx(fxChestOpen, { x, y, wood: CHEST_TIERS[tier].fx, coins: tier === "gold" ? 16 : 8, seed: rndSeed() }),
};

function spawnFx(mod, opts) {
  const fx = createFx(mod, opts);
  activeFx.push(fx);
  return fx;
}

/** Vẽ 1 hiệu ứng (options.x/y là tọa độ thế giới) vào fxFrame theo camera */
function drawFxWorld(fx, cam, layer) {
  const o = fx.options, ox = o.x ?? 0, oy = o.y ?? 0;
  const sx = ox - cam.rx, sy = oy - cam.ry;
  if (sx < -180 || sx > W + 180 || sy < -140 || sy > H + 220) return;
  o.x = Math.round(sx); o.y = Math.round(sy);
  fx.draw(fxFrame, layer);
  o.x = ox; o.y = oy;
}

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
    if (now - (this.lastPlay[name] ?? 0) < 30) return;
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

function fitCanvas() {
  const scale = Math.max(1, Math.floor(Math.min((window.innerWidth - 16) / W, (window.innerHeight - 44) / H)));
  canvas.style.width = `${W * scale}px`;
  canvas.style.height = `${H * scale}px`;
  stage.style.fontSize = `${(W * scale) / 60}px`;
}
window.addEventListener("resize", fitCanvas);
fitCanvas();

// =====================================================================================
// 6. ICON KỸ NĂNG (pixel) — dùng khi chưa chèn ảnh icon
// =====================================================================================
const SKILL_ICON_BITMAPS = {
  rage: ["....#.....", "...##...#.", "..###..##.", "..####.##.", ".#####o##.", ".##o##oo#.", "##oo#ooo##", "#oo*oo*oo#", ".#o****o#.", "..######.."],
  dash: ["#....#....", "##...##...", "o##..o##..", ".o##..o##.", "..*##..*##", "..*##..*##", ".o##..o##.", "o##..o##..", "##...##...", "#....#...."],
  nova: ["....**....", ".#..oo..#.", "..#.oo.#..", "...oooo...", "*oooo*ooo*", "*ooo*oooo*", "...oooo...", "..#.oo.#..", ".#..oo..#.", "....**...."],
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
  const pal = { "#": color, o: lighten(color, 0.4), "*": "#ffffff" };
  rows.forEach((r, y) => [...r].forEach((ch, x) => { if (pal[ch]) { g.fillStyle = pal[ch]; g.fillRect(x * k, y * k, k, k); } }));
}

// =====================================================================================
// 7. KỸ NĂNG CHỦ ĐỘNG (Space / chuột phải) — mỗi `skill.type` trong characters.js ứng với 1 hàm
// =====================================================================================
const SKILL_HANDLERS = {
  /** CUỒNG NỘ: tốc độ tấn công x2 trong `duration` giây */
  rage(p, game, s) {
    p.rageTime = s.duration;
    p.aura?.stop();
    p.aura = createFx(fxRage, { x: p.x, y: p.y, flip: p.facingLeft, actor: p.actor, seed: rndSeed() });
    game.sound.play("skillRage", 0.6);
    game.shake(0.2, 2);
  },
  /** LƯỚT XUNG KÍCH: lao về phía con trỏ (tọa độ thế giới), bất tử khi lướt, hất tung kẻ địch */
  dash(p, game, s) {
    const m = worldMouse();
    const a = Math.atan2(m.y - p.cy, m.x - p.cx);
    p.dash = { t: 0, dur: s.dashTime, vx: Math.cos(a) * s.dashSpeed, vy: Math.sin(a) * s.dashSpeed, angle: a, hit: new Set(), trail: 0 };
    p.kx = p.ky = 0;
    game.sound.play("skillDash", 0.6);
    game.shake(0.12, 2);
  },
  /** BÃO CẦU NĂNG LƯỢNG: bắn `count` viên tỏa đều 360 độ */
  nova(p, game, s) {
    const n = s.count ?? 12;
    for (let i = 0; i < n; i++) {
      const a = p.aim + (i / n) * TAU;
      game.bullets.push(new Bullet(p.cx + Math.cos(a) * 6, p.cy + Math.sin(a) * 6, a, {
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
    this.actor = makeActor(char);
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
    this.mods = { split: 0, bounce: 0, absorb: 0, damageMul: 1, knockMul: 1, cdMul: 1, speedMul: 1 };
    this.perksTaken = {};
    this.absorbCount = 0;
    this.pickupRange = PLAYER_CFG.pickupRange;

    this.aim = 0; this.fireTimer = 0; this.hurtTimer = 0; this.recoil = 0; this.walkTime = 0;
    this.kx = 0; this.ky = 0;

    // --- Kỹ năng riêng ---
    this.skillCd = 0; this.rageTime = 0; this.aura = null; this.dash = null;
    // --- Lướt nhanh (Shift) ---
    this.roll = null; this.rollCd = 0; this.rollCdMax = ROLL.cooldown; this.rollInv = 0;
    this.ghosts = [];
    // --- Hiệu ứng tạm thời ---
    this.frenzy = 0;       // Thuốc Cuồng Nộ
    this.acidTick = 0;     // thời gian đứng trong axit
    this.inAcid = false;
  }

  get weapon() { return this.weapons[this.slot]; }
  get cx() { return this.x; }
  get cy() { return this.y - 17; }
  get facingLeft() { return Math.cos(this.aim) < 0; }
  get invulnerable() { return this.hurtTimer > 0 || !!this.dash || this.rollInv > 0; }
  get skillActive() { return this.rageTime > 0 || !!this.dash; }
  get speed() { return this.baseSpeed * this.mods.speedMul * (this.frenzy > 0 ? 1.3 : 1) * (this.inAcid ? 1 - ENV.acid.slow : 1); }
  get muzzle() {
    const len = muzzleLength(this.weapon);
    return { x: this.cx + Math.cos(this.aim) * len, y: this.cy + 2 + Math.sin(this.aim) * len };
  }

  update(dt, game) {
    const world = game.world;
    this.hurtTimer -= dt;
    this.fireTimer -= dt;
    this.skillCd = Math.max(0, this.skillCd - dt);
    this.rollCd = Math.max(0, this.rollCd - dt);
    this.rollInv = Math.max(0, this.rollInv - dt);
    this.frenzy = Math.max(0, this.frenzy - dt);
    this.recoil = Math.max(0, this.recoil - dt * 30);
    this.armorFlash = Math.max(0, this.armorFlash - dt);
    this.updateArmor(dt);
    if (this.rageTime > 0) { this.rageTime -= dt; if (this.rageTime <= 0) { this.rageTime = 0; this.aura?.stop(); } }

    // --- Ngắm theo chuột (TỌA ĐỘ THẾ GIỚI) ---
    const m = worldMouse();
    this.aim = Math.atan2(m.y - this.cy, m.x - this.cx);

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

    // --- Di chuyển ---
    let dx = 0, dy = 0;
    if (input.keys.has("w") || input.keys.has("arrowup")) dy -= 1;
    if (input.keys.has("s") || input.keys.has("arrowdown")) dy += 1;
    if (input.keys.has("a") || input.keys.has("arrowleft")) dx -= 1;
    if (input.keys.has("d") || input.keys.has("arrowright")) dx += 1;
    const len = Math.hypot(dx, dy);
    if (len) { dx /= len; dy /= len; }

    if (input.pressed.has("shift") && !this.dash) this.startRoll(game, dx, dy);

    if (this.dash) this.updateDash(dt, game);
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

    // --- Tấn công & kỹ năng ---
    if (input.mouse.left && this.fireTimer <= 0 && !this.dash && !this.roll) this.attack(game);
    if (input.pressed.has(" ") || input.pressed.has("mouse2")) this.useSkill(game);

    for (const g of this.ghosts) g.life -= dt;
    this.ghosts = this.ghosts.filter((g) => g.life > 0);
    if (this.aura) {
      Object.assign(this.aura.options, { x: Math.round(this.x), y: Math.round(this.y), flip: this.facingLeft });
      this.aura.update(dt);
      if (this.aura.done()) this.aura = null;
    }
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
    this.fireTimer = w.fireRate * rateMul;
    if (w.type === "melee" || w.type === "sword") meleeSwing(this, game, w);
    else fireWeapon(this, game, w);
  }

  // ---------- Kỹ năng ----------
  useSkill(game) {
    if (this.skillCd > 0 || this.dash) { game.sound.play("skillDenied", 0.4); return; }
    const handler = SKILL_HANDLERS[this.skill.type];
    if (!handler) { console.warn(`[Skill] Chưa có kỹ năng loại "${this.skill.type}" trong SKILL_HANDLERS`); return; }
    handler(this, game, this.skill);
    this.skillCd = this.skill.cooldown * this.mods.cdMul;   // thẻ "Bậc Thầy Kỹ Năng"
  }

  updateDash(dt, game) {
    const d = this.dash, s = this.skill;
    d.t += dt;
    game.world.moveBody(this, d.vx * dt, d.vy * dt, PLAYER_CFG.footR);
    this.walkTime += dt;
    d.trail -= dt;
    if (d.trail <= 0) { d.trail = 0.025; this.ghosts.push({ x: this.x, y: this.y, flip: Math.cos(d.angle) < 0, life: 0.25, color: s.color }); }
    for (const e of game.enemies) {
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
    const v = ROLL.distance / ROLL.time;
    this.roll = { t: 0, vx: dx * v, vy: dy * v, trail: 0 };
    this.rollCd = this.rollCdMax;
    this.rollInv = ROLL.iframes;
    this.kx = this.ky = 0;
    game.sound.play("roll", 0.5);
  }
  updateRoll(dt, game) {
    const r = this.roll;
    r.t += dt;
    game.world.moveBody(this, r.vx * dt, r.vy * dt, PLAYER_CFG.footR);
    this.walkTime += dt;
    r.trail -= dt;
    if (r.trail <= 0) { r.trail = 0.03; this.ghosts.push({ x: this.x, y: this.y, flip: r.vx < 0, life: 0.3, color: "#a8dcff" }); }
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
    if (toHp > 0) { game.shake(0.28, 5); game.hitStop(0.08); game.sound.play("playerHurt", 0.6); game.hurtFlash = 0.25; }
    else { this.armorFlash = 0.3; game.shake(0.16, 3); game.hitStop(0.04); game.sound.play("armorHit", 0.5); }
    FX.hit(this.cx, this.cy, a);
  }

  get blinking() { return this.hurtTimer > 0 && !this.dash && Math.floor(this.hurtTimer * 20) % 2 === 0; }
  get bob() { return this.walkTime > 0 ? -Math.abs(Math.sin(this.walkTime * 14)) * 2 : 0; }

  /** Lớp pixelfx (tọa độ màn hình = thế giới - camera) */
  drawPixels(game, frame, cam) {
    const p = painterFor(frame);
    const hasImg = !!game.assets.images[`${this.char.id}.sprite`];
    if (!hasImg) for (const g of this.ghosts) drawHero(p, this.actor, g.x - cam.rx, g.y - cam.ry, g.flip, { tint: hex(g.color), a: (g.life / 0.3) * 0.55 });
    if (this.aura) drawFxWorld(this.aura, cam, "back");
    if (this.blinking || hasImg) return;
    if (this.aura && fxRage.actorAlpha(this.aura.t % fxRage.meta.duration) === 0 && this.rageTime > 0) return;
    drawHero(p, this.actor, this.x - cam.rx, this.y + this.bob - cam.ry, this.facingLeft, this.rollInv > 0 ? { a: 0.75 } : {});
  }
  drawFrontFx(game, cam) {
    if (!this.aura) return;
    if (!game.assets.images[`${this.char.id}.sprite`]) drawFxWorld(this.aura, cam, "front");
  }
  /** Ảnh nhân vật của bạn (nếu có) — canvas ở tọa độ thế giới */
  drawSprite(c, game) {
    const img = game.assets.images[`${this.char.id}.sprite`];
    if (!img) return;
    for (const g of this.ghosts) {
      c.save(); c.globalAlpha = (g.life / 0.3) * 0.4;
      c.translate(Math.round(g.x), Math.round(g.y)); if (g.flip) c.scale(-1, 1);
      c.drawImage(img, -img.width / 2, -img.height); c.restore();
    }
    if (this.blinking) return;
    // >>> ẢNH NHÂN VẬT CỦA BẠN được vẽ ở đây (chân đặt tại this.x, this.y)
    c.save();
    c.translate(Math.round(this.x), Math.round(this.y + this.bob));
    if (this.facingLeft) c.scale(-1, 1);
    c.drawImage(img, -img.width / 2, -img.height);
    c.restore();
  }
  drawOverlay() { /* người chơi không có lớp phủ riêng */ }

  drawWeapon(c, game) {
    if (this.dash || this.roll) return;
    c.save();
    c.translate(Math.round(this.cx), Math.round(this.cy + 2));
    c.rotate(this.aim);
    if (this.facingLeft) c.scale(1, -1);
    c.translate(4 - this.recoil, 0);
    const img = this.weapon === this.char.weapon ? game.assets.images[`${this.char.id}.weapon`] : null;
    if (img) c.drawImage(img, 0, -img.height / 2);   // >>> ẢNH VŨ KHÍ KHỞI ĐẦU CỦA BẠN
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
    this.sound.play("uiStart", 0.6);
    this.sound.setMusic("music");
    canvas.focus();
  }

  goMenu() {
    this.state = GAME_STATE.MENU;
    this.paused = false;
    this.choosing = false;
    activeFx.length = 0;
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
    activeFx.length = 0;
    this.world = new World(biome, this.assets.images);
    this.minimap = this.world.renderMinimap(HUD.MINIMAP.w, HUD.MINIMAP.h);
    this.player = new Player(char, this.world.spawn);
    this.camera = new Camera(W, H);
    this.camera.snap(this.player.x, this.player.cy);
    this.bullets = []; this.enemyBullets = []; this.enemies = [];
    this.chests = []; this.pickups = []; this.orbs = [];
    this.beams = []; this.waves = []; this.shocks = []; this.flashes = []; this.banners = [];
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
  }

  shake(time, amp) { this.camera.shake(time, amp); }
  hitStop(t) { this.freeze = Math.max(this.freeze, t); }
  get boss() { return this.enemies.find((e) => e.boss && !e.dead) ?? null; }

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
    const e = new Enemy(type, pt.x, pt.y, { elite });
    this.enemies.push(e);
    FX.spawn(e.cx, e.cy + 8);
  }

  spawnBoss() {
    const p = this.player;
    const pt = this.world.randomFreePoint({ near: { x: p.x, y: p.y }, minD: 200, maxD: 320, margin: 26 })
      ?? this.world.randomFreePoint({ margin: 26 });
    if (!pt) return;
    this.bossCount++;
    const e = new Enemy("boss", pt.x, pt.y, { hpMul: 1 + (this.bossCount - 1) * 0.5 });
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
    FX.hit(e.cx, e.cy, angle);
    FX.damage(e.cx, e.cy - 10, dmg);
    this.sound.play("hit", 0.4);
    this.hitStop(0.03);
    if (e.hp <= 0) this.killEnemy(e);
  }

  killEnemy(e, opts = {}) {
    if (e.dead) return;
    e.dead = true;
    FX.death(e.cx, e.cy);
    this.sound.play("enemyDie", 0.5);
    this.shake(0.12, 2);
    this.hitStop(0.05);
    if (opts.noReward) return;
    this.kills++;
    this.score += e.cfg.score * (e.elite ? 3 : 1);
    // rơi ngọc EXP
    let exp = e.cfg.exp * (e.elite ? 3 : 1);
    while (exp > 0) { const v = exp >= 5 ? 5 : 1; exp -= v; this.orbs.push(new ExpOrb(e.x, e.y - 6, v)); }
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
        const c = new Enemy(e.cfg.split, e.x + s * 8, e.y);
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
    for (const e of this.enemies) {
      if (e.dead) continue;
      const d = Math.hypot(e.cx - x, e.cy - y);
      if (d <= o.radius + e.radius) this.damageEnemy(e, o.damage, Math.atan2(e.cy - y, e.cx - x), o.knock ?? 260, { explosive: true });
    }
    for (const b of this.world.barrels) if (!b.dead && Math.hypot(b.x - x, b.y - 6 - y) <= o.radius) this.igniteBarrel(b);
    for (const c of this.world.crystals) if (!c.dead && Math.hypot(c.x - x, c.y - 8 - y) <= o.radius) this.hitCrystal(c, 99, Math.atan2(c.y - y, c.x - x));
    const p = this.player;
    if (o.hurtPlayer && Math.hypot(p.cx - x, p.cy - y) <= (o.playerRadius ?? o.radius)) p.hurt(this, x, y, 1);
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
      this.bullets.push(new Bullet(c.x, c.y - 8, a, { speed: 260, damage: ENV.crystal.shardDamage, radius: 2, style: "shard", life: 0.55, knock: 120 }));
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
    if (this.paused) { if (input.pressed.has("q")) this.goMenu(); return; }

    this.camera.updateShake(dt);
    this.hurtFlash = Math.max(0, this.hurtFlash - dt);
    if (this.freeze > 0) { this.freeze -= dt; return; }

    this.time += dt;
    const p = this.player, world = this.world;
    world.update(dt);
    if (AUTOPLAY) autoplay(this);
    p.update(dt, this);

    // --- Sinh quái: nhanh dần theo thời gian ---
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && this.enemies.length < SPAWN.maxEnemies) {
      this.spawnEnemy();
      if (this.time > 30 && Math.random() < 0.35) this.spawnEnemy();
      this.spawnTimer = Math.max(0.35, 1.5 - this.time * 0.015);
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
    for (const b of this.bullets) b.update(dt, this);
    for (const b of this.enemyBullets) b.update(dt, this);

    // --- Va chạm: đạn người chơi -> quái ---
    for (const b of this.bullets) {
      if (b.dead) continue;
      for (const e of this.enemies) {
        if (e.dead || e.spawnTime > 0.2) continue;
        if (circleHit(b.x, b.y, b.radius, e.cx, e.cy, e.radius)) {
          this.damageEnemy(e, b.damage, b.angle, b.knock);
          b.finish(this);
          break;
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
    for (const e of this.enemies) {
      if (!e.dead && e.canHurt && circleHit(p.cx, p.cy, p.radius, e.cx, e.cy, e.radius)) p.hurt(this, e.cx, e.cy, e.contactDamage);
    }
    // --- Quái đẩy nhau ra (Boss không bị đẩy) ---
    const es = this.enemies;
    for (let i = 0; i < es.length; i++) {
      for (let j = i + 1; j < es.length; j++) {
        const a = es[i], b = es[j];
        const dx = b.x - a.x, dy = b.cy - a.cy, d = Math.hypot(dx, dy), min = a.radius + b.radius;
        if (d > 0 && d < min) {
          const push = (min - d) / 2;
          const wa = a.boss ? 0 : b.boss ? 2 : 1, wb = b.boss ? 0 : a.boss ? 2 : 1;
          a.x -= (dx / d) * push * wa; a.y -= (dy / d) * push * wa;
          b.x += (dx / d) * push * wb; b.y += (dy / d) * push * wb;
        }
      }
    }

    this.updateHazards(dt);

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
    for (const list of [this.beams, this.waves, this.shocks, this.flashes, this.banners]) for (const b of list) b.life -= dt;

    this.bullets = this.bullets.filter((b) => !b.dead);
    this.enemyBullets = this.enemyBullets.filter((b) => !b.dead);
    this.enemies = this.enemies.filter((e) => !e.dead);
    this.chests = this.chests.filter((c) => !c.dead);
    this.pickups = this.pickups.filter((pk) => !pk.dead);
    this.orbs = this.orbs.filter((o) => !o.dead);
    this.beams = this.beams.filter((b) => b.life > 0);
    this.waves = this.waves.filter((b) => b.life > 0);
    this.shocks = this.shocks.filter((b) => b.life > 0);
    this.flashes = this.flashes.filter((b) => b.life > 0);
    this.banners = this.banners.filter((b) => b.life > 0);
    this.updateFx(dt);

    // --- Camera bám theo, nhìn hơi lệch theo hướng chuột ---
    const m = worldMouse();
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
      if (Math.hypot(p.x - t.x, (p.y - t.y) * 1.3) < ENV.trap.r + 4) p.hurt(this, t.x, t.y + 10, ENV.trap.damage);
      if (t.burnTick <= 0) {
        t.burnTick = 0.4;
        for (const e of this.enemies) if (!e.cfg.flying && Math.hypot(e.x - t.x, e.y - t.y) < ENV.trap.r + e.radius * 0.5) this.damageEnemy(e, 1.5, -Math.PI / 2, 60);
      }
    }
  }

  updateFx(dt) {
    for (const fx of activeFx) fx.update(dt);
    for (let i = activeFx.length - 1; i >= 0; i--) if (activeFx[i].done()) activeFx.splice(i, 1);
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
    for (const e of this.enemies) e.drawShadow(ctx);

    // Lớp pixelfx: người + quái sắp theo trục Y, rồi hiệu ứng
    clearFrame(fxFrame);
    const actors = this.enemies.filter((e) => cam.inView(e.x, e.y, 120));
    if (alive) actors.push(this.player);
    actors.sort((a, b) => a.y - b.y);
    for (const a of actors) a.drawPixels(this, fxFrame, cam);
    if (alive) this.player.drawFrontFx(this, cam);
    for (const fx of activeFx) drawFxWorld(fx, cam);
    composite(fxFrame, fxImage.data, null);
    fxCtx.putImageData(fxImage, 0, 0);

    for (const a of actors) a.drawSprite(ctx, this);
    ctx.drawImage(fxCanvas, cx, cy);
    for (const a of actors) a.drawOverlay(ctx, this);
    for (const e of actors) if (e !== this.player) e.drawFlash(ctx);

    for (const b of this.bullets) b.draw(ctx, this);
    for (const b of this.enemyBullets) b.draw(ctx);
    this.drawBeams();
    HUD.drawShockwaves(ctx, this.shocks);
    if (alive) this.player.drawWeapon(ctx, this);
    for (const f of this.flashes) {    // chớp sáng đầu nòng
      ctx.fillStyle = withAlpha("#ffffff", 0.9);
      ctx.fillRect(Math.round(f.x - f.size / 2), Math.round(f.y - f.size / 2), f.size, f.size);
      ctx.fillStyle = withAlpha(f.color.startsWith("#") ? f.color : "#ffe26b", 0.5);
      ctx.fillRect(Math.round(f.x - f.size), Math.round(f.y - f.size), f.size * 2, f.size * 2);
    }
    this.drawPickupLabels();
    if (this.debug) this.drawDebug();
    ctx.restore();

    // ---- HUD (tọa độ màn hình) ----
    if (this.hurtFlash > 0) { ctx.fillStyle = `rgba(200,20,40,${this.hurtFlash * 0.6})`; ctx.fillRect(0, 0, W, H); }
    if (this.player.inAcid) { ctx.fillStyle = "rgba(60,200,40,0.10)"; ctx.fillRect(0, 0, W, H); }
    this.drawHUD();
    if (alive && !this.paused && !this.choosing) this.drawCrosshair();
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
      if (Math.hypot(pk.x - p.x, pk.y - p.y) > 50) continue;
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
    HUD.drawDashPip(ctx, X + 1, Y + 61, p);
    let fy = Y + 70;
    ctx.font = "7px monospace";
    if (p.frenzy > 0) { HUD.text(ctx, `CUỒNG NỘ ${p.frenzy.toFixed(1)}s`, X + 1, fy, "#ff8a2a"); fy += 9; }
    if (p.inAcid) { HUD.text(ctx, "AXIT! -1 GIÁP / 1.5s", X + 1, fy, "#8aff5a"); fy += 9; }
    ctx.font = "8px monospace";

    // Điểm, thời gian, cấp độ (góc trên phải)
    ctx.textAlign = "right";
    HUD.text(ctx, `ĐIỂM ${this.score}`, W - 6, 6, "#ffe26b");
    HUD.text(ctx, `${this.time.toFixed(1)}s · hạ ${this.kills}`, W - 6, 17, "#b8b0d0");
    HUD.text(ctx, `CẤP ${this.level}  ${this.exp}/${this.expNeed}`, W - 6, 28, "#7cc0ff");
    const nb = Math.ceil(this.bossTimer);
    if (!this.boss) HUD.text(ctx, `Boss sau ${nb}s`, W - 6, 39, nb <= 5 ? "#ff7ad8" : "#7a6a9a");
    ctx.textAlign = "left";

    const boss = this.boss;
    if (boss) HUD.drawBossBar(ctx, W, boss, this.time);
    HUD.drawMinimap(ctx, W, H, this);
    HUD.drawOffscreenIndicators(ctx, W, H, this);
    HUD.drawBanners(ctx, W, H, this.banners);
    if (this.debug) HUD.text(ctx, `fx: ${activeFx.length}  quái: ${this.enemies.length}  đạn: ${this.bullets.length}`, 6, H - 12, "#8f8");

    if (this.paused) this.overlay("TẠM DỪNG", "P / Esc: tiếp tục", "Q: về Màn hình chính");
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

  drawCrosshair() {
    const cx = Math.round(input.mouse.x), cy = Math.round(input.mouse.y);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(cx - 5, cy, 3, 1); ctx.fillRect(cx + 3, cy, 3, 1);
    ctx.fillRect(cx, cy - 5, 1, 3); ctx.fillRect(cx, cy + 3, 1, 3);
    ctx.fillStyle = "#ff3b30"; ctx.fillRect(cx, cy, 1, 1);
  }
}

// Chế độ tự chơi để kiểm tra: .../game/#autoplay-<nhân vật>-<bản đồ>  (ví dụ #autoplay-1-3)
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
      this.cards.push({ el: btn, canvas: cv, ctx: g, char, frame: createFrame(48, 56), image: new ImageData(48, 56), actor: makeActor(char), sprite: imgs[`${char.id}.sprite`] ?? null, phase: Math.random() * 6 });
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
    this.drawCards();
  }

  drawCards() {
    this.cards.forEach((c, i) => {
      const sel = i === this.game.charIndex;
      const t = this.time * (sel ? 1 : 0.6) + c.phase;
      const bob = Math.round(Math.sin(t * (sel ? 5 : 2.5)) * (sel ? 1.5 : 0.6) - (sel ? 0.5 : 0));
      if (c.sprite) {
        const img = c.sprite, sc = Math.min(1, 44 / img.width, 50 / img.height);
        c.ctx.clearRect(0, 0, 48, 56);
        c.ctx.drawImage(img, 24 - (img.width * sc) / 2, 52 + bob - img.height * sc, img.width * sc, img.height * sc);
        return;
      }
      clearFrame(c.frame);
      drawHero(painterFor(c.frame), c.actor, 24, 52 + bob, false);
      composite(c.frame, c.image.data, null);
      c.ctx.putImageData(c.image, 0, 0);
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
function drawLoading(progress) {
  ctx.fillStyle = "#0d0b14"; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#2e2840"; ctx.fillRect(W / 2 - 80, H / 2, 160, 8);
  ctx.fillStyle = "#ffe26b"; ctx.fillRect(W / 2 - 80, H / 2, 160 * progress, 8);
  ctx.font = "10px monospace"; ctx.textAlign = "center";
  HUD.text(ctx, "Đang tải tài nguyên...", W / 2, H / 2 - 16, "#b8b0d0");
  ctx.textAlign = "left";
}

let game = null;

async function main() {
  const assets = new AssetLoader();
  drawLoading(0);
  await assets.loadAll(IMAGE_MANIFEST, SOUND_MANIFEST, drawLoading);

  game = new Game(assets, new SoundManager(assets.sounds));
  game.ui = new MenuUI(game);
  window.game = game; // tiện debug trong Console (F12)

  if (AUTOPLAY) {
    const [, c, m] = location.hash.split("-");
    game.mapIndex = clamp(Number(m) || 0, 0, BIOMES.length - 1);
    game.start(clamp(Number(c) || 0, 0, CHARACTERS.length - 1));
  } else game.goMenu();

  let last = performance.now();
  function frame(now) {
    const dt = Math.min((now - last) / 1000, 1 / 30);
    last = now;
    game.update(dt);
    game.draw();
    input.pressed.clear();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

main();


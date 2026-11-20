// =====================================================================================
//  >>> CẤU HÌNH HIỆU ỨNG & SPRITESHEET <<<   (file này là chỗ bạn map ảnh hiệu ứng vào game)
//
//  Mỗi mục có 2 nguồn hình, game dùng theo thứ tự ưu tiên:
//    1. `src`     — file PNG spritesheet (mặc định trỏ tới ảnh đã xuất sẵn trong assets/images/fx/)
//    2. `pixelfx` — hiệu ứng gốc trong thư viện pixelfx-main: nếu file PNG bị thiếu/lỗi,
//                   game tự "nướng" lại từ code lúc tải (chậm hơn vài giây nhưng không bao giờ mất hình)
//
//  QUY ƯỚC SPRITESHEET:  mỗi CỘT = 1 frame theo thời gian, mỗi HÀNG = 1 biến thể (game chọn ngẫu nhiên 1 hàng).
//
//  >>> DÙNG ẢNH CỦA BẠN: đổi `src` sang file của bạn rồi điền cho đúng:
//        cols, rows        — số cột / số hàng trong ảnh  (hoặc frameW, frameH = kích thước 1 ô, tính bằng pixel)
//        frames            — số frame thật sự dùng trong 1 hàng (bỏ trống = bằng cols)
//        fps               — tốc độ phát
//        anchorX, anchorY  — điểm gốc trong 1 ô (pixel). Bỏ trống = giữa ô. Với tia lửa đầu nòng nên đặt ở mép TRÁI giữa.
//        offsetX, offsetY  — xê dịch thêm nếu hiệu ứng bị lệch so với nòng súng / thân quái
//        margin, spacing   — lề ngoài & khoảng cách giữa các ô (nếu ảnh của bạn có)
//      Khi `src` là ảnh của bạn, kích thước tự động từ lần xuất trước sẽ KHÔNG được dùng nữa.
//
//  Muốn xuất lại PNG sau khi đổi tham số pixelfx:  node game/tools/bake-sprites.mjs
// =====================================================================================
import * as fxHitSpark from "../pixelfx-main/src/fx/impacts/hit-spark.js";
import * as fxPoof from "../pixelfx-main/src/fx/spawn/poof.js";
import * as fxMuzzle from "../pixelfx-main/src/fx/projectiles/muzzle-pistol.js";
import * as fxMuzzleShotgun from "../pixelfx-main/src/fx/projectiles/muzzle-shotgun.js";
import * as fxSlash from "../pixelfx-main/src/fx/melee/sword-slash.js";
import * as fxBlinkIn from "../pixelfx-main/src/fx/arcane/blink-in.js";
import * as fxManaBurst from "../pixelfx-main/src/fx/arcane/mana-burst.js";
import * as fxExplosion from "../pixelfx-main/src/fx/explosions/small-explosion.js";
import * as fxPlasma from "../pixelfx-main/src/fx/explosions/plasma-explosion.js";
import * as fxIceShatter from "../pixelfx-main/src/fx/ice/ice-shatter.js";
import * as fxParry from "../pixelfx-main/src/fx/impacts/parry.js";
import * as fxChestOpen from "../pixelfx-main/src/fx/pickups/chest-open.js";
import * as fxSlime from "../pixelfx-main/src/fx/critters/slime.js";
import * as fxBat from "../pixelfx-main/src/fx/critters/bat.js";
import * as fxGhost from "../pixelfx-main/src/fx/critters/ghost.js";
import * as fxLightning from "../pixelfx-main/src/fx/lightning/lightning-strike.js";
import * as fxZap from "../pixelfx-main/src/fx/lightning/zap-hit.js";
import * as fxFrostNova from "../pixelfx-main/src/fx/ice/frost-nova.js";
import * as fxSnowflake from "../pixelfx-main/src/fx/ice/snowflake-burst.js";
import * as fxIceSpikes from "../pixelfx-main/src/fx/ice/ice-spikes.js";
// --- bản 3.0: hiệu ứng cho nhân vật / vũ khí / quái / bản đồ mới ---
import * as fxMeteor from "../pixelfx-main/src/fx/fire/meteor.js";
import * as fxHolyPillar from "../pixelfx-main/src/fx/holy/holy-pillar.js";
import * as fxDivineShield from "../pixelfx-main/src/fx/holy/divine-shield.js";
import * as fxHealAoe from "../pixelfx-main/src/fx/holy/heal-aoe.js";
import * as fxHammer from "../pixelfx-main/src/fx/melee/hammer-smash.js";
import * as fxScythe from "../pixelfx-main/src/fx/melee/scythe-reap.js";
import * as fxSpinSlash from "../pixelfx-main/src/fx/melee/spin-slash.js";
import * as fxDarkExplosion from "../pixelfx-main/src/fx/shadow/dark-explosion.js";
import * as fxGrasp from "../pixelfx-main/src/fx/shadow/grasping-hands.js";
import * as fxCrit from "../pixelfx-main/src/fx/impacts/crit-hit.js";
import * as fxSlam from "../pixelfx-main/src/fx/impacts/ground-slam.js";
import * as fxAcid from "../pixelfx-main/src/fx/nature/acid-splash.js";
import * as fxPortal from "../pixelfx-main/src/fx/spawn/spawn-portal.js";
import * as fxLevelUp from "../pixelfx-main/src/fx/ui/level-up.js";
import * as fxEyeball from "../pixelfx-main/src/fx/critters/eyeball.js";
import * as fxSkull from "../pixelfx-main/src/fx/critters/flying-skull.js";
import * as fxFrog from "../pixelfx-main/src/fx/critters/frog.js";
import * as fxSnake from "../pixelfx-main/src/fx/critters/snake.js";
import * as fxWisp from "../pixelfx-main/src/fx/critters/wisp.js";
import { CHARACTERS } from "./characters.js";
import { WEAPONS } from "./src/weapons.js";

/** Số hiệu ứng tối đa cùng lúc trên màn hình. Đầy thì hiệu ứng cũ / ít quan trọng nhất bị thay thế. */
export const MAX_EFFECTS = 150;

const ICE = ["#151a3d", "#212f6b", "#2c58aa", "#3a8bd8", "#62c8f4", "#a6ecff", "#ffffff"];
const GOLD = ["#3b1d2a", "#7a3a2c", "#c4652e", "#f0a040", "#ffd25e", "#fff0a0", "#fffbe0", "#ffffff"];
const NECRO = ["#04100e", "#0a2a24", "#0f4a3a", "#16805f", "#45c4a0", "#9af0c8", "#ffffff"];
const MONK_SLASH = CHARACTERS.find((c) => c.id === "monk")?.weapon.slashPalette;
const SWORD_SLASH = WEAPONS.sword.slashPalette;

// =====================================================================================
//  HIỆU ỨNG (EffectManager)
//    bake   : cách chụp từ pixelfx { fps, maxTime (cắt đuôi, giây), variants (số hàng) }
//    play   : cách phát trong game
//             rotate   — xoay theo hướng bắn/đánh (tia lửa nòng, vệt chém, tia lửa trúng đòn)
//             layer    — "under" vẽ dưới chân nhân vật (bụi), mặc định vẽ đè lên trên
//             priority — 0..3: khi đủ MAX_EFFECTS, hiệu ứng ưu tiên thấp bị thay trước
// =====================================================================================
export const EFFECTS = {
  // --- Tia lửa đầu nòng (muzzle flash) ---
  muzzle:        { src: "assets/images/fx/muzzle.png",         pixelfx: fxMuzzle,        options: { height: 0 }, bake: { fps: 30, maxTime: 0.8, variants: 2 }, play: { rotate: true, priority: 1 } },
  muzzleShotgun: { src: "assets/images/fx/muzzle-shotgun.png", pixelfx: fxMuzzleShotgun, options: { height: 0 }, bake: { fps: 30, maxTime: 1.0 },              play: { rotate: true, priority: 2 } },
  // --- Vệt chém cận chiến ---
  slash:         { src: "assets/images/fx/slash.png",          pixelfx: fxSlash, options: { radius: 30 },                         bake: { fps: 30, maxTime: 0.6 }, play: { rotate: true, priority: 2 } },
  slashFist:     { src: "assets/images/fx/slash-fist.png",     pixelfx: fxSlash, options: { radius: 28, palette: MONK_SLASH },    bake: { fps: 30, maxTime: 0.6 }, play: { rotate: true, priority: 2 } },
  slashSword:    { src: "assets/images/fx/slash-sword.png",    pixelfx: fxSlash, options: { radius: 41, palette: SWORD_SLASH },   bake: { fps: 30, maxTime: 0.6 }, play: { rotate: true, priority: 2 } },
  // --- Trúng đòn ---
  hit:           { src: "assets/images/fx/hit.png",            pixelfx: fxHitSpark, options: { height: 0 }, bake: { fps: 30, variants: 3 }, play: { rotate: true, priority: 1 } },
  iceHit:        { src: "assets/images/fx/ice-hit.png",        pixelfx: fxHitSpark, options: { height: 0, palette: ICE }, bake: { fps: 30, variants: 2 }, play: { rotate: true, priority: 1 } },
  parry:         { src: "assets/images/fx/parry.png",          pixelfx: fxParry,    options: { height: 0 }, bake: { fps: 30, maxTime: 0.6 }, play: { priority: 1 } },
  // --- Bụi chân khi chạy (vẽ tay, không có trong pixelfx) ---
  dust:          { src: "assets/images/fx/dust.png",           custom: "dust", play: { layer: "under", priority: 0 } },
  // --- Quái chết: tan biến / nổ ---
  death:         { src: "assets/images/fx/death.png",          pixelfx: fxPoof, bake: { fps: 24, maxTime: 1.1, variants: 2 }, play: { priority: 2 } },
  explosion:     { src: "assets/images/fx/explosion.png",      pixelfx: fxExplosion, options: { size: 0.8 },  bake: { fps: 20, maxTime: 2.0 }, play: { priority: 3 } },
  explosionSmall:{ src: "assets/images/fx/explosion-small.png",pixelfx: fxExplosion, options: { size: 0.45 }, bake: { fps: 20, maxTime: 1.6 }, play: { priority: 3 } },
  plasma:        { src: "assets/images/fx/plasma.png",         pixelfx: fxPlasma, bake: { fps: 20 }, play: { priority: 3 } },
  iceShatter:    { src: "assets/images/fx/ice-shatter.png",    pixelfx: fxIceShatter, bake: { fps: 24, maxTime: 1.6 }, play: { rotate: true, priority: 3 } },
  // --- Đòn đánh thường Thanh Xuân: cụm gai băng mọc lên dọc đường băng (pixelfx ice/ice-spikes, rút ngắn tầm) ---
  iceSpikes:     { src: "assets/images/fx/ice-spikes.png",     pixelfx: fxIceSpikes, options: { reach: 64, height: 48 }, bake: { fps: 20, maxTime: 1.2, variants: 2 }, play: { priority: 1 } },
  // --- Tuyệt chiêu Ngại Ngùng (Thanh Xuân): băng + sét ---
  frostNova:     { src: "assets/images/fx/frost-nova.png",     pixelfx: fxFrostNova, bake: { fps: 18, maxTime: 1.3 }, play: { priority: 3 } },
  lightning:     { src: "assets/images/fx/lightning.png",      pixelfx: fxLightning, bake: { fps: 18, maxTime: 0.75, variants: 2 }, play: { priority: 3 } },
  zap:           { src: "assets/images/fx/zap.png",            pixelfx: fxZap, bake: { fps: 24 }, play: { priority: 2 } },
  freezeBurst:   { src: "assets/images/fx/freeze-burst.png",   pixelfx: fxSnowflake, options: { count: 6 }, bake: { fps: 20, maxTime: 0.9 }, play: { priority: 1 } },
  // --- Kỹ năng / khác ---
  spawn:         { src: "assets/images/fx/spawn.png",          pixelfx: fxBlinkIn, bake: { fps: 24, maxTime: 1.0 }, play: { priority: 0 } },
  nova:          { src: "assets/images/fx/nova.png",           pixelfx: fxManaBurst, bake: { fps: 20 }, play: { priority: 3 } },
  chestWood:     { src: "assets/images/fx/chest-wood.png",     pixelfx: fxChestOpen, options: { wood: ["#110a10", "#24131a", "#3a1f1f", "#552d24", "#73402c", "#925737", "#b07246"], coins: 8 },  bake: { fps: 15, maxTime: 2.4 }, play: { priority: 3 } },
  chestSilver:   { src: "assets/images/fx/chest-silver.png",   pixelfx: fxChestOpen, options: { wood: ["#10141e", "#232a3c", "#323a50", "#465068", "#6c7792", "#8492aa", "#b4bfd0"], coins: 8 },  bake: { fps: 15, maxTime: 2.4 }, play: { priority: 3 } },
  chestGold:     { src: "assets/images/fx/chest-gold.png",     pixelfx: fxChestOpen, options: { wood: ["#1e1206", "#4a2c08", "#86520c", "#c48412", "#f0b424", "#ffe066", "#fff6c4"], coins: 16 }, bake: { fps: 15, maxTime: 2.4 }, play: { priority: 3 } },
  // ---------------- BẢN 3.0 ----------------
  // Trượng Thiên Thạch + sự kiện Mưa Thiên Thạch (thiên thạch chạm đất ở giây ~METEOR_IMPACT)
  meteor:        { src: "assets/images/fx/meteor.png",         pixelfx: fxMeteor, bake: { fps: 14, maxTime: 1.8 }, play: { priority: 3 } },
  // Thánh Kỵ Sĩ: cột sáng, khiên vàng (lặp), búa nện; vòng hồi máu
  holyPillar:    { src: "assets/images/fx/holy-pillar.png",    pixelfx: fxHolyPillar, bake: { fps: 14, maxTime: 1.6 }, play: { priority: 3 } },
  divineShield:  { src: "assets/images/fx/divine-shield.png",  pixelfx: fxDivineShield, options: { radius: 18 }, bake: { fps: 12 }, play: { priority: 3 } },
  healRing:      { src: "assets/images/fx/heal-ring.png",      pixelfx: fxHealAoe, bake: { fps: 12, maxTime: 1.7 }, play: { priority: 2 } },
  hammer:        { src: "assets/images/fx/hammer.png",         pixelfx: fxHammer, options: { palette: GOLD }, bake: { fps: 20, maxTime: 0.9 }, play: { rotate: true, priority: 2 } },
  // Lưỡi Hái, Ảnh Sát (ninja)
  scythe:        { src: "assets/images/fx/scythe.png",         pixelfx: fxScythe, bake: { fps: 20, maxTime: 1.0 }, play: { rotate: true, priority: 2 } },
  spinSlash:     { src: "assets/images/fx/spin-slash.png",     pixelfx: fxSpinSlash, options: { palette: ["#2a0510", "#5c0a1c", "#a3142a", "#e0302c", "#ff7a6a", "#ffd0cc", "#ffffff"] }, bake: { fps: 24 }, play: { priority: 2 } },
  // Nổ bóng tối (vong linh nổ, Boss gục), chí mạng, Vua Slime đáp đất, mây axit, cổng triệu hồi, bàn tay ma
  darkExplosion: { src: "assets/images/fx/dark-explosion.png", pixelfx: fxDarkExplosion, bake: { fps: 14, maxTime: 1.4 }, play: { priority: 3 } },
  crit:          { src: "assets/images/fx/crit.png",           pixelfx: fxCrit, options: { height: 0 }, bake: { fps: 24 }, play: { rotate: true, priority: 2 } },
  slam:          { src: "assets/images/fx/slam.png",           pixelfx: fxSlam, bake: { fps: 14, maxTime: 1.3 }, play: { priority: 3 } },
  acidSplash:    { src: "assets/images/fx/acid-splash.png",    pixelfx: fxAcid, bake: { fps: 16, maxTime: 1.3 }, play: { priority: 2 } },
  portal:        { src: "assets/images/fx/portal.png",         pixelfx: fxPortal, bake: { fps: 12, maxTime: 1.8 }, play: { priority: 2 } },
  grasp:         { src: "assets/images/fx/grasp.png",          pixelfx: fxGrasp, bake: { fps: 14, maxTime: 1.7 }, play: { priority: 2 } },
  levelUp:       { src: "assets/images/fx/level-up.png",       pixelfx: fxLevelUp, bake: { fps: 12, maxTime: 2.0 }, play: { priority: 3 } },
};

// =====================================================================================
//  NHÂN VẬT & QUÁI (AnimationController)
//    kind "chibi"   — nhân vật đầu to kiểu Soul Knight vẽ bằng code (src/chibi.js): 3 hàng idle / run / skill
//    kind "sheet"   — SPRITESHEET CỦA BẠN (khối `spritesheet` trong characters.js, ví dụ Thanh Xuân)
//    kind "critter" — quái pixelfx lặp (Slime, Dơi, Ma): 1 hàng "move"
//    kind "hero"    — người pixel cao gầy kiểu cũ (bộ xương pixelfx), vẫn dùng được nếu muốn
//
//  >>> DÙNG SPRITESHEET CỦA BẠN: src, frameW / frameH (hoặc cols / rows), anchorX / anchorY (vị trí CHÂN trong 1 ô),
//      hand: [x, y] (tay cầm vũ khí, tính từ chân, nhân vật quay sang PHẢI)
//      và anims: { idle: { row: 0, frames: 4, fps: 6 }, run: { row: 1, frames: 8, fps: 12 }, skill: { row: 2, frames: 4, fps: 12 } }
//      (thêm seq: [0, 1, 2, 1] nếu muốn phát các cột theo thứ tự riêng)
// =====================================================================================
/** Ngoại hình chibi của quái hình người */
export const LOOKS = {
  archer: { head: "skull", skin: "#f4f0e0", accent: "#3a3040", outfit: "#4c4638", outfit2: "#d8d2bc", pants: "#d8d2bc", shoes: "#6e6654", chest: "#d8d2bc" },
  knight: { head: "helm", helm: "#9aa6be", eyes: "#ffd34a", outfit: "#6c7792", outfit2: "#8492aa", belt: "#8a5a2a", pants: "#465068", shoes: "#232a3c", chest: "#8a2a2a" },
};
export const BOSS_PALETTE = ["#140a24", "#2c1450", "#4c2488", "#7a3cc8", "#a874f0", "#d8b8ff", "#ffffff"];
/** Pháp Sư Xương (quái triệu hồi) */
LOOKS.shaman = { head: "wizard", hair: "#e8e8e8", accent: "#2a2438", accent2: "#7cf0a0", skin: "#c8d8c0", outfit: "#3a3048", outfit2: "#4a3c5c", robe: true, belt: "#7cf0a0", shoes: "#1a1420", eyes: "#ff3030" };

// ---------------- ZOMBIE (chế độ Nhảy Dù – Rút Quân) ----------------
//  head: "zombie" = da bệnh hoạn + 1 mắt đỏ + hốc mắt tối + miệng toạc · arms: "reach" = 2 tay giơ thẳng · belly = bụng phình
/** Zombie Thường: áo sơ mi rách, quần jean */
LOOKS.zWalker  = { head: "zombie", skin: "#8fa088", hair: "#3a3228", eyes: "#ff2a2a", arms: "reach", armSkin: true, outfit: "#b8b2a0", outfit2: "#9c9684", pants: "#3a5a8a", shoes: "#2a2a30", belt: "#5a4630", chest: "#7a2a2a" };
/** Zombie Chạy Nhanh: gầy, áo thể thao đỏ, mắt đỏ rực */
LOOKS.zRunner  = { head: "zombie", skin: "#7e9680", hair: "#1e1a18", eyes: "#ff5a3a", arms: "reach", armSkin: true, outfit: "#c8302e", outfit2: "#a82424", pants: "#2a2e3a", shoes: "#e8e8e8", chest: "#f0f0f0" };
/** Zombie Phun Độc: bụng phình xanh độc, da vàng úa */
LOOKS.zBloater = { head: "zombie", skin: "#b8b060", hair: "#4a4228", eyes: "#9cff4a", arms: "reach", armSkin: true, outfit: "#5a6a3a", outfit2: "#4a5a30", pants: "#4a4a34", shoes: "#2a2618", belly: "#6cd040" };
/** Zombie Đột Biến (Boss): da tím-xanh, u bướu */
LOOKS.zBoss    = { head: "zombie", skin: "#5a6aa8", hair: "#1c1430", eyes: "#ffe04a", arms: "reach", armSkin: true, outfit: "#3a2a5a", outfit2: "#4a3a7a", pants: "#241a3a", shoes: "#14101e", belly: "#8a46c8", chest: "#46e0a0" };

export const ACTORS = {
  // các nhân vật chơi được (ngoại hình chibi lấy từ khối `chibi` trong characters.js)
  ...Object.fromEntries(CHARACTERS.map((c) => [c.id, c.spritesheet
    ? { kind: "sheet", ...c.spritesheet }
    : { kind: "chibi", src: `assets/images/actors/${c.id}.png`, look: c.chibi }])),
  // skin phụ của nhân vật (khối `skins` trong characters.js): tên "<id>#1", "<id>#2"...
  ...Object.fromEntries(CHARACTERS.flatMap((c) => (c.spritesheet && c.skins ? c.skins : []).map((sk, i) => [`${c.id}#${i + 1}`, { kind: "sheet", ...c.spritesheet, ...sk }]))),
  archer: { kind: "chibi", src: "assets/images/actors/archer.png", look: LOOKS.archer },
  knight: { kind: "chibi", src: "assets/images/actors/knight.png", look: LOOKS.knight },
  slime:  { kind: "critter", src: "assets/images/actors/slime.png", pixelfx: fxSlime, options: { hop: 8 },   bake: { fps: 20 } },
  bat:    { kind: "critter", src: "assets/images/actors/bat.png",   pixelfx: fxBat,   options: {},          bake: { fps: 20 } },
  ghost:  { kind: "critter", src: "assets/images/actors/ghost.png", pixelfx: fxGhost, options: { hover: 6 }, bake: { fps: 20 } },
  boss:   { kind: "critter", src: "assets/images/actors/boss.png",  pixelfx: fxGhost, options: { hover: 6, palette: BOSS_PALETTE }, bake: { fps: 20 } },
  // ---------------- QUÁI & BOSS MỚI (bản 3.0) ----------------
  shaman:    { kind: "chibi",   src: "assets/images/actors/shaman.png",     look: LOOKS.shaman },
  eyeball:   { kind: "critter", src: "assets/images/actors/eyeball.png",    pixelfx: fxEyeball, options: { hover: 10 }, bake: { fps: 16 } },
  skull:     { kind: "critter", src: "assets/images/actors/skull.png",      pixelfx: fxSkull,   options: { hover: 8 },  bake: { fps: 16 } },
  frog:      { kind: "critter", src: "assets/images/actors/frog.png",       pixelfx: fxFrog,    options: {},            bake: { fps: 16 } },
  snake:     { kind: "critter", src: "assets/images/actors/snake.png",      pixelfx: fxSnake,   options: {},            bake: { fps: 16 } },
  slimeKing: { kind: "critter", src: "assets/images/actors/slime-king.png", pixelfx: fxSlime,   options: { hop: 8, palette: ["#1a0610", "#3a0c1e", "#6a1430", "#a82a3a", "#e0504a", "#ffa070", "#fff0d0"] }, bake: { fps: 16 } },
  skullLord: { kind: "critter", src: "assets/images/actors/skull-lord.png", pixelfx: fxSkull,   options: { hover: 8, palette: ["#120a33", "#2a1b78", "#4630c0", "#5a62f0", "#58a6ff", "#9ed8ff", "#c8f0ff", "#e4f6ff", "#ffffff"] }, bake: { fps: 16 } },
  eyeLord:   { kind: "critter", src: "assets/images/actors/eye-lord.png",   pixelfx: fxEyeball, options: { hover: 10, iris: ["#2a0408", "#6a0c14", "#b01a20", "#f04a3a", "#ffd0a0"] }, bake: { fps: 16 } },
  // ---------------- ZOMBIE ----------------
  // >>> ẢNH ZOMBIE: thay file PNG này bằng spritesheet của bạn (3 hàng idle/run/skill, ô 40x44, chân ở (20,42)) — xóa file thì game tự vẽ lại
  zWalker:  { kind: "chibi", src: "assets/images/actors/zombie-walker.png",  look: LOOKS.zWalker },
  // >>> ẢNH ZOMBIE: thay file PNG này bằng spritesheet của bạn (3 hàng idle/run/skill, ô 40x44, chân ở (20,42)) — xóa file thì game tự vẽ lại
  zRunner:  { kind: "chibi", src: "assets/images/actors/zombie-runner.png",  look: LOOKS.zRunner },
  // >>> ẢNH ZOMBIE: thay file PNG này bằng spritesheet của bạn (3 hàng idle/run/skill, ô 40x44, chân ở (20,42)) — xóa file thì game tự vẽ lại
  zBloater: { kind: "chibi", src: "assets/images/actors/zombie-bloater.png", look: LOOKS.zBloater },
  // >>> ẢNH ZOMBIE: thay file PNG này bằng spritesheet của bạn (3 hàng idle/run/skill, ô 40x44, chân ở (20,42)) — xóa file thì game tự vẽ lại
  zBoss:    { kind: "chibi", src: "assets/images/actors/zombie-boss.png",    look: LOOKS.zBoss },
  // vong linh của Tử Linh Sư
  spirit:    { kind: "critter", src: "assets/images/actors/spirit.png",     pixelfx: fxWisp,    options: { hover: 6, palette: NECRO }, bake: { fps: 16 } },
};

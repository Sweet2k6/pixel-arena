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
import { CHARACTERS } from "./characters.js";
import { WEAPONS } from "./src/weapons.js";

/** Số hiệu ứng tối đa cùng lúc trên màn hình. Đầy thì hiệu ứng cũ / ít quan trọng nhất bị thay thế. */
export const MAX_EFFECTS = 150;

const ICE = ["#151a3d", "#212f6b", "#2c58aa", "#3a8bd8", "#62c8f4", "#a6ecff", "#ffffff"];
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

export const ACTORS = {
  // 3 nhân vật chơi được (ngoại hình lấy từ khối `fallback` trong characters.js)
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
};

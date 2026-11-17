#!/usr/bin/env node
// =====================================================================================
//  XUẤT SPRITESHEET PNG TỪ PIXELFX  (chạy 1 lần trên máy, cần Node.js 18+)
//
//     node game/tools/bake-sprites.mjs            xuất tất cả
//     node game/tools/bake-sprites.mjs hit death  chỉ xuất vài mục (tên trong fx-config.js)
//
//  Đọc game/fx-config.js -> nướng từng hiệu ứng / nhân vật -> ghi:
//     game/assets/images/fx/*.png, game/assets/images/actors/*.png
//     game/src/fx-atlas.generated.js   (kích thước ô, số cột/hàng, điểm gốc... game đọc file này)
//  Mục nào có `src` là ảnh của BẠN (không nằm trong assets/images/fx|actors) thì bỏ qua, không ghi đè.
// =====================================================================================
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { deflateSync } from "node:zlib";

const GAME = join(dirname(fileURLToPath(import.meta.url)), "..");
const { EFFECTS, ACTORS } = await import(pathToFileURL(join(GAME, "fx-config.js")).href);
const { bakeEffect, bakeDust, bakeHero } = await import(pathToFileURL(join(GAME, "src", "fxbake.js")).href);
const { bakeChibi } = await import(pathToFileURL(join(GAME, "src", "chibi.js")).href);
const ATLAS_FILE = join(GAME, "src", "fx-atlas.generated.js");

// ---------- PNG (RGBA 8 bit) — theo pixelfx-main/tools/lib/png.mjs, MIT License ----------
const CRC = new Int32Array(256);
for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; CRC[n] = c; }
const crc32 = (buf) => { let c = -1; for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4), body = Buffer.concat([Buffer.from(type, "ascii"), data]), crc = Buffer.alloc(4);
  len.writeUInt32BE(data.length); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function encodePNG(w, h, rgba) {
  const stride = w * 4, raw = Buffer.alloc((stride + 1) * h), src = Buffer.from(rgba.buffer, rgba.byteOffset, rgba.byteLength);
  for (let y = 0; y < h; y++) {
    const o = y * (stride + 1);
    raw[o] = 1;
    for (let x = 0; x < stride; x++) raw[o + 1 + x] = (src[y * stride + x] - (x >= 4 ? src[y * stride + x - 4] : 0)) & 255;
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}

// ---------- đọc atlas cũ (để chỉ xuất lại vài mục mà không mất các mục khác) ----------
let atlas = {};
if (existsSync(ATLAS_FILE)) {
  const m = readFileSync(ATLAS_FILE, "utf8").match(/export const ATLAS = (\{[\s\S]*\});/);
  if (m) atlas = JSON.parse(m[1]);
}

const only = new Set(process.argv.slice(2));
const ours = (src) => /^assets\/images\/(fx|actors)\//.test(src ?? "");
const t0 = performance.now();
let bytes = 0;

function save(key, src, sheet, extra = {}) {
  const file = join(GAME, src);
  mkdirSync(dirname(file), { recursive: true });
  const png = encodePNG(sheet.width, sheet.height, sheet.rgba);
  writeFileSync(file, png);
  bytes += png.length;
  const { rgba, width, height, ...geo } = sheet;
  atlas[key] = { src, width, height, ...geo, ...extra };
  console.log(`  ${key.padEnd(22)} ${String(sheet.cols).padStart(2)} cột x ${sheet.rows} hàng · ô ${sheet.frameW}x${sheet.frameH} · ${(png.length / 1024).toFixed(1)} KB`);
}

console.log("Hiệu ứng:");
for (const [name, cfg] of Object.entries(EFFECTS)) {
  if (only.size && !only.has(name)) continue;
  if (!ours(cfg.src)) { console.log(`  ${name}: dùng ảnh riêng (${cfg.src || "trống"}) — bỏ qua`); continue; }
  const sheet = cfg.custom === "dust" ? bakeDust() : bakeEffect(cfg.pixelfx, { options: cfg.options, ...(cfg.bake ?? {}) });
  save(`fx:${name}`, cfg.src, sheet);
}
console.log("Nhân vật & quái:");
for (const [name, cfg] of Object.entries(ACTORS)) {
  if (only.size && !only.has(name)) continue;
  if (cfg.kind === "sheet" || !ours(cfg.src)) { console.log(`  ${name}: dùng spritesheet riêng (${cfg.src || "trống"}) — bỏ qua`); continue; }
  if (cfg.kind === "chibi") save(`actor:${name}`, cfg.src, bakeChibi(cfg.look));
  else if (cfg.kind === "hero") save(`actor:${name}`, cfg.src, bakeHero(cfg.look));
  else {
    const s = bakeEffect(cfg.pixelfx, { options: cfg.options, ...(cfg.bake ?? {}) });
    save(`actor:${name}`, cfg.src, s, { anims: { move: { row: 0, frames: s.frames, fps: s.fps, loop: true } } });
  }
}

writeFileSync(ATLAS_FILE, `// FILE TỰ SINH bởi game/tools/bake-sprites.mjs — KHÔNG sửa tay (muốn chỉnh cột/hàng: sửa trong game/fx-config.js)
// Kích thước ô, số cột/hàng, điểm gốc của từng spritesheet đã xuất trong assets/images/fx và assets/images/actors.
export const ATLAS = ${JSON.stringify(atlas, null, 1)};
`);
console.log(`\nXong ${Object.keys(atlas).length} spritesheet · ${(bytes / 1024).toFixed(0)} KB PNG · ${((performance.now() - t0) / 1000).toFixed(1)}s`);

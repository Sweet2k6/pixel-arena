// =====================================================================================
//  NGƯỜI PIXEL (HERO2 của pixelfx) + HIỆU ỨNG "SỐNG"
//    makeActor() — mặt nạ dáng đứng của nhân vật, để hiệu ứng ôm theo thân (hào quang Cuồng Nộ)
//    LiveFx      — chạy 1 hiệu ứng pixelfx thật (không nướng) trong 1 khung NHỎ riêng; chỉ dùng cho hào quang
//                  bám theo nhân vật. Mọi hiệu ứng khác đã được nướng thành spritesheet (xem src/effects.js).
//  Hình nhân vật / quái trong trận nay là spritesheet có Idle / Run / Skill (src/fxbake.js -> bakeHero).
// =====================================================================================
import { stockActor, HERO2, hex, createFrame, clearFrame, composite, createFx, painterFor } from "../../pixelfx-main/src/core/index.js";
import { BODY_PAL_DEFAULT, HATS, lightenHex } from "./fxbake.js";

/** Tạo "actor" pixelfx: def = { fallback: { palette, hat, accent } } (giống khối nhân vật trong characters.js) */
export function makeActor(def) {
  const base = stockActor(2);
  const pal = { ...BODY_PAL_DEFAULT, ...(def.fallback?.palette ?? {}) };
  const pixels = new Uint32Array(base.mask.w * base.mask.h);
  HERO2.forEach((row, y) => [...row].forEach((c, x) => { if (c !== ".") pixels[y * base.mask.w + x] = hex(pal[c] ?? "#ff00ff"); }));
  const accent = def.fallback?.accent ?? "#ff4a3a";
  // (sửa lỗi cũ: lighten() trả về "rgb(...)" mà pixelfx chỉ đọc "#hex" -> màu sáng của mũ bị hỏng)
  const hatPal = { k: "#0e0c14", x: accent, y: lightenHex(accent, 0.45) };
  return { ...base, pixels, pal, hat: HATS[def.fallback?.hat] ?? null, hatPal };
}

/** Vẽ người pixel ĐỨNG YÊN vào painter pixelfx, chân tại (x, y). opts: { a, tint } */
export function drawHero(p, actor, x, y, flip, opts = {}) {
  p.place(Math.round(x), Math.round(y), flip, 0);
  p.sprite(HERO2, actor.pal, actor.x, actor.y, opts);
  if (actor.hat) p.sprite(actor.hat.rows, actor.hatPal, actor.hat.x, actor.hat.y, opts);
}

/**
 * Hiệu ứng pixelfx chạy trực tiếp trong khung nhỏ của riêng nó (kích thước meta.size, VD 80x80)
 * thay vì 1 khung toàn màn hình 480x270 -> rẻ hơn ~20 lần. Vẽ 2 lớp: "back" (sau lưng) và "front" (trước mặt).
 */
export class LiveFx {
  constructor(mod, opts = {}) {
    const [w, h] = mod.meta.size, [ox, oy] = mod.meta.origin;
    this.w = w; this.h = h; this.ox = ox; this.oy = oy;
    this.fx = createFx(mod, { ...opts, x: ox, y: oy });
    this.frame = createFrame(w, h);
    this.image = new ImageData(w, h);
    this.layers = { back: document.createElement("canvas"), front: document.createElement("canvas") };
    for (const c of Object.values(this.layers)) { c.width = w; c.height = h; }
    this.dirty = true;
  }
  get options() { return this.fx.options; }
  get t() { return this.fx.t; }
  update(dt) { this.fx.update(dt); this.dirty = true; }
  stop() { this.fx.stop(); }
  done() { return this.fx.done(); }
  /** Vẽ lại 2 lớp vào canvas nhỏ (1 lần / frame, chỉ khi có thay đổi) */
  render(flip = false) {
    if (!this.dirty && this.fx.options.flip === flip) return;
    this.fx.options.flip = flip;
    for (const layer of ["back", "front"]) {
      clearFrame(this.frame);
      this.fx.draw(this.frame, layer);
      composite(this.frame, this.image.data, null);
      this.layers[layer].getContext("2d").putImageData(this.image, 0, 0);
    }
    this.dirty = false;
  }
  /** Vẽ 1 lớp sao cho điểm gốc hiệu ứng nằm tại (x, y) — tọa độ thế giới */
  draw(c, x, y, layer) { c.drawImage(this.layers[layer], Math.round(x - this.ox), Math.round(y - this.oy)); }
}

export { painterFor };

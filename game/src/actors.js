// =====================================================================================
//  HÌNH NGƯỜI PIXEL (HERO2 của pixelfx) — dùng cho nhân vật khi chưa chèn ảnh,
//  và cho quái hình người (Cung Thủ Xương, Hiệp Sĩ Khiên)
// =====================================================================================
import { stockActor, HERO2, hex, createFrame, clearFrame, composite, painterFor } from "../../pixelfx-main/src/core/index.js";
import { lighten } from "./util.js";

// Bảng màu gốc của HERO2, tô lại bằng `fallback.palette`
const BODY_PAL_DEFAULT = { k: "#0e0c14", A: "#e4e6ec", B: "#b6b9c3", C: "#868995", D: "#5c5e6a", E: "#6e707c", F: "#4b4d58", G: "#34353f", J: "#2a2b33", m: "#f53cd1" };

// Phụ kiện trên đầu (gốc tọa độ = chân nhân vật, quay mặt sang phải). "x" = màu accent, "y" = accent sáng
const HATS = {
  plume: { x: -2, y: -42, rows: ["...yx", "..yxx", ".xxx.", "kxx..", ".k..."] },
  band: { x: -5, y: -37, rows: ["..xxxxxxxxx", "xxyyyyyyyyx", ".x.........", "x.........."] },
  wizard: { x: -6, y: -45, rows: ["........kk..", ".......kxk..", "......kxxk..", ".....kxxyk..", "....kxxxyxk.", "...kxxxxxxk.", "kkkkkkkkkkkkk", ".kyyyyyyyyyk."] },
  helm: { x: -6, y: -40, rows: ["...xxxxxx...", "..xyyyyyyx..", ".xyyyyyyyyx.", ".xx.xxxx.xx."] },
  hood: { x: -6, y: -40, rows: ["...kkkkkk...", "..kxxxxxxk..", ".kxxyyxxxxk.", ".kx......xk."] },
};

/** Tạo "actor" pixelfx: def = { fallback: { palette, hat, accent } } (giống khối nhân vật trong characters.js) */
export function makeActor(def) {
  const base = stockActor(2);
  const pal = { ...BODY_PAL_DEFAULT, ...(def.fallback?.palette ?? {}) };
  const pixels = new Uint32Array(base.mask.w * base.mask.h);
  HERO2.forEach((row, y) => [...row].forEach((c, x) => { if (c !== ".") pixels[y * base.mask.w + x] = hex(pal[c] ?? "#ff00ff"); }));
  const accent = def.fallback?.accent ?? "#ff4a3a";
  const hatPal = { k: "#0e0c14", x: accent, y: lighten(accent, 0.45) };
  return { ...base, pixels, pal, hat: HATS[def.fallback?.hat] ?? null, hatPal };
}

/** Vẽ người pixel vào painter pixelfx, chân tại (x, y) — TỌA ĐỘ MÀN HÌNH. opts: { a, tint } */
export function drawHero(p, actor, x, y, flip, opts = {}) {
  p.place(Math.round(x), Math.round(y), flip, 0);
  p.sprite(HERO2, actor.pal, actor.x, actor.y, opts);
  if (actor.hat) p.sprite(actor.hat.rows, actor.hatPal, actor.hat.x, actor.hat.y, opts);
}

/**
 * Vẽ hoạt ảnh pixelfx PHÓNG TO (Slime khổng lồ x1.6, Mini-Boss x2.2):
 * vẽ vào frame nhỏ riêng rồi drawImage phóng to lên canvas chính.
 */
export class ScaledAnim {
  constructor(anim, w, h, ox, oy) {
    this.anim = anim;
    this.w = w; this.h = h; this.ox = ox; this.oy = oy;  // ox, oy = vị trí chân trong frame nhỏ
    this.frame = createFrame(w, h);
    this.image = new ImageData(w, h);
    this.canvas = document.createElement("canvas");
    this.canvas.width = w; this.canvas.height = h;
    this.g = this.canvas.getContext("2d");
  }
  /** c = ctx đang ở hệ tọa độ thế giới; (x, y) = chân; s = tỉ lệ phóng; flash = chớp trắng */
  draw(c, x, y, s, flip, flash = false) {
    clearFrame(this.frame);
    Object.assign(this.anim.options, { x: this.ox, y: this.oy, flip });
    this.anim.draw(this.frame);
    composite(this.frame, this.image.data, null);
    this.g.putImageData(this.image, 0, 0);
    if (flash) {
      this.g.globalCompositeOperation = "source-atop";
      this.g.fillStyle = "rgba(255,255,255,0.85)";
      this.g.fillRect(0, 0, this.w, this.h);
      this.g.globalCompositeOperation = "source-over";
    }
    c.drawImage(this.canvas, Math.round(x - this.ox * s), Math.round(y - this.oy * s), Math.round(this.w * s), Math.round(this.h * s));
  }
}

export { painterFor };

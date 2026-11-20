// =====================================================================================
//  EFFECT MANAGER — phát hiệu ứng theo từng frame từ spritesheet, có Object Pool
//
//  play("hit", x, y, { aim })  -> lấy 1 ô trống trong pool (tối đa MAX_EFFECTS), chọn ngẫu nhiên 1 hàng (biến thể),
//  rồi mỗi frame chỉ việc tăng thời gian và drawImage đúng ô. Không `new`, không `.splice()`.
//  Tọa độ luôn là TỌA ĐỘ THẾ GIỚI; vẽ khi ctx đã dịch theo camera.
// =====================================================================================
import { SpriteSheet } from "./spritesheet.js";
import { createBaker } from "./fxbake.js";

/** Bảng màu số bay lên (tối -> sáng) */
const TEXT_PALETTES = {
  dmg:  ["#0c0c14", "#24243a", "#4a4a66", "#8a8aa8", "#c4c4d8", "#e4e4f0", "#f6f6ff", "#ffffff"],   // sát thương thường: TRẮNG
  crit: ["#2a0404", "#6a0a0a", "#b01a14", "#e8401a", "#ff8a2a", "#ffd34a", "#fff2a8", "#ffffff"],   // CHÍ MẠNG: vàng -> đỏ, to hơn
  heal: ["#04140a", "#0a3a1a", "#147a30", "#2fb84a", "#6aec6a", "#b0ffb0", "#e8ffe8", "#ffffff"],
};

class Effect {
  constructor() { this.active = false; }
  init(sheet, cfg, x, y, o, seq) {
    this.sheet = sheet;
    this.row = o.row ?? (sheet.rows > 1 ? (Math.random() * sheet.rows) | 0 : 0);
    this.x = x; this.y = y;
    this.aim = o.aim ?? 0;
    this.rotate = !!cfg.rotate && o.aim !== undefined;
    this.flip = !!o.flip;
    this.scale = o.scale ?? cfg.scale ?? 1;
    this.speed = o.speed ?? 1;
    this.layer = cfg.layer === "under" ? 0 : 1;
    this.priority = cfg.priority ?? 1;
    this.time = o.time ?? 0;  // bắt đầu giữa chừng (bỏ qua đoạn mở đầu)
    this.seq = seq;           // thứ tự tạo (để biết hiệu ứng nào cũ nhất)
    this.active = true;
    return this;
  }
}

export class EffectManager {
  constructor(max = 150) {
    this.max = max;
    this.items = Array.from({ length: max }, () => new Effect());   // pool cố định, tạo sẵn
    this.count = 0;            // các phần tử [0, count) đang chạy
    this.sheets = new Map();   // tên -> { sheet, cfg }
    this.seq = 0;
    this.dropped = 0;          // số hiệu ứng bị bỏ vì đầy (debug)
    this.textMod = null;       // module pixelfx cho số sát thương
    this.textCache = new Map();
    this.baking = [];          // số sát thương đang được nướng dần (mỗi frame vài ô)
  }

  /** Đăng ký 1 spritesheet cho tên hiệu ứng. cfg = phần `play` trong fx-config.js */
  register(name, sheet, cfg = {}) { this.sheets.set(name, { sheet, cfg }); }
  has(name) { return this.sheets.has(name); }

  /**
   * Phát hiệu ứng `name` tại (x, y). o: { aim (radian — xoay theo hướng), flip, scale, row (chọn biến thể), speed }
   * Trả về hiệu ứng (hoặc null nếu bị bỏ do đầy và toàn hiệu ứng quan trọng hơn).
   */
  play(name, x, y, o = {}) {
    const entry = this.sheets.get(name);
    if (!entry) return null;
    return this.spawn(entry.sheet, entry.cfg, x, y, o);
  }

  spawn(sheet, cfg, x, y, o = {}) {
    let fx;
    if (this.count < this.max) fx = this.items[this.count++];
    else {
      // Đầy MAX_EFFECTS: thay hiệu ứng cũ nhất có độ ưu tiên thấp nhất (không cao hơn hiệu ứng mới)
      const pr = cfg.priority ?? 1;
      let best = -1, bp = Infinity, bs = Infinity;
      for (let i = 0; i < this.count; i++) {
        const e = this.items[i];
        if (e.priority > pr) continue;
        if (e.priority < bp || (e.priority === bp && e.seq < bs)) { best = i; bp = e.priority; bs = e.seq; }
      }
      if (best < 0) { this.dropped++; return null; }
      fx = this.items[best];
    }
    return fx.init(sheet, cfg, x, y, o, this.seq++);
  }

  /**
   * Số sát thương bay lên (pixelfx ui/damage-number). Mỗi chữ khác nhau ("-1", "-2.5"...) được nướng 1 lần rồi lưu lại.
   * Nướng cả hiệu ứng 1 lúc tốn ~20ms (khựng 1 frame) nên ở đây nướng DẦN: mỗi frame game nướng trước vài ô,
   * luôn nhanh hơn tốc độ phát -> số hiện ra ngay mà không khựng.
   */
  text(str, x, y, style = "dmg", scale = 1) {
    if (!this.textMod) return null;
    let entry = this.textCache.get(`${style}|${str}`);
    if (!entry) entry = this.prepareText(str, false, style);
    return this.spawn(entry.sheet, entry.cfg, x, y, scale !== 1 ? { scale } : undefined);
  }

  /**
   * Chuẩn bị sheet cho 1 chuỗi (nướng dần). now = true: nướng xong ngay (dùng lúc màn hình tải)
   * style: "dmg" (trắng — sát thương thường) | "crit" (vàng/đỏ — CHÍ MẠNG) | "heal" (xanh lá — hồi máu)
   */
  prepareText(str, now = false, style = "dmg") {
    if (this.textCache.size > 160) { this.textCache.clear(); this.baking.length = 0; }
    const options = { text: str };
    if (TEXT_PALETTES[style]) options.palette = TEXT_PALETTES[style];
    const baker = createBaker(this.textMod, { options, fps: 30 });
    const canvas = document.createElement("canvas");
    canvas.width = baker.frameW * baker.frames; canvas.height = baker.frameH;
    const { frameW, frameH, cols, rows, frames, fps, anchorX, anchorY } = baker;
    const geo = { frameW, frameH, cols, rows, frames, fps, anchorX, anchorY, loop: false };
    const entry = { sheet: new SpriteSheet(canvas, geo, `text ${str}`), cfg: { priority: style === "dmg" ? 0 : 1 }, baker, g: canvas.getContext("2d") };
    this.textCache.set(`${style}|${str}`, entry);
    this.bakeStep(entry, now ? Infinity : 2);
    if (!baker.done) this.baking.push(entry);
    return entry;
  }

  bakeStep(entry, count) {
    const b = entry.baker;
    for (let k = 0; k < count && !b.done; k++) {
      const col = b.baked, rgba = b.next();
      entry.g.putImageData(new ImageData(rgba, b.frameW, b.frameH), col * b.frameW, 0);
    }
  }

  update(dt) {
    // nướng tiếp các số sát thương đang dở (3 ô / frame ~ 2ms, nhanh gấp 6 lần tốc độ phát 30fps ở game 60fps)
    for (let k = this.baking.length - 1; k >= 0; k--) {
      const e = this.baking[k];
      this.bakeStep(e, 3);
      if (e.baker.done) { this.baking[k] = this.baking[this.baking.length - 1]; this.baking.pop(); }
    }
    let i = 0;
    while (i < this.count) {
      const e = this.items[i];
      e.time += dt * e.speed;
      if (!e.sheet.loop && e.time * e.sheet.fps >= e.sheet.frames) {
        // xong: đổi chỗ với phần tử cuối (O(1), không splice)
        e.active = false;
        const last = this.items[--this.count];
        this.items[this.count] = e;
        this.items[i] = last;
        continue;
      }
      i++;
    }
  }

  /** layer: 0 = dưới chân (bụi), 1 = trên cùng. cam để bỏ qua hiệu ứng ngoài khung hình. */
  draw(ctx, cam, layer = 1) {
    for (let i = 0; i < this.count; i++) {
      const e = this.items[i];
      if (e.layer !== layer) continue;
      const s = e.sheet;
      const m = Math.max(s.frameW, s.frameH) * e.scale;
      if (cam && !cam.inView(e.x, e.y, m)) continue;
      let f = (e.time * s.fps) | 0;
      f = s.loop ? f % s.frames : Math.min(f, s.frames - 1);
      if (e.rotate) s.drawRotated(ctx, f, e.row, e.x, e.y, e.aim, e.scale);
      else s.draw(ctx, f, e.row, e.x, e.y, e.flip, e.scale);
    }
  }

  clear() {
    for (let i = 0; i < this.count; i++) this.items[i].active = false;
    this.count = 0;
  }
}

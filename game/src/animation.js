// =====================================================================================
//  HOẠT ẢNH NHÂN VẬT / QUÁI
//    AnimationController — máy trạng thái chạy theo deltaTime: Idle <-> Run <-> Skill
//    loadSprites()       — dựng toàn bộ spritesheet (hiệu ứng + nhân vật) từ PNG, thiếu PNG thì tự nướng từ pixelfx
// =====================================================================================
import { SpriteSheet, canvasFromRGBA } from "./spritesheet.js";
import { bakeEffect, bakeDust, bakeHero, HERO_FRAME } from "./fxbake.js";
import { bakeChibi } from "./chibi.js";
import { ATLAS } from "./fx-atlas.generated.js";

/**
 * Bộ điều khiển hoạt ảnh dựa trên deltaTime.
 *   anims: { idle: { row, frames, fps, loop, contact: [frame chạm đất], seq: [thứ tự cột] }, run: {...}, skill: {...} }
 * Dùng:  ctrl.set("run"); ctrl.update(dt, speedScale); sheet.draw(ctx, ctrl.frame, ctrl.row, x, y, flip)
 */
export class AnimationController {
  constructor(anims, initial = Object.keys(anims)[0]) {
    this.anims = anims;
    this.state = initial;
    this.time = 0;
    this.frame = 0;
    this.stepped = false;     // vừa chuyển sang frame mới trong lần update này
    this.contact = false;     // vừa tới frame "chân chạm đất" (để tung bụi)
  }
  get clip() { return this.anims[this.state] ?? this.anims[Object.keys(this.anims)[0]]; }
  get row() { return this.clip.row ?? 0; }
  /** Cột (frame) trong spritesheet đang hiển thị — theo `seq` nếu có */
  get col() { const c = this.clip; return c.seq ? c.seq[this.frame] : this.frame; }

  /** Chuyển trạng thái. Cùng trạng thái thì không làm gì (trừ khi restart). */
  set(state, restart = false) {
    if (!this.anims[state]) state = this.anims.idle ? "idle" : Object.keys(this.anims)[0];
    if (state === this.state && !restart) return;
    const prev = this.clip;
    this.state = state;
    // Idle <-> Run: giữ nhịp (pha) cho chuyển động liền mạch; vào Skill thì bắt đầu từ frame 0
    const next = this.clip;
    const phase = state === "skill" || restart ? 0 : (this.frame + 0.5) / Math.max(1, prev.frames);
    this.time = (phase * next.frames) / next.fps;
    this.frame = Math.min(next.frames - 1, (this.time * next.fps) | 0);
  }

  /** Cộng thời gian; speed = hệ số tốc độ phát (chạy nhanh -> bước chân nhanh) */
  update(dt, speed = 1) {
    const c = this.clip;
    if (c.seq && c.frames !== c.seq.length) c.frames = c.seq.length;
    this.time += dt * speed;
    let f = (this.time * c.fps) | 0;
    if (c.loop === false) f = Math.min(f, c.frames - 1);
    else f %= c.frames;
    this.stepped = f !== this.frame;
    this.contact = this.stepped && !!c.contact && c.contact.includes(f);
    this.frame = f;
  }

  /** Bắt đầu ở 1 thời điểm ngẫu nhiên (để bầy quái không nhún nhảy đồng loạt) */
  randomize() { const c = this.clip; this.time = Math.random() * (c.frames / c.fps); this.update(0); }
}

// =====================================================================================
//  DỰNG SPRITESHEET
// =====================================================================================
/** Lấy thông số đã xuất (ATLAS) + ghi đè bằng các trường bạn điền trong fx-config.js */
function geometryFor(key, cfg) {
  const gen = ATLAS[key];
  const own = {};
  for (const k of ["cols", "rows", "frameW", "frameH", "frames", "fps", "anchorX", "anchorY", "offsetX", "offsetY", "margin", "spacing", "loop", "anims", "hand", "hands"]) {
    if (cfg[k] !== undefined && cfg[k] !== null && cfg[k] !== 0) own[k] = cfg[k];
  }
  // ảnh của bạn (khác file đã xuất) -> không dùng số đo tự động nữa
  if (!gen || gen.src !== cfg.src) return own;
  return { ...gen, ...own };
}

/** Nướng lại từ pixelfx khi thiếu PNG (chậm hơn, chỉ là dự phòng) */
function bakeFallback(cfg, kind) {
  if (kind === "chibi") return bakeChibi(cfg.look);
  if (kind === "hero") return bakeHero(cfg.look);
  if (cfg.custom === "dust") return bakeDust();
  if (!cfg.pixelfx) return null;
  const s = bakeEffect(cfg.pixelfx, { options: cfg.options, ...(cfg.bake ?? {}) });
  if (kind === "critter") s.anims = { move: { row: 0, frames: s.frames, fps: s.fps, loop: true } };
  return s;
}

const nextTick = () => new Promise((r) => setTimeout(r, 0));

/**
 * Dựng tất cả spritesheet.
 *   images : ảnh đã tải (khóa "fx:<tên>" / "actor:<tên>")
 *   effects: EFFECTS trong fx-config.js · actors: ACTORS trong fx-config.js
 * Trả về { effects: Map(tên -> { sheet, cfg }), actors: Map(tên -> ActorSprite), baked: [tên các mục phải nướng lại] }
 */
export async function loadSprites(images, effects, actors, onProgress = () => {}) {
  const out = { effects: new Map(), actors: new Map(), baked: [] };
  const jobs = [...Object.entries(effects).map(([n, c]) => ["fx", n, c]), ...Object.entries(actors).map(([n, c]) => ["actor", n, c])];
  let done = 0;
  for (const [type, name, cfg] of jobs) {
    const key = `${type}:${name}`;
    const kind = type === "fx" ? "fx" : cfg.kind;
    let sheet = null, geo = null;
    const img = images[key];
    if (img) {
      geo = geometryFor(key, cfg);
      if (kind === "critter" && !geo.anims) geo.anims = { move: { row: 0, frames: geo.frames || geo.cols, fps: geo.fps ?? 20, loop: true } };
      sheet = new SpriteSheet(img, geo, key);
    } else {
      const s = bakeFallback(cfg, kind);
      if (s) {
        out.baked.push(key);
        geo = s;
        sheet = new SpriteSheet(canvasFromRGBA(s.rgba, s.width, s.height), s, key);
        await nextTick();   // nhường cho trình duyệt vẽ thanh tải
      }
    }
    if (sheet) {
      if (type === "fx") out.effects.set(name, { sheet, cfg: cfg.play ?? {} });
      else out.actors.set(name, new ActorSprite(name, sheet, geo, kind));
    }
    onProgress(++done / jobs.length);
  }
  if (out.baked.length) console.info(`[Sprites] Thiếu PNG, đã tự nướng lại từ pixelfx: ${out.baked.join(", ")}. Chạy "node game/tools/bake-sprites.mjs" để xuất file.`);
  return out;
}

/** Spritesheet của 1 nhân vật / quái + thông tin hoạt ảnh và vị trí tay cầm vũ khí */
export class ActorSprite {
  constructor(name, sheet, geo, kind) {
    this.name = name;
    this.sheet = sheet;
    this.kind = kind;
    // chép riêng cho mỗi nhân vật (không sửa vào cấu hình gốc)
    this.anims = Object.fromEntries(Object.entries(geo.anims ?? { idle: { row: 0, frames: sheet.frames, fps: sheet.fps || 8 } })
      .map(([k, a]) => [k, { ...a, frames: a.seq ? a.seq.length : a.frames ?? sheet.frames, fps: a.fps ?? 10, loop: a.loop !== false }]));
    this.hands = geo.hands ?? null;                 // hands[row][frame] = [x, y] tính từ chân
    this.hand = geo.hand ?? [7, -19];               // dùng khi không có bảng hands (ảnh của bạn)
  }
  controller() { return new AnimationController(this.anims, this.anims.idle ? "idle" : Object.keys(this.anims)[0]); }
  /** Vị trí tay cầm vũ khí (tính từ chân, nhân vật quay sang PHẢI) ở frame hiện tại */
  handAt(row, frame) { return this.hands?.[row]?.[frame] ?? this.hand; }
  get flash() { return this.sheet.tinted("#ffffff", 0.9); }
  /** Bản tô xanh băng (quái bị đóng băng) */
  get frozen() { return this.sheet.tinted("#9fe6ff", 0.55); }
  /** Bản tô đỏ (quái đang gồng đòn — cảnh báo người chơi) */
  get hot() { return this.sheet.tinted("#ff5a3a", 0.45); }

  /**
   * Dáng nhân vật (frame đứng yên đầu tiên) dưới dạng "actor" của pixelfx, để hiệu ứng ôm theo thân
   * (hào quang Cuồng Nộ). Đọc pixel từ ảnh 1 lần rồi lưu lại.
   */
  maskActor() {
    if (this._actor) return this._actor;
    const s = this.sheet, a = this.anims.idle ?? Object.values(this.anims)[0];
    const col = a.seq ? a.seq[0] : 0, row = a.row ?? 0;
    const c = document.createElement("canvas");
    c.width = s.frameW; c.height = s.frameH;
    const g = c.getContext("2d");
    g.drawImage(s.image, s.sx[col], s.sy[row], s.frameW, s.frameH, 0, 0, s.frameW, s.frameH);
    const px = new Uint32Array(g.getImageData(0, 0, s.frameW, s.frameH).data.buffer);
    let x0 = s.frameW, y0 = s.frameH, x1 = -1, y1 = -1;
    for (let y = 0; y < s.frameH; y++) for (let x = 0; x < s.frameW; x++) if (px[y * s.frameW + x] >>> 24) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    const w = x1 - x0 + 1, h = y1 - y0 + 1, data = new Uint8Array(w * h), pixels = new Uint32Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const v = px[(y + y0) * s.frameW + x + x0];
      if (v >>> 24) { data[y * w + x] = 1; pixels[y * w + x] = v | 0xff000000; }
    }
    const X = x0 - Math.round(s.anchorX), Y = y0 - Math.round(s.anchorY);
    this._actor = { mask: { w, h, data }, pixels, x: X, y: Y, w, h, k: 2, head: [0, Y], chest: [0, Y + Math.round(h * 0.55)] };
    return this._actor;
  }
}

export { HERO_FRAME };

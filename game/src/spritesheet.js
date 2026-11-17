// =====================================================================================
//  SPRITESHEET — cắt ảnh nhiều frame thành từng ô và vẽ nhanh bằng drawImage
//
//  Quy ước: mỗi CỘT là 1 frame theo thời gian, mỗi HÀNG là 1 biến thể / 1 hoạt ảnh.
//  Cấu hình cắt (geo):
//    cols, rows         số cột / số hàng          — HOẶC —   frameW, frameH  kích thước 1 ô (pixel)
//    frames             số frame dùng trong 1 hàng (mặc định = cols)
//    margin, spacing    lề ngoài ảnh & khoảng hở giữa các ô (pixel, mặc định 0)
//    anchorX, anchorY   điểm gốc trong 1 ô (pixel) — vị trí truyền vào draw(x, y) trùng điểm này. Mặc định giữa ô.
//    offsetX, offsetY   xê dịch thêm khi vẽ (sửa lệch)
// =====================================================================================

/** Tạo canvas từ mảng RGBA (dùng cho sheet tự nướng trong trình duyệt) */
export function canvasFromRGBA(rgba, w, h) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  c.getContext("2d").putImageData(new ImageData(rgba, w, h), 0, 0);
  return c;
}

/**
 * >>> HÀM CẮT FRAME <<<
 * Tính vị trí từng ô trong ảnh từ cấu hình cột/hàng hoặc kích thước ô. Báo lỗi ra Console (F12) nếu số đo không khớp ảnh.
 * Trả về geo đã chuẩn hóa: { frameW, frameH, cols, rows, frames, margin, spacing, anchorX, anchorY, offsetX, offsetY, ... }
 */
export function sliceSheet(imgW, imgH, cfg, name = "sheet") {
  const margin = cfg.margin ?? 0, spacing = cfg.spacing ?? 0;
  const innerW = imgW - margin * 2 + spacing, innerH = imgH - margin * 2 + spacing;
  let { cols, rows, frameW, frameH } = cfg;
  if (frameW) cols = cols || Math.floor(innerW / (frameW + spacing));
  else if (cols) frameW = (innerW - spacing * cols) / cols;
  if (frameH) rows = rows || Math.floor(innerH / (frameH + spacing));
  else if (rows) frameH = (innerH - spacing * rows) / rows;
  if (!cols || !frameW) { cols = 1; frameW = imgW - margin * 2; }
  if (!rows || !frameH) { rows = 1; frameH = imgH - margin * 2; }
  if (!Number.isInteger(frameW) || !Number.isInteger(frameH)) {
    console.warn(`[Spritesheet] "${name}": ảnh ${imgW}x${imgH} không chia đều cho ${cols} cột x ${rows} hàng ` +
      `(mỗi ô ${frameW.toFixed(2)}x${frameH.toFixed(2)}). Kiểm tra lại cols/rows hoặc điền frameW/frameH trong fx-config.js`);
    frameW = Math.floor(frameW); frameH = Math.floor(frameH);
  }
  const used = margin * 2 + cols * frameW + (cols - 1) * spacing;
  if (used > imgW + 0.5) console.warn(`[Spritesheet] "${name}": ${cols} cột x ${frameW}px vượt quá chiều rộng ảnh ${imgW}px`);
  return {
    ...cfg, cols, rows, frameW, frameH, margin, spacing,
    frames: Math.min(cfg.frames || cols, cols),
    anchorX: cfg.anchorX ?? frameW / 2, anchorY: cfg.anchorY ?? frameH / 2,
    offsetX: cfg.offsetX ?? 0, offsetY: cfg.offsetY ?? 0,
  };
}

export class SpriteSheet {
  /** image: HTMLImageElement | HTMLCanvasElement, geo: xem sliceSheet() */
  constructor(image, geo, name = "sheet") {
    this.image = image;
    this.name = name;
    Object.assign(this, sliceSheet(image.width, image.height, geo, name));
    this.fps = geo.fps ?? 24;
    this.loop = !!geo.loop;
    // bảng tọa độ nguồn của từng ô, tính sẵn 1 lần
    this.sx = new Int32Array(this.cols);
    this.sy = new Int32Array(this.rows);
    for (let c = 0; c < this.cols; c++) this.sx[c] = this.margin + c * (this.frameW + this.spacing);
    for (let r = 0; r < this.rows; r++) this.sy[r] = this.margin + r * (this.frameH + this.spacing);
    this.variants = new Map();   // bản tô màu (chớp trắng, bóng mờ) — tạo khi cần
  }

  /** Thời lượng 1 hàng (giây) */
  get duration() { return this.frames / this.fps; }

  /**
   * Vẽ ô (col, row) sao cho điểm gốc (anchor) nằm tại (x, y).
   * flipX: lật ngang quanh điểm gốc · scale: phóng to (nguyên hoặc lẻ)
   */
  draw(ctx, col, row, x, y, flipX = false, scale = 1) {
    const fw = this.frameW, fh = this.frameH;
    let ax = this.anchorX + this.offsetX, ay = this.anchorY + this.offsetY;
    if (!flipX) {
      ctx.drawImage(this.image, this.sx[col], this.sy[row], fw, fh, Math.round(x - ax * scale), Math.round(y - ay * scale), Math.round(fw * scale), Math.round(fh * scale));
      return;
    }
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.scale(-1, 1);
    ctx.drawImage(this.image, this.sx[col], this.sy[row], fw, fh, Math.round(-ax * scale), Math.round(-ay * scale), Math.round(fw * scale), Math.round(fh * scale));
    ctx.restore();
  }

  /**
   * Vẽ có xoay. Giống pixelfx: hiệu ứng mặc định hướng sang PHẢI; khi hướng sang trái thì lật ngang
   * rồi xoay phần còn lại, để vật rơi (vỏ đạn, tia lửa) vẫn rơi XUỐNG chứ không bị lộn ngược.
   */
  drawRotated(ctx, col, row, x, y, aim, scale = 1) {
    const left = Math.cos(aim) < 0;
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.rotate(left ? aim - Math.PI : aim);
    if (left) ctx.scale(-scale, scale); else if (scale !== 1) ctx.scale(scale, scale);
    ctx.drawImage(this.image, this.sx[col], this.sy[row], this.frameW, this.frameH,
      -(this.anchorX + this.offsetX), -(this.anchorY + this.offsetY), this.frameW, this.frameH);
    ctx.restore();
  }

  /**
   * Bản sao đã tô 1 màu (giữ nguyên độ trong suốt) — dùng cho chớp trắng khi trúng đòn, bóng mờ khi lướt.
   * Tạo 1 lần rồi lưu lại.
   */
  tinted(color, amount = 1) {
    const key = `${color}|${amount}`;
    let s = this.variants.get(key);
    if (s) return s;
    const c = document.createElement("canvas");
    c.width = this.image.width; c.height = this.image.height;
    const g = c.getContext("2d");
    g.drawImage(this.image, 0, 0);
    g.globalCompositeOperation = "source-atop";
    g.globalAlpha = amount;
    g.fillStyle = color;
    g.fillRect(0, 0, c.width, c.height);
    s = Object.create(SpriteSheet.prototype);
    Object.assign(s, this, { image: c, variants: new Map() });
    this.variants.set(key, s);
    return s;
  }
}

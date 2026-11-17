// =====================================================================================
//  LƯỚI KHÔNG GIAN (spatial hash) — tìm nhanh các quái ở gần 1 điểm
//
//  Thay vì so mỗi viên đạn với TẤT CẢ quái (300 đạn x 300 quái = 90.000 phép thử / frame),
//  bản đồ được chia thành ô vuông `cell` px; mỗi quái nằm trong 1 ô. Hỏi "ai ở gần (x, y)?"
//  chỉ cần xem vài ô xung quanh. Không tạo mảng mới mỗi frame (dùng lại các mảng ô).
// =====================================================================================

export class SpatialGrid {
  constructor(worldW, worldH, cell = 32) {
    this.cell = cell;
    this.cols = Math.ceil(worldW / cell);
    this.rows = Math.ceil(worldH / cell);
    this.cells = Array.from({ length: this.cols * this.rows }, () => []);
    this.used = [];            // các ô đang có quái (để xóa nhanh)
    this.result = [];          // mảng kết quả dùng chung cho query()
  }

  cellOf(x, y) {
    const cx = Math.min(this.cols - 1, Math.max(0, (x / this.cell) | 0));
    const cy = Math.min(this.rows - 1, Math.max(0, (y / this.cell) | 0));
    return cy * this.cols + cx;
  }

  /** Xếp lại toàn bộ danh sách vào lưới (gọi 1 lần / frame sau khi quái di chuyển). getX/getY: tâm thân */
  rebuild(list) {
    for (const i of this.used) this.cells[i].length = 0;
    this.used.length = 0;
    for (let k = 0; k < list.length; k++) {
      const e = list[k];
      e.gridId = k;
      if (e.dead) continue;
      const i = this.cellOf(e.cx, e.cy), c = this.cells[i];
      if (c.length === 0) this.used.push(i);
      c.push(e);
    }
  }

  /**
   * Các đối tượng có ô nằm trong hình vuông bán kính r quanh (x, y).
   * Trả về mảng dùng chung `this.result` (đọc xong trước khi gọi query lần nữa) — KHÔNG phải kiểm tra va chạm thật,
   * người gọi tự lọc bằng khoảng cách bình phương.
   */
  query(x, y, r, out = this.result) {
    out.length = 0;
    const c = this.cell;
    const x0 = Math.max(0, ((x - r) / c) | 0), x1 = Math.min(this.cols - 1, ((x + r) / c) | 0);
    const y0 = Math.max(0, ((y - r) / c) | 0), y1 = Math.min(this.rows - 1, ((y + r) / c) | 0);
    for (let cy = y0; cy <= y1; cy++) {
      const row = cy * this.cols;
      for (let cx = x0; cx <= x1; cx++) {
        const cellList = this.cells[row + cx];
        for (let k = 0; k < cellList.length; k++) out.push(cellList[k]);
      }
    }
    return out;
  }
}

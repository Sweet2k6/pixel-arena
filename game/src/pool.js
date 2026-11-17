// =====================================================================================
//  OBJECT POOL — tái sử dụng đối tượng thay vì `new` / `.splice()` / `.filter()` liên tục
//
//  Tạo mới hàng trăm viên đạn, quái, hiệu ứng mỗi giây khiến bộ dọn rác (GC) của trình duyệt
//  phải chạy thường xuyên -> khựng khung hình. Pool giữ lại đối tượng đã "chết" để lần sau dùng lại.
// =====================================================================================

export class Pool {
  /** create(): tạo 1 đối tượng trống. prewarm: số đối tượng tạo sẵn lúc đầu */
  constructor(create, prewarm = 0) {
    this.create = create;
    this.free = [];
    this.made = 0;   // tổng số đối tượng từng tạo (để theo dõi trong chế độ debug)
    for (let i = 0; i < prewarm; i++) { this.free.push(create()); this.made++; }
  }
  /** Lấy 1 đối tượng (dùng lại nếu có, không thì tạo mới). Nhớ gọi init/reset sau khi lấy. */
  obtain() {
    if (this.free.length) return this.free.pop();
    this.made++;
    return this.create();
  }
  /** Trả đối tượng về pool */
  release(o) { this.free.push(o); }
  get size() { return this.free.length; }
}

/**
 * Dọn mảng TẠI CHỖ (không tạo mảng mới như .filter): giữ lại phần tử còn sống, trả phần tử chết về pool.
 * isDead(o) mặc định là o.dead. Thứ tự các phần tử còn sống được giữ nguyên.
 */
export function sweep(list, pool = null, isDead = (o) => o.dead) {
  let w = 0;
  for (let r = 0; r < list.length; r++) {
    const o = list[r];
    if (isDead(o)) { if (pool) pool.release(o); continue; }
    if (w !== r) list[w] = o;
    w++;
  }
  list.length = w;
  return list;
}

/** Như sweep() nhưng cho các đối tượng tính bằng thời gian sống `life` */
export const sweepLife = (list) => sweep(list, null, (o) => o.life <= 0);

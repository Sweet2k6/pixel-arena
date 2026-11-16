// =====================================================================================
//  TIỆN ÍCH CHUNG — toán học, va chạm hình học, màu sắc (không phụ thuộc DOM hay game)
// =====================================================================================

export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const rndSeed = () => (Math.random() * 1e6) | 0;
export const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);

/** Hai hình tròn có chạm nhau không */
export const circleHit = (ax, ay, ar, bx, by, br) => (ax - bx) ** 2 + (ay - by) ** 2 <= (ar + br) ** 2;

/** Hiệu hai góc, đưa về khoảng [-PI, PI] */
export function angleDiff(a, b) {
  let d = a - b;
  return Math.atan2(Math.sin(d), Math.cos(d));
}

/** Hình tròn (cx, cy, r) có chạm hình chữ nhật { x, y, w, h } không */
export function circleRect(cx, cy, r, rc) {
  const nx = clamp(cx, rc.x, rc.x + rc.w), ny = clamp(cy, rc.y, rc.y + rc.h);
  return (cx - nx) ** 2 + (cy - ny) ** 2 <= r * r;
}

/** Hai hình chữ nhật chồng nhau */
export const rectOverlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

/**
 * Đoạn thẳng (x0,y0)->(x1,y1) cắt hình chữ nhật ở đâu (phương pháp slab).
 * Trả về t trong [0, 1] của điểm đi vào đầu tiên, hoặc -1 nếu không cắt.
 */
export function segRect(x0, y0, x1, y1, rc) {
  const dx = x1 - x0, dy = y1 - y0;
  let t0 = 0, t1 = 1;
  const clip = (p, q) => {
    if (p === 0) return q >= 0;
    const t = q / p;
    if (p < 0) { if (t > t1) return false; if (t > t0) t0 = t; }
    else { if (t < t0) return false; if (t < t1) t1 = t; }
    return true;
  };
  if (clip(-dx, x0 - rc.x) && clip(dx, rc.x + rc.w - x0) && clip(-dy, y0 - rc.y) && clip(dy, rc.y + rc.h - y0)) return t0;
  return -1;
}

/** Đoạn thẳng cắt hình tròn: t đi vào đầu tiên trong [0, 1] hoặc -1 */
export function segCircle(x0, y0, x1, y1, cx, cy, r) {
  const dx = x1 - x0, dy = y1 - y0, fx = x0 - cx, fy = y0 - cy;
  const a = dx * dx + dy * dy, b = 2 * (fx * dx + fy * dy), c = fx * fx + fy * fy - r * r;
  if (c <= 0) return 0; // bắt đầu bên trong
  const disc = b * b - 4 * a * c;
  if (disc < 0 || a === 0) return -1;
  const t = (-b - Math.sqrt(disc)) / (2 * a);
  return t >= 0 && t <= 1 ? t : -1;
}

/** Khoảng cách từ điểm tới đoạn thẳng (dùng cho tia laser xuyên thấu) */
export function pointSegDist(px, py, x0, y0, x1, y1) {
  const dx = x1 - x0, dy = y1 - y0, l2 = dx * dx + dy * dy;
  const t = l2 ? clamp(((px - x0) * dx + (py - y0) * dy) / l2, 0, 1) : 0;
  return Math.hypot(px - (x0 + t * dx), py - (y0 + t * dy));
}

// ---------- Màu sắc: làm sáng / thêm độ trong suốt cho chuỗi "#rrggbb" ----------
export function lighten(h, k) {
  const v = parseInt(h.slice(1, 7), 16), f = (c) => Math.round(c + (255 - c) * k);
  return `rgb(${f((v >> 16) & 255)},${f((v >> 8) & 255)},${f(v & 255)})`;
}
export function darken(h, k) {
  const v = parseInt(h.slice(1, 7), 16), f = (c) => Math.round(c * (1 - k));
  return `rgb(${f((v >> 16) & 255)},${f((v >> 8) & 255)},${f(v & 255)})`;
}
export function withAlpha(h, a) {
  const v = parseInt(h.slice(1, 7), 16);
  return `rgba(${(v >> 16) & 255},${(v >> 8) & 255},${v & 255},${a})`;
}

/** Số đẹp để hiển thị sát thương (1, 1.3, 0.5 ...) */
export const fmtNum = (n) => (Math.abs(n - Math.round(n)) < 0.05 ? String(Math.round(n)) : n.toFixed(1));

/** Bộ sinh số ngẫu nhiên có seed (để bản đồ tạo ra giống nhau với cùng seed) */
export function makeRng(seed = 1) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

// =====================================================================================
//  BẢN ĐỒ RỘNG + CAMERA + 4 LOẠI ĐỊA HÌNH (BIOME)
//
//  Hệ tọa độ: mọi thứ trong trận (người chơi, quái, đạn, vật cản...) dùng TỌA ĐỘ THẾ GIỚI
//  (0..WORLD.w, 0..WORLD.h). Chỉ lúc vẽ mới trừ camera:  screenX = worldX - camera.x
//  Chuột thì ngược lại:  worldMouseX = mouseX + camera.x   (xem main.js -> worldMouse())
// =====================================================================================
import { clamp, rand, randInt, pick, circleRect, segRect, segCircle, rectOverlap, withAlpha, TAU } from "./util.js";

/** Kích thước đấu trường (pixel game) */
export const WORLD = { w: 2400, h: 1600, wall: 24, wallTop: 40 };

/**
 * 4 BẢN ĐỒ chọn được ở Màn hình chính. Muốn thêm bản đồ: thêm 1 khối mới với id khác.
 *  - floor: màu sàn (a/b = 2 màu ô caro, line = viền ô, dots = chấm trang trí)
 *  - wall:  màu tường bao + vật cản
 *  - counts: số lượng cột đá, thùng nổ, vũng axit, bẫy lửa, tinh thể băng, sông dung nham
 *  - accel: độ "bám" khi đổi hướng (càng nhỏ càng trượt — Tàn Tích Băng Giá dùng giá trị nhỏ)
 */
export const BIOMES = [
  {
    id: "dungeon",
    name: "Hầm Ngục Đá Cổ",
    desc: "Nền gạch tím sẫm, cột đá và thùng thuốc nổ rải rác.",
    floor: { a: "#3b3352", b: "#362f4b", line: "#443b5e", dots: ["#30293f", "#45395f"] },
    wall: { base: "#2e2840", top: "#4a4066", dark: "#1b1726", face: "#231e33", pillarTop: "#5a4f78", pillarFace: "#2f2842", pillarLine: "#6e6290" },
    pillarStyle: "stone",
    counts: { pillars: 34, barrels: 16, acid: 0, traps: 0, crystals: 0, lavaRivers: 0 },
    accel: 30,
    minimap: "#2a2338",
  },
  {
    id: "forest",
    name: "Rừng Độc Nấm Lùn",
    desc: "Rêu tối, nấm khổng lồ. Vũng axit làm chậm 35% và rút 1 giáp mỗi 1.5s.",
    floor: { a: "#1f2a1c", b: "#1c2619", line: "#26331f", dots: ["#2c3a24", "#151d13", "#33452a"] },
    wall: { base: "#1a2416", top: "#3a5230", dark: "#0e140c", face: "#141c11", pillarTop: "#8a2e3e", pillarFace: "#5a1c2a", pillarLine: "#e8d6b0" },
    pillarStyle: "mushroom",
    counts: { pillars: 30, barrels: 12, acid: 16, traps: 0, crystals: 0, lavaRivers: 0 },
    accel: 30,
    minimap: "#1b2618",
  },
  {
    id: "lava",
    name: "Lò Rèn Dung Nham",
    desc: "Đá núi lửa đỏ sẫm, hố nham thạch chia cắt địa hình, bẫy phun lửa mỗi 4 giây.",
    floor: { a: "#2c1514", b: "#271211", line: "#3a1a16", dots: ["#4a1c12", "#1c0c0b", "#5c2414"] },
    wall: { base: "#2a1210", top: "#5c2a1c", dark: "#140807", face: "#1c0b0a", pillarTop: "#4a3434", pillarFace: "#2a1c1c", pillarLine: "#6a4a46" },
    pillarStyle: "basalt",
    counts: { pillars: 18, barrels: 10, acid: 0, traps: 18, crystals: 0, lavaRivers: 7 },
    accel: 30,
    minimap: "#2a1414",
  },
  {
    id: "ice",
    name: "Tàn Tích Băng Giá",
    desc: "Nền băng trơn trượt (có quán tính). Tinh thể băng vỡ ra bắn mảnh băng sắc.",
    floor: { a: "#9cc4da", b: "#a6cce0", line: "#bcdcec", dots: ["#d6eef8", "#8ab4cc", "#ffffff"] },
    wall: { base: "#5a7a94", top: "#cfe6f2", dark: "#2e4458", face: "#45627c", pillarTop: "#d8eef8", pillarFace: "#7aa2bc", pillarLine: "#ffffff" },
    pillarStyle: "ice",
    counts: { pillars: 22, barrels: 10, acid: 0, traps: 0, crystals: 22, lavaRivers: 0 },
    accel: 3.2,
    minimap: "#4a6a80",
  },
];

/** Tham số các vật thể môi trường */
export const ENV = {
  barrel: { r: 7, fuse: 0.2, radius: 72, damage: 8, playerRadius: 46 },  // thùng nổ: nổ sau 0.2s, AOE 72px
  acid: { slow: 0.35, drainEvery: 1.5 },                                 // vũng axit
  trap: { period: 4, warn: 1, fire: 0.6, r: 15, damage: 1 },              // bẫy lửa: chu kỳ 4s, cảnh báo 1s
  crystal: { r: 10, hp: 3, shards: 8, shardDamage: 2 },                   // tinh thể băng
};

// =====================================================================================
//  CAMERA — bám theo nhân vật mượt (lerp) và không bao giờ lộ vùng ngoài bản đồ (clamp)
// =====================================================================================
export class Camera {
  constructor(viewW, viewH) {
    this.w = viewW; this.h = viewH;
    this.x = 0; this.y = 0;
    this.shakeTime = 0; this.shakeAmp = 0;
    this.ox = 0; this.oy = 0;   // độ lệch rung màn hình của frame hiện tại
  }

  /** Đặt camera ngay lập tức lên mục tiêu (lúc bắt đầu trận) */
  snap(tx, ty) {
    this.x = clamp(tx - this.w / 2, 0, WORLD.w - this.w);
    this.y = clamp(ty - this.h / 2, 0, WORLD.h - this.h);
  }

  /** Nội suy mượt về phía mục tiêu, nhìn hơi lệch theo hướng ngắm (lookX/lookY) */
  follow(tx, ty, dt, lookX = 0, lookY = 0) {
    const k = 1 - Math.exp(-7 * dt);
    const gx = clamp(tx + lookX - this.w / 2, 0, WORLD.w - this.w);
    const gy = clamp(ty + lookY - this.h / 2, 0, WORLD.h - this.h);
    this.x += (gx - this.x) * k;
    this.y += (gy - this.y) * k;
    this.x = clamp(this.x, 0, WORLD.w - this.w);
    this.y = clamp(this.y, 0, WORLD.h - this.h);
  }

  shake(time, amp) { this.shakeTime = Math.max(this.shakeTime, time); this.shakeAmp = Math.max(this.shakeAmp, amp); }

  updateShake(dt) {
    if (this.shakeTime > 0) {
      this.shakeTime -= dt;
      this.ox = Math.round((Math.random() - 0.5) * 2 * this.shakeAmp);
      this.oy = Math.round((Math.random() - 0.5) * 2 * this.shakeAmp);
    } else { this.shakeAmp = 0; this.ox = this.oy = 0; }
  }

  /** Tọa độ gốc vẽ (đã làm tròn + rung) — dùng chung cho canvas và lớp pixelfx để không lệch nhau */
  get rx() { return Math.round(this.x) - this.ox; }
  get ry() { return Math.round(this.y) - this.oy; }

  /** Điểm thế giới có nằm trong khung hình (mở rộng margin) không */
  inView(x, y, margin = 0) {
    return x >= this.x - margin && x <= this.x + this.w + margin && y >= this.y - margin && y <= this.y + this.h + margin;
  }
}

// =====================================================================================
//  WORLD — sinh bản đồ, va chạm địa hình, vẽ nền
// =====================================================================================
export class World {
  /** @param biome 1 phần tử của BIOMES   @param images ảnh đã tải (dùng floorTile nếu bạn có chèn) */
  constructor(biome, images = {}) {
    this.biome = biome;
    this.images = images;
    this.time = 0;
    this.spawn = { x: WORLD.w / 2, y: WORLD.h / 2 + 20 };

    this.solids = [];    // tường + cột đá: chặn người, quái và đạn
    this.pits = [];      // hố nham thạch: chặn người & quái đi bộ, đạn bay qua được
    this.pools = [];     // vũng axit (hình tròn)
    this.traps = [];     // bẫy phun lửa
    this.barrels = [];   // thùng thuốc nổ
    this.crystals = [];  // tinh thể băng (phá được)

    this.generate();
    this.floor = this.renderStatic();
  }

  // ---------------------------------------------------------------- SINH BẢN ĐỒ
  generate() {
    const W = WORLD, c = this.biome.counts;
    // Tường bao quanh
    this.solids.push(
      { x: 0, y: 0, w: W.w, h: W.wallTop, wall: true },
      { x: 0, y: W.h - W.wall, w: W.w, h: W.wall, wall: true },
      { x: 0, y: 0, w: W.wall, h: W.h, wall: true },
      { x: W.w - W.wall, y: 0, w: W.wall, h: W.h, wall: true },
    );
    const safe = { x: this.spawn.x - 130, y: this.spawn.y - 110, w: 260, h: 200 }; // vùng xuất phát luôn trống

    // Sông dung nham: các dải dài có khe hở để đi qua
    for (let i = 0; i < c.lavaRivers; i++) {
      const horiz = i % 2 === 0, len = randInt(360, 720), thick = randInt(34, 52);
      for (let tries = 0; tries < 40; tries++) {
        const x = randInt(80, W.w - 80 - (horiz ? len : thick)), y = randInt(90, W.h - 80 - (horiz ? thick : len));
        const full = horiz ? { x, y, w: len, h: thick } : { x, y, w: thick, h: len };
        if (rectOverlap(full, inflate(safe, 30)) || this.pits.some((p) => rectOverlap(inflate(p, 70), full))) continue;
        // cắt 1 khe ở giữa (rộng 56px) để người chơi đi qua
        const gap = 56, cut = randInt(Math.floor(len * 0.3), Math.floor(len * 0.6));
        if (horiz) this.pits.push({ x, y, w: cut, h: thick }, { x: x + cut + gap, y, w: len - cut - gap, h: thick });
        else this.pits.push({ x, y, w: thick, h: cut }, { x, y: y + cut + gap, w: thick, h: len - cut - gap });
        break;
      }
    }
    // Vài hố dung nham nhỏ
    for (let i = 0; i < Math.floor(c.lavaRivers / 2); i++) {
      const s = randInt(40, 70);
      this.placeRect(s, s, (r) => this.pits.push(r), safe, 60);
    }

    // Cột đá / nấm khổng lồ / tảng bazan / cột băng
    for (let i = 0; i < c.pillars; i++) {
      const long = this.biome.pillarStyle === "stone" && Math.random() < 0.25;
      const w = long ? randInt(18, 26) * 4 : randInt(7, 11) * 4;
      const h = long ? 24 : w;
      this.placeRect(w, h, (r) => this.solids.push(r), safe, 50);
    }

    // Vũng axit (hình tròn)
    for (let i = 0; i < c.acid; i++) {
      for (let tries = 0; tries < 40; tries++) {
        const r = randInt(22, 48), x = randInt(80, W.w - 80), y = randInt(100, W.h - 80);
        if (circleRect(x, y, r + 20, safe) || this.pools.some((p) => Math.hypot(p.x - x, p.y - y) < p.r + r + 30)) continue;
        if (this.solids.some((s) => circleRect(x, y, r + 6, s))) continue;
        this.pools.push({ x, y, r, seed: Math.random() * 100 });
        break;
      }
    }

    // Bẫy phun lửa (mỗi bẫy lệch pha ngẫu nhiên để không phun cùng lúc)
    for (let i = 0; i < c.traps; i++) {
      const p = this.randomFreePoint({ margin: 24, avoid: safe });
      if (p) this.traps.push({ x: p.x, y: p.y, phase: Math.random() * ENV.trap.period, burnTick: 0 });
    }
    // Thùng thuốc nổ
    for (let i = 0; i < c.barrels; i++) {
      const p = this.randomFreePoint({ margin: 16, avoid: safe });
      if (p) this.barrels.push({ x: p.x, y: p.y, r: ENV.barrel.r, fuse: -1, dead: false, flash: 0 });
    }
    // Tinh thể băng
    for (let i = 0; i < c.crystals; i++) {
      const p = this.randomFreePoint({ margin: 18, avoid: safe });
      if (p) this.crystals.push({ x: p.x, y: p.y, r: ENV.crystal.r, hp: ENV.crystal.hp, dead: false, flash: 0, seed: Math.random() });
    }
  }

  /** Thử đặt 1 hình chữ nhật w x h không chồng lên vật khác */
  placeRect(w, h, push, safe, gap) {
    for (let tries = 0; tries < 60; tries++) {
      const r = { x: randInt(60, WORLD.w - 60 - w), y: randInt(80, WORLD.h - 60 - h), w, h };
      const g = inflate(r, gap);
      if (rectOverlap(g, safe)) continue;
      if (this.solids.some((s) => !s.wall && rectOverlap(g, s))) continue;
      if (this.pits.some((s) => rectOverlap(inflate(r, 30), s))) continue;
      push(r);
      return true;
    }
    return false;
  }

  /**
   * Tìm 1 điểm trống ngẫu nhiên.
   * opts: { margin, avoid (rect), near:{x,y}, minD, maxD, outsideView: camera }
   */
  randomFreePoint(opts = {}) {
    const m = opts.margin ?? 12;
    for (let tries = 0; tries < 80; tries++) {
      let x, y;
      if (opts.near) {
        const a = Math.random() * TAU, d = rand(opts.minD ?? 0, opts.maxD ?? 600);
        x = opts.near.x + Math.cos(a) * d; y = opts.near.y + Math.sin(a) * d;
      } else { x = rand(60, WORLD.w - 60); y = rand(80, WORLD.h - 60); }
      if (x < WORLD.wall + m || x > WORLD.w - WORLD.wall - m || y < WORLD.wallTop + m + 10 || y > WORLD.h - WORLD.wall - m) continue;
      if (opts.avoid && circleRect(x, y, m, opts.avoid)) continue;
      if (opts.outsideView && opts.outsideView.inView(x, y, 24)) continue;
      if (!this.isFree(x, y, m)) continue;
      return { x, y };
    }
    return null;
  }

  /** Điểm (x, y) với bán kính r có trống hoàn toàn (không tường, hố, axit, thùng, tinh thể, bẫy) */
  isFree(x, y, r) {
    if (this.solids.some((s) => circleRect(x, y, r, s))) return false;
    if (this.pits.some((s) => circleRect(x, y, r, s))) return false;
    if (this.pools.some((p) => Math.hypot(p.x - x, p.y - y) < p.r + r)) return false;
    if (this.traps.some((t) => Math.hypot(t.x - x, t.y - y) < ENV.trap.r + r + 6)) return false;
    if (this.barrels.some((b) => !b.dead && Math.hypot(b.x - x, b.y - y) < b.r + r + 4)) return false;
    if (this.crystals.some((c) => !c.dead && Math.hypot(c.x - x, c.y - y) < c.r + r + 4)) return false;
    return true;
  }

  // ---------------------------------------------------------------- VA CHẠM
  /**
   * Di chuyển 1 thực thể (x, y = CHÂN) một đoạn (dx, dy) có trượt dọc tường.
   * Hộp va chạm: hình vuông nửa cạnh r quanh chân. flying = bay qua hố dung nham (dơi, boss ma).
   * Trả về true nếu bị chặn ở trục nào đó.
   */
  moveBody(e, dx, dy, r, flying = false) {
    let blocked = false;
    const boxes = flying ? this.solids : this.solids.concat(this.pits);
    // trục X
    if (dx) {
      e.x += dx;
      for (const s of boxes) {
        if (e.x + r > s.x && e.x - r < s.x + s.w && e.y > s.y && e.y - r * 1.2 < s.y + s.h) {
          e.x = dx > 0 ? s.x - r : s.x + s.w + r;
          blocked = true;
        }
      }
    }
    // trục Y (hộp từ chân lên trên 1.2r)
    if (dy) {
      e.y += dy;
      for (const s of boxes) {
        if (e.x + r > s.x && e.x - r < s.x + s.w && e.y > s.y && e.y - r * 1.2 < s.y + s.h) {
          e.y = dy > 0 ? s.y : s.y + s.h + r * 1.2;
          blocked = true;
        }
      }
    }
    // vật tròn: thùng nổ, tinh thể băng -> đẩy ra
    for (const o of this.barrels) if (!o.dead) blocked = pushOut(e, o, r) || blocked;
    for (const o of this.crystals) if (!o.dead) blocked = pushOut(e, o, r) || blocked;
    e.x = clamp(e.x, WORLD.wall + r, WORLD.w - WORLD.wall - r);
    e.y = clamp(e.y, WORLD.wallTop + r * 1.2, WORLD.h - WORLD.wall);
    return blocked;
  }

  /** Đạn (hình tròn) chạm gì? -> { kind: "solid" | "barrel" | "crystal", obj } hoặc null */
  bulletHit(x, y, r) {
    for (const s of this.solids) if (circleRect(x, y, r, s)) return { kind: "solid", obj: s };
    for (const b of this.barrels) if (!b.dead && Math.hypot(b.x - x, b.y - 6 - y) < b.r + r) return { kind: "barrel", obj: b };
    for (const c of this.crystals) if (!c.dead && Math.hypot(c.x - x, c.y - 8 - y) < c.r + r) return { kind: "crystal", obj: c };
    return null;
  }

  /** Có điểm đặc (tường/cột) tại (x, y) không — dùng cho đạn nảy tường */
  solidAt(x, y, r = 1) { return this.solids.some((s) => circleRect(x, y, r, s)); }

  /**
   * Bắn tia từ (x0,y0) tới (x1,y1): trả về t (0..1) của vật cản đầu tiên (tường, cột, tinh thể).
   * hits: danh sách thùng nổ / tinh thể tia đi qua trước khi bị chặn.
   */
  raycast(x0, y0, x1, y1) {
    let best = 1, stopper = null;
    for (const s of this.solids) {
      const t = segRect(x0, y0, x1, y1, s);
      if (t >= 0 && t < best) { best = t; stopper = null; }
    }
    for (const c of this.crystals) {
      if (c.dead) continue;
      const t = segCircle(x0, y0, x1, y1, c.x, c.y - 8, c.r);
      if (t >= 0 && t < best) { best = t; stopper = c; }
    }
    const barrels = [];
    for (const b of this.barrels) {
      if (b.dead) continue;
      const t = segCircle(x0, y0, x1, y1, b.x, b.y - 6, b.r);
      if (t >= 0 && t <= best) barrels.push(b);
    }
    return { t: best, crystal: stopper, barrels };
  }

  /** Có nhìn thấy nhau không (không tường/cột chắn giữa) */
  lineOfSight(x0, y0, x1, y1) {
    for (const s of this.solids) if (segRect(x0, y0, x1, y1, s) >= 0) return false;
    return true;
  }

  inAcid(x, y) { return this.pools.some((p) => (x - p.x) ** 2 + ((y - p.y) * 1.25) ** 2 < p.r * p.r); }

  /** Trạng thái bẫy lửa lúc này: "idle" | "warn" (nhấp nháy 1s trước) | "fire" */
  trapState(t) {
    const T = ENV.trap, u = (this.time + t.phase) % T.period;
    if (u >= T.period - T.fire) return "fire";
    if (u >= T.period - T.fire - T.warn) return "warn";
    return "idle";
  }

  update(dt) {
    this.time += dt;
    for (const b of this.barrels) b.flash = Math.max(0, b.flash - dt);
    for (const c of this.crystals) c.flash = Math.max(0, c.flash - dt);
  }

  // ---------------------------------------------------------------- VẼ
  /** Vẽ sẵn toàn bộ nền tĩnh (sàn, tường, cột, hố, vũng axit) vào 1 canvas lớn — mỗi frame chỉ việc cắt 1 khung */
  renderStatic() {
    const cv = document.createElement("canvas");
    cv.width = WORLD.w; cv.height = WORLD.h;
    const g = cv.getContext("2d");
    g.imageSmoothingEnabled = false;
    const B = this.biome, F = B.floor, Wc = B.wall;

    // --- Sàn ---
    const tile = this.images.floorTile;
    if (tile) {
      // >>> ẢNH SÀN CỦA BẠN (assets floorTile) được lặp kín bản đồ ở đây
      g.fillStyle = g.createPattern(tile, "repeat");
      g.fillRect(0, 0, WORLD.w, WORLD.h);
    } else {
      const T = 16;
      for (let y = 0; y < WORLD.h; y += T) {
        for (let x = 0; x < WORLD.w; x += T) {
          const odd = ((x / T) + (y / T)) % 2 === 0;
          g.fillStyle = odd ? F.a : F.b;
          g.fillRect(x, y, T, T);
          g.fillStyle = F.line;
          g.fillRect(x, y, T, 1);
          if (B.id !== "dungeon") g.fillRect(x, y, 1, T);
          if (Math.random() < 0.18) { g.fillStyle = pick(F.dots); g.fillRect(x + randInt(2, 12), y + randInt(2, 12), randInt(1, 3), 1); }
        }
      }
      // chi tiết riêng từng biome
      if (B.id === "lava") {                      // vết nứt phát sáng
        for (let i = 0; i < 260; i++) {
          let x = rand(0, WORLD.w), y = rand(0, WORLD.h);
          g.fillStyle = Math.random() < 0.3 ? "#ff6a1e" : "#7a2412";
          for (let k = 0; k < randInt(4, 12); k++) { g.fillRect(Math.round(x), Math.round(y), 2, 1); x += rand(-1, 3); y += rand(-1.5, 1.5); }
        }
      } else if (B.id === "ice") {                // ánh băng
        for (let i = 0; i < 500; i++) {
          g.fillStyle = withAlpha("#ffffff", rand(0.3, 0.8));
          const x = rand(0, WORLD.w), y = rand(0, WORLD.h);
          g.fillRect(x, y, randInt(3, 9), 1);
        }
      } else if (B.id === "forest") {             // cỏ rêu
        for (let i = 0; i < 700; i++) {
          g.fillStyle = pick(["#2f4a26", "#3c5a2c", "#1a2516"]);
          const x = rand(0, WORLD.w), y = rand(0, WORLD.h);
          g.fillRect(x, y, 1, 2); g.fillRect(x + 2, y + 1, 1, 2);
        }
      }
    }

    // --- Hố dung nham ---
    for (const p of this.pits) {
      g.fillStyle = "#1a0705"; g.fillRect(p.x - 3, p.y - 3, p.w + 6, p.h + 6);
      g.fillStyle = "#8a1e0c"; g.fillRect(p.x, p.y, p.w, p.h);
      for (let i = 0; i < (p.w * p.h) / 60; i++) {
        g.fillStyle = pick(["#c9381a", "#f2561d", "#ff8a2a", "#ffc23d"]);
        g.fillRect(p.x + rand(0, p.w - 4), p.y + rand(0, p.h - 2), randInt(2, 6), randInt(1, 2));
      }
      g.fillStyle = "#3a120c"; g.fillRect(p.x, p.y, p.w, 3);   // mép trên tối tạo chiều sâu
    }

    // --- Vũng axit ---
    for (const p of this.pools) {
      g.fillStyle = "#0c2a10";
      ellipse(g, p.x, p.y, p.r + 3, (p.r + 3) * 0.8);
      g.fillStyle = "#2f8f2a";
      ellipse(g, p.x, p.y, p.r, p.r * 0.8);
      g.fillStyle = "#56d23a";
      ellipse(g, p.x - p.r * 0.15, p.y - p.r * 0.12, p.r * 0.7, p.r * 0.5);
      g.fillStyle = "#a6f06a";
      g.fillRect(p.x - p.r * 0.4, p.y - p.r * 0.4, 4, 1);
    }

    // --- Bệ bẫy lửa ---
    for (const t of this.traps) {
      g.fillStyle = "#120807"; g.fillRect(t.x - 9, t.y - 7, 18, 14);
      g.fillStyle = "#4a3434"; g.fillRect(t.x - 8, t.y - 6, 16, 12);
      g.fillStyle = "#1c0c0b";
      for (let i = -6; i <= 6; i += 4) g.fillRect(t.x + i, t.y - 5, 2, 10);
    }

    // --- Cột / vật cản ---
    for (const s of this.solids) {
      if (s.wall) continue;
      drawPillar(g, s, B);
    }

    // --- Tường bao ---
    g.fillStyle = Wc.dark;
    g.fillRect(0, 0, WORLD.w, WORLD.wallTop); g.fillRect(0, WORLD.h - WORLD.wall, WORLD.w, WORLD.wall);
    g.fillRect(0, 0, WORLD.wall, WORLD.h); g.fillRect(WORLD.w - WORLD.wall, 0, WORLD.wall, WORLD.h);
    g.fillStyle = Wc.base;
    for (let x = 0; x < WORLD.w; x += 24) {           // gạch tường trên
      for (let y = 0; y < WORLD.wallTop - 8; y += 8) {
        g.fillRect(x + ((y / 8) % 2) * 12, y, 22, 7);
      }
    }
    g.fillStyle = Wc.top;
    g.fillRect(WORLD.wall - 4, WORLD.wallTop - 10, WORLD.w - WORLD.wall * 2 + 8, 3);
    g.fillStyle = Wc.face;
    g.fillRect(WORLD.wall, WORLD.wallTop - 7, WORLD.w - WORLD.wall * 2, 7);
    g.fillStyle = Wc.top;                               // viền trong
    g.fillRect(WORLD.wall - 2, WORLD.wallTop - 10, 2, WORLD.h - WORLD.wallTop - WORLD.wall + 12);
    g.fillRect(WORLD.w - WORLD.wall, WORLD.wallTop - 10, 2, WORLD.h - WORLD.wallTop - WORLD.wall + 12);
    g.fillRect(WORLD.wall - 2, WORLD.h - WORLD.wall, WORLD.w - WORLD.wall * 2 + 4, 2);
    return cv;
  }

  /** Cắt đúng khung camera từ nền tĩnh (gọi khi ctx CHƯA dịch theo camera) */
  drawFloor(ctx, cam, viewW, viewH) {
    const sx = cam.rx, sy = cam.ry;
    const cx = clamp(sx, 0, WORLD.w - viewW), cy = clamp(sy, 0, WORLD.h - viewH);
    ctx.drawImage(this.floor, cx, cy, viewW, viewH, cx - sx, cy - sy, viewW, viewH);
  }

  /** Vẽ phần động (bẫy, thùng, tinh thể, bọt axit, dung nham lấp lánh) — ctx ĐÃ dịch theo camera */
  drawDynamic(ctx, cam) {
    const t = this.time;
    // Dung nham lấp lánh
    for (const p of this.pits) {
      if (!cam.inView(p.x + p.w / 2, p.y + p.h / 2, Math.max(p.w, p.h))) continue;
      ctx.fillStyle = withAlpha("#ffb03a", 0.12 + 0.1 * Math.sin(t * 3 + p.x));
      ctx.fillRect(p.x, p.y + 3, p.w, p.h - 3);
      for (let i = 0; i < 4; i++) {
        const u = (t * 0.6 + i * 0.27 + p.x * 0.001) % 1;
        ctx.fillStyle = "#ffe26b";
        ctx.fillRect(Math.round(p.x + ((i * 97 + p.y) % p.w)), Math.round(p.y + p.h * u), 2, 1);
      }
    }
    // Bọt axit
    for (const p of this.pools) {
      if (!cam.inView(p.x, p.y, p.r + 8)) continue;
      for (let i = 0; i < 3; i++) {
        const u = (t * 0.7 + i / 3 + p.seed) % 1;
        const bx = p.x + Math.sin(p.seed * 7 + i * 2.1) * p.r * 0.5, by = p.y + Math.cos(p.seed * 3 + i * 1.7) * p.r * 0.35;
        ctx.fillStyle = withAlpha("#c8ff8a", 1 - u);
        const s = u < 0.8 ? 2 : 3;
        ctx.fillRect(Math.round(bx), Math.round(by - u * 3), s, s);
      }
    }
    // Bẫy lửa: cảnh báo nhấp nháy 1s trước, rồi phun cột lửa
    for (const tr of this.traps) {
      if (!cam.inView(tr.x, tr.y, 60)) continue;
      const st = this.trapState(tr);
      if (st === "warn") {
        if (Math.floor(t * 12) % 2 === 0) {
          ctx.strokeStyle = "#ff4a1a"; ctx.lineWidth = 1;
          ctx.strokeRect(tr.x - ENV.trap.r + 0.5, tr.y - ENV.trap.r * 0.7 + 0.5, ENV.trap.r * 2, ENV.trap.r * 1.4);
          ctx.fillStyle = withAlpha("#ff6a1e", 0.35); ctx.fillRect(tr.x - 8, tr.y - 6, 16, 12);
        }
      } else if (st === "fire") {
        drawFlameColumn(ctx, tr.x, tr.y, t);
      }
    }
    // Thùng thuốc nổ
    for (const b of this.barrels) {
      if (b.dead || !cam.inView(b.x, b.y, 20)) continue;
      const lit = b.fuse >= 0 && Math.floor(t * 30) % 2 === 0;
      const x = Math.round(b.x), y = Math.round(b.y);
      ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.fillRect(x - 6, y - 1, 12, 3);
      ctx.fillStyle = lit || b.flash > 0 ? "#ffffff" : "#7c1a1e"; ctx.fillRect(x - 6, y - 14, 12, 14);
      if (!lit) {
        ctx.fillStyle = b.flash > 0 ? "#ffd0c0" : "#b02a26"; ctx.fillRect(x - 5, y - 14, 4, 14);
        ctx.fillStyle = "#3a2a20"; ctx.fillRect(x - 6, y - 11, 12, 2); ctx.fillRect(x - 6, y - 4, 12, 2);
        ctx.fillStyle = "#ffd34a"; ctx.fillRect(x - 1, y - 9, 2, 3);    // biểu tượng nguy hiểm
        ctx.fillStyle = "#4a1218"; ctx.fillRect(x - 5, y - 15, 10, 1);
      }
    }
    // Tinh thể băng
    for (const c of this.crystals) {
      if (c.dead || !cam.inView(c.x, c.y, 24)) continue;
      const x = Math.round(c.x), y = Math.round(c.y), f = c.flash > 0;
      ctx.fillStyle = "rgba(20,40,70,0.35)"; ctx.fillRect(x - 7, y - 1, 14, 3);
      ctx.fillStyle = f ? "#ffffff" : "#3a8bd8";
      ctx.beginPath(); ctx.moveTo(x, y - 22); ctx.lineTo(x + 8, y - 8); ctx.lineTo(x + 3, y); ctx.lineTo(x - 3, y); ctx.lineTo(x - 8, y - 8); ctx.closePath(); ctx.fill();
      ctx.fillStyle = f ? "#ffffff" : "#a6ecff";
      ctx.beginPath(); ctx.moveTo(x, y - 22); ctx.lineTo(x - 8, y - 8); ctx.lineTo(x - 2, y - 2); ctx.lineTo(x, y - 10); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#ffffff"; ctx.fillRect(x - 2, y - 16, 1, 4);
      // vết nứt theo số máu còn lại
      ctx.fillStyle = "#151a3d";
      if (c.hp < ENV.crystal.hp) ctx.fillRect(x + 1, y - 13, 1, 5);
      if (c.hp < ENV.crystal.hp - 1) { ctx.fillRect(x - 4, y - 9, 3, 1); ctx.fillRect(x + 3, y - 6, 1, 3); }
    }
  }

  /** Vẽ bản đồ thu nhỏ (gọi 1 lần, minimap dùng lại) */
  renderMinimap(mw, mh) {
    const cv = document.createElement("canvas");
    cv.width = mw; cv.height = mh;
    const g = cv.getContext("2d");
    const sx = mw / WORLD.w, sy = mh / WORLD.h;
    g.fillStyle = this.biome.minimap; g.fillRect(0, 0, mw, mh);
    g.fillStyle = "#e05a1e"; for (const p of this.pits) g.fillRect(p.x * sx, p.y * sy, Math.max(1, p.w * sx), Math.max(1, p.h * sy));
    g.fillStyle = "#56d23a"; for (const p of this.pools) g.fillRect((p.x - p.r) * sx, (p.y - p.r * 0.8) * sy, Math.max(1, p.r * 2 * sx), Math.max(1, p.r * 1.6 * sy));
    g.fillStyle = "#8a82a8"; for (const s of this.solids) if (!s.wall) g.fillRect(s.x * sx, s.y * sy, Math.max(1, s.w * sx), Math.max(1, s.h * sy));
    return cv;
  }
}

// ---------- helpers ----------
function inflate(r, m) { return { x: r.x - m, y: r.y - m, w: r.w + m * 2, h: r.h + m * 2 }; }

function pushOut(e, o, r) {
  const dx = e.x - o.x, dy = e.y - o.y, d = Math.hypot(dx, dy), min = o.r + r * 0.8;
  if (d >= min) return false;
  if (d === 0) { e.x += min; return true; }
  e.x = o.x + (dx / d) * min; e.y = o.y + (dy / d) * min;
  return true;
}

function ellipse(g, x, y, rx, ry) { g.beginPath(); g.ellipse(x, y, Math.max(1, rx), Math.max(1, ry), 0, 0, TAU); g.fill(); }

/** Vẽ 1 vật cản theo phong cách biome (mặt trên sáng + mặt trước tối tạo chiều sâu) */
function drawPillar(g, s, B) {
  const W = B.wall, face = Math.min(10, Math.floor(s.h * 0.3));
  g.fillStyle = "rgba(0,0,0,0.35)"; g.fillRect(s.x + 3, s.y + s.h, s.w, 4);   // bóng đổ
  if (B.pillarStyle === "mushroom") {
    // nấm khổng lồ: thân kem + mũ đỏ chấm trắng
    const cx = s.x + s.w / 2;
    g.fillStyle = "#c8b48a"; g.fillRect(cx - s.w * 0.18, s.y + s.h * 0.45, s.w * 0.36, s.h * 0.55);
    g.fillStyle = "#8a7656"; g.fillRect(cx + s.w * 0.06, s.y + s.h * 0.45, s.w * 0.12, s.h * 0.55);
    g.fillStyle = W.pillarFace; ellipse(g, cx, s.y + s.h * 0.45, s.w * 0.56, s.h * 0.32);
    g.fillStyle = W.pillarTop; ellipse(g, cx, s.y + s.h * 0.38, s.w * 0.54, s.h * 0.3);
    g.fillStyle = W.pillarLine;
    for (let i = 0; i < 4; i++) g.fillRect(Math.round(cx - s.w * 0.35 + i * s.w * 0.2), Math.round(s.y + s.h * (0.3 + (i % 2) * 0.12)), 3, 2);
    return;
  }
  g.fillStyle = "#0a0810"; g.fillRect(s.x - 1, s.y - 1, s.w + 2, s.h + 2);
  g.fillStyle = W.pillarFace; g.fillRect(s.x, s.y + s.h - face, s.w, face);
  g.fillStyle = W.pillarTop; g.fillRect(s.x, s.y, s.w, s.h - face);
  g.fillStyle = W.pillarLine; g.fillRect(s.x, s.y, s.w, 1);
  if (B.pillarStyle === "stone") {        // gạch đá cổ
    g.fillStyle = W.pillarFace;
    for (let y = s.y + 6; y < s.y + s.h - face; y += 7) g.fillRect(s.x + 1, y, s.w - 2, 1);
    for (let y = s.y; y < s.y + s.h - face - 6; y += 14) g.fillRect(s.x + ((y / 7) % 2 ? 8 : s.w / 2), y + 1, 1, 6);
  } else if (B.pillarStyle === "basalt") { // bazan có mạch dung nham
    g.fillStyle = "#ff6a1e"; g.fillRect(s.x + s.w * 0.3, s.y + s.h - face + 2, 2, face - 3);
    g.fillStyle = "#5c4444"; g.fillRect(s.x + 3, s.y + 3, s.w * 0.4, 2);
  } else if (B.pillarStyle === "ice") {    // cột băng trong suốt
    g.fillStyle = "#ffffff"; g.fillRect(s.x + 3, s.y + 3, 2, s.h - face - 6); g.fillRect(s.x + 7, s.y + 3, 1, s.h * 0.3);
  }
}

/** Cột lửa bẫy phun (vẽ bằng pixel, rung theo thời gian) */
function drawFlameColumn(ctx, x, y, t) {
  const cols = ["#ffffff", "#fff3a6", "#ffc23d", "#ff8a2a", "#f2561d", "#c9281f"];
  ctx.fillStyle = withAlpha("#ff8a2a", 0.25);
  ctx.fillRect(x - 14, y - 46, 28, 50);
  for (let i = 0; i < 26; i++) {
    const h = (i * 37 + Math.floor(t * 40) * 13) % 44;
    const w = 2 + ((i * 7) % 4);
    const ox = Math.round(Math.sin(t * 20 + i) * (3 + h * 0.12));
    ctx.fillStyle = cols[Math.min(cols.length - 1, Math.floor(h / 8))];
    ctx.fillRect(x + ox - w / 2 + ((i % 5) - 2) * 2, y - h, w, 3);
  }
}

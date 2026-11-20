// =====================================================================================
//  BẢN ĐỒ RỘNG + CAMERA + 5 LOẠI ĐỊA HÌNH (BIOME)
//
//  Hệ tọa độ: mọi thứ trong trận (người chơi, quái, đạn, vật cản...) dùng TỌA ĐỘ THẾ GIỚI
//  (0..WORLD.w, 0..WORLD.h). Chỉ lúc vẽ mới trừ camera:  screenX = worldX - camera.x
//  Chuột thì ngược lại:  worldMouseX = mouseX + camera.x   (xem main.js -> worldMouse())
//
//  Bản 3.0: sàn nhà vẽ chi tiết theo từng biome (gạch vát cạnh, rêu, cỏ, xương, tuyết...), đồ trang trí,
//  đuốc trên tường, nguồn sáng (đèn), Đền Thờ ban phước, bản đồ Nghĩa Trang Ma Ám + bàn tay ma,
//  và LƯỚI VA CHẠM TĨNH (đạn & quái chỉ xét vật cản ở ô lân cận thay vì toàn bản đồ).
// =====================================================================================
import { clamp, rand, randInt, pick, circleRect, segRect, segCircle, rectOverlap, withAlpha, TAU } from "./util.js";

/** Kích thước đấu trường (pixel game) */
export const WORLD = { w: 2400, h: 1600, wall: 24, wallTop: 40 };

/**
 * 5 BẢN ĐỒ chọn được ở Màn hình chính. Muốn thêm bản đồ: thêm 1 khối mới với id khác.
 *  - floor: màu sàn (a/b = 2 tông chính, line = viền ô, dots = chấm trang trí)
 *  - wall:  màu tường bao + vật cản
 *  - counts: số lượng cột đá, thùng nổ, vũng axit, bẫy lửa, tinh thể băng, sông dung nham, bàn tay ma, lò lửa, đền thờ,
 *            thùng gỗ (crates), lọ năng lượng (jars), bụi cây (bushes) — 3 loại sau phá được & chắn đạn
 *  - accel: độ "bám" khi đổi hướng (càng nhỏ càng trượt — Tàn Tích Băng Giá dùng giá trị nhỏ)
 *  - light: { color, alpha } bóng tối phủ bản đồ (0 = sáng hẳn) · weather: hạt môi trường bay lơ lửng
 *  - spawnBias: hệ số xuất hiện từng loại quái trên bản đồ này
 */
export const BIOMES = [
  {
    id: "dungeon",
    name: "Hầm Ngục Đá Cổ",
    desc: "Nền gạch tím sẫm, cột đá, lò lửa và thùng thuốc nổ rải rác. Ánh đuốc lập lòe.",
    floor: { a: "#3b3352", b: "#362f4b", line: "#2b2540", dots: ["#30293f", "#45395f"] },
    wall: { base: "#2e2840", top: "#4a4066", dark: "#1b1726", face: "#231e33", pillarTop: "#5a4f78", pillarFace: "#2f2842", pillarLine: "#6e6290" },
    pillarStyle: "stone",
    counts: { pillars: 32, barrels: 16, acid: 0, traps: 0, crystals: 0, lavaRivers: 0, hands: 0, braziers: 10, shrines: 3, crates: 18, jars: 10, bushes: 0 },
    accel: 30,
    minimap: "#2a2338",
    light: { color: "#0a0614", alpha: 0.42 },
    weather: "dust",
    torch: "#ffb04a",
    spawnBias: { archer: 1.3, knight: 1.3, shaman: 1.2 },
  },
  {
    id: "forest",
    name: "Rừng Độc Nấm Lùn",
    desc: "Rêu tối, nấm khổng lồ, đom đóm. Vũng axit làm chậm 35% và rút 1 giáp mỗi 1.5s.",
    floor: { a: "#1f2a1c", b: "#1c2619", line: "#26331f", dots: ["#2c3a24", "#151d13", "#33452a"] },
    wall: { base: "#1a2416", top: "#3a5230", dark: "#0e140c", face: "#141c11", pillarTop: "#8a2e3e", pillarFace: "#5a1c2a", pillarLine: "#e8d6b0" },
    pillarStyle: "mushroom",
    counts: { pillars: 30, barrels: 12, acid: 16, traps: 0, crystals: 0, lavaRivers: 0, hands: 0, braziers: 0, shrines: 3, crates: 10, jars: 8, bushes: 30 },
    accel: 30,
    minimap: "#1b2618",
    light: { color: "#04100a", alpha: 0.36 },
    weather: "fireflies",
    torch: "#c8ff6a",
    spawnBias: { frog: 2.2, snake: 2.2, slime: 1.2, eyeball: 0.7 },
  },
  {
    id: "lava",
    name: "Lò Rèn Dung Nham",
    desc: "Đá núi lửa đỏ sẫm, hố nham thạch chia cắt địa hình, bẫy phun lửa mỗi 4 giây.",
    floor: { a: "#2c1514", b: "#271211", line: "#1c0c0b", dots: ["#4a1c12", "#1c0c0b", "#5c2414"] },
    wall: { base: "#2a1210", top: "#5c2a1c", dark: "#140807", face: "#1c0b0a", pillarTop: "#4a3434", pillarFace: "#2a1c1c", pillarLine: "#6a4a46" },
    pillarStyle: "basalt",
    counts: { pillars: 18, barrels: 10, acid: 0, traps: 18, crystals: 0, lavaRivers: 7, hands: 0, braziers: 0, shrines: 3, crates: 10, jars: 10, bushes: 0 },
    accel: 30,
    minimap: "#2a1414",
    light: { color: "#140404", alpha: 0.26 },
    weather: "embers",
    torch: "#ff8a2a",
    spawnBias: { skull: 2.4, bat: 1.3, ghost: 0.6 },
  },
  {
    id: "ice",
    name: "Tàn Tích Băng Giá",
    desc: "Nền băng trơn trượt (có quán tính), tuyết rơi. Tinh thể băng vỡ ra bắn mảnh băng sắc.",
    floor: { a: "#9cc4da", b: "#a6cce0", line: "#bcdcec", dots: ["#d6eef8", "#8ab4cc", "#ffffff"] },
    wall: { base: "#5a7a94", top: "#cfe6f2", dark: "#2e4458", face: "#45627c", pillarTop: "#d8eef8", pillarFace: "#7aa2bc", pillarLine: "#ffffff" },
    pillarStyle: "ice",
    counts: { pillars: 22, barrels: 10, acid: 0, traps: 0, crystals: 22, lavaRivers: 0, hands: 0, braziers: 6, shrines: 3, crates: 12, jars: 10, bushes: 10 },
    accel: 3.2,
    minimap: "#4a6a80",
    light: { color: "#0a1a3a", alpha: 0.12 },
    weather: "snow",
    torch: "#7cd8ff",
    spawnBias: { eyeball: 1.6, ghost: 1.4, frog: 0.3, snake: 0.3 },
  },
  {
    id: "grave",
    name: "Nghĩa Trang Ma Ám",
    desc: "Sương mù dày, bia mộ đổ nát. Bàn tay ma trồi lên từ mộ: giữ chân và gây sát thương.",
    floor: { a: "#23262a", b: "#1f2226", line: "#181a1e", dots: ["#2c3034", "#16181c", "#34383a"] },
    wall: { base: "#24262c", top: "#3e424c", dark: "#101216", face: "#1a1c22", pillarTop: "#6a6e78", pillarFace: "#3a3c46", pillarLine: "#8a8e98" },
    pillarStyle: "tomb",
    counts: { pillars: 44, barrels: 8, acid: 0, traps: 0, crystals: 0, lavaRivers: 0, hands: 14, braziers: 8, shrines: 3, crates: 10, jars: 8, bushes: 16 },
    accel: 30,
    minimap: "#1a1c22",
    light: { color: "#04060e", alpha: 0.52 },
    weather: "fog",
    torch: "#9ad8ff",
    spawnBias: { ghost: 2.6, skull: 1.6, shaman: 2.2, archer: 1.5, slime: 0.6, frog: 0.4 },
  },
];

/** Tham số các vật thể môi trường */
export const ENV = {
  barrel: { r: 7, fuse: 0.2, radius: 72, damage: 8, playerRadius: 46 },  // thùng nổ: nổ sau 0.2s, AOE 72px
  acid: { slow: 0.35, drainEvery: 1.5 },                                 // vũng axit
  trap: { period: 4, warn: 1, fire: 0.6, r: 15, damage: 1 },              // bẫy lửa: chu kỳ 4s, cảnh báo 1s
  hands: { period: 5.5, warn: 1.1, grab: 0.9, r: 20, damage: 1, root: 1.0 }, // bàn tay ma (Nghĩa Trang)
  crystal: { r: 10, hp: 3, shards: 8, shardDamage: 2 },                   // tinh thể băng
  shrine: { r: 13, cooldown: 70, buffTime: 20 },                          // đền thờ ban phước
  // Vật thể PHÁ ĐƯỢC (chắn đạn của cả 2 phe): hp = sát thương cần để phá, cy = độ cao tâm hình
  props: {
    crate: { r: 7, hp: 3, cy: 6 },     // thùng gỗ: rơi Vàng / Tim / Năng Lượng
    jar:   { r: 5, hp: 1.5, cy: 5 },   // lọ năng lượng: rơi Ngọc Năng Lượng (đôi khi Tim)
    bush:  { r: 9, hp: 6, cy: 6 },     // bụi cây: chỗ núp đạn, bị bắn mãi cũng tan
  },
};

/** Màu bụi cây theo bản đồ [tối, giữa, sáng, điểm nhấn] */
const BUSH_COLORS = {
  forest: ["#1c3a14", "#2f6a22", "#56a83a", "#ff7ad8"],
  ice:    ["#2a4a5a", "#4a7a8a", "#e8f4ff", "#a6ecff"],
  grave:  ["#14201e", "#253a34", "#4a6a58", "#c48cff"],
  dungeon:["#1c2a1a", "#2e4a2a", "#4e7a3a", "#ffe26b"],
  lava:   ["#2a1a10", "#4a2e18", "#7a4a20", "#ff8a2a"],
};

/** Vẽ 1 vật thể phá được (tọa độ thế giới, chân tại (x, y)) */
function drawProp(ctx, o, t, pal) {
  const x = Math.round(o.x), y = Math.round(o.y), f = o.flash > 0, dmg = 1 - o.hp / o.max;
  if (o.kind === "crate") {
    ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.fillRect(x - 7, y - 1, 15, 3);
    ctx.fillStyle = "#1a0f08"; ctx.fillRect(x - 8, y - 13, 16, 13);
    ctx.fillStyle = f ? "#ffffff" : "#8a5a2c"; ctx.fillRect(x - 7, y - 12, 14, 11);
    if (!f) {
      ctx.fillStyle = "#a8743a"; ctx.fillRect(x - 7, y - 12, 14, 2); ctx.fillRect(x - 7, y - 7, 14, 1);
      ctx.fillStyle = "#5a3818"; ctx.fillRect(x - 7, y - 3, 14, 2); ctx.fillRect(x - 7, y - 12, 2, 11); ctx.fillRect(x + 5, y - 12, 2, 11);
      ctx.fillStyle = "#6a4420"; for (let i = 0; i < 8; i++) ctx.fillRect(x - 4 + i, y - 10 + i, 1, 1);   // thanh giằng chéo
      ctx.fillStyle = "#c8c0b0"; ctx.fillRect(x - 6, y - 11, 1, 1); ctx.fillRect(x + 5, y - 11, 1, 1); ctx.fillRect(x - 6, y - 3, 1, 1); ctx.fillRect(x + 5, y - 3, 1, 1);
      if (dmg > 0.3) { ctx.fillStyle = "#1a0f08"; ctx.fillRect(x + 1, y - 12, 1, 4); ctx.fillRect(x + 2, y - 8, 2, 1); }
      if (dmg > 0.6) { ctx.fillRect(x - 5, y - 6, 3, 1); ctx.fillRect(x - 3, y - 5, 1, 3); }
    }
  } else if (o.kind === "jar") {
    const g = 0.5 + 0.5 * Math.sin(t * 4 + o.seed * 9);
    ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.fillRect(x - 5, y - 1, 10, 2);
    ctx.fillStyle = "#140c10"; ctx.fillRect(x - 5, y - 10, 10, 10); ctx.fillRect(x - 3, y - 13, 6, 3);
    ctx.fillStyle = f ? "#ffffff" : "#9a5a3a"; ctx.fillRect(x - 4, y - 9, 8, 8); ctx.fillRect(x - 2, y - 12, 4, 3);
    if (!f) {
      ctx.fillStyle = "#c47a4a"; ctx.fillRect(x - 4, y - 9, 2, 7);
      ctx.fillStyle = `rgba(74,168,255,${0.75 + 0.25 * g})`; ctx.fillRect(x - 3, y - 6, 6, 3);
      ctx.fillStyle = "#e0f2ff"; ctx.fillRect(x - 1 + Math.round(g * 2), y - 6, 1, 1);
      ctx.fillStyle = "#5a3020"; ctx.fillRect(x - 3, y - 13, 6, 1);
      if (dmg > 0.3) { ctx.fillStyle = "#140c10"; ctx.fillRect(x + 1, y - 9, 1, 3); }
    }
  } else {   // bụi cây: 3 khối lá tròn chồng nhau, lắc nhẹ theo gió
    const sway = Math.round(Math.sin(t * 1.6 + o.seed * 7) * 1), k = Math.max(0.55, 1 - dmg * 0.45);
    ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.beginPath(); ctx.ellipse(x, y, 11 * k, 3, 0, 0, Math.PI * 2); ctx.fill();
    const blob = (bx, by, r, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(bx, by, r, 0, Math.PI * 2); ctx.fill(); };
    const c0 = f ? "#ffffff" : pal[0], c1 = f ? "#ffffff" : pal[1], c2 = f ? "#ffffff" : pal[2];
    blob(x - 5 * k, y - 5, 6 * k, c0); blob(x + 5 * k, y - 5, 6 * k, c0); blob(x + sway, y - 9 * k, 7 * k, c0);
    blob(x - 5 * k, y - 6, 5 * k, c1); blob(x + 5 * k, y - 6, 5 * k, c1); blob(x + sway, y - 10 * k, 6 * k, c1);
    blob(x - 1 + sway, y - 12 * k, 3 * k, c2); blob(x - 6 * k, y - 8, 2 * k, c2);
    if (!f && o.seed > 0.55) { ctx.fillStyle = pal[3]; ctx.fillRect(x + 3, y - 9, 1, 1); ctx.fillRect(x - 4, y - 11, 1, 1); }
  }
}

// =====================================================================================
//  CAMERA — bám theo nhân vật mượt (lerp) và không bao giờ lộ vùng ngoài bản đồ (clamp)
// =====================================================================================
export class Camera {
  constructor(viewW, viewH) {
    this.w = viewW; this.h = viewH;
    this.x = 0; this.y = 0;
    this.shakeTime = 0; this.shakeAmp = 0;
    this.ox = 0; this.oy = 0;   // độ lệch rung màn hình của frame hiện tại
    this.kx = 0; this.ky = 0;   // rung CÓ HƯỚNG (giật theo hướng bắn / hướng vụ nổ), tắt dần
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
  /** Rung có hướng: khung hình bị "đẩy" theo góc `angle` rồi bật về (dùng cho giật súng, vụ nổ) */
  kick(angle, amp) {
    this.kx = Math.max(-8, Math.min(8, this.kx + Math.cos(angle) * amp));
    this.ky = Math.max(-8, Math.min(8, this.ky + Math.sin(angle) * amp));
  }

  updateShake(dt) {
    const d = Math.exp(-16 * dt);
    this.kx *= d; this.ky *= d;
    if (this.shakeTime > 0) {
      this.shakeTime -= dt;
      this.ox = Math.round((Math.random() - 0.5) * 2 * this.shakeAmp - this.kx);
      this.oy = Math.round((Math.random() - 0.5) * 2 * this.shakeAmp - this.ky);
    } else { this.shakeAmp = 0; this.ox = Math.round(-this.kx); this.oy = Math.round(-this.ky); }
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
const GRID = 64;   // ô lưới va chạm tĩnh (pixel)

export class World {
  /** @param biome 1 phần tử của BIOMES   @param images ảnh đã tải (dùng floorTile nếu bạn có chèn) */
  constructor(biome, images = {}) {
    this.biome = biome;
    this.images = images;
    this.time = 0;
    this.spawn = { x: WORLD.w / 2, y: WORLD.h / 2 + 20 };

    this.solids = [];    // tường + cột đá + lò lửa: chặn người, quái và đạn
    this.pits = [];      // hố nham thạch: chặn người & quái đi bộ, đạn bay qua được
    this.pools = [];     // vũng axit (hình tròn)
    this.traps = [];     // bẫy phun lửa
    this.hands = [];     // bàn tay ma (Nghĩa Trang)
    this.barrels = [];   // thùng thuốc nổ
    this.crystals = [];  // tinh thể băng (phá được)
    this.props = [];     // thùng gỗ / lọ năng lượng / bụi cây (phá được, chắn đạn)
    this.braziers = [];  // lò lửa (vật cản tỏa sáng)
    this.shrines = [];   // đền thờ ban phước
    this.torches = [];   // đuốc gắn trên tường bao
    this.lights = [];    // nguồn sáng tĩnh { x, y, r, color, flicker }

    this.generate();
    this.buildGrid();
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

    // Cột đá / nấm khổng lồ / tảng bazan / cột băng / bia mộ
    const style = this.biome.pillarStyle;
    for (let i = 0; i < c.pillars; i++) {
      let w, h;
      if (style === "stone" && Math.random() < 0.25) { w = randInt(18, 26) * 4; h = 24; }          // tường đá dài
      else if (style === "tomb") {
        if (Math.random() < 0.18) { w = randInt(12, 16) * 4; h = randInt(9, 11) * 4; }            // hầm mộ lớn
        else { w = randInt(4, 5) * 4; h = 12; }                                                    // bia mộ nhỏ
      } else { w = randInt(7, 11) * 4; h = w; }
      this.placeRect(w, h, (r) => { r.style = style === "tomb" ? (w <= 20 ? "grave" : "crypt") : style; r.seed = Math.random(); this.solids.push(r); }, safe, style === "tomb" ? 34 : 50);
    }
    // Lò lửa (vật cản nhỏ, tỏa sáng)
    for (let i = 0; i < (c.braziers ?? 0); i++) {
      this.placeRect(14, 12, (r) => { r.style = "brazier"; r.seed = Math.random(); this.solids.push(r); this.braziers.push(r); }, safe, 70);
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

    // Bẫy phun lửa / bàn tay ma (mỗi cái lệch pha ngẫu nhiên để không kích hoạt cùng lúc)
    for (let i = 0; i < c.traps; i++) {
      const p = this.randomFreePoint({ margin: 24, avoid: safe });
      if (p) this.traps.push({ x: p.x, y: p.y, phase: Math.random() * ENV.trap.period, burnTick: 0 });
    }
    for (let i = 0; i < (c.hands ?? 0); i++) {
      const p = this.randomFreePoint({ margin: 26, avoid: inflate(safe, 40) });
      if (p) this.hands.push({ x: p.x, y: p.y, phase: Math.random() * ENV.hands.period, fired: false });
    }
    // Đền thờ ban phước (cách xa nhau và xa điểm xuất phát)
    for (let i = 0; i < (c.shrines ?? 0); i++) {
      for (let tries = 0; tries < 30; tries++) {
        const p = this.randomFreePoint({ margin: 22, avoid: inflate(safe, 160) });
        if (!p || this.shrines.some((s) => (s.x - p.x) ** 2 + (s.y - p.y) ** 2 < 600 * 600)) continue;
        this.shrines.push({ x: p.x, y: p.y, r: ENV.shrine.r, cool: 0, seed: Math.random() });
        break;
      }
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

    // Thùng gỗ (hay đứng thành cụm 2-3 cái), lọ năng lượng, bụi cây
    const P = ENV.props, addProp = (kind, x, y) => this.props.push({ x, y, kind, r: P[kind].r, cy: P[kind].cy, hp: P[kind].hp, max: P[kind].hp, dead: false, flash: 0, seed: Math.random() });
    for (const [kind, n] of [["crate", c.crates ?? 0], ["jar", c.jars ?? 0], ["bush", c.bushes ?? 0]]) {
      for (let i = 0; i < n; i++) {
        const p = this.randomFreePoint({ margin: P[kind].r + 8, avoid: safe });
        if (!p) continue;
        addProp(kind, p.x, p.y);
        if (kind === "crate") for (const [ox, oy] of [[15, 0], [7, 11]]) if (Math.random() < 0.45 && this.isFree(p.x + ox, p.y + oy, P.crate.r + 2)) addProp("crate", p.x + ox, p.y + oy);
      }
    }

    // Đuốc trên tường bao phía trên (mỗi ~150px) + 2 bên
    const tc = this.biome.torch ?? "#ffb04a";
    for (let x = 90; x < W.w - 60; x += randInt(130, 170)) this.torches.push({ x, y: W.wallTop - 18, side: "top", seed: Math.random() });
    for (let y = 160; y < W.h - 80; y += randInt(200, 260)) { this.torches.push({ x: W.wall + 3, y, side: "left", seed: Math.random() }); this.torches.push({ x: W.w - W.wall - 3, y, side: "right", seed: Math.random() }); }
    // --- Nguồn sáng tĩnh ---
    for (const t of this.torches) this.lights.push({ x: t.x, y: t.y + (t.side === "top" ? 12 : 0), r: 78, color: tc, flicker: t.seed * 10 });
    for (const b of this.braziers) this.lights.push({ x: b.x + b.w / 2, y: b.y, r: 90, color: tc, flicker: b.seed * 10 });
    for (const p of this.pits) {   // dung nham tỏa sáng: chấm sáng dọc theo hố
      const n = Math.max(1, Math.round(Math.max(p.w, p.h) / 70));
      for (let i = 0; i < n; i++) this.lights.push({ x: p.x + (p.w > p.h ? (i + 0.5) * (p.w / n) : p.w / 2), y: p.y + (p.w > p.h ? p.h / 2 : (i + 0.5) * (p.h / n)), r: 74, color: "#ff6a1e", flicker: Math.random() * 10 });
    }
    for (const p of this.pools) this.lights.push({ x: p.x, y: p.y, r: p.r + 26, color: "#7cff4a", flicker: p.seed });
    for (const c2 of this.crystals) this.lights.push({ x: c2.x, y: c2.y - 10, r: 44, color: "#7cd8ff", flicker: c2.seed * 10, crystal: c2 });
    for (const s of this.shrines) this.lights.push({ x: s.x, y: s.y - 10, r: 60, color: "#ffe26b", flicker: s.seed * 10, shrine: s });
    for (const j of this.props) if (j.kind === "jar") this.lights.push({ x: j.x, y: j.y - 5, r: 26, color: "#4aa8ff", flicker: j.seed * 10, prop: j });
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

  /** Điểm (x, y) với bán kính r có trống hoàn toàn (không tường, hố, axit, thùng, tinh thể, bẫy, đền) */
  isFree(x, y, r) {
    if (this.solids.some((s) => circleRect(x, y, r, s))) return false;
    if (this.pits.some((s) => circleRect(x, y, r, s))) return false;
    const near = (ox, oy, rr) => (ox - x) * (ox - x) + (oy - y) * (oy - y) < rr * rr;   // khoảng cách bình phương
    if (this.pools.some((p) => near(p.x, p.y, p.r + r))) return false;
    if (this.traps.some((t) => near(t.x, t.y, ENV.trap.r + r + 6))) return false;
    if (this.hands.some((t) => near(t.x, t.y, ENV.hands.r + r + 6))) return false;
    if (this.shrines.some((t) => near(t.x, t.y, t.r + r + 8))) return false;
    if (this.barrels.some((b) => !b.dead && near(b.x, b.y, b.r + r + 4))) return false;
    if (this.crystals.some((c) => !c.dead && near(c.x, c.y, c.r + r + 4))) return false;
    if (this.props.some((c) => !c.dead && near(c.x, c.y, c.r + r + 3))) return false;
    return true;
  }

  // ---------------------------------------------------------------- LƯỚI VA CHẠM TĨNH
  /** Xếp tường/cột (và hố dung nham) vào lưới ô 64px — gọi 1 lần sau khi sinh bản đồ */
  buildGrid() {
    this.gcols = Math.ceil(WORLD.w / GRID); this.grows = Math.ceil(WORLD.h / GRID);
    const mk = () => Array.from({ length: this.gcols * this.grows }, () => []);
    this.gSolid = mk(); this.gGround = mk();
    const put = (grid, b) => {
      const x0 = clamp((b.x / GRID) | 0, 0, this.gcols - 1), x1 = clamp(((b.x + b.w) / GRID) | 0, 0, this.gcols - 1);
      const y0 = clamp((b.y / GRID) | 0, 0, this.grows - 1), y1 = clamp(((b.y + b.h) / GRID) | 0, 0, this.grows - 1);
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) grid[y * this.gcols + x].push(b);
    };
    for (const s of this.solids) { put(this.gSolid, s); put(this.gGround, s); }
    for (const p of this.pits) put(this.gGround, p);
    this.stamp = 0;
    this.qBoxes = []; this.qBoxes2 = [];
  }
  /** Các hộp (tường/cột, + hố nếu ground) chạm vùng chữ nhật (x0,y0)-(x1,y1). out: mảng dùng lại */
  boxesIn(x0, y0, x1, y1, ground, out) {
    out.length = 0;
    const st = ++this.stamp, grid = ground ? this.gGround : this.gSolid;
    const cx0 = clamp((x0 / GRID) | 0, 0, this.gcols - 1), cx1 = clamp((x1 / GRID) | 0, 0, this.gcols - 1);
    const cy0 = clamp((y0 / GRID) | 0, 0, this.grows - 1), cy1 = clamp((y1 / GRID) | 0, 0, this.grows - 1);
    for (let y = cy0; y <= cy1; y++) for (let x = cx0; x <= cx1; x++) {
      const cell = grid[y * this.gcols + x];
      for (let i = 0; i < cell.length; i++) { const b = cell[i]; if (b._st !== st) { b._st = st; out.push(b); } }
    }
    return out;
  }

  // ---------------------------------------------------------------- VA CHẠM
  /**
   * Di chuyển 1 thực thể (x, y = CHÂN) một đoạn (dx, dy) có trượt dọc tường.
   * Hộp va chạm: hình vuông nửa cạnh r quanh chân. flying = bay qua hố dung nham (dơi, ma, đầu lâu).
   * Trả về true nếu bị chặn ở trục nào đó.
   */
  moveBody(e, dx, dy, r, flying = false) {
    let blocked = false;
    const pad = r + 4;
    const boxes = this.boxesIn(Math.min(e.x, e.x + dx) - pad, Math.min(e.y, e.y + dy) - r * 1.2 - 4, Math.max(e.x, e.x + dx) + pad, Math.max(e.y, e.y + dy) + 4, !flying, this.qBoxes);
    // trục X
    if (dx) {
      e.x += dx;
      for (let i = 0; i < boxes.length; i++) {
        const s = boxes[i];
        if (e.x + r > s.x && e.x - r < s.x + s.w && e.y > s.y && e.y - r * 1.2 < s.y + s.h) {
          e.x = dx > 0 ? s.x - r : s.x + s.w + r;
          blocked = true;
        }
      }
    }
    // trục Y (hộp từ chân lên trên 1.2r)
    if (dy) {
      e.y += dy;
      for (let i = 0; i < boxes.length; i++) {
        const s = boxes[i];
        if (e.x + r > s.x && e.x - r < s.x + s.w && e.y > s.y && e.y - r * 1.2 < s.y + s.h) {
          e.y = dy > 0 ? s.y : s.y + s.h + r * 1.2;
          blocked = true;
        }
      }
    }
    // vật tròn: thùng nổ, tinh thể băng -> đẩy ra
    for (const o of this.barrels) if (!o.dead) blocked = pushOut(e, o, r) || blocked;
    for (const o of this.crystals) if (!o.dead) blocked = pushOut(e, o, r) || blocked;
    if (!flying) for (const o of this.props) if (!o.dead && (o.x - e.x) ** 2 + (o.y - e.y) ** 2 < (o.r + r + 2) ** 2) blocked = pushOut(e, o, r) || blocked;
    e.x = clamp(e.x, WORLD.wall + r, WORLD.w - WORLD.wall - r);
    e.y = clamp(e.y, WORLD.wallTop + r * 1.2, WORLD.h - WORLD.wall);
    return blocked;
  }

  /** Đạn (hình tròn) chạm gì? -> { kind: "solid" | "barrel" | "crystal", obj } hoặc null */
  bulletHit(x, y, r) {
    const boxes = this.boxesIn(x - r, y - r, x + r, y + r, false, this.qBoxes2);
    for (let i = 0; i < boxes.length; i++) if (circleRect(x, y, r, boxes[i])) return { kind: "solid", obj: boxes[i] };
    for (const b of this.barrels) if (!b.dead && (b.x - x) ** 2 + (b.y - 6 - y) ** 2 < (b.r + r) ** 2) return { kind: "barrel", obj: b };
    for (const c of this.crystals) if (!c.dead && (c.x - x) ** 2 + (c.y - 8 - y) ** 2 < (c.r + r) ** 2) return { kind: "crystal", obj: c };
    for (const c of this.props) if (!c.dead && (c.x - x) ** 2 + (c.y - c.cy - y) ** 2 < (c.r + r) ** 2) return { kind: "prop", obj: c };
    return null;
  }

  /** Có điểm đặc (tường/cột) tại (x, y) không — dùng cho đạn nảy tường */
  solidAt(x, y, r = 1) {
    const boxes = this.boxesIn(x - r, y - r, x + r, y + r, false, this.qBoxes2);
    for (let i = 0; i < boxes.length; i++) if (circleRect(x, y, r, boxes[i])) return true;
    return false;
  }
  /** Chân đứng được ở (x, y) không (không tường, không hố) */
  walkable(x, y, r = 6) {
    const boxes = this.boxesIn(x - r, y - r * 1.2, x + r, y, true, this.qBoxes2);
    for (let i = 0; i < boxes.length; i++) { const s = boxes[i]; if (x + r > s.x && x - r < s.x + s.w && y > s.y && y - r * 1.2 < s.y + s.h) return false; }
    return x > WORLD.wall + r && x < WORLD.w - WORLD.wall - r && y > WORLD.wallTop + r * 1.2 && y < WORLD.h - WORLD.wall;
  }

  /**
   * Bắn tia từ (x0,y0) tới (x1,y1): trả về t (0..1) của vật cản đầu tiên (tường, cột, tinh thể).
   * hits: danh sách thùng nổ / tinh thể tia đi qua trước khi bị chặn.
   */
  raycast(x0, y0, x1, y1) {
    let best = 1, stopper = null;
    const boxes = this.boxesIn(Math.min(x0, x1), Math.min(y0, y1), Math.max(x0, x1), Math.max(y0, y1), false, this.qBoxes2);
    for (let i = 0; i < boxes.length; i++) {
      const t = segRect(x0, y0, x1, y1, boxes[i]);
      if (t >= 0 && t < best) { best = t; stopper = null; }
    }
    for (const c of this.crystals) {
      if (c.dead) continue;
      const t = segCircle(x0, y0, x1, y1, c.x, c.y - 8, c.r);
      if (t >= 0 && t < best) { best = t; stopper = c; }
    }
    let prop = null;
    for (const c of this.props) {
      if (c.dead) continue;
      const t = segCircle(x0, y0, x1, y1, c.x, c.y - c.cy, c.r);
      if (t >= 0 && t < best) { best = t; stopper = null; prop = c; }
    }
    if (stopper) prop = null;
    const barrels = [];
    for (const b of this.barrels) {
      if (b.dead) continue;
      const t = segCircle(x0, y0, x1, y1, b.x, b.y - 6, b.r);
      if (t >= 0 && t <= best) barrels.push(b);
    }
    return { t: best, crystal: stopper, prop, barrels };
  }

  /** Có nhìn thấy nhau không (không tường/cột chắn giữa) */
  lineOfSight(x0, y0, x1, y1) {
    const boxes = this.boxesIn(Math.min(x0, x1), Math.min(y0, y1), Math.max(x0, x1), Math.max(y0, y1), false, this.qBoxes2);
    for (let i = 0; i < boxes.length; i++) if (segRect(x0, y0, x1, y1, boxes[i]) >= 0) return false;
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
  /** Bàn tay ma: "idle" | "warn" (vũng tối sủi bọt) | "grab" */
  handState(h) {
    const T = ENV.hands, u = (this.time + h.phase) % T.period;
    if (u >= T.period - T.grab) return "grab";
    if (u >= T.period - T.grab - T.warn) return "warn";
    return "idle";
  }

  update(dt) {
    this.time += dt;
    for (const b of this.barrels) b.flash = Math.max(0, b.flash - dt);
    for (const c of this.crystals) c.flash = Math.max(0, c.flash - dt);
    for (const c of this.props) c.flash = Math.max(0, c.flash - dt);
    for (const s of this.shrines) s.cool = Math.max(0, s.cool - dt);
  }

  // ---------------------------------------------------------------- VẼ
  /** Vẽ sẵn toàn bộ nền tĩnh (sàn, trang trí, tường, cột, hố, vũng axit) vào 1 canvas lớn — mỗi frame chỉ việc cắt 1 khung */
  renderStatic() {
    const cv = document.createElement("canvas");
    cv.width = WORLD.w; cv.height = WORLD.h;
    const g = cv.getContext("2d");
    g.imageSmoothingEnabled = false;
    const B = this.biome;

    // --- Sàn (lớp con ghi đè paintFloor) ---
    this.paintFloor(g);

    // --- Hố dung nham ---
    for (const p of this.pits) {
      g.fillStyle = "#1a0705"; g.fillRect(p.x - 4, p.y - 4, p.w + 8, p.h + 8);
      g.fillStyle = "#3a120c"; g.fillRect(p.x - 2, p.y - 2, p.w + 4, p.h + 4);
      g.fillStyle = "#8a1e0c"; g.fillRect(p.x, p.y, p.w, p.h);
      for (let i = 0; i < (p.w * p.h) / 40; i++) {
        g.fillStyle = pick(["#c9381a", "#c9381a", "#f2561d", "#ff8a2a", "#ffc23d"]);
        g.fillRect(p.x + rand(0, p.w - 4), p.y + rand(0, p.h - 2), randInt(2, 7), randInt(1, 2));
      }
      g.fillStyle = "#3a120c"; g.fillRect(p.x, p.y, p.w, 4);   // mép trên tối tạo chiều sâu
      g.fillStyle = "#5a1c0e"; g.fillRect(p.x, p.y + 4, p.w, 1);
      // đá viền mép hố
      for (let x = p.x - 3; x < p.x + p.w + 3; x += randInt(5, 9)) { g.fillStyle = pick(["#2a1210", "#3a1a16", "#4a2a24"]); g.fillRect(x, p.y - 4, randInt(3, 6), 3); g.fillRect(x, p.y + p.h + 1, randInt(3, 6), 3); }
    }

    // --- Vũng axit ---
    for (const p of this.pools) {
      g.fillStyle = "#0c2a10";
      ellipse(g, p.x, p.y, p.r + 4, (p.r + 4) * 0.8);
      g.fillStyle = "#1c5a1a";
      ellipse(g, p.x, p.y, p.r + 1, (p.r + 1) * 0.8);
      g.fillStyle = "#2f8f2a";
      ellipse(g, p.x, p.y + 1, p.r - 1, (p.r - 1) * 0.78);
      g.fillStyle = "#56d23a";
      ellipse(g, p.x - p.r * 0.15, p.y - p.r * 0.12, p.r * 0.7, p.r * 0.5);
      g.fillStyle = "#a6f06a";
      g.fillRect(p.x - p.r * 0.4, p.y - p.r * 0.4, 5, 1); g.fillRect(p.x - p.r * 0.45, p.y - p.r * 0.3, 2, 1);
      // nấm & cỏ chết quanh mép
      for (let i = 0; i < 5; i++) { const a = rand(0, TAU); g.fillStyle = pick(["#3c5a2c", "#8a2e3e", "#c8b48a"]); g.fillRect(p.x + Math.cos(a) * (p.r + 6), p.y + Math.sin(a) * (p.r + 5) * 0.8, 2, 2); }
    }

    // --- Bệ bẫy lửa ---
    for (const t of this.traps) {
      g.fillStyle = "#120807"; g.fillRect(t.x - 10, t.y - 8, 20, 16);
      g.fillStyle = "#4a3434"; g.fillRect(t.x - 9, t.y - 7, 18, 14);
      g.fillStyle = "#5c4444"; g.fillRect(t.x - 9, t.y - 7, 18, 2);
      g.fillStyle = "#1c0c0b";
      for (let i = -6; i <= 6; i += 4) g.fillRect(t.x + i, t.y - 4, 2, 9);
      g.fillStyle = "#7a2412"; g.fillRect(t.x - 9, t.y + 5, 18, 1);
    }
    // --- Mộ đất của bàn tay ma ---
    for (const h of this.hands) {
      g.fillStyle = "#0e0f12"; ellipse(g, h.x, h.y, 21, 9);
      g.fillStyle = "#2a2622"; ellipse(g, h.x, h.y - 1, 18, 7);
      g.fillStyle = "#3a342c"; ellipse(g, h.x - 2, h.y - 2, 12, 4);
      for (let i = 0; i < 6; i++) { g.fillStyle = pick(["#4a4238", "#1a1814", "#5a5048"]); g.fillRect(h.x + rand(-16, 14), h.y + rand(-6, 4), 2, 1); }
    }

    // --- Bóng đổ của vật cản (vẽ trước, dưới cột) ---
    for (const s of this.solids) {
      if (s.wall) continue;
      g.fillStyle = "rgba(0,0,0,0.28)"; g.fillRect(s.x + 2, s.y + s.h - 1, s.w + 2, 6);
      g.fillStyle = "rgba(0,0,0,0.16)"; g.fillRect(s.x + 4, s.y + s.h + 5, s.w, 3);
    }
    // --- Cột / vật cản ---
    for (const s of this.solids) {
      if (s.wall) continue;
      drawPillar(g, s, B);
    }

    // --- Tường bao ---
    this.paintWalls(g);
    return cv;
  }

  /** Vẽ sàn: ảnh floorTile lặp kín, hoặc bộ vẽ theo biome + đồ trang trí */
  paintFloor(g) {
    const B = this.biome, tile = this.images.floorTile;
    if (tile) {
      // >>> ẢNH SÀN CỦA BẠN (assets floorTile) được lặp kín bản đồ ở đây
      g.fillStyle = g.createPattern(tile, "repeat");
      g.fillRect(0, 0, WORLD.w, WORLD.h);
    } else {
      (FLOOR_PAINTERS[B.id] ?? FLOOR_PAINTERS.dungeon)(g, B);
      this.paintDecor(g);
    }
  }

  /** Đồ trang trí rải rác trên sàn (không va chạm): xương, đầu lâu, thảm, nấm, hoa, đá vụn, tuyết đọng... */
  paintDecor(g) {
    const B = this.biome, n = Math.round((WORLD.w * WORLD.h) / 9000);
    const free = (x, y, r) => !this.solids.some((s) => circleRect(x, y, r, s)) && !this.pits.some((s) => circleRect(x, y, r + 4, s)) && !this.pools.some((p) => (p.x - x) ** 2 + (p.y - y) ** 2 < (p.r + r + 4) ** 2);
    const kinds = DECOR[B.id] ?? DECOR.dungeon;
    // thảm đỏ / lối đá lớn (vài cái)
    if (B.id === "dungeon") for (let i = 0; i < 7; i++) {
      const w = randInt(5, 9) * 16, h = randInt(3, 5) * 16, x = randInt(4, (WORLD.w - w) / 16 - 4) * 16, y = randInt(5, (WORLD.h - h) / 16 - 4) * 16;
      if (!free(x + w / 2, y + h / 2, Math.max(w, h) / 2)) continue;
      drawRug(g, x, y, w, h);
    }
    for (let i = 0; i < n; i++) {
      const x = rand(40, WORLD.w - 40), y = rand(WORLD.wallTop + 16, WORLD.h - 30);
      if (!free(x, y, 6)) continue;
      DECOR_DRAW[pick(kinds)](g, Math.round(x), Math.round(y));
    }
  }

  /** Tường bao: gạch tô bóng từng viên, mặt tường, chân tường đổ bóng xuống sàn, trang trí theo biome */
  paintWalls(g) {
    const B = this.biome, Wc = B.wall, W = WORLD;
    // bóng đổ của tường xuống sàn (ambient occlusion)
    for (let i = 0; i < 14; i++) {
      g.fillStyle = `rgba(0,0,0,${0.32 * (1 - i / 14)})`;
      g.fillRect(W.wall, W.wallTop + i, W.w - W.wall * 2, 1);
      g.fillRect(W.wall + i, W.wallTop, 1, W.h - W.wallTop - W.wall);
      g.fillRect(W.w - W.wall - 1 - i, W.wallTop, 1, W.h - W.wallTop - W.wall);
      g.fillRect(W.wall, W.h - W.wall - 1 - Math.floor(i / 2), W.w - W.wall * 2, 1);
    }
    g.fillStyle = Wc.dark;
    g.fillRect(0, 0, W.w, W.wallTop); g.fillRect(0, W.h - W.wall, W.w, W.wall);
    g.fillRect(0, 0, W.wall, W.h); g.fillRect(W.w - W.wall, 0, W.wall, W.h);
    // gạch tường trên: mỗi viên có cạnh sáng trên + cạnh tối dưới
    for (let y = 0; y < W.wallTop - 8; y += 8) {
      for (let x = ((y / 8) % 2) * -12; x < W.w; x += 24) {
        const shade = Math.random();
        g.fillStyle = shade < 0.15 ? Wc.face : Wc.base;
        g.fillRect(x + 1, y, 22, 7);
        g.fillStyle = withAlpha(Wc.top, 0.35); g.fillRect(x + 1, y, 22, 1);
        g.fillStyle = "rgba(0,0,0,0.25)"; g.fillRect(x + 1, y + 6, 22, 1);
        if (Math.random() < 0.08) { g.fillStyle = Wc.dark; g.fillRect(x + randInt(4, 18), y + 2, randInt(2, 4), 1); }
      }
    }
    // gạch tường dưới + 2 bên (nhìn từ trên xuống)
    const side = (x0, y0, w, h) => {
      for (let y = y0; y < y0 + h; y += 8) for (let x = x0 + (((y - y0) / 8) % 2) * 6; x < x0 + w; x += 12) {
        g.fillStyle = Math.random() < 0.15 ? Wc.face : Wc.base; g.fillRect(x, y + 1, 11, 6);
        g.fillStyle = withAlpha(Wc.top, 0.3); g.fillRect(x, y + 1, 11, 1);
      }
    };
    side(0, W.h - W.wall + 2, W.w, W.wall - 2);
    side(0, W.wallTop, W.wall - 2, W.h - W.wallTop);
    side(W.w - W.wall + 2, W.wallTop, W.wall - 2, W.h - W.wallTop);
    g.fillStyle = Wc.top;
    g.fillRect(W.wall - 4, W.wallTop - 10, W.w - W.wall * 2 + 8, 3);
    g.fillStyle = Wc.face;
    g.fillRect(W.wall, W.wallTop - 7, W.w - W.wall * 2, 7);
    for (let x = W.wall; x < W.w - W.wall; x += 16) { g.fillStyle = "rgba(0,0,0,0.25)"; g.fillRect(x, W.wallTop - 7, 1, 7); }
    g.fillStyle = Wc.top;                               // viền trong
    g.fillRect(W.wall - 2, W.wallTop - 10, 2, W.h - W.wallTop - W.wall + 12);
    g.fillRect(W.w - W.wall, W.wallTop - 10, 2, W.h - W.wallTop - W.wall + 12);
    g.fillRect(W.wall - 2, W.h - W.wall, W.w - W.wall * 2 + 4, 2);
    // trang trí tường theo biome (giữa các ngọn đuốc)
    for (let x = 60; x < W.w - 60; x += randInt(70, 120)) {
      if (this.torches.some((t) => t.side === "top" && Math.abs(t.x - x) < 26)) continue;
      WALL_DECOR[B.id]?.(g, x, W.wallTop - 10, Wc);
    }
    // giá đuốc (ngọn lửa vẽ động trong drawDynamic)
    for (const t of this.torches) {
      g.fillStyle = "#14101a";
      if (t.side === "top") { g.fillRect(t.x - 2, t.y + 2, 4, 9); g.fillStyle = "#5b5566"; g.fillRect(t.x - 3, t.y + 6, 6, 2); g.fillStyle = "#5a3520"; g.fillRect(t.x - 1, t.y - 2, 3, 6); }
      else { g.fillRect(t.x - 2, t.y - 2, 4, 6); g.fillStyle = "#5a3520"; g.fillRect(t.x - 1, t.y - 6, 3, 5); }
    }
  }

  /** Cắt đúng khung camera từ nền tĩnh (gọi khi ctx CHƯA dịch theo camera) */
  drawFloor(ctx, cam, viewW, viewH) {
    const sx = cam.rx, sy = cam.ry;
    const cx = clamp(sx, 0, WORLD.w - viewW), cy = clamp(sy, 0, WORLD.h - viewH);
    ctx.drawImage(this.floor, cx, cy, viewW, viewH, cx - sx, cy - sy, viewW, viewH);
  }

  /** Vẽ phần động (đuốc, lò lửa, bẫy, thùng, tinh thể, đền thờ, bọt axit, dung nham lấp lánh) — ctx ĐÃ dịch theo camera */
  drawDynamic(ctx, cam) {
    const t = this.time;
    // Dung nham lấp lánh + bọt nổ
    for (const p of this.pits) {
      if (!cam.inView(p.x + p.w / 2, p.y + p.h / 2, Math.max(p.w, p.h))) continue;
      ctx.fillStyle = withAlpha("#ffb03a", 0.12 + 0.1 * Math.sin(t * 3 + p.x));
      ctx.fillRect(p.x, p.y + 4, p.w, p.h - 4);
      for (let i = 0; i < 6; i++) {
        const u = (t * 0.6 + i * 0.17 + p.x * 0.001) % 1;
        ctx.fillStyle = i % 3 ? "#ffe26b" : "#ffffff";
        ctx.fillRect(Math.round(p.x + ((i * 97 + p.y) % p.w)), Math.round(p.y + 4 + (p.h - 6) * u), 2, 1);
      }
      const k = (t * 1.3 + p.x * 0.01) % 1, bx = p.x + ((p.y * 7 + Math.floor(t * 1.3 + p.x * 0.01) * 53) % Math.max(1, p.w - 6)) + 3, by = p.y + p.h * 0.5;
      ctx.fillStyle = withAlpha("#ffc23d", 1 - k); ctx.fillRect(Math.round(bx), Math.round(by - k * 4), k < 0.7 ? 2 : 3, k < 0.7 ? 2 : 1);
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
    // Đuốc trên tường + lò lửa: ngọn lửa pixel nhảy múa
    for (const tr of this.torches) if (cam.inView(tr.x, tr.y, 20)) drawSmallFlame(ctx, tr.x, tr.y - (tr.side === "top" ? 3 : 7), t + tr.seed * 7, this.biome.torch);
    for (const b of this.braziers) {
      if (!cam.inView(b.x, b.y, 30)) continue;
      drawSmallFlame(ctx, b.x + b.w / 2, b.y - 1, t + b.seed * 5, this.biome.torch, 1.6);
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
    // Bàn tay ma: cảnh báo (vũng tối sủi bọt tím) — lúc vồ thì main.js phát hiệu ứng "grasp"
    for (const h of this.hands) {
      if (!cam.inView(h.x, h.y, 50)) continue;
      const st = this.handState(h);
      if (st === "warn") {
        const k = Math.floor(t * 10) % 2;
        ctx.fillStyle = withAlpha("#7a3cc8", 0.25 + 0.15 * k);
        ctx.beginPath(); ctx.ellipse(h.x, h.y, ENV.hands.r, ENV.hands.r * 0.45, 0, 0, TAU); ctx.fill();
        for (let i = 0; i < 4; i++) { const u = (t * 2 + i / 4) % 1; ctx.fillStyle = withAlpha("#c48cff", 1 - u); ctx.fillRect(Math.round(h.x - 12 + i * 8), Math.round(h.y - u * 6), 2, 2); }
      }
    }
    // Đền thờ ban phước
    for (const s of this.shrines) if (cam.inView(s.x, s.y, 40)) drawShrine(ctx, s, t);
    // Thùng thuốc nổ
    for (const b of this.barrels) {
      if (b.dead || !cam.inView(b.x, b.y, 20)) continue;
      const lit = b.fuse >= 0 && Math.floor(t * 30) % 2 === 0;
      const x = Math.round(b.x), y = Math.round(b.y);
      ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.fillRect(x - 6, y - 1, 12, 3);
      ctx.fillStyle = "#0e0c14"; ctx.fillRect(x - 7, y - 15, 14, 15);
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
      if (Math.floor(t * 2 + c.seed * 6) % 5 === 0) { ctx.fillRect(x + 3, y - 14, 1, 1); ctx.fillRect(x + 2, y - 13, 3, 1); }
      // vết nứt theo số máu còn lại
      ctx.fillStyle = "#151a3d";
      if (c.hp < ENV.crystal.hp) ctx.fillRect(x + 1, y - 13, 1, 5);
      if (c.hp < ENV.crystal.hp - 1) { ctx.fillRect(x - 4, y - 9, 3, 1); ctx.fillRect(x + 3, y - 6, 1, 3); }
    }
    // Thùng gỗ / lọ năng lượng / bụi cây
    const bushPal = BUSH_COLORS[this.biome.id] ?? BUSH_COLORS.forest;
    for (const o of this.props) if (!o.dead && cam.inView(o.x, o.y, 24)) drawProp(ctx, o, t, bushPal);
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
  const dx = e.x - o.x, dy = e.y - o.y, min = o.r + r * 0.8, d2 = dx * dx + dy * dy;
  if (d2 >= min * min) return false;          // không chạm: thoát sớm, không tính căn
  const d = Math.sqrt(d2);
  if (d === 0) { e.x += min; return true; }
  e.x = o.x + (dx / d) * min; e.y = o.y + (dy / d) * min;
  return true;
}

export function ellipse(g, x, y, rx, ry) { g.beginPath(); g.ellipse(x, y, Math.max(1, rx), Math.max(1, ry), 0, 0, TAU); g.fill(); }

/** Pha màu "#rrggbb" sáng/tối theo k (-1..1) -> "#rrggbb" */
export function shade(h, k) {
  const v = parseInt(h.slice(1, 7), 16), f = (c) => clamp(Math.round(k >= 0 ? c + (255 - c) * k : c * (1 + k)), 0, 255).toString(16).padStart(2, "0");
  return `#${f((v >> 16) & 255)}${f((v >> 8) & 255)}${f(v & 255)}`;
}

// =====================================================================================
//  VẼ SÀN THEO BIOME
// =====================================================================================
export const FLOOR_PAINTERS = {
  /** Hầm ngục: gạch đá 16px vát cạnh, mỗi viên 1 tông, nứt vỡ, rêu góc, viên gạch lõm */
  dungeon(g, B) {
    const F = B.floor, T = 16;
    for (let y = 0; y < WORLD.h; y += T) for (let x = 0; x < WORLD.w; x += T) {
      const base = (((x / T) + (y / T)) % 2 === 0 ? F.a : F.b), v = rand(-0.06, 0.05), col = shade(base, v);
      g.fillStyle = F.line; g.fillRect(x, y, T, T);
      g.fillStyle = col; g.fillRect(x + 1, y + 1, T - 1, T - 1);
      g.fillStyle = shade(col, 0.1); g.fillRect(x + 1, y + 1, T - 2, 1); g.fillRect(x + 1, y + 1, 1, T - 2);
      g.fillStyle = shade(col, -0.18); g.fillRect(x + 2, y + T - 1, T - 2, 1); g.fillRect(x + T - 1, y + 2, 1, T - 2);
      const r = Math.random();
      if (r < 0.05) { g.fillStyle = shade(col, -0.3); let cx = x + randInt(3, 8), cy = y + randInt(3, 8); for (let k = 0; k < 6; k++) { g.fillRect(cx, cy, 1, 1); cx += randInt(0, 1); cy += randInt(0, 1); } }
      else if (r < 0.08) { g.fillStyle = "#2c3a2a"; g.fillRect(x + 1, y + T - 4, randInt(3, 6), 3); g.fillStyle = "#3a5232"; g.fillRect(x + 1, y + T - 3, 2, 1); }
      else if (r < 0.095) { g.fillStyle = shade(col, -0.35); g.fillRect(x + 2, y + 2, T - 3, T - 3); g.fillStyle = shade(col, -0.2); g.fillRect(x + 2, y + 2, T - 3, 2); }
      else if (r < 0.25) { g.fillStyle = pick(F.dots); g.fillRect(x + randInt(3, 12), y + randInt(3, 12), randInt(1, 3), 1); }
    }
  },
  /** Rừng độc: nền rêu, cỏ 3 tông, mảng đất, sỏi */
  forest(g, B) {
    const F = B.floor;
    g.fillStyle = F.b; g.fillRect(0, 0, WORLD.w, WORLD.h);
    for (let i = 0; i < 2600; i++) { g.fillStyle = withAlpha(pick([F.a, "#23301f", "#192316"]), 0.9); ellipse(g, rand(0, WORLD.w), rand(0, WORLD.h), rand(6, 22), rand(4, 12)); }
    for (let i = 0; i < 70; i++) {   // mảng đất
      const x = rand(0, WORLD.w), y = rand(0, WORLD.h), r = rand(14, 40);
      g.fillStyle = "#241c14"; ellipse(g, x, y, r, r * 0.6);
      g.fillStyle = "#2e2418"; ellipse(g, x - 2, y - 1, r * 0.8, r * 0.45);
      for (let k = 0; k < 6; k++) { g.fillStyle = pick(["#4a3e30", "#1a140e"]); g.fillRect(x + rand(-r * 0.7, r * 0.7), y + rand(-r * 0.3, r * 0.3), 2, 1); }
    }
    for (let i = 0; i < 9000; i++) {   // ngọn cỏ
      g.fillStyle = pick(["#2f4a26", "#3c5a2c", "#25391e", "#4a6a34"]);
      const x = rand(0, WORLD.w), y = rand(0, WORLD.h);
      g.fillRect(x, y, 1, 2); if (Math.random() < 0.5) g.fillRect(x + 1, y - 1, 1, 2);
    }
  },
  /** Dung nham: phiến bazan lệch hàng, khe tối, vết nứt phát sáng, tro */
  lava(g, B) {
    const F = B.floor;
    g.fillStyle = F.line; g.fillRect(0, 0, WORLD.w, WORLD.h);
    for (let y = 0, row = 0; y < WORLD.h; y += 20, row++) {
      for (let x = -(row % 2) * 14; x < WORLD.w; x += 28) {
        const col = shade(Math.random() < 0.5 ? F.a : F.b, rand(-0.08, 0.08));
        g.fillStyle = col; g.fillRect(x + 1, y + 1, 26, 18);
        g.fillStyle = shade(col, 0.12); g.fillRect(x + 1, y + 1, 26, 1);
        g.fillStyle = shade(col, -0.25); g.fillRect(x + 1, y + 18, 26, 1);
      }
    }
    for (let i = 0; i < 320; i++) {   // vết nứt phát sáng
      let x = rand(0, WORLD.w), y = rand(0, WORLD.h);
      const hot = Math.random() < 0.35;
      for (let k = 0; k < randInt(4, 14); k++) {
        g.fillStyle = hot ? (k % 4 ? "#ff6a1e" : "#ffc23d") : "#7a2412";
        g.fillRect(Math.round(x), Math.round(y), 2, 1); x += rand(-1, 3); y += rand(-1.5, 1.5);
      }
    }
    for (let i = 0; i < 1600; i++) { g.fillStyle = pick(F.dots); g.fillRect(rand(0, WORLD.w), rand(0, WORLD.h), 1, 1); }
  },
  /** Băng giá: ô băng xanh nhạt, vết nứt băng, ánh lấp lánh, gò tuyết */
  ice(g, B) {
    const F = B.floor, T = 16;
    for (let y = 0; y < WORLD.h; y += T) for (let x = 0; x < WORLD.w; x += T) {
      const col = shade(((x / T) + (y / T)) % 2 === 0 ? F.a : F.b, rand(-0.03, 0.03));
      g.fillStyle = col; g.fillRect(x, y, T, T);
      g.fillStyle = F.line; g.fillRect(x, y, T, 1); g.fillRect(x, y, 1, T);
    }
    for (let i = 0; i < 160; i++) {   // vết nứt băng
      let x = rand(0, WORLD.w), y = rand(0, WORLD.h);
      g.fillStyle = "#7aa2bc";
      for (let k = 0; k < randInt(6, 18); k++) { g.fillRect(Math.round(x), Math.round(y), 1, 1); x += rand(-1.5, 1.5); y += rand(-1.5, 1.5); }
    }
    for (let i = 0; i < 90; i++) {   // gò tuyết
      const x = rand(0, WORLD.w), y = rand(0, WORLD.h), r = rand(10, 30);
      g.fillStyle = "#e8f6ff"; ellipse(g, x, y, r, r * 0.45);
      g.fillStyle = "#ffffff"; ellipse(g, x - r * 0.2, y - 2, r * 0.6, r * 0.2);
      g.fillStyle = "#bcdcec"; g.fillRect(x - r * 0.6, y + r * 0.35, r * 1.2, 1);
    }
    for (let i = 0; i < 700; i++) { g.fillStyle = withAlpha("#ffffff", rand(0.3, 0.9)); g.fillRect(rand(0, WORLD.w), rand(0, WORLD.h), randInt(1, 6), 1); }
  },
  /** Nghĩa trang: đất tối + cỏ úa, lối đá lát, xương rải rác */
  grave(g, B) {
    const F = B.floor;
    g.fillStyle = F.b; g.fillRect(0, 0, WORLD.w, WORLD.h);
    for (let i = 0; i < 2200; i++) { g.fillStyle = withAlpha(pick([F.a, "#1c201a", "#262a24", "#1a1c20"]), 0.85); ellipse(g, rand(0, WORLD.w), rand(0, WORLD.h), rand(6, 24), rand(4, 12)); }
    // lối đi lát đá
    for (let p = 0; p < 9; p++) {
      let x = rand(100, WORLD.w - 100), y = rand(100, WORLD.h - 100);
      const horiz = Math.random() < 0.5, len = randInt(10, 26);
      for (let k = 0; k < len; k++) {
        const w = randInt(10, 14), h = randInt(7, 9), col = shade("#4a4c54", rand(-0.15, 0.1));
        g.fillStyle = "#121418"; g.fillRect(x - 1, y - 1, w + 2, h + 2);
        g.fillStyle = col; g.fillRect(x, y, w, h);
        g.fillStyle = shade(col, 0.15); g.fillRect(x, y, w, 1);
        if (horiz) { x += w + 3; y += randInt(-2, 2); } else { y += h + 3; x += randInt(-2, 2); }
      }
    }
    for (let i = 0; i < 7000; i++) {   // cỏ úa
      g.fillStyle = pick(["#3a4030", "#2c3226", "#4a4a34", "#22281e"]);
      const x = rand(0, WORLD.w), y = rand(0, WORLD.h);
      g.fillRect(x, y, 1, 2);
    }
  },
};

/** Loại đồ trang trí theo biome */
const DECOR = {
  dungeon: ["bones", "skull", "pebbles", "crack", "crack", "candle", "puddle", "chain"],
  forest: ["flower", "flower", "mushroom", "pebbles", "leaves", "leaves", "twig", "fern"],
  lava: ["pebbles", "ash", "ash", "bones", "skull", "ember"],
  ice: ["snowpile", "pebbles", "icicle", "crack", "bones"],
  grave: ["bones", "bones", "skull", "candle", "flowerDead", "pebbles", "crossSmall", "twig"],
};
export const DECOR_DRAW = {
  bones(g, x, y) { g.fillStyle = "#1a1620"; g.fillRect(x - 4, y + 1, 9, 1); g.fillStyle = "#d8d0bc"; g.fillRect(x - 4, y, 8, 1); g.fillRect(x - 5, y - 1, 2, 3); g.fillRect(x + 3, y - 1, 2, 3); if (Math.random() < 0.5) { g.fillRect(x - 1, y + 2, 1, 4); } },
  skull(g, x, y) { g.fillStyle = "#1a1620"; g.fillRect(x - 3, y - 2, 7, 6); g.fillStyle = "#e8e0cc"; g.fillRect(x - 3, y - 3, 6, 5); g.fillRect(x - 2, y + 2, 4, 1); g.fillStyle = "#2a2028"; g.fillRect(x - 2, y - 1, 2, 2); g.fillRect(x + 1, y - 1, 1, 2); },
  pebbles(g, x, y) { for (let i = 0; i < 4; i++) { const px = x + randInt(-5, 5), py = y + randInt(-3, 3); g.fillStyle = "rgba(0,0,0,0.3)"; g.fillRect(px, py + 1, 2, 1); g.fillStyle = pick(["#6a6478", "#4a4458", "#8a8496"]); g.fillRect(px, py, 2, 1); } },
  crack(g, x, y) { g.fillStyle = "rgba(0,0,0,0.35)"; let cx = x, cy = y; for (let k = 0; k < 9; k++) { g.fillRect(cx, cy, 1, 1); cx += randInt(-1, 1); cy += randInt(0, 1); } },
  candle(g, x, y) { g.fillStyle = "#1a1620"; g.fillRect(x - 2, y - 5, 4, 6); g.fillStyle = "#e8e0cc"; g.fillRect(x - 1, y - 5, 2, 5); g.fillStyle = "#ffc23d"; g.fillRect(x - 1, y - 7, 1, 2); g.fillStyle = "#fff3a6"; g.fillRect(x - 1, y - 7, 1, 1); g.fillStyle = "rgba(255,200,80,0.15)"; ellipse(g, x, y - 5, 6, 5); },
  puddle(g, x, y) { g.fillStyle = "rgba(20,30,60,0.45)"; ellipse(g, x, y, randInt(5, 10), randInt(2, 4)); g.fillStyle = "rgba(160,190,255,0.25)"; g.fillRect(x - 3, y - 1, 3, 1); },
  chain(g, x, y) { g.fillStyle = "#5b5566"; for (let i = 0; i < 5; i++) g.fillRect(x + i * 2, y + (i % 2), 2, 1); },
  flower(g, x, y) { const c = pick(["#ff7ad8", "#ffe26b", "#c48cff", "#ff5a5a", "#ffffff"]); g.fillStyle = "#2f4a26"; g.fillRect(x, y, 1, 3); g.fillStyle = c; g.fillRect(x - 1, y - 1, 3, 1); g.fillRect(x, y - 2, 1, 3); g.fillStyle = "#fff3a6"; g.fillRect(x, y - 1, 1, 1); },
  mushroom(g, x, y) { g.fillStyle = "#c8b48a"; g.fillRect(x, y - 2, 2, 3); g.fillStyle = pick(["#c8343f", "#8a2e3e", "#c86a20"]); g.fillRect(x - 2, y - 4, 6, 2); g.fillRect(x - 1, y - 5, 4, 1); g.fillStyle = "#ffffff"; g.fillRect(x, y - 4, 1, 1); },
  leaves(g, x, y) { for (let i = 0; i < 4; i++) { g.fillStyle = pick(["#5a7a2a", "#8a6a2a", "#3a5a20", "#a07a30"]); g.fillRect(x + randInt(-6, 6), y + randInt(-3, 3), 2, 1); } },
  twig(g, x, y) { g.fillStyle = "#4a3420"; for (let i = 0; i < 6; i++) g.fillRect(x + i, y + Math.floor(i / 3), 1, 1); g.fillRect(x + 2, y - 1, 1, 1); },
  fern(g, x, y) { g.fillStyle = "#3c6a2c"; for (let i = -3; i <= 3; i++) g.fillRect(x + i, y - Math.abs(i) * 0.6 - 1, 1, 2); g.fillStyle = "#5a8a3a"; g.fillRect(x, y - 3, 1, 3); },
  ash(g, x, y) { for (let i = 0; i < 5; i++) { g.fillStyle = pick(["#3a2a28", "#5a4a46", "#1c0c0b"]); g.fillRect(x + randInt(-6, 6), y + randInt(-3, 3), randInt(1, 3), 1); } },
  ember(g, x, y) { g.fillStyle = "#1c0c0b"; ellipse(g, x, y, 6, 3); g.fillStyle = "#ff6a1e"; g.fillRect(x - 2, y, 2, 1); g.fillStyle = "#ffc23d"; g.fillRect(x + 1, y - 1, 1, 1); },
  snowpile(g, x, y) { g.fillStyle = "#e8f6ff"; ellipse(g, x, y, 7, 3); g.fillStyle = "#ffffff"; g.fillRect(x - 3, y - 2, 4, 1); },
  icicle(g, x, y) { g.fillStyle = "#62c8f4"; g.fillRect(x, y - 4, 2, 4); g.fillStyle = "#ffffff"; g.fillRect(x, y - 4, 1, 3); g.fillStyle = "#3a8bd8"; g.fillRect(x + 3, y - 2, 1, 2); },
  flowerDead(g, x, y) { g.fillStyle = "#3a3a2a"; g.fillRect(x, y - 3, 1, 4); g.fillStyle = "#6a3a5a"; g.fillRect(x - 1, y - 4, 3, 1); },
  crossSmall(g, x, y) { g.fillStyle = "#1a1620"; g.fillRect(x - 1, y - 7, 3, 8); g.fillRect(x - 3, y - 5, 7, 3); g.fillStyle = "#5a4a3a"; g.fillRect(x, y - 7, 1, 7); g.fillRect(x - 2, y - 4, 5, 1); },
};

/** Thảm đỏ viền vàng (hầm ngục) */
function drawRug(g, x, y, w, h) {
  g.fillStyle = "rgba(0,0,0,0.3)"; g.fillRect(x + 2, y + 2, w, h);
  g.fillStyle = "#5a1420"; g.fillRect(x, y, w, h);
  g.fillStyle = "#7a1c28"; g.fillRect(x + 3, y + 3, w - 6, h - 6);
  g.fillStyle = "#c8a24a"; g.fillRect(x + 2, y + 2, w - 4, 1); g.fillRect(x + 2, y + h - 3, w - 4, 1); g.fillRect(x + 2, y + 2, 1, h - 4); g.fillRect(x + w - 3, y + 2, 1, h - 4);
  g.fillStyle = "#9a2a34"; for (let i = 8; i < w - 8; i += 8) g.fillRect(x + i, y + h / 2 - 1, 4, 2);
  g.fillStyle = "#c8a24a"; for (let i = 0; i < w; i += 3) { g.fillRect(x + i, y - 2, 1, 2); g.fillRect(x + i, y + h, 1, 2); }
}

/** Trang trí tường trên theo biome */
const WALL_DECOR = {
  dungeon(g, x, y, Wc) {   // cờ hiệu tím viền vàng / cửa sổ chấn song
    if (Math.random() < 0.55) { g.fillStyle = "#14101a"; g.fillRect(x - 6, y - 24, 12, 1); g.fillStyle = "#4a2a7a"; g.fillRect(x - 5, y - 23, 10, 18); g.fillStyle = "#6a3aa8"; g.fillRect(x - 5, y - 23, 10, 2); g.fillStyle = "#c8a24a"; g.fillRect(x - 1, y - 18, 2, 6); g.fillRect(x - 3, y - 16, 6, 2); g.fillStyle = "#4a2a7a"; g.fillRect(x - 5, y - 5, 4, 3); g.fillRect(x + 1, y - 5, 4, 3); }
    else { g.fillStyle = "#0a0810"; g.fillRect(x - 5, y - 24, 10, 14); g.fillStyle = "#1a2848"; g.fillRect(x - 4, y - 23, 8, 12); g.fillStyle = "#5b5566"; for (let i = -3; i <= 3; i += 3) g.fillRect(x + i, y - 23, 1, 12); }
  },
  forest(g, x, y) { g.fillStyle = "#2a4a20"; for (let i = 0; i < 4; i++) { const len = randInt(6, 20); g.fillRect(x + i * 3, y - 28, 1, len); g.fillStyle = i % 2 ? "#3c6a2c" : "#2a4a20"; g.fillRect(x + i * 3 - 1, y - 28 + len - 2, 3, 2); } },
  lava(g, x, y) { if (Math.random() < 0.6) { g.fillStyle = "#ff6a1e"; g.fillRect(x, y - 28, 2, randInt(6, 18)); g.fillStyle = "#ffc23d"; g.fillRect(x, y - 28, 1, 4); } },
  ice(g, x, y) { for (let i = 0; i < 4; i++) { const len = randInt(3, 9); g.fillStyle = "#a6ecff"; g.fillRect(x + i * 4, y - 2, 2, len); g.fillStyle = "#ffffff"; g.fillRect(x + i * 4, y - 2, 1, len - 1); } },
  grave(g, x, y) { if (Math.random() < 0.5) { g.fillStyle = "#14101a"; g.fillRect(x - 4, y - 26, 8, 16); g.fillStyle = "#3a3c46"; g.fillRect(x - 3, y - 25, 6, 14); g.fillStyle = "#6a6e78"; g.fillRect(x - 1, y - 23, 2, 8); g.fillRect(x - 3, y - 21, 6, 2); } else { g.fillStyle = "#2a2c30"; for (let i = -6; i <= 6; i += 3) g.fillRect(x + i, y - 14, 1, 10); g.fillRect(x - 6, y - 12, 13, 1); } },
};

/** Vẽ 1 vật cản theo phong cách (mặt trên sáng + mặt trước tối tạo chiều sâu) */
/** Đăng ký kiểu vật cản mới: SOLID_STYLES[style] = (g, s, B) => vẽ lên canvas nền (chế độ Rút Quân dùng) */
export const SOLID_STYLES = {};

export function drawPillar(g, s, B) {
  if (s.style && SOLID_STYLES[s.style]) { SOLID_STYLES[s.style](g, s, B); return; }
  const W = B.wall, face = Math.min(10, Math.floor(s.h * 0.3)), style = s.style ?? B.pillarStyle;
  if (style === "brazier") {   // lò lửa: chân sắt + chậu than
    const cx = s.x + s.w / 2;
    g.fillStyle = "#0b0910"; g.fillRect(cx - 7, s.y - 1, 14, 5); g.fillRect(cx - 5, s.y + 4, 10, s.h - 3);
    g.fillStyle = "#4c4658"; g.fillRect(cx - 6, s.y, 12, 3); g.fillStyle = "#78708a"; g.fillRect(cx - 6, s.y, 12, 1);
    g.fillStyle = "#302c3a"; g.fillRect(cx - 4, s.y + 4, 8, s.h - 5); g.fillRect(cx - 6, s.y + s.h - 2, 3, 2); g.fillRect(cx + 3, s.y + s.h - 2, 3, 2);
    g.fillStyle = "#c9281f"; g.fillRect(cx - 5, s.y - 1, 10, 1); g.fillStyle = "#ffc23d"; g.fillRect(cx - 2, s.y - 1, 3, 1);
    return;
  }
  if (style === "mushroom") {
    // nấm khổng lồ: thân kem + mũ đỏ chấm trắng
    const cx = s.x + s.w / 2;
    g.fillStyle = "#c8b48a"; g.fillRect(cx - s.w * 0.18, s.y + s.h * 0.45, s.w * 0.36, s.h * 0.55);
    g.fillStyle = "#8a7656"; g.fillRect(cx + s.w * 0.06, s.y + s.h * 0.45, s.w * 0.12, s.h * 0.55);
    g.fillStyle = "#e8d6b0"; g.fillRect(cx - s.w * 0.16, s.y + s.h * 0.5, 2, s.h * 0.4);
    g.fillStyle = "#1a0a10"; ellipse(g, cx, s.y + s.h * 0.46, s.w * 0.58, s.h * 0.34);
    g.fillStyle = W.pillarFace; ellipse(g, cx, s.y + s.h * 0.45, s.w * 0.56, s.h * 0.32);
    g.fillStyle = W.pillarTop; ellipse(g, cx, s.y + s.h * 0.38, s.w * 0.54, s.h * 0.3);
    g.fillStyle = shade(W.pillarTop, 0.2); ellipse(g, cx - s.w * 0.12, s.y + s.h * 0.3, s.w * 0.25, s.h * 0.12);
    g.fillStyle = W.pillarLine;
    for (let i = 0; i < 4; i++) g.fillRect(Math.round(cx - s.w * 0.35 + i * s.w * 0.2), Math.round(s.y + s.h * (0.3 + (i % 2) * 0.12)), 3, 2);
    return;
  }
  if (style === "grave" || style === "crypt") return drawTomb(g, s, B);
  g.fillStyle = "#0a0810"; g.fillRect(s.x - 1, s.y - 1, s.w + 2, s.h + 2);
  g.fillStyle = W.pillarFace; g.fillRect(s.x, s.y + s.h - face, s.w, face);
  g.fillStyle = W.pillarTop; g.fillRect(s.x, s.y, s.w, s.h - face);
  g.fillStyle = W.pillarLine; g.fillRect(s.x, s.y, s.w, 1); g.fillRect(s.x, s.y, 1, s.h - face);
  g.fillStyle = shade(W.pillarFace, -0.3); g.fillRect(s.x + s.w - 1, s.y + 1, 1, s.h - 1);
  if (style === "stone") {        // gạch đá cổ + rêu + vết nứt
    g.fillStyle = W.pillarFace;
    for (let y = s.y + 6; y < s.y + s.h - face; y += 7) g.fillRect(s.x + 1, y, s.w - 2, 1);
    for (let y = s.y; y < s.y + s.h - face - 6; y += 14) g.fillRect(s.x + ((y / 7) % 2 ? 8 : s.w / 2), y + 1, 1, 6);
    for (let x = s.x + 3; x < s.x + s.w - 3; x += 8) { g.fillStyle = shade(W.pillarFace, -0.25); g.fillRect(x, s.y + s.h - face + 2, 1, face - 3); }
    if (s.seed < 0.5) { g.fillStyle = "#3a5232"; g.fillRect(s.x, s.y + s.h - face - 2, randInt(4, 10), 3); g.fillStyle = "#4a6a3a"; g.fillRect(s.x + 1, s.y + s.h - face - 2, 3, 1); }
    if (s.seed > 0.7) { g.fillStyle = W.pillarFace; let cx = s.x + s.w * 0.6, cy = s.y + 2; for (let k = 0; k < 8; k++) { g.fillRect(Math.round(cx), Math.round(cy), 1, 1); cx += rand(-1, 1); cy += 1; } }
  } else if (style === "basalt") { // bazan có mạch dung nham
    g.fillStyle = "#ff6a1e"; g.fillRect(s.x + s.w * 0.3, s.y + s.h - face + 2, 2, face - 3);
    g.fillStyle = "#ffc23d"; g.fillRect(s.x + s.w * 0.3, s.y + s.h - face + 2, 1, 2);
    g.fillStyle = "#5c4444"; g.fillRect(s.x + 3, s.y + 3, s.w * 0.4, 2);
    g.fillStyle = "#2a1c1c"; for (let k = 0; k < 3; k++) g.fillRect(s.x + randInt(3, s.w - 6), s.y + randInt(4, s.h - face - 4), randInt(2, 6), 1);
  } else if (style === "ice") {    // cột băng trong suốt
    g.fillStyle = "#ffffff"; g.fillRect(s.x + 3, s.y + 3, 2, s.h - face - 6); g.fillRect(s.x + 7, s.y + 3, 1, s.h * 0.3);
    g.fillStyle = "#a6ecff"; g.fillRect(s.x + s.w - 6, s.y + 4, 2, s.h - face - 8);
    g.fillStyle = "#e8f6ff"; g.fillRect(s.x - 1, s.y - 2, s.w + 2, 2);   // tuyết phủ trên đỉnh
  }
}

/** Bia mộ / hầm mộ (Nghĩa Trang) */
export function drawTomb(g, s, B) {
  const W = B.wall, cx = s.x + s.w / 2;
  if (s.style === "grave") {   // bia mộ nhỏ: đầu tròn, khắc chữ thập, rêu dưới chân
    const h = 18, top = s.y + s.h - h;
    g.fillStyle = "#0a0810"; g.fillRect(s.x - 1, top - 1, s.w + 2, h + 2); g.fillRect(s.x + 1, top - 3, s.w - 2, 3);
    g.fillStyle = W.pillarFace; g.fillRect(s.x, top + 3, s.w, h - 3);
    g.fillStyle = W.pillarTop; g.fillRect(s.x, top, s.w, h - 6); g.fillRect(s.x + 2, top - 2, s.w - 4, 2);
    g.fillStyle = W.pillarLine; g.fillRect(s.x + 2, top - 2, s.w - 4, 1);
    g.fillStyle = W.pillarFace; g.fillRect(cx - 1, top + 2, 2, 7); g.fillRect(cx - 3, top + 4, 6, 2);
    g.fillStyle = "#2c3a26"; g.fillRect(s.x - 2, s.y + s.h - 2, s.w + 4, 2);
    if (s.seed < 0.3) { g.fillStyle = "#3a5232"; g.fillRect(s.x, top + 8, 3, 5); }
    if (s.seed > 0.8) { g.fillStyle = "#0a0810"; g.fillRect(s.x + s.w - 4, top, 4, 4); }   // sứt mẻ
    return;
  }
  // hầm mộ lớn: khối đá có mái, cửa sắt
  const face = Math.min(14, Math.floor(s.h * 0.4));
  g.fillStyle = "#0a0810"; g.fillRect(s.x - 1, s.y - 1, s.w + 2, s.h + 2);
  g.fillStyle = W.pillarFace; g.fillRect(s.x, s.y + s.h - face, s.w, face);
  g.fillStyle = W.pillarTop; g.fillRect(s.x, s.y, s.w, s.h - face);
  g.fillStyle = shade(W.pillarTop, -0.15); for (let y = s.y + 4; y < s.y + s.h - face; y += 6) g.fillRect(s.x + 1, y, s.w - 2, 1);
  g.fillStyle = W.pillarLine; g.fillRect(s.x, s.y, s.w, 1);
  g.fillStyle = "#14101a"; g.fillRect(cx - 5, s.y + s.h - face + 2, 10, face - 2);
  g.fillStyle = "#3a3440"; for (let i = -4; i <= 4; i += 2) g.fillRect(cx + i, s.y + s.h - face + 3, 1, face - 3);
  g.fillStyle = W.pillarLine; g.fillRect(cx - 1, s.y + 2, 2, 6); g.fillRect(cx - 3, s.y + 4, 6, 2);
  g.fillStyle = "#2c3a26"; g.fillRect(s.x - 2, s.y + s.h - 2, s.w + 4, 2);
}

/** Ngọn lửa nhỏ (đuốc / lò) */
function drawSmallFlame(ctx, x, y, t, tint = "#ffb04a", size = 1) {
  const f = Math.floor(t * 12) % 4, h = Math.round((5 + [0, 1, 2, 1][f]) * size), w = Math.round(3 * size);
  ctx.fillStyle = withAlpha(tint, 0.25); ctx.fillRect(Math.round(x - w - 1), Math.round(y - h - 2), w * 2 + 2, h + 3);
  ctx.fillStyle = "#c9281f"; ctx.fillRect(Math.round(x - w / 2 - 1), Math.round(y - h * 0.6), w + 2, Math.round(h * 0.6));
  ctx.fillStyle = tint; ctx.fillRect(Math.round(x - w / 2), Math.round(y - h + (f % 2)), w, h - 1);
  ctx.fillStyle = "#fff3a6"; ctx.fillRect(Math.round(x - 0.5), Math.round(y - h * 0.6), Math.max(1, Math.round(size)), Math.round(h * 0.5));
  if (f === 2) { ctx.fillStyle = "#ffe26b"; ctx.fillRect(Math.round(x + 1), Math.round(y - h - 3), 1, 1); }
}

/** Đền thờ ban phước: bệ đá + ngọc sáng (khi sẵn sàng) / ngọc tắt (đang hồi) */
function drawShrine(ctx, s, t) {
  const x = Math.round(s.x), y = Math.round(s.y), ready = s.cool <= 0;
  ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.beginPath(); ctx.ellipse(x, y + 1, 15, 5, 0, 0, TAU); ctx.fill();
  if (ready) { ctx.strokeStyle = withAlpha("#ffe26b", 0.35 + 0.25 * Math.sin(t * 3)); ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(x, y, 18 + Math.sin(t * 2) * 2, 7, 0, 0, TAU); ctx.stroke(); }
  ctx.fillStyle = "#0e0c14"; ctx.fillRect(x - 11, y - 9, 22, 10); ctx.fillRect(x - 7, y - 21, 14, 13);
  ctx.fillStyle = "#6a6478"; ctx.fillRect(x - 10, y - 8, 20, 8);
  ctx.fillStyle = "#8a8496"; ctx.fillRect(x - 10, y - 8, 20, 2);
  ctx.fillStyle = "#4a4458"; ctx.fillRect(x - 6, y - 20, 12, 12);
  ctx.fillStyle = "#5a5468"; ctx.fillRect(x - 6, y - 20, 12, 2);
  const glow = ready ? "#ffe26b" : "#3a3448", bob = ready ? Math.round(Math.sin(t * 3) * 1.5) : 0;
  if (ready) { ctx.fillStyle = withAlpha("#ffe26b", 0.25); ctx.fillRect(x - 6, y - 33 + bob, 12, 12); }
  ctx.fillStyle = "#0e0c14"; ctx.fillRect(x - 4, y - 31 + bob, 8, 8);
  ctx.fillStyle = glow; ctx.fillRect(x - 3, y - 30 + bob, 6, 6);
  ctx.fillStyle = ready ? "#ffffff" : "#5a5468"; ctx.fillRect(x - 2, y - 29 + bob, 2, 2);
  ctx.fillStyle = ready ? "#ffe26b" : "#2a2438"; ctx.fillRect(x - 1, y - 16, 2, 5); ctx.fillRect(x - 3, y - 14, 6, 1);
  if (!ready) {   // thanh hồi chiêu nhỏ
    const k = 1 - s.cool / ENV.shrine.cooldown;
    ctx.fillStyle = "#14101a"; ctx.fillRect(x - 8, y + 3, 16, 2);
    ctx.fillStyle = "#c8a83a"; ctx.fillRect(x - 8, y + 3, Math.round(16 * k), 2);
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

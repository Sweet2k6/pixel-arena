// =====================================================================================
//  SẢNH CHỜ (LOBBY) — căn phòng pixel ấm cúng thay cho màn hình menu tĩnh (kiểu Soul Knight)
//
//   * Nhân vật đang chọn đi lại bằng WASD / mũi tên (điện thoại: chạm vào sàn để đi tới đó).
//   * Các nhân vật khác đứng quanh phòng: lại gần + E (hoặc click / chạm vào) để ĐỔI sang điều khiển nhân vật đó.
//   * Góc trái : KHO VŨ KHÍ (chế tạo bằng Ngọc + chọn vũ khí phụ mang vào trận)
//   * Góc phải : BÀN NÂNG CẤP (dùng Ngọc nâng Máu / Giáp / Hồi chiêu / Vũ khí khởi đầu cho từng nhân vật)
//   * Giữa trên: CỔNG DỊCH CHUYỂN (chọn bản đồ & độ khó rồi vào trận)
//  Bảng (panel) HTML do main.js (MenuUI) mở qua callback deps.onStation(id) / deps.onSwitch(i) / deps.onFocus(i).
// =====================================================================================
import { LightLayer, Ambient, makeVignette } from "./ambient.js";
import { withAlpha, TAU, clamp } from "./util.js";
import { drawWeaponFallback, WEAPONS } from "./weapons.js";
import { text as hudText } from "./hud.js";

const W = 480, H = 270;
/** Vùng sàn đi lại được */
const FLOOR = { x0: 16, y0: 70, x1: 464, y1: 260 };
const SPEED = 110;         // px/giây
const NPC_R = 7;           // bán kính va chạm nhân vật
const TALK_R = 24;         // khoảng cách để đổi nhân vật

/** Trạm tương tác: (x, y) = điểm đứng để dùng, hit = vùng click */
export const STATIONS = [
  { id: "armory",  name: "Kho Vũ Khí",       hint: "Chế tạo & chọn vũ khí phụ",    x: 64,  y: 98, r: 28, hit: { x: 22, y: 30, w: 86, h: 62 }, light: "#ff8a2a" },
  { id: "portal",  name: "Cổng Xuất Kích",   hint: "Chọn chế độ, trang bị & xuất kích", x: 240, y: 92, r: 30, hit: { x: 206, y: 12, w: 68, h: 74 }, light: "#c48cff" },
  { id: "upgrade", name: "Bàn Nâng Cấp",     hint: "Dùng Ngọc nâng cấp nhân vật",  x: 416, y: 98, r: 28, hit: { x: 372, y: 30, w: 86, h: 62 }, light: "#7cd8ff" },
];
/** Vật cản (hình chữ nhật, tọa độ chân) */
const SOLIDS = [
  { x: 26, y: 60, w: 78, h: 26 },     // bàn rèn + giá vũ khí
  { x: 376, y: 60, w: 78, h: 26 },    // bàn nâng cấp
  { x: 210, y: 60, w: 60, h: 18 },    // bệ cổng dịch chuyển
  { x: 18, y: 222, w: 40, h: 38 },    // đống thùng góc dưới trái
  { x: 432, y: 236, w: 30, h: 24 },   // chậu cây góc dưới phải
  { x: 16, y: 150, w: 14, h: 30 },    // lò sưởi tường trái
];
/** Chỗ đứng: 9 nhân vật đầu tiên vòng cung quanh tấm thảm, nhóm SINH VIÊN đứng vòng ngoài (sát tường, 2 góc dưới) */
const HOMES = [
  [176, 152], [304, 152], [124, 198], [356, 198], [172, 240], [308, 240], [240, 250], [404, 164], [76, 164],
  [300, 122], [124, 124], [180, 116], [36, 214], [80, 234], [408, 214], [24, 138], [456, 214], [120, 242],
];
/** Độ cao đỉnh đầu (để đặt tên / mũi tên): người tỉ lệ thật cao hơn chibi */
const headTop = (c) => (c.human ? c.human.height + 6 : 33);

export class Lobby {
  /**
   * deps: { characters, sprites (Map id -> ActorSprite), sound,
   *         onSwitch(i) — đổi nhân vật, onStation(id) — mở bảng, onFocus(i | null) — nhân vật đang đứng gần (hiện thẻ thông tin) }
   */
  constructor(deps) {
    this.deps = deps;
    this.t = 0;
    this.light = new LightLayer(W, H);
    this.vignette = makeVignette(W, H);
    this.cam = { x: 0, y: 0, w: W, h: H, rx: 0, ry: 0, inView: () => true };
    this.dust = new Ambient("dust");
    this.bg = renderRoom();
    this.chars = deps.characters.map((c, i) => {
      const sp = deps.sprites.get(c.id) ?? null, anim = sp?.controller() ?? null;
      anim?.randomize();
      const [hx, hy] = HOMES[i % HOMES.length];
      return { i, char: c, sprite: sp, anim, x: hx, y: hy, flip: hx > 240, moving: false };
    });
    this.ctrl = 0;
    this.target = null;      // { x, y, act } — đi tới chỗ click
    this.near = null;        // { kind: "char" | "station", ref }
    this.focus = -1;
    this.blocked = false;    // đang mở bảng HTML -> đứng yên
    this.lights = [];
  }

  /** Vào sảnh với nhân vật i (đặt nhân vật ở giữa phòng nếu đang ở chỗ của người khác) */
  enter(i) {
    this.ctrl = i;
    this.target = null;
    const me = this.chars[i];
    if (!me) return;
    const c = this.chars.find((o) => o !== me && (o.x - 240) ** 2 + (o.y - 196) ** 2 < 20 * 20);
    if (c) { c.x = me.x; c.y = me.y; }
    me.x = 240; me.y = 196;
  }
  get me() { return this.chars[this.ctrl]; }

  /** Đổi sang điều khiển nhân vật i */
  switchTo(i) {
    if (i === this.ctrl || !this.chars[i]) return;
    const old = this.me, nu = this.chars[i];
    this.ctrl = i;
    this.target = null;
    old.flip = nu.x < old.x;
    this.deps.sound?.play("uiSelect", 0.6);
    this.puffs = [{ x: nu.x, y: nu.y, t: 0 }];
    this.deps.onSwitch?.(i);
  }

  /** input: { keys, pressed, mouse:{x,y}, joy } — gọi mỗi frame khi ở sảnh */
  update(dt, input) {
    this.t += dt;
    this.dust.update(dt, this.cam);
    const me = this.me;
    if (!me) return;
    let dx = 0, dy = 0;
    if (!this.blocked) {
      const k = input.keys;
      if (k.has("w") || k.has("arrowup")) dy -= 1;
      if (k.has("s") || k.has("arrowdown")) dy += 1;
      if (k.has("a") || k.has("arrowleft")) dx -= 1;
      if (k.has("d") || k.has("arrowright")) dx += 1;
      dx += input.joy?.x ?? 0; dy += input.joy?.y ?? 0;
      if (dx || dy) this.target = null;
      // click / chạm: vào nhân vật -> đổi ngay · vào trạm -> mở ngay · vào sàn -> đi tới đó
      if (input.pressed.has("mouse0")) this.click(input.mouse.x, input.mouse.y);
      if (this.target) {
        const tx = this.target.x - me.x, ty = this.target.y - me.y, d = Math.hypot(tx, ty);
        if (d < 3) this.target = null;
        else { dx = tx / d; dy = ty / d; }
      }
    }
    const len = Math.hypot(dx, dy);
    if (len > 1) { dx /= len; dy /= len; }
    const bx = me.x, by = me.y;
    if (len > 0.1) {
      this.moveBody(me, dx * SPEED * dt, dy * SPEED * dt);
      if (Math.abs(dx) > 0.1) me.flip = dx < 0;
      if (this.target && Math.hypot(me.x - bx, me.y - by) < SPEED * dt * 0.2) this.target = null;   // kẹt: thôi đi
    }
    me.moving = Math.hypot(me.x - bx, me.y - by) > SPEED * dt * 0.3;
    // nhân vật khác: quay mặt về phía người chơi khi ở gần
    for (const c of this.chars) {
      if (c !== me) { c.moving = false; if ((c.x - me.x) ** 2 + (c.y - me.y) ** 2 < 90 * 90) c.flip = me.x < c.x; }
      if (c.anim) { c.anim.set(c.moving ? "run" : "idle"); c.anim.update(dt, c.moving ? 0.95 : 1); }
    }
    // đang đứng gần ai / trạm nào?
    this.near = this.findNear();
    const f = this.near?.kind === "char" ? this.near.ref.i : -1;
    if (f !== this.focus) { this.focus = f; this.deps.onFocus?.(f >= 0 ? f : null); }
    if (!this.blocked && this.near && (input.pressed.has("e") || input.pressed.has(" "))) this.interact(this.near);
    if (this.puffs) { for (const p of this.puffs) p.t += dt; this.puffs = this.puffs.filter((p) => p.t < 0.5); }
  }

  click(mx, my) {
    // nhân vật (vùng thân 20x32 phía trên chân)
    for (const c of this.chars) {
      if (c === this.me) continue;
      if (mx > c.x - 10 && mx < c.x + 10 && my > c.y - 32 && my < c.y + 2) { this.switchTo(c.i); return; }
    }
    for (const s of STATIONS) {
      const h = s.hit;
      if (mx > h.x && mx < h.x + h.w && my > h.y && my < h.y + h.h) { this.interact({ kind: "station", ref: s }); return; }
    }
    if (mx > FLOOR.x0 && mx < FLOOR.x1 && my > FLOOR.y0 && my < FLOOR.y1) this.target = { x: mx, y: my };
  }

  findNear() {
    const me = this.me;
    let best = null, bd = Infinity;
    for (const c of this.chars) {
      if (c === me) continue;
      const d = (c.x - me.x) ** 2 + (c.y - me.y) ** 2;
      if (d < TALK_R * TALK_R && d < bd) { bd = d; best = { kind: "char", ref: c }; }
    }
    for (const s of STATIONS) {
      const d = (s.x - me.x) ** 2 + (s.y - me.y) ** 2;
      if (d < s.r * s.r && d < bd) { bd = d; best = { kind: "station", ref: s }; }
    }
    return best;
  }

  interact(n) {
    if (n.kind === "char") this.switchTo(n.ref.i);
    else { this.deps.sound?.play("uiSelect", 0.5); this.deps.onStation?.(n.ref.id); }
  }

  /** Di chuyển có va chạm: tường phòng, đồ đạc, nhân vật khác */
  moveBody(b, dx, dy) {
    const r = NPC_R;
    const hit = (x, y) => SOLIDS.some((s) => x + r > s.x && x - r < s.x + s.w && y > s.y && y - r < s.y + s.h);
    if (!hit(b.x + dx, b.y)) b.x += dx;
    if (!hit(b.x, b.y + dy)) b.y += dy;
    b.x = clamp(b.x, FLOOR.x0 + r, FLOOR.x1 - r);
    b.y = clamp(b.y, FLOOR.y0, FLOOR.y1);
    for (const c of this.chars) {
      if (c === b) continue;
      const ox = b.x - c.x, oy = (b.y - c.y) * 1.6, d = Math.hypot(ox, oy), min = r * 2;
      if (d < min && d > 0.01) { b.x = c.x + (ox / d) * min; b.y = c.y + (oy / d) * min / 1.6; }
    }
  }

  // ---------------------------------------------------------------- VẼ
  draw(ctx, info) {
    const t = this.t;
    ctx.drawImage(this.bg, 0, 0);
    drawPortal(ctx, 240, 46, t);
    drawGem(ctx, 416, 40, t);
    drawForge(ctx, 40, 72, t);
    drawFire(ctx, 23, 168, t);
    for (const [x, y] of TORCHES) drawTorch(ctx, x, y, t);
    for (const [x, y] of CANDLES) drawCandle(ctx, x, y, t);

    // nhân vật: sắp theo chân
    const list = [...this.chars].sort((a, b) => a.y - b.y);
    const me = this.me;
    for (const c of list) {
      ctx.fillStyle = "rgba(0,0,0,0.32)"; ctx.beginPath(); ctx.ellipse(c.x, c.y, 7, 2.5, 0, 0, TAU); ctx.fill();
      if (c === me) { ctx.strokeStyle = withAlpha("#ffe26b", 0.55 + 0.3 * Math.sin(t * 5)); ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(c.x, c.y, 10, 3.5, 0, 0, TAU); ctx.stroke(); }
      if (c.sprite && c.anim) c.sprite.sheet.draw(ctx, c.anim.col, c.anim.row, Math.round(c.x), Math.round(c.y), c.flip);
      else { ctx.fillStyle = c.char.skill?.color ?? "#fff"; ctx.fillRect(c.x - 5, c.y - 20, 10, 20); }
    }
    for (const p of this.puffs ?? []) {
      const k = p.t / 0.5;
      ctx.strokeStyle = withAlpha("#ffe26b", 1 - k); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(p.x, p.y - 12, 8 + k * 14, 10 + k * 16, 0, 0, TAU); ctx.stroke();
    }

    // ánh sáng ấm
    const L = this.lights; L.length = 0;
    const flick = (k) => 1 + 0.05 * Math.sin(t * 11 + k) + 0.03 * Math.sin(t * 23 + k * 3);
    for (const [x, y] of TORCHES) L.push({ x, y: y + 8, r: 70 * flick(x), color: "#ffb04a", a: 1, glow: 0.16 });
    for (const [x, y] of CANDLES) L.push({ x, y, r: 34 * flick(y), color: "#ffb04a", a: 0.9, glow: 0.12 });
    L.push({ x: 240, y: 52, r: 110, color: "#c48cff", a: 1, glow: 0.2 });
    L.push({ x: 416, y: 44, r: 70 * (1 + 0.08 * Math.sin(t * 3)), color: "#7cd8ff", a: 1, glow: 0.2 });
    L.push({ x: 46, y: 70, r: 60 * flick(5), color: "#ff6a1e", a: 1, glow: 0.18 });
    L.push({ x: 30, y: 170, r: 80 * flick(9), color: "#ff8a2a", a: 1, glow: 0.2 });
    L.push({ x: me.x, y: me.y - 14, r: 96, color: null, a: 1, glow: 0.1 });
    L.push({ x: 240, y: 190, r: 120, color: null, a: 0.55, glow: 0 });
    this.light.render(ctx, this.cam, { color: "#0c0618", alpha: 0.5 }, L);
    this.dust.draw(ctx);

    // tên nhân vật + lời nhắc
    ctx.font = "7px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "bottom";
    for (const c of this.chars) {
      const isNear = this.near?.kind === "char" && this.near.ref === c;
      if (c === me) { const by = Math.round(c.y - headTop(c.char) - 3 + Math.sin(t * 6) * 1.5); ctx.fillStyle = "#ffe26b"; ctx.fillRect(c.x - 2, by, 5, 1); ctx.fillRect(c.x - 1, by + 1, 3, 1); ctx.fillRect(c.x, by + 2, 1, 1); continue; }
      hudText(ctx, c.char.name, Math.round(c.x), Math.round(c.y - headTop(c.char)), isNear ? "#ffe26b" : "rgba(220,210,240,0.75)");
    }
    for (const s of STATIONS) hudText(ctx, s.name, s.id === "portal" ? 240 : s.x, s.id === "portal" ? 98 : 104, this.near?.ref === s ? "#ffe26b" : withAlpha(s.light, 0.9));
    if (this.near && !this.blocked) {
      const n = this.near, touch = info?.touch;
      const label = n.kind === "char" ? `${touch ? "Chạm" : "[E]"} Điều khiển ${n.ref.char.name}` : `${touch ? "Chạm" : "[E]"} ${n.ref.name} — ${n.ref.hint}`;
      const x = n.kind === "char" ? n.ref.x : n.ref.x, y = n.kind === "char" ? n.ref.y - headTop(n.ref.char) - 9 : n.ref.y + 22;
      const w = ctx.measureText(label).width + 8, bx = clamp(Math.round(x - w / 2), 2, W - w - 2);
      ctx.fillStyle = "rgba(12,10,20,0.85)"; ctx.fillRect(bx, y - 10, w, 11);
      ctx.fillStyle = "#ffe26b"; ctx.fillRect(bx, y + 1, w, 1);
      ctx.textAlign = "left"; hudText(ctx, label, bx + 4, y, "#ffffff");
    }
    ctx.textAlign = "left"; ctx.textBaseline = "top";
    ctx.drawImage(this.vignette, 0, 0);

    // góc dưới trái: nhân vật đang điều khiển + hướng dẫn
    const bx0 = 62, by0 = H - 27;
    ctx.font = "8px monospace";
    ctx.fillStyle = "rgba(12,10,20,0.78)"; ctx.fillRect(bx0, by0, 158, 23);
    ctx.fillStyle = "#4a4066"; ctx.fillRect(bx0, by0, 158, 1);
    hudText(ctx, `▶ ${me.char.name}`, bx0 + 4, by0 + 3, "#ffe26b");
    ctx.font = "7px monospace";
    hudText(ctx, info?.touch ? "Chạm sàn để đi · chạm người để đổi" : "WASD: đi · E: tương tác · Click: chọn", bx0 + 4, by0 + 13, "#b8b0d0");
  }
}

// =====================================================================================
//  CĂN PHÒNG (vẽ sẵn 1 lần)
// =====================================================================================
const TORCHES = [[150, 30], [330, 30], [12, 110], [468, 110]];
const CANDLES = [[118, 64], [362, 64], [452, 226]];

function renderRoom() {
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const g = cv.getContext("2d");
  g.imageSmoothingEnabled = false;
  const R = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  // --- SÀN GỖ ---
  for (let y = 56; y < H; y += 8) {
    const row = (y / 8) | 0;
    for (let x = -((row * 23) % 40); x < W; x += 40) {
      const shade = ((x * 7 + y * 13) >> 3) % 3;
      R(x, y, 40, 8, ["#5a3a24", "#62402a", "#56361f"][shade]);
      R(x, y, 40, 1, "#6e4a30");
      R(x, y + 7, 40, 1, "#3a2414");
      R(x + 39, y, 1, 8, "#3a2414");
      if ((x + y) % 3 === 0) R(x + 8, y + 3, 2, 1, "#4a2e1a");   // mắt gỗ
    }
  }
  // --- THẢM ĐỎ GIỮA PHÒNG ---
  const rx = 150, ry = 140, rw = 180, rh = 104;
  R(rx - 2, ry - 2, rw + 4, rh + 4, "#2a0e12");
  R(rx, ry, rw, rh, "#8a1e2a");
  R(rx + 4, ry + 4, rw - 8, rh - 8, "#a82a36");
  R(rx + 8, ry + 8, rw - 16, rh - 16, "#8a1e2a");
  g.strokeStyle = "#e8b030"; g.lineWidth = 1;
  g.strokeRect(rx + 6.5, ry + 6.5, rw - 13, rh - 13);
  for (let i = 0; i < 9; i++) { R(rx + 14 + i * 19, ry + 2, 3, 2, "#e8b030"); R(rx + 14 + i * 19, ry + rh - 4, 3, 2, "#e8b030"); }
  // họa tiết kim cương giữa thảm
  for (let k = 0; k < 18; k++) { R(rx + rw / 2 - k, ry + rh / 2 - 18 + k, 2 * k + 1, 1, k % 4 < 2 ? "#c8343f" : "#e8b030"); R(rx + rw / 2 - k, ry + rh / 2 + 18 - k, 2 * k + 1, 1, k % 4 < 2 ? "#c8343f" : "#e8b030"); }
  R(rx - 4, ry + 10, 4, rh - 20, "#e8d8a8"); R(rx + rw, ry + 10, 4, rh - 20, "#e8d8a8");   // tua rua
  for (let y = ry + 10; y < ry + rh - 10; y += 3) { R(rx - 6, y, 2, 1, "#e8d8a8"); R(rx + rw + 4, y, 2, 1, "#e8d8a8"); }
  // --- TƯỜNG ĐÁ PHÍA TRÊN ---
  R(0, 0, W, 58, "#2e2840");
  for (let y = 0; y < 52; y += 8) for (let x = -((y / 8) % 2) * 12; x < W; x += 24) {
    R(x, y, 24, 8, ((x + y) >> 3) % 2 ? "#3a3352" : "#352e4a");
    R(x, y, 24, 1, "#4a4066"); R(x + 23, y, 1, 8, "#1e1a2c");
  }
  R(0, 50, W, 4, "#5a3418"); R(0, 50, W, 1, "#8a5428"); R(0, 54, W, 3, "#1b1726");   // gờ gỗ chân tường
  // cửa sổ đêm trăng
  for (const wx of [112, 344]) {
    R(wx - 1, 9, 26, 30, "#1b1726"); R(wx, 10, 24, 28, "#0e1430");
    for (let i = 0; i < 9; i++) R(wx + ((i * 7) % 22) + 1, 12 + ((i * 11) % 22), 1, 1, i % 3 ? "#8aa0d8" : "#ffffff");
    if (wx === 344) { R(wx + 14, 14, 6, 6, "#fff6c4"); R(wx + 16, 14, 4, 2, "#0e1430"); }
    R(wx + 11, 10, 2, 28, "#5a3418"); R(wx, 23, 24, 2, "#5a3418"); R(wx - 2, 38, 28, 3, "#8a5428");
  }
  // cờ hiệu treo tường
  for (const [bx, col] of [[184, "#c8343f"], [292, "#3a7ad8"]]) {
    R(bx, 4, 14, 2, "#c8a24a"); R(bx + 1, 6, 12, 22, col); R(bx + 1, 28, 4, 4, col); R(bx + 9, 28, 4, 4, col);
    R(bx + 5, 12, 4, 6, "#ffe26b"); R(bx + 6, 18, 2, 3, "#ffe26b");
  }
  // --- TƯỜNG HAI BÊN + DƯỚI ---
  R(0, 56, 10, H - 56, "#231e33"); R(10, 56, 2, H - 56, "#1b1726");
  R(W - 10, 56, 10, H - 56, "#231e33"); R(W - 12, 56, 2, H - 56, "#1b1726");
  R(0, H - 6, W, 6, "#1b1726"); R(0, H - 6, W, 1, "#2e2840");
  // --- LÒ SƯỞI (tường trái) ---
  R(10, 148, 22, 34, "#3a3352"); R(12, 150, 18, 30, "#1a1018"); R(10, 146, 24, 4, "#6a6280"); R(10, 180, 24, 3, "#4a4066");
  R(14, 172, 14, 4, "#3a2416"); R(16, 170, 10, 3, "#5a3418");
  // --- KHO VŨ KHÍ (góc trái): giá treo vũ khí trên tường + bàn rèn ---
  R(24, 12, 84, 40, "#3a2416"); R(26, 14, 80, 36, "#5a3418"); R(26, 14, 80, 2, "#8a5428");
  R(26, 30, 80, 2, "#3a2416");
  const rack = ["sword", "shotgun", "longbow", "laser", "scythe", "rocket"];
  rack.forEach((id, i) => {
    g.save(); g.translate(34 + (i % 3) * 26, 22 + ((i / 3) | 0) * 15); drawWeaponFallback(g, WEAPONS[id]); g.restore();
  });
  // bàn gỗ + đe rèn
  R(28, 62, 74, 16, "#3a2416"); R(30, 62, 70, 3, "#a8743a"); R(30, 65, 70, 11, "#7a4a22"); R(32, 76, 4, 10, "#3a2416"); R(94, 76, 4, 10, "#3a2416");
  R(64, 54, 18, 6, "#2a2a3a"); R(62, 54, 22, 3, "#6a6e88"); R(68, 60, 8, 4, "#2a2a3a");   // đe
  R(38, 56, 12, 6, "#1a1018");                                                               // lò rèn nhỏ
  // --- BÀN NÂNG CẤP (góc phải): bệ đá + giá sách ---
  R(372, 12, 86, 40, "#3a2416"); R(374, 14, 82, 36, "#5a3418");
  for (let s = 0; s < 3; s++) { R(374, 25 + s * 12, 82, 2, "#3a2416"); for (let b = 0; b < 12; b++) if ((b * 7 + s) % 5) R(378 + b * 6, 16 + s * 12, 4, 9, ["#7a2a3a", "#2a5a7a", "#5a7a2a", "#7a6a2a"][(b + s) % 4]); }
  R(380, 62, 72, 16, "#1a1822"); R(382, 62, 68, 3, "#8a8e98"); R(382, 65, 68, 11, "#5a5e68");
  R(404, 56, 24, 8, "#4a4e58"); R(406, 56, 20, 2, "#8a8e98");
  // --- CỔNG DỊCH CHUYỂN: vòm đá ---
  R(206, 8, 68, 72, "#1b1726");
  R(210, 10, 60, 66, "#4a4066");
  R(214, 14, 52, 58, "#0a0610");
  for (let i = 0; i < 6; i++) { R(208, 12 + i * 11, 6, 9, "#5a4f78"); R(266, 12 + i * 11, 6, 9, "#5a4f78"); }
  R(206, 6, 68, 8, "#6e6290"); R(232, 2, 16, 8, "#6e6290"); R(237, 4, 6, 4, "#c48cff");
  R(210, 70, 60, 10, "#3a3352"); R(212, 70, 56, 2, "#6e6290");   // bậc thềm
  // --- ĐỒ TRANG TRÍ: đống thùng gỗ, chậu cây ---
  const crate = (x, y) => { R(x, y, 16, 14, "#1a0f08"); R(x + 1, y + 1, 14, 12, "#8a5a2c"); R(x + 1, y + 1, 14, 2, "#a8743a"); R(x + 1, y + 6, 14, 1, "#5a3818"); R(x + 1, y + 1, 2, 12, "#5a3818"); R(x + 13, y + 1, 2, 12, "#5a3818"); };
  crate(20, 232); crate(38, 236); crate(28, 220);
  R(46, 250, 10, 10, "#1a1018"); R(47, 251, 8, 8, "#7c1a1e"); R(48, 251, 3, 8, "#b02a26");   // thùng nổ (đã tháo ngòi)
  R(436, 246, 22, 14, "#5a2a1a"); R(438, 246, 18, 3, "#8a4a2a");
  for (const [lx, ly, lc] of [[440, 232, "#2f6a22"], [452, 228, "#3e8a2a"], [446, 222, "#56a83a"], [436, 238, "#56a83a"], [456, 238, "#2f6a22"]]) { g.fillStyle = lc; g.beginPath(); g.arc(lx, ly, 6, 0, TAU); g.fill(); }
  return cv;
}

function drawPortal(g, x, y, t) {
  // xoáy năng lượng nhiều lớp
  for (let i = 5; i >= 0; i--) {
    const r = 6 + i * 4.2, a = t * (1.6 + i * 0.35) * (i % 2 ? -1 : 1);
    g.strokeStyle = ["#ffffff", "#e8c8ff", "#c48cff", "#8a4ae8", "#5a2ab0", "#3a1a78"][i];
    g.lineWidth = 2;
    g.beginPath(); g.ellipse(x, y, r, r * 1.25, 0, a, a + 4.2); g.stroke();
  }
  g.fillStyle = withAlpha("#ffffff", 0.6 + 0.3 * Math.sin(t * 6)); g.fillRect(x - 2, y - 3, 4, 6);
  // hạt bị hút vào tâm
  for (let i = 0; i < 10; i++) {
    const u = (t * 0.7 + i / 10) % 1, a = i * 2.4 + t, d = (1 - u) * 30;
    g.fillStyle = withAlpha(i % 2 ? "#c48cff" : "#7cd8ff", u);
    g.fillRect(Math.round(x + Math.cos(a) * d), Math.round(y + Math.sin(a) * d * 1.25), 1, 1);
  }
}
function drawGem(g, x, y, t) {
  const by = Math.round(y + Math.sin(t * 2) * 2);
  g.fillStyle = withAlpha("#7cd8ff", 0.25); g.beginPath(); g.ellipse(x, by + 2, 10, 12, 0, 0, TAU); g.fill();
  g.fillStyle = "#1c4a8a"; g.beginPath(); g.moveTo(x, by - 10); g.lineTo(x + 7, by); g.lineTo(x, by + 10); g.lineTo(x - 7, by); g.closePath(); g.fill();
  g.fillStyle = "#4aa8ff"; g.beginPath(); g.moveTo(x, by - 10); g.lineTo(x + 7, by); g.lineTo(x, by + 3); g.lineTo(x - 7, by); g.closePath(); g.fill();
  g.fillStyle = "#c8f2ff"; g.beginPath(); g.moveTo(x, by - 10); g.lineTo(x - 7, by); g.lineTo(x - 2, by - 1); g.closePath(); g.fill();
  if (Math.floor(t * 2) % 4 === 0) { g.fillStyle = "#ffffff"; g.fillRect(x - 3, by - 5, 1, 1); g.fillRect(x - 4, by - 4, 3, 1); }
}
function drawForge(g, x, y, t) {
  const f = Math.sin(t * 10) > 0;
  g.fillStyle = f ? "#ff8a2a" : "#ffc23d"; g.fillRect(x, y - 15, 8, 3);
  g.fillStyle = "#ffe26b"; g.fillRect(x + 2 + (f ? 1 : 0), y - 16, 3, 1);
}
function drawFire(g, x, y, t) {
  for (let i = 0; i < 5; i++) {
    const h = 4 + ((t * 18 + i * 3.7) % 6);
    g.fillStyle = ["#ff6a1e", "#ffc23d", "#ff8a2a", "#ffe26b", "#ff6a1e"][i];
    g.fillRect(x - 6 + i * 3, Math.round(y - h), 2, Math.round(h));
  }
}
function drawTorch(g, x, y, t) {
  g.fillStyle = "#3a2416"; g.fillRect(x - 1, y, 3, 8);
  g.fillStyle = "#6a6280"; g.fillRect(x - 2, y, 5, 2);
  const h = 4 + Math.round(Math.sin(t * 13 + x) * 1.5);
  g.fillStyle = "#ff6a1e"; g.fillRect(x - 2, y - h, 5, h);
  g.fillStyle = "#ffc23d"; g.fillRect(x - 1, y - h + 1, 3, h - 1);
  g.fillStyle = "#ffffff"; g.fillRect(x, y - 2, 1, 1);
}
function drawCandle(g, x, y, t) {
  g.fillStyle = "#e8e2d0"; g.fillRect(x - 1, y - 5, 3, 5);
  g.fillStyle = Math.sin(t * 15 + y) > 0 ? "#ffc23d" : "#ff8a2a"; g.fillRect(x, y - 8, 1, 3);
}

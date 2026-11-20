// =====================================================================================
//  XUẤT KÍCH BẰNG MÁY BAY (chế độ Nhảy Dù Rút Quân)
//
//  TacticalMap — BẢN ĐỒ CHIẾN THUẬT: ảnh vệ tinh thu nhỏ của cả vùng dịch + 4 khu, vị trí nhiệm vụ,
//                trinh sát các đàn zombie, bãi rút quân dự kiến. Click 1 ĐIỂM NHẢY DÙ (vòng trắng) rồi bấm
//                NHẢY DÙ / Enter. Phím ← → (A D) đổi điểm, Esc về sảnh.
//  AirDrop     — MÁY BAY bay ngang qua (bóng máy bay đổ trên mặt đất + tiếng động cơ), nhân vật nhảy ra,
//                BUNG DÙ lắc lư rơi xuống, TIẾP ĐẤT tạo bụi + SÓNG XUNG KÍCH hất văng zombie gần đó.
//  Ảnh riêng (máy bay, dù): khai báo ở EXTRACT_IMAGES trong src/extraction.js ("x:airplane", "x:parachute").
// =====================================================================================
import { WORLD } from "./world.js";
import { text as hudText } from "./hud.js";
import { withAlpha, TAU, clamp } from "./util.js";

const MAP = { x: 8, y: 17, h: 238 };   // khung bản đồ trên màn hình 480x270 (rộng tự tính theo tỉ lệ bản đồ)
const PX_PER_M = 8;                    // 8 pixel thế giới = 1 mét (để hiển thị khoảng cách)

export class TacticalMap {
  constructor(game, run) {
    this.game = game;
    this.run = run;
    this.t = 0;
    this.mh = MAP.h;
    this.mw = Math.round(MAP.h * WORLD.w / WORLD.h);
    this.k = this.mw / WORLD.w;          // tỉ lệ thế giới -> bản đồ
    this.lzs = game.world.landingZones?.length ? game.world.landingZones : [{ x: WORLD.w / 2, y: WORLD.h / 2, name: "Ngã Tư Trung Tâm" }];
    this.hover = -1;
    this.sel = this.safest();
    this.img = this.renderSatellite();
    this.btn = { x: MAP.x + this.mw + 8, y: MAP.y + MAP.h - 25, w: 480 - (MAP.x + this.mw + 8) - 6, h: 24 };
  }

  /** Ảnh "vệ tinh": thu nhỏ nền bản đồ thật (nhiều bước cho mịn) + phủ lưới chiến thuật */
  renderSatellite() {
    const src = this.game.world.floor, out = document.createElement("canvas");
    out.width = this.mw; out.height = this.mh;
    const g = out.getContext("2d");
    if (src) {
      let cur = src, w = src.width, h = src.height;
      while (w / 2 > this.mw * 1.5) {   // thu nhỏ từng nửa -> không bị vỡ hạt
        const tmp = document.createElement("canvas");
        tmp.width = Math.round(w / 2); tmp.height = Math.round(h / 2);
        const tg = tmp.getContext("2d"); tg.imageSmoothingEnabled = true; tg.imageSmoothingQuality = "high";
        tg.drawImage(cur, 0, 0, tmp.width, tmp.height);
        cur = tmp; w = tmp.width; h = tmp.height;
      }
      g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "high";
      g.drawImage(cur, 0, 0, this.mw, this.mh);
    } else { g.fillStyle = "#1b1726"; g.fillRect(0, 0, this.mw, this.mh); }
    g.fillStyle = "rgba(6,10,14,0.35)"; g.fillRect(0, 0, this.mw, this.mh);   // tông ảnh trinh sát
    g.fillStyle = "rgba(140,220,160,0.07)";
    for (let x = 0; x < this.mw; x += 16) g.fillRect(x, 0, 1, this.mh);
    for (let y = 0; y < this.mh; y += 16) g.fillRect(0, y, this.mw, 1);
    return out;
  }

  /** Số đàn zombie trong bán kính r quanh 1 điểm (trinh sát) */
  threat(x, y, r = 420) {
    let n = 0;
    for (const s of this.game.horde?.squads ?? []) {
      const L = s.leader ?? s.members?.find((e) => !e.dead);
      if (L && !L.dead && (L.x - x) ** 2 + (L.y - y) ** 2 < r * r) n++;
    }
    return n;
  }
  safest() {
    let best = 0, bs = Infinity;
    this.lzs.forEach((z, i) => { const s = this.threat(z.x, z.y) * 1000 + Math.hypot(z.x - WORLD.w / 2, z.y - WORLD.h / 2) * 0.1; if (s < bs) { bs = s; best = i; } });
    return best;
  }
  toMap(x, y) { return [MAP.x + x * this.k, MAP.y + y * this.k]; }

  /** -> "jump" (đã chọn xong) | "back" (về sảnh) | null */
  update(dt, input) {
    this.t += dt;
    const m = input.mouse, P = input.pressed;
    this.hover = -1;
    let bd = 11 * 11;
    this.lzs.forEach((z, i) => { const [x, y] = this.toMap(z.x, z.y), d = (x - m.x) ** 2 + (y - m.y) ** 2; if (d < bd) { bd = d; this.hover = i; } });
    const B = this.btn, onBtn = m.x >= B.x && m.x <= B.x + B.w && m.y >= B.y && m.y <= B.y + B.h;
    this.btnHover = onBtn;
    if (P.has("mouse0")) {
      if (this.hover >= 0) {
        if (this.hover === this.sel && this.lastClick && this.t - this.lastClick < 0.4) return "jump";   // bấm đúp = nhảy luôn
        this.sel = this.hover; this.lastClick = this.t; this.game.sound.play("uiSelect", 0.5);
      } else if (onBtn) return "jump";
    }
    if (P.has("arrowleft") || P.has("a") || P.has("arrowup") || P.has("w")) { this.sel = (this.sel + this.lzs.length - 1) % this.lzs.length; this.game.sound.play("uiSelect", 0.4); }
    if (P.has("arrowright") || P.has("d") || P.has("arrowdown") || P.has("s")) { this.sel = (this.sel + 1) % this.lzs.length; this.game.sound.play("uiSelect", 0.4); }
    if (P.has("enter") || P.has(" ")) return "jump";
    if (P.has("escape")) return "back";
    return null;
  }
  get chosen() { return this.lzs[this.sel]; }

  draw(c, W, H) {
    const g = this.game, t = this.t, run = this.run;
    c.fillStyle = "#0b0a10"; c.fillRect(0, 0, W, H);
    c.fillStyle = "#12101a";
    for (let x = 0; x < W; x += 12) c.fillRect(x, 0, 1, H);
    for (let y = 0; y < H; y += 12) c.fillRect(0, y, W, 1);
    c.textBaseline = "top";
    // --- tiêu đề ---
    c.font = "bold 9px monospace"; c.textAlign = "left";
    hudText(c, "BẢN ĐỒ CHIẾN THUẬT", MAP.x, 4, "#ffe26b");
    c.font = "7px monospace";
    hudText(c, `${g.world.biome?.name ?? "Vùng dịch"} · chọn điểm nhảy dù`, MAP.x + 104, 5, "#a69dc4");
    c.textAlign = "right";
    hudText(c, `${String(run.minutes).padStart(2, "0")}:00 · ${g.diff.name}`, W - 6, 5, g.diff.color);
    c.textAlign = "left";

    // --- ảnh vệ tinh + khung ---
    const mx = MAP.x, my = MAP.y, mw = this.mw, mh = this.mh;
    c.fillStyle = "#000"; c.fillRect(mx - 2, my - 2, mw + 4, mh + 4);
    c.drawImage(this.img, mx, my);
    c.fillStyle = "#4a4066"; c.fillRect(mx - 1, my - 1, mw + 2, 1); c.fillRect(mx - 1, my + mh, mw + 2, 1); c.fillRect(mx - 1, my - 1, 1, mh + 2); c.fillRect(mx + mw, my - 1, 1, mh + 2);
    // góc khung kiểu ống ngắm
    c.fillStyle = "#ffe26b";
    for (const [cx, cy, sx, sy] of [[mx - 2, my - 2, 1, 1], [mx + mw + 1, my - 2, -1, 1], [mx - 2, my + mh + 1, 1, -1], [mx + mw + 1, my + mh + 1, -1, -1]]) { c.fillRect(cx, cy, 6 * sx || 1, 1); c.fillRect(cx, cy, 1, 6 * sy || 1); c.fillRect(Math.min(cx, cx + 6 * sx), cy, 6, 1); c.fillRect(cx, Math.min(cy, cy + 6 * sy), 1, 6); }
    // tia quét radar
    const scan = (t * 0.25) % 1;
    c.fillStyle = "rgba(120,255,170,0.10)"; c.fillRect(mx, Math.round(my + scan * mh), mw, 2);

    // --- tên 4 khu ---
    c.font = "7px monospace"; c.textAlign = "center";
    for (const z of g.world.zones ?? []) {
      const r = z.rect; if (!r) continue;
      const [x, y] = this.toMap(r.x + r.w / 2, r.y + 26);
      hudText(c, z.name.toUpperCase(), Math.round(x), Math.round(y), z.color ?? "#e8e2f6");
    }
    // --- trinh sát: đàn zombie (chấm đỏ nhấp nháy) ---
    for (const s of g.horde?.squads ?? []) {
      const L = s.leader ?? s.members?.find((e) => !e.dead);
      if (!L || L.dead) continue;
      const [x, y] = this.toMap(L.x, L.y), on = Math.sin(t * 5 + L.x) > -0.4;
      c.fillStyle = on ? "rgba(255,70,70,0.85)" : "rgba(120,20,20,0.7)"; c.fillRect(Math.round(x) - 1, Math.round(y) - 1, 2, 2);
    }
    // --- bãi rút quân dự kiến ---
    for (const p of g.world.extractPads ?? []) {
      const [x, y] = this.toMap(p.x, p.y);
      c.strokeStyle = "rgba(95,220,140,0.6)"; c.lineWidth = 1; c.beginPath(); c.arc(Math.round(x) + 0.5, Math.round(y) + 0.5, 5, 0, TAU); c.stroke();
      c.fillStyle = "#5fdc8c"; c.fillRect(Math.round(x) - 2, Math.round(y) - 2, 1, 5); c.fillRect(Math.round(x) + 2, Math.round(y) - 2, 1, 5); c.fillRect(Math.round(x) - 1, Math.round(y), 3, 1);
    }
    // --- nhiệm vụ ---
    for (const m of run.missions.list) {
      const [x, y] = this.toMap(m.x, m.y), X = Math.round(x), Y = Math.round(y);
      c.fillStyle = "#000"; c.fillRect(X - 5, Y - 5, 11, 11);
      c.fillStyle = m.color; c.fillRect(X - 4, Y - 4, 9, 9);
      c.fillStyle = "#0b0a10"; c.font = "bold 8px monospace"; c.textAlign = "center"; c.fillText(String(m.n), X + 1, Y - 3);
      c.font = "7px monospace"; hudText(c, m.cfg.short, X, Y + 7, m.color);
    }
    // --- đường bay của máy bay qua điểm đã chọn ---
    const lz = this.chosen, [lx, ly] = this.toMap(lz.x, lz.y);
    c.fillStyle = "rgba(255,226,107,0.55)";
    for (let x = mx + ((t * 30) % 8); x < mx + mw; x += 8) if (Math.abs(x - lx) > 10) c.fillRect(Math.round(x), Math.round(ly), 4, 1);
    const px = mx + ((t * 0.22) % 1) * mw;
    drawPlane(c, Math.round(px), Math.round(ly), 0.16, false, null);
    // --- điểm nhảy dù ---
    this.lzs.forEach((z, i) => {
      const [x, y] = this.toMap(z.x, z.y), X = Math.round(x), Y = Math.round(y), sel = i === this.sel, hov = i === this.hover;
      const r = sel ? 7 + Math.sin(t * 6) : hov ? 7 : 5;
      c.strokeStyle = "#000"; c.lineWidth = 3; c.beginPath(); c.arc(X + 0.5, Y + 0.5, r, 0, TAU); c.stroke();
      c.strokeStyle = sel ? "#ffe26b" : hov ? "#ffffff" : "rgba(232,226,246,0.8)"; c.lineWidth = 1; c.beginPath(); c.arc(X + 0.5, Y + 0.5, r, 0, TAU); c.stroke();
      if (sel) {
        c.fillStyle = "#ffe26b";
        c.fillRect(X - 12, Y, 6, 1); c.fillRect(X + 7, Y, 6, 1); c.fillRect(X, Y - 12, 1, 6); c.fillRect(X, Y + 7, 1, 6); c.fillRect(X - 1, Y - 1, 3, 3);
        c.font = "7px monospace"; c.textAlign = "center";
        hudText(c, z.name, X, Y + 10, "#ffe26b");
      } else { c.fillStyle = "#e8e2f6"; c.fillRect(X, Y, 1, 1); }
    });

    // --- bảng thông tin bên phải ---
    const px0 = mx + mw + 8, pw = W - px0 - 6;
    c.textAlign = "left";
    c.fillStyle = "rgba(20,17,31,0.92)"; c.fillRect(px0, my - 1, pw, mh + 2);
    c.fillStyle = "#4a4066"; c.fillRect(px0, my - 1, pw, 1); c.fillRect(px0, my + mh, pw, 1);
    let y = my + 4;
    c.font = "7px monospace"; hudText(c, "ĐIỂM NHẢY DÙ", px0 + 4, y, "#a69dc4"); y += 10;
    c.font = "bold 8px monospace"; hudText(c, fit(c, lz.name, pw - 8), px0 + 4, y, "#ffe26b"); y += 11;
    const zone = g.world.zoneAt?.(lz.x, lz.y);
    c.font = "7px monospace";
    if (zone) { hudText(c, fit(c, zone.name, pw - 8), px0 + 4, y, zone.color ?? "#e8e2f6"); y += 10; }
    const th = this.threat(lz.x, lz.y), lvl = th === 0 ? ["THẤP", "#5fdc8c"] : th <= 2 ? ["VỪA", "#ffb030"] : ["CAO", "#ff5a5a"];
    hudText(c, "Nguy hiểm:", px0 + 4, y, "#a69dc4"); hudText(c, lvl[0], px0 + 52, y, lvl[1]); y += 9;
    hudText(c, `${th} đàn zombie gần`, px0 + 4, y, "#7a7296"); y += 12;
    c.fillStyle = "#2a2440"; c.fillRect(px0 + 4, y, pw - 8, 1); y += 4;
    hudText(c, "NHIỆM VỤ", px0 + 4, y, "#a69dc4"); y += 10;
    for (const m of run.missions.list) {
      const d = Math.round(Math.hypot(m.x - lz.x, m.y - lz.y) / PX_PER_M);
      c.fillStyle = "#000"; c.fillRect(px0 + 4, y, 7, 7); c.fillStyle = m.color; c.fillRect(px0 + 5, y + 1, 5, 5);
      hudText(c, fit(c, m.cfg.name, pw - 40), px0 + 14, y, "#e8e2f6");
      c.textAlign = "right"; hudText(c, `${d}m`, px0 + pw - 4, y, "#a69dc4"); c.textAlign = "left";
      y += 10;
    }
    y += 2; c.fillStyle = "#2a2440"; c.fillRect(px0 + 4, y, pw - 8, 1); y += 4;
    hudText(c, "Rút quân khi xong", px0 + 4, y, "#7a7296"); y += 8;
    hudText(c, "ít nhất 1 nhiệm vụ.", px0 + 4, y, "#7a7296"); y += 10;
    const bag = run.bag.filter(Boolean).map((s) => s.n).reduce((a, b) => a + b, 0);
    hudText(c, `Túi: ${bag} vật phẩm`, px0 + 4, y, "#c8c0e0"); y += 9;
    if (run.kitWeapon) hudText(c, "+ 1 súng từ Kho", px0 + 4, y, "#c8c0e0");
    // nút NHẢY DÙ
    const B = this.btn, hot = this.btnHover;
    c.fillStyle = "#000"; c.fillRect(B.x - 1, B.y - 1, B.w + 2, B.h + 3);
    c.fillStyle = hot ? "#fff09a" : "#ffe26b"; c.fillRect(B.x, B.y, B.w, B.h);
    c.fillStyle = "#c8892a"; c.fillRect(B.x, B.y + B.h - 2, B.w, 2);
    c.font = "bold 9px monospace"; c.textAlign = "center"; c.fillStyle = "#2a1a08";
    c.fillText("NHẢY DÙ", B.x + B.w / 2, B.y + 4);
    c.font = "6px monospace"; c.fillText(g.touchMode ? "chạm" : "ENTER", B.x + B.w / 2, B.y + 15);
    c.textAlign = "left";
    c.font = "7px monospace";
    hudText(c, g.touchMode ? "Chạm vòng tròn để chọn điểm nhảy · đường vàng = đường bay" : "Click vòng tròn để chọn điểm nhảy · ←→ đổi · Esc về sảnh · đường vàng = đường bay", MAP.x, H - 9, "#6a628a");
    c.font = "8px monospace";
  }
}

/** Cắt chữ cho vừa bề rộng */
function fit(c, s, w) {
  if (c.measureText(s).width <= w) return s;
  while (s.length > 1 && c.measureText(s + "…").width > w) s = s.slice(0, -1);
  return s + "…";
}

// =====================================================================================
//  AIRDROP — máy bay + nhảy dù + tiếp đất
// =====================================================================================
const DROP = { planeDur: 3.8, planeAlt: 118, fall: 2.5, openAt: 0.28, settle: 0.6, shockR: 74, shockDmg: 3 };

export class AirDrop {
  constructor(game, lz) {
    this.game = game;
    this.lz = lz;
    this.t = 0;
    this.x0 = lz.x - 440; this.x1 = lz.x + 470;
    this.tDrop = ((lz.x - 16 - this.x0) / (this.x1 - this.x0)) * DROP.planeDur;
    this.z = DROP.planeAlt; this.landed = false; this.done = false;
    this.engineT = 0;
    this.streaks = Array.from({ length: 6 }, (_, i) => ({ x: (i - 2.5) * 7, y: Math.random() * 30 }));
    game.sound.play("planeEngine", 0.6);
  }
  get planeX() { return this.x0 + (this.x1 - this.x0) * clamp(this.t / DROP.planeDur, 0, 1.2); }
  get planeY() { return this.lz.y - DROP.planeAlt; }
  get fallT() { return this.t - this.tDrop; }
  get falling() { return this.fallT >= 0 && !this.landed; }
  get chuteK() { return clamp((this.fallT - DROP.openAt) / 0.25, 0, 1); }

  /** -> "landed" đúng 1 lần lúc chạm đất, "done" khi xong hẳn, null còn lại */
  update(dt) {
    const g = this.game, p = g.player;
    this.t += dt;
    this.engineT -= dt;
    if (this.engineT <= 0 && this.t < DROP.planeDur) { this.engineT = 0.75; g.sound.play("planeEngine", 0.5); }
    p.anim?.set(this.falling ? "skill" : "idle");
    p.anim?.update(dt, 0.6);
    p.updateHand?.();
    let ev = null;
    if (this.fallT >= 0 && !this.landed) {
      if (this.fallT - dt < DROP.openAt && this.fallT >= DROP.openAt) g.sound.play("parachute", 0.6);
      const u = clamp(this.fallT / DROP.fall, 0, 1);
      // rơi nhanh lúc đầu, dù bung thì chậm lại
      this.z = DROP.planeAlt * (1 - (u < 0.15 ? u * 1.6 : 0.24 + (u - 0.15) * 0.894));
      this.z = Math.max(0, this.z);
      for (const s of this.streaks) { s.y -= dt * 90; if (s.y < -10) s.y += 40; }
      if (u >= 1) { this.landed = true; this.z = 0; this.landT = this.t; this.impact(); ev = "landed"; }
    }
    // camera nhìn theo người đang rơi
    g.camera.follow(p.x, p.cy - this.z * 0.6, dt);
    if (this.landed && this.t - this.landT >= DROP.settle && !this.done) { this.done = true; ev = "done"; }
    return ev;
  }

  /** Tiếp đất: bụi + sóng xung kích hất văng zombie quanh điểm đáp */
  impact() {
    const g = this.game, p = g.player;
    g.sound.play("land", 0.8);
    g.shake(0.4, 5);
    g.fx.slam?.(p.x, p.y + 2, 0.45);
    g.fx.dust?.(p.x - 8, p.y, true); g.fx.dust?.(p.x + 8, p.y, false);
    g.shocks.push({ x: p.x, y: p.y - 4, r: DROP.shockR, life: 0.45, max: 0.45, color: "#e8e2d0" });
    g.thornsBurst?.(p, DROP.shockDmg, DROP.shockR);
    p.hurtTimer = Math.max(p.hurtTimer, 1.2);   // vừa đáp: bất tử 1.2s
  }

  /** Lớp đất (dưới mọi thứ): bóng máy bay + bóng người đang rơi */
  drawGround(c) {
    const g = this.game, p = g.player;
    if (this.t < DROP.planeDur + 0.3) drawPlane(c, Math.round(this.planeX + 34), Math.round(this.lz.y + 34), 1, true, null);
    if (this.falling) {
      const k = 1 - this.z / DROP.planeAlt;
      c.fillStyle = `rgba(0,0,0,${0.15 + 0.3 * k})`;
      c.beginPath(); c.ellipse(Math.round(p.x), Math.round(p.y), 4 + 8 * k, 2 + 2 * k, 0, 0, TAU); c.fill();
    }
  }
  /** Lớp trên cùng: người + dù (đang rơi), máy bay */
  drawSky(c) {
    const g = this.game, p = g.player, t = this.t;
    if (this.falling) {
      const sway = Math.sin(t * 2.6) * 3 * this.chuteK, x = p.x + sway, z = this.z;
      c.fillStyle = "rgba(255,255,255,0.35)";
      for (const s of this.streaks) c.fillRect(Math.round(x + s.x), Math.round(p.y - z - 20 + s.y), 1, 6);
      const ox = p.x; p.x = x;
      c.save(); c.translate(0, -Math.round(z)); p.draw(c, g); c.restore();
      p.x = ox;
      if (this.chuteK > 0) drawParachute(c, x, p.y - z - 58, this.chuteK, g.assets.images["x:parachute"], t);
    }
    if (this.t < DROP.planeDur + 0.3) drawPlane(c, Math.round(this.planeX), Math.round(this.planeY), 1, false, g.assets.images["x:airplane"]);
  }
}

/**
 * MÁY BAY VẬN TẢI nhìn từ trên xuống (mũi sang PHẢI), 4 động cơ cánh quạt.
 * shadow = true: vẽ bóng đen mờ trên mặt đất. img = ảnh của bạn (EXTRACT_IMAGES "x:airplane").
 */
export function drawPlane(c, x, y, s = 1, shadow = false, img = null) {
  if (img && !shadow) { c.drawImage(img, Math.round(x - img.width * s / 2), Math.round(y - img.height * s / 2), img.width * s, img.height * s); return; }
  const R = (dx, dy, w, h, col) => { c.fillStyle = shadow ? "rgba(0,0,0,0.32)" : col; c.fillRect(Math.round(x + dx * s), Math.round(y + dy * s), Math.max(1, Math.round(w * s)), Math.max(1, Math.round(h * s))); };
  const ink = "#141a0c", olive = "#5a6a34", dark = "#3a4620", hi = "#7e8e52";
  // cánh chính
  R(-14, -56, 18, 112, ink); R(-13, -55, 16, 110, olive); R(-13, -55, 3, 110, hi); R(1, -55, 2, 110, dark);
  // cánh đuôi
  R(-48, -20, 10, 40, ink); R(-47, -19, 8, 38, olive); R(-47, -19, 2, 38, hi);
  // thân
  R(-52, -7, 98, 14, ink); R(-51, -6, 96, 12, olive); R(-51, -6, 96, 3, hi); R(-51, 3, 96, 3, dark);
  R(42, -5, 6, 10, ink); R(42, -4, 5, 8, olive);                       // mũi
  R(38, -4, 4, 2, "#9fd8ff"); R(38, 2, 4, 2, "#9fd8ff");                 // kính buồng lái
  R(-54, -2, 4, 4, ink);                                                 // đuôi
  // động cơ + cánh quạt (vệt mờ)
  for (const ey of [-40, -22, 22, 40]) {
    R(-2, ey - 3, 12, 6, ink); R(-1, ey - 2, 10, 4, dark);
    if (!shadow) { c.fillStyle = "rgba(220,220,230,0.35)"; c.fillRect(Math.round(x + 10 * s), Math.round(y + (ey - 7) * s), Math.max(1, Math.round(2 * s)), Math.max(1, Math.round(14 * s))); }
  }
  if (!shadow && s >= 0.5) { R(-30, -2, 6, 4, "#e8e2d0"); R(-12, -45, 6, 4, "#e8e2d0"); R(-12, 41, 6, 4, "#e8e2d0"); }   // sao trắng
}

/** Tán dù sọc ô-liu / trắng + dây treo (cx, top: tâm trên tán) */
function drawParachute(c, cx, top, k, img, t) {
  const x = Math.round(cx), y = Math.round(top);
  if (img) { const w = img.width * k, h = img.height * k; c.drawImage(img, Math.round(x - w / 2), Math.round(y - h / 2), w, h); return; }   // >>> ẢNH DÙ CỦA BẠN
  const W = Math.round(18 * k), Hh = Math.max(2, Math.round(10 * k)), breath = Math.round(Math.sin(t * 5) * k);
  // dây treo
  c.fillStyle = "rgba(232,226,208,0.8)";
  for (const [ax, bx] of [[-W, -4], [-W / 2, -3], [W / 2, 3], [W, 4]]) {   // dây treo tới vai nhân vật (~36px dưới tán)
    for (let i = 0; i <= 18; i++) { const u = i / 18; c.fillRect(Math.round(x + ax + (bx - ax) * u), Math.round(y + 2 + u * 36), 1, 1); }
  }
  // tán dù (nửa elip) với sọc
  for (let j = 0; j < Hh; j++) {
    const half = Math.round((W + breath) * Math.sqrt(1 - ((Hh - j) / (Hh + 0.5)) ** 2));
    for (let i = -half; i <= half; i++) {
      const seg = Math.floor((i + W + 40) / Math.max(3, Math.round(5 * k))) % 2;
      c.fillStyle = j === 0 || Math.abs(i) === half ? "#141a0c" : seg ? "#e8e2d0" : "#5a6a34";
      c.fillRect(x + i, y - Hh + j + 2, 1, 1);
    }
  }
  c.fillStyle = "#141a0c"; c.fillRect(x - W - breath, y + 2, (W + breath) * 2 + 1, 1);
  c.fillStyle = "rgba(255,255,255,0.25)"; c.fillRect(x - Math.round(W * 0.5), y - Hh + 3, Math.round(W * 0.4), 1);
}
export { withAlpha };

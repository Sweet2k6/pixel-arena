// =====================================================================================
//  CẢNH NỀN MÀN HÌNH CHÍNH — trường đại học về đêm (vẽ trên canvas 480x270)
//    trời bão tím đen + trăng máu sau mây · tòa giảng đường 4 tầng, cửa sổ chập chờn, 1 bóng người đứng ở ô cửa đỏ
//    hàng rào sắt, cây chết, cột đèn chập chờn, sân ướt phản chiếu · mưa xiên · SÉT lóe trắng · sương mù · bóng zombie lê bước
//  Ở màn GIẢI TRÍ: tối hơn, có vệt đèn rọi + nhân vật đang chọn đứng giữa (phóng to)
// =====================================================================================
const W = 480, H = 270, GROUND = 214;
const R = (g, c, x, y, w, h) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
const rng = (s) => () => ((s = (s * 1664525 + 1013904223) | 0) >>> 0) / 4294967296;

export class TitleScene {
  constructor() {
    const r = rng(7);
    this.sky = this.paintSky(r);
    this.building = this.paintBuilding(r);
    this.front = this.paintFront(r);
    this.rain = Array.from({ length: 150 }, () => ({ x: Math.random() * W, y: Math.random() * H, v: 260 + Math.random() * 160, l: 4 + Math.random() * 6 }));
    this.fog = Array.from({ length: 9 }, (_, i) => ({ x: Math.random() * W, y: GROUND - 18 + Math.random() * 40, r: 50 + Math.random() * 50, v: 4 + Math.random() * 6, a: 0.05 + Math.random() * 0.05, i }));
    this.walkers = Array.from({ length: 4 }, (_, i) => ({ x: Math.random() * W, y: GROUND + 4 + i * 9, v: (3 + Math.random() * 3) * (i % 2 ? -1 : 1), s: 0.7 + i * 0.1, ph: Math.random() * 6 }));
    this.bolt = 0; this.nextBolt = 3; this.boltPath = null;
    this.t = 0;
  }

  paintSky() {
    const c = mk(W, GROUND + 20), g = c.getContext("2d");
    const gr = g.createLinearGradient(0, 0, 0, GROUND);
    gr.addColorStop(0, "#07050d"); gr.addColorStop(0.5, "#160c1e"); gr.addColorStop(1, "#2a1420");
    g.fillStyle = gr; g.fillRect(0, 0, W, GROUND + 20);
    for (let i = 0; i < 60; i++) R(g, `rgba(200,190,230,${0.15 + Math.random() * 0.3})`, Math.random() * W, Math.random() * 90, 1, 1);
    return c;
  }
  paintBuilding(r) {
    const c = mk(W, H), g = c.getContext("2d");
    // dãy nhà xa phía sau (đen mờ)
    for (let x = 0; x < W; x += 30 + r() * 30) { const h = 30 + r() * 40; R(g, "#100a14", x, GROUND - 60 - h, 26 + r() * 26, h + 60); }
    // TÒA GIẢNG ĐƯỜNG CHÍNH
    const bx = 150, bw = 300, top = 70;
    R(g, "#06040a", bx - 2, top - 2, bw + 4, GROUND - top + 2);
    R(g, "#1e1822", bx, top, bw, GROUND - top);
    R(g, "#2a2230", bx, top, bw, 4);                                 // mái
    R(g, "#14101a", bx + bw * 0.42, top - 26, bw * 0.16, 26);         // tháp giữa
    R(g, "#2a2230", bx + bw * 0.42, top - 26, bw * 0.16, 3);
    R(g, "#0c0a10", bx + bw * 0.47, top - 18, bw * 0.06, 10);         // đồng hồ đứng
    R(g, "#3a3040", bx + bw * 0.495, top - 15, 1, 5);
    for (let f = 0; f < 4; f++) R(g, "#16121c", bx, top + 12 + f * 34, bw, 2);   // gờ tầng
    // ô cửa sổ (tắt) — vị trí lưu lại để vẽ sáng chập chờn
    this.wins = [];
    for (let f = 0; f < 4; f++) for (let i = 0; i < 14; i++) {
      const x = bx + 10 + i * 20.5, y = top + 16 + f * 34;
      if (i === 6 || i === 7) continue;   // khối cầu thang giữa
      R(g, "#0a080e", x - 1, y - 1, 12, 18); R(g, "#120e18", x, y, 10, 16); R(g, "#1c1824", x + 4, y, 2, 16);
      this.wins.push({ x, y, f, i, lit: r() < 0.22, seed: r() * 10, red: f === 1 && i === 10 });
    }
    // cửa chính + bậc
    R(g, "#0a080c", bx + bw * 0.43, GROUND - 30, bw * 0.14, 30);
    R(g, "#2a2030", bx + bw * 0.4, GROUND - 4, bw * 0.2, 4);
    // biển tên trường (không ghi tên thật)
    R(g, "#0e0a12", bx + bw * 0.36, GROUND - 42, bw * 0.28, 9); R(g, "#3a2a2a", bx + bw * 0.37, GROUND - 40, bw * 0.26, 5);
    // cây chết bên trái
    const tree = (x0, y0, a, len, w) => { if (len < 4) return; const x1 = x0 + Math.cos(a) * len, y1 = y0 + Math.sin(a) * len; g.strokeStyle = "#08060a"; g.lineWidth = w; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); tree(x1, y1, a - 0.45 - r() * 0.3, len * 0.72, Math.max(1, w * 0.7)); tree(x1, y1, a + 0.35 + r() * 0.3, len * 0.66, Math.max(1, w * 0.7)); };
    tree(60, GROUND + 4, -Math.PI / 2 - 0.08, 46, 6);
    return c;
  }
  paintFront(r) {
    const c = mk(W, H), g = c.getContext("2d");
    // sân ướt
    const gr = g.createLinearGradient(0, GROUND, 0, H);
    gr.addColorStop(0, "#1a1218"); gr.addColorStop(1, "#08060a");
    g.fillStyle = gr; g.fillRect(0, GROUND, W, H - GROUND);
    for (let i = 0; i < 40; i++) R(g, "rgba(120,110,160,0.12)", r() * W, GROUND + 6 + r() * 50, 6 + r() * 20, 1);   // vũng nước
    // hàng rào sắt phía trước
    R(g, "#050407", 0, H - 46, W, 3); R(g, "#050407", 0, H - 22, W, 3);
    for (let x = 4; x < W; x += 9) { R(g, "#050407", x, H - 58, 3, 58); R(g, "#050407", x, H - 61, 1, 3); R(g, "#050407", x + 2, H - 61, 1, 3); R(g, "#050407", x + 1, H - 63, 1, 3); }
    // cột đèn
    R(g, "#060408", 108, GROUND - 70, 3, 82); R(g, "#060408", 104, GROUND - 72, 12, 4);
    return c;
  }

  update(dt) {
    this.t += dt;
    for (const d of this.rain) { d.y += d.v * dt; d.x -= d.v * 0.25 * dt; if (d.y > H) { d.y = -10; d.x = Math.random() * (W + 60); } }
    for (const f of this.fog) { f.x += f.v * dt; if (f.x - f.r > W) f.x = -f.r; }
    for (const z of this.walkers) { z.x += z.v * dt; if (z.x > W + 20) z.x = -20; if (z.x < -20) z.x = W + 20; }
    this.nextBolt -= dt;
    if (this.nextBolt <= 0) {
      this.nextBolt = 5 + Math.random() * 9; this.bolt = 1;
      const pts = [[60 + Math.random() * 360, 0]];
      while (pts[pts.length - 1][1] < 90) { const [x, y] = pts[pts.length - 1]; pts.push([x + (Math.random() - 0.5) * 24, y + 8 + Math.random() * 10]); }
      this.boltPath = pts;
      this.onThunder?.();
    }
    this.bolt = Math.max(0, this.bolt - dt * 1.8);
  }

  /** mode: "title" | "story" | "fun" · hero: { sprite, anim } khi ở màn Giải Trí */
  draw(c, mode = "title", hero = null) {
    const t = this.t, b = this.bolt;
    c.imageSmoothingEnabled = false;
    c.drawImage(this.sky, 0, 0);
    // trăng máu sau mây
    const mx = 96, my = 52;
    c.fillStyle = "rgba(160,30,30,0.12)"; c.beginPath(); c.arc(mx, my, 34, 0, Math.PI * 2); c.fill();
    c.fillStyle = "#8a2424"; c.beginPath(); c.arc(mx, my, 15, 0, Math.PI * 2); c.fill();
    c.fillStyle = "#a83a32"; c.beginPath(); c.arc(mx - 3, my - 3, 11, 0, Math.PI * 2); c.fill();
    for (let i = 0; i < 6; i++) { const x = ((t * (6 + i * 2) + i * 97) % (W + 160)) - 80, y = 30 + i * 13; c.fillStyle = `rgba(20,10,24,${0.55 + (i % 2) * 0.2})`; c.fillRect(Math.round(x), y, 90 + i * 12, 7 + (i % 3) * 3); }
    if (this.boltPath && b > 0.4) { c.strokeStyle = `rgba(230,235,255,${b})`; c.lineWidth = 1.5; c.beginPath(); this.boltPath.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke(); }
    c.drawImage(this.building, 0, 0);
    // cửa sổ sáng chập chờn + ô cửa đỏ có bóng người
    for (const w of this.wins) {
      if (w.red) {
        c.fillStyle = "#5a0c10"; c.fillRect(w.x, w.y, 10, 16);
        if (Math.sin(t * 0.7) > -0.3) { c.fillStyle = "#0a0204"; c.fillRect(w.x + 3, w.y + 4, 4, 12); c.fillRect(w.x + 4, w.y + 2, 2, 3); }
        continue;
      }
      if (!w.lit) continue;
      const on = Math.sin(t * (3 + w.seed) + w.seed * 7) > -0.6 || (Math.sin(t * 23 + w.seed) > 0.9);
      if (!on) continue;
      c.fillStyle = "#a88a4a"; c.fillRect(w.x, w.y, 10, 16); c.fillStyle = "#d8b86a"; c.fillRect(w.x + 1, w.y + 1, 3, 6);
    }
    c.drawImage(this.front, 0, 0);
    // đèn cột chập chờn + quầng
    const lamp = Math.sin(t * 13) > -0.2 || Math.sin(t * 2.3) > 0.4;
    if (lamp) { c.fillStyle = "rgba(255,200,120,0.12)"; c.beginPath(); c.arc(110, GROUND - 66, 30, 0, Math.PI * 2); c.fill(); c.fillStyle = "#ffd890"; c.fillRect(106, GROUND - 68, 8, 2); c.fillStyle = "rgba(255,200,120,0.06)"; c.beginPath(); c.moveTo(106, GROUND - 66); c.lineTo(80, GROUND + 14); c.lineTo(140, GROUND + 14); c.lineTo(114, GROUND - 66); c.fill(); }
    // bóng zombie lê bước ngoài sân
    for (const z of this.walkers) {
      const sway = Math.sin(t * 2.5 + z.ph) * 1.2, x = Math.round(z.x), y = Math.round(z.y), s = z.s;
      c.fillStyle = "#040305";
      c.fillRect(x - 3 * s, y - 22 * s + sway * 0.5, 6 * s, 14 * s);
      c.fillRect(x - 2 * s + sway, y - 27 * s, 5 * s, 5 * s);
      c.fillRect(x + (z.v > 0 ? 2 : -6) * s, y - 20 * s, 5 * s, 2 * s);   // tay giơ ra trước
      c.fillRect(x - 3 * s, y - 8 * s, 2 * s, 8 * s + Math.sin(t * 3 + z.ph) * 1); c.fillRect(x + 1 * s, y - 8 * s, 2 * s, 8 * s - Math.sin(t * 3 + z.ph) * 1);
      if (Math.sin(t * 1.3 + z.ph) > 0.2) { c.fillStyle = "rgba(255,40,30,0.8)"; c.fillRect(x + (z.v > 0 ? 1 : -1) * s, y - 25 * s, 1, 1); }
    }
    // sương mù
    for (const f of this.fog) { c.fillStyle = `rgba(120,110,140,${f.a})`; c.beginPath(); c.ellipse(f.x, f.y, f.r, f.r * 0.25, 0, 0, Math.PI * 2); c.fill(); }
    // mưa
    c.strokeStyle = "rgba(170,180,220,0.35)"; c.lineWidth = 1; c.beginPath();
    for (const d of this.rain) { c.moveTo(d.x, d.y); c.lineTo(d.x + d.l * 0.25, d.y - d.l); }
    c.stroke();
    // màn GIẢI TRÍ / CỐT TRUYỆN: tối hơn để chữ dễ đọc
    if (mode !== "title") { c.fillStyle = mode === "fun" ? "rgba(6,4,10,0.62)" : "rgba(6,4,10,0.45)"; c.fillRect(0, 0, W, H); }
    if (mode === "fun" && hero?.sprite) this.drawHero(c, hero);
    // chớp sét
    if (b > 0) { c.fillStyle = `rgba(220,230,255,${b * b * 0.55})`; c.fillRect(0, 0, W, H); }
  }

  /** Nhân vật đang chọn đứng giữa vệt đèn rọi (phóng to 3 lần) */
  drawHero(c, hero) {
    const cx = hero.x ?? 240, fy = hero.y ?? 214, k = hero.scale ?? 3;
    const gr = c.createRadialGradient(cx, fy - 4, 4, cx, fy - 4, 70);
    gr.addColorStop(0, "rgba(255,230,180,0.22)"); gr.addColorStop(1, "rgba(255,230,180,0)");
    c.fillStyle = gr; c.beginPath(); c.ellipse(cx, fy - 4, 70, 26, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = "rgba(255,230,180,0.05)"; c.beginPath(); c.moveTo(cx - 14, 0); c.lineTo(cx + 14, 0); c.lineTo(cx + 64, fy); c.lineTo(cx - 64, fy); c.fill();
    c.fillStyle = "rgba(0,0,0,0.45)"; c.beginPath(); c.ellipse(cx, fy, 12 * k * 0.6, 3 * k * 0.6, 0, 0, Math.PI * 2); c.fill();
    const S = hero.sprite, a = hero.anim, sh = S.sheet;
    c.save(); c.translate(cx, fy); c.scale(k, k);
    sh.draw(c, a.col, a.row, 0, 0, false);
    c.restore();
  }
}

function mk(w, h) { const c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d"); g.imageSmoothingEnabled = false; return c; }

// =====================================================================================
//  NHIỆM VỤ ĐỘNG TRONG TRẬN (chế độ Nhảy Dù Rút Quân)
//
//  Mỗi ván tự tạo 2–3 NHIỆM VỤ CHÍNH (ván 5 phút: 2, ván 7–10 phút: 3), đặt ở các điểm do bản đồ chuẩn bị
//  (world.missionSites trong src/extractMap.js):
//    capture  — CHIẾM CỨ ĐIỂM: đứng trong vòng tròn, thanh tiến độ 0% -> 100%. Đang chiếm thì 1–2 đàn zombie tràn tới.
//    rescue   — CỨU NGƯỜI SỐNG SÓT: 1 đàn zombie vây quanh người dân. Diệt sạch đàn rồi lại gần bấm E để giải cứu;
//               người được cứu chạy về điểm an toàn và tặng Hộp cứu thương / Năng lượng / điểm thưởng.
//    hive     — PHÁ HỦY Ổ DỊCH: kén zombie liên tục đẻ zombie khi bạn ở gần. Bắn nát kén.
//    download — TẢI DỮ LIỆU HỘP ĐEN: bấm E ở trạm phát sóng, đứng trong vùng tới khi tải xong (zombie kéo tới).
//  Hoàn thành ít nhất 1 nhiệm vụ thì ĐIỂM RÚT QUÂN mở (xem src/extraction.js).
//  Chỉnh độ khó / phần thưởng: MISSION_TYPES bên dưới.
// =====================================================================================
import { Enemy, ENEMY_TYPES } from "./enemies.js";
import { CHARACTERS } from "../characters.js";
import { withAlpha, TAU, rand, clamp } from "./util.js";

/** >>> CẤU HÌNH NHIỆM VỤ <<<  reward: vật phẩm thưởng (vào túi / ba lô), score: điểm thưởng */
export const MISSION_TYPES = {
  capture:  { name: "Chiếm Cứ Điểm",       short: "CỨ ĐIỂM", color: "#ffb030", time: 26, radius: 64, waves: [0.04, 0.5],
              reward: { energyCell: 1, grenade: 2 }, score: 400, desc: "Đứng trong vòng tròn tới 100% — zombie sẽ tràn tới" },
  rescue:   { name: "Cứu Người Sống Sót",  short: "CỨU NGƯỜI", color: "#5fdc8c", guardR: 80,
              reward: { medkit: 2, energyCell: 1 }, score: 350, desc: "Diệt đàn zombie vây quanh rồi bấm E để giải cứu" },
  hive:     { name: "Phá Hủy Ổ Dịch",      short: "Ổ DỊCH",  color: "#c84aff", hp: 55, spawnEvery: 6.5, spawnRange: 430, maxBrood: 6,
              reward: { mine: 1, stim: 1 }, score: 450, desc: "Bắn nát kén zombie đang sinh sản" },
  download: { name: "Tải Dữ Liệu Hộp Đen", short: "HỘP ĐEN", color: "#4ac8ff", time: 22, radius: 72, waves: [0.04, 0.55],
              reward: { medkit: 1, energyCell: 1, grenade: 1 }, score: 400, desc: "Bấm E ở trạm phát sóng rồi giữ vị trí tới khi tải xong" },
};

/** Kén ổ dịch là 1 "quái" đứng yên (để đạn / kiếm / nổ của mọi vũ khí đều đánh trúng được) */
ENEMY_TYPES.zHive ??= {
  name: "Kén Ổ Dịch", sprite: "__hive", ai: "hive", hp: MISSION_TYPES.hive.hp, speed: 0, radius: 15, bodyY: -14,
  damage: 0, score: 0, exp: 8, noContact: true, scale: 1, hive: true,
};

/** Số nhiệm vụ theo thời lượng ván */
export const missionCount = (minutes) => (minutes <= 5 ? 2 : 3);

export class MissionManager {
  /** game: Game · run: ExtractionRun · minutes: thời lượng ván */
  constructor(game, run, minutes) {
    this.game = game;
    this.run = run;
    this.list = [];
    this.t = 0;
    this.build(missionCount(minutes));
  }

  get doneCount() { return this.list.filter((m) => m.state === "done").length; }
  get active() { return this.list.filter((m) => m.state === "active"); }

  /** Chọn loại & vị trí nhiệm vụ từ các điểm bản đồ đã chuẩn bị */
  build(n) {
    const sites = this.game.world.missionSites ?? {};
    const third = Math.random() < 0.5 ? "hive" : "download";
    let types = ["capture", "rescue", third];
    if (n < 3) types = shuffle(types).slice(0, n);
    const used = [];
    types.forEach((type, i) => {
      const key = { capture: "outpost", rescue: "rescue", hive: "hive", download: "tower" }[type];
      let cands = (sites[key] ?? []).filter((s) => used.every((u) => (u.x - s.x) ** 2 + (u.y - s.y) ** 2 > 380 * 380));
      if (!cands.length) cands = sites[key] ?? [];
      let site = cands.length ? cands[(Math.random() * cands.length) | 0] : null;
      site ??= this.game.world.randomFreePoint({ margin: 60 });
      if (!site) return;
      used.push(site);
      const cfg = MISSION_TYPES[type];
      const m = { n: i + 1, type, cfg, color: cfg.color, x: site.x, y: site.y, state: "active", progress: 0, wave: 0, started: false, tag: `m${i}${type}`, t: 0 };
      this.list.push(m);
      this.setup(m);
    });
  }

  setup(m) {
    const g = this.game, H = g.horde, zone = g.world.zoneAt?.(m.x, m.y)?.id;
    if (m.type === "rescue") {
      // người dân: dùng ngoại hình 1 nhân vật khác (không trùng nhân vật đang chơi)
      const pool = CHARACTERS.filter((c) => c.id !== g.player?.char.id);
      const ch = pool[(Math.random() * pool.length) | 0];
      const sp = g.actorSprites?.get(ch.id) ?? null, anim = sp?.controller() ?? null;
      anim?.randomize();
      m.survivor = { x: m.x, y: m.y, sprite: sp, anim, flip: Math.random() < 0.5, state: "trapped", t: 0, name: ch.name, vx: 0, vy: 0 };
      H?.spawnSquad(m.x + 30, m.y + 10, { state: "guard", guardX: m.x, guardY: m.y, guardR: m.cfg.guardR, tag: m.tag, zone, size: 6 });
    } else if (m.type === "hive") {
      const e = Enemy.obtain("zHive", m.x, m.y, g.enemyOpts({}), g.actorSprites);
      e.spawnTime = 0;
      g.enemies.push(e);
      m.hive = e; m.hiveSerial = e.serial; m.broodT = 2;
      H?.spawnSquad(m.x + 40, m.y + 30, { state: "guard", guardX: m.x, guardY: m.y, guardR: 110, tag: `${m.tag}g`, zone });
    } else if (m.type === "capture") {
      H?.spawnSquad(m.x + 70, m.y - 20, { state: "guard", guardX: m.x, guardY: m.y, guardR: 120, tag: `${m.tag}g`, zone });
    }
  }

  update(dt) {
    const g = this.game, p = g.player;
    this.t += dt;
    for (const m of this.list) {
      m.t += dt;
      if (m.type === "rescue") this.updateSurvivor(m, dt);
      if (m.state !== "active") continue;
      const d2 = (p.x - m.x) ** 2 + (p.y - m.y) ** 2;
      switch (m.type) {
        case "capture": {
          const inside = d2 < m.cfg.radius ** 2 && p.hp > 0;
          m.inside = inside;
          if (inside) {
            if (!m.started) { m.started = true; g.banner("ĐANG CHIẾM CỨ ĐIỂM — giữ vị trí!", m.color, true, 2.4); }
            m.progress = Math.min(1, m.progress + dt / m.cfg.time);
            if ((m.tick = (m.tick ?? 0) - dt) <= 0) { m.tick = 1; g.sound.play("capture", 0.4); }
          }
          this.waves(m);
          if (m.progress >= 1) this.complete(m);
          break;
        }
        case "download": {
          const inside = d2 < m.cfg.radius ** 2 && p.hp > 0;
          m.inside = inside;
          if (m.started && inside) {
            m.progress = Math.min(1, m.progress + dt / m.cfg.time);
            if ((m.tick = (m.tick ?? 0) - dt) <= 0) { m.tick = 0.5; g.sound.play("capture", 0.3); }
          }
          if (m.started) this.waves(m);
          if (m.progress >= 1) this.complete(m);
          break;
        }
        case "rescue": {
          const s = m.survivor;
          if (s.state === "trapped" && (g.horde ? g.horde.aliveIn(m.tag) : 0) === 0) {
            s.state = "free";
            g.banner(`Đã dọn sạch đàn zombie — lại gần ${s.name} bấm E để giải cứu`, m.color, false, 3);
          }
          break;
        }
        case "hive": {
          const h = m.hive;
          if (!h || h.dead || h.serial !== m.hiveSerial) { this.complete(m); break; }
          h.x = m.x; h.y = m.y; h.kx = h.ky = 0;   // kén cắm rễ xuống đất: không bị đẩy đi
          m.progress = 1 - h.hp / h.maxHp;
          m.broodT -= dt;
          if (m.broodT <= 0 && d2 < m.cfg.spawnRange ** 2) {
            m.broodT = m.cfg.spawnEvery;
            if ((g.horde?.aliveIn(`${m.tag}b`) ?? 0) < m.cfg.maxBrood) {
              g.horde?.spawnSquad(m.x + rand(-20, 20), m.y + 24, { types: ["zWalker", Math.random() < 0.5 ? "zRunner" : "zWalker"], size: 2, state: "hunt", tag: `${m.tag}b` });
              g.fx.spawn?.(m.x, m.y + 8);
              g.sound.play("zombieGroan", 0.4);
            }
          }
          break;
        }
      }
    }
  }

  /** Đợt zombie tràn tới khi tiến độ chiếm / tải vượt các mốc cfg.waves */
  waves(m) {
    const W = m.cfg.waves ?? [];
    while (m.wave < W.length && m.progress >= W[m.wave]) {
      m.wave++;
      const g = this.game, n = m.wave === 1 ? 1 : 1 + (g.diffIndex >= 2 ? 1 : 0) + (Math.random() < 0.5 ? 1 : 0);
      for (let i = 0; i < n; i++) g.horde?.spawnHuntSquad(m.x, m.y, { tag: `${m.tag}w` });
      g.sound.play("zombieHowl", 0.6);
      g.banner(m.wave === 1 ? "Zombie nghe thấy bạn — đàn đang tràn tới!" : "ĐỢT ZOMBIE THỨ 2 ĐANG TỚI!", "#ff7a5a", false, 2.6);
    }
  }

  complete(m) {
    if (m.state !== "active") return;
    m.state = "done"; m.progress = 1;
    const g = this.game;
    g.sound.play("missionDone", 0.8);
    g.screenFlash(m.color, 0.25);
    g.fx.levelUp?.(g.player.x, g.player.y + 2);
    g.banner(`HOÀN THÀNH: ${m.cfg.name.toUpperCase()}`, m.color, true, 3.2);
    g.score += m.cfg.score;
    if (m.type === "hive") { g.fx.darkExplosion?.(m.x, m.y + 6, 0.6); g.shake(0.4, 5); }
    for (const [id, n] of Object.entries(m.cfg.reward)) this.run.addLoot(id, n, true);
    this.run.onMissionDone(m);
  }

  // ---------------------------------------------------------------- NGƯỜI SỐNG SÓT
  updateSurvivor(m, dt) {
    const s = m.survivor;
    if (!s || s.state === "gone") return;
    s.t += dt;
    const p = this.game.player;
    if (s.state === "leaving") {
      // chạy về điểm an toàn (bãi đáp gần nhất hoặc ngã tư) rồi biến mất
      const tx = s.tx, ty = s.ty, dx = tx - s.x, dy = ty - s.y, d = Math.hypot(dx, dy) || 1;
      this.game.world.moveBody(s, (dx / d) * 92 * dt, (dy / d) * 92 * dt, 5, false);
      s.flip = dx < 0;
      if (s.t > 4.2 || d < 10) { s.state = "gone"; this.game.fx.spawn?.(s.x, s.y - 8); }
    } else if (Math.abs(p.x - s.x) > 2) s.flip = p.x < s.x;
    if (s.anim) { s.anim.set(s.state === "leaving" ? "run" : "idle"); s.anim.update(dt, s.state === "trapped" ? 1.6 : 1); }
  }

  // ---------------------------------------------------------------- TƯƠNG TÁC (E)
  /** Mục tiêu tương tác gần người chơi: giải cứu / bắt đầu tải dữ liệu */
  findInteract(p) {
    let best = null, bd = 34 * 34;
    for (const m of this.list) {
      if (m.state !== "active") continue;
      if (m.type === "rescue" && m.survivor.state === "free") {
        const d = (m.survivor.x - p.x) ** 2 + (m.survivor.y - p.y) ** 2;
        if (d < bd) { bd = d; best = { kind: "rescue", ref: m, x: m.survivor.x, y: m.survivor.y - 34, label: `Giải cứu ${m.survivor.name}` }; }
      } else if (m.type === "download" && !m.started) {
        const d = (m.x - p.x) ** 2 + (m.y - p.y) ** 2;
        if (d < 40 * 40 && d < bd + 400) { bd = d; best = { kind: "download", ref: m, x: m.x, y: m.y - 52, label: "Bắt đầu tải dữ liệu" }; }
      }
    }
    return best;
  }
  interact(t) {
    const g = this.game, m = t.ref;
    if (t.kind === "rescue") {
      const s = m.survivor;
      s.state = "leaving"; s.t = 0;
      const pads = g.world.extractPads ?? [];
      let goal = g.world.spawn ?? { x: s.x, y: s.y + 200 }, bd = Infinity;
      for (const q of pads) { const d = (q.x - s.x) ** 2 + (q.y - s.y) ** 2; if (d < bd) { bd = d; goal = q; } }
      s.tx = goal.x; s.ty = goal.y;
      g.sound.play("heal", 0.6);
      g.banner(`${s.name}: "Cảm ơn! Tôi sẽ chạy về điểm an toàn!"`, "#c8ffd8", false, 3);
      this.complete(m);
    } else if (t.kind === "download") {
      m.started = true;
      g.sound.play("uiStart", 0.5);
      g.banner("ĐANG TẢI DỮ LIỆU — đứng trong vùng xanh!", m.color, true, 2.6);
      g.makeNoise(m.x, m.y, 420);   // trạm phát sóng kêu bíp bíp -> zombie nghe thấy
    }
  }

  // ---------------------------------------------------------------- VẼ (ctx ĐÃ dịch theo camera)
  /** Dưới chân nhân vật: vòng chiếm cứ điểm, vùng tải dữ liệu, vòng cứu người */
  drawGround(c) {
    const g = this.game, t = this.t;
    for (const m of this.list) {
      if (!g.camera.inView(m.x, m.y, 120)) continue;
      const x = Math.round(m.x), y = Math.round(m.y);
      if (m.type === "capture" || m.type === "download") {
        const R = m.cfg.radius, done = m.state === "done", col = done ? "#5fdc8c" : m.color;
        if (m.type === "download" && !m.started && !done) { dashedEllipse(c, x, y, R, R * 0.5, withAlpha(col, 0.35), t); continue; }
        c.fillStyle = withAlpha(col, m.inside ? 0.16 + 0.06 * Math.sin(t * 6) : 0.08);
        c.beginPath(); c.ellipse(x, y, R, R * 0.5, 0, 0, TAU); c.fill();
        // tiến độ: vòng cung sáng quanh mép
        c.strokeStyle = withAlpha("#000000", 0.45); c.lineWidth = 3;
        c.beginPath(); c.ellipse(x, y, R, R * 0.5, 0, 0, TAU); c.stroke();
        c.strokeStyle = col; c.lineWidth = 2;
        c.beginPath(); c.ellipse(x, y, R, R * 0.5, 0, -Math.PI / 2, -Math.PI / 2 + TAU * m.progress); c.stroke();
        dashedEllipse(c, x, y, R - 5, (R - 5) * 0.5, withAlpha(col, 0.5), t);
        if (m.type === "capture") drawFlagBase(c, x, y);
      } else if (m.type === "rescue" && m.state === "active") {
        dashedEllipse(c, x, y, m.cfg.guardR, m.cfg.guardR * 0.45, withAlpha(m.color, 0.22), t * 0.5);
      }
    }
  }

  /** Vật thể đứng (sắp theo trục Y cùng người & quái): người sống sót, kén, trạm phát sóng, cờ cứ điểm */
  collectActors(list) {
    for (const m of this.list) {
      if (!this.game.camera.inView(m.x, m.y, 140)) continue;
      if (m.type === "rescue" && m.survivor.state !== "gone") list.push(m.survivor.drawable ??= { y: 0, draw: (c, g) => this.drawSurvivor(c, g, m) });
      if (m.type === "rescue" && m.survivor.drawable) m.survivor.drawable.y = m.survivor.y;
      if (m.type === "hive" && m.state === "active") list.push(m.drawable ??= { y: m.y, draw: (c, g) => this.drawHive(c, g, m) });
      if (m.type === "download") list.push(m.drawable ??= { y: m.y - 2, draw: (c, g) => this.drawTower(c, g, m) });
      if (m.type === "capture") list.push(m.drawable ??= { y: m.y - 1, draw: (c, g) => this.drawFlag(c, g, m) });
    }
  }

  /** Lớp phát sáng: thanh tiến độ trên mục tiêu, bóng chữ "CỨU!" */
  drawOverlay(c) {
    const g = this.game, t = this.t;
    c.font = "7px monospace"; c.textAlign = "center"; c.textBaseline = "top";
    for (const m of this.list) {
      if (!g.camera.inView(m.x, m.y, 100)) continue;
      if ((m.type === "capture" || m.type === "download") && m.state === "active" && (m.started || m.progress > 0)) {
        const w = 44, x = Math.round(m.x - w / 2), y = Math.round(m.y - (m.type === "download" ? 62 : 52));
        c.fillStyle = "#0b0912"; c.fillRect(x - 1, y - 1, w + 2, 5);
        c.fillStyle = "#2a2338"; c.fillRect(x, y, w, 3);
        c.fillStyle = m.inside ? m.color : withAlpha(m.color, 0.55); c.fillRect(x, y, Math.round(w * m.progress), 3);
        outlined(c, `${Math.floor(m.progress * 100)}%`, Math.round(m.x), y - 9, m.inside ? "#ffffff" : "#a69dc4");
      }
      if (m.type === "rescue" && m.state === "active") {
        const s = m.survivor, bob = Math.round(Math.sin(t * 6) * 1.5);
        if (s.state === "trapped") { speech(c, s.x, s.y - 44 + bob, "CỨU TÔI!", "#ff6a6a"); }
        else if (s.state === "free") { speech(c, s.x, s.y - 44 + bob, "Ở ĐÂY!", "#5fdc8c"); }
      }
    }
    c.textAlign = "left";
  }

  drawSurvivor(c, g, m) {
    const s = m.survivor, sp = s.sprite;
    const alpha = s.state === "leaving" && s.t > 3.4 ? Math.max(0, 1 - (s.t - 3.4) / 0.8) : 1;
    c.globalAlpha = alpha;
    c.fillStyle = "rgba(0,0,0,0.3)"; c.fillRect(Math.round(s.x - 6), Math.round(s.y - 1), 12, 2);
    if (sp && s.anim) {
      // >>> NGƯỜI SỐNG SÓT dùng spritesheet nhân vật (đổi ngoại hình trong characters.js). Muốn ảnh riêng: xem EXTRACT_IMAGES "x:survivor"
      const img = g.assets.images["x:survivor"];
      if (img) { c.drawImage(img, Math.round(s.x - img.width / 2), Math.round(s.y - img.height)); }
      else sp.sheet.draw(c, s.anim.col, s.anim.row, s.x, s.y, s.flip);
      if (s.state === "trapped") {   // giơ 2 tay xin cứu
        const k = Math.floor(m.t * 4) % 2;
        c.fillStyle = "#ffd2a8";
        c.fillRect(Math.round(s.x - 8), Math.round(s.y - 30 - k), 2, 4); c.fillRect(Math.round(s.x + 6), Math.round(s.y - 30 - (1 - k)), 2, 4);
      }
    } else {
      c.fillStyle = "#5fdc8c"; c.fillRect(Math.round(s.x - 4), Math.round(s.y - 20), 8, 20);
    }
    c.globalAlpha = 1;
  }

  /** Kén ổ dịch: khối thịt tím-xanh đập phập phồng, gân phát sáng, chất nhầy */
  drawHive(c, g, m) {
    const img = g.assets.images["x:hive"];
    const h = m.hive, x = Math.round(m.x), y = Math.round(m.y), t = m.t, flash = h && h.flash > 0;
    if (img) { c.drawImage(img, x - img.width / 2, y - img.height); return; }   // >>> ẢNH KÉN CỦA BẠN (EXTRACT_IMAGES "x:hive")
    const pulse = Math.sin(t * 3.2) * 1.5, k = 1 - (m.progress ?? 0) * 0.25;
    c.fillStyle = "rgba(0,0,0,0.35)"; c.beginPath(); c.ellipse(x, y, 22, 7, 0, 0, TAU); c.fill();
    c.fillStyle = withAlpha("#5fdc3a", 0.35); c.beginPath(); c.ellipse(x, y, 26, 8, 0, 0, TAU); c.fill();   // vũng nhầy
    const blob = (bx, by, rx, ry, col) => { c.fillStyle = flash ? "#ffffff" : col; c.beginPath(); c.ellipse(Math.round(bx), Math.round(by), rx, ry, 0, 0, TAU); c.fill(); };
    blob(x, y - 13 - pulse * 0.5, 15 * k + 1, 15 * k + pulse, "#14081c");
    blob(x, y - 13 - pulse * 0.5, 14 * k, 14 * k + pulse, "#5a1c6a");
    blob(x - 4, y - 17 - pulse * 0.5, 9 * k, 8 * k, "#8a2e9a");
    blob(x + 7, y - 6, 7, 6, "#3a1048"); blob(x - 9, y - 5, 6, 5, "#3a1048");
    if (!flash) {
      c.fillStyle = withAlpha("#8aff5a", 0.6 + 0.4 * Math.sin(t * 5));
      for (let i = 0; i < 5; i++) { const a = i * 1.3 + 0.4; c.fillRect(Math.round(x + Math.cos(a) * 8 * k), Math.round(y - 14 + Math.sin(a) * 9 * k), 2, 1); }
      c.fillStyle = "#ffe26b"; c.fillRect(x - 2, y - 16, 2, 2); c.fillRect(x + 3, y - 12, 1, 1);   // trứng / mắt trong kén
      c.fillStyle = "#c8ff8a"; const drip = (t * 0.8) % 1; c.fillRect(x + 9, Math.round(y - 8 + drip * 7), 1, 2);
    }
  }

  /** Trạm phát sóng: chân giàn + ăng-ten + đèn nháy; đang tải thì sóng tròn tỏa ra */
  drawTower(c, g, m) {
    const img = g.assets.images["x:tower"];
    const x = Math.round(m.x), y = Math.round(m.y), t = m.t;
    if (img) { c.drawImage(img, x - img.width / 2, y - img.height); return; }   // >>> ẢNH TRẠM PHÁT SÓNG (EXTRACT_IMAGES "x:tower")
    c.fillStyle = "rgba(0,0,0,0.35)"; c.fillRect(x - 12, y - 1, 24, 3);
    c.fillStyle = "#0e0c14"; c.fillRect(x - 11, y - 12, 22, 12);
    c.fillStyle = "#4a5466"; c.fillRect(x - 10, y - 11, 20, 10);
    c.fillStyle = "#6a7488"; c.fillRect(x - 10, y - 11, 20, 2);
    c.fillStyle = m.started ? (Math.floor(t * 6) % 2 ? "#4ac8ff" : "#1c4aa8") : "#1c2a3a"; c.fillRect(x - 7, y - 8, 9, 5);   // màn hình
    c.fillStyle = "#ffe26b"; c.fillRect(x + 4, y - 8, 2, 2);
    // giàn ăng-ten
    c.fillStyle = "#2a2a34";
    for (let i = 0; i < 40; i++) { const w = Math.max(1, Math.round(5 - i / 10)); c.fillRect(x - Math.floor(w / 2), y - 12 - i, w, 1); if (i % 6 === 0) c.fillRect(x - 4 + Math.floor(i / 10), y - 12 - i, 9 - Math.floor(i / 5), 1); }
    c.fillStyle = "#8a92a6"; c.fillRect(x, y - 52, 1, 40);
    const on = Math.floor(t * 2.5) % 2 === 0 || m.state === "done";
    c.fillStyle = on ? (m.state === "done" ? "#5fdc8c" : "#ff3b3b") : "#5a1414"; c.fillRect(x - 1, y - 55, 3, 3);
    if (m.started && m.state === "active") {
      for (let i = 0; i < 2; i++) {
        const u = (t * 0.9 + i * 0.5) % 1;
        c.strokeStyle = withAlpha("#4ac8ff", 1 - u); c.lineWidth = 1;
        c.beginPath(); c.arc(x + 0.5, y - 53, 4 + u * 20, -Math.PI * 0.85, -Math.PI * 0.15); c.stroke();
      }
    }
  }

  /** Cột cờ cứ điểm: cờ đỏ (chưa chiếm) -> cờ xanh (đã chiếm), cờ kéo dần lên theo tiến độ */
  drawFlag(c, g, m) {
    const x = Math.round(m.x), y = Math.round(m.y), t = m.t;
    c.fillStyle = "#14101a"; c.fillRect(x - 1, y - 46, 3, 46);
    c.fillStyle = "#a8acb8"; c.fillRect(x, y - 46, 1, 46);
    c.fillStyle = "#ffe26b"; c.fillRect(x - 1, y - 48, 3, 2);
    const fy = Math.round(y - 12 - 32 * m.progress), wave = Math.floor(t * 6) % 2;
    const col = m.state === "done" ? "#5fdc8c" : m.progress > 0 ? "#ffb030" : "#c83a3a";
    c.fillStyle = "#14101a"; c.fillRect(x + 2, fy - 1, 14, 10);
    c.fillStyle = col; c.fillRect(x + 2, fy, 13, 8);
    c.fillStyle = withAlpha("#ffffff", 0.3); c.fillRect(x + 2, fy, 13, 1);
    c.fillStyle = withAlpha("#000000", 0.25); c.fillRect(x + 8 + wave, fy, 2, 8);
  }

  /** Chấm nhiệm vụ trên minimap (x0, y0: góc minimap · sx, sy: tỉ lệ) */
  drawMinimap(c, x0, y0, sx, sy, time) {
    for (const m of this.list) {
      if (m.state === "done") continue;
      const x = Math.round(x0 + m.x * sx), y = Math.round(y0 + m.y * sy), blink = Math.sin(time * 6) > -0.2;
      c.fillStyle = "#000"; c.fillRect(x - 3, y - 3, 6, 6);
      c.fillStyle = blink ? m.color : withAlpha(m.color, 0.5); c.fillRect(x - 2, y - 2, 4, 4);
    }
  }
}

// ---------- helpers vẽ ----------
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; }
function dashedEllipse(c, x, y, rx, ry, col, t) {
  c.fillStyle = col;
  const n = Math.max(12, Math.round(rx / 3));
  for (let i = 0; i < n; i += 2) {
    const a = (i / n) * TAU + t * 0.6;
    c.fillRect(Math.round(x + Math.cos(a) * rx), Math.round(y + Math.sin(a) * ry), 2, 1);
  }
}
function drawFlagBase(c, x, y) {
  c.fillStyle = "#3a3440"; c.fillRect(x - 6, y - 2, 13, 3);
  c.fillStyle = "#5a5468"; c.fillRect(x - 6, y - 2, 13, 1);
}
function outlined(c, s, x, y, col) { c.fillStyle = "#000"; c.fillText(s, x + 1, y + 1); c.fillStyle = col; c.fillText(s, x, y); }
function speech(c, x, y, s, col) {
  const w = Math.ceil(c.measureText(s).width) + 6, X = Math.round(x - w / 2), Y = Math.round(y);
  c.fillStyle = "#0b0912"; c.fillRect(X - 1, Y - 1, w + 2, 11);
  c.fillStyle = "#f2ecf6"; c.fillRect(X, Y, w, 9);
  c.fillRect(Math.round(x) - 1, Y + 9, 3, 1); c.fillRect(Math.round(x), Y + 10, 1, 1);
  c.fillStyle = col; c.fillText(s, Math.round(x), Y + 1);
}
export { clamp };

// =====================================================================================
//  BẦY ĐÀN ZOMBIE — chế độ "Nhảy Dù – Nhiệm Vụ – Rút Quân"
//
//  Zombie sinh sẵn rồi TUẦN TRA THEO ĐÀN 5–6 con (1 đầu đàn + 4–5 con đi theo đội hình).
//  Trạng thái đàn:
//    "patrol" — đầu đàn chọn điểm tuần tra trong khu, đi tới, nghỉ, chọn tiếp; thành viên bám vị trí đội hình
//    "guard"  — đứng loanh quanh (guardX, guardY, guardR): dùng cho đàn vây người sống sót / cứ điểm
//    "howl"   — vừa phát hiện người chơi / nghe tiếng súng: đứng hú ~0.7s, hiện dấu "!" trên đầu
//    "hunt"   — cả đàn lao vào bao vây (AI gốc của Enemy: đuổi + vòng sườn)
//  Hiệu năng (~25 đàn, ~150 zombie): chỉ quét phát hiện mỗi 0.25s (rải đều), thành viên đàn đang đi tuần ở xa
//  camera dùng cheapUpdate (dịch thẳng, không va chạm / hoạt ảnh), mảng tái sử dụng, không tạo rác mỗi frame.
//
//  >>> main.js cần gọi (xem báo cáo / CONTRACT.md):
//      horde.update(dt)                      mỗi frame, TRƯỚC vòng `for (const e of enemies) e.update(...)`
//      horde.shouldUpdate(e) / cheapUpdate   trong vòng quái: if (horde && !horde.shouldUpdate(e)) { horde.cheapUpdate(e, dt); continue; }
//      horde.onEnemyKilled(e)                đầu killEnemy · horde.onEnemyHurt(e) trong damageEnemy
//      horde.noise(x, y, r)                  qua game.makeNoise · horde.drawOverlay(ctx) khi vẽ lớp phủ (ctx theo camera)
// =====================================================================================
import { Enemy } from "./enemies.js";
import { WORLD } from "./world.js";
import { rand, TAU } from "./util.js";

/** >>> THAM SỐ CHỈNH ĐƯỢC <<< (đơn vị: pixel / giây) */
export const HORDE = {
  squadSize: [5, 6],            // số zombie mỗi đàn (gồm đầu đàn)
  sightRange: 170,              // tầm nhìn: thành viên thấy người chơi (có đường ngắm) trong bán kính này thì cả đàn hú
  hearScale: 1,                 // nhân với bán kính tiếng ồn (súng / nổ) khi tính đàn có nghe thấy không
  howlTime: 0.7,                // thời gian đứng hú (hiện dấu "!") trước khi lao tới
  alertShow: 1.2,               // dấu "!" tồn tại bao lâu (giây) kể từ lúc bị đánh
  chaseLoseRange: 760,          // người chơi xa hơn mức này liên tục `loseTime` giây -> đàn bỏ cuộc, về đi tuần
  loseTime: 6,
  patrolPause: [1.5, 4],        // nghỉ giữa 2 điểm tuần tra
  patrolLeg: [100, 480],        // độ dài mỗi chặng tuần tra (px)
  scanEvery: 0.25,              // chu kỳ quét phát hiện (mỗi đàn, được rải đều)
  cullRange: 640,               // cách tâm camera xa hơn mức này = "xa" -> cheapUpdate
  formRadius: [20, 42],         // bán kính đội hình quanh đầu đàn
  contagionRange: 220,          // đàn khác ở gần đàn vừa hú có thể bị lôi kéo
  contagionChance: 0.3,
  huntDist: [380, 560],         // spawnHuntSquad: sinh ngoài khung hình cách điểm gần này
  // Thành phần đàn theo khu: trọng số từng loại cho thành viên đi theo (đầu đàn luôn là Zombie Thường); mỗi đàn tối đa 1 bloater
  comps: {
    town:     { zWalker: 5, zRunner: 2 },
    military: { zWalker: 3, zRunner: 4 },
    grave:    { zWalker: 5, zBloater: 1.6 },
    lab:      { zWalker: 3, zBloater: 1.6, zRunner: 2 },
  },
};

let nextSquadId = 1;

/** 1 đàn zombie */
class Squad {
  constructor(tag, zone) {
    this.id = nextSquadId++;
    this.members = [];
    this.leader = null;
    this.state = "patrol";
    this.tag = tag ?? null;
    this.zone = zone ?? "town";
    this.scanT = Math.random() * HORDE.scanEvery;   // rải đều các lần quét giữa các đàn
    this.stateT = 0;                                // đếm ngược trong trạng thái (hú)
    this.pauseT = 0;                                // nghỉ giữa các chặng
    this.moveT = 0;                                 // đã đi chặng hiện tại bao lâu (chống kẹt)
    this.loseT = 0;                                 // thời gian người chơi đã thoát khỏi tầm
    this.goalX = 0; this.goalY = 0;                 // điểm tuần tra hiện tại của đầu đàn
    this.guardX = 0; this.guardY = 0; this.guardR = 60; this.guardT = 0;
  }
  /** số zombie còn sống */
  get alive() { return this.members.length; }
}

export class HordeManager {
  constructor(game) {
    this.game = game;
    this.squads = [];
    this.camCx = 0; this.camCy = 0;
    this.reset();
  }

  reset() { this.squads.length = 0; nextSquadId = 1; }

  // ------------------------------------------------------------------ SINH ĐÀN
  /** Chọn loại cho thành viên đi theo theo trọng số khu (tối đa 1 bloater / đàn) */
  pickType(zone, hasBloater) {
    const comp = HORDE.comps[zone] ?? HORDE.comps.town;
    let total = 0;
    for (const k in comp) if (!(hasBloater && k === "zBloater")) total += comp[k];
    let r = Math.random() * total;
    for (const k in comp) {
      if (hasBloater && k === "zBloater") continue;
      if ((r -= comp[k]) <= 0) return k;
    }
    return "zWalker";
  }

  /** Điểm trống gần (x, y) cho thành viên (không có world.isFree thì dùng luôn điểm đó) */
  freeNear(x, y, minD, maxD, r) {
    const w = this.game.world;
    for (let i = 0; i < 8; i++) {
      const a = Math.random() * TAU, d = rand(minD, maxD), px = x + Math.cos(a) * d, py = y + Math.sin(a) * d;
      if (px < WORLD.wall + r || px > WORLD.w - WORLD.wall - r || py < WORLD.wallTop + r + 8 || py > WORLD.h - WORLD.wall - r) continue;
      if (!w.isFree || w.isFree(px, py, r)) return { x: px, y: py };
    }
    return null;
  }

  /**
   * Sinh 1 đàn quanh (x, y).
   * opts: { types?: [loại...] (đầu đàn = phần tử đầu), size?, state: "patrol"|"guard"|"hunt", zone?, guardX?, guardY?, guardR?, tag? }
   */
  spawnSquad(x, y, opts = {}) {
    const g = this.game, w = g.world;
    const zone = opts.zone ?? w.zoneAt?.(x, y)?.id ?? "town";
    const squad = new Squad(opts.tag, zone);
    const state = opts.state ?? "patrol";
    const size = opts.size ?? (opts.types ? opts.types.length : (Math.random() < 0.5 ? HORDE.squadSize[0] : HORDE.squadSize[1]));
    let bloaters = 0;
    for (let i = 0; i < size; i++) {
      const type = opts.types?.[i] ?? (i === 0 ? "zWalker" : this.pickType(zone, bloaters > 0));
      if (type === "zBloater") bloaters++;
      let px = x, py = y;
      if (i === 0) {
        if (w.isFree && !w.isFree(px, py, 10)) { const pt = this.freeNear(x, y, 6, 50, 10); if (pt) { px = pt.x; py = pt.y; } }
      } else {
        const pt = this.freeNear(x, y, HORDE.formRadius[0] * 0.6, HORDE.formRadius[1], 9);
        if (pt) { px = pt.x; py = pt.y; }
      }
      const e = Enemy.obtain(type, px, py, g.enemyOpts({}), g.actorSprites);
      e.spawnTime = state === "hunt" ? 0.4 : 0.1;
      e.squad = squad; e.leader = i === 0;
      // vị trí đội hình riêng: vòng quanh đầu đàn
      const a = (i / Math.max(1, size - 1)) * TAU + rand(-0.4, 0.4), rr = rand(HORDE.formRadius[0], HORDE.formRadius[1]);
      e.fox = Math.cos(a) * rr; e.foy = Math.sin(a) * rr * 0.8;
      squad.members.push(e);
      g.enemies.push(e);
    }
    squad.leader = squad.members[0];
    squad.goalX = squad.leader.x; squad.goalY = squad.leader.y;
    this.squads.push(squad);
    if (state === "guard") {
      squad.guardX = opts.guardX ?? x; squad.guardY = opts.guardY ?? y; squad.guardR = opts.guardR ?? 60;
      this.setState(squad, "guard");
    } else this.setState(squad, state);
    return squad;
  }

  /** Sinh 1 đàn NGOÀI khung hình, cách (nearX, nearY) 380–560px, rồi lao vào người chơi. opts: { types, size, tag } */
  spawnHuntSquad(nearX, nearY, opts = {}) {
    const w = this.game.world, cam = this.game.camera;
    const near = { x: nearX, y: nearY }, [d0, d1] = HORDE.huntDist;
    let pt = w.randomFreePoint({ near, minD: d0, maxD: d1, margin: 14, outsideView: cam });
    pt ??= w.randomFreePoint({ near, minD: d0, maxD: d1 + 120, margin: 14 });
    if (!pt) return null;
    return this.spawnSquad(pt.x, pt.y, { ...opts, state: "hunt" });
  }

  // ------------------------------------------------------------------ TRẠNG THÁI
  setState(sq, st) {
    sq.state = st;
    const m = sq.members;
    if (st === "hunt") {
      for (let i = 0; i < m.length; i++) m[i].passive = false;
    } else if (st === "howl") {
      sq.stateT = HORDE.howlTime;
      for (let i = 0; i < m.length; i++) { const e = m[i]; e.passive = true; e.goalX = e.x; e.goalY = e.y; e.alertT = HORDE.howlTime + 0.35; }
    } else if (st === "guard") {
      sq.guardT = 0;
      for (let i = 0; i < m.length; i++) m[i].passive = true;
    } else {   // patrol
      sq.loseT = 0; sq.pauseT = rand(0.2, 1.2);
      for (let i = 0; i < m.length; i++) { m[i].passive = true; m[i].alertT = 0; }
      sq.goalX = sq.leader?.x ?? 0; sq.goalY = sq.leader?.y ?? 0; sq.moveT = 0;
    }
  }

  /** Cả đàn hú lên ("!" + âm thanh 1 lần) rồi lao tới. depth > 0: đàn bị lôi kéo (không lan tiếp) */
  alertSquad(sq, depth = 0) {
    if (sq.state === "howl" || sq.state === "hunt" || !sq.members.length) return;
    this.setState(sq, "howl");
    const g = this.game, p = g.player, l = sq.leader;
    const d = Math.hypot(l.x - p.x, l.y - p.y);
    if (d < 700) g.sound.play("zombieHowl", 0.55 * (1 - d / 760));
    if (depth > 0) return;
    // lôi kéo đàn khác ở gần (tỉ lệ thấp)
    const R2 = HORDE.contagionRange * HORDE.contagionRange;
    for (let i = 0; i < this.squads.length; i++) {
      const o = this.squads[i];
      if (o === sq || (o.state !== "patrol" && o.state !== "guard") || !o.leader) continue;
      const dx = o.leader.x - l.x, dy = o.leader.y - l.y;
      if (dx * dx + dy * dy <= R2 && Math.random() < HORDE.contagionChance) this.alertSquad(o, 1);
    }
  }

  /** Tiếng súng / nổ: đàn có thành viên trong bán kính thì hú rồi hunt (cả đàn đang guard) */
  noise(x, y, radius) {
    const R = radius * HORDE.hearScale, R2 = R * R, S = this.squads;
    for (let i = 0; i < S.length; i++) {
      const sq = S[i];
      if (sq.state !== "patrol" && sq.state !== "guard") continue;
      const m = sq.members;
      for (let j = 0; j < m.length; j++) {
        const dx = m[j].x - x, dy = m[j].y - y;
        if (dx * dx + dy * dy <= R2) { this.alertSquad(sq); break; }
      }
    }
  }

  /** Quái bị đánh: đàn chưa hunt thì hunt luôn (kèm dấu "!") */
  onEnemyHurt(e) {
    const sq = e.squad;
    if (!sq || sq.state === "hunt") return;
    this.setState(sq, "hunt");
    for (let i = 0; i < sq.members.length; i++) sq.members[i].alertT = HORDE.alertShow;
  }

  /** Quái chết: bỏ khỏi đàn; đầu đàn chết thì con khác lên thay */
  onEnemyKilled(e) {
    const sq = e.squad;
    if (!sq) return;
    const i = sq.members.indexOf(e);
    if (i >= 0) sq.members.splice(i, 1);
    e.squad = null; e.leader = false; e.alertT = 0;
    if (!sq.members.length) { this.removeSquad(sq); return; }
    if (sq.leader === e) {
      // con gần chỗ đầu đàn cũ nhất lên thay
      let best = sq.members[0], bd = Infinity;
      for (let k = 0; k < sq.members.length; k++) { const m = sq.members[k], d = (m.x - e.x) ** 2 + (m.y - e.y) ** 2; if (d < bd) { bd = d; best = m; } }
      sq.leader = best; best.leader = true;
      sq.moveT = 0;
    }
  }

  removeSquad(sq) { const i = this.squads.indexOf(sq); if (i >= 0) { this.squads[i] = this.squads[this.squads.length - 1]; this.squads.pop(); } }

  // ------------------------------------------------------------------ CẬP NHẬT
  /** Gọi mỗi frame TRƯỚC khi cập nhật quái */
  update(dt) {
    const g = this.game, p = g.player, cam = g.camera;
    this.camCx = cam.x + cam.w / 2; this.camCy = cam.y + cam.h / 2;
    const S = this.squads;
    for (let i = S.length - 1; i >= 0; i--) {
      const sq = S[i];
      const m = sq.members;
      for (let j = 0; j < m.length; j++) if (m[j].alertT > 0) m[j].alertT -= dt;
      switch (sq.state) {
        case "patrol": this.updatePatrol(sq, dt); break;
        case "guard": this.updateGuard(sq, dt); break;
        case "howl":
          sq.stateT -= dt;
          if (sq.stateT <= 0) this.setState(sq, "hunt");
          break;
      }
      // quét: phát hiện (patrol/guard) hoặc bỏ cuộc (hunt) — mỗi scanEvery giây
      sq.scanT -= dt;
      if (sq.scanT <= 0) {
        sq.scanT += HORDE.scanEvery;
        this.prune(sq);
        if (!sq.members.length) { this.removeSquad(sq); continue; }
        if (sq.state === "patrol" || sq.state === "guard") this.scanSight(sq, p);
        else if (sq.state === "hunt") this.scanLose(sq, p);
      }
    }
  }

  /** Loại thành viên đã chết / bị tái sử dụng trong pool mà chưa báo onEnemyKilled */
  prune(sq) {
    const m = sq.members;
    for (let j = m.length - 1; j >= 0; j--) if (m[j].dead || m[j].squad !== sq) m.splice(j, 1);
    if (m.length && (!sq.leader || sq.leader.dead || sq.leader.squad !== sq)) { sq.leader = m[0]; m[0].leader = true; sq.moveT = 0; }
  }

  scanSight(sq, p) {
    const m = sq.members, S2 = HORDE.sightRange * HORDE.sightRange, w = this.game.world;
    const l = sq.leader, far = HORDE.sightRange + 260;
    if ((l.x - p.x) ** 2 + (l.y - p.y) ** 2 > far * far) return;   // cả đàn còn quá xa
    for (let j = 0; j < m.length; j++) {
      const e = m[j];
      if (e.spawnTime > 0) continue;
      const dx = p.cx - e.cx, dy = p.cy - e.cy;
      if (dx * dx + dy * dy > S2) continue;
      if (!w.lineOfSight || w.lineOfSight(e.cx, e.cy, p.cx, p.cy)) { this.alertSquad(sq); return; }
    }
  }

  scanLose(sq, p) {
    const m = sq.members, R2 = HORDE.chaseLoseRange * HORDE.chaseLoseRange;
    let near = false;
    for (let j = 0; j < m.length; j++) { const dx = m[j].x - p.x, dy = m[j].y - p.y; if (dx * dx + dy * dy <= R2) { near = true; break; } }
    if (near) sq.loseT = 0;
    else if ((sq.loseT += HORDE.scanEvery) >= HORDE.loseTime) this.setState(sq, "patrol");
  }

  /** Chọn điểm tuần tra mới cho đầu đàn */
  pickPatrolGoal(sq) {
    const w = this.game.world, l = sq.leader, [lo, hi] = HORDE.patrolLeg;
    let pt = null;
    if (w.randomPointInZone) {
      for (let t = 0; t < 3 && !pt; t++) {
        const c = w.randomPointInZone(sq.zone);
        if (c) { const d = Math.hypot(c.x - l.x, c.y - l.y); if (d >= lo && d <= hi) pt = c; }
      }
    }
    pt ??= w.randomFreePoint({ near: { x: l.x, y: l.y }, minD: lo, maxD: Math.min(hi, 360), margin: 14 });
    if (pt) { sq.goalX = pt.x; sq.goalY = pt.y; } else { sq.goalX = l.x; sq.goalY = l.y; }
    sq.moveT = 0;
  }

  updatePatrol(sq, dt) {
    const l = sq.leader, m = sq.members;
    if (sq.pauseT > 0) {
      sq.pauseT -= dt;
      l.goalX = l.x; l.goalY = l.y;   // đứng nghỉ
      if (sq.pauseT <= 0) this.pickPatrolGoal(sq);
    } else {
      sq.moveT += dt;
      l.goalX = sq.goalX; l.goalY = sq.goalY;
      const dx = sq.goalX - l.x, dy = sq.goalY - l.y;
      if (dx * dx + dy * dy < 64 || sq.moveT > 25) sq.pauseT = rand(HORDE.patrolPause[0], HORDE.patrolPause[1]);   // tới nơi (hoặc kẹt quá lâu) -> nghỉ
    }
    // thành viên: bám vị trí đội hình quanh đầu đàn
    for (let j = 0; j < m.length; j++) {
      const e = m[j];
      if (e === l) continue;
      e.goalX = l.x + e.fox; e.goalY = l.y + e.foy;
    }
  }

  updateGuard(sq, dt) {
    sq.guardT -= dt;
    if (sq.guardT > 0) return;
    sq.guardT = rand(2.5, 5);
    const m = sq.members;
    for (let j = 0; j < m.length; j++) {
      const e = m[j], a = Math.random() * TAU, r = Math.sqrt(Math.random()) * sq.guardR;
      e.goalX = sq.guardX + Math.cos(a) * r; e.goalY = sq.guardY + Math.sin(a) * r * 0.8;
    }
  }

  // ------------------------------------------------------------------ CULLING
  /** false = zombie đi tuần / canh gác ở xa camera (không phải đầu đàn) -> dùng cheapUpdate */
  shouldUpdate(e) {
    const sq = e.squad;
    if (!sq || e.leader || !e.passive || (sq.state !== "patrol" && sq.state !== "guard")) return true;
    if (e.flash > 0 || e.freezeT > 0 || e.stunT > 0 || e.burnT > 0 || e.air) return true;
    const dx = e.x - this.camCx, dy = e.y - this.camCy, R = HORDE.cullRange;
    return dx * dx + dy * dy <= R * R;
  }

  /** Cập nhật rẻ: dịch thẳng về vị trí đội hình, giữ trong bản đồ, không va chạm / hoạt ảnh */
  cheapUpdate(e, dt) {
    e.spawnTime -= dt;
    e.kx = 0; e.ky = 0; e.moving = false;
    const gx = e.goalX - e.x, gy = e.goalY - e.y, d2 = gx * gx + gy * gy;
    if (d2 < 25) return;
    const d = Math.sqrt(d2), v = (e.cfg.patrolSpeed ?? e.cfg.speed * 0.4) * e.spd * (d > 28 ? 1.8 : 1) * dt;
    const k = Math.min(v, d) / d;
    e.x += gx * k; e.y += gy * k;
    const r = e.radius;
    if (e.x < WORLD.wall + r) e.x = WORLD.wall + r; else if (e.x > WORLD.w - WORLD.wall - r) e.x = WORLD.w - WORLD.wall - r;
    if (e.y < WORLD.wallTop + r) e.y = WORLD.wallTop + r; else if (e.y > WORLD.h - WORLD.wall) e.y = WORLD.h - WORLD.wall;
  }

  // ------------------------------------------------------------------ TRUY VẤN
  /** Số zombie còn sống của các đàn có tag */
  aliveIn(tag) {
    let n = 0;
    for (let i = 0; i < this.squads.length; i++) if (this.squads[i].tag === tag) n += this.squads[i].members.length;
    return n;
  }
  squadAlive(squad) { return squad ? squad.members.length : 0; }

  // ------------------------------------------------------------------ VẼ
  /** Dấu "!" pixel vàng-đỏ nảy trên đầu zombie đang báo động (ctx đã dịch theo camera) */
  drawOverlay(ctx) {
    const g = this.game, cam = g.camera, t = g.time;
    for (let i = 0; i < this.squads.length; i++) {
      const m = this.squads[i].members;
      for (let j = 0; j < m.length; j++) {
        const e = m[j];
        if (e.alertT <= 0 || !cam.inView(e.x, e.y, 24)) continue;
        const sc = e.cfg.scale ?? 1;
        const bounce = Math.abs(Math.sin(t * 14 + e.serial)) * 3;
        const x = Math.round(e.x - 1), y = Math.round(e.y - 40 * sc - bounce);
        ctx.fillStyle = "#1a0a10"; ctx.fillRect(x - 2, y - 1, 6, 11);        // viền
        ctx.fillStyle = "#ff3030"; ctx.fillRect(x - 1, y, 4, 6);             // thân dấu chấm than
        ctx.fillStyle = "#ffe14a"; ctx.fillRect(x, y, 2, 5);
        ctx.fillStyle = "#ff3030"; ctx.fillRect(x - 1, y + 7, 4, 2);          // chấm
        ctx.fillStyle = "#ffe14a"; ctx.fillRect(x, y + 7, 2, 2);
      }
    }
  }
}

// =====================================================================================
//  QUÁI VẬT CHIẾN THUẬT + BOSS
//
//  ai: "chase"     — lao thẳng theo người chơi (Slime, Slime khổng lồ, Ma, Rắn)
//      "ranged"    — Cung Thủ Xương: giữ khoảng cách 280px, ngắm 0.8s (laser đỏ) rồi bắn tên
//      "tank"      — Hiệp Sĩ Khiên: chậm, khiên giảm 75% sát thương từ chính diện
//      "kamikaze"  — Dơi Cảm Tử: cực nhanh, áp sát thì nhấp nháy đỏ và nổ sau 0.6s
//      "caster"    — Mắt Quỷ: lơ lửng giữ khoảng cách, gồng rồi bắn 3 cầu tỏa quạt
//      "diver"     — Đầu Lâu Lửa: tới gần thì gồng 0.55s rồi lao thẳng như tên bắn
//      "hopper"    — Ếch Độc: nhảy cóc từng quãng, phun axit làm chậm; chết để lại vũng axit
//      "summoner"  — Pháp Sư Xương: đứng xa niệm chú gọi Dơi, bị áp sát thì dịch chuyển đi chỗ khác
//      "bloater"   — Zombie Phun Độc: bò chậm tới tầm ~150px rồi cứ ~3s phun 1 cục axit làm chậm; chết nổ axit
//      "bossZombie"— Zombie Đột Biến Khổng Lồ (chế độ Rút Quân): húc, nhảy đập đất, gầm gọi zombie
//      "boss*"     — 4 BOSS luân phiên mỗi đợt (xem BOSS_ROTATION)
//
//  ZOMBIE BẦY ĐÀN (cờ `zombie: true`): sinh theo đàn do hordeAI.js điều khiển. Khi `passive = true` quái KHÔNG đuổi
//  người chơi mà đi tới (goalX, goalY) với `patrolSpeed` (tuần tra / giữ đội hình); `passive = false` -> AI gốc (đuổi + bao vây).
//
//  Mọi chỉ số nằm trong ENEMY_TYPES. Độ khó tăng theo ĐỢT do main.js truyền vào (hpMul, speedMul, dmgBonus).
//
//  QUÁI TINH ANH (bản 4.0): to hơn 30%, x3 máu, viền phát sáng theo màu "tố chất" (ELITE_AFFIXES) và có kỹ năng riêng.
//  Hạ được thì rơi nhiều Vàng + Ngọc Năng Lượng + Rương Bạc.
// =====================================================================================
import { EnemyBullet } from "./weapons.js";
import { Pool } from "./pool.js";
import { angleDiff, rand, withAlpha, TAU, pointSegDist2 } from "./util.js";
import { springStep, drawRise, drawShadow } from "./juice.js";

/**
 * >>> TỐ CHẤT QUÁI TINH ANH <<<
 *   swift    — Cuồng Phong: nhanh hơn 35%, cứ vài giây lại lướt vọt tới
 *   burst    — Bão Đạn: gồng 0.6s rồi bắn 1 vòng 10 cầu năng lượng tỏa tròn
 *   regen    — Bất Tử: tự hồi 3% máu tối đa mỗi giây
 *   volatile — Bạo Liệt: chết thì nổ tung bắn 8 cầu lửa ra xung quanh (né đi!)
 */
export const ELITE_AFFIXES = {
  swift:    { name: "Cuồng Phong", color: "#ff3b3b" },
  burst:    { name: "Bão Đạn",     color: "#c84aff" },
  regen:    { name: "Bất Tử",      color: "#5fdc5f" },
  volatile: { name: "Bạo Liệt",    color: "#ff8a2a" },
};
const AFFIX_KEYS = Object.keys(ELITE_AFFIXES);
export const ELITE_SCALE = 1.3;

/**
 * Chỉ số từng loại quái — chỉnh độ khó ở đây.
 * sprite: tên spritesheet trong fx-config.js -> ACTORS · scale: phóng to khi vẽ · bodyY: tâm thân so với chân
 */
export const ENEMY_TYPES = {
  slime:    { name: "Slime Xanh",       sprite: "slime",  ai: "chase",    hp: 1.2, speed: 38,  radius: 11, bodyY: -12, damage: 1, score: 10,  exp: 1, image: "enemySlime" },
  bigSlime: { name: "Slime Khổng Lồ",   sprite: "slime",  ai: "chase",    hp: 4,  speed: 27,  radius: 17, bodyY: -19, damage: 2, score: 30,  exp: 3, image: "enemySlime", scale: 1.6, split: "slime" },
  bat:      { name: "Dơi Cảm Tử",       sprite: "bat",    ai: "kamikaze", hp: 1,  speed: 122, radius: 8,  bodyY: -8,  damage: 1, score: 15,  exp: 1, image: "enemyBat", flying: true, fuse: 0.6, armRange: 26, blast: 40, noContact: true },
  ghost:    { name: "Hồn Ma",           sprite: "ghost",  ai: "chase",    hp: 2.5, speed: 28,  radius: 11, bodyY: -18, damage: 2, score: 25,  exp: 2, image: "enemyGhost", flying: true },
  archer:   { name: "Cung Thủ Xương",   sprite: "archer", ai: "ranged",   hp: 2,  speed: 54,  radius: 8,  bodyY: -17, damage: 1, score: 20,  exp: 2, image: "enemyArcher", keep: 280, sight: 330, aimTime: 0.8, reload: 1.4, arrowSpeed: 340 },
  knight:   { name: "Hiệp Sĩ Khiên",    sprite: "knight", ai: "tank",     hp: 6,  speed: 24,  radius: 10, bodyY: -17, damage: 2, score: 35,  exp: 3, image: "enemyKnight", shieldArc: 1.05, shieldReduce: 0.75, turnRate: 1.8 },
  // ---------------- QUÁI MỚI (bản 3.0) ----------------
  eyeball:  { name: "Mắt Quỷ",          sprite: "eyeball", ai: "caster",  hp: 2.5, speed: 32,  radius: 9,  bodyY: -16, damage: 1, score: 25,  exp: 2, flying: true, keep: 190, sight: 300, castEvery: 2.4, castTime: 0.5, shots: 3, spread: 0.3, shotSpeed: 125 },
  skull:    { name: "Đầu Lâu Lửa",      sprite: "skull",  ai: "diver",    hp: 2,  speed: 60,  radius: 9,  bodyY: -17, damage: 2, score: 25,  exp: 2, flying: true, scale: 0.9, diveRange: 150, windup: 0.55, diveSpeed: 330, diveTime: 0.55 },
  frog:     { name: "Ếch Độc",          sprite: "frog",   ai: "hopper",   hp: 3,  speed: 0,   radius: 9,  bodyY: -7,  damage: 1, score: 20,  exp: 2, hopEvery: 1.0, hopTime: 0.38, hopDist: 72, spitRange: 190, spitEvery: 3.2, acidOnDeath: true },
  snake:    { name: "Rắn Độc",          sprite: "snake",  ai: "chase",    hp: 1.6, speed: 64,  radius: 8,  bodyY: -5,  damage: 1, score: 15,  exp: 1 },
  shaman:   { name: "Pháp Sư Xương",    sprite: "shaman", ai: "summoner", hp: 4,  speed: 36,  radius: 9,  bodyY: -17, damage: 1, score: 40,  exp: 4, keep: 230, summonEvery: 6.5, chantTime: 0.9, summon: "bat", count: 2, blinkCd: 4 },
  // ---------------- ZOMBIE BẦY ĐÀN (chế độ Nhảy Dù – Rút Quân) ----------------
  // patrolSpeed: tốc độ lê bước khi tuần tra · deathBlast/acidOnDeath: main.js xử lý khi chết
  zWalker:  { name: "Zombie Thường",    sprite: "zWalker",  ai: "chase",   zombie: true, hp: 2.2, speed: 34, patrolSpeed: 14, radius: 9,  bodyY: -17, damage: 1, score: 12, exp: 1 },
  zRunner:  { name: "Zombie Chạy Nhanh", sprite: "zRunner",  ai: "chase",   zombie: true, hp: 1.4, speed: 84, patrolSpeed: 20, radius: 8,  bodyY: -17, damage: 1, score: 16, exp: 1 },
  zBloater: { name: "Zombie Phun Độc",  sprite: "zBloater", ai: "bloater", zombie: true, hp: 5,   speed: 24, patrolSpeed: 10, radius: 11, bodyY: -21, damage: 1, score: 30, exp: 3, scale: 1.3,
              spitRange: 150, spitEvery: 3, castTime: 0.5, acidOnDeath: true, deathBlast: { radius: 48, damage: 3, playerDamage: 1 } },
  // ---------------- BOSS ----------------
  zBoss:     { name: "Zombie Đột Biến Khổng Lồ", sprite: "zBoss", ai: "bossZombie", zombie: true, boss: true, hp: 150, speed: 30, patrolSpeed: 16, radius: 24, bodyY: -38, damage: 2, score: 400, exp: 30, scale: 2.4, aura: "#4aff8a", slamR: 80 },
  boss:      { name: "Hồn Ma Tím",        sprite: "boss",      ai: "boss",      boss: true, hp: 80, speed: 40, radius: 24, bodyY: -40, damage: 2, score: 300, exp: 25, image: "enemyBoss", flying: true, scale: 2.2, aura: "#7a3cc8" },
  slimeKing: { name: "Vua Slime",         sprite: "slimeKing", ai: "bossSlime", boss: true, hp: 95, speed: 30, radius: 26, bodyY: -30, damage: 2, score: 350, exp: 28, scale: 2.5, aura: "#c8343f" },
  skullLord: { name: "Chúa Tể Đầu Lâu",   sprite: "skullLord", ai: "bossSkull", boss: true, hp: 90, speed: 46, radius: 22, bodyY: -38, damage: 2, score: 380, exp: 30, flying: true, scale: 2.0, aura: "#ff6a1e" },
  eyeLord:   { name: "Mắt Quỷ Vương",     sprite: "eyeLord",   ai: "bossEye",   boss: true, hp: 105, speed: 34, radius: 24, bodyY: -36, damage: 2, score: 420, exp: 32, flying: true, scale: 2.3, aura: "#3fae3a" },
};

/** Thứ tự Boss cuối mỗi đợt (lặp lại, mỗi vòng máu tăng thêm) */
export const BOSS_ROTATION = ["boss", "slimeKing", "skullLord", "eyeLord"];

/** Bán kính va chạm lớn nhất (Boss / tinh anh) — dùng cho lưới không gian */
export const MAX_ENEMY_RADIUS = 28;

/**
 * Tản đội hình (Soft Separation) + bao vây:
 *   gap        — khoảng hở mong muốn giữa 2 quái (pixel)
 *   stiffness  — độ "cứng" của lực đẩy (càng lớn tách càng nhanh; nhỏ = mềm, đỡ rung)
 *   flank      — độ lệch hướng tiếp cận tối đa (radian): mỗi quái vòng sang 1 bên để vây quanh người chơi
 *   flankFrom  — khoảng cách (px) bắt đầu đi vòng; gần hơn thì lao thẳng vào
 */
export const CROWD = { gap: 3, stiffness: 18, flank: 0.85, flankFrom: 70, flankFull: 260 };

/** Thời gian miễn nhiễm đóng băng sau khi tan băng (tránh khóa cứng quái mãi mãi) */
const FREEZE_IMMUNE = { normal: 1.2, boss: 4 };

export class Enemy {
  /** Lấy 1 con quái từ Object Pool (không `new` mỗi lần sinh quái). sprites = Map tên -> ActorSprite */
  static obtain(typeName, x, y, opts, sprites) { return Enemy.pool.obtain().init(typeName, x, y, opts, sprites); }

  /**
   * Đặt lại TOÀN BỘ trạng thái (đối tượng có thể là con quái cũ đã chết được dùng lại).
   * opts: { elite, hpMul, speedMul, dmgBonus, minion }
   */
  init(typeName, x, y, opts = {}, sprites = null) {
    const t = ENEMY_TYPES[typeName];
    this.type = typeName;
    this.cfg = t;
    this.x = x; this.y = y;            // vị trí CHÂN (tọa độ thế giới)
    this.elite = !!opts.elite && !t.boss;
    this.minion = !!opts.minion;       // quái được triệu hồi: không rơi EXP
    this.boss = !!t.boss;
    // Tinh Anh: tố chất ngẫu nhiên (ELITE_AFFIXES), to hơn ELITE_SCALE lần
    this.affix = this.elite ? (opts.affix ?? AFFIX_KEYS[(Math.random() * AFFIX_KEYS.length) | 0]) : null;
    this.affixCfg = this.affix ? ELITE_AFFIXES[this.affix] : null;
    this.sc = this.elite ? ELITE_SCALE : 1;
    this.eliteT = rand(2.5, 4); this.eliteCast = 0; this.rush = 0;
    this.maxHp = t.hp * (this.elite ? 3 : 1) * (opts.hpMul ?? 1);
    this.hp = this.maxHp;
    this.radius = Math.round(t.radius * this.sc);
    this.spd = (opts.speedMul ?? 1) * (this.affix === "swift" ? 1.35 : 1);     // hệ số tốc độ theo đợt
    this.dmgBonus = opts.dmgBonus ?? 0;
    this.flash = 0;                    // chớp trắng khi trúng đòn (0.08s)
    this.kx = 0; this.ky = 0;          // lực đẩy lùi
    this.spawnTime = 0.35;             // vừa xuất hiện: chưa gây sát thương
    this.air = null;                   // đang bị hất tung (Lướt Xung Kích)
    this.jump = null;                  // Vua Slime / Ếch đang nhảy
    this.z = 0;
    this.dead = false;
    this.facing = 0;                   // hướng nhìn (radian) — dùng cho khiên của Hiệp Sĩ
    this.side = 0; this.sideTime = 0;  // né vật cản khi bị kẹt
    this.state = "move"; this.stateTime = 0;
    this.reload = rand(0.5, 1.2);
    this.reload2 = rand(1, 2.5);
    this.fuse = -1;                    // Dơi Cảm Tử: đếm ngược phát nổ
    this.aimAngle = 0;
    this.tx = 0; this.ty = 0;          // điểm đích (nhảy / lao)
    this.strafe = Math.random() < 0.5 ? 1 : -1;
    this.burnT = 0; this.burnTick = 0;  // đang cháy: 1 sát thương / giây
    this.slowT = 0;                      // đang bị làm chậm
    this.speedMul = 1;
    this.freezeT = 0; this.freezeImm = 0; // ĐÓNG BĂNG + miễn nhiễm sau khi tan
    this.stunT = 0;                      // CHOÁNG (Búa Thánh)
    this.serial = ++Enemy.serial;        // số định danh (quái được tái sử dụng từ pool -> phân biệt con cũ / con mới)
    this.attack = 0; this.volley = 0; this.lands = 0;
    this.sweep = 0;                      // Mắt Quỷ Vương: hướng quét laser
    this.flank = rand(-1, 1) * CROWD.flank;   // hướng vòng vây riêng của con này
    this.moving = false;
    this.gridId = -1;
    // Bầy đàn zombie (hordeAI.js) — phải đặt lại hết vì Object Pool tái dùng đối tượng
    this.squad = null; this.leader = false; this.passive = false;
    this.goalX = x; this.goalY = y; this.alertT = 0;
    this.fox = 0; this.foy = 0;        // vị trí đội hình so với đầu đàn

    // Hoạt ảnh: spritesheet + AnimationController (Idle/Run cho quái hình người, "move" cho Slime/Dơi/Ma)
    this.sprite = sprites?.get(t.sprite) ?? null;
    this.anim = this.sprite ? this.sprite.controller() : null;
    this.anim?.randomize();
    if (this.boss) { this.state = "move"; this.stateTime = 2; }
    return this;
  }

  get cx() { return this.x; }
  get cy() { return this.y + this.cfg.bodyY * this.sc - this.z; }
  get canHurt() { return this.spawnTime <= 0 && !this.air && !this.jump && !this.cfg.noContact && !(this.freezeT > 0) && !(this.stunT > 0); }
  get speed() { return this.cfg.speed * this.spd * this.speedMul * (this.rush > 0 ? 2.3 : 1) * (this.enraged ? 1.35 : 1); }
  /** Zombie Đột Biến dưới 50% máu: nhanh hơn */
  get enraged() { return this.type === "zBoss" && this.hp < this.maxHp * 0.5; }

  /** Đóng băng t giây. Boss tối đa 0.8s. Vừa tan băng thì miễn nhiễm 1 lúc. Trả về true nếu vừa mới bị đóng băng. */
  freeze(t) {
    if (this.freezeImm > 0 && !(this.freezeT > 0)) return false;
    const was = this.freezeT > 0;
    this.freezeT = Math.max(this.freezeT, this.boss ? Math.min(0.8, t) : t);
    if (this.state === "aim") { this.state = "move"; this.reload = Math.max(this.reload, 0.6); }   // cung thủ mất lượt ngắm
    if (this.boss && (this.state === "charge" || this.state === "windup")) { this.state = "move"; this.stateTime = 1; }
    if (this.state === "dive" || this.state === "windup") { this.state = "move"; this.reload = 1.2; }
    return !was;
  }
  /** Choáng t giây (Boss chỉ bị khựng 0.15s) */
  stun(t) {
    if (this.dead) return;
    this.stunT = Math.max(this.stunT, this.boss ? Math.min(0.15, t) : t);
    if (!this.boss && (this.state === "aim" || this.state === "windup" || this.state === "dive" || this.state === "cast" || this.state === "chant")) { this.state = "move"; this.reload = Math.max(this.reload, 0.8); }
  }
  get contactDamage() {
    const extra = (this.boss && this.state === "charge") || this.state === "dive" ? 1 : 0;
    return this.cfg.damage + extra + this.dmgBonus;
  }

  launch(height) { if (!this.boss) this.air = { t: 0, dur: 0.5, h: height }; }

  /** Đi về hướng (dx, dy) đã chuẩn hóa với tốc độ v, tự né khi bị cột đá chặn */
  steer(game, dx, dy, v, dt) {
    if (this.sideTime > 0) {
      this.sideTime -= dt;
      const sx = -dy * this.side, sy = dx * this.side;
      dx = dx * 0.35 + sx; dy = dy * 0.35 + sy;
      const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    }
    const r = Math.max(5, this.radius * 0.6);
    const bx = this.x, by = this.y;
    game.world.moveBody(this, dx * v * dt, dy * v * dt, r, this.cfg.flying);
    const mx = this.x - bx, my = this.y - by, moved2 = mx * mx + my * my, want = v * dt * 0.3;
    this.moving = moved2 > 0.0001;
    if (v > 0 && moved2 < want * want && this.sideTime <= 0) { this.side = Math.random() < 0.5 ? 1 : -1; this.sideTime = 0.7; }
  }

  /** Bắn 1 viên đạn quái */
  shoot(game, a, opts) {
    game.enemyBullets.push(EnemyBullet.obtain(this.cx + Math.cos(a) * (opts.offset ?? 8), this.cy + Math.sin(a) * (opts.offset ?? 8), a, { ...opts, damage: (opts.damage ?? 1) + (opts.noBonus ? 0 : this.dmgBonus) }));
  }

  update(dt, game) {
    const p = game.player;
    this.spawnTime -= dt;
    this.flash -= dt;
    // >>> JUICE: lò xo méo người, bật lùi tắt dần, dáng trúng đòn (đặt trong Game.damageEnemy)
    if (this.sq || this.sqV) springStep(this, dt);
    if (this.rk) { this.rk *= Math.exp(-22 * dt); if (this.rk < 0.2) this.rk = 0; }
    if (this.hurtT > 0) this.hurtT -= dt;
    if (this.hurtCD > 0) this.hurtCD -= dt;
    this.stateTime -= dt;
    this.freezeImm = Math.max(0, this.freezeImm - dt);
    const dx = p.cx - this.cx, dy = p.cy - this.cy;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;   // 1 lần / quái / frame để có hướng đi (không phải vòng lặp va chạm)
    const ux = dx / d, uy = dy / d;
    this.moving = false;
    // hiệu ứng trạng thái
    this.slowT = Math.max(0, this.slowT - dt);
    this.speedMul = this.slowT > 0 ? (this.boss ? 0.75 : 0.5) : 1;
    if (this.burnT > 0) {
      this.burnT -= dt;
      this.burnTick -= dt;
      if (this.burnTick <= 0) { this.burnTick = 0.5; game.damageEnemy(this, 0.5, 0, 0, { quiet: true, pierce: true, noCrit: true }); if (this.dead) return; }
    }

    // --- ĐÓNG BĂNG / CHOÁNG: đứng im (vẫn bị đẩy lùi), hoạt ảnh dừng ---
    if (this.freezeT > 0 || this.stunT > 0) {
      if (this.freezeT > 0) { this.freezeT -= dt; if (this.freezeT <= 0) this.freezeImm = this.boss ? FREEZE_IMMUNE.boss : FREEZE_IMMUNE.normal; }
      else this.stunT -= dt;
      if (Math.abs(this.kx) > 1 || Math.abs(this.ky) > 1) game.world.moveBody(this, this.kx * dt, this.ky * dt, Math.max(5, this.radius * 0.6), this.cfg.flying);
      const damp = Math.pow(0.0005, dt);
      this.kx *= damp; this.ky *= damp;
      if (this.jump) { this.jump = null; this.z = 0; }
      return;
    }

    if (this.air) {
      this.air.t += dt;
      const u = this.air.t / this.air.dur;
      this.z = Math.sin(Math.PI * Math.min(1, u)) * this.air.h;
      if (u >= 1) { this.air = null; this.z = 0; }
    } else if (this.passive) {
      this.updatePatrol(dt, game);   // zombie trong đàn chưa phát hiện người chơi: lê bước theo goal
    } else {
      switch (this.cfg.ai) {
        case "chase": { const [fx, fy] = this.flankDir(ux, uy, d); this.steer(game, fx, fy, this.speed, dt); break; }
        case "tank": {
          // quay khiên chậm về phía người chơi -> người chơi lướt vòng ra sau lưng được
          const want = Math.atan2(dy, dx), diff = angleDiff(want, this.facing), step = this.cfg.turnRate * dt;
          this.facing += Math.max(-step, Math.min(step, diff));
          const [fx, fy] = this.flankDir(ux, uy, d);
          this.steer(game, fx, fy, this.speed, dt);
          break;
        }
        case "kamikaze": this.updateBat(dt, game, d, ux, uy); break;
        case "ranged": this.updateArcher(dt, game, d, ux, uy); break;
        case "caster": this.updateCaster(dt, game, d, ux, uy); break;
        case "diver": this.updateDiver(dt, game, d, ux, uy); break;
        case "hopper": this.updateHopper(dt, game, d, ux, uy); break;
        case "summoner": this.updateSummoner(dt, game, d, ux, uy); break;
        case "boss": this.updateBoss(dt, game, d, ux, uy); break;
        case "bossSlime": this.updateSlimeKing(dt, game, d, ux, uy); break;
        case "bossSkull": this.updateSkullLord(dt, game, d, ux, uy); break;
        case "bossEye": this.updateEyeLord(dt, game, d, ux, uy); break;
        case "bloater": this.updateBloater(dt, game, d, ux, uy); break;
        case "bossZombie": this.updateZombieBoss(dt, game, d, ux, uy); break;
      }
    }
    if (this.elite) this.updateElite(dt, game, d, ux, uy);
    if (this.dead) return;
    if (this.cfg.ai !== "tank" && this.state !== "dive" && this.state !== "laser" && !this.passive) this.facing = Math.atan2(dy, dx);

    // lực đẩy lùi (có va chạm tường)
    if (Math.abs(this.kx) > 1 || Math.abs(this.ky) > 1) game.world.moveBody(this, this.kx * dt, this.ky * dt, Math.max(5, this.radius * 0.6), this.cfg.flying);
    const damp = Math.pow(this.boss ? 0.00001 : 0.0005, dt);
    this.kx *= damp; this.ky *= damp;

    // --- Hoạt ảnh theo deltaTime ---
    if (this.anim && this.hurtT > 0 && this.anim.anims.hurt) { this.anim.set("hurt"); this.anim.update(dt); return; }   // giật người khi trúng đạn
    if (this.anim) {
      if (this.cfg.zombie) {
        // zombie: chạy khi di chuyển, hàng "skill" (gồng người) khi gồng / gầm / nhảy / phun
        const st = this.state;
        this.anim.set(st === "windup" || st === "crouch" || st === "jump" || st === "roar" || st === "cast" ? "skill" : this.moving ? "run" : "idle");
        this.anim.update(dt, this.speedMul < 1 ? 0.6 : this.passive ? 0.7 : st === "move" && this.moving ? Math.min(1.6, 0.5 + this.speed / 60) : 1);
        return;
      }
      if (this.anim.anims.run) this.anim.set(this.moving && this.state !== "aim" && this.state !== "chant" ? "run" : "idle");
      const busy = this.state === "windup" || this.state === "cast" || this.state === "chant" || this.fuse >= 0;
      this.anim.update(dt, this.air ? 2 : busy ? 2.5 : this.speedMul < 1 ? 0.6 : 1);
    }
  }

  // ---------- ZOMBIE TUẦN TRA: đi tới (goalX, goalY), dừng khi tới gần ----------
  updatePatrol(dt, game) {
    const gx = this.goalX - this.x, gy = this.goalY - this.y, d2 = gx * gx + gy * gy;
    if (d2 < 25) { this.moving = false; return; }            // tới nơi (< 5px)
    const d = Math.sqrt(d2), ux = gx / d, uy = gy / d;
    const base = this.cfg.patrolSpeed ?? this.cfg.speed * 0.4;
    // ở xa vị trí đội hình thì rảo bước để bắt kịp đầu đàn
    const v = base * this.spd * this.speedMul * (d > 28 ? Math.min(2.2, 1 + (d - 28) / 60) : 1);
    this.steer(game, ux, uy, v, dt);
    this.facing = Math.atan2(uy, ux);
  }

  // ---------- Zombie Phun Độc: bò tới tầm phun rồi cứ ~3s nhổ 1 cục axit làm chậm ----------
  updateBloater(dt, game, d, ux, uy) {
    const c = this.cfg, p = game.player;
    this.reload -= dt;
    if (this.state === "cast") {
      this.aimAngle = Math.atan2(p.cy - this.cy, p.cx - this.cx);
      if (this.stateTime <= 0) {
        this.shoot(game, this.aimAngle, { speed: 150, damage: 1, radius: 4, style: "acid", life: 1.8, slow: 1.5, offset: 10 });
        game.sound.play("poison", 0.3);
        this.state = "move"; this.reload = c.spitEvery * rand(0.85, 1.15);
      }
      return;
    }
    if (d > c.spitRange * 0.8) { const [fx, fy] = this.flankDir(ux, uy, d); this.steer(game, fx, fy, this.speed, dt); }
    else if (d < 70) this.steer(game, -ux, -uy, this.speed * 0.6, dt);   // quá gần: lùi nhẹ cho dễ phun
    if (this.reload <= 0 && d < c.spitRange && this.spawnTime <= 0 && game.world.lineOfSight(this.cx, this.cy, p.cx, p.cy)) { this.state = "cast"; this.stateTime = c.castTime; }
  }

  // ---------- BOSS ZOMBIE ĐỘT BIẾN: đuổi chậm · gồng HÚC · NHẢY ĐẬP ĐẤT · GẦM gọi 3 zombie ----------
  updateZombieBoss(dt, game, d, ux, uy) {
    const p = game.player, rage = this.enraged;
    switch (this.state) {
      case "move":
        this.steer(game, ux, uy, this.speed, dt);
        if (this.stateTime <= 0) {
          const seq = ["charge", "slam", "roar", "slam", "charge"], next = seq[this.attack++ % seq.length];
          if (next === "charge") { this.state = "windup"; this.stateTime = rage ? 0.55 : 0.8; this.aimAngle = Math.atan2(uy, ux); game.sound.play("bossCharge", 0.6); }
          else if (next === "slam") {
            this.state = "crouch"; this.stateTime = rage ? 0.5 : 0.75;
            const pt = game.world.isFree(p.x, p.y, 14) ? { x: p.x, y: p.y } : game.world.randomFreePoint({ near: p, minD: 0, maxD: 60, margin: 14 });
            this.tx = pt?.x ?? this.x; this.ty = pt?.y ?? this.y;
            game.sound.play("bossCharge", 0.5);
          } else { this.state = "roar"; this.stateTime = 1.0; game.sound.play("zombieHowl", 0.7); game.shake(0.3, 2); }
        }
        break;
      case "windup":   // gồng 0.8s, drawOverlay vẽ vạch cảnh báo đường húc
        this.aimAngle = Math.atan2(uy, ux); this.facing = this.aimAngle;
        if (this.stateTime <= 0) { this.state = "charge"; this.stateTime = 0.65; game.sound.play("skillDash", 0.6); }
        break;
      case "charge": this.updateCharge(dt, game, rage ? 420 : 360); break;
      case "crouch":   // vòng cảnh báo đỏ nơi sắp đập xuống
        if (this.stateTime <= 0) { this.state = "jump"; this.jump = { t: 0, dur: 0.75, sx: this.x, sy: this.y }; }
        break;
      case "jump": {
        const J = this.jump; if (!J) { this.state = "move"; this.stateTime = 1; break; }
        J.t += dt;
        const u = Math.min(1, J.t / J.dur), e = u * u * (3 - 2 * u);
        this.x = J.sx + (this.tx - J.sx) * e; this.y = J.sy + (this.ty - J.sy) * e;
        this.z = Math.sin(Math.PI * u) * 80;
        if (u >= 1) {
          this.jump = null; this.z = 0; this.lands++;
          game.bossSlam(this.x, this.y, this.cfg.slamR, 2 + this.dmgBonus);
          const n = rage ? 14 : 10, off = rand(0, TAU);
          for (let i = 0; i < n; i++) this.shoot(game, off + (i / n) * TAU, { speed: 105, damage: 1, radius: 4, style: "acid", life: 3, slow: 1, offset: 18, noBonus: true });
          this.state = "move"; this.stateTime = rage ? 1.0 : 1.7;
        }
        break;
      }
      case "roar":     // GẦM: gọi 3 zombie thường
        if (this.stateTime <= 0) {
          for (let i = 0; i < 3; i++) game.spawnMinion("zWalker", this.x + rand(-40, 40), this.y + rand(-14, 24));
          game.fx.portal?.(this.x, this.y, 0.7);
          this.state = "move"; this.stateTime = rage ? 1.0 : 1.6;
        }
        break;
    }
  }

  /** Kỹ năng riêng của quái Tinh Anh (theo tố chất) */
  updateElite(dt, game, d) {
    this.rush = Math.max(0, this.rush - dt);
    if (this.affix === "regen") { if (this.hp < this.maxHp) this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.03 * dt); return; }
    if (this.spawnTime > 0) return;
    if (this.eliteCast > 0) {           // đang gồng (Bão Đạn)
      this.eliteCast -= dt;
      if (this.eliteCast <= 0) {
        const n = 10, a0 = Math.random() * TAU;
        for (let i = 0; i < n; i++) this.shoot(game, a0 + (i / n) * TAU, { speed: 120, radius: 3, style: "orb", color: this.affixCfg.color, life: 3, offset: this.radius });
        game.sound.play("eyeShoot", 0.4);
      }
      return;
    }
    this.eliteT -= dt;
    if (this.eliteT > 0 || d > 300) return;
    if (this.affix === "burst") { this.eliteCast = 0.6; this.eliteT = rand(3.8, 5); }
    else if (this.affix === "swift") { this.rush = 0.55; this.eliteT = rand(3.5, 5); game.puff?.(this.x, this.y - 2); }
    else this.eliteT = 99;
  }

  /**
   * Bao vây: khi còn xa, mỗi quái lệch hướng đi 1 góc riêng (this.flank) để tiếp cận từ nhiều phía;
   * càng tới gần càng lao thẳng -> đám đông dàn thành vòng quanh người chơi thay vì dồn 1 cục.
   */
  flankDir(ux, uy, d) {
    const k = Math.min(1, Math.max(0, (d - CROWD.flankFrom) / (CROWD.flankFull - CROWD.flankFrom)));
    if (k <= 0) return [ux, uy];
    const a = this.flank * k, c = Math.cos(a), s = Math.sin(a);
    return [ux * c - uy * s, ux * s + uy * c];
  }

  /** Giữ khoảng cách `keep` với người chơi, đi ngang khi đủ xa */
  keepDistance(game, dt, d, ux, uy, keep) {
    let mx = 0, my = 0;
    if (d > keep + 30) { mx = ux; my = uy; }
    else if (d < keep - 40) { mx = -ux; my = -uy; }
    else { mx = -uy * this.strafe; my = ux * this.strafe; if (Math.random() < dt * 0.4) this.strafe *= -1; }
    this.steer(game, mx, my, this.speed, dt);
  }

  // ---------- Dơi Cảm Tử ----------
  updateBat(dt, game, d, ux, uy) {
    if (this.fuse < 0) {
      this.steer(game, ux, uy, this.speed, dt);
      if (d < this.cfg.armRange + game.player.radius && this.spawnTime <= 0) {
        this.fuse = this.cfg.fuse;
        game.sound.play("batArm", 0.5);
      }
    } else {
      this.steer(game, ux, uy, this.speed * 0.25, dt);   // vẫn bám theo chậm khi đang kích nổ
      this.fuse -= dt;
      if (this.fuse <= 0) game.batExplode(this);
    }
  }

  // ---------- Cung Thủ Xương ----------
  updateArcher(dt, game, d, ux, uy) {
    const c = this.cfg, p = game.player;
    this.reload -= dt;
    if (this.state === "aim") {
      // đứng yên ngắm, laser đỏ bám theo người chơi tới 0.15s cuối thì khóa hướng
      if (this.stateTime > 0.15) this.aimAngle = Math.atan2(p.cy - this.cy, p.cx - this.cx);
      if (this.stateTime <= 0) {
        this.shoot(game, this.aimAngle, { speed: c.arrowSpeed, damage: c.damage, radius: 3, style: "arrow", life: 2, noBonus: true });
        game.sound.play("arrow", 0.4);
        this.state = "move";
        this.reload = c.reload;
      }
      return;
    }
    this.keepDistance(game, dt, d, ux, uy, c.keep);
    if (this.reload <= 0 && d < c.sight && this.spawnTime <= 0 && game.world.lineOfSight(this.cx, this.cy, p.cx, p.cy)) {
      this.state = "aim";
      this.stateTime = c.aimTime;
      this.aimAngle = Math.atan2(p.cy - this.cy, p.cx - this.cx);
    }
  }

  // ---------- Mắt Quỷ: gồng rồi bắn 3 cầu tỏa quạt ----------
  updateCaster(dt, game, d, ux, uy) {
    const c = this.cfg, p = game.player;
    this.reload -= dt;
    if (this.state === "cast") {
      this.aimAngle = Math.atan2(p.cy - this.cy, p.cx - this.cx);
      if (this.stateTime <= 0) {
        for (let i = 0; i < c.shots; i++) {
          const a = this.aimAngle + (i - (c.shots - 1) / 2) * c.spread;
          this.shoot(game, a, { speed: c.shotSpeed, damage: 1, radius: 3, style: "orb", color: "#9be05a", life: 3 });
        }
        game.sound.play("bossShoot", 0.25);
        this.state = "move"; this.reload = c.castEvery * rand(0.85, 1.15);
      }
      return;
    }
    this.keepDistance(game, dt, d, ux, uy, c.keep);
    if (this.reload <= 0 && d < c.sight && this.spawnTime <= 0 && game.world.lineOfSight(this.cx, this.cy, p.cx, p.cy)) { this.state = "cast"; this.stateTime = c.castTime; }
  }

  // ---------- Đầu Lâu Lửa: lao tới như tên bắn ----------
  updateDiver(dt, game, d, ux, uy) {
    const c = this.cfg, p = game.player;
    this.reload -= dt;
    if (this.state === "windup") {
      this.aimAngle = Math.atan2(p.cy - this.cy, p.cx - this.cx);
      if (this.stateTime <= 0) { this.state = "dive"; this.stateTime = c.diveTime; game.sound.play("skillDash", 0.3); }
      return;
    }
    if (this.state === "dive") {
      const v = c.diveSpeed * this.spd * this.speedMul, bx = this.x, by = this.y;
      game.world.moveBody(this, Math.cos(this.aimAngle) * v * dt, Math.sin(this.aimAngle) * v * dt, Math.max(5, this.radius * 0.6), true);
      this.moving = true;
      const moved = (this.x - bx) ** 2 + (this.y - by) ** 2;
      if (this.stateTime <= 0 || moved < 0.5) { this.state = "move"; this.reload = rand(1.4, 2.2); }
      return;
    }
    const [fx, fy] = this.flankDir(ux, uy, d);
    this.steer(game, fx, fy, this.speed, dt);
    if (this.reload <= 0 && d < c.diveRange && this.spawnTime <= 0) { this.state = "windup"; this.stateTime = c.windup; }
  }

  // ---------- Ếch Độc: nhảy cóc + phun axit ----------
  updateHopper(dt, game, d, ux, uy) {
    const c = this.cfg, p = game.player;
    this.reload2 -= dt;
    if (this.jump) {
      const J = this.jump;
      J.t += dt;
      const u = Math.min(1, J.t / J.dur), v = J.dist / J.dur;
      game.world.moveBody(this, Math.cos(J.a) * v * dt * this.speedMul, Math.sin(J.a) * v * dt * this.speedMul, Math.max(5, this.radius * 0.6), false);
      this.z = Math.sin(Math.PI * u) * 10;
      this.moving = true;
      if (u >= 1) { this.jump = null; this.z = 0; this.stateTime = c.hopEvery * rand(0.8, 1.2); }
      return;
    }
    if (this.reload2 <= 0 && d < c.spitRange && this.spawnTime <= 0 && game.world.lineOfSight(this.cx, this.cy, p.cx, p.cy)) {
      this.reload2 = c.spitEvery * rand(0.8, 1.2);
      this.shoot(game, Math.atan2(p.cy - this.cy, p.cx - this.cx), { speed: 150, damage: 1, radius: 3, style: "acid", life: 1.6, slow: 1.5 });
      game.sound.play("poison", 0.25);
    }
    if (this.stateTime <= 0) {
      const [fx, fy] = this.flankDir(ux, uy, d);
      this.jump = { t: 0, dur: c.hopTime, a: Math.atan2(fy, fx), dist: Math.min(c.hopDist * this.spd, d + 10) };
    }
  }

  // ---------- Pháp Sư Xương: niệm chú gọi quái, bị áp sát thì dịch chuyển ----------
  updateSummoner(dt, game, d, ux, uy) {
    const c = this.cfg;
    this.reload -= dt; this.reload2 -= dt;
    if (this.state === "chant") {
      if (this.stateTime <= 0) {
        for (let i = 0; i < c.count; i++) game.spawnMinion(c.summon, this.x + rand(-24, 24), this.y + rand(-16, 16));
        game.fx.portal?.(this.x, this.y + 4, 0.45);
        game.sound.play("summon", 0.4);
        this.state = "move"; this.reload = c.summonEvery * rand(0.9, 1.2);
      }
      return;
    }
    if (d < 90 && this.reload2 <= 0) {   // bị áp sát: dịch chuyển ra xa
      const pt = game.world.randomFreePoint({ near: { x: game.player.x, y: game.player.y }, minD: 170, maxD: 240, margin: 12 });
      if (pt) { game.fx.death(this.cx, this.cy, 0.7); this.x = pt.x; this.y = pt.y; game.fx.spawn(this.cx, this.cy + 8); game.sound.play("blink", 0.3); }
      this.reload2 = c.blinkCd;
    }
    this.keepDistance(game, dt, d, ux, uy, c.keep);
    if (this.reload <= 0 && this.spawnTime <= 0 && d < 340) { this.state = "chant"; this.stateTime = c.chantTime; }
  }

  // ---------- BOSS 1 — HỒN MA TÍM: luân phiên "bắn 12 hướng", "lướt húc", "gọi dơi" ----------
  updateBoss(dt, game, d, ux, uy) {
    switch (this.state) {
      case "move":
        this.steer(game, ux, uy, this.speed, dt);
        if (this.stateTime <= 0) {
          const seq = ["ring", "charge", "ring", "summon"], next = seq[this.attack++ % seq.length];
          if (next === "ring") { this.state = "ring"; this.volley = 3; this.stateTime = 0.25; }
          else if (next === "summon") { for (let i = 0; i < 3; i++) game.spawnMinion("bat", this.x + rand(-30, 30), this.y + rand(-20, 20)); game.fx.portal?.(this.x, this.y, 0.7); this.state = "move"; this.stateTime = 1.4; }
          else { this.state = "windup"; this.stateTime = 0.7; this.aimAngle = Math.atan2(uy, ux); game.sound.play("bossCharge", 0.6); }
        }
        break;
      case "ring": { // Bullet Hell: 3 loạt x 12 viên, mỗi loạt xoay lệch nửa nấc (máu thấp: 16 viên)
        if (this.stateTime <= 0) {
          const n = this.hp < this.maxHp * 0.5 ? 16 : 12, off = (3 - this.volley) * (Math.PI / n);
          for (let i = 0; i < n; i++) this.shoot(game, off + (i / n) * TAU, { speed: 120, damage: 1, radius: 4, style: "orb", color: "#c48cff", life: 4, offset: 14, noBonus: true });
          game.sound.play("bossShoot", 0.5);
          game.shake(0.15, 2);
          this.volley--;
          this.stateTime = 0.4;
          if (this.volley <= 0) { this.state = "move"; this.stateTime = 1.6; }
        }
        break;
      }
      case "windup": // gồng 0.7s, hiện vạch cảnh báo đường húc
        this.aimAngle = Math.atan2(uy, ux);
        if (this.stateTime <= 0) { this.state = "charge"; this.stateTime = 0.65; game.sound.play("skillDash", 0.6); }
        break;
      case "charge": this.updateCharge(dt, game, 380); break;
    }
  }

  /** Lướt húc thẳng (dùng chung cho các Boss) */
  updateCharge(dt, game, speed) {
    const bx = this.x, by = this.y;
    const blocked = game.world.moveBody(this, Math.cos(this.aimAngle) * speed * dt, Math.sin(this.aimAngle) * speed * dt, this.radius * 0.6, false);
    if (blocked && (this.x - bx) ** 2 + (this.y - by) ** 2 < 1) { this.stateTime = 0; game.shake(0.25, 4); }
    if (this.stateTime <= 0) { this.state = "move"; this.stateTime = 1.8; }
  }

  // ---------- BOSS 2 — VUA SLIME: nhảy đè (vòng cảnh báo), tiếp đất bắn axit + đẻ slime con ----------
  updateSlimeKing(dt, game, d, ux, uy) {
    const p = game.player;
    switch (this.state) {
      case "move":
        this.steer(game, ux, uy, this.speed, dt);
        if (this.stateTime <= 0) {
          this.state = "crouch"; this.stateTime = 0.65;
          const pt = game.world.isFree(p.x, p.y, 14) ? { x: p.x, y: p.y } : game.world.randomFreePoint({ near: p, minD: 0, maxD: 60, margin: 14 });
          this.tx = pt?.x ?? this.x; this.ty = pt?.y ?? this.y;
          game.sound.play("bossCharge", 0.5);
        }
        break;
      case "crouch":
        if (this.stateTime <= 0) { this.state = "jump"; this.jump = { t: 0, dur: 0.8, sx: this.x, sy: this.y }; }
        break;
      case "jump": {
        const J = this.jump; if (!J) { this.state = "move"; this.stateTime = 1; break; }
        J.t += dt;
        const u = Math.min(1, J.t / J.dur), e = u * u * (3 - 2 * u);
        this.x = J.sx + (this.tx - J.sx) * e; this.y = J.sy + (this.ty - J.sy) * e;
        this.z = Math.sin(Math.PI * u) * 90;
        if (u >= 1) {
          this.jump = null; this.z = 0; this.lands++;
          game.bossSlam(this.x, this.y, 70, 2 + this.dmgBonus);
          const n = 10, off = rand(0, TAU);
          for (let i = 0; i < n; i++) this.shoot(game, off + (i / n) * TAU, { speed: 105, damage: 1, radius: 4, style: "acid", life: 3, slow: 1, offset: 16, noBonus: true });
          if (this.lands % 2 === 0) for (const s of [-1, 1]) game.spawnMinion("slime", this.x + s * 26, this.y + 6, { kx: s * 160 });
          const enraged = this.hp < this.maxHp * 0.5;
          if (enraged && this.lands % 2 === 1) { this.state = "crouch"; this.stateTime = 0.35; this.tx = p.x; this.ty = p.y; }
          else { this.state = "move"; this.stateTime = enraged ? 1.2 : 1.9; }
        }
        break;
      }
    }
  }

  // ---------- BOSS 3 — CHÚA TỂ ĐẦU LÂU: xoáy cầu lửa, quạt lửa, gọi đầu lâu, lướt húc ----------
  updateSkullLord(dt, game, d, ux, uy) {
    switch (this.state) {
      case "move": {
        // bay vòng quanh người chơi ở ~150px
        const r = d - 150, tx = -uy * this.strafe, ty = ux * this.strafe;
        const mx = tx + ux * Math.max(-1, Math.min(1, r / 60)), my = ty + uy * Math.max(-1, Math.min(1, r / 60)), l = Math.hypot(mx, my) || 1;
        this.steer(game, mx / l, my / l, this.speed, dt);
        if (this.stateTime <= 0) {
          const seq = ["spiral", "fan", "summon", "charge"], next = seq[this.attack++ % seq.length];
          if (next === "spiral") { this.state = "spiral"; this.stateTime = 2.2; this.sweep = rand(0, TAU); this.reload = 0; }
          else if (next === "fan") { this.state = "fan"; this.volley = 3; this.stateTime = 0.3; }
          else if (next === "summon") { for (let i = 0; i < 3; i++) game.spawnMinion("skull", this.x + rand(-34, 34), this.y + rand(-20, 20)); game.fx.portal?.(this.x, this.y, 0.7); game.sound.play("summon", 0.5); this.state = "move"; this.stateTime = 1.6; }
          else { this.state = "windup"; this.stateTime = 0.6; game.sound.play("bossCharge", 0.6); }
        }
        break;
      }
      case "spiral":
        this.reload -= dt;
        while (this.reload <= 0) {
          this.reload += this.hp < this.maxHp * 0.5 ? 0.06 : 0.08;
          this.sweep += 0.33;
          for (const k of [0, Math.PI]) this.shoot(game, this.sweep + k, { speed: 130, damage: 1, radius: 4, style: "fireball", life: 3.5, offset: 14, noBonus: true });
        }
        if (Math.random() < dt * 6) game.sound.play("bossShoot", 0.2);
        if (this.stateTime <= 0) { this.state = "move"; this.stateTime = 1.6; this.strafe *= -1; }
        break;
      case "fan":
        if (this.stateTime <= 0) {
          const a0 = Math.atan2(uy, ux);
          for (let i = -3; i <= 3; i++) this.shoot(game, a0 + i * 0.16, { speed: 175, damage: 1, radius: 3, style: "fireball", life: 3, offset: 14, noBonus: true });
          game.sound.play("bossShoot", 0.5);
          this.volley--; this.stateTime = 0.45;
          if (this.volley <= 0) { this.state = "move"; this.stateTime = 1.5; }
        }
        break;
      case "windup":
        this.aimAngle = Math.atan2(uy, ux);
        if (this.stateTime <= 0) { this.state = "charge"; this.stateTime = 0.6; game.sound.play("skillDash", 0.6); }
        break;
      case "charge": this.updateCharge(dt, game, 430); break;
    }
  }

  // ---------- BOSS 4 — MẮT QUỶ VƯƠNG: tia laser quét, vòng cầu, gọi Mắt Quỷ ----------
  updateEyeLord(dt, game, d, ux, uy) {
    const p = game.player;
    switch (this.state) {
      case "move":
        this.keepDistance(game, dt, d, ux, uy, 180);
        if (this.stateTime <= 0) {
          const seq = ["laser", "burst", "laser", "minions"], next = seq[this.attack++ % seq.length];
          if (next === "laser") { this.state = "laserAim"; this.stateTime = 0.9; game.sound.play("bossCharge", 0.6); }
          else if (next === "burst") { this.state = "burst"; this.volley = 2; this.stateTime = 0.2; }
          else { for (let i = 0; i < 2; i++) game.spawnMinion("eyeball", this.x + rand(-40, 40), this.y + rand(-20, 20)); game.fx.portal?.(this.x, this.y, 0.7); game.sound.play("summon", 0.5); this.state = "move"; this.stateTime = 1.4; }
        }
        break;
      case "laserAim":   // ngắm: vạch đỏ mảnh bám theo người chơi
        this.aimAngle = Math.atan2(p.cy - this.cy, p.cx - this.cx);
        if (this.stateTime <= 0) { this.state = "laser"; this.stateTime = 1.5; this.sweep = Math.random() < 0.5 ? 1 : -1; this.aimAngle -= this.sweep * 0.75; game.sound.play("laser", 0.6); }
        break;
      case "laser": {    // tia laser quét 1.5 rad trong 1.5s
        this.aimAngle += this.sweep * dt * 1.0;
        const L = this.laserEnd(game);
        if (pointSegDist2(p.cx, p.cy, this.cx, this.cy, L.x, L.y) < 8 * 8) p.hurt(game, this.cx, this.cy, 2 + this.dmgBonus);
        if (Math.random() < dt * 20) game.fx.hit(L.x, L.y, this.aimAngle + Math.PI);
        if (this.stateTime <= 0) { this.state = "move"; this.stateTime = 1.4; }
        break;
      }
      case "burst":
        if (this.stateTime <= 0) {
          const n = 16, off = this.volley * (Math.PI / n);
          for (let i = 0; i < n; i++) this.shoot(game, off + (i / n) * TAU, { speed: 100, damage: 1, radius: 4, style: "orb", color: "#9be05a", life: 4, offset: 16, accel: 30, noBonus: true });
          game.sound.play("bossShoot", 0.5);
          this.volley--; this.stateTime = 0.55;
          if (this.volley <= 0) { this.state = "move"; this.stateTime = 1.5; }
        }
        break;
    }
  }
  /** Điểm cuối tia laser của Mắt Quỷ Vương (bị tường chặn) */
  laserEnd(game) {
    const L = 320, x1 = this.cx + Math.cos(this.aimAngle) * L, y1 = this.cy + Math.sin(this.aimAngle) * L;
    const ray = game.world.raycast(this.cx, this.cy, x1, y1);
    return { x: this.cx + (x1 - this.cx) * ray.t, y: this.cy + (y1 - this.cy) * ray.t };
  }

  // ---------- VẼ ----------
  /** Vẽ dưới chân (trước khi vẽ nhân vật): bóng, vòng tinh anh, hào quang boss, vòng cảnh báo nơi tiếp đất */
  drawGround(c, game) {
    const x = Math.round(this.x), y = Math.round(this.y);
    // bóng dưới chân (quái bay / đang nhảy: bóng nhỏ + nhạt dần theo độ cao)
    const air = this.cfg.flying ? 1 : this.z > 0 ? Math.min(1, this.z / 40) : 0;
    drawShadow(c, x, y, this.radius * (this.boss ? 2.2 : 1.9) * (1 - air * 0.35), 0.32 - air * 0.12);
    if (this.elite) {
      const col = this.affixCfg.color;
      c.fillStyle = withAlpha(col, 0.28 + 0.18 * Math.sin(game.time * 8));
      c.beginPath(); c.ellipse(x, y, this.radius + 4, (this.radius + 4) * 0.4, 0, 0, TAU); c.fill();
      if (this.eliteCast > 0) {   // Bão Đạn: vòng cảnh báo nở ra
        const k = 1 - this.eliteCast / 0.6;
        c.strokeStyle = withAlpha(col, 0.5 + 0.5 * k); c.lineWidth = 1;
        c.beginPath(); c.ellipse(x, y, 10 + 30 * k, (10 + 30 * k) * 0.45, 0, 0, TAU); c.stroke();
      }
    }
    if (this.boss) {
      const r = 34 + Math.sin(game.time * 5) * 3;
      c.save();
      c.globalAlpha = 0.3;
      c.fillStyle = this.cfg.aura ?? "#7a3cc8";
      c.beginPath(); c.ellipse(x, y, r, r * 0.4, 0, 0, TAU); c.fill();
      c.restore();
    }
    // Vua Slime: vòng đỏ nơi sắp đáp xuống
    if ((this.type === "slimeKing" || this.type === "zBoss") && (this.state === "crouch" || this.state === "jump")) {
      const R = this.cfg.slamR ?? 70;
      const k = this.state === "jump" && this.jump ? this.jump.t / this.jump.dur : 0;
      c.strokeStyle = withAlpha("#ff3b3b", 0.5 + 0.4 * Math.sin(game.time * 20)); c.lineWidth = 1;
      c.beginPath(); c.ellipse(Math.round(this.tx), Math.round(this.ty), R, R * 0.4, 0, 0, TAU); c.stroke();
      c.fillStyle = withAlpha("#ff3b3b", 0.12 + 0.25 * k);
      c.beginPath(); c.ellipse(Math.round(this.tx), Math.round(this.ty), R * Math.max(0.15, k), R * 0.4 * Math.max(0.15, k), 0, 0, TAU); c.fill();
    }
  }

  /**
   * Vẽ thân quái (ctx đang ở TỌA ĐỘ THẾ GIỚI): 1 ô spritesheet.
   * Chớp trắng khi trúng đòn = cùng ô đó trên bản tô trắng của sheet (tạo sẵn 1 lần).
   */
  draw(c, game) {
    let x = Math.round(this.x), y = Math.round(this.y - this.z);
    if (!game.camera.inView(x, y, 90)) return;
    let flip = Math.cos(this.facing) < 0, s = (this.cfg.scale ?? 1) * this.sc;
    // Vua Slime nhún người khi chuẩn bị nhảy
    let sx = s, sy = s;
    if ((this.type === "slimeKing" || this.type === "zBoss") && this.state === "crouch") { sy = s * (0.85 + 0.05 * Math.sin(game.time * 30)); sx = s * 1.08; }
    // >>> JUICE (src/juice.js): BẬT LÙI theo hướng đạn + MÉO NGƯỜI (lò xo: bè ngang -> vươn cao -> về dáng)
    if (this.rk > 0.3) { x += Math.round(Math.cos(this.hitAng) * this.rk); y += Math.round(Math.sin(this.hitAng) * this.rk * 0.5); }
    if (this.sq) { sx *= 1 + this.sq * 0.2; sy *= 1 - this.sq * 0.2; }
    const img = this.cfg.image ? game.assets.images[this.cfg.image] : null;
    if (img) {
      // >>> ẢNH QUÁI CỦA BẠN (1 ảnh tĩnh, IMAGE_MANIFEST trong main.js) — chân tại (x, y), quay mặt sang PHẢI
      c.save();
      c.translate(x, y);
      if (flip) c.scale(-1, 1);
      c.drawImage(img, (-img.width * sx) / 2, -img.height * sy, img.width * sx, img.height * sy);
      if (this.flash > 0) { c.globalAlpha = 0.6; c.globalCompositeOperation = "lighter"; c.drawImage(img, (-img.width * sx) / 2, -img.height * sy, img.width * sx, img.height * sy); }
      c.restore();
      return;
    }
    if (!this.sprite) return;
    // >>> XUẤT HIỆN: zombie / quái đi bộ CHUI LÊN TỪ ĐẤT, quái bay hiện dần (0.35 giây đầu, lúc chưa gây sát thương)
    const rise = this.spawnTime > 0 ? Math.min(1, Math.max(0, 1 - this.spawnTime / 0.35)) : 1;
    if (rise < 1) {
      const walker = !this.cfg.flying && this.sprite.kind === "chibi";
      drawRise(c, x, y, rise, Math.round(30 * s), walker, (dx, dy) => this.drawBody(c, game, x + dx, y + dy, flip, s, sx, sy), this.serial ?? 0);
      return;
    }
    this.drawBody(c, game, x, y, flip, s, sx, sy);
  }
  /** Thân quái tại (x, y): viền tinh anh + spritesheet (chớp trắng / đóng băng / gồng) + dáng lảo đảo / méo người */
  drawBody(c, game, x, y, flip, s, sx, sy) {
    if (this.elite) {   // viền phát sáng theo màu tố chất (4 bản tô màu lệch 1px)
      const glow = this.sprite.sheet.tinted(this.affixCfg.color, 1);
      c.globalAlpha = 0.55 + 0.35 * Math.sin(game.time * 7 + this.serial);
      for (const [ox, oy] of OUTLINE) glow.draw(c, this.anim.col, this.anim.row, x + ox, y + oy, flip, s);
      c.globalAlpha = 1;
    }
    const sheet = this.flash > 0 ? this.sprite.flash : this.freezeT > 0 ? this.sprite.frozen : this.state === "windup" || this.state === "cast" || this.state === "roar" ? this.sprite.hot : this.sprite.sheet;
    // dáng lảo đảo của zombie: nghiêng nhẹ qua lại quanh chân khi lê bước
    const sway = this.cfg.zombie && this.moving && !this.boss ? Math.sin(game.time * 6 + this.serial * 1.7) * 0.07 : 0;
    if (sx !== s || sy !== s || sway) {
      c.save(); c.translate(x, y);
      if (sway) c.rotate(sway);
      c.scale(sx / s, sy / s);
      sheet.draw(c, this.anim.col, this.anim.row, 0, 0, flip, s);
      c.restore();
    } else sheet.draw(c, this.anim.col, this.anim.row, x, y, flip, s);
  }

  drawOverlay(c, game) {
    if (!game.camera.inView(this.x, this.y, 320)) return;
    // Boss gồng húc: vạch cảnh báo đường lướt
    if (this.boss && this.state === "windup" && Math.floor(game.time * 16) % 2 === 0) {
      c.strokeStyle = withAlpha("#ff3bd1", 0.7); c.lineWidth = 2;
      c.beginPath(); c.moveTo(this.cx, this.cy); c.lineTo(this.cx + Math.cos(this.aimAngle) * 240, this.cy + Math.sin(this.aimAngle) * 240); c.stroke();
    }
    // Đầu Lâu Lửa gồng lao: vạch đỏ ngắn
    if (this.state === "windup" && !this.boss) {
      c.strokeStyle = withAlpha("#ff6a1e", 0.35 + 0.4 * Math.sin(game.time * 30)); c.lineWidth = 1;
      c.beginPath(); c.moveTo(this.cx, this.cy); c.lineTo(this.cx + Math.cos(this.aimAngle) * 170, this.cy + Math.sin(this.aimAngle) * 170); c.stroke();
    }
    // Mắt Quỷ Vương: ngắm / bắn laser
    if (this.state === "laserAim" || this.state === "laser") {
      const L = this.laserEnd(game);
      if (this.state === "laserAim") {
        c.strokeStyle = withAlpha("#ff2020", Math.floor(game.time * 20) % 2 ? 0.8 : 0.35); c.lineWidth = 1;
        c.beginPath(); c.moveTo(this.cx + 0.5, this.cy + 0.5); c.lineTo(L.x + 0.5, L.y + 0.5); c.stroke();
      } else {
        for (const [w, col] of [[9, "rgba(255,40,40,0.3)"], [5, "#ff3030"], [2, "#ffe0e0"]]) {
          c.strokeStyle = col; c.lineWidth = w + (Math.sin(game.time * 50) > 0 ? 1 : 0);
          c.beginPath(); c.moveTo(this.cx, this.cy); c.lineTo(L.x, L.y); c.stroke();
        }
      }
    }
    // Pháp Sư Xương / Mắt Quỷ niệm chú: vòng phép dưới chân
    if (this.state === "chant" || this.state === "cast") {
      const col = this.state === "chant" ? "#b06cff" : "#9be05a", k = 1 - Math.max(0, this.stateTime) / (this.state === "chant" ? this.cfg.chantTime : this.cfg.castTime);
      c.strokeStyle = withAlpha(col, 0.5 + 0.4 * k); c.lineWidth = 1;
      c.beginPath(); c.ellipse(Math.round(this.x), Math.round(this.y), 8 + 8 * k, 3 + 3 * k, 0, 0, TAU); c.stroke();
      c.fillStyle = withAlpha(col, 0.8);
      c.fillRect(Math.round(this.cx) - 1, Math.round(this.cy - this.radius - 6 - k * 3), 2, 2);
    }
    // khiên của Hiệp Sĩ (luôn ở phía đang nhìn)
    if (this.cfg.ai === "tank") {
      const fx = Math.cos(this.facing), fy = Math.sin(this.facing);
      const shx = Math.round(this.cx + fx * 9), shy = Math.round(this.cy + fy * 5 + 2);
      c.fillStyle = "#0e0c14"; c.fillRect(shx - 5, shy - 8, 10, 15);
      c.fillStyle = this.flash > 0 ? "#ffffff" : "#8a5a2a"; c.fillRect(shx - 4, shy - 7, 8, 13);
      c.fillStyle = "#c8cde0"; c.fillRect(shx - 4, shy - 7, 8, 2); c.fillRect(shx - 1, shy - 5, 2, 10);
      c.fillStyle = "#ffd34a"; c.fillRect(shx - 1, shy - 1, 2, 2);
    }
    // cung + laser ngắm của Cung Thủ
    if (this.cfg.ai === "ranged") {
      const a = this.state === "aim" ? this.aimAngle : this.facing;
      c.save();
      c.translate(Math.round(this.cx), Math.round(this.cy + 1));
      c.rotate(a);
      c.fillStyle = "#6a4a2a"; c.fillRect(5, -6, 2, 12); c.fillRect(7, -7, 1, 2); c.fillRect(7, 5, 1, 2);
      c.fillStyle = "#e8e2d0"; c.fillRect(4, -5, 1, 10);
      c.restore();
      if (this.state === "aim") {
        const k = 1 - this.stateTime / this.cfg.aimTime;
        const blink = this.stateTime < 0.25 && Math.floor(game.time * 30) % 2 === 0;
        c.strokeStyle = withAlpha("#ff2020", blink ? 0.95 : 0.25 + 0.5 * k);
        c.lineWidth = 1;
        const ray = game.world.raycast(this.cx, this.cy, this.cx + Math.cos(a) * 420, this.cy + Math.sin(a) * 420);
        c.beginPath(); c.moveTo(this.cx + 0.5, this.cy + 0.5); c.lineTo(this.cx + Math.cos(a) * 420 * ray.t + 0.5, this.cy + Math.sin(a) * 420 * ray.t + 0.5); c.stroke();
      }
    }
    // Đang cháy: lưỡi lửa nhảy múa trên thân
    if (this.burnT > 0) {
      for (let i = 0; i < 4; i++) {
        const fx = this.cx + Math.sin(game.time * 13 + i * 2.1) * this.radius * 0.7, h = 2 + ((game.time * 20 + i * 5) % 5);
        c.fillStyle = i % 2 ? "#ffc23d" : "#ff6a1e";
        c.fillRect(Math.round(fx), Math.round(this.cy - this.radius * 0.3 - h), 2, Math.round(h));
      }
    }
    // Đóng băng: khối băng bọc quanh thân, nhấp nháy khi sắp tan
    if (this.freezeT > 0 && (this.freezeT > 0.6 || Math.floor(game.time * 12) % 2 === 0)) {
      const s = this.cfg.scale ?? 1, w = Math.round((this.radius + 3) * 2), h = Math.round(Math.max(14, -this.cfg.bodyY * 1.6 * Math.min(1.4, s) + 6));
      const x = Math.round(this.x - w / 2), y = Math.round(this.y - this.z - h + 2);
      c.fillStyle = "rgba(150,225,255,0.30)"; c.fillRect(x, y, w, h);
      c.fillStyle = "rgba(220,248,255,0.85)"; c.fillRect(x, y, w, 1); c.fillRect(x, y, 1, h);
      c.fillStyle = "rgba(60,140,210,0.8)"; c.fillRect(x, y + h - 1, w, 1); c.fillRect(x + w - 1, y, 1, h);
      c.fillStyle = "#ffffff"; c.fillRect(x + 2, y + 2, 2, 1); c.fillRect(x + 2, y + 3, 1, 2);
    }
    // Choáng: 3 ngôi sao xoay trên đầu
    if (this.stunT > 0) {
      const top = this.cy - this.radius - 6;
      for (let i = 0; i < 3; i++) {
        const a = game.time * 8 + (i * TAU) / 3, sx = Math.round(this.cx + Math.cos(a) * 7), sy = Math.round(top + Math.sin(a) * 2);
        c.fillStyle = "#ffe26b"; c.fillRect(sx - 1, sy, 3, 1); c.fillRect(sx, sy - 1, 1, 3);
      }
    }
    // Bị làm chậm: phủ băng xanh + bông tuyết
    if (this.slowT > 0) {
      c.fillStyle = "rgba(124,216,255,0.28)";
      c.beginPath(); c.arc(this.cx, this.cy, this.radius + 1, 0, TAU); c.fill();
      c.fillStyle = "#e8f8ff";
      const sx = Math.round(this.cx + this.radius * 0.6), sy = Math.round(this.cy - this.radius);
      c.fillRect(sx - 1, sy, 3, 1); c.fillRect(sx, sy - 1, 1, 3);
    }
    // Dơi Cảm Tử nhấp nháy đỏ trước khi nổ
    if (this.fuse >= 0 && Math.floor(this.fuse * 20) % 2 === 0) {
      c.fillStyle = "rgba(255,40,40,0.7)";
      c.beginPath(); c.arc(this.cx, this.cy, this.radius + 3, 0, TAU); c.fill();
    }
    // Thanh máu nhỏ: quái tinh anh (luôn hiện + tên tố chất) / quái trâu (Hiệp Sĩ, Pháp Sư) khi đã mất máu
    if (!this.boss && (this.elite || (this.hp < this.maxHp && this.maxHp >= 4))) {
      const w = Math.max(14, this.radius * 2), x = Math.round(this.cx - w / 2), y = Math.round(this.cy - this.radius * (this.cfg.scale ?? 1) - 9);
      c.fillStyle = "#0e0c14"; c.fillRect(x - 1, y - 1, w + 2, 4);
      c.fillStyle = "#3a1a24"; c.fillRect(x, y, w, 2);
      c.fillStyle = this.elite ? this.affixCfg.color : "#ff4a5a"; c.fillRect(x, y, Math.max(1, Math.round(w * this.hp / this.maxHp)), 2);
      if (this.elite) {
        c.font = "7px monospace"; c.textAlign = "center"; c.textBaseline = "bottom";
        const label = `★ ${this.affixCfg.name}`;
        c.fillStyle = "#000"; c.fillText(label, Math.round(this.cx) + 1, y - 1);
        c.fillStyle = this.affixCfg.color; c.fillText(label, Math.round(this.cx), y - 2);
        c.textAlign = "left"; c.textBaseline = "top";
      }
    }
  }
}

/**
 * Chọn loại quái theo thời gian sống sót (càng lâu càng nhiều loại khó) và theo bản đồ (bias).
 * Trả về tên loại trong ENEMY_TYPES.
 */
export function pickEnemyType(time, bias = {}) {
  const pool = [["slime", 10]];
  if (time > 8) pool.push(["bat", 6]);
  if (time > 15) pool.push(["snake", 5]);
  if (time > 20) pool.push(["bigSlime", 4]);
  if (time > 25) pool.push(["archer", 5]);
  if (time > 32) pool.push(["frog", 4]);
  if (time > 40) pool.push(["knight", 4]);
  if (time > 48) pool.push(["eyeball", 4]);
  if (time > 50) pool.push(["ghost", 3]);
  if (time > 62) pool.push(["skull", 4]);
  if (time > 85) pool.push(["shaman", 2.5]);
  for (const e of pool) e[1] *= bias[e[0]] ?? 1;
  const total = pool.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [name, w] of pool) { if ((r -= w) <= 0) return name; }
  return "slime";
}

const OUTLINE = [[-1, 0], [1, 0], [0, -1], [0, 1]];

/** Object Pool của quái (tạo sẵn 64 con rỗng) */
Enemy.pool = new Pool(() => new Enemy(), 64);
Enemy.serial = 0;

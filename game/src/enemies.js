// =====================================================================================
//  QUÁI VẬT CHIẾN THUẬT + MINI-BOSS
//
//  ai: "chase"     — lao thẳng theo người chơi (Slime, Slime khổng lồ, Ma)
//      "ranged"    — Cung Thủ Xương: giữ khoảng cách 280px, ngắm 0.8s (laser đỏ) rồi bắn tên
//      "tank"      — Hiệp Sĩ Khiên: chậm, khiên giảm 75% sát thương từ chính diện
//      "kamikaze"  — Dơi Cảm Tử: cực nhanh, áp sát thì nhấp nháy đỏ và nổ sau 0.6s
//      "boss"      — Mini-Boss: luân phiên bắn đạn 12 hướng và lướt húc
// =====================================================================================
import { EnemyBullet } from "./weapons.js";
import { Pool } from "./pool.js";
import { angleDiff, rand, withAlpha, TAU } from "./util.js";

/**
 * Chỉ số từng loại quái — chỉnh độ khó ở đây. (Bản này đã GIẢM máu ~40% so với trước: Slime 1 phát là chết.)
 * sprite: tên spritesheet trong fx-config.js -> ACTORS (ngoại hình quái hình người cũng nằm ở đó, mục LOOKS)
 * scale : phóng to khi vẽ (Slime khổng lồ x1.6, Mini-Boss x2.2)
 */
export const ENEMY_TYPES = {
  slime:    { name: "Slime Xanh",       sprite: "slime",  ai: "chase",    hp: 1.2, speed: 38,  radius: 11, bodyY: -12, damage: 1, score: 10,  exp: 1, image: "enemySlime" },
  bigSlime: { name: "Slime Khổng Lồ",   sprite: "slime",  ai: "chase",    hp: 4,  speed: 27,  radius: 17, bodyY: -19, damage: 2, score: 30,  exp: 3, image: "enemySlime", scale: 1.6, split: "slime" },
  bat:      { name: "Dơi Cảm Tử",       sprite: "bat",    ai: "kamikaze", hp: 1,  speed: 122, radius: 8,  bodyY: -8,  damage: 1, score: 15,  exp: 1, image: "enemyBat", flying: true, fuse: 0.6, armRange: 26, blast: 40, noContact: true },
  ghost:    { name: "Hồn Ma",           sprite: "ghost",  ai: "chase",    hp: 2.5, speed: 28,  radius: 11, bodyY: -18, damage: 2, score: 25,  exp: 2, image: "enemyGhost", flying: true },
  archer:   { name: "Cung Thủ Xương",   sprite: "archer", ai: "ranged",   hp: 2,  speed: 54,  radius: 8,  bodyY: -17, damage: 1, score: 20,  exp: 2, image: "enemyArcher", keep: 280, sight: 330, aimTime: 0.8, reload: 1.4, arrowSpeed: 340 },
  knight:   { name: "Hiệp Sĩ Khiên",    sprite: "knight", ai: "tank",     hp: 6,  speed: 24,  radius: 10, bodyY: -17, damage: 2, score: 35,  exp: 3, image: "enemyKnight", shieldArc: 1.05, shieldReduce: 0.75, turnRate: 1.8 },
  boss:     { name: "Mini-Boss Hồn Ma Tím", sprite: "boss", ai: "boss", hp: 60, speed: 40, radius: 24, bodyY: -40, damage: 2, score: 300, exp: 25, image: "enemyBoss", flying: true, scale: 2.2 },
};

/** Bán kính va chạm lớn nhất (Boss tinh anh) — dùng cho lưới không gian */
export const MAX_ENEMY_RADIUS = 28;

/**
 * Tản đội hình (Soft Separation) + bao vây:
 *   gap        — khoảng hở mong muốn giữa 2 quái (pixel)
 *   stiffness  — độ "cứng" của lực đẩy (càng lớn tách càng nhanh; nhỏ = mềm, đỡ rung)
 *   flank      — độ lệch hướng tiếp cận tối đa (radian): mỗi quái vòng sang 1 bên để vây quanh người chơi
 *   flankFrom  — khoảng cách (px) bắt đầu đi vòng; gần hơn thì lao thẳng vào
 */
export const CROWD = { gap: 3, stiffness: 18, flank: 0.85, flankFrom: 70, flankFull: 260 };

export class Enemy {
  /** Lấy 1 con quái từ Object Pool (không `new` mỗi lần sinh quái). sprites = Map tên -> ActorSprite */
  static obtain(typeName, x, y, opts, sprites) { return Enemy.pool.obtain().init(typeName, x, y, opts, sprites); }

  /**
   * Đặt lại TOÀN BỘ trạng thái (đối tượng có thể là con quái cũ đã chết được dùng lại).
   * opts: { elite: true } — quái Tinh Anh: x3 máu, viền vàng, rơi Rương Bạc
   */
  init(typeName, x, y, opts = {}, sprites = null) {
    const t = ENEMY_TYPES[typeName];
    this.type = typeName;
    this.cfg = t;
    this.x = x; this.y = y;            // vị trí CHÂN (tọa độ thế giới)
    this.elite = !!opts.elite;
    this.boss = t.ai === "boss";
    this.maxHp = t.hp * (this.elite ? 3 : 1) * (opts.hpMul ?? 1);
    this.hp = this.maxHp;
    this.radius = t.radius + (this.elite ? 2 : 0);
    this.flash = 0;                    // chớp trắng khi trúng đòn (0.08s)
    this.kx = 0; this.ky = 0;          // lực đẩy lùi
    this.spawnTime = 0.35;             // vừa xuất hiện: chưa gây sát thương
    this.air = null;                   // đang bị hất tung (Lướt Xung Kích)
    this.z = 0;
    this.dead = false;
    this.facing = 0;                   // hướng nhìn (radian) — dùng cho khiên của Hiệp Sĩ
    this.side = 0; this.sideTime = 0;  // né vật cản khi bị kẹt
    this.state = "move"; this.stateTime = 0;
    this.reload = rand(0.5, 1.2);
    this.fuse = -1;                    // Dơi Cảm Tử: đếm ngược phát nổ
    this.aimAngle = 0;
    this.strafe = Math.random() < 0.5 ? 1 : -1;
    this.burnT = 0; this.burnTick = 0;  // đang cháy (Súng Phun Lửa): 1 sát thương / giây
    this.slowT = 0;                      // đang bị làm chậm (Cung Băng)
    this.speedMul = 1;
    this.freezeT = 0;                    // đang bị ĐÓNG BĂNG (gai băng của Thanh Xuân): đứng im, không đánh
    this.serial = ++Enemy.serial;        // số định danh (quái được tái sử dụng từ pool -> phân biệt con cũ / con mới)
    this.attack = undefined; this.volley = 0;
    this.flank = rand(-1, 1) * CROWD.flank;   // hướng vòng vây riêng của con này
    this.moving = false;
    this.gridId = -1;

    // Hoạt ảnh: spritesheet + AnimationController (Idle/Run cho quái hình người, "move" cho Slime/Dơi/Ma)
    this.sprite = sprites?.get(t.sprite) ?? null;
    this.anim = this.sprite ? this.sprite.controller() : null;
    this.anim?.randomize();
    if (this.boss) { this.state = "move"; this.stateTime = 2; this.volley = 0; }
    return this;
  }

  get cx() { return this.x; }
  get cy() { return this.y + this.cfg.bodyY - this.z; }
  get canHurt() { return this.spawnTime <= 0 && !this.air && !this.cfg.noContact && !(this.freezeT > 0); }

  /** Đóng băng t giây (Mini-Boss chỉ bị tối đa 1 giây). Trả về true nếu vừa mới bị đóng băng. */
  freeze(t) {
    const was = this.freezeT > 0;
    this.freezeT = Math.max(this.freezeT, this.boss ? Math.min(1, t) : t);
    if (this.state === "aim") { this.state = "move"; this.reload = Math.max(this.reload, 0.6); }   // cung thủ mất lượt ngắm
    if (this.boss && (this.state === "charge" || this.state === "windup")) { this.state = "move"; this.stateTime = 1; }
    return !was;
  }
  get contactDamage() { return this.boss && this.state === "charge" ? 3 : this.cfg.damage; }

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

  update(dt, game) {
    const p = game.player;
    this.spawnTime -= dt;
    this.flash -= dt;
    this.stateTime -= dt;
    const dx = p.cx - this.cx, dy = p.cy - this.cy;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;   // 1 lần / quái / frame để có hướng đi (không phải vòng lặp va chạm)
    const ux = dx / d, uy = dy / d;
    this.moving = false;
    // hiệu ứng trạng thái
    this.slowT = Math.max(0, this.slowT - dt);
    const speedMul = this.slowT > 0 ? (this.boss ? 0.75 : 0.5) : 1;
    this.speedMul = speedMul;
    if (this.burnT > 0) {
      this.burnT -= dt;
      this.burnTick -= dt;
      if (this.burnTick <= 0) { this.burnTick = 0.5; game.damageEnemy(this, 0.5, 0, 0, { quiet: true, pierce: true }); if (this.dead) return; }
    }

    // --- ĐÓNG BĂNG: đứng im như tượng (vẫn bị đẩy lùi), hoạt ảnh dừng ---
    if (this.freezeT > 0) {
      this.freezeT -= dt;
      if (Math.abs(this.kx) > 1 || Math.abs(this.ky) > 1) game.world.moveBody(this, this.kx * dt, this.ky * dt, Math.max(5, this.radius * 0.6), this.cfg.flying);
      const damp = Math.pow(0.0005, dt);
      this.kx *= damp; this.ky *= damp;
      return;
    }

    if (this.air) {
      this.air.t += dt;
      const u = this.air.t / this.air.dur;
      this.z = Math.sin(Math.PI * Math.min(1, u)) * this.air.h;
      if (u >= 1) { this.air = null; this.z = 0; }
    } else {
      switch (this.cfg.ai) {
        case "chase": { const [fx, fy] = this.flankDir(ux, uy, d); this.steer(game, fx, fy, this.cfg.speed * speedMul, dt); break; }
        case "tank": {
          // quay khiên chậm về phía người chơi -> người chơi lướt vòng ra sau lưng được
          const want = Math.atan2(dy, dx), diff = angleDiff(want, this.facing), step = this.cfg.turnRate * dt;
          this.facing += Math.max(-step, Math.min(step, diff));
          const [fx, fy] = this.flankDir(ux, uy, d);
          this.steer(game, fx, fy, this.cfg.speed * speedMul, dt);
          break;
        }
        case "kamikaze": this.updateBat(dt, game, d, ux, uy); break;
        case "ranged": this.updateArcher(dt, game, d, ux, uy); break;
        case "boss": this.updateBoss(dt, game, d, ux, uy); break;
      }
    }
    if (this.cfg.ai !== "tank") this.facing = Math.atan2(dy, dx);

    // lực đẩy lùi (có va chạm tường)
    if (Math.abs(this.kx) > 1 || Math.abs(this.ky) > 1) game.world.moveBody(this, this.kx * dt, this.ky * dt, Math.max(5, this.radius * 0.6), this.cfg.flying);
    const damp = Math.pow(this.boss ? 0.00001 : 0.0005, dt);
    this.kx *= damp; this.ky *= damp;

    // --- Hoạt ảnh theo deltaTime ---
    if (this.anim) {
      if (this.anim.anims.run) this.anim.set(this.moving && this.state !== "aim" ? "run" : "idle");
      this.anim.update(dt, this.air ? 2 : this.fuse >= 0 ? 3 : this.speedMul < 1 ? 0.6 : 1);
    }
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

  // ---------- Dơi Cảm Tử ----------
  updateBat(dt, game, d, ux, uy) {
    if (this.fuse < 0) {
      this.steer(game, ux, uy, this.cfg.speed * (this.speedMul ?? 1), dt);
      if (d < this.cfg.armRange + game.player.radius && this.spawnTime <= 0) {
        this.fuse = this.cfg.fuse;
        game.sound.play("batArm", 0.5);
      }
    } else {
      this.steer(game, ux, uy, this.cfg.speed * 0.25, dt);   // vẫn bám theo chậm khi đang kích nổ
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
        game.enemyBullets.push(EnemyBullet.obtain(this.cx + Math.cos(this.aimAngle) * 8, this.cy + Math.sin(this.aimAngle) * 8, this.aimAngle, {
          speed: c.arrowSpeed, damage: c.damage, radius: 3, style: "arrow", life: 2,
        }));
        game.sound.play("arrow", 0.4);
        this.state = "move";
        this.reload = c.reload;
      }
      return;
    }
    // giữ khoảng cách ~280px, đi ngang (strafe) khi đã đủ xa
    let mx = 0, my = 0;
    if (d > c.keep + 30) { mx = ux; my = uy; }
    else if (d < c.keep - 40) { mx = -ux; my = -uy; }
    else { mx = -uy * this.strafe; my = ux * this.strafe; if (Math.random() < dt * 0.4) this.strafe *= -1; }
    this.steer(game, mx, my, c.speed * (this.speedMul ?? 1), dt);
    if (this.reload <= 0 && d < c.sight && this.spawnTime <= 0 && game.world.lineOfSight(this.cx, this.cy, p.cx, p.cy)) {
      this.state = "aim";
      this.stateTime = c.aimTime;
      this.aimAngle = Math.atan2(p.cy - this.cy, p.cx - this.cx);
    }
  }

  // ---------- MINI-BOSS: luân phiên "bắn 12 hướng" và "lướt húc" ----------
  updateBoss(dt, game, d, ux, uy) {
    const c = this.cfg;
    switch (this.state) {
      case "move":
        this.steer(game, ux, uy, c.speed * (this.speedMul ?? 1), dt);
        if (this.stateTime <= 0) {
          this.attack = this.attack === "ring" ? "charge" : "ring";
          if (this.attack === "ring") { this.state = "ring"; this.volley = 3; this.stateTime = 0.25; }
          else { this.state = "windup"; this.stateTime = 0.7; this.aimAngle = Math.atan2(uy, ux); game.sound.play("bossCharge", 0.6); }
        }
        break;
      case "ring":  // Bullet Hell: 3 loạt x 12 viên, mỗi loạt xoay lệch nửa nấc
        if (this.stateTime <= 0) {
          const off = (3 - this.volley) * (Math.PI / 12);
          for (let i = 0; i < 12; i++) {
            const a = off + (i / 12) * TAU;
            game.enemyBullets.push(EnemyBullet.obtain(this.cx + Math.cos(a) * 14, this.cy + Math.sin(a) * 14, a, { speed: 120, damage: 1, radius: 4, style: "orb", color: "#c48cff", life: 4 }));
          }
          game.sound.play("bossShoot", 0.5);
          game.shake(0.15, 2);
          this.volley--;
          this.stateTime = 0.4;
          if (this.volley <= 0) { this.state = "move"; this.stateTime = 1.6; }
        }
        break;
      case "windup": // gồng 0.7s, hiện vạch cảnh báo đường húc
        this.aimAngle = Math.atan2(uy, ux);
        if (this.stateTime <= 0) { this.state = "charge"; this.stateTime = 0.65; game.sound.play("skillDash", 0.6); }
        break;
      case "charge": {
        const before = { x: this.x, y: this.y };
        const blocked = game.world.moveBody(this, Math.cos(this.aimAngle) * 380 * dt, Math.sin(this.aimAngle) * 380 * dt, this.radius * 0.6, false);
        if (blocked && (this.x - before.x) ** 2 + (this.y - before.y) ** 2 < 1) { this.stateTime = 0; game.shake(0.25, 4); }
        if (this.stateTime <= 0) { this.state = "move"; this.stateTime = 1.8; }
        break;
      }
    }
  }

  // ---------- VẼ ----------
  /**
   * Vẽ thân quái (ctx đang ở TỌA ĐỘ THẾ GIỚI): vòng Tinh Anh / hào quang Boss dưới chân, rồi 1 ô spritesheet.
   * Chớp trắng khi trúng đòn = cùng ô đó trên bản tô trắng của sheet (tạo sẵn 1 lần).
   */
  draw(c, game) {
    const x = Math.round(this.x), y = Math.round(this.y - this.z);
    if (!game.camera.inView(x, y, 90)) return;

    // vòng Tinh Anh / hào quang Boss dưới chân
    if (this.elite) {
      c.fillStyle = withAlpha("#ffd34a", 0.35 + 0.2 * Math.sin(game.time * 8));
      c.fillRect(x - this.radius - 2, Math.round(this.y) - 2, (this.radius + 2) * 2, 4);
    }
    if (this.boss) {
      const r = 34 + Math.sin(game.time * 5) * 3;
      c.save();
      c.globalAlpha = 0.35;
      c.fillStyle = "#7a3cc8";
      c.beginPath(); c.ellipse(x, Math.round(this.y), r, r * 0.4, 0, 0, TAU); c.fill();
      c.globalAlpha = 0.18;
      c.beginPath(); c.arc(x, Math.round(this.cy), r * 1.2, 0, TAU); c.fill();
      c.restore();
    }

    const flip = Math.cos(this.facing) < 0, s = this.cfg.scale ?? 1;
    const img = game.assets.images[this.cfg.image];
    if (img) {
      // >>> ẢNH QUÁI CỦA BẠN (1 ảnh tĩnh, IMAGE_MANIFEST trong main.js) — chân tại (x, y), quay mặt sang PHẢI
      c.save();
      c.translate(x, y);
      if (flip) c.scale(-1, 1);
      c.drawImage(img, (-img.width * s) / 2, -img.height * s, img.width * s, img.height * s);
      if (this.flash > 0) { c.globalAlpha = 0.6; c.globalCompositeOperation = "lighter"; c.drawImage(img, (-img.width * s) / 2, -img.height * s, img.width * s, img.height * s); }
      c.restore();
      return;
    }
    if (!this.sprite) return;
    const sheet = this.flash > 0 ? this.sprite.flash : this.freezeT > 0 ? this.sprite.frozen : this.sprite.sheet;
    sheet.draw(c, this.anim.col, this.anim.row, x, y, flip, s);
  }

  drawOverlay(c, game) {
    if (!game.camera.inView(this.x, this.y, 260)) return;
    // Mini-Boss gồng húc: vạch cảnh báo đường lướt
    if (this.state === "windup" && Math.floor(game.time * 16) % 2 === 0) {
      c.strokeStyle = withAlpha("#ff3bd1", 0.7); c.lineWidth = 2;
      c.beginPath(); c.moveTo(this.cx, this.cy); c.lineTo(this.cx + Math.cos(this.aimAngle) * 240, this.cy + Math.sin(this.aimAngle) * 240); c.stroke();
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
      const s = this.cfg.scale ?? 1, w = Math.round((this.radius + 3) * 2), h = Math.round(-this.cfg.bodyY * 1.6 * s + 6);
      const x = Math.round(this.x - w / 2), y = Math.round(this.y - this.z - h + 2);
      c.fillStyle = "rgba(150,225,255,0.30)"; c.fillRect(x, y, w, h);
      c.fillStyle = "rgba(220,248,255,0.85)"; c.fillRect(x, y, w, 1); c.fillRect(x, y, 1, h);
      c.fillStyle = "rgba(60,140,210,0.8)"; c.fillRect(x, y + h - 1, w, 1); c.fillRect(x + w - 1, y, 1, h);
      c.fillStyle = "#ffffff"; c.fillRect(x + 2, y + 2, 2, 1); c.fillRect(x + 2, y + 3, 1, 2);
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
  }

  drawShadow(c) {
    const x = Math.round(this.x), y = Math.round(this.y);
    if (this.z > 0 || this.cfg.flying) {
      c.fillStyle = "rgba(0,0,0,0.3)";
      const w = Math.round(this.radius * 1.2);
      c.fillRect(x - w / 2, y - 1, w, 2);
    }
  }

}

/**
 * Chọn loại quái theo thời gian sống sót (càng lâu càng nhiều loại khó).
 * Trả về tên loại trong ENEMY_TYPES.
 */
export function pickEnemyType(time) {
  const pool = [["slime", 10]];
  if (time > 8) pool.push(["bat", 6]);
  if (time > 20) pool.push(["bigSlime", 4]);
  if (time > 25) pool.push(["archer", 5]);
  if (time > 40) pool.push(["knight", 4]);
  if (time > 50) pool.push(["ghost", 3]);
  const total = pool.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [name, w] of pool) { if ((r -= w) <= 0) return name; }
  return "slime";
}

/** Object Pool của quái (tạo sẵn 64 con rỗng) */
Enemy.pool = new Pool(() => new Enemy(), 64);
Enemy.serial = 0;

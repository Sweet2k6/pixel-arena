// =====================================================================================
//  QUÁI VẬT CHIẾN THUẬT + MINI-BOSS
//
//  ai: "chase"     — lao thẳng theo người chơi (Slime, Slime khổng lồ, Ma)
//      "ranged"    — Cung Thủ Xương: giữ khoảng cách 280px, ngắm 0.8s (laser đỏ) rồi bắn tên
//      "tank"      — Hiệp Sĩ Khiên: chậm, khiên giảm 75% sát thương từ chính diện
//      "kamikaze"  — Dơi Cảm Tử: cực nhanh, áp sát thì nhấp nháy đỏ và nổ sau 0.6s
//      "boss"      — Mini-Boss: luân phiên bắn đạn 12 hướng và lướt húc
// =====================================================================================
import { createFx, hex } from "../../pixelfx-main/src/core/index.js";
import * as fxSlime from "../../pixelfx-main/src/fx/critters/slime.js";
import * as fxBat from "../../pixelfx-main/src/fx/critters/bat.js";
import * as fxGhost from "../../pixelfx-main/src/fx/critters/ghost.js";
import { makeActor, drawHero, ScaledAnim, painterFor } from "./actors.js";
import { EnemyBullet } from "./weapons.js";
import { angleDiff, rand, rndSeed, withAlpha, TAU } from "./util.js";

// Bảng màu quái hình người (A sáng nhất ... J tối nhất, m = mắt / điểm nhấn)
const SKELETON = { hat: "hood", accent: "#3a3040", palette: { A: "#f4f0e0", B: "#d8d2bc", C: "#b4ac94", D: "#8a826c", E: "#9c947c", F: "#6e6654", G: "#4c4638", J: "#36302a", m: "#ff3030" } };
const KNIGHT = { hat: "helm", accent: "#8492aa", palette: { A: "#e6ecf4", B: "#b4bfd0", C: "#8492aa", D: "#5c6680", E: "#6c7792", F: "#465068", G: "#323a50", J: "#232a3c", m: "#ffd34a" } };
const BOSS_PALETTE = ["#140a24", "#2c1450", "#4c2488", "#7a3cc8", "#a874f0", "#d8b8ff", "#ffffff"];

/** Chỉ số từng loại quái — chỉnh độ khó ở đây */
export const ENEMY_TYPES = {
  slime:    { name: "Slime Xanh",       kind: "critter", fx: fxSlime, fxOpts: { hop: 8 },   ai: "chase",    hp: 2,  speed: 38,  radius: 11, bodyY: -12, damage: 1, score: 10,  exp: 1, image: "enemySlime" },
  bigSlime: { name: "Slime Khổng Lồ",   kind: "critter", fx: fxSlime, fxOpts: { hop: 8 },   ai: "chase",    hp: 7,  speed: 27,  radius: 17, bodyY: -19, damage: 2, score: 30,  exp: 3, image: "enemySlime", scale: 1.6, split: "slime", frame: [64, 60, 32, 56] },
  bat:      { name: "Dơi Cảm Tử",       kind: "critter", fx: fxBat,   fxOpts: {},           ai: "kamikaze", hp: 1,  speed: 122, radius: 8,  bodyY: -8,  damage: 1, score: 15,  exp: 1, image: "enemyBat", flying: true, fuse: 0.6, armRange: 26, blast: 40, noContact: true },
  ghost:    { name: "Hồn Ma",           kind: "critter", fx: fxGhost, fxOpts: { hover: 6 }, ai: "chase",    hp: 4,  speed: 28,  radius: 11, bodyY: -18, damage: 2, score: 25,  exp: 2, image: "enemyGhost", flying: true },
  archer:   { name: "Cung Thủ Xương",   kind: "hero",    look: SKELETON,                    ai: "ranged",   hp: 3,  speed: 54,  radius: 8,  bodyY: -17, damage: 1, score: 20,  exp: 2, image: "enemyArcher", keep: 280, sight: 330, aimTime: 0.8, reload: 1.4, arrowSpeed: 340 },
  knight:   { name: "Hiệp Sĩ Khiên",    kind: "hero",    look: KNIGHT,                      ai: "tank",     hp: 10, speed: 24,  radius: 10, bodyY: -17, damage: 2, score: 35,  exp: 3, image: "enemyKnight", shieldArc: 1.05, shieldReduce: 0.75, turnRate: 1.8 },
  boss:     { name: "Mini-Boss Hồn Ma Tím", kind: "critter", fx: fxGhost, fxOpts: { hover: 6, palette: BOSS_PALETTE }, ai: "boss", hp: 90, speed: 40, radius: 24, bodyY: -40, damage: 2, score: 300, exp: 25, image: "enemyBoss", flying: true, scale: 2.2, frame: [60, 66, 30, 60] },
};

export class Enemy {
  /** opts: { elite: true } — quái Tinh Anh: x3 máu, viền vàng, rơi Rương Bạc */
  constructor(typeName, x, y, opts = {}) {
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

    if (t.kind === "hero") {
      this.actor = makeActor({ fallback: t.look });
      this.walk = Math.random() * 3;
    } else {
      this.anim = createFx(t.fx, { ...t.fxOpts, x, y, seed: rndSeed() });
      this.anim.update(Math.random() * (t.fx.meta.duration ?? 1));
      if (t.scale) this.scaled = new ScaledAnim(this.anim, ...t.frame);
    }
    if (this.boss) { this.state = "move"; this.stateTime = 2; this.volley = 0; }
  }

  get cx() { return this.x; }
  get cy() { return this.y + this.cfg.bodyY - this.z; }
  get canHurt() { return this.spawnTime <= 0 && !this.air && !this.cfg.noContact; }
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
    const moved = Math.hypot(this.x - bx, this.y - by);
    if (v > 0 && moved < v * dt * 0.3 && this.sideTime <= 0) { this.side = Math.random() < 0.5 ? 1 : -1; this.sideTime = 0.7; }
  }

  update(dt, game) {
    const p = game.player;
    this.spawnTime -= dt;
    this.flash -= dt;
    this.stateTime -= dt;
    const dx = p.cx - this.cx, dy = p.cy - this.cy;
    const d = Math.hypot(dx, dy) || 1;
    const ux = dx / d, uy = dy / d;
    // hiệu ứng trạng thái
    this.slowT = Math.max(0, this.slowT - dt);
    const speedMul = this.slowT > 0 ? (this.boss ? 0.75 : 0.5) : 1;
    this.speedMul = speedMul;
    if (this.burnT > 0) {
      this.burnT -= dt;
      this.burnTick -= dt;
      if (this.burnTick <= 0) { this.burnTick = 0.5; game.damageEnemy(this, 0.5, 0, 0, { quiet: true, pierce: true }); if (this.dead) return; }
    }

    if (this.air) {
      this.air.t += dt;
      const u = this.air.t / this.air.dur;
      this.z = Math.sin(Math.PI * Math.min(1, u)) * this.air.h;
      if (u >= 1) { this.air = null; this.z = 0; }
    } else {
      switch (this.cfg.ai) {
        case "chase": this.steer(game, ux, uy, this.cfg.speed * speedMul, dt); break;
        case "tank": {
          // quay khiên chậm về phía người chơi -> người chơi lướt vòng ra sau lưng được
          const want = Math.atan2(dy, dx), diff = angleDiff(want, this.facing), step = this.cfg.turnRate * dt;
          this.facing += Math.max(-step, Math.min(step, diff));
          this.steer(game, ux, uy, this.cfg.speed * speedMul, dt);
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

    if (this.anim) {
      this.anim.options.flip = dx < 0;
      this.anim.update(this.air ? dt * 2 : this.fuse >= 0 ? dt * 3 : dt);
    } else {
      this.walk += dt;
    }
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
        game.enemyBullets.push(new EnemyBullet(this.cx + Math.cos(this.aimAngle) * 8, this.cy + Math.sin(this.aimAngle) * 8, this.aimAngle, {
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
            game.enemyBullets.push(new EnemyBullet(this.cx + Math.cos(a) * 14, this.cy + Math.sin(a) * 14, a, { speed: 120, damage: 1, radius: 4, style: "orb", color: "#c48cff", life: 4 }));
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
        if (blocked && Math.hypot(this.x - before.x, this.y - before.y) < 1) { this.stateTime = 0; game.shake(0.25, 4); }
        if (this.stateTime <= 0) { this.state = "move"; this.stateTime = 1.8; }
        break;
      }
    }
  }

  // ---------- VẼ ----------
  /** Lớp pixelfx (fxFrame, tọa độ màn hình) — quái kích thước thường */
  drawPixels(game, frame, cam) {
    if (game.assets.images[this.cfg.image] || this.scaled) return;
    const sx = Math.round(this.x - cam.rx), sy = Math.round(this.y - this.z - cam.ry);
    if (sx < -40 || sx > cam.w + 40 || sy < -20 || sy > cam.h + 60) return;
    if (this.actor) {
      const bob = -Math.abs(Math.sin(this.walk * 10)) * (this.state === "aim" ? 0 : 1.5);
      const flip = Math.cos(this.facing) < 0;
      drawHero(painterFor(frame), this.actor, sx, sy + bob, flip, this.flash > 0 ? { tint: hex("#ffffff") } : {});
    } else {
      const o = this.anim.options;
      o.x = sx; o.y = sy;
      this.anim.draw(frame);
    }
  }

  /** Lớp canvas (tọa độ thế giới): ảnh riêng, quái phóng to, khiên, cung, hào quang, cảnh báo */
  drawSprite(c, game) {
    const img = game.assets.images[this.cfg.image];
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

    if (img) {
      // >>> ẢNH QUÁI CỦA BẠN được vẽ ở đây (chân tại this.x, this.y; quay mặt sang PHẢI)
      const s = this.cfg.scale ?? 1;
      c.save();
      c.translate(x, y);
      if (Math.cos(this.facing) < 0) c.scale(-1, 1);
      c.drawImage(img, (-img.width * s) / 2, -img.height * s, img.width * s, img.height * s);
      c.restore();
    } else if (this.scaled) {
      this.scaled.draw(c, x, y, this.cfg.scale, Math.cos(this.facing) < 0, this.flash > 0);
    }
  }

  /** Lớp phủ vẽ SAU thân quái (khiên, cung, laser ngắm, cảnh báo) — tọa độ thế giới */
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

  /** Chớp trắng 0.08s khi trúng đòn (quái critter kích thước thường) */
  drawFlash(c) {
    if (this.flash > 0 && this.anim && !this.scaled) {
      c.fillStyle = "rgba(255,255,255,0.7)";
      c.beginPath(); c.arc(this.cx, this.cy, this.radius + 1, 0, TAU); c.fill();
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

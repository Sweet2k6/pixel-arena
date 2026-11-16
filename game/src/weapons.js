// =====================================================================================
//  KHO VŨ KHÍ + ĐẠN
//
//  Vũ khí khởi đầu của 3 nhân vật nằm trong characters.js (type "gun" | "melee" | "magic").
//  File này thêm 4 vũ khí nhặt từ Rương: "shotgun" | "laser" | "grenade" | "sword".
//  Muốn chỉnh chỉ số (sát thương, tốc độ bắn...): sửa trong WEAPONS bên dưới.
// =====================================================================================
import { angleDiff, circleHit, pointSegDist, withAlpha, rand } from "./util.js";

export const WEAPONS = {
  shotgun: {
    id: "shotgun", name: "Shotgun Săn Quái", desc: "5 viên tỏa hình nón 30°, đẩy lùi cực mạnh ở tầm gần",
    type: "shotgun", rarity: "thường",
    damage: 2, fireRate: 0.72, pellets: 5, cone: (30 * Math.PI) / 180,
    bulletSpeed: 380, range: 150, bulletRadius: 2, knockback: 340,
    color: "#ffb347", sound: "shotgun",
  },
  laser: {
    id: "laser", name: "Súng Laser Xuyên Thấu", desc: "Tia năng lượng tức thì, xuyên qua mọi quái trên đường",
    type: "laser", rarity: "hiếm",
    damage: 3, fireRate: 0.42, range: 420, width: 3, knockback: 60,
    color: "#ff4ad8", sound: "laser",
  },
  grenade: {
    id: "grenade", name: "Súng Phóng Lựu", desc: "Cầu năng lượng nổ diện rộng bán kính 90px",
    type: "grenade", rarity: "hiếm",
    damage: 5, fireRate: 0.9, bulletSpeed: 230, range: 260, bulletRadius: 4, aoe: 90, knockback: 260,
    color: "#7cffb0", sound: "grenadeShoot",
  },
  sword: {
    id: "sword", name: "Kiếm Năng Lượng", desc: "Sóng kiếm khí bán nguyệt — chém rụng cả đạn của quái",
    type: "sword", rarity: "thường",
    damage: 3, fireRate: 0.36, range: 48, arc: Math.PI / 2, knockback: 240,
    color: "#7cd8ff", sound: "sword",
    slashPalette: ["#061a2e", "#0e3a66", "#1c6cb0", "#3aa8e8", "#7cd8ff", "#c8f2ff", "#ffffff"],
  },
  // ---------------- 5 vũ khí bổ sung (bản cập nhật 2) ----------------
  minigun: {
    id: "minigun", name: "Súng Máy Gatling", desc: "Giữ chuột để nòng quay nhanh dần — xả đạn như mưa",
    type: "minigun", rarity: "hiếm",
    damage: 0.6, fireRate: 0.055, spinUp: 1.1, bulletSpeed: 380, bulletRadius: 2, spread: 0.2, knockback: 50,
    color: "#ffd34a", sound: "shoot",
  },
  flamethrower: {
    id: "flamethrower", name: "Súng Phun Lửa", desc: "Luồng lửa xuyên qua quái, đốt cháy 1 sát thương/giây trong 3s",
    type: "flamethrower", rarity: "thường",
    damage: 0.3, fireRate: 0.05, bulletSpeed: 210, range: 95, knockback: 15, burn: 3,
    color: "#ff8a2a", sound: "flame",
  },
  frostbow: {
    id: "frostbow", name: "Cung Băng", desc: "Tên băng tốc độ cao xuyên 2 quái, làm chậm 50% trong 2.5s",
    type: "frostbow", rarity: "thường",
    damage: 3, fireRate: 0.5, bulletSpeed: 460, bulletRadius: 3, pierce: 2, slow: 2.5, knockback: 90,
    color: "#7cd8ff", sound: "arrow",
  },
  boomerang: {
    id: "boomerang", name: "Boomerang Hồi Quy", desc: "Bay ra 190px rồi quay về tay, cắt xuyên mọi quái trên đường",
    type: "boomerang", rarity: "thường",
    damage: 2, fireRate: 0.55, bulletSpeed: 300, range: 190, bulletRadius: 6, knockback: 140,
    color: "#e8b030", sound: "sword",
  },
  lightning: {
    id: "lightning", name: "Súng Sét Xích", desc: "Tia sét nhảy qua 4 quái liên tiếp, xuyên cả khiên",
    type: "lightning", rarity: "hiếm",
    damage: 2.2, fireRate: 0.42, range: 210, chains: 4, chainRange: 95, knockback: 40,
    color: "#a8e0ff", sound: "zap",
  },
};

/** Vũ khí thường (Rương Bạc) và vũ khí hiếm (Rương Vàng) */
export const COMMON_WEAPONS = ["shotgun", "sword", "laser", "grenade", "flamethrower", "frostbow", "boomerang", "minigun", "lightning"];
export const RARE_WEAPONS = ["laser", "grenade", "minigun", "lightning"];

/** Độ dài nòng (tính từ tâm thân) theo loại vũ khí */
export function muzzleLength(w) {
  return { magic: 22, shotgun: 19, laser: 19, grenade: 18, sword: 20, melee: 14, minigun: 20, flamethrower: 18, frostbow: 12, boomerang: 10, lightning: 18 }[w.type] ?? 16;
}

// =====================================================================================
//  HÌNH VẼ VŨ KHÍ (pixel) — gốc = tay cầm, nòng hướng sang PHẢI
// =====================================================================================
export function drawWeaponFallback(c, weapon) {
  const col = weapon.color;
  switch (weapon.type) {
    case "melee":           // găng tay sắt
      c.fillStyle = "#3a2a20"; c.fillRect(0, -3, 4, 6);
      c.fillStyle = "#8a8fa8"; c.fillRect(3, -4, 7, 8);
      c.fillStyle = "#c8cde0"; c.fillRect(4, -4, 5, 2);
      c.fillStyle = "#4a4e66"; c.fillRect(9, -3, 1, 6); c.fillRect(5, 0, 4, 1);
      c.fillStyle = col; c.fillRect(1, -3, 2, 6);
      break;
    case "magic":           // trượng năng lượng
      c.fillStyle = "#4a2f1c"; c.fillRect(-2, -1, 16, 2);
      c.fillStyle = "#7a5230"; c.fillRect(-2, -1, 16, 1);
      c.fillStyle = "#c8a24a"; c.fillRect(13, -3, 2, 6);
      c.fillStyle = col; c.fillRect(15, -2, 4, 4);
      c.fillStyle = "#ffffff"; c.fillRect(16, -1, 2, 2);
      c.fillStyle = withAlpha(col, 0.35); c.fillRect(14, -4, 6, 8);
      break;
    case "shotgun":         // shotgun nòng đôi, báng gỗ
      c.fillStyle = "#5a3418"; c.fillRect(-3, -1, 7, 4);
      c.fillStyle = "#8a5428"; c.fillRect(-3, -1, 7, 1);
      c.fillStyle = "#2b2b3a"; c.fillRect(3, -3, 15, 4);
      c.fillStyle = "#6c6c88"; c.fillRect(3, -3, 15, 1);
      c.fillStyle = "#1a1a24"; c.fillRect(17, -3, 1, 4); c.fillRect(5, 1, 4, 2);
      c.fillStyle = col; c.fillRect(9, 1, 5, 1);
      break;
    case "laser":           // súng laser: thân trắng, cuộn năng lượng hồng
      c.fillStyle = "#2b2b3a"; c.fillRect(0, -1, 4, 5);
      c.fillStyle = "#d8dcf0"; c.fillRect(2, -3, 14, 4);
      c.fillStyle = "#8a8fa8"; c.fillRect(2, 0, 14, 1);
      c.fillStyle = col; c.fillRect(5, -2, 2, 2); c.fillRect(9, -2, 2, 2); c.fillRect(16, -2, 2, 2);
      c.fillStyle = "#ffffff"; c.fillRect(17, -2, 1, 1);
      c.fillStyle = withAlpha(col, 0.35); c.fillRect(15, -4, 4, 6);
      break;
    case "grenade":         // ống phóng lựu ngắn, miệng rộng
      c.fillStyle = "#2a3a2a"; c.fillRect(0, -1, 5, 5);
      c.fillStyle = "#3e5a40"; c.fillRect(3, -4, 12, 7);
      c.fillStyle = "#6a8a6a"; c.fillRect(3, -4, 12, 1);
      c.fillStyle = "#1a241a"; c.fillRect(14, -4, 2, 7);
      c.fillStyle = col; c.fillRect(6, -2, 6, 1); c.fillRect(15, -2, 1, 3);
      break;
    case "sword":           // kiếm năng lượng: chuôi vàng, lưỡi phát sáng
      c.fillStyle = "#5a3418"; c.fillRect(-2, -1, 4, 2);
      c.fillStyle = "#e8b030"; c.fillRect(2, -4, 2, 8);
      c.fillStyle = withAlpha(col, 0.35); c.fillRect(4, -3, 19, 6);
      c.fillStyle = col; c.fillRect(4, -2, 18, 4);
      c.fillStyle = "#ffffff"; c.fillRect(4, -1, 17, 1); c.fillRect(22, -1, 1, 2);
      break;
    case "minigun":         // gatling 3 nòng
      c.fillStyle = "#2a2a36"; c.fillRect(-2, -1, 6, 6);
      c.fillStyle = "#4a4a5e"; c.fillRect(3, -4, 6, 8);
      c.fillStyle = "#8a8fa8"; c.fillRect(9, -4, 11, 2); c.fillRect(9, -1, 11, 2); c.fillRect(9, 2, 11, 2);
      c.fillStyle = "#c8cde0"; c.fillRect(9, -4, 11, 1);
      c.fillStyle = "#1a1a24"; c.fillRect(13, -4, 1, 8); c.fillRect(19, -4, 1, 8);
      c.fillStyle = col; c.fillRect(4, -3, 2, 2);
      break;
    case "flamethrower":    // bình nhiên liệu + vòi phun
      c.fillStyle = "#7c1a1e"; c.fillRect(-2, -3, 6, 7);
      c.fillStyle = "#b02a26"; c.fillRect(-2, -3, 6, 2);
      c.fillStyle = "#3a3a4a"; c.fillRect(4, -2, 11, 3);
      c.fillStyle = "#6c6c88"; c.fillRect(4, -2, 11, 1);
      c.fillStyle = "#2a2a36"; c.fillRect(15, -3, 3, 5);
      c.fillStyle = col; c.fillRect(17, -2, 1, 3);
      c.fillStyle = "#ffe26b"; c.fillRect(17, -1, 1, 1);
      break;
    case "frostbow":        // cung băng cong
      c.fillStyle = "#3a8bd8"; c.fillRect(6, -8, 2, 3); c.fillRect(7, -5, 2, 10); c.fillRect(6, 5, 2, 3);
      c.fillStyle = "#a6ecff"; c.fillRect(7, -8, 1, 16);
      c.fillStyle = "#e8f6ff"; c.fillRect(5, -7, 1, 14);
      c.fillStyle = "#5a3418"; c.fillRect(0, -1, 6, 2);
      c.fillStyle = col; c.fillRect(9, -1, 1, 2);
      break;
    case "boomerang":       // boomerang chữ V
      c.fillStyle = "#5a3418"; c.fillRect(0, 1, 6, 3); c.fillRect(4, -4, 3, 6); c.fillRect(6, -7, 3, 4);
      c.fillStyle = col; c.fillRect(0, 1, 6, 1); c.fillRect(4, -4, 1, 6); c.fillRect(6, -7, 1, 4);
      c.fillStyle = "#ffffff"; c.fillRect(7, -7, 1, 1);
      break;
    case "lightning":       // súng sét: cuộn dây đồng + đầu tesla
      c.fillStyle = "#2b2b3a"; c.fillRect(0, -1, 5, 5);
      c.fillStyle = "#3a3a4a"; c.fillRect(3, -3, 10, 5);
      c.fillStyle = "#c48412"; for (let i = 4; i < 13; i += 2) c.fillRect(i, -3, 1, 5);
      c.fillStyle = "#d8dcf0"; c.fillRect(13, -4, 4, 7);
      c.fillStyle = col; c.fillRect(17, -2, 1, 3); c.fillRect(14, -3, 2, 1);
      c.fillStyle = "#ffffff"; c.fillRect(15, -1, 1, 1);
      break;
    default:                // súng lục
      c.fillStyle = "#2b2b3a"; c.fillRect(0, -2, 13, 4);
      c.fillStyle = "#6c6c88"; c.fillRect(0, -2, 13, 1);
      c.fillStyle = "#2b2b3a"; c.fillRect(1, 1, 3, 4);
      c.fillStyle = col; c.fillRect(11, -2, 2, 1);
  }
}

/** Bề ngang hình vẽ thay thế [trái, phải] để căn giữa icon */
export function weaponSpan(w) {
  return { gun: [0, 13], melee: [0, 10], magic: [-2, 20], shotgun: [-3, 18], laser: [0, 19], grenade: [0, 16], sword: [-2, 23],
    minigun: [-2, 20], flamethrower: [-2, 18], frostbow: [0, 10], boomerang: [0, 10], lightning: [0, 18] }[w.type] ?? [0, 13];
}

// =====================================================================================
//  ĐẠN CỦA NGƯỜI CHƠI
// =====================================================================================
export class Bullet {
  /** opts: { speed, damage, radius, color, style, life, knock, bounces, explosive:{radius,damage} } */
  constructor(x, y, angle, opts) {
    this.x = x; this.y = y;
    this.angle = angle;
    this.vx = Math.cos(angle) * opts.speed;
    this.vy = Math.sin(angle) * opts.speed;
    this.radius = opts.radius ?? 3;
    this.damage = opts.damage ?? 1;
    this.color = opts.color ?? "#ffe26b";
    this.style = opts.style ?? "bullet";        // "bullet" | "orb" | "pellet" | "grenade" | "shard"
    this.life = opts.life ?? 2.2;               // giây tối đa (hết tầm bay)
    this.knock = opts.knock ?? 120;
    this.bounces = opts.bounces ?? 0;           // thẻ "Đạn Nảy Tường"
    this.explosive = opts.explosive ?? null;    // súng phóng lựu
    this.pierce = opts.pierce ?? 0;             // số quái xuyên qua thêm (Infinity = xuyên hết)
    this.hitSet = this.pierce ? new Set() : null;
    this.burn = opts.burn ?? 0;                 // giây đốt cháy khi trúng (Súng Phun Lửa)
    this.slow = opts.slow ?? 0;                 // giây làm chậm khi trúng (Cung Băng)
    this.ghostWalls = !!opts.ghostWalls;        // bay xuyên tường (Boomerang lúc quay về)
    this.boomerang = opts.boomerang ? { range: opts.boomerang, sx: x, sy: y, back: false, speed: opts.speed } : null;
    this.age = 0;
    this.dead = false;
  }

  /** Trúng 1 quái: trả về true nếu đạn tiếp tục bay (xuyên) */
  onHitEnemy(e, game) {
    if (this.burn) { e.burnT = Math.max(e.burnT ?? 0, this.burn); }
    if (this.slow) { e.slowT = Math.max(e.slowT ?? 0, this.slow); }
    if (!this.pierce) return false;
    this.hitSet.add(e);
    if (this.pierce !== Infinity) this.pierce--;
    return this.pierce > 0 || this.pierce === Infinity;
  }
  canHit(e) { return !this.hitSet || !this.hitSet.has(e); }

  /** Boomerang: bay ra hết tầm (hoặc chạm tường) thì quay về tay người chơi */
  updateBoomerang(dt, game) {
    const b = this.boomerang, p = game.player;
    if (!b.back && Math.hypot(this.x - b.sx, this.y - b.sy) >= b.range) this.turnBack();
    if (b.back) {
      const dx = p.cx - this.x, dy = p.cy - this.y, d = Math.hypot(dx, dy) || 1;
      const sp = b.speed * 1.15;
      this.vx += ((dx / d) * sp - this.vx) * Math.min(1, dt * 9);
      this.vy += ((dy / d) * sp - this.vy) * Math.min(1, dt * 9);
      if (d < 12) { this.dead = true; game.sound.play("catch", 0.3); }
    }
  }
  turnBack() {
    if (this.boomerang.back) return;
    this.boomerang.back = true;
    this.ghostWalls = true;
    this.hitSet?.clear();    // lượt về được chém trúng lại
  }

  update(dt, game) {
    this.age += dt;
    if (this.boomerang) this.updateBoomerang(dt, game);
    if (this.dead) return;
    const px = this.x, py = this.y;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.angle = this.boomerang ? this.angle + dt * 22 : this.angle;
    if (this.age >= this.life) { this.finish(game); return; }
    if (this.ghostWalls) return;

    const hit = game.world.bulletHit(this.x, this.y, this.radius);
    if (!hit) return;
    if (this.boomerang) {   // boomerang chạm vật cản: bật lại quay về
      if (hit.kind === "barrel") game.igniteBarrel(hit.obj);
      else if (hit.kind === "crystal") game.hitCrystal(hit.obj, this.damage, this.angle);
      this.x = px; this.y = py;
      this.turnBack();
      return;
    }
    if (hit.kind === "barrel") { game.igniteBarrel(hit.obj); this.finish(game); return; }
    if (hit.kind === "crystal") { game.hitCrystal(hit.obj, this.damage, this.angle); this.finish(game); return; }
    // tường / cột đá
    if (this.bounces > 0 && !this.explosive) {
      this.bounces--;
      // nảy: xem bị chặn theo trục nào thì đảo vận tốc trục đó
      const blockX = game.world.solidAt(this.x, py, this.radius);
      const blockY = game.world.solidAt(px, this.y, this.radius);
      if (blockX || !blockY) this.vx = -this.vx;
      if (blockY || !blockX) this.vy = -this.vy;
      this.x = px; this.y = py;
      this.angle = Math.atan2(this.vy, this.vx);
      game.fx.hit(this.x, this.y, this.angle + Math.PI);
      return;
    }
    this.x = px; this.y = py;
    this.finish(game);
  }

  /** Đạn kết thúc (chạm tường / hết tầm): lựu đạn thì phát nổ */
  finish(game) {
    if (this.dead) return;
    this.dead = true;
    if (this.explosive) game.explode(this.x, this.y, { radius: this.explosive.radius, damage: this.explosive.damage, knock: this.knock, source: "grenade" });
  }

  draw(c, game) {
    c.save();
    c.translate(Math.round(this.x), Math.round(this.y));
    if (this.style === "orb" || this.style === "grenade") {
      const r = this.radius + (Math.sin(this.age * 30) > 0 ? 1 : 0);
      c.fillStyle = withAlpha(this.color, 0.25); c.fillRect(-r - 2, -r - 2, (r + 2) * 2, (r + 2) * 2);
      c.fillStyle = this.color; c.fillRect(-r, -r + 1, r * 2, r * 2 - 2); c.fillRect(-r + 1, -r, r * 2 - 2, r * 2);
      c.fillStyle = "#ffffff"; c.fillRect(-1, -1, 2, 2);
      if (this.style === "grenade") { c.fillStyle = "#1a241a"; c.fillRect(-r, -1, r * 2, 1); }
    } else if (this.style === "pellet") {
      c.rotate(this.angle);
      c.fillStyle = withAlpha(this.color, 0.4); c.fillRect(-6, -1, 7, 2);
      c.fillStyle = "#ffffff"; c.fillRect(0, -1, 2, 2);
    } else if (this.style === "flame") {
      // hạt lửa: to dần, đổi màu trắng -> vàng -> cam -> đỏ -> khói
      const k = this.age / this.life, r = Math.round(2 + k * 6);
      const col = k < 0.15 ? "#fff3a6" : k < 0.4 ? "#ffc23d" : k < 0.65 ? "#ff8a2a" : k < 0.85 ? "#c9281f" : "#4a3f4a";
      c.globalAlpha = 1 - k * 0.6;
      c.fillStyle = col; c.fillRect(-r, -r + 1, r * 2, r * 2 - 2); c.fillRect(-r + 1, -r, r * 2 - 2, r * 2);
      if (k < 0.5) { c.fillStyle = "#ffffff"; c.fillRect(-1, -1, 2, 2); }
    } else if (this.style === "iceArrow") {
      c.rotate(this.angle);
      c.fillStyle = withAlpha("#7cd8ff", 0.35); c.fillRect(-12, -2, 12, 4);
      c.fillStyle = "#c8f2ff"; c.fillRect(-9, -0.5, 10, 1);
      c.fillStyle = "#ffffff"; c.fillRect(1, -1, 4, 2); c.fillRect(5, -0.5, 1, 1);
      c.fillStyle = "#3a8bd8"; c.fillRect(-10, -2, 2, 1); c.fillRect(-10, 1, 2, 1);
    } else if (this.style === "boomerang") {
      c.rotate(this.angle);
      c.fillStyle = "#3a1f10"; c.fillRect(-6, -2, 12, 4); c.fillRect(-2, -6, 4, 12);
      c.fillStyle = this.color; c.fillRect(-5, -1, 10, 2); c.fillRect(-1, -5, 2, 10);
      c.fillStyle = "#ffffff"; c.fillRect(-1, -1, 2, 2);
    } else if (this.style === "shard") {
      c.rotate(this.angle);
      c.fillStyle = "#a6ecff"; c.fillRect(-4, -1, 7, 2);
      c.fillStyle = "#ffffff"; c.fillRect(1, -1, 2, 1);
    } else {
      c.rotate(this.angle);
      const img = game.assets.images.bullet;
      if (img) {
        // >>> ẢNH ĐẠN CỦA BẠN được vẽ ở đây
        c.drawImage(img, -img.width / 2, -img.height / 2);
      } else {
        c.fillStyle = withAlpha(this.color, 0.35); c.fillRect(-9, -2, 12, 4);
        c.fillStyle = this.color; c.fillRect(-6, -1, 8, 2);
        c.fillStyle = "#ffffff"; c.fillRect(0, -1, 3, 2);
      }
    }
    c.restore();
  }
}

// =====================================================================================
//  ĐẠN CỦA QUÁI (tên của Cung Thủ Xương, cầu tím của Mini-Boss) — bị Kiếm Năng Lượng chém rụng
// =====================================================================================
export class EnemyBullet {
  constructor(x, y, angle, opts) {
    this.x = x; this.y = y; this.angle = angle;
    this.vx = Math.cos(angle) * opts.speed; this.vy = Math.sin(angle) * opts.speed;
    this.radius = opts.radius ?? 3;
    this.damage = opts.damage ?? 1;
    this.color = opts.color ?? "#ff5a5a";
    this.style = opts.style ?? "arrow";   // "arrow" | "orb"
    this.life = opts.life ?? 3;
    this.age = 0;
    this.dead = false;
  }
  update(dt, game) {
    this.age += dt;
    this.x += this.vx * dt; this.y += this.vy * dt;
    if (this.age >= this.life) { this.dead = true; return; }
    const hit = game.world.bulletHit(this.x, this.y, this.radius);
    if (hit) {
      this.dead = true;
      if (hit.kind === "barrel") game.igniteBarrel(hit.obj);
      else if (hit.kind === "crystal") game.hitCrystal(hit.obj, 1, this.angle);
    }
  }
  draw(c) {
    c.save();
    c.translate(Math.round(this.x), Math.round(this.y));
    if (this.style === "orb") {
      const r = this.radius + (Math.sin(this.age * 26) > 0 ? 1 : 0);
      c.fillStyle = withAlpha(this.color, 0.3); c.fillRect(-r - 2, -r - 2, (r + 2) * 2, (r + 2) * 2);
      c.fillStyle = this.color; c.fillRect(-r, -r + 1, r * 2, r * 2 - 2); c.fillRect(-r + 1, -r, r * 2 - 2, r * 2);
      c.fillStyle = "#ffffff"; c.fillRect(-1, -1, 2, 2);
    } else {
      c.rotate(this.angle);
      c.fillStyle = "#6a4a2a"; c.fillRect(-8, -0.5, 10, 1);      // thân tên
      c.fillStyle = "#e8e2d0"; c.fillRect(2, -1, 3, 2);           // mũi tên
      c.fillStyle = "#c83a3a"; c.fillRect(-9, -2, 2, 1); c.fillRect(-9, 1, 2, 1); // lông đuôi
    }
    c.restore();
  }
}

// =====================================================================================
//  BẮN THEO TỪNG LOẠI VŨ KHÍ — p = Player, w = vũ khí đang cầm
// =====================================================================================
/** Góc của các tia phụ (thẻ "Đạn Phân Tách"): 0, +a, -a, +2a ... */
function splitAngles(extra, step) {
  const out = [0];
  for (let i = 1; i <= extra; i++) out.push((i % 2 ? 1 : -1) * Math.ceil(i / 2) * step);
  return out;
}

export function fireWeapon(p, game, w) {
  const m = p.muzzle, mods = p.mods;
  const dmg = w.damage * mods.damageMul;
  const knock = (w.knockback ?? 120) * mods.knockMul;
  game.flashMuzzle(m.x, m.y, w.color, w.type === "shotgun" || w.type === "grenade" ? 7 : 4);
  game.noteWeaponUsed(w);
  game.sound.play(w.sound ?? "shoot", 0.4);

  switch (w.type) {
    case "shotgun": {
      p.recoil = 5;
      const n = w.pellets + mods.split;
      for (let i = 0; i < n; i++) {
        const a = p.aim - w.cone / 2 + (w.cone * i) / Math.max(1, n - 1) + rand(-0.03, 0.03);
        const speed = w.bulletSpeed * rand(0.9, 1.1);
        game.bullets.push(new Bullet(m.x, m.y, a, { speed, damage: dmg, radius: w.bulletRadius, color: w.color, style: "pellet", life: w.range / speed, knock, bounces: mods.bounce }));
      }
      game.fx.muzzleShotgun(m.x, m.y, p.aim);
      game.shake(0.14, 3);
      break;
    }
    case "laser": {
      p.recoil = 2;
      for (const off of splitAngles(mods.split, 0.12)) fireLaser(game, m.x, m.y, p.aim + off, w, dmg, knock);
      break;
    }
    case "grenade": {
      p.recoil = 5;
      for (const off of splitAngles(mods.split, 0.14)) {
        game.bullets.push(new Bullet(m.x, m.y, p.aim + off, {
          speed: w.bulletSpeed, damage: dmg, radius: w.bulletRadius, color: w.color, style: "grenade", life: w.range / w.bulletSpeed,
          knock, explosive: { radius: w.aoe, damage: dmg },
        }));
      }
      game.shake(0.12, 3);
      break;
    }
    case "flamethrower": {
      p.recoil = 1;
      for (const off of splitAngles(mods.split, 0.22)) {
        const a = p.aim + off + rand(-0.18, 0.18), speed = w.bulletSpeed * rand(0.85, 1.15);
        game.bullets.push(new Bullet(m.x, m.y, a, { speed, damage: dmg, radius: 4, color: w.color, style: "flame", life: w.range / speed, knock, pierce: Infinity, burn: w.burn }));
      }
      break;
    }
    case "frostbow": {
      p.recoil = 3;
      for (const off of splitAngles(mods.split, 0.1)) {
        game.bullets.push(new Bullet(m.x, m.y, p.aim + off, { speed: w.bulletSpeed, damage: dmg, radius: w.bulletRadius, color: w.color, style: "iceArrow", knock, pierce: w.pierce, slow: w.slow, bounces: mods.bounce }));
      }
      break;
    }
    case "boomerang": {
      p.recoil = -3;
      for (const off of splitAngles(mods.split, 0.3)) {
        game.bullets.push(new Bullet(m.x, m.y, p.aim + off, { speed: w.bulletSpeed, damage: dmg, radius: w.bulletRadius, color: w.color, style: "boomerang", life: 4, knock, pierce: Infinity, boomerang: w.range }));
      }
      break;
    }
    case "lightning": {
      p.recoil = 2;
      for (const off of splitAngles(mods.split, 0.35)) fireLightning(game, m.x, m.y, p.aim + off, w, dmg, knock);
      break;
    }
    default: {   // "gun" | "magic" | "minigun"
      p.recoil = w.type === "minigun" ? 2 : 3;
      if (w.type === "minigun") game.shake(0.04, 1);
      const spread = (Math.random() - 0.5) * (w.spread ?? 0.08);
      for (const off of splitAngles(mods.split, 0.1)) {
        game.bullets.push(new Bullet(m.x, m.y, p.aim + spread + off, {
          speed: w.bulletSpeed, damage: dmg, radius: w.bulletRadius, color: w.color, style: w.type === "magic" ? "orb" : "bullet",
          knock, bounces: mods.bounce,
        }));
      }
      if (w.type === "gun" || (w.type === "minigun" && Math.random() < 0.35)) game.fx.muzzle(m.x, m.y, p.aim);
    }
  }
}

/** Tia laser tức thì: xuyên mọi quái tới khi gặp tường / cột / tinh thể */
function fireLaser(game, x0, y0, angle, w, dmg, knock) {
  const x1 = x0 + Math.cos(angle) * w.range, y1 = y0 + Math.sin(angle) * w.range;
  const ray = game.world.raycast(x0, y0, x1, y1);
  const ex = x0 + (x1 - x0) * ray.t, ey = y0 + (y1 - y0) * ray.t;
  for (const e of game.enemies) {
    if (e.dead) continue;
    if (pointSegDist(e.cx, e.cy, x0, y0, ex, ey) <= e.radius + w.width) game.damageEnemy(e, dmg, angle, knock, { pierce: true });
  }
  for (const b of ray.barrels) game.igniteBarrel(b);
  if (ray.crystal) game.hitCrystal(ray.crystal, dmg, angle);
  game.beams.push({ x0, y0, x1: ex, y1: ey, life: 0.22, max: 0.22, color: w.color, width: w.width });
  game.fx.hit(ex, ey, angle);
}

/**
 * Súng Sét Xích: khóa quái gần nhất trong hình nón trước mặt rồi nhảy sang `chains` quái kế tiếp.
 * Sét là năng lượng nên xuyên khiên Hiệp Sĩ (pierce).
 */
function fireLightning(game, x0, y0, angle, w, dmg, knock) {
  let target = null, best = Infinity;
  for (const e of game.enemies) {
    if (e.dead) continue;
    const d = Math.hypot(e.cx - x0, e.cy - y0);
    if (d > w.range || Math.abs(angleDiff(Math.atan2(e.cy - y0, e.cx - x0), angle)) > 0.45) continue;
    if (!game.world.lineOfSight(x0, y0, e.cx, e.cy)) continue;
    const score = d + Math.abs(angleDiff(Math.atan2(e.cy - y0, e.cx - x0), angle)) * 120;
    if (score < best) { best = score; target = e; }
  }
  const pts = [[x0, y0]];
  if (!target) {   // không có mục tiêu: tia sét phóng thẳng tới vật cản
    const x1 = x0 + Math.cos(angle) * w.range * 0.7, y1 = y0 + Math.sin(angle) * w.range * 0.7;
    const ray = game.world.raycast(x0, y0, x1, y1);
    pts.push([x0 + (x1 - x0) * ray.t, y0 + (y1 - y0) * ray.t]);
    for (const b of ray.barrels) game.igniteBarrel(b);
  } else {
    const hit = new Set();
    let cur = target, k = 1;
    while (cur && hit.size <= w.chains) {
      hit.add(cur);
      pts.push([cur.cx, cur.cy]);
      game.damageEnemy(cur, dmg * k, Math.atan2(cur.cy - pts[pts.length - 2][1], cur.cx - pts[pts.length - 2][0]), knock, { pierce: true });
      k *= 0.85;   // mỗi lần nhảy yếu đi 15%
      let next = null, nd = w.chainRange;
      for (const e of game.enemies) {
        if (e.dead || hit.has(e)) continue;
        const d = Math.hypot(e.cx - cur.cx, e.cy - cur.cy);
        if (d < nd) { nd = d; next = e; }
      }
      cur = next;
    }
  }
  game.bolts.push({ pts: jaggedPath(pts), life: 0.18, max: 0.18, color: w.color });
}

/** Đường zigzag giữa các điểm (vẽ tia sét) */
function jaggedPath(pts) {
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
    const n = Math.max(2, Math.round(Math.hypot(bx - ax, by - ay) / 10));
    for (let j = 1; j < n; j++) {
      const t = j / n, jx = (Math.random() - 0.5) * 9, jy = (Math.random() - 0.5) * 9;
      out.push([ax + (bx - ax) * t + jx, ay + (by - ay) * t + jy]);
    }
    out.push([bx, by]);
  }
  return out;
}

/**
 * Đòn cận chiến (Găng Sắt & Kiếm Năng Lượng): trúng mọi quái trong bán kính + cung trước mặt.
 * Kiếm (w.type === "sword") còn chém rụng đạn quái trong vùng chém.
 */
export function meleeSwing(p, game, w) {
  const mods = p.mods;
  const dmg = w.damage * mods.damageMul, knock = (w.knockback ?? 170) * mods.knockMul;
  const sword = w.type === "sword";
  p.recoil = -5;
  game.noteWeaponUsed(w);
  game.fx.slash(p.cx, p.cy, p.aim, w.range * (sword ? 0.85 : 0.7), w.slashPalette);
  if (sword) game.waves.push({ x: p.cx, y: p.cy, a: p.aim, r: w.range, arc: w.arc, life: 0.18, max: 0.18, color: w.color });
  game.sound.play(w.sound ?? "punch", 0.5);
  for (const e of game.enemies) {
    if (e.dead) continue;
    const ex = e.cx - p.cx, ey = e.cy - p.cy;
    if (Math.hypot(ex, ey) > w.range + e.radius) continue;
    if (Math.abs(angleDiff(Math.atan2(ey, ex), p.aim)) <= w.arc) game.damageEnemy(e, dmg, p.aim, knock);
  }
  // đánh trúng thùng nổ / tinh thể trong tầm
  for (const b of game.world.barrels) if (!b.dead && Math.hypot(b.x - p.cx, b.y - 6 - p.cy) < w.range + b.r && Math.abs(angleDiff(Math.atan2(b.y - 6 - p.cy, b.x - p.cx), p.aim)) <= w.arc) game.igniteBarrel(b);
  for (const c of game.world.crystals) if (!c.dead && Math.hypot(c.x - p.cx, c.y - 8 - p.cy) < w.range + c.r && Math.abs(angleDiff(Math.atan2(c.y - 8 - p.cy, c.x - p.cx), p.aim)) <= w.arc) game.hitCrystal(c, dmg, p.aim);
  // >>> KIẾM CHÉM RỤNG ĐẠN
  if (sword) {
    let parried = 0;
    for (const b of game.enemyBullets) {
      if (b.dead) continue;
      const dx = b.x - p.cx, dy = b.y - p.cy;
      if (Math.hypot(dx, dy) > w.range + 10) continue;
      if (Math.abs(angleDiff(Math.atan2(dy, dx), p.aim)) > w.arc + 0.2) continue;
      b.dead = true;
      parried++;
      game.fx.parry(b.x, b.y);
    }
    if (parried) { game.sound.play("deflect", 0.5); game.hitStop(0.03); }
  }
}

/** Kiểm tra đạn quái có trúng người chơi */
export const enemyBulletHitsPlayer = (b, p) => circleHit(b.x, b.y, b.radius, p.cx, p.cy, p.radius);

/** Icon nhỏ cho thẻ / HUD: vẽ vũ khí vào giữa ô (w x h) */
export function drawWeaponIcon(g, weapon, x, y, w, h, scale = 1) {
  const span = weaponSpan(weapon);
  g.save();
  g.beginPath(); g.rect(x, y, w, h); g.clip();
  g.translate(Math.round(x + w / 2 - ((span[0] + span[1]) / 2) * scale), Math.round(y + h / 2));
  if (scale !== 1) g.scale(scale, scale);
  drawWeaponFallback(g, weapon);
  g.restore();
}


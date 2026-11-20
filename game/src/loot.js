// =====================================================================================
//  RƯƠNG BÁU + VẬT PHẨM RƠI + NGỌC KINH NGHIỆM (EXP)
//
//  Rương Gỗ  : Bình Máu (+2 HP) | Bình Giáp (+3 giáp) | Nam Châm (hút toàn bộ ngọc EXP)
//  Rương Bạc : vũ khí thường (15% ra vũ khí hiếm) | Thuốc Cuồng Nộ (+40% tốc bắn, +30% tốc chạy trong 8s)
//  Rương Vàng: vũ khí hiếm / HUYỀN THOẠI | +1 Máu tối đa & +1 Giáp tối đa vĩnh viễn (trong lượt chơi)
//  Tim Nhỏ   : quái thỉnh thoảng rơi ra, hồi 1 Máu
//  Vũ khí trên đất: lại gần bấm E để nhặt (2 khẩu giống nhau -> GHÉP lên ★)
//  Vàng & Ngọc Năng Lượng (Drop): quái / thùng gỗ / lọ năng lượng rơi ra, tự bay về khi lại gần
// =====================================================================================
import { WEAPONS, WEAPONS_BY_RARITY, WEAPON_RARITY, drawWeaponFallback, weaponSpan } from "./weapons.js";
import { pick, rand, withAlpha, TAU } from "./util.js";
import { Pool } from "./pool.js";

export const CHEST_TIERS = {
  wood:   { name: "Rương Gỗ",  body: "#73402c", dark: "#3a1f1f", band: "#925737", trim: "#b07246", glow: "#ffd28a", fx: ["#110a10", "#24131a", "#3a1f1f", "#552d24", "#73402c", "#925737", "#b07246"] },
  silver: { name: "Rương Bạc", body: "#6c7792", dark: "#323a50", band: "#b4bfd0", trim: "#e6ecf4", glow: "#c8e0ff", fx: ["#10141e", "#232a3c", "#323a50", "#465068", "#6c7792", "#8492aa", "#b4bfd0"] },
  gold:   { name: "Rương Vàng", body: "#c48412", dark: "#4a2c08", band: "#f0b424", trim: "#fff6c4", glow: "#ffe066", fx: ["#1e1206", "#4a2c08", "#86520c", "#c48412", "#f0b424", "#ffe066", "#fff6c4"] },
};

/** Tên & màu từng loại vật phẩm */
export const ITEMS = {
  potionHp:    { name: "Bình Máu +2",       color: "#ff3b4a" },
  potionArmor: { name: "Bình Giáp +3",      color: "#7fa2d8" },
  magnet:      { name: "Nam Châm",          color: "#ff5a5a" },
  rage:        { name: "Thuốc Cuồng Nộ",    color: "#ff8a2a" },
  maxUp:       { name: "+1 Máu & +1 Giáp tối đa", color: "#ffe26b" },
  heart:       { name: "Tim Nhỏ +1",        color: "#ff5a6a" },
  potionEnergy:{ name: "Bình Năng Lượng +60", color: "#4aa8ff" },
  weapon:      { name: "Vũ khí",            color: "#ffffff" },
};

/** Bốc 1 vũ khí theo bảng tỉ lệ độ hiếm, ví dụ { common: 60, rare: 30, epic: 10 } */
export function rollWeapon(table) {
  const entries = Object.entries(table).filter(([r, w]) => w > 0 && WEAPONS_BY_RARITY[r]?.length);
  let x = Math.random() * entries.reduce((s, [, w]) => s + w, 0);
  for (const [r, w] of entries) if ((x -= w) <= 0) return WEAPONS[pick(WEAPONS_BY_RARITY[r])];
  return WEAPONS[pick(WEAPONS_BY_RARITY[entries[0][0]])];
}
/** Tỉ lệ độ hiếm vũ khí theo loại rương */
export const CHEST_WEAPON_ODDS = {
  silver: { common: 55, rare: 35, epic: 10 },
  gold:   { rare: 30, epic: 45, legend: 22, mythic: 3 },
  boss:   { epic: 45, legend: 47, mythic: 8 },
};

/** Bốc thưởng cho 1 rương -> { kind, weapon? }. boss = rương vàng của Boss (vũ khí xịn hơn) */
export function rollChest(tier, boss = false) {
  if (tier === "wood") return { kind: pick(["potionHp", "potionHp", "potionArmor", "potionEnergy", "magnet"]) };
  if (tier === "silver") {
    if (Math.random() >= 0.7) return { kind: pick(["rage", "potionEnergy"]) };
    return { kind: "weapon", weapon: rollWeapon(CHEST_WEAPON_ODDS.silver) };
  }
  if (!boss && Math.random() >= 0.6) return { kind: "maxUp" };
  return { kind: "weapon", weapon: rollWeapon(boss ? CHEST_WEAPON_ODDS.boss : CHEST_WEAPON_ODDS.gold) };
}

export class Chest {
  constructor(x, y, tier) {
    this.x = x; this.y = y; this.tier = tier;
    this.cfg = CHEST_TIERS[tier];
    this.opened = false;
    this.age = 0;
    this.radius = 10;
    this.dead = false;
  }
  update(dt) { this.age += dt; }

  draw(c, time) {
    const x = Math.round(this.x), y = Math.round(this.y), C = this.cfg;
    // cột sáng khi vừa xuất hiện (2 giây đầu), sau đó ánh sáng nhẹ nhấp nháy
    if (this.age < 2) {
      const k = 1 - this.age / 2;
      c.fillStyle = withAlpha(C.glow.startsWith("#") ? C.glow : "#ffffff", 0.45 * k);
      c.fillRect(x - 6, y - 140 * (1 - k * 0.3), 12, 140 * (1 - k * 0.3));
      c.fillStyle = withAlpha("#ffffff", 0.6 * k);
      c.fillRect(x - 2, y - 140, 4, 140);
    }
    const pulse = 0.25 + 0.15 * Math.sin(time * 4 + this.x);
    c.fillStyle = withAlpha(C.glow, pulse);
    c.beginPath(); c.ellipse(x, y - 4, 16, 9, 0, 0, TAU); c.fill();
    const bob = Math.round(Math.sin(time * 3 + this.y) * 0.8);
    // thân rương 16x12
    c.fillStyle = "rgba(0,0,0,0.35)"; c.fillRect(x - 8, y - 1, 16, 3);
    c.fillStyle = "#0e0c14"; c.fillRect(x - 9, y - 14 + bob, 18, 14);
    c.fillStyle = C.body; c.fillRect(x - 8, y - 13 + bob, 16, 12);
    c.fillStyle = C.dark; c.fillRect(x - 8, y - 7 + bob, 16, 1);
    c.fillStyle = C.band; c.fillRect(x - 8, y - 13 + bob, 16, 2); c.fillRect(x - 5, y - 13 + bob, 2, 12); c.fillRect(x + 3, y - 13 + bob, 2, 12);
    c.fillStyle = C.trim; c.fillRect(x - 1, y - 9 + bob, 2, 3);
    c.fillStyle = "#ffffff"; c.fillRect(x - 7, y - 12 + bob, 2, 1);
  }
}

/** Vật phẩm nằm trên đất (bình thuốc, nam châm, vũ khí...) */
export class Pickup {
  /** kind: khóa trong ITEMS. weapon: định nghĩa vũ khí nếu kind === "weapon". blockedUntilLeave: vũ khí vừa thả */
  constructor(x, y, kind, weapon = null, opts = {}) {
    this.x = x; this.y = y; this.kind = kind; this.weapon = weapon;
    this.vx = opts.vx ?? rand(-40, 40); this.vy = opts.vy ?? rand(-40, 40);
    this.age = 0;
    this.radius = 8;
    this.dead = false;
    this.blockedUntilLeave = !!opts.blockedUntilLeave;
  }
  get label() { return this.kind === "weapon" ? (this.weapon.label ?? this.weapon.name) : ITEMS[this.kind].name; }
  get color() { return this.kind === "weapon" ? WEAPON_RARITY[this.weapon.rarity] ?? this.weapon.color : ITEMS[this.kind].color; }

  update(dt, game) {
    this.age += dt;
    if (this.vx || this.vy) {
      game.world.moveBody(this, this.vx * dt, this.vy * dt, 4, false);
      const k = Math.pow(0.02, dt);
      this.vx *= k; this.vy *= k;
      if (Math.abs(this.vx) < 2 && Math.abs(this.vy) < 2) this.vx = this.vy = 0;
    }
  }

  draw(c, time) {
    const x = Math.round(this.x), y = Math.round(this.y - 4 + Math.sin(time * 4 + this.x) * 1.5);
    c.fillStyle = "rgba(0,0,0,0.3)"; c.fillRect(x - 5, Math.round(this.y), 10, 2);
    const col = this.kind === "weapon" ? this.weapon.color : ITEMS[this.kind].color;
    c.fillStyle = withAlpha(col, 0.22 + 0.12 * Math.sin(time * 6));
    c.fillRect(x - 9, y - 9, 18, 14);
    // vũ khí từ Hiếm trở lên: cột sáng màu độ hiếm
    if (this.kind === "weapon" && this.weapon.rarity && this.weapon.rarity !== "common") {
      const rc = WEAPON_RARITY[this.weapon.rarity] ?? "#ffffff";
      c.fillStyle = withAlpha(rc, 0.18 + 0.1 * Math.sin(time * 5)); c.fillRect(x - 3, y - 40, 6, 36);
      c.fillStyle = withAlpha(rc, 0.4); c.fillRect(x - 1, y - 40, 2, 36);
    }
    switch (this.kind) {
      case "potionHp": case "potionArmor": case "rage": case "potionEnergy": {
        c.fillStyle = "#0e0c14"; c.fillRect(x - 4, y - 6, 8, 9); c.fillRect(x - 2, y - 9, 4, 3);
        c.fillStyle = "#e8e2f6"; c.fillRect(x - 1, y - 8, 2, 2);
        c.fillStyle = col; c.fillRect(x - 3, y - 4, 6, 6);
        c.fillStyle = "#ffffff"; c.fillRect(x - 2, y - 3, 1, 2);
        break;
      }
      case "magnet": {
        c.fillStyle = "#0e0c14"; c.fillRect(x - 6, y - 7, 12, 10);
        c.fillStyle = "#ff3b3b"; c.fillRect(x - 5, y - 6, 3, 6); c.fillRect(x + 2, y - 6, 3, 6); c.fillRect(x - 5, y - 1, 10, 3);
        c.fillStyle = "#e8e2f6"; c.fillRect(x - 5, y - 6, 3, 2); c.fillRect(x + 2, y - 6, 3, 2);
        break;
      }
      case "heart": {
        const b = Math.sin(time * 8) > 0 ? 1 : 0;
        c.fillStyle = "#0e0c14"; c.fillRect(x - 5, y - 6, 11, 7); c.fillRect(x - 3, y + 1, 7, 2); c.fillRect(x - 1, y + 3, 3, 1);
        c.fillStyle = "#ff3b4a"; c.fillRect(x - 4, y - 5 - b, 4, 3); c.fillRect(x + 1, y - 5 - b, 4, 3); c.fillRect(x - 4, y - 3 - b, 9, 3); c.fillRect(x - 2, y - b, 5, 2); c.fillRect(x, y + 2 - b, 1, 1);
        c.fillStyle = "#ffb0b8"; c.fillRect(x - 3, y - 4 - b, 1, 1);
        break;
      }
      case "maxUp": {
        c.fillStyle = "#ff3b4a"; c.fillRect(x - 6, y - 6, 3, 3); c.fillRect(x - 3, y - 6, 3, 3); c.fillRect(x - 6, y - 4, 6, 3); c.fillRect(x - 5, y - 1, 4, 2);
        c.fillStyle = "#7fa2d8"; c.fillRect(x + 1, y - 6, 6, 5); c.fillRect(x + 2, y - 1, 4, 2); c.fillRect(x + 3, y + 1, 2, 1);
        c.fillStyle = "#ffe26b"; c.fillRect(x - 1, y - 9, 2, 2);
        break;
      }
      case "weapon": {
        c.save();
        const span = weaponSpan(this.weapon);
        c.translate(x - Math.round((span[0] + span[1]) / 2), y - 2);
        drawWeaponFallback(c, this.weapon);
        c.restore();
        break;
      }
    }
  }
}

/** Ngọc kinh nghiệm xanh lam rơi từ quái */
export class ExpOrb {
  /** Lấy 1 ngọc từ Object Pool (mỗi quái chết rơi vài viên -> không `new` liên tục) */
  static obtain(x, y, value) { return ExpOrb.pool.obtain().init(x, y, value); }
  init(x, y, value) {
    this.x = x; this.y = y; this.value = value;
    const a = Math.random() * TAU, s = rand(30, 80);
    this.vx = Math.cos(a) * s; this.vy = Math.sin(a) * s;
    this.magnet = false;     // bị Nam Châm hút
    this.age = rand(0, 1);
    this.dead = false;
    return this;
  }
  update(dt, game) {
    this.age += dt;
    if (this.age > 16) this.magnet = true;   // ngọc nằm lâu tự bay về người chơi (không bị bỏ phí)
    const p = game.player;
    const dx = p.cx - this.x, dy = p.cy - this.y, d2 = dx * dx + dy * dy, R = p.pickupRange;
    if (this.magnet || d2 < R * R) {
      const d = Math.sqrt(d2) || 1;   // chỉ tính căn khi ngọc đang bị hút
      if (d < p.radius + 4) { this.dead = true; game.gainExp(this.value); return; }
      const sp = this.magnet ? 420 : 240 + (p.pickupRange - d) * 4;
      this.vx += ((dx / d) * sp - this.vx) * Math.min(1, dt * 10);
      this.vy += ((dy / d) * sp - this.vy) * Math.min(1, dt * 10);
    } else {
      const k = Math.pow(0.03, dt);
      this.vx *= k; this.vy *= k;
    }
    this.x += this.vx * dt; this.y += this.vy * dt;
  }
  draw(c) {
    const x = Math.round(this.x), y = Math.round(this.y + Math.sin(this.age * 6) * 1);
    const big = this.value >= 5;
    c.fillStyle = "rgba(80,170,255,0.3)"; c.fillRect(x - 3, y - 3, 6, 6);
    c.fillStyle = big ? "#7cf0ff" : "#3a8bff"; c.fillRect(x - 1, y - 2, 2, 4); c.fillRect(x - 2, y - 1, 4, 2);
    c.fillStyle = "#e0f6ff"; c.fillRect(x - 1, y - 1, 1, 1);
    if (big) { c.fillStyle = "#ffffff"; c.fillRect(x - 2, y - 3, 1, 1); }
  }
}

ExpOrb.pool = new Pool(() => new ExpOrb(), 128);

// =====================================================================================
//  VÀNG & NGỌC NĂNG LƯỢNG rơi ra — tự bay về người chơi khi lại gần (tầm hút lớn hơn ngọc EXP)
//    gold   : đồng vàng (value = số vàng) — tiêu ở Thương Nhân Bí Ẩn / Tượng Thần trong trận
//    energy : ngọc năng lượng xanh dương — hồi Năng Lượng (thanh xanh trên HUD)
// =====================================================================================
export class Drop {
  static obtain(x, y, kind, value) { return Drop.pool.obtain().init(x, y, kind, value); }
  init(x, y, kind, value) {
    this.x = x; this.y = y; this.kind = kind; this.value = value;
    const a = Math.random() * TAU, s = rand(40, 95);
    this.vx = Math.cos(a) * s; this.vy = Math.sin(a) * s;
    this.age = rand(0, 0.3); this.dead = false; this.magnet = false;
    return this;
  }
  update(dt, game) {
    this.age += dt;
    if (this.age > 14) this.magnet = true;
    const p = game.player, dx = p.cx - this.x, dy = p.cy + 6 - this.y, d2 = dx * dx + dy * dy, R = p.pickupRange + 26;
    if (this.age > 0.35 && (this.magnet || d2 < R * R)) {
      const d = Math.sqrt(d2) || 1;
      if (d < p.radius + 5) { this.dead = true; game.collectDrop(this); return; }
      const sp = this.magnet ? 440 : 260 + (R - d) * 4;
      this.vx += ((dx / d) * sp - this.vx) * Math.min(1, dt * 10);
      this.vy += ((dy / d) * sp - this.vy) * Math.min(1, dt * 10);
    } else {
      const k = Math.pow(0.02, dt);
      this.vx *= k; this.vy *= k;
    }
    this.x += this.vx * dt; this.y += this.vy * dt;
  }
  draw(c) {
    const x = Math.round(this.x), y = Math.round(this.y + Math.sin(this.age * 7) * 1);
    if (this.kind === "gold") {
      const big = this.value >= 5, spin = Math.floor(this.age * 8) % 4, w = spin === 1 || spin === 3 ? 2 : big ? 6 : 4;
      c.fillStyle = "rgba(0,0,0,0.3)"; c.fillRect(x - 2, Math.round(this.y) + 3, 5, 1);
      c.fillStyle = "#7a4a08"; c.fillRect(x - w / 2 - 1, y - (big ? 3 : 2), w + 2, big ? 7 : 5);
      c.fillStyle = "#ffd34a"; c.fillRect(x - w / 2, y - (big ? 3 : 2), w, big ? 6 : 4);
      c.fillStyle = "#fff6c4"; c.fillRect(x - w / 2, y - (big ? 3 : 2), 1, 1);
    } else {
      c.fillStyle = "rgba(74,168,255,0.3)"; c.fillRect(x - 3, y - 3, 7, 7);
      c.fillStyle = "#1c4aa8"; c.fillRect(x - 2, y - 2, 5, 5);
      c.fillStyle = "#4aa8ff"; c.fillRect(x - 1, y - 2, 3, 5); c.fillRect(x - 2, y - 1, 5, 3);
      c.fillStyle = "#e0f2ff"; c.fillRect(x, y - 1, 1, 1);
    }
  }
}
Drop.pool = new Pool(() => new Drop(), 128);

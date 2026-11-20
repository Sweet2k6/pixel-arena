// =====================================================================================
//  THƯƠNG NHÂN BÍ ẨN & TƯỢNG THẦN — xuất hiện trong trận, tiêu VÀNG (nhặt từ quái / thùng gỗ)
//
//  Thương Nhân: hiện ra cạnh bạn sau khi hạ BOSS (hết 1 đợt), ở lại tới khi Boss kế tiếp xuất hiện.
//               Lại gần bấm E để mở quầy: thuốc, bùa tạm thời, vũ khí hiếm.
//  Tượng Thần : sự kiện ngẫu nhiên giữa đợt. Bấm E để dâng Vàng cầu phúc (bùa mạnh 30 giây). Tối đa 2 lần.
//  Giá & hàng hóa: sửa SHOP_ITEMS / SHOP_WEAPON_PRICE / STATUE bên dưới.
// =====================================================================================
import { rollWeapon } from "./loot.js";
import { withAlpha, TAU } from "./util.js";

/** Hàng tiêu hao của Thương Nhân */
export const SHOP_ITEMS = {
  potionHp:     { name: "Bình Máu",        desc: "Hồi 2 Máu",                              price: 12, color: "#ff3b4a" },
  potionArmor:  { name: "Bình Giáp",       desc: "+3 Giáp ngay lập tức",                   price: 10, color: "#7fa2d8" },
  potionEnergy: { name: "Bình Năng Lượng", desc: "Hồi 80 Năng Lượng",                      price: 8,  color: "#4aa8ff" },
  buffPower:    { name: "Thuốc Sức Mạnh",  desc: "+40% sát thương trong 45 giây",          price: 22, color: "#ff6a4a", blessing: "power" },
  buffHaste:    { name: "Thuốc Gió Lốc",   desc: "+25% tốc chạy & tốc bắn trong 45 giây",  price: 20, color: "#5fdc8c", blessing: "haste" },
  maxHp:        { name: "Tim Rồng",        desc: "+1 Máu tối đa (cả trận)",               price: 45, color: "#ff7ad8" },
};
/** Giá vũ khí theo độ hiếm */
export const SHOP_WEAPON_PRICE = { rare: 30, epic: 55, legend: 95, mythic: 160 };
/** Tượng Thần: giá cầu phúc lần 1, lần 2 */
export const STATUE = { prices: [15, 30], buffTime: 30, life: 45 };

/** Tạo quầy hàng 4 món: 2 thuốc, 1 bùa, 1 vũ khí (đợt càng cao vũ khí càng xịn) */
export function makeStock(wave) {
  const pick = (arr) => arr.splice((Math.random() * arr.length) | 0, 1)[0];
  const potions = ["potionHp", "potionArmor", "potionEnergy"], buffs = ["buffPower", "buffHaste", "maxHp"];
  const out = [pick(potions), pick(potions), pick(buffs)].map((id) => ({ id, ...SHOP_ITEMS[id], sold: false }));
  const odds = wave >= 5 ? { epic: 45, legend: 45, mythic: 10 } : wave >= 3 ? { rare: 30, epic: 50, legend: 20 } : { rare: 60, epic: 40 };
  const w = rollWeapon(odds);
  out.push({ id: "weapon", weapon: w, name: w.name, desc: w.desc, price: SHOP_WEAPON_PRICE[w.rarity] ?? 50, color: w.color, sold: false });
  return out;
}

/** NPC đứng yên trong trận (vẽ theo trục Y cùng nhân vật & quái) */
class Npc {
  constructor(x, y) { this.x = x; this.y = y; this.t = 0; this.radius = 10; this.dead = false; this.spawnT = 0.6; }
  get cx() { return this.x; }
  get cy() { return this.y - 14; }
  update(dt) { this.t += dt; this.spawnT = Math.max(0, this.spawnT - dt); }
  drawOverlay() { /* lời nhắc vẽ ở main.js */ }
}

export class Merchant extends Npc {
  constructor(x, y, wave) {
    super(x, y);
    this.kind = "merchant";
    this.name = "Thương Nhân Bí Ẩn";
    this.stock = makeStock(wave);
  }
  draw(c, game) {
    const x = Math.round(this.x), y = Math.round(this.y), t = this.t, bob = Math.round(Math.sin(t * 2.2));
    if (this.spawnT > 0 && Math.floor(t * 20) % 2) return;
    c.fillStyle = "rgba(0,0,0,0.35)"; c.beginPath(); c.ellipse(x, y, 10, 3, 0, 0, TAU); c.fill();
    // ba lô to sau lưng
    c.fillStyle = "#1a0f08"; c.fillRect(x + 1, y - 22 + bob, 12, 16);
    c.fillStyle = "#7a4a22"; c.fillRect(x + 2, y - 21 + bob, 10, 14);
    c.fillStyle = "#a8743a"; c.fillRect(x + 2, y - 21 + bob, 10, 2); c.fillRect(x + 6, y - 19 + bob, 1, 12);
    c.fillStyle = "#c83a3a"; c.fillRect(x + 9, y - 25 + bob, 3, 4);   // cuộn vải đỏ
    c.fillStyle = "#5ec8ff"; c.fillRect(x + 3, y - 24 + bob, 2, 3);    // chai thuốc
    // áo choàng
    c.fillStyle = "#120a1a"; c.fillRect(x - 7, y - 20 + bob, 13, 20 - bob);
    c.fillStyle = "#3a2458"; c.fillRect(x - 6, y - 19 + bob, 11, 19 - bob);
    c.fillStyle = "#56347e"; c.fillRect(x - 6, y - 19 + bob, 3, 19 - bob);
    c.fillStyle = "#ffd34a"; c.fillRect(x - 6, y - 8 + bob, 11, 1);   // đai lưng
    // mũ trùm + mặt tối, mắt phát sáng
    c.fillStyle = "#120a1a"; c.fillRect(x - 6, y - 29 + bob, 11, 11);
    c.fillStyle = "#4a2e6a"; c.fillRect(x - 5, y - 28 + bob, 9, 9); c.fillRect(x - 3, y - 30 + bob, 5, 2);
    c.fillStyle = "#0a0610"; c.fillRect(x - 4, y - 25 + bob, 7, 5);
    const blink = Math.floor(t * 0.7) % 6 === 0 && (t % 1.43) < 0.12;
    if (!blink) { c.fillStyle = "#ffe26b"; c.fillRect(x - 3, y - 23 + bob, 1, 1); c.fillRect(x + 1, y - 23 + bob, 1, 1); }
    // gậy + đèn lồng
    c.fillStyle = "#5a3418"; c.fillRect(x - 10, y - 30, 1, 30);
    c.fillStyle = "#1a1424"; c.fillRect(x - 12, y - 30, 5, 6);
    c.fillStyle = Math.sin(t * 9) > -0.4 ? "#ffd25e" : "#ffb04a"; c.fillRect(x - 11, y - 29, 3, 4);
    // túi vàng lơ lửng phía trên
    const gy = y - 40 + Math.round(Math.sin(t * 3) * 2);
    c.fillStyle = "#7a4a08"; c.fillRect(x - 3, gy, 7, 6);
    c.fillStyle = "#ffd34a"; c.fillRect(x - 2, gy + 1, 5, 4);
    c.fillStyle = "#fff6c4"; c.fillRect(x - 1, gy + 1, 1, 1);
    c.fillStyle = "#3a2410"; c.font = "bold 7px monospace"; c.textAlign = "center"; c.textBaseline = "top";
    c.fillText("$", x + 1, gy - 1); c.textAlign = "left";
    void game;
  }
}

export class GodStatue extends Npc {
  constructor(x, y) {
    super(x, y);
    this.kind = "statue";
    this.name = "Tượng Thần Cổ";
    this.uses = 0;
    this.life = STATUE.life;
  }
  get price() { return STATUE.prices[this.uses] ?? null; }
  update(dt) { super.update(dt); this.life -= dt; if (this.life <= 0) this.dead = true; }
  draw(c) {
    const x = Math.round(this.x), y = Math.round(this.y), t = this.t, live = this.price !== null;
    if (this.spawnT > 0 && Math.floor(t * 20) % 2) return;
    if (this.life < 4 && Math.floor(t * 10) % 2) return;   // sắp biến mất: nhấp nháy
    if (live) { c.fillStyle = withAlpha("#ffe26b", 0.18 + 0.1 * Math.sin(t * 3)); c.beginPath(); c.ellipse(x, y - 2, 20, 8, 0, 0, TAU); c.fill(); }
    // bệ đá
    c.fillStyle = "#1a1822"; c.fillRect(x - 11, y - 8, 22, 9);
    c.fillStyle = "#6a6e78"; c.fillRect(x - 10, y - 7, 20, 7);
    c.fillStyle = "#8a8e98"; c.fillRect(x - 10, y - 7, 20, 2);
    c.fillStyle = "#4a4e58"; c.fillRect(x - 10, y - 2, 20, 1);
    // tượng người cầu nguyện
    c.fillStyle = "#1a1822"; c.fillRect(x - 6, y - 30, 12, 23);
    c.fillStyle = "#9a9ea8"; c.fillRect(x - 5, y - 22, 10, 14);
    c.fillStyle = "#b8bcc8"; c.fillRect(x - 5, y - 22, 3, 14);
    c.fillStyle = "#a8acb6"; c.fillRect(x - 3, y - 29, 6, 7);
    c.fillStyle = "#c8ccd8"; c.fillRect(x - 3, y - 29, 2, 2);
    c.fillStyle = "#7a7e88"; c.fillRect(x - 1, y - 20, 2, 5);   // tay chắp
    // vầng hào quang
    const hc = live ? "#ffe26b" : "#5a5a6a";
    c.strokeStyle = withAlpha(hc, live ? 0.6 + 0.3 * Math.sin(t * 4) : 0.4); c.lineWidth = 1;
    c.beginPath(); c.ellipse(x, y - 32, 6, 2, 0, 0, TAU); c.stroke();
    if (live) for (let i = 0; i < 3; i++) {
      const u = (t * 0.6 + i / 3) % 1;
      c.fillStyle = withAlpha("#fff2a8", 1 - u);
      c.fillRect(Math.round(x - 8 + i * 8), Math.round(y - 10 - u * 26), 1, 2);
    }
  }
}

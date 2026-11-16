// =====================================================================================
//  HUD — vẽ trên TỌA ĐỘ MÀN HÌNH (không theo camera)
//  Thanh EXP sát mép trên · 2 ô vũ khí · Minimap góc dưới phải · Mũi tên chỉ hướng · Thanh máu Boss
// =====================================================================================
import { WORLD } from "./world.js";
import { drawWeaponIcon } from "./weapons.js";
import { clamp, withAlpha, TAU } from "./util.js";

/** Minimap: tỉ lệ 2400x1600 -> 80x53 pixel game (= 160x106 pixel màn hình ở mức phóng x2) */
export const MINIMAP = { w: 80, h: 53, margin: 4 };

export function text(ctx, s, x, y, color) {
  ctx.fillStyle = "#000";
  ctx.fillText(s, x + 1, y + 1);
  ctx.fillStyle = color;
  ctx.fillText(s, x, y);
}

export function drawBar(ctx, x, y, w, h, k, color, light, label) {
  ctx.fillStyle = "#000"; ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = "#2a2338"; ctx.fillRect(x, y, w, h);
  const fw = Math.round(w * clamp(k, 0, 1));
  ctx.fillStyle = color; ctx.fillRect(x, y, fw, h);
  ctx.fillStyle = light; ctx.fillRect(x, y, fw, Math.min(2, h));
  if (label) {
    ctx.textAlign = "center";
    text(ctx, label, x + w / 2, y + 1, "#ffffff");
    ctx.textAlign = "left";
  }
}

export function drawHeart(ctx, x, y, full) {
  const rows = [".XX.XX.", "XXXXXXX", "XXXXXXX", ".XXXXX.", "..XXX..", "...X..."];
  ctx.fillStyle = full ? "#ff3b4a" : "#3a2a3a";
  rows.forEach((r, j) => [...r].forEach((ch, i) => ch === "X" && ctx.fillRect(x + i, y + j, 1, 1)));
  if (full) { ctx.fillStyle = "#ffb0b8"; ctx.fillRect(x + 1, y + 1, 1, 1); }
}

export function drawShield(ctx, x, y) {
  const rows = ["XXXXXXX", "XoooooX", "XoooooX", "XoooooX", ".XoooX.", "..XoX..", "...X..."];
  rows.forEach((r, j) => [...r].forEach((ch, i) => {
    if (ch === ".") return;
    ctx.fillStyle = ch === "X" ? "#c4d6f4" : "#6f8fc8";
    ctx.fillRect(x + i, y + j, 1, 1);
  }));
}

/** Khung viền vàng kim kiểu HUD gốc */
export function panel(ctx, x, y, w, h, border = "#4a4066") {
  ctx.fillStyle = "rgba(12,10,20,0.78)";
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = border;
  ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y + h - 1, w, 1); ctx.fillRect(x, y, 1, h); ctx.fillRect(x + w - 1, y, 1, h);
}

/** Thanh EXP mảnh sát mép trên màn hình */
export function drawExpBar(ctx, W, exp, need, level) {
  ctx.fillStyle = "#0a0810"; ctx.fillRect(0, 0, W, 3);
  ctx.fillStyle = "#1c3a6a"; ctx.fillRect(0, 0, W, 2);
  const fw = Math.round(W * clamp(exp / need, 0, 1));
  ctx.fillStyle = "#3a8bff"; ctx.fillRect(0, 0, fw, 2);
  ctx.fillStyle = "#a8dcff"; ctx.fillRect(0, 0, fw, 1);
  if (fw > 0) { ctx.fillStyle = "#ffffff"; ctx.fillRect(fw - 1, 0, 1, 2); }
}

/** 2 ô vũ khí dưới thanh Máu/Giáp/Kỹ năng. Ô đang cầm có viền vàng. */
export function drawWeaponSlots(ctx, x, y, p, time) {
  for (let i = 0; i < 2; i++) {
    const w = p.weapons[i], active = i === p.slot, sy = y + i * 14;
    panel(ctx, x, sy, 126, 13, active ? (Math.sin(time * 6) > -0.6 ? "#ffe26b" : "#c8a83a") : "#4a4066");
    ctx.font = "7px monospace"; ctx.textBaseline = "top";
    text(ctx, String(i + 1), x + 3, sy + 3, active ? "#ffe26b" : "#6a628a");
    if (!w) { text(ctx, "— trống —", x + 38, sy + 3, "#5a5278"); continue; }
    ctx.fillStyle = "#15111f"; ctx.fillRect(x + 10, sy + 2, 26, 9);
    drawWeaponIcon(ctx, w, x + 10, sy + 2, 26, 9, 1);
    text(ctx, w.name, x + 39, sy + 3, active ? "#ffffff" : "#8a82a8");
  }
  ctx.font = "8px monospace";
}

/** Chỉ báo Lướt (Shift) — thanh hồi chiêu nhỏ */
export function drawDashPip(ctx, x, y, p) {
  const k = 1 - p.rollCd / p.rollCdMax;
  ctx.font = "7px monospace"; ctx.textBaseline = "top";
  text(ctx, "SHIFT LƯỚT", x, y, k >= 1 ? "#5fdc8c" : "#6a628a");
  ctx.fillStyle = "#000"; ctx.fillRect(x + 45, y + 2, 32, 4);
  ctx.fillStyle = "#2a2338"; ctx.fillRect(x + 46, y + 3, 30, 2);
  ctx.fillStyle = k >= 1 ? "#5fdc8c" : "#3a7a54"; ctx.fillRect(x + 46, y + 3, Math.round(30 * clamp(k, 0, 1)), 2);
  ctx.font = "8px monospace";
}

/** Bản đồ thu nhỏ bán trong suốt ở góc dưới bên phải */
export function drawMinimap(ctx, W, H, game) {
  const M = MINIMAP, x = W - M.w - M.margin, y = H - M.h - M.margin;
  const sx = M.w / WORLD.w, sy = M.h / WORLD.h;
  ctx.save();
  ctx.globalAlpha = 0.78;
  ctx.fillStyle = "#000"; ctx.fillRect(x - 2, y - 2, M.w + 4, M.h + 4);
  ctx.drawImage(game.minimap, x, y);
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#c8a83a";
  ctx.fillRect(x - 2, y - 2, M.w + 4, 1); ctx.fillRect(x - 2, y + M.h + 1, M.w + 4, 1);
  ctx.fillRect(x - 2, y - 2, 1, M.h + 4); ctx.fillRect(x + M.w + 1, y - 2, 1, M.h + 4);
  // khung camera
  const cam = game.camera;
  ctx.strokeStyle = "rgba(255,255,255,0.45)"; ctx.lineWidth = 1;
  ctx.strokeRect(Math.round(x + cam.x * sx) + 0.5, Math.round(y + cam.y * sy) + 0.5, Math.round(cam.w * sx), Math.round(cam.h * sy));
  // Rương báu: chấm vàng (nhấp nháy)
  for (const c of game.chests) {
    if (c.opened) continue;
    ctx.fillStyle = Math.sin(game.time * 8) > -0.3 ? "#ffe26b" : "#c8892a";
    ctx.fillRect(Math.round(x + c.x * sx) - 1, Math.round(y + c.y * sy) - 1, 3, 3);
  }
  // Quái: chấm đỏ, Mini-Boss: chấm tím lớn
  for (const e of game.enemies) {
    if (e.boss) continue;
    ctx.fillStyle = e.elite ? "#ff9a3a" : "#ff3b3b";
    ctx.fillRect(Math.round(x + e.x * sx), Math.round(y + e.y * sy), e.elite ? 2 : 1, e.elite ? 2 : 1);
  }
  for (const e of game.enemies) {
    if (!e.boss) continue;
    ctx.fillStyle = "#1a0a2a"; ctx.fillRect(Math.round(x + e.x * sx) - 3, Math.round(y + e.y * sy) - 3, 6, 6);
    ctx.fillStyle = "#c048ff"; ctx.fillRect(Math.round(x + e.x * sx) - 2, Math.round(y + e.y * sy) - 2, 4, 4);
  }
  // Người chơi: chấm xanh lá
  const p = game.player;
  ctx.fillStyle = "#0a2a10"; ctx.fillRect(Math.round(x + p.x * sx) - 2, Math.round(y + p.y * sy) - 2, 4, 4);
  ctx.fillStyle = "#5fff7a"; ctx.fillRect(Math.round(x + p.x * sx) - 1, Math.round(y + p.y * sy) - 1, 2, 2);
  ctx.restore();
}

/** Mũi tên ở mép màn hình chỉ tới Rương / Mini-Boss nằm ngoài khung hình */
export function drawOffscreenIndicators(ctx, W, H, game) {
  const cam = game.camera;
  const targets = [];
  for (const c of game.chests) if (!c.opened) targets.push({ x: c.x, y: c.y - 6, color: "#ffe26b", big: c.tier === "gold" });
  for (const e of game.enemies) if (e.boss) targets.push({ x: e.cx, y: e.cy, color: "#c048ff", big: true });
  const cx = W / 2, cy = H / 2, m = 10;
  for (const t of targets) {
    const sx = t.x - cam.x, sy = t.y - cam.y;
    if (sx >= 0 && sx <= W && sy >= 0 && sy <= H) continue;
    const dx = sx - cx, dy = sy - cy;
    const k = Math.min((W / 2 - m) / Math.abs(dx || 1e-6), (H / 2 - m) / Math.abs(dy || 1e-6));
    const ax = cx + dx * k, ay = cy + dy * k, a = Math.atan2(dy, dx);
    const s = (t.big ? 6 : 5) + (Math.sin(game.time * 8) > 0 ? 1 : 0);
    ctx.save();
    ctx.translate(Math.round(ax), Math.round(ay));
    ctx.rotate(a);
    ctx.fillStyle = "#000";
    ctx.beginPath(); ctx.moveTo(s + 1, 0); ctx.lineTo(-s, -s); ctx.lineTo(-s * 0.4, 0); ctx.lineTo(-s, s); ctx.closePath(); ctx.fill();
    ctx.fillStyle = t.color;
    ctx.beginPath(); ctx.moveTo(s, 0); ctx.lineTo(-s + 1, -s + 1.5); ctx.lineTo(-s * 0.4, 0); ctx.lineTo(-s + 1, s - 1.5); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
}

/** Thanh máu lớn của Mini-Boss ở cạnh trên màn hình */
export function drawBossBar(ctx, W, boss, time) {
  const w = 200, x = Math.round(W / 2 - w / 2), y = 14;
  panel(ctx, x - 4, y - 4, w + 8, 20, "#7a3cc8");
  ctx.font = "8px monospace"; ctx.textBaseline = "top"; ctx.textAlign = "center";
  text(ctx, boss.cfg.name, W / 2, y - 2, "#e0c8ff");
  ctx.textAlign = "left";
  drawBar(ctx, x, y + 8, w, 5, boss.hp / boss.maxHp, Math.sin(time * 10) > 0.8 ? "#ff7ad8" : "#c048ff", "#e8b0ff", "");
}

/** Dòng chữ thông báo giữa màn hình (Mini-Boss xuất hiện, nhặt đồ...) */
export function drawBanners(ctx, W, H, banners) {
  let y = 52;
  ctx.textAlign = "center"; ctx.textBaseline = "top";
  for (const b of banners) {
    const a = clamp(b.life / 0.4, 0, 1);
    ctx.globalAlpha = a;
    ctx.font = b.big ? "bold 14px monospace" : "9px monospace";
    text(ctx, b.text, W / 2, y, b.color);
    y += b.big ? 18 : 12;
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = "left";
  ctx.font = "8px monospace";
}

/** Vòng tròn mờ thể hiện vùng nổ (game feel) */
export function drawShockwaves(ctx, waves) {
  for (const s of waves) {
    const k = 1 - s.life / s.max;
    ctx.strokeStyle = withAlpha(s.color, (1 - k) * 0.8);
    ctx.lineWidth = Math.max(1, 3 * (1 - k));
    ctx.beginPath(); ctx.arc(Math.round(s.x), Math.round(s.y), s.r * (0.3 + 0.7 * k), 0, TAU); ctx.stroke();
  }
}

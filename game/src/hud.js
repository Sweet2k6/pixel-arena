// =====================================================================================
//  HUD — vẽ trên TỌA ĐỘ MÀN HÌNH (không theo camera)
//  Thanh EXP sát mép trên · 2 ô vũ khí · Minimap góc dưới phải · Mũi tên chỉ hướng · Thanh máu Boss
// =====================================================================================
import { WORLD } from "./world.js";
import { drawWeaponIcon, WEAPON_RARITY, mergeResult, ammoLabel } from "./weapons.js";
import { clamp, withAlpha, TAU } from "./util.js";

/** Minimap: rộng 80 pixel game, cao tự tính theo tỉ lệ bản đồ (2400x1600 -> 80x53 · 3200x2240 -> 80x56) */
export const MINIMAP = { w: 80, h: 53, margin: 4 };

/** >>> THANH MÁU / GIÁP / NĂNG LƯỢNG HIỂN THỊ THEO %: 4/4 -> "100%", 3/4 -> "75%" */
export function pct(v, max) { return `${max > 0 ? Math.max(0, Math.round((v / max) * 100)) : 0}%`; }

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

/** Tia sét nhỏ (biểu tượng Năng Lượng) */
export function drawBolt(ctx, x, y) {
  const rows = ["..XX", ".XX.", "XXXX", ".XX.", "XX..", "X..."];
  ctx.fillStyle = "#7cc8ff";
  rows.forEach((r, j) => [...r].forEach((ch, i) => ch === "X" && ctx.fillRect(x + i, y + j, 1, 1)));
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
    const lab = w.label ?? w.name, cost = w.cost ?? 0, ammo = ammoLabel(w);
    const max = ammo ? 13 : cost ? 16 : 22;
    text(ctx, lab.length > max ? lab.slice(0, max - 1) + "…" : lab, x + 39, sy + 3, active ? (WEAPON_RARITY[w.rarity] ?? "#ffffff") : "#8a82a8");
    if (ammo) {   // súng thật: số đạn trong băng / đang nạp
      const reloading = w.reloadT > 0, empty = !reloading && w.ammo <= Math.max(1, Math.floor(w.mag * 0.2));
      ctx.textAlign = "right"; text(ctx, ammo, x + 123, sy + 3, reloading ? "#ffb030" : empty ? "#ff7a5a" : "#e8e2f6"); ctx.textAlign = "left";
      if (reloading && w.reload) { ctx.fillStyle = "#ffb030"; ctx.fillRect(x + 39, sy + 11, Math.round(84 * (1 - w.reloadT / w.reload)), 1); }
    } else if (cost) {   // năng lượng mỗi phát — tính theo % thanh năng lượng
      const pc = (cost / p.maxEnergy) * 100;
      const str = `${pc < 1 ? pc.toFixed(1).replace(/^0/, "") : Math.round(pc)}%`, tw = Math.ceil(ctx.measureText(str).width);
      ctx.textAlign = "right"; text(ctx, str, x + 123, sy + 3, p.energy >= cost ? "#7cc8ff" : "#ff5a5a"); ctx.textAlign = "left";
      drawBolt(ctx, x + 118 - tw, sy + 3);
    }
    ctx.fillStyle = WEAPON_RARITY[w.rarity] ?? "#5a5278"; ctx.fillRect(x + 10, sy + 11, 26, 1);   // vạch màu độ hiếm
  }
  // 2 ô ghép được: viền nhấp nháy nối 2 ô
  if (mergeResult(p.weapons[0], p.weapons[1]) && Math.floor(time * 4) % 2 === 0) { ctx.fillStyle = "#ffe26b"; ctx.fillRect(x + 125, y + 4, 2, 20); }
  ctx.font = "8px monospace";
}

/** Chỉ báo Lướt (Shift) — thanh hồi chiêu nhỏ */
export function drawDashPip(ctx, x, y, p, label = "SHIFT LƯỚT") {
  const k = 1 - p.rollCd / p.rollCdMax;
  ctx.font = "7px monospace"; ctx.textBaseline = "top";
  text(ctx, label, x, y, k >= 1 ? "#5fdc8c" : "#6a628a");
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
  // Đền thờ: chấm xanh lam (sáng khi sẵn sàng)
  for (const s of game.world.shrines) {
    ctx.fillStyle = s.cool > 0 ? "#3a4a6a" : "#7cf0ff";
    ctx.fillRect(Math.round(x + s.x * sx) - 1, Math.round(y + s.y * sy) - 1, 2, 2);
  }
  // Rương báu: chấm vàng (nhấp nháy)
  for (const c of game.chests) {
    if (c.opened) continue;
    ctx.fillStyle = Math.sin(game.time * 8) > -0.3 ? "#ffe26b" : "#c8892a";
    ctx.fillRect(Math.round(x + c.x * sx) - 1, Math.round(y + c.y * sy) - 1, 3, 3);
  }
  // Rút Quân: nhiệm vụ, bãi đáp, hòm đồ ở gần
  game.run?.drawMinimap(ctx, x, y, sx, sy, game.time);
  // Quái: chấm đỏ, Mini-Boss: chấm tím lớn (Rút Quân: chỉ hiện zombie trong tầm radar quanh người chơi)
  const P = game.player, radar = game.run ? (game.radar ?? 520) : Infinity, R2 = radar * radar;
  for (const e of game.enemies) {
    if (e.boss) continue;
    if (radar !== Infinity && (e.x - P.x) ** 2 + (e.y - P.y) ** 2 > R2) continue;
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
export function drawBossBar(ctx, W, boss, time, y = 14) {
  const w = 200, x = Math.round(W / 2 - w / 2);
  panel(ctx, x - 4, y - 4, w + 8, 20, boss.cfg.aura ?? "#7a3cc8");
  ctx.font = "8px monospace"; ctx.textBaseline = "top"; ctx.textAlign = "center";
  text(ctx, boss.cfg.name, W / 2, y - 2, "#e0c8ff");
  ctx.textAlign = "left";
  drawBar(ctx, x, y + 8, w, 5, boss.hp / boss.maxHp, Math.sin(time * 10) > 0.8 ? "#ff7ad8" : "#c048ff", "#e8b0ff", "");
  if (boss.hp < boss.maxHp * 0.5) { ctx.fillStyle = "#ff3b3b"; ctx.fillRect(x + w - 2, y + 8, 2, 5); }   // nửa máu: Boss nổi điên
}

/** Dòng chữ thông báo giữa màn hình (Mini-Boss xuất hiện, nhặt đồ...) */
export function drawBanners(ctx, W, H, banners, y = 52, maxW = W - 12, backdrop = false) {
  ctx.textAlign = "center"; ctx.textBaseline = "top";
  for (const b of banners) {
    const a = clamp(b.life / 0.4, 0, 1);
    ctx.globalAlpha = a;
    const size = b.big ? 14 : 9;
    ctx.font = b.big ? `bold ${size}px monospace` : `${size}px monospace`;
    const w = ctx.measureText(b.text).width;
    if (w > maxW) ctx.font = `${b.big ? "bold " : ""}${Math.max(7, Math.floor(size * maxW / w))}px monospace`;   // chữ dài: tự thu nhỏ cho vừa
    if (backdrop) {   // dải nền mờ cho dễ đọc giữa trận
      const tw = Math.min(maxW, w) + 10, th = b.big ? 16 : 11;
      ctx.fillStyle = `rgba(8,6,14,${0.55 * a})`; ctx.fillRect(Math.round(W / 2 - tw / 2), y - 2, Math.round(tw), th);
    }
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

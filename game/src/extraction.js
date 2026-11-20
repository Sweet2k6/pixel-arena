// =====================================================================================
//  VÁN ĐẤU NHẢY DÙ – NHIỆM VỤ – RÚT QUÂN (Extraction Survival)
//
//  Vòng đời 1 ván (ExtractionRun.phase):
//    "tacmap"  — bản đồ chiến thuật: chọn Điểm Nhảy Dù (src/deploy.js -> TacticalMap)
//    "airdrop" — máy bay bay ngang, nhân vật bung dù rơi xuống, tiếp đất có sóng xung kích (src/deploy.js -> AirDrop)
//    "play"    — đồng hồ đếm ngược (5/7/10 phút) chạy. Làm nhiệm vụ (src/missions.js), lục Hòm Tiếp Tế / Túi Y Tế (E),
//                dùng đồ trong Túi Chiến Thuật (Z X C V). Hết giờ: VÙNG ĐỘC + KHÔNG KÍCH bao trùm bản đồ.
//    "flare"   — đã bắn PHÁO SÁNG ở Điểm Rút Quân: đếm ngược 15 giây, đợt zombie cuối cùng ùa vào bãi đáp
//    "heli"    — trực thăng hạ cánh, chạy vào bãi đáp để lên máy bay -> RÚT QUÂN THÀNH CÔNG
//    "done"    — đã có kết quả (thành công / tử trận), main.js hiện bảng tổng kết
//  Chỉnh thông số: EXTRACT bên dưới. Chèn ảnh riêng: EXTRACT_IMAGES.
// =====================================================================================
import { ITEM_DEFS, BAG_SLOTS, drawItemIcon } from "./stash.js";
import { MissionManager } from "./missions.js";
import { TacticalMap, AirDrop } from "./deploy.js";
import { WEAPONS, isMelee } from "./weapons.js";
import { Pickup, Drop, rollWeapon } from "./loot.js";
import { text as hudText, panel as hudPanel } from "./hud.js";
import { withAlpha, TAU, rand, randInt, clamp } from "./util.js";

/** >>> THÔNG SỐ CHẾ ĐỘ RÚT QUÂN <<< */
export const EXTRACT = {
  durations: [5, 7, 10],          // phút / ván (chọn trước trận)
  squads: { 5: 18, 7: 22, 10: 26 },   // số đàn zombie tuần tra lúc đầu ván
  bossAt: { 5: [0.5], 7: [0.45], 10: [0.4, 0.75] },   // Zombie Đột Biến Khổng Lồ xuất hiện khi đã trôi qua x% thời gian
  padRadius: 46,                  // bán kính bãi đáp rút quân (px)
  flareTime: 15,                  // giây chờ trực thăng sau khi bắn pháo sáng
  finalWaves: [0, 5, 10],         // giây (tính từ lúc bắn pháo sáng) mỗi lần 1 đàn zombie ùa vào bãi đáp
  heliArrive: 2.6,                // giây trực thăng bay tới & hạ cánh
  searchTime: 0.8,                // giây lục 1 hòm / túi
  gas: { tick: 3.2, damage: 1, strikeEvery: 2.2 },   // sau khi hết giờ: -1 máu mỗi 3.2s + không kích
  goldPerGem: 8,                  // rút quân thành công: 8 Vàng nhặt được = 1 Ngọc
  maxMines: 4,
  radar: 520,                     // minimap chỉ hiện zombie trong bán kính này (px)
};

/**
 * >>> CHÈN ẢNH CỦA BẠN (để "" = game tự vẽ pixel art bằng code). Đường dẫn tính từ thư mục game/
 *     Mọi ảnh vẽ với chân / đáy ảnh chạm mặt đất tại vị trí vật thể, quay mặt sang PHẢI.
 */
export const EXTRACT_IMAGES = {
  "x:airplane": "",     // MÁY BAY thả dù (nhìn từ trên xuống, mũi sang PHẢI) ~110x100px — ví dụ "assets/images/extract/airplane.png"
  "x:parachute": "",    // DÙ (tán dù, dây treo hướng xuống) ~32x24px            — ví dụ "assets/images/extract/parachute.png"
  "x:helicopter": "",   // TRỰC THĂNG rút quân (nhìn ngang, mũi sang PHẢI) ~72x34px — ví dụ "assets/images/extract/helicopter.png"
  "x:crate": "",        // HÒM TIẾP TẾ (chưa mở) ~18x14px                         — ví dụ "assets/images/extract/crate.png"
  "x:crateOpen": "",    // HÒM TIẾP TẾ (đã mở)                                      — ví dụ "assets/images/extract/crate-open.png"
  "x:medbag": "",       // TÚI Y TẾ (chưa mở) ~14x11px                            — ví dụ "assets/images/extract/medbag.png"
  "x:medbagOpen": "",   // TÚI Y TẾ (đã mở)
  "x:flare": "",        // PHÁO SÁNG cắm đất (khói xanh tự vẽ thêm) ~6x12px         — ví dụ "assets/images/extract/flare.png"
  "x:survivor": "",     // NGƯỜI SỐNG SÓT (mặc định dùng ngoại hình nhân vật khác)   — ví dụ "assets/images/extract/survivor.png"
  "x:hive": "",         // KÉN Ổ DỊCH ~40x36px                                     — ví dụ "assets/images/extract/hive.png"
  "x:tower": "",        // TRẠM PHÁT SÓNG ~24x60px                                 — ví dụ "assets/images/extract/tower.png"
};

/** Đồ trong Hòm Tiếp Tế / Túi Y Tế: trả về [[id, số lượng], ...] */
const LOOT = {
  medbag() {
    const out = [["medkit", Math.random() < 0.25 ? 2 : 1]];
    if (Math.random() < 0.35) out.push(["energyCell", 1]);
    if (Math.random() < 0.15) out.push(["stim", 1]);
    return out;
  },
  crate() {
    const out = [];
    if (Math.random() < 0.55) out.push(["grenade", Math.random() < 0.3 ? 2 : 1]);
    if (Math.random() < 0.28) out.push(["mine", 1]);
    if (Math.random() < 0.35) out.push(["energyCell", 1]);
    if (Math.random() < 0.18) out.push(["stim", 1]);
    if (Math.random() < 0.12) out.push(["medkit", 1]);
    return out;
  },
};
/** Tỉ lệ độ hiếm súng trong Hòm Tiếp Tế */
const CRATE_WEAPON = { chance: 0.42, odds: { common: 46, rare: 34, epic: 15, legend: 5 } };

export class ExtractionRun {
  /** opts: { minutes, kit: { slots, weapon }, stash, progress } */
  constructor(game, opts) {
    this.game = game;
    this.stash = opts.stash;
    this.progress = opts.progress;
    this.minutes = opts.minutes;
    this.duration = opts.minutes * 60;
    this.timeLeft = this.duration;
    this.phase = "tacmap";
    this.t = 0;                                   // giây đã chơi (tính từ lúc tiếp đất)
    this.bag = Array.from({ length: BAG_SLOTS }, (_, i) => (opts.kit.slots[i] ? { ...opts.kit.slots[i] } : null));
    this.kitWeapon = opts.kit.weapon;             // súng mang từ Kho (mất nếu tử trận)
    this.backpack = {};                           // đồ nhặt được nhưng túi đã đầy -> vẫn mang về khi rút quân
    this.looted = 0; this.used = 0; this.opened = 0;
    this.spots = (game.world.lootSpots ?? []).map((s) => ({ x: s.x, y: s.y, kind: s.kind, opened: false, search: 0, glow: Math.random() * 6 }));
    this.mines = []; this.throws = []; this.smoke = [];
    this.pad = null; this.padOpen = false; this.emergency = false;
    this.flare = null; this.heli = null; this.boarded = false;
    this.gas = false; this.gasT = 0; this.strikeT = 0;
    this.warned = {};
    this.bossPlan = [...(EXTRACT.bossAt[this.minutes] ?? [0.5])];
    this.searching = null;
    this.result = null;
    this.missions = new MissionManager(game, this, this.minutes);
    this.populate();
    this.tacmap = new TacticalMap(game, this);
    this.airdrop = null;
  }

  get playing() { return this.phase === "play" || this.phase === "flare" || this.phase === "heli"; }
  get elapsed() { return this.duration - this.timeLeft; }

  /** Rải các đàn zombie tuần tra khắp bản đồ */
  populate() {
    const g = this.game, H = g.horde, pts = [...(g.world.squadSpawns ?? [])];
    if (!H) return;
    let n = (EXTRACT.squads[this.minutes] ?? 22) + (g.diffIndex === 2 ? 4 : g.diffIndex === 0 ? -4 : 0);
    for (let i = pts.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [pts[i], pts[j]] = [pts[j], pts[i]]; }
    for (const s of pts) { if (n-- <= 0) break; H.spawnSquad(s.x, s.y, { state: "patrol", zone: s.zone }); }
    while (n-- > 0) {   // bản đồ thiếu điểm: rải ngẫu nhiên
      const p = g.world.randomFreePoint({ margin: 30 });
      if (p) H.spawnSquad(p.x, p.y, { state: "patrol", zone: g.world.zoneAt?.(p.x, p.y)?.id });
    }
  }

  // ---------------------------------------------------------------- CHUYỂN GIAI ĐOẠN
  /** Bản đồ chiến thuật đã chọn xong điểm nhảy -> bắt đầu thả dù */
  beginAirdrop(lz) {
    const g = this.game, p = g.player;
    this.lz = lz;
    p.x = lz.x; p.y = lz.y; p.vx = p.vy = p.kx = p.ky = 0;
    g.camera.snap(p.x, p.cy);
    this.phase = "airdrop";
    this.airdrop = new AirDrop(g, lz);
    g.sound.setMusic("music");
  }
  /** Tiếp đất: bắt đầu tính giờ */
  landed() {
    const g = this.game;
    this.phase = "play";
    this.airdrop = null;
    g.banner("ĐÃ TIẾP ĐẤT — NHIỆM VỤ BẮT ĐẦU", "#5fdc8c", true, 2.8);
    g.banner(`${this.missions.list.length} nhiệm vụ · rút quân sau khi xong ít nhất 1 · ${fmt(this.timeLeft)}`, "#e8e2f6", false, 3.4);
  }

  // ---------------------------------------------------------------- CẬP NHẬT (mỗi frame, chỉ khi phase là play/flare/heli)
  update(dt) {
    const g = this.game, p = g.player;
    this.t += dt;
    if (this.phase !== "done") this.timeLeft = Math.max(0, this.timeLeft - dt);
    // cảnh báo thời gian
    for (const [s, msg] of [[120, "CÒN 2 PHÚT — chuẩn bị rút quân!"], [60, "CÒN 60 GIÂY!"], [30, "CÒN 30 GIÂY — VÙNG ĐỘC SẮP LAN RỘNG!"]]) {
      if (this.timeLeft <= s && !this.warned[s] && this.duration > s + 10) { this.warned[s] = true; g.banner(msg, s <= 30 ? "#ff5a5a" : "#ffb030", true, 2.6); g.sound.play("bossWarn", 0.4); }
    }
    if (this.timeLeft <= 0 && !this.gas) this.startGas();
    // Boss đột biến theo lịch
    if (this.bossPlan.length && this.elapsed >= this.bossPlan[0] * this.duration) { this.bossPlan.shift(); g.spawnZombieBoss?.(); }

    this.missions.update(dt);
    if (!this.padOpen && this.missions.doneCount >= 1) this.openExtraction(false);

    this.updateSearch(dt);
    this.updateThrows(dt);
    this.updateMines(dt);
    this.updateSmoke(dt);
    if (this.gas) this.updateGas(dt);
    if (this.flare) this.updateFlare(dt);
    if (this.heli) this.updateHeli(dt);
  }

  // ---------------------------------------------------------------- HÒM TIẾP TẾ / TÚI Y TẾ
  updateSearch(dt) {
    const S = this.searching, p = this.game.player;
    if (!S) return;
    if ((S.x - p.x) ** 2 + (S.y - p.y) ** 2 > 34 * 34 || p.hp <= 0) { this.searching = null; return; }
    S.search += dt;
    if (S.search >= EXTRACT.searchTime) { this.searching = null; this.openSpot(S); }
  }
  openSpot(s) {
    const g = this.game;
    s.opened = true; this.opened++;
    g.sound.play("chestOpen", 0.5);
    g.fx.chestOpen?.(s.x, s.y, s.kind === "crate" ? "wood" : "silver");
    const got = LOOT[s.kind]();
    for (const [id, n] of got) this.addLoot(id, n);
    if (s.kind === "crate") {
      for (let i = 0; i < randInt(2, 5); i++) g.drops.push(Drop.obtain(s.x, s.y - 6, "gold", 1));
      if (Math.random() < CRATE_WEAPON.chance) {
        const w = pickFirearm(CRATE_WEAPON.odds);
        if (w) { g.pickups.push(new Pickup(s.x, s.y + 8, "weapon", w, { vx: rand(-25, 25), vy: 45 })); g.banner(`Trong hòm có súng: ${w.name} — bấm E để nhặt`, "#ffe26b", false, 2.6); }
      }
    }
    if (!got.length && s.kind === "crate") g.banner("Hòm trống trơn...", "#8a82a8");
  }

  /** Nhận 1 món: ưu tiên ô túi cùng loại còn chỗ -> ô trống -> ba lô chiến lợi phẩm */
  addLoot(id, n = 1, quietBanner = false) {
    const def = ITEM_DEFS[id];
    if (!def || n <= 0) return;
    let left = n;
    for (const s of this.bag) if (left > 0 && s && s.id === id && s.n < def.stack) { const k = Math.min(left, def.stack - s.n); s.n += k; left -= k; }
    for (let i = 0; i < this.bag.length && left > 0; i++) if (!this.bag[i]) { const k = Math.min(left, def.stack); this.bag[i] = { id, n: k }; left -= k; }
    if (left > 0) this.backpack[id] = (this.backpack[id] ?? 0) + left;
    this.looted += n;
    if (!quietBanner) this.game.banner(`+${n} ${def.name}${left > 0 ? " (vào ba lô)" : ""}`, def.color, false, 1.8);
    this.game.sound.play("pickup", 0.4);
  }

  // ---------------------------------------------------------------- DÙNG ĐỒ TRONG TÚI (Z X C V)
  useSlot(i) {
    const g = this.game, p = g.player, s = this.bag[i];
    if (!this.playing || !s || p.hp <= 0 || this.boarded) { if (!s) g.sound.play("skillDenied", 0.3); return; }
    const def = ITEM_DEFS[s.id];
    let ok = true;
    switch (s.id) {
      case "medkit":
        if (p.hp >= p.maxHp) { g.banner("Máu đang đầy 100%", "#ffb030", false, 1.2); ok = false; break; }
        g.healPlayer(Math.max(1, Math.ceil(p.maxHp * def.heal)));
        break;
      case "energyCell": {
        if (p.energy >= p.maxEnergy && p.armor >= p.maxArmor && p.skillCd <= 0) { g.banner("Năng lượng, giáp và kỹ năng đều đầy", "#ffb030", false, 1.2); ok = false; break; }
        p.energy = Math.min(p.maxEnergy, p.energy + p.maxEnergy * def.energy); p.energyFlash = 0.5;
        p.armor = Math.min(p.maxArmor, p.armor + Math.ceil(p.maxArmor * def.armor)); p.armorFlash = 0.5;
        p.skillCd *= 1 - def.cdCut;
        g.fx.healRing?.(p.x, p.y + 2, 0.4);
        break;
      }
      case "grenade": {
        const aim = g.aimTarget(p), dx = aim.x - p.x, dy = aim.y - p.y, d = Math.hypot(dx, dy) || 1, r = Math.min(def.range, d);
        this.throws.push({ x0: p.cx, y0: p.cy, x1: p.x + (dx / d) * r, y1: p.y + (dy / d) * r, t: 0, dur: 0.42 + r / 900, def });
        g.sound.play("swap", 0.5);
        break;
      }
      case "mine":
        if (this.mines.length >= EXTRACT.maxMines) { g.banner(`Tối đa ${EXTRACT.maxMines} mìn cùng lúc`, "#ffb030", false, 1.2); ok = false; break; }
        this.mines.push({ x: p.x, y: p.y + 2, t: 0, def });
        g.sound.play("search", 0.5);
        break;
      case "stim":
        p.frenzy = def.time;
        g.screenFlash("#ff8a2a", 0.2);
        break;
    }
    if (!ok) { g.sound.play("skillDenied", 0.3); return; }
    if (--s.n <= 0) this.bag[i] = null;
    this.used++;
    g.sound.play("useItem", 0.6);
    g.banner(`Dùng: ${def.name}`, def.color, false, 1.2);
  }

  updateThrows(dt) {
    const g = this.game;
    for (const T of this.throws) {
      T.t += dt;
      if (T.t >= T.dur && !T.dead) {
        T.dead = true;
        g.explode(T.x1, T.y1, { radius: T.def.radius, damage: T.def.damage, knock: 320, source: "frag" });
      }
    }
    this.throws = this.throws.filter((T) => !T.dead);
  }
  updateMines(dt) {
    const g = this.game;
    for (const m of this.mines) {
      m.t += dt;
      if (m.t < 0.8 || m.dead) continue;   // 0.8s để kích hoạt
      for (const e of g.enemiesNear(m.x, m.y, 20)) {
        if (e.dead || e.cfg.flying || e.cfg.hive || (e.x - m.x) ** 2 + (e.y - m.y) ** 2 > (14 + e.radius) ** 2) continue;
        m.dead = true;
        g.explode(m.x, m.y - 4, { radius: m.def.radius, damage: m.def.damage, knock: 360, source: "mine", hurtPlayer: true, playerRadius: 34, playerDamage: 1 });
        break;
      }
    }
    this.mines = this.mines.filter((m) => !m.dead);
  }

  // ---------------------------------------------------------------- RÚT QUÂN
  /** Mở Điểm Rút Quân: chọn bãi đáp cách người chơi vừa phải (không quá gần, không quá xa) */
  openExtraction(emergency) {
    const g = this.game, p = g.player, pads = g.world.extractPads?.length ? g.world.extractPads : [g.world.randomFreePoint({ margin: 60 }) ?? { x: p.x + 300, y: p.y }];
    let best = pads[0], bs = Infinity;
    for (const q of pads) { const d = Math.hypot(q.x - p.x, q.y - p.y), score = Math.abs(d - 900); if (score < bs) { bs = score; best = q; } }
    this.pad = { x: best.x, y: best.y };
    this.padOpen = true; this.emergency = emergency;
    g.sound.play("missionDone", 0.5);
    g.banner(emergency ? "CHỈ HUY: MỞ ĐIỂM RÚT QUÂN KHẨN CẤP!" : "ĐIỂM RÚT QUÂN ĐÃ MỞ — theo mũi tên xanh!", "#5fdc8c", true, 3.2);
  }
  callHeli() {
    const g = this.game, P = this.pad;
    this.phase = "flare";
    this.flare = { x: P.x + 6, y: P.y + 4, t: 0, wave: 0 };
    g.sound.play("flare", 0.8);
    g.screenFlash("#5fdc8c", 0.25);
    g.makeNoise(P.x, P.y, 640);
    g.banner(`PHÁO SÁNG ĐÃ BẮN — TRỰC THĂNG TỚI SAU ${EXTRACT.flareTime} GIÂY!`, "#5fdc8c", true, 3);
    g.banner("Đợt zombie cuối cùng đang ùa vào bãi đáp — cầm cự!", "#ff7a5a", false, 3);
  }
  updateFlare(dt) {
    const g = this.game, F = this.flare;
    F.t += dt;
    if (Math.random() < dt * 22) this.smoke.push({ x: F.x + rand(-2, 2), y: F.y - 8, vx: rand(-6, 10), vy: rand(-28, -18), life: rand(1.6, 2.6), max: 2.6, r: rand(2, 4) });
    while (F.wave < EXTRACT.finalWaves.length && F.t >= EXTRACT.finalWaves[F.wave]) {
      F.wave++;
      const n = F.wave === EXTRACT.finalWaves.length && g.diffIndex >= 1 ? 2 : 1;
      for (let i = 0; i < n; i++) g.horde?.spawnHuntSquad(this.pad.x, this.pad.y, { tag: "final" });
      g.sound.play("zombieHowl", 0.6);
    }
    if (this.phase === "flare" && F.t >= EXTRACT.flareTime) {
      this.phase = "heli";
      this.heli = { x: this.pad.x - 340, y: this.pad.y, z: 150, t: 0, state: "arrive", rotorT: 0 };
      g.banner("TRỰC THĂNG ĐANG HẠ CÁNH!", "#5fdc8c", true, 2.4);
    }
  }
  updateHeli(dt) {
    const g = this.game, H = this.heli, P = this.pad, p = g.player;
    H.t += dt; H.rotorT -= dt;
    if (H.rotorT <= 0) { H.rotorT = 0.22; g.sound.play("heliRotor", H.state === "landed" ? 0.35 : 0.5); }
    if (H.state === "arrive") {
      const u = Math.min(1, H.t / EXTRACT.heliArrive), e = 1 - (1 - u) ** 3;
      H.x = P.x - 340 * (1 - e); H.z = 150 * (1 - e) ** 1.4;
      if (u >= 1) { H.state = "landed"; H.t = 0; g.shake(0.2, 2); g.fx.dust?.(P.x - 14, P.y, false); g.fx.dust?.(P.x + 14, P.y, true); g.banner("LÊN TRỰC THĂNG NGAY — chạy vào bãi đáp!", "#5fdc8c", true, 2.6); }
    } else if (H.state === "landed") {
      if (!this.boarded && p.hp > 0 && (p.x - P.x) ** 2 + ((p.y - P.y) * 1.3) ** 2 < EXTRACT.padRadius ** 2) {
        this.boarded = true; H.state = "leave"; H.t = 0;
        p.hurtTimer = 99;   // đã lên máy bay: bất tử
        g.sound.play("missionDone", 0.7);
      }
    } else if (H.state === "leave") {
      H.z = (H.t / 1.6) ** 2 * 200; H.x = P.x + H.t * H.t * 90;
      if (H.t >= 1.7 && this.phase !== "done") this.success();
    }
  }

  startGas() {
    const g = this.game;
    this.gas = true; this.gasT = EXTRACT.gas.tick; this.strikeT = 1.5;
    g.banner("HẾT GIỜ! VÙNG ĐỘC & KHÔNG KÍCH BAO TRÙM BẢN ĐỒ!", "#ff3b3b", true, 3.4);
    g.sound.play("bossWarn", 0.8);
    if (!this.padOpen) this.openExtraction(true);
  }
  updateGas(dt) {
    const g = this.game, p = g.player;
    if (this.boarded) return;
    this.gasT -= dt;
    if (this.gasT <= 0) {
      this.gasT = EXTRACT.gas.tick;
      if (p.hp > 0) { p.hurtTimer = 0; p.hurt(g, p.x + rand(-5, 5), p.y + 20, EXTRACT.gas.damage); }
    }
    this.strikeT -= dt;
    if (this.strikeT <= 0) {
      this.strikeT = EXTRACT.gas.strikeEvery;
      const a = rand(0, TAU), d = rand(40, 200);
      g.addStrike({ kind: "meteor", x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d * 0.75, r: 48, delay: 1.0, damage: 8, knock: 260, burn: 1, owner: "event" });
    }
    if (Math.random() < dt * 30) this.smoke.push({ x: g.camera.x + rand(0, g.camera.w), y: g.camera.y + rand(0, g.camera.h), vx: rand(-10, 10), vy: rand(-6, 2), life: rand(1.5, 3), max: 3, r: rand(6, 14), gas: true });
  }
  updateSmoke(dt) {
    for (const s of this.smoke) { s.life -= dt; s.x += s.vx * dt; s.y += s.vy * dt; s.vx *= 0.99; }
    if (this.smoke.length > 160) this.smoke.splice(0, this.smoke.length - 160);
    this.smoke = this.smoke.filter((s) => s.life > 0);
  }

  onMissionDone() { /* điểm rút quân mở ở update() khi doneCount >= 1 */ }

  // ---------------------------------------------------------------- KẾT THÚC
  /** Đồ mang về khi rút quân thành công */
  collectHaul() {
    const items = {};
    for (const s of this.bag) if (s) items[s.id] = (items[s.id] ?? 0) + s.n;
    for (const [id, n] of Object.entries(this.backpack)) items[id] = (items[id] ?? 0) + n;
    const weapons = [];
    for (const w of this.game.player.weapons) {
      if (!w || w.crafted) continue;
      const id = (w.def ?? w).id;
      if (id && WEAPONS[id]) weapons.push({ id, lvl: w.lvl ?? 1 });
    }
    return { items, weapons };
  }
  success() {
    const g = this.game;
    this.phase = "done";
    const haul = this.collectHaul();
    this.stash.deposit(haul);
    const done = this.missions.doneCount, all = this.missions.list.length;
    const gems = 10 + done * 8 + (done === all ? 6 : 0) + Math.floor(g.kills / 10) + Math.floor(g.goldTotal / EXTRACT.goldPerGem) - (this.emergency ? 6 : 0);
    this.result = { success: true, haul, gems: Math.max(3, gems), done, all, time: this.t, kills: g.kills, gold: g.goldTotal, score: g.score + 500 + done * 200 };
    g.score = this.result.score;
    this.progress.addGems(this.result.gems);
    g.endExtraction(this.result);
  }
  fail(reason = "dead") {
    const g = this.game;
    if (this.phase === "done") return;
    this.phase = "done";
    const lost = this.collectHaul();
    this.stash.lose();
    const gems = Math.max(1, Math.floor(g.kills / 15) + this.missions.doneCount * 2);
    this.result = { success: false, reason, lost, gems, done: this.missions.doneCount, all: this.missions.list.length, time: this.t, kills: g.kills, gold: g.goldTotal, score: g.score };
    this.progress.addGems(gems);
  }

  // ---------------------------------------------------------------- TƯƠNG TÁC (E)
  findInteract(p) {
    if (!this.playing) return null;
    let best = null, bd = 28 * 28;
    for (const s of this.spots) {
      if (s.opened) continue;
      const d = (s.x - p.x) ** 2 + (s.y - p.y) ** 2;
      if (d < bd) { bd = d; best = { kind: "loot", ref: s, x: s.x, y: s.y - 22, label: s === this.searching ? "Đang lục soát..." : s.kind === "crate" ? "Mở Hòm Tiếp Tế" : "Lục Túi Y Tế" }; }
    }
    const m = this.missions.findInteract(p);
    if (m) { const d = (m.x - p.x) ** 2 + (m.y + 34 - p.y) ** 2; if (!best || d < bd) best = m; }
    if (this.padOpen && !this.flare && this.pad) {
      const d = (this.pad.x - p.x) ** 2 + (this.pad.y - p.y) ** 2;
      if (d < EXTRACT.padRadius ** 2) best = { kind: "extract", ref: this.pad, x: this.pad.x, y: this.pad.y - 30, label: "Bắn pháo sáng gọi trực thăng" };
    }
    return best;
  }
  interact(t) {
    if (t.kind === "loot") { if (!this.searching) { this.searching = t.ref; t.ref.search = 0; this.game.sound.play("search", 0.5); } }
    else if (t.kind === "extract") this.callHeli();
    else this.missions.interact(t);
  }

  // ---------------------------------------------------------------- VẼ (ctx ĐÃ dịch theo camera)
  /** Lớp đất: bãi đáp, hòm đồ, mìn, vùng nhiệm vụ */
  drawGround(c) {
    const g = this.game, cam = g.camera, t = g.time, imgs = g.assets.images;
    this.missions.drawGround(c);
    if (this.padOpen && this.pad && cam.inView(this.pad.x, this.pad.y, 90)) drawPad(c, this.pad, t, !!this.flare);
    for (const s of this.spots) if (cam.inView(s.x, s.y, 24)) drawSpot(c, s, t, imgs, s === this.searching);
    for (const m of this.mines) {
      if (!cam.inView(m.x, m.y, 12)) continue;
      const x = Math.round(m.x), y = Math.round(m.y), armed = m.t >= 0.8;
      c.fillStyle = "#14100a"; c.fillRect(x - 5, y - 2, 10, 4);
      c.fillStyle = "#6a5a2a"; c.fillRect(x - 4, y - 2, 8, 3);
      c.fillStyle = armed && Math.floor(t * 4) % 2 ? "#ff3b3b" : "#5a1414"; c.fillRect(x - 1, y - 3, 2, 1);
    }
    if (this.flare) {   // pháo sáng cắm đất
      const img = imgs["x:flare"], x = Math.round(this.flare.x), y = Math.round(this.flare.y);
      if (img) c.drawImage(img, x - img.width / 2, y - img.height);   // >>> ẢNH PHÁO SÁNG
      else { c.fillStyle = "#14100a"; c.fillRect(x - 2, y - 9, 4, 9); c.fillStyle = "#c83a3a"; c.fillRect(x - 1, y - 8, 2, 7); c.fillStyle = Math.floor(t * 20) % 2 ? "#eaffd8" : "#5fdc8c"; c.fillRect(x - 2, y - 12, 4, 3); }
    }
  }
  /** Vật thể đứng sắp theo trục Y */
  collectActors(list) { this.missions.collectActors(list); }
  /** Lớp phát sáng: lựu đạn đang bay, khói pháo sáng, trực thăng, thanh lục soát */
  drawOverlay(c) {
    const g = this.game, t = g.time;
    this.missions.drawOverlay(c);
    for (const T of this.throws) {
      const u = Math.min(1, T.t / T.dur), x = T.x0 + (T.x1 - T.x0) * u, y = T.y0 + (T.y1 - T.y0 + 17) * u - Math.sin(Math.PI * u) * 26;
      c.fillStyle = "#0e140a"; c.fillRect(Math.round(x) - 2, Math.round(y) - 2, 5, 5);
      c.fillStyle = "#6a8a3a"; c.fillRect(Math.round(x) - 1, Math.round(y) - 1, 3, 3);
      c.fillStyle = "#ffe26b"; if (Math.floor(t * 20) % 2) c.fillRect(Math.round(x), Math.round(y) - 3, 1, 1);
    }
    for (const s of this.smoke) {
      const k = s.life / s.max, r = Math.round(s.r * (1.4 - k * 0.6));
      c.fillStyle = s.gas ? withAlpha("#7ad23a", 0.12 * k) : withAlpha(k > 0.6 ? "#8affb0" : "#4aa86a", 0.55 * k);
      c.fillRect(Math.round(s.x) - r, Math.round(s.y) - r, r * 2, r * 2);
    }
    if (this.searching) {
      const S = this.searching, k = S.search / EXTRACT.searchTime, x = Math.round(S.x), y = Math.round(S.y - 26);
      c.strokeStyle = "#000"; c.lineWidth = 3; c.beginPath(); c.arc(x, y, 6, 0, TAU); c.stroke();
      c.strokeStyle = "#ffe26b"; c.lineWidth = 2; c.beginPath(); c.arc(x, y, 6, -Math.PI / 2, -Math.PI / 2 + TAU * k); c.stroke();
    }
    if (this.heli) drawHeli(c, this.heli, g, this.boarded);
  }

  /** Đèn: pháo sáng, bãi đáp, hòm đồ */
  lights(add, cam) {
    if (this.flare) add(this.flare.x, this.flare.y - 8, 130 + Math.sin(this.game.time * 30) * 6, "#5fdc8c", 1, 0.3);
    if (this.padOpen && this.pad && cam.inView(this.pad.x, this.pad.y, 80)) add(this.pad.x, this.pad.y, 70, "#5fdc8c", 0.7, 0.18);
    for (const s of this.spots) if (!s.opened && cam.inView(s.x, s.y, 30)) add(s.x, s.y - 4, 26, s.kind === "crate" ? "#ffd28a" : "#ff8a8a", 0.7, 0.18);
    for (const m of this.missions.list) if (m.state === "active" && cam.inView(m.x, m.y, 90)) add(m.x, m.y - 10, 60, m.color, 0.7, 0.16);
    if (this.heli && cam.inView(this.heli.x, this.heli.y, 120)) add(this.heli.x, this.heli.y - this.heli.z - 10, 70, "#fff2c0", 0.9, 0.2);
  }

  // ---------------------------------------------------------------- HUD (TOẠ ĐỘ MÀN HÌNH)
  drawHUD(c, W, H) {
    const g = this.game, t = g.time, imgs = g.assets.images;
    c.textBaseline = "top";
    // --- Đồng hồ giữa trên ---
    const low = this.timeLeft <= 60, blink = this.timeLeft <= 30 && Math.floor(t * 4) % 2 === 0;
    hudPanel(c, W / 2 - 31, 4, 62, 18, this.gas ? "#c83a3a" : low ? "#ffb030" : "#4a4066");
    c.font = "bold 13px monospace"; c.textAlign = "center";
    hudText(c, fmt(this.timeLeft), W / 2, 7, this.gas ? "#ff5a5a" : blink ? "#ffffff" : low ? "#ff8a5a" : "#ffe26b");
    c.font = "7px monospace";
    let status, col;
    if (this.phase === "airdrop") { status = this.airdrop?.falling ? "BUNG DÙ — CHUẨN BỊ TIẾP ĐẤT!" : "MÁY BAY ĐANG TỚI ĐIỂM NHẢY..."; col = "#ffe26b"; }
    else if (this.gas && !this.flare) { status = "VÙNG ĐỘC! -1 MÁU MỖI 3 GIÂY"; col = "#ff5a5a"; }
    else if (this.heli?.state === "landed") { status = "LÊN TRỰC THĂNG NGAY!"; col = "#5fdc8c"; }
    else if (this.heli) { status = "TRỰC THĂNG ĐANG HẠ CÁNH"; col = "#5fdc8c"; }
    else if (this.flare) { status = `TRỰC THĂNG TỚI SAU ${Math.ceil(EXTRACT.flareTime - this.flare.t)}s — CẦM CỰ!`; col = "#8affb0"; }
    else if (this.padOpen) { status = "ĐIỂM RÚT QUÂN ĐÃ MỞ — tới vòng xanh, bấm E"; col = "#5fdc8c"; }
    else { status = "Rút quân: hoàn thành 1 nhiệm vụ để mở"; col = "#a69dc4"; }
    hudText(c, status, W / 2, 25, col);
    if (this.flare && !this.heli) {   // số đếm ngược lớn
      c.font = "bold 18px monospace";
      hudText(c, String(Math.ceil(EXTRACT.flareTime - this.flare.t)), W / 2, 36, "#8affb0");
    }
    c.textAlign = "left";

    // --- Bảng nhiệm vụ (góc trên phải, dưới bộ đếm FPS) ---
    const L = this.missions.list, bw = 136, bx = W - bw - (g.touchMode ? 36 : 4), by = 17, rowH = 15;   // điện thoại: chừa chỗ nút tạm dừng
    hudPanel(c, bx, by, bw, 12 + L.length * rowH, "#4a4066");
    c.font = "7px monospace";
    hudText(c, `NHIỆM VỤ ${this.missions.doneCount}/${L.length}`, bx + 4, by + 3, "#ffe26b");
    L.forEach((m, i) => {
      const y = by + 12 + i * rowH, done = m.state === "done";
      c.fillStyle = "#000"; c.fillRect(bx + 4, y + 1, 7, 7);
      c.fillStyle = done ? "#5fdc8c" : m.color; c.fillRect(bx + 5, y + 2, 5, 5);
      if (done) { c.fillStyle = "#0b2a14"; c.fillRect(bx + 6, y + 4, 1, 1); c.fillRect(bx + 7, y + 5, 1, 1); c.fillRect(bx + 8, y + 3, 1, 2); }
      hudText(c, m.cfg.name, bx + 14, y + 1, done ? "#5fdc8c" : "#e8e2f6");
      c.textAlign = "right";
      const right = done ? "XONG" : m.type === "rescue" ? (m.survivor.state === "free" ? "BẤM E" : `${g.horde?.aliveIn(m.tag) ?? 0} zombie`) : `${Math.floor(m.progress * 100)}%`;
      hudText(c, right, bx + bw - 4, y + 1, done ? "#5fdc8c" : "#a69dc4");
      c.textAlign = "left";
      c.fillStyle = "#2a2338"; c.fillRect(bx + 14, y + 10, bw - 18, 1);
      c.fillStyle = done ? "#5fdc8c" : m.color; c.fillRect(bx + 14, y + 10, Math.round((bw - 18) * (m.type === "rescue" ? (done ? 1 : m.survivor.state === "free" ? 0.8 : 0) : m.progress)), 1);
    });

    // --- Túi chiến thuật (góc dưới trái) — điện thoại đã có 4 nút cảm ứng ở giữa dưới nên không vẽ lại ---
    const keys = ["Z", "X", "C", "V"];
    for (let i = 0; i < BAG_SLOTS && !g.touchMode; i++) {
      const s = this.bag[i], x = 4 + i * 24, y = H - 27;
      hudPanel(c, x, y, 22, 22, s ? withAlpha(ITEM_DEFS[s.id].color, 0.9) : "#2a2440");
      if (s) {
        drawItemIcon(c, s.id, x + 3, y + 3, 16, imgs);
        c.font = "7px monospace"; c.textAlign = "right";
        hudText(c, `${s.n}`, x + 21, y + 14, "#ffffff");
        c.textAlign = "left";
      }
      c.font = "7px monospace";
      hudText(c, keys[i], x + 2, y + 1, s ? "#ffe26b" : "#5a5278");
    }
    const bp = Object.values(this.backpack).reduce((a, b) => a + b, 0);
    c.font = "7px monospace";
    if (!g.touchMode || bp) hudText(c, g.touchMode ? `BA LÔ ${bp}` : `TÚI ĐỒ${bp ? ` · BA LÔ ${bp}` : ""}`, g.touchMode ? W / 2 - 20 : 4, g.touchMode ? H - 40 : H - 37, "#a69dc4");

    // --- Mũi tên chỉ hướng quanh nhân vật ---
    this.drawArrows(c);
    // --- Vùng độc: phủ xanh màn hình ---
    if (this.gas && !this.boarded) { c.fillStyle = `rgba(90,200,40,${0.12 + 0.05 * Math.sin(t * 2)})`; c.fillRect(0, 0, W, H); }
    c.font = "8px monospace";
  }

  /** Mũi tên nhỏ trên vòng tròn quanh nhân vật, chỉ về mục tiêu nhiệm vụ & điểm rút quân */
  drawArrows(c) {
    const g = this.game, p = g.player, cam = g.camera;
    if (p.hp <= 0 || this.boarded || !this.playing) return;
    const sx = p.cx - cam.rx, sy = p.cy - cam.ry;
    const targets = [];
    for (const m of this.missions.list) if (m.state === "active") targets.push([m.x, m.y, m.color]);
    if (this.padOpen && this.pad) targets.push([this.pad.x, this.pad.y, "#5fdc8c"]);
    for (const [tx, ty, col] of targets) {
      const dx = tx - p.x, dy = ty - p.cy, d = Math.hypot(dx, dy);
      if (d < 110) continue;
      const a = Math.atan2(dy, dx), R = 27 + Math.sin(g.time * 5) * 1.5, ax = sx + Math.cos(a) * R, ay = sy + Math.sin(a) * R;
      c.save(); c.translate(Math.round(ax), Math.round(ay)); c.rotate(a);
      c.fillStyle = "#000"; c.beginPath(); c.moveTo(5, 0); c.lineTo(-3, -4); c.lineTo(-3, 4); c.closePath(); c.fill();
      c.fillStyle = col; c.beginPath(); c.moveTo(4, 0); c.lineTo(-2, -3); c.lineTo(-2, 3); c.closePath(); c.fill();
      c.restore();
    }
  }

  /** Dấu trên minimap: nhiệm vụ, bãi đáp, hòm đồ chưa mở ở gần */
  drawMinimap(c, x0, y0, sx, sy, time) {
    const p = this.game.player;
    for (const s of this.spots) {
      if (s.opened || (s.x - p.x) ** 2 + (s.y - p.y) ** 2 > 600 * 600) continue;
      c.fillStyle = s.kind === "crate" ? "#ffd28a" : "#ff8a8a"; c.fillRect(Math.round(x0 + s.x * sx), Math.round(y0 + s.y * sy), 1, 1);
    }
    this.missions.drawMinimap(c, x0, y0, sx, sy, time);
    if (this.padOpen && this.pad) {
      const x = Math.round(x0 + this.pad.x * sx), y = Math.round(y0 + this.pad.y * sy), on = Math.sin(time * 8) > -0.3;
      c.fillStyle = "#000"; c.fillRect(x - 3, y - 3, 7, 7);
      c.fillStyle = on ? "#5fdc8c" : "#2a7a44"; c.fillRect(x - 2, y - 2, 5, 5);
      c.fillStyle = "#0b2a14"; c.fillRect(x - 1, y - 1, 1, 3); c.fillRect(x + 1, y - 1, 1, 3); c.fillRect(x, y, 1, 1);
    }
  }
}

// =====================================================================================
//  HÀM VẼ PIXEL ART (dùng khi chưa chèn ảnh ở EXTRACT_IMAGES)
// =====================================================================================
function fmt(s) { s = Math.max(0, Math.ceil(s)); return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`; }
export { fmt as fmtClock };

/** Chọn 1 khẩu súng thật (Pixel Armory) hoặc vũ khí cận chiến mới theo tỉ lệ độ hiếm */
function pickFirearm(odds) {
  const pool = Object.values(WEAPONS).filter((w) => w.type === "firearm" || (w.noise === 0 && isMelee(w)));
  if (!pool.length) return rollWeapon(odds);
  const byR = {};
  for (const w of pool) (byR[w.rarity] ??= []).push(w);
  const entries = Object.entries(odds).filter(([r]) => byR[r]?.length);
  let x = Math.random() * entries.reduce((s, [, v]) => s + v, 0);
  for (const [r, v] of entries) if ((x -= v) <= 0) return byR[r][(Math.random() * byR[r].length) | 0];
  return pool[(Math.random() * pool.length) | 0];
}

/** Hòm tiếp tế quân sự (xanh rêu) / túi y tế (trắng chữ thập đỏ); đã mở thì nắp bật, rỗng */
function drawSpot(c, s, t, imgs, searching) {
  const x = Math.round(s.x), y = Math.round(s.y);
  const key = s.kind === "crate" ? (s.opened ? "x:crateOpen" : "x:crate") : (s.opened ? "x:medbagOpen" : "x:medbag");
  const img = imgs[key];
  if (!s.opened) {   // ánh sáng nhấp nháy mời gọi
    c.fillStyle = withAlpha(s.kind === "crate" ? "#ffd28a" : "#ff8a8a", 0.14 + 0.08 * Math.sin(t * 3 + s.glow));
    c.beginPath(); c.ellipse(x, y - 2, 13, 6, 0, 0, TAU); c.fill();
  }
  if (img) { c.drawImage(img, x - Math.round(img.width / 2), y - img.height); return; }   // >>> ẢNH HÒM / TÚI CỦA BẠN
  c.fillStyle = "rgba(0,0,0,0.35)"; c.fillRect(x - 8, y - 1, 16, 3);
  const shake = searching ? Math.round(Math.sin(t * 50)) : 0;
  if (s.kind === "crate") {
    c.fillStyle = "#0e140a"; c.fillRect(x - 9 + shake, y - 12, 18, 12);
    c.fillStyle = s.opened ? "#3a4a24" : "#4a5e2a"; c.fillRect(x - 8 + shake, y - 11, 16, 10);
    c.fillStyle = "#6a8040"; c.fillRect(x - 8 + shake, y - 11, 16, 1);
    c.fillStyle = "#2c3a18"; c.fillRect(x - 8 + shake, y - 6, 16, 1); c.fillRect(x - 3 + shake, y - 11, 1, 10); c.fillRect(x + 3 + shake, y - 11, 1, 10);
    c.fillStyle = "#c8b060"; c.fillRect(x - 2 + shake, y - 9, 4, 2);   // chữ in khuôn trên nắp
    if (s.opened) { c.fillStyle = "#0e140a"; c.fillRect(x - 9, y - 17, 18, 5); c.fillStyle = "#5a6e34"; c.fillRect(x - 8, y - 16, 16, 3); c.fillStyle = "#14100a"; c.fillRect(x - 7, y - 11, 14, 3); }
  } else {
    c.fillStyle = "#1a1018"; c.fillRect(x - 7 + shake, y - 10, 14, 10); c.fillRect(x - 3 + shake, y - 12, 6, 2);
    c.fillStyle = s.opened ? "#b8b0c0" : "#ece6f2"; c.fillRect(x - 6 + shake, y - 9, 12, 8);
    c.fillStyle = "#a8a0b8"; c.fillRect(x - 6 + shake, y - 2, 12, 1);
    if (!s.opened) { c.fillStyle = "#e8343f"; c.fillRect(x - 1 + shake, y - 8, 2, 6); c.fillRect(x - 3 + shake, y - 6, 6, 2); }
    else { c.fillStyle = "#5a5468"; c.fillRect(x - 4, y - 7, 8, 3); }
  }
}

/** Bãi đáp rút quân: vòng xanh nét đứt + chữ H sơn trên đất */
function drawPad(c, P, t, lit) {
  const x = Math.round(P.x), y = Math.round(P.y), R = EXTRACT.padRadius;
  c.fillStyle = withAlpha("#5fdc8c", lit ? 0.16 + 0.06 * Math.sin(t * 8) : 0.1);
  c.beginPath(); c.ellipse(x, y, R, R * 0.55, 0, 0, TAU); c.fill();
  c.fillStyle = withAlpha("#5fdc8c", 0.85);
  for (let i = 0; i < 28; i += 2) { const a = (i / 28) * TAU + t * 0.5; c.fillRect(Math.round(x + Math.cos(a) * R), Math.round(y + Math.sin(a) * R * 0.55), 3, 1); }
  c.fillStyle = withAlpha("#e8f8e8", 0.75);   // chữ H
  c.fillRect(x - 9, y - 6, 3, 12); c.fillRect(x + 6, y - 6, 3, 12); c.fillRect(x - 6, y - 1, 12, 2);
  c.strokeStyle = withAlpha("#e8f8e8", 0.5); c.lineWidth = 1;
  c.beginPath(); c.ellipse(x, y, 18, 10, 0, 0, TAU); c.stroke();
}

/** Trực thăng nhìn ngang (mũi sang PHẢI) + bóng dưới đất + cánh quạt quay */
function drawHeli(c, H, g, boarded) {
  const x = Math.round(H.x), y = Math.round(H.y), z = Math.round(H.z), t = g.time;
  const sh = Math.max(0.3, 1 - z / 220);
  c.fillStyle = `rgba(0,0,0,${0.35 * sh})`; c.beginPath(); c.ellipse(x, y + 2, 30 * sh + 6, 6 * sh + 2, 0, 0, TAU); c.fill();
  const img = g.assets.images["x:helicopter"];
  if (img) { c.drawImage(img, x - img.width / 2, y - z - img.height); return; }   // >>> ẢNH TRỰC THĂNG CỦA BẠN
  const by = y - z - 12;   // đáy thân
  // càng đáp
  c.fillStyle = "#14141a"; c.fillRect(x - 18, by + 9, 32, 2); c.fillRect(x - 12, by + 5, 2, 4); c.fillRect(x + 6, by + 5, 2, 4);
  // đuôi
  c.fillStyle = "#0e120a"; c.fillRect(x - 46, by - 9, 30, 5);
  c.fillStyle = "#4a5a2a"; c.fillRect(x - 45, by - 8, 29, 3);
  c.fillStyle = "#0e120a"; c.fillRect(x - 49, by - 15, 6, 10);
  c.fillStyle = "#4a5a2a"; c.fillRect(x - 48, by - 14, 4, 8);
  const tr = Math.floor(t * 30) % 2;   // cánh quạt đuôi
  c.fillStyle = "#c8c8d0"; c.fillRect(x - 47, by - 17 + tr * 2, 1, 12 - tr * 4);
  // thân
  c.fillStyle = "#0e120a"; c.fillRect(x - 19, by - 13, 38, 18); c.fillRect(x + 17, by - 9, 5, 12);
  c.fillStyle = "#56682e"; c.fillRect(x - 18, by - 12, 36, 16); c.fillRect(x + 17, by - 8, 4, 10);
  c.fillStyle = "#6e8240"; c.fillRect(x - 18, by - 12, 36, 2);
  c.fillStyle = "#3a4820"; c.fillRect(x - 18, by + 2, 36, 2);
  c.fillStyle = "#9fd8ff"; c.fillRect(x + 8, by - 10, 10, 6);   // kính buồng lái
  c.fillStyle = "#e8f8ff"; c.fillRect(x + 9, by - 10, 3, 1);
  c.fillStyle = "#2a3418"; c.fillRect(x - 6, by - 10, 10, 11);   // cửa hông
  if (boarded && H.state === "leave") { c.fillStyle = "#ffd2a8"; c.fillRect(x - 3, by - 7, 3, 3); }
  c.fillStyle = "#e8e2d0"; c.fillRect(x - 15, by - 7, 6, 3);       // sao trắng
  c.fillStyle = Math.floor(t * 3) % 2 ? "#ff3b3b" : "#5a1414"; c.fillRect(x - 46, by - 11, 2, 2);   // đèn đuôi
  // trục + cánh quạt chính (quay -> dài ngắn luân phiên)
  c.fillStyle = "#14141a"; c.fillRect(x - 2, by - 17, 4, 4);
  const ph = (t * 18) % 2 < 1, L = ph ? 46 : 30;
  c.fillStyle = withAlpha("#d8d8e0", 0.8); c.fillRect(x - L, by - 18, L * 2, 1);
  c.fillStyle = withAlpha("#d8d8e0", 0.25); c.fillRect(x - 46, by - 19, 92, 3);
}

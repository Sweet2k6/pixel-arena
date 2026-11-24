// =====================================================================================
//  CHẾ ĐỘ CỐT TRUYỆN — vòng đời 1 chương (kinh dị kiểu Nobihaza)
//
//  StoryRun điều khiển: phòng hiện tại (StoryWorld), đồ vật / cửa / zombie / bạn bè trong phòng, KỊCH BẢN SỰ KIỆN,
//  túi đồ, ghi chú, lưu game, đèn pin + đèn trần chập chờn + sét, âm thanh rùng rợn, HUD riêng.
//  main.js gọi các "móc" (hook) giống ExtractionRun: update / lights / drawGround / collectActors / drawOverlay /
//  drawHUD / drawScreen / findInteract / interact / onKill / noise.
//
//  >>> VIẾT CHƯƠNG MỚI: xem story/chuong1.js (mẫu đầy đủ, có chú thích từng lệnh) và story/chapters.js
// =====================================================================================
import { StoryWorld, TILE, drawFurniture } from "./storyWorld.js";
import { StoryAudio } from "./storyAudio.js";
import { WEAPONS, makeWeapon } from "../weapons.js";
import { Enemy } from "../enemies.js";
import { AMMO, AMMO_TYPES, newAmmoPool, ammoTypeOf, addAmmo, drawAmmoBox } from "../ammo.js";
import { CHARACTERS } from "../../characters.js";
import * as HUD from "../hud.js";
import { drawShadow } from "../juice.js";
import { makeVignette } from "../ambient.js";

/** >>> CHỈNH CẢM GIÁC CHƠI CỐT TRUYỆN */
export const STORY_CFG = {
  flashlight: { range: 150, spread: 0.42, ring: 38 },   // đèn pin: tầm xa (px), nửa góc mở (rad), quầng sáng quanh người
  sight: 125,          // zombie thấy bạn trong tầm này (px, cần nhìn thẳng)
  touch: 46,           // đứng sát thế này thì zombie phát hiện dù không thấy
  interactR: 22,       // khoảng cách bấm E
  boltEvery: [9, 20],  // sét đánh mỗi 9–20 giây (phòng có cửa sổ)
};

/** Vật phẩm dùng chung (chương có thể khai báo thêm trong `items`) */
export const BASE_ITEMS = {
  bandage: { name: "Băng gạc", desc: "Băng vết thương, hồi 2 máu. Phím F để dùng nhanh.", icon: "🩹", heal: 2, draw: "bandage" },
  medkit: { name: "Hộp sơ cứu", desc: "Hồi đầy máu.", icon: "✚", heal: 99, draw: "medkit" },
  coffee: { name: "Lon cà phê", desc: "Hồi 1 máu. Tỉnh cả người.", icon: "🥫", heal: 1, draw: "can" },
};

const SAVE_KEY = (id) => `pixelArena.story.${id}`;
const DONE_KEY = "pixelArena.story.done";
const rand = (a, b) => a + Math.random() * (b - a);
const T = TILE;

export function loadStorySave(chId) { try { const s = JSON.parse(localStorage.getItem(SAVE_KEY(chId)) ?? "null"); return s && s.v === 1 ? s : null; } catch { return null; } }
export function deleteStorySave(chId) { try { localStorage.removeItem(SAVE_KEY(chId)); } catch { /* bỏ qua */ } }
export function storyDone() { try { return JSON.parse(localStorage.getItem(DONE_KEY) ?? "{}") ?? {}; } catch { return {}; } }
function markDone(chId) { try { const d = storyDone(); d[chId] = Date.now(); localStorage.setItem(DONE_KEY, JSON.stringify(d)); } catch { /* bỏ qua */ } }
const fmtT = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/** Bạn bè / người trong cốt truyện đứng trong phòng (nói chuyện bằng E) */
class StoryNPC {
  constructor(o, x, y, sprite) {
    this.o = o; this.x = x; this.y = y; this.sprite = sprite; this.anim = sprite?.controller() ?? null;
    this.anim?.randomize();
    this.faceLeft = o.def.face === "left";
    this.char = CHARACTERS.find((c) => c.id === o.def.char);
  }
  update(dt, p) {
    this.anim?.update(dt);
    if (this.o.def.face === "player" || this.o.def.face === undefined) this.faceLeft = p.x < this.x;
  }
  draw(c) {
    drawShadow(c, this.x, this.y, 16, 0.32);
    if (this.sprite) this.sprite.sheet.draw(c, this.anim.col, this.anim.row, this.x, this.y, this.faceLeft);
  }
}

export class StoryRun {
  /** chapter: dữ liệu chương (story/chuongX.js) · save: bản lưu (hoặc null = chơi mới) */
  constructor(game, chapter, save = null) {
    this.game = game;
    this.ch = chapter;
    this.ui = game.storyUI;
    this.audio = new StoryAudio();
    this.items = { ...BASE_ITEMS, ...(chapter.items ?? {}) };
    this.S = save ? JSON.parse(JSON.stringify(save)) : {
      v: 1, chapter: chapter.id, map: chapter.start.map, at: chapter.start.at, pos: null,
      flags: {}, inv: {}, notes: [], killed: {}, taken: {}, time: 0, saves: 0, kills: 0,
      hp: null, weapons: null, ammo: null, objective: chapter.objective ?? "",
    };
    this.fromSave = !!save;
    this.paused = false;      // hội thoại / ghi chú / túi đồ: cả thế giới đứng yên
    this.lockInput = false;   // đang diễn cảnh: người chơi không điều khiển được (thế giới vẫn chạy)
    this.autoWalk = null;     // diễn cảnh: tự đi tới { x, y }
    this.faceAng = null;
    this.busy = 0;            // số sự kiện đang chạy
    this.timers = [];
    this.objs = []; this.npcs = []; this.furn = [];
    this.fade = 1; this.fadeTo = 0; this.fadeSpeed = 1.6;
    this.bolt = 0; this.nextBolt = rand(4, 9);
    this.flashA = 0; this.flashCol = "#ffffff";
    this.aborted = false;
    this.ended = false;
    this.mapId = this.S.map;
    this.vignette = makeVignette(480, 270, 0.78);
    this.grain = Array.from({ length: 4 }, () => makeGrain(480, 270));
    this.heart = 0;
  }

  get def() { return this.ch.maps[this.mapId]; }
  get world() { return this.game.world; }
  get player() { return this.game.player; }
  has(id, n = 1) { return (this.S.inv[id] ?? 0) >= n; }
  give(id, n = 1) { this.S.inv[id] = (this.S.inv[id] ?? 0) + n; }
  take(id, n = 1) { this.S.inv[id] = Math.max(0, (this.S.inv[id] ?? 0) - n); if (!this.S.inv[id]) delete this.S.inv[id]; }
  flag(name) { return !!this.S.flags[name]; }
  /** Điều kiện xuất hiện của 1 đối tượng / bước sự kiện: { if, unless, ifItem, unlessItem } hoặc chuỗi tên cờ */
  test(c) {
    if (!c) return true;
    if (typeof c === "string") return c.startsWith("!") ? !this.flag(c.slice(1)) : this.flag(c);
    if (typeof c === "function") return !!c(this);
    if (c.if && !this.test(c.if)) return false;
    if (c.unless && this.test(c.unless)) return false;
    if (c.ifItem && !this.has(c.ifItem)) return false;
    if (c.unlessItem && this.has(c.unlessItem)) return false;
    return true;
  }

  // ---------------------------------------------------------------- DỰNG PHÒNG
  makeWorld(mapId = this.S.map) {
    this.mapId = mapId;
    this.S.map = mapId;
    const w = new StoryWorld(this.ch.maps[mapId], this.game.assets.images);
    return w;
  }
  /** Gọi sau khi game.reset dựng xong người chơi: trang bị, vị trí, đồ vật, mở màn */
  begin() {
    const g = this.game, p = this.player, S = this.S;
    this.ui.show();
    this.ui.onBag = () => { if (!this.busy && !this.paused && !this.ended && !g.paused) this.call([(s) => s.openInventory()]); };
    // trang bị: từ bản lưu, hoặc theo chương
    const lo = this.ch.loadout ?? {};
    const list = S.weapons ?? (lo.weapons ?? []).map((w) => ({ id: w.id ?? w, name: w.name, ammo: w.ammo }));
    if (list.length) {
      p.weapons = [null, null];
      list.slice(0, 2).forEach((d, i) => { p.weapons[i] = this.makeW(d); });
      p.slot = 0;
    }
    AMMO.pool = newAmmoPool();
    for (const [t, n] of Object.entries(S.ammo ?? lo.ammo ?? {})) if (AMMO.pool[t] !== undefined) AMMO.pool[t] = n;
    if (S.hp !== null && S.hp !== undefined) p.hp = Math.min(p.maxHp, S.hp);
    p.armor = 0; p.maxArmor = 0;   // cốt truyện: không có giáp tự hồi, chỉ có máu
    g.time = S.time ?? 0;
    this.enterMap(S.pos ?? null, S.at);
    this.fade = 1; this.fadeTo = 0;
    if (this.fromSave) { g.banner("Đã tải lần lưu cuối", "#a8e0ff", false, 2.2); this.callIf(this.def.onLoad); }
    else this.call(this.ch.intro);
  }
  makeW(d) {
    const def = WEAPONS[d.id];
    if (!def) return null;
    const w = makeWeapon(def, 1);
    if (d.name) { w.name = d.name; w.label = d.name; }
    if (w.mag && d.ammo !== undefined) w.ammo = Math.min(w.mag, d.ammo);
    return w;
  }

  /** Đặt người chơi + dựng đồ vật / zombie / bạn bè của phòng hiện tại */
  enterMap(pos = null, at = null) {
    const g = this.game, w = this.world, p = this.player, def = this.def;
    const m = at && w.markers[at];
    const spot = pos ?? (m ? w.spotOf(m) : w.spawn);
    p.x = spot.x; p.y = spot.y; p.vx = p.vy = 0; p.kx = p.ky = 0;
    if (m?.wall) { const side = w.doorSide(m); p.aim = side === "up" ? Math.PI / 2 : side === "down" ? -Math.PI / 2 : side === "left" ? 0 : Math.PI; }
    g.camera.snap(p.x, p.cy);
    // đồ đạc (vẽ theo chiều sâu)
    this.furn = w.furniture.map((f) => ({ x: f.x + f.w / 2, y: f.sortY, f, draw: (c, gm) => drawFurniture(c, f, gm.time) }));
    this.objs = []; this.npcs = [];
    const killed = new Set(this.S.killed[this.mapId] ?? []);
    for (const [key, od] of Object.entries(def.objects ?? {})) {
      const mk = w.markers[key];
      if (!mk) continue;
      const id = `${this.mapId}:${key}`;
      const o = { id, key, def: od, mk, spot: w.spotOf(mk), cx: mk.col * T + T / 2, cy: mk.row * T + T / 2, t: Math.random() * 6 };
      if (od.type === "zombie") {
        if (killed.has(id) || !this.test(od)) continue;
        this.spawnZombie(od.kind ?? "zWalker", o.spot.x, o.spot.y, { id, aggro: od.aggro, hp: od.hp, wander: od.wander });
        continue;
      }
      if (["item", "ammo", "weapon", "note"].includes(od.type) && this.S.taken[id]) continue;
      if (!this.test(od)) { if (od.type !== "door" && od.type !== "exit") continue; }
      if (od.type === "npc") { const n = new StoryNPC(o, o.spot.x, o.spot.y, g.actorSprites.get(od.char)); o.npc = n; this.npcs.push(n); }
      this.objs.push(o);
    }
    this.boltWindows = w.windows.length > 0 && def.rain !== false;
    this.S.at = null;
    this.S.pos = null;
    if (def.onEnter && !this.fromSaveEnter) this.callIf(def.onEnter);
    this.fromSaveEnter = false;
  }
  callIf(ev) { if (ev) this.call(ev); }

  /** Chuyển phòng: tối màn hình -> dựng phòng mới -> sáng dần */
  async goto(mapId, at) {
    if (!this.ch.maps[mapId]) { console.warn("Không có phòng", mapId); return; }
    const lock = this.lockInput;
    this.lockInput = true;
    await this.fadeOut(0.28);
    this.game.storySwitchMap(mapId);
    this.enterMap(null, at);
    this.fadeTo = 0; this.fadeSpeed = 2.4;
    this.game.banner(this.def.name ?? "", "#c8c0d8", false, 1.8);
    this.lockInput = lock;
  }
  fadeOut(t = 0.4) { this.fadeTo = 1; this.fadeSpeed = 1 / Math.max(0.05, t); return this.wait(t + 0.05); }

  // ---------------------------------------------------------------- ZOMBIE
  spawnZombie(kind, x, y, o = {}) {
    const g = this.game;
    const e = Enemy.obtain(kind, x, y, { hpMul: (this.ch.zombieHp ?? 2.2) * (o.hp ?? 1), speedMul: this.ch.zombieSpeed ?? 1, dmgBonus: 0 }, g.actorSprites);
    e.story = { id: o.id ?? null, hx: x, hy: y, wander: o.wander !== false, t: rand(0.5, 2.5), seen: false };
    e.passive = !o.aggro;
    e.goalX = x; e.goalY = y;
    if (!o.rise) e.spawnTime = 0;
    g.enemies.push(e);
    if (o.aggro) this.aggro(e, true);
    return e;
  }
  aggro(e, quiet = false) {
    if (!e.passive && e.story?.seen) return;
    e.passive = false;
    if (e.story) e.story.seen = true;
    e.alertT = 0.8;
    if (!quiet) { this.audio.growl(this.game.sound, 0.7); e.story.bang = 1; }
  }
  /** Tiếng súng: zombie trong tầm nghe lao tới */
  noise(x, y, r) {
    const rr = (r * 0.55) ** 2;
    for (const e of this.game.enemies) if (e.story && e.passive && (e.x - x) ** 2 + (e.y - y) ** 2 < rr) this.aggro(e);
  }
  onKill(e) {
    this.S.kills++;
    if (e.story?.id) (this.S.killed[this.mapId] ??= []).push(e.story.id);
    if (e.story?.onDie) this.call(e.story.onDie);
  }

  // ---------------------------------------------------------------- KỊCH BẢN SỰ KIỆN
  /** Chạy 1 sự kiện (tên trong chapter.events hoặc mảng lệnh). Trong lúc chạy người chơi bị khóa điều khiển. */
  async call(ev, opts = {}) {
    const steps = typeof ev === "string" ? this.ch.events?.[ev] : ev;
    if (!steps) { if (ev) console.warn("Không có sự kiện", ev); return; }
    this.busy++;
    if (!opts.free) this.lockInput = true;
    try { await this.exec(steps); } catch (err) { console.error("Lỗi kịch bản", ev, err); }
    finally {
      if (--this.busy <= 0) { this.busy = 0; this.lockInput = false; this.autoWalk = null; this.faceAng = null; this.paused = false; }
    }
  }
  async exec(steps) {
    for (const st of steps) {
      if (this.aborted) return;
      if (typeof st === "function") { await st(this); continue; }
      if (!Array.isArray(st)) continue;
      const [op, ...a] = st;
      const fn = OPS[op];
      if (!fn) { console.warn("Lệnh kịch bản lạ:", op); continue; }
      const r = fn.apply(this, a);
      if (r && typeof r.then === "function") await r;
      if (r === STOP) return;
    }
  }
  wait(s) { return new Promise((res) => this.timers.push({ t: s, res })); }

  /** Người nói: id nhân vật ("phong"), "" = lời dẫn, hoặc { name, char } */
  speaker(who) {
    if (!who) return { name: "", charId: null };
    if (typeof who === "object") { const c = CHARACTERS.find((x) => x.id === who.char); return { name: who.name ?? c?.name ?? "", charId: who.char ?? null, color: who.color ?? c?.skill?.color }; }
    const c = CHARACTERS.find((x) => x.id === who);
    return c ? { name: c.name, charId: c.id, color: c.skill?.color } : { name: who, charId: null };
  }
  async say(who, text, extra = {}) {
    this.paused = true;
    this.ui.onBlip = () => this.audio.blip(this.game.sound);
    await this.ui.say({ ...this.speaker(who), text, ...extra });
    this.paused = false;
  }

  // ---------------------------------------------------------------- TƯƠNG TÁC (E)
  findInteract(p) {
    if (this.busy || this.paused) return null;
    let best = null, bd = STORY_CFG.interactR ** 2;
    for (const o of this.objs) {
      const t = o.def.type;
      if (t === "zombie" || t === "trigger" || t === "spawn" || t === "exit") continue;
      if (t !== "door" && !this.test(o.def)) continue;
      if (o.def.hidden && !this.test(o.def.hidden)) continue;
      const sx = o.npc ? o.npc.x : o.spot.x, sy = o.npc ? o.npc.y : o.spot.y;
      const d = (sx - p.x) ** 2 + (sy - p.y) ** 2 * 1.3;
      if (d < bd) { bd = d; best = o; }
    }
    if (!best) return null;
    const o = best, t = o.def.type;
    const label = o.def.label ?? { door: "Mở cửa", item: "Nhặt", ammo: "Nhặt đạn", weapon: "Nhặt vũ khí", note: "Đọc", save: "Ghi nhật ký (Lưu game)", look: "Xem", npc: "Nói chuyện" }[t] ?? "Xem";
    const lx = o.npc ? o.npc.x : o.mk.wall ? o.cx : o.spot.x;
    const ly = o.npc ? o.npc.y - 46 : o.mk.wall ? o.mk.row * T - 14 : o.spot.y - 22;
    return { kind: "story", ref: o, label, x: lx, y: ly };
  }
  interact(t) { if (t.kind === "story" && !this.busy) this.call([(s) => s.use(t.ref)]); }

  async use(o) {
    const d = o.def, g = this.game, A = this.audio, snd = g.sound;
    switch (d.type) {
      case "door": {
        const openFlag = `open:${o.id}`;
        if (d.locked && !this.flag(openFlag) && !(d.unlockFlag && this.flag(d.unlockFlag))) {
          if (d.key && this.has(d.key)) {
            A.door(snd);
            await this.say("", d.unlockText ?? `Dùng **${this.items[d.key]?.name ?? d.key}** mở khóa.`);
            if (d.consume !== false) this.take(d.key);
            this.S.flags[openFlag] = true;
          } else {
            A.locked(snd);
            await this.say(d.lockWho ?? "", d.lockText ?? "Cửa khóa chặt.");
            if (d.lockEvent) await this.call(d.lockEvent);
            return;
          }
        }
        if (d.event) { await this.exec(this.ch.events[d.event] ?? []); if (!d.to) return; }
        if (d.to) { A.door(snd); await this.goto(d.to[0], d.to[1]); }
        return;
      }
      case "item": {
        A.item(snd);
        this.give(d.item, d.n ?? 1);
        this.S.taken[o.id] = true;
        this.objs = this.objs.filter((q) => q !== o);
        const it = this.items[d.item];
        await this.say("", d.text ?? `Nhặt được: **${it?.name ?? d.item}**${(d.n ?? 1) > 1 ? ` x${d.n}` : ""}.`);
        if (d.event) await this.exec(this.ch.events[d.event] ?? []);
        return;
      }
      case "ammo": {
        A.item(snd);
        const tp = d.ammo === "auto" ? ammoTypeOf(this.player.weapons.find((w) => ammoTypeOf(w))) ?? "pistol" : d.ammo;
        addAmmo(tp, d.n ?? 6);
        this.S.taken[o.id] = true;
        this.objs = this.objs.filter((q) => q !== o);
        await this.say("", d.text ?? `Nhặt được **${d.n ?? 6} viên ${AMMO_TYPES[tp]?.name ?? "đạn"}**.`);
        return;
      }
      case "weapon": {
        A.item(snd);
        this.giveWeapon(d.weapon, d.name, d.ammo);
        this.S.taken[o.id] = true;
        this.objs = this.objs.filter((q) => q !== o);
        await this.say("", d.text ?? `Nhặt được **${d.name ?? WEAPONS[d.weapon]?.name}**.`);
        if (d.event) await this.exec(this.ch.events[d.event] ?? []);
        return;
      }
      case "note": {
        A.page(snd);
        if (!this.S.notes.some((n) => n.title === d.title)) this.S.notes.push({ title: d.title, text: d.text });
        if (d.takeAway !== false) { this.S.taken[o.id] = true; this.objs = this.objs.filter((q) => q !== o); }
        this.paused = true;
        await this.ui.showNote(d.title, d.text, d.style ?? "paper");
        this.paused = false;
        if (d.event) await this.exec(this.ch.events[d.event] ?? []);
        return;
      }
      case "save": return this.savePrompt(d);
      case "look": {
        if (d.event) return this.exec(this.ch.events[d.event] ?? []);
        const lines = Array.isArray(d.text) ? d.text : [d.text];
        for (const ln of lines) await this.say(d.who ?? "", ln);
        return;
      }
      case "npc": {
        if (o.npc) o.npc.faceLeft = this.player.x < o.npc.x;
        this.player.aim = Math.atan2(o.npc.y - this.player.y, o.npc.x - this.player.x);
        if (d.event) return this.exec(this.ch.events[d.event] ?? []);
        if (d.text) for (const ln of [].concat(d.text)) await this.say(d.char, ln);
        return;
      }
    }
  }
  giveWeapon(id, name, ammo) {
    const p = this.player, w = this.makeW({ id, name, ammo });
    if (!w) return;
    if (!p.weapons[1]) p.weapons[1] = p.weapons[0];
    p.weapons[0] = w;
    p.slot = 0;
  }
  async savePrompt(d = {}) {
    this.paused = true;
    const i = await this.ui.choose(d.text ?? "Một cuốn sổ cũ và cây bút. Ghi lại nhật ký?\n*(Lưu tiến trình — lần sau chơi tiếp từ đây)*", ["Ghi nhật ký (Lưu game)", "Thôi"]);
    if (i === 0) {
      this.save();
      this.audio.save(this.game.sound);
      await this.ui.say({ name: "", text: "Đã ghi nhật ký. *(Đã lưu game)*" });
    }
    this.paused = false;
  }
  /** Lưu toàn bộ tiến trình vào máy (localStorage) */
  save() {
    const p = this.player, S = this.S;
    S.saves++;
    const snap = {
      ...S, v: 1, map: this.mapId, pos: { x: Math.round(p.x), y: Math.round(p.y) }, at: null,
      hp: p.hp, time: this.game.time,
      weapons: p.weapons.filter(Boolean).map((w) => ({ id: w.def?.id ?? w.id, name: w.name, ammo: w.ammo })),
      ammo: { ...(AMMO.pool ?? {}) }, savedAt: Date.now(),
    };
    try { localStorage.setItem(SAVE_KEY(this.ch.id), JSON.stringify(snap)); } catch { /* đầy bộ nhớ */ }
  }
  hasSave() { return !!loadStorySave(this.ch.id); }

  // ---------------------------------------------------------------- TÚI ĐỒ / HỒI MÁU
  async openInventory() {
    const p = this.player;
    this.paused = true;
    const data = () => ({
      chapter: this.ch.short ?? this.ch.title, place: this.def.name ?? "", objective: this.S.objective, hp: p.hp, maxHp: p.maxHp,
      ammo: p.weapon?.mag ? `${p.weapon.ammo} | ${AMMO.pool?.[ammoTypeOf(p.weapon)] ?? 0}` : "—",
      items: Object.entries(this.S.inv).map(([id, n]) => { const it = this.items[id] ?? { name: id }; return { id, n, name: it.name, desc: it.desc, icon: it.icon, use: !!it.heal }; }),
      notes: this.S.notes,
    });
    let reopen = true;
    while (reopen) {
      reopen = false;
      await this.ui.openInv(data(), (id) => { if (this.useItem(id)) { this.ui.closeInv(); reopen = true; } }, async (n) => { this.ui.closeInv(); this.reading = n; reopen = true; });
      if (this.reading) { const n = this.reading; this.reading = null; this.audio.page(this.game.sound); await this.ui.showNote(n.title, n.text); }
    }
    this.paused = false;
  }
  useItem(id) {
    const it = this.items[id], p = this.player;
    if (!it?.heal || !this.has(id)) return false;
    if (p.hp >= p.maxHp) { this.game.banner("Máu đang đầy", "#a8e0ff"); return false; }
    this.take(id);
    this.game.healPlayer(Math.min(it.heal, p.maxHp - p.hp));
    this.audio.item(this.game.sound);
    this.game.banner(`Dùng ${it.name}`, "#7cff9a");
    return true;
  }
  quickHeal() {
    const order = Object.keys(this.items).filter((k) => this.items[k].heal && this.has(k)).sort((a, b) => this.items[a].heal - this.items[b].heal);
    if (!order.length) { this.game.banner("Không còn đồ hồi máu", "#ff7a5a"); return; }
    this.useItem(order[0]);
  }

  // ---------------------------------------------------------------- CẬP NHẬT
  /** Mỗi khung hình, kể cả khi đang hội thoại. Trả về true = thế giới đứng yên (đang mở hội thoại / ghi chú / túi đồ) */
  updateMeta(dt, input) {
    // hẹn giờ của kịch bản
    for (let i = this.timers.length - 1; i >= 0; i--) { const t = this.timers[i]; if ((t.t -= dt) <= 0) { this.timers.splice(i, 1); t.res(); } }
    // màn đen chuyển cảnh
    if (this.fade !== this.fadeTo) { const s = this.fadeSpeed * dt; this.fade = this.fade < this.fadeTo ? Math.min(this.fadeTo, this.fade + s) : Math.max(this.fadeTo, this.fade - s); }
    this.flashA = Math.max(0, this.flashA - dt * 2.2);
    if (!this.ended) this.S.time = this.game.time;
    const eaten = this.ui.update(dt, input);
    this.audioMix(dt);
    if (this.ended) return true;
    if (!this.busy && !this.paused && !eaten) {
      if (input.pressed.has("tab") || input.pressed.has("i")) { this.call([(s) => s.openInventory()]); return true; }
      if (input.pressed.has("f")) this.quickHeal();
    }
    return this.paused || eaten;
  }

  /** Khi thế giới đang chạy (sau khi quái đã cập nhật) */
  update(dt) {
    const g = this.game, p = this.player, cfg = STORY_CFG;
    // sét
    if (this.boltWindows) {
      this.nextBolt -= dt;
      if (this.nextBolt <= 0) { this.nextBolt = rand(...cfg.boltEvery); this.bolt = 1; this.audio.thunder(g.sound, rand(0.3, 1.2)); }
    }
    this.bolt = Math.max(0, this.bolt - dt * 2.5);
    // đèn trần chập chờn
    for (const L of this.world.lamps) {
      if (L.mode === "flicker") { L.ft = (L.ft ?? 0) - dt; if (L.ft <= 0) { L.on = !L.on; L.ft = L.on ? rand(0.4, 3.5) : rand(0.04, 0.25); } }
      else L.on = L.mode === "on";
    }
    // zombie: lững thững quanh chỗ cũ, thấy / nghe người chơi thì lao tới
    let near = 1e9;
    for (const e of g.enemies) {
      if (e.dead || !e.story) continue;
      const Z = e.story, d2 = (e.x - p.x) ** 2 + (e.y - p.y) ** 2;
      if (e.passive) {
        if (Z.wander) { Z.t -= dt; if (Z.t <= 0) { Z.t = rand(2, 4.5); e.goalX = Z.hx + rand(-26, 26); e.goalY = Z.hy + rand(-14, 14); if (!this.world.walkable(e.goalX, e.goalY, 6)) { e.goalX = Z.hx; e.goalY = Z.hy; } } }
        if (e.hurtT > 0 || d2 < cfg.touch ** 2 || (d2 < cfg.sight ** 2 && this.world.lineOfSight(e.x, e.y - 12, p.x, p.cy))) this.aggro(e);
      } else near = Math.min(near, d2);
      if (Z.bang > 0) Z.bang -= dt;
    }
    this.heart = near < 1e9 ? Math.max(0, 1 - Math.sqrt(near) / 220) : 0;
    if (p.hp <= p.maxHp * 0.3) this.heart = Math.max(this.heart, 0.5);
    for (const n of this.npcs) n.update(dt, p);
    for (const o of this.objs) o.t += dt;
    // vùng kích hoạt (đi vào là chạy sự kiện) + lối ra (đi vào là sang phòng khác)
    if (!this.busy) {
      for (const o of this.objs) {
        const d = o.def;
        if (d.type !== "trigger" && d.type !== "exit") continue;
        const w = (d.w ?? 1) * T, h = (d.h ?? 1) * T, x0 = o.mk.col * T - (w - T) / 2, y0 = o.mk.row * T - (h - T) / 2;
        const inside = !(p.x < x0 || p.x > x0 + w || p.y < y0 || p.y > y0 + h + 3);
        if (!inside) { o.cool = false; continue; }
        if (o.cool) continue;   // đã báo rồi: phải bước ra khỏi vùng mới báo lại (không kẹt lặp thông báo)
        if (d.type === "trigger") {
          if (!this.test(d) || (d.once !== false && this.S.flags[`trig:${o.id}`])) continue;
          this.S.flags[`trig:${o.id}`] = true;
          this.call(d.event);
          break;
        }
        // lối ra
        if (d.locked && !this.flag(`open:${o.id}`) && !(d.unlockFlag && this.flag(d.unlockFlag))) {
          if (d.key && this.has(d.key)) { this.S.flags[`open:${o.id}`] = true; if (d.consume !== false) this.take(d.key); this.call([["sfx", "gate"], ["say", "", d.unlockText ?? "Đã mở khóa."], ["goto", ...d.to]]); break; }
          // đẩy hẳn ra ngoài vùng, về phía mép gần nhất còn đi được
          o.cool = true;
          const opts = [[x0 - 8, p.y], [x0 + w + 8, p.y], [p.x, y0 - 8], [p.x, y0 + h + 12]].filter(([x, y]) => this.world.walkable(x, y, 6));
          opts.sort((A, B) => (A[0] - p.x) ** 2 + (A[1] - p.y) ** 2 - ((B[0] - p.x) ** 2 + (B[1] - p.y) ** 2));
          if (opts[0]) { p.x = opts[0][0]; p.y = opts[0][1]; o.cool = false; }
          p.vx = p.vy = 0;
          this.call([["sfx", "locked"], ["say", d.lockWho ?? "", d.lockText ?? "Không qua được."]]);
          break;
        }
        this.call([["goto", ...d.to]]);
        break;
      }
    }
  }

  audioMix(dt) {
    const def = this.def, P = this.player;
    const buzz = this.world?.lamps?.some((L) => L.mode === "flicker" && L.on && P && (L.x - P.x) ** 2 + (L.y - P.y) ** 2 < 120 * 120) ? 1 : 0;
    this.audio.update(this.game.sound, { rain: this.ended ? 0 : def?.rain === false ? 0.15 : def?.indoorRain ?? 0.55, drone: this.ended ? 0 : 0.9, buzz, heart: this.paused ? 0 : this.heart }, dt);
  }

  // ---------------------------------------------------------------- ÁNH SÁNG
  lights(add, cam) {
    const p = this.player, F = STORY_CFG.flashlight, w = this.world, t = this.game.time;
    // độ tối của phòng (sét đánh thì sáng bừng)
    const base = this.def.dark ?? 0.9;
    w.biome.light.alpha = Math.max(0.15, base * (1 - this.bolt * 0.75));
    if (p) {
      add(p.x, p.cy, F.ring, null, 0.95, 0);
      const flick = Math.random() < 0.004 ? 0.25 : 1;   // đèn pin thỉnh thoảng chập
      add(p.x + Math.cos(p.aim) * 5, p.cy + Math.sin(p.aim) * 5, F.range, "#fff2c0", flick, 0.07, { ang: p.aim, spread: F.spread });
    }
    for (const L of w.lamps) if (L.on && cam.inView(L.x, L.y, L.r)) add(L.x, L.y, L.r * (0.97 + Math.sin(t * 9 + L.seed) * 0.03), L.color, L.a, 0.12);
    for (const f of w.furniture) if (f.kind === "vending" && cam.inView(f.x, f.y, 40)) add(f.x + 8, f.y - 4, 34, "#9ad8ff", 0.55, 0.18);
    for (const wd of w.windows) { const x = wd.col * T + 8, y = wd.row * T + 20; if (cam.inView(x, y, 40)) add(x, y + 10, 26 + this.bolt * 60, "#8ab4ff", 0.28 + this.bolt * 0.7, 0.1); }
    for (const o of this.objs) {
      const tp = o.def.type;
      if (tp === "save") add(o.cx, o.cy, 34 + Math.sin(t * 3) * 3, "#ffd27a", 0.75, 0.25);
      else if ((tp === "item" || tp === "ammo" || tp === "weapon" || tp === "note") && !o.def.hidden) add(o.cx, o.cy + 4, 12, "#ffe9a8", 0.35 + 0.25 * Math.sin(t * 4 + o.t), 0.12);
    }
  }

  // ---------------------------------------------------------------- VẼ
  drawGround(c) {
    const t = this.game.time;
    for (const o of this.objs) {
      const tp = o.def.type;
      if (o.def.hidden) continue;
      const x = Math.round(o.cx), y = Math.round(o.cy + 4);
      if (tp === "item") drawItemSprite(c, this.items[o.def.item]?.draw ?? "key", x, y, t + o.t);
      else if (tp === "ammo") drawAmmoBox(c, o.def.ammo === "auto" ? "pistol" : o.def.ammo, x, y + 2, 1);
      else if (tp === "weapon") drawItemSprite(c, "gun", x, y, t + o.t);
      else if (tp === "note") drawItemSprite(c, "paper", x, y, t + o.t);
      else if (tp === "save") drawItemSprite(c, "journal", x, y, t + o.t);
      // ánh lấp lánh: có thứ để nhặt
      if (tp === "item" || tp === "ammo" || tp === "weapon" || tp === "note") {
        const k = (t * 1.2 + o.t) % 2.4;
        if (k < 0.5) { c.fillStyle = `rgba(255,255,230,${1 - k * 2})`; c.fillRect(x + 4, y - 7, 1, 3); c.fillRect(x + 3, y - 6, 3, 1); }
      }
    }
  }
  collectActors(list) {
    const cam = this.game.camera;
    for (const f of this.furn) if (cam.inView(f.x, f.y, 60)) list.push(f);
    for (const n of this.npcs) if (this.test(n.o.def)) list.push(n);
  }
  drawOverlay(c) {
    const t = this.game.time;
    // mắt zombie đỏ lừ trong bóng tối
    for (const e of this.game.enemies) {
      if (e.dead || !e.story || e.spawnTime > 0.1) continue;
      const fx = Math.cos(e.facing ?? 0) >= 0 ? 1 : -1, x = Math.round(e.x + fx * 2), y = Math.round(e.y - 25 * (e.cfg.scale ?? 1));
      const a = e.passive ? 0.35 + 0.25 * Math.sin(t * 3 + e.serial) : 0.9;
      c.fillStyle = `rgba(255,40,30,${a})`; c.fillRect(x - 2, y, 1, 1); c.fillRect(x + 1, y, 1, 1);
      if (e.story.bang > 0) { c.fillStyle = "#ff3b3b"; c.font = "bold 9px monospace"; c.textAlign = "center"; c.fillText("!", x, y - 12 - (1 - e.story.bang) * 4); c.textAlign = "left"; }
    }
  }

  /** HUD gọn kiểu game kinh dị (thay HUD đấu trường) */
  drawHUD(c, W, H) {
    const p = this.player, g = this.game;
    if (this.ended) return;
    c.save();
    c.font = "8px monospace"; c.textBaseline = "top";
    // tên + máu
    HUD.panel(c, 4, 4, 112, 34, "#3a2a34");
    HUD.text(c, p.char.name, 8, 7, p.char.skill?.color ?? "#ffe26b");
    const k = p.hp / p.maxHp;
    HUD.drawBar(c, 8, 17, 104, 7, k, k > 0.6 ? "#c83040" : k > 0.3 ? "#e07020" : "#ff2030", k > 0.6 ? "#ff6a78" : "#ffb070", `${p.hp}/${p.maxHp}`, { id: "story-hp", low: k <= 0.3 });
    // vũ khí + đạn
    const w = p.weapon;
    c.font = "7px monospace";
    if (w) {
      const am = w.mag ? (w.reloadT > 0 ? "đang nạp..." : `${w.ammo} | ${AMMO.pool?.[ammoTypeOf(w)] ?? 0}`) : "cận chiến";
      HUD.text(c, `${w.label ?? w.name}`, 8, 27, "#d8d0e8");
      HUD.text(c, am, 112 - c.measureText(am).width, 27, w.mag && w.ammo === 0 ? "#ff5a4a" : "#ffe9a8");
    }
    // đồ hồi máu
    const heals = Object.keys(this.S.inv).filter((id) => this.items[id]?.heal).reduce((n, id) => n + this.S.inv[id], 0);
    HUD.text(c, `Hồi máu x${heals} [F] · Túi đồ [Tab]`, 6, 41, "#9a92b4");
    // nơi đang đứng
    c.textAlign = "right";
    HUD.text(c, this.def.name ?? "", W - 6, 6, "#c8c0d8");
    HUD.text(c, this.ch.short ?? "", W - 6, 16, "#6e6888");
    c.textAlign = "left";
    // mục tiêu
    if (this.S.objective) {
      c.font = "7px monospace";
      const s = `▸ ${this.S.objective}`, tw = c.measureText(s).width;
      c.fillStyle = "rgba(10,6,14,0.6)"; c.fillRect(4, H - 16, tw + 8, 12);
      HUD.text(c, s, 8, H - 14, "#e8d8a8");
    }
    HUD.drawBanners(c, W, H, g.banners, 52, W - 12, true);
    c.restore();
  }
  /** Hiệu ứng toàn màn hình (đè lên HUD): viền tối dày, hạt nhiễu phim, chớp sét, màu máu, màn đen chuyển cảnh */
  drawScreen(c, W, H) {
    c.drawImage(this.vignette, 0, 0);
    c.globalAlpha = 0.07; c.drawImage(this.grain[(this.game.time * 24 | 0) & 3], 0, 0); c.globalAlpha = 1;
    if (this.bolt > 0.6) { c.fillStyle = `rgba(210,225,255,${(this.bolt - 0.6) * 0.5})`; c.fillRect(0, 0, W, H); }
    if (this.flashA > 0) { c.fillStyle = this.flashCol; c.globalAlpha = Math.min(1, this.flashA); c.fillRect(0, 0, W, H); c.globalAlpha = 1; }
    if (this.fade > 0) { c.fillStyle = `rgba(0,0,0,${this.fade})`; c.fillRect(0, 0, W, H); }
  }

  // ---------------------------------------------------------------- CHẾT / KẾT THÚC
  onDeath() { this.aborted = true; this.lockInput = false; this.paused = false; this.ui.hideAll(); this.audio.sting(this.game.sound); }
  complete(info = {}) {
    this.ended = true;
    markDone(this.ch.id);
    this.ui.hideAll();
    this.ui.showEnd({ kicker: info.kicker ?? this.ch.short, title: info.title ?? "HẾT CHƯƠNG", text: info.text ?? "", time: fmtT(this.S.time), kills: this.S.kills, saves: this.S.saves, notes: this.S.notes.length }, () => this.game.goMenu("story"));
  }
  stop() { this.aborted = true; this.audio.stop(); this.ui.hide(); AMMO.pool = null; }
}

const STOP = Symbol("stop");

// =====================================================================================
//  CÁC LỆNH KỊCH BẢN — dùng trong chapter.events: ["tên lệnh", tham số...]
// =====================================================================================
const OPS = {
  /** ["say", người, "lời thoại"] — người: id nhân vật ("phong"), "" = lời dẫn, { name, char } */
  say(who, text, extra) { return this.say(who, text, extra); },
  /** ["think", người, "suy nghĩ"] — chữ nghiêng */
  think(who, text) { return this.say(who, text, { italic: true }); },
  /** ["choice", "câu hỏi", { "Lựa chọn 1": [lệnh...], "Lựa chọn 2": [lệnh...] }, người?] */
  async choice(prompt, opts, who) {
    this.paused = true;
    const keys = Object.keys(opts), i = await this.ui.choose(prompt, keys, who ? this.speaker(who) : null);
    this.paused = false;
    this.lastChoice = keys[i];
    await this.exec(opts[keys[i]] ?? []);
  },
  /** ["note", "tiêu đề", "nội dung"] — hiện tờ giấy / tài liệu (và cất vào túi đồ) */
  async note(title, text, style) {
    if (!this.S.notes.some((n) => n.title === title)) this.S.notes.push({ title, text });
    this.audio.page(this.game.sound);
    this.paused = true; await this.ui.showNote(title, text, style); this.paused = false;
  },
  wait(s) { return this.wait(s); },
  /** ["title", "CHƯƠNG 1", "dòng nhỏ"] — thẻ tiêu đề lớn giữa màn hình */
  title(big, small, dur = 3.2) { return this.ui.showTitle(big, small, dur); },
  objective(text) { this.S.objective = text; this.game.banner(`Mục tiêu: ${text}`, "#e8d8a8", false, 2.6); },
  banner(text, color = "#ffe26b") { this.game.banner(text, color, false, 2.4); },
  flag(name, v = true) { this.S.flags[name] = v; },
  unflag(name) { delete this.S.flags[name]; },
  give(id, n = 1) { this.give(id, n); this.audio.item(this.game.sound); },
  take(id, n = 1) { this.take(id, n); },
  ammo(type, n) { addAmmo(type, n); },
  weapon(id, name, ammo) { this.giveWeapon(id, name, ammo); },
  heal(n = 99) { this.game.healPlayer(Math.min(n, this.player.maxHp - this.player.hp)); },
  /** ["if", điều kiện, [lệnh nếu đúng], [lệnh nếu sai]] — điều kiện: "cờ", "!cờ", { ifItem: "chìa" }, hàm */
  async if(cond, yes = [], no = []) { await this.exec(this.test(cond) ? yes : no); },
  call(name) { return this.exec(this.ch.events[name] ?? []); },
  /** ["goto", "id phòng", "điểm đánh dấu"] */
  goto(map, at) { return this.goto(map, at); },
  /** ["spawn", "zWalker", "điểm", { aggro, rise, hp }] — zombie xuất hiện */
  spawn(kind, at, o = {}) {
    const m = this.world.markers[at];
    if (!m) return;
    const s = this.world.spotOf(m);
    const e = this.spawnZombie(kind, s.x, s.y, { aggro: true, rise: true, ...o });
    if (o.onDie) e.story.onDie = o.onDie;
  },
  /** ["npc", "điểm", "id nhân vật", { face }] — thêm 1 người đứng ở điểm đánh dấu */
  npc(at, char, o = {}) {
    const m = this.world.markers[at];
    if (!m) return;
    const spot = this.world.spotOf(m), obj = { id: `${this.mapId}:npc:${at}`, key: at, def: { type: "npc", char, ...o }, mk: m, spot, cx: spot.x, cy: spot.y, t: 0 };
    obj.npc = new StoryNPC(obj, spot.x, spot.y, this.game.actorSprites.get(char));
    this.npcs.push(obj.npc); this.objs.push(obj);
  },
  npcGone(at) { this.npcs = this.npcs.filter((n) => n.o.key !== at); this.objs = this.objs.filter((o) => !(o.npc && o.key === at)); },
  /** ["walk", "điểm"] — người chơi tự đi tới điểm đánh dấu (diễn cảnh) */
  async walk(at, timeout = 4) {
    const m = this.world.markers[at];
    if (!m) return;
    const s = this.world.spotOf(m), p = this.player;
    this.autoWalk = s;
    let t = 0;
    while ((p.x - s.x) ** 2 + (p.y - s.y) ** 2 > 16 && t < timeout && !this.aborted) { await this.wait(0.05); t += 0.05; }
    this.autoWalk = null;
  },
  /** ["face", góc độ hoặc "up"/"down"/"left"/"right"] */
  face(dir) { this.faceAng = typeof dir === "number" ? dir : { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 }[dir] ?? 0; this.player.aim = this.faceAng; },
  /** ["lights", "on" | "off" | "flicker"] — đèn trần cả phòng */
  lights(mode) { for (const L of this.world.lamps) L.mode = mode; },
  /** ["dark", 0.95] — độ tối của phòng (0 sáng – 1 tối mịt) */
  dark(a) { this.def.dark = a; },
  thunder() { this.bolt = 1; this.audio.thunder(this.game.sound, 0.2); },
  /** ["scare"] — JUMP SCARE: chớp đỏ + tiếng rít + rung mạnh */
  scare() { this.flashCol = "#600008"; this.flashA = 1.1; this.audio.scare(this.game.sound); this.game.shake(0.5, 6); },
  shake(t = 0.3, amp = 3) { this.game.shake(t, amp); },
  flash(color = "#ffffff", t = 0.6) { this.flashCol = color; this.flashA = t; },
  /** ["sfx", "door" | "locked" | "gate" | "bang" | "growl" | "page" | "item" | "save" | "sting" | "heartbeat"] hoặc tên âm thanh của game */
  sfx(name, vol = 0.6) { const A = this.audio; if (typeof A[name] === "function") A[name](this.game.sound, vol); else this.game.sound.play(name, vol); },
  /** ["fade", "out"|"in", giây] */
  fade(dir, t = 0.6) { if (dir === "out") return this.fadeOut(t); this.fadeTo = 0; this.fadeSpeed = 1 / Math.max(0.05, t); return this.wait(t); },
  save() { return this.savePrompt(); },
  /** ["end", { title, text }] — hết chương */
  end(info) { this.complete(info); return STOP; },
};

// =====================================================================================
//  HÌNH VẼ VẬT PHẨM NHỎ TRÊN SÀN
// =====================================================================================
function drawItemSprite(c, kind, x, y, t) {
  const R = (col, a, b, w, h) => { c.fillStyle = col; c.fillRect(x + a, y + b, w, h); };
  R("rgba(0,0,0,0.35)", -5, 1, 10, 2);
  const bob = Math.round(Math.sin(t * 2.5));
  y += bob - 1;
  switch (kind) {
    case "key": R("#2a2010", -5, -4, 11, 5); R("#e8c040", -4, -3, 4, 3); R("#e8c040", 0, -2, 5, 1); R("#e8c040", 3, -2, 1, 2); R("#fff0a0", -4, -3, 1, 1); break;
    case "bandage": R("#3a3a3a", -4, -5, 9, 7); R("#f0ece0", -3, -4, 7, 5); R("#d84040", -1, -4, 2, 5); R("#d84040", -3, -2, 7, 1); break;
    case "medkit": R("#2a0a0a", -5, -7, 11, 9); R("#d83030", -4, -6, 9, 7); R("#ffffff", -1, -5, 2, 5); R("#ffffff", -3, -3, 6, 1); break;
    case "can": R("#1a1a1a", -3, -7, 6, 9); R("#7a4a2a", -2, -6, 4, 7); R("#c8a060", -2, -4, 4, 2); R("#d0d0d0", -2, -7, 4, 1); break;
    case "paper": R("#2a2820", -4, -4, 9, 6); R("#e8e4d4", -3, -3, 7, 4); R("#8a8678", -2, -2, 5, 1); R("#8a8678", -2, 0, 3, 1); break;
    case "journal": R("#1a0e08", -5, -5, 11, 7); R("#6a3a20", -4, -4, 9, 5); R("#e8e0c8", -4, -4, 4, 5); R("#d84040", 2, -6, 1, 4); break;
    case "gun": R("#0a0a0c", -6, -4, 12, 5); R("#4a4a52", -5, -3, 10, 2); R("#3a3a40", -4, -1, 3, 3); R("#8a8a96", -5, -3, 6, 1); break;
    case "phone": R("#0a0a0c", -3, -6, 6, 9); R("#3a6aa8", -2, -5, 4, 6); break;
    default: R("#e8c040", -2, -3, 4, 4);
  }
}

function makeGrain(w, h) {
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  const g = cv.getContext("2d"), img = g.createImageData(w, h), d = img.data;
  for (let i = 0; i < w * h; i++) { const on = Math.random() < 0.18; const v = Math.random() < 0.5 ? 0 : 255; d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v; d[i * 4 + 3] = on ? 255 : 0; }
  g.putImageData(img, 0, 0);
  return cv;
}

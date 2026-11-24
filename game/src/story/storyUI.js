// =====================================================================================
//  GIAO DIỆN CỐT TRUYỆN (HTML phủ lên canvas — chữ sắc nét, đọc dễ)
//    hộp HỘI THOẠI có chân dung + gõ chữ từng ký tự · LỰA CHỌN · GHI CHÚ / TÀI LIỆU · TÚI ĐỒ
//    THẺ TIÊU ĐỀ CHƯƠNG · màn BẠN ĐÃ CHẾT · màn HẾT CHƯƠNG
//  Phím: E / Enter / Space = tiếp · ↑↓ (W S) chọn · Esc / Tab đóng. Chuột / chạm cũng được.
// =====================================================================================

const TYPE_SPEED = 55;    // ký tự / giây khi gõ chữ hội thoại

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
/** *chữ nghiêng* · **chữ đậm** · [r]chữ đỏ[/r] trong lời thoại */
const rich = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/\*(.+?)\*/g, "<i>$1</i>").replace(/\[r\](.+?)\[\/r\]/g, '<span class="sr-red">$1</span>').replace(/\n/g, "<br>");

function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; }

export class StoryUI {
  constructor(stage, sprites, sound) {
    this.sprites = sprites;
    this.sound = sound;
    this.root = el("section", "story-ui hidden");
    this.root.setAttribute("aria-live", "polite");
    stage.appendChild(this.root);
    // --- hội thoại ---
    this.dlg = el("div", "sd-box hidden");
    this.dlgFace = el("canvas", "sd-face"); this.dlgFace.width = 26; this.dlgFace.height = 24;
    this.dlgName = el("div", "sd-name");
    this.dlgText = el("div", "sd-text");
    this.dlgMore = el("div", "sd-more", "▼");
    this.dlgChoices = el("ol", "sd-choices hidden");
    const body = el("div", "sd-body"); body.append(this.dlgName, this.dlgText, this.dlgChoices);
    this.dlg.append(this.dlgFace, body, this.dlgMore);
    this.dlg.addEventListener("pointerdown", (e) => { if (!e.target.closest(".sd-choices")) this.advance(); });
    // --- ghi chú ---
    this.note = el("div", "sn-wrap hidden");
    this.noteCard = el("article", "sn-card");
    this.note.appendChild(this.noteCard);
    this.note.addEventListener("pointerdown", () => this.closeNote());
    // --- túi đồ ---
    this.inv = el("div", "si-wrap hidden");
    this.inv.addEventListener("pointerdown", (e) => { if (e.target === this.inv) this.closeInv?.(); });
    // --- tiêu đề chương ---
    this.title = el("div", "st-title hidden");
    // --- màn chết / hết chương ---
    this.over = el("div", "so-wrap hidden");
    // nút túi đồ (điện thoại không có phím Tab)
    this.bag = el("button", "su-bag", "🎒<small>Túi đồ</small>");
    this.bag.type = "button";
    this.bag.addEventListener("pointerdown", (e) => { e.stopPropagation(); this.onBag?.(); });
    this.root.append(this.title, this.bag, this.dlg, this.note, this.inv, this.over);
    this.cur = null;       // widget đang mở: { kind, resolve, ... }
  }

  show() { this.root.classList.remove("hidden"); }
  hide() { this.root.classList.add("hidden"); this.hideAll(); }
  hideAll() {
    for (const e of [this.dlg, this.note, this.inv, this.title, this.over]) e.classList.add("hidden");
    this.cur = null;
  }
  get busy() { return !!this.cur; }

  // ---------------------------------------------------------------- CHÂN DUNG
  /** Vẽ phần đầu của nhân vật (frame đứng yên) vào canvas chân dung */
  drawFace(cv, charId, mood = 0) {
    const g = cv.getContext("2d");
    g.clearRect(0, 0, cv.width, cv.height);
    const S = charId && this.sprites?.get(charId);
    if (!S) { cv.classList.add("none"); return; }
    cv.classList.remove("none");
    const a = S.maskActor(), sh = S.sheet, idle = S.anims.idle ?? Object.values(S.anims)[0];
    const col = idle.seq ? idle.seq[mood ? 8 : 0] ?? 0 : 0, row = idle.row ?? 0;
    const top = Math.round(sh.anchorY + a.y) - 1;
    const sx = sh.sx[col] + Math.round(sh.anchorX) - 13, sy = sh.sy[row] + top;
    g.imageSmoothingEnabled = false;
    g.drawImage(sh.image, sx, sy, 26, 24, 0, 0, 26, 24);
  }

  // ---------------------------------------------------------------- HỘI THOẠI
  /** line = { name, charId, text, color, italic, mood } -> Promise (bấm tiếp) */
  say(line) {
    this.show();
    this.dlgChoices.classList.add("hidden");
    this.dlg.classList.remove("hidden", "narr", "think");
    if (!line.name) this.dlg.classList.add("narr");
    if (line.italic) this.dlg.classList.add("think");
    this.dlgName.textContent = line.name ?? "";
    this.dlgName.style.color = line.color ?? "";
    this.dlgName.classList.toggle("hidden", !line.name);
    this.drawFace(this.dlgFace, line.charId, line.mood);
    this.dlgFace.classList.toggle("hidden", !line.charId);
    this.full = rich(line.text);
    this.plain = String(line.text ?? "");
    this.shown = 0; this.typing = true;
    this.dlgText.innerHTML = "";
    this.dlgMore.classList.add("hidden");
    return new Promise((resolve) => { this.cur = { kind: "say", resolve }; });
  }
  /** Bấm tiếp: đang gõ -> hiện hết; đã hiện hết -> sang câu sau */
  advance() {
    const c = this.cur;
    if (!c || (c.kind !== "say")) return;
    if (this.typing) { this.typing = false; this.dlgText.innerHTML = this.full; this.dlgMore.classList.remove("hidden"); return; }
    this.cur = null;
    this.dlg.classList.add("hidden");
    c.resolve();
  }

  /** Lựa chọn: hiện trong hộp thoại -> Promise<chỉ số> */
  choose(prompt, options, who = null) {
    this.show();
    this.dlg.classList.remove("hidden", "narr", "think");
    this.dlgFace.classList.toggle("hidden", !who?.charId);
    if (who?.charId) this.drawFace(this.dlgFace, who.charId);
    this.dlgName.textContent = who?.name ?? "";
    this.dlgName.classList.toggle("hidden", !who?.name);
    if (!who?.name) this.dlg.classList.add("narr");
    this.dlgText.innerHTML = rich(prompt);
    this.typing = false;
    this.dlgMore.classList.add("hidden");
    this.dlgChoices.innerHTML = "";
    options.forEach((o, i) => {
      const li = el("li", "", `<button type="button">${rich(o)}</button>`);
      li.firstChild.addEventListener("pointerdown", (e) => { e.stopPropagation(); this.pick(i); });
      this.dlgChoices.appendChild(li);
    });
    this.dlgChoices.classList.remove("hidden");
    return new Promise((resolve) => { this.cur = { kind: "choice", resolve, sel: 0, n: options.length }; this.markChoice(); });
  }
  markChoice() { [...this.dlgChoices.children].forEach((li, i) => li.classList.toggle("on", i === this.cur.sel)); }
  pick(i) {
    const c = this.cur;
    if (!c || c.kind !== "choice") return;
    this.cur = null;
    this.dlgChoices.classList.add("hidden");
    this.dlg.classList.add("hidden");
    this.sound?.play?.("uiSelect", 0.4);
    c.resolve(i);
  }

  // ---------------------------------------------------------------- GHI CHÚ
  showNote(title, text, kind = "paper") {
    this.show();
    this.noteCard.className = `sn-card sn-${kind}`;
    this.noteCard.innerHTML = `<h3>${esc(title)}</h3><div class="sn-text">${rich(text)}</div><p class="sn-hint">E / Enter / bấm để đóng</p>`;
    this.note.classList.remove("hidden");
    return new Promise((resolve) => { this.cur = { kind: "note", resolve }; });
  }
  closeNote() {
    const c = this.cur;
    if (!c || c.kind !== "note") return;
    this.cur = null;
    this.note.classList.add("hidden");
    c.resolve();
  }

  // ---------------------------------------------------------------- TÚI ĐỒ
  /** data = { items: [{ id, name, n, desc, icon, use }], notes: [{ title, text }], objective, hp, maxHp, chapter, place } */
  openInv(data, onUse, onRead) {
    this.show();
    const items = data.items.length ? data.items.map((it, i) => `<li class="si-item${it.use ? " usable" : ""}" data-i="${i}"><i class="si-ico">${it.icon ?? "◆"}</i><b>${esc(it.name)}</b>${it.n > 1 ? `<small>x${it.n}</small>` : ""}<p>${esc(it.desc ?? "")}</p>${it.use ? `<button type="button" data-use="${i}">Dùng</button>` : ""}</li>`).join("") : `<li class="si-empty">Túi trống trơn.</li>`;
    const notes = data.notes.length ? data.notes.map((n, i) => `<li><button type="button" data-note="${i}">📄 ${esc(n.title)}</button></li>`).join("") : `<li class="si-empty">Chưa nhặt được tài liệu nào.</li>`;
    this.inv.innerHTML = `<div class="si-card">
      <header><h2>TÚI ĐỒ</h2><span>${esc(data.chapter)} · ${esc(data.place)}</span><button type="button" class="si-x" aria-label="Đóng">✕</button></header>
      <p class="si-obj">Mục tiêu: <b>${esc(data.objective || "—")}</b></p>
      <p class="si-hp">Tình trạng: <b class="${data.hp <= data.maxHp * 0.3 ? "bad" : data.hp <= data.maxHp * 0.6 ? "mid" : "ok"}">${data.hp <= data.maxHp * 0.3 ? "Nguy kịch" : data.hp <= data.maxHp * 0.6 ? "Bị thương" : "Ổn"}</b> (${data.hp}/${data.maxHp} máu) · Đạn: <b>${esc(data.ammo)}</b></p>
      <div class="si-cols"><section><h3>Vật phẩm</h3><ul class="si-items">${items}</ul></section><section><h3>Tài liệu</h3><ul class="si-notes">${notes}</ul></section></div>
      <p class="si-hint">Tab / I / Esc: đóng · F: dùng băng gạc nhanh</p></div>`;
    this.inv.querySelector(".si-x").addEventListener("pointerdown", () => this.closeInv());
    this.inv.querySelectorAll("[data-use]").forEach((b) => b.addEventListener("pointerdown", (e) => { e.stopPropagation(); onUse(data.items[+b.dataset.use].id); }));
    this.inv.querySelectorAll("[data-note]").forEach((b) => b.addEventListener("pointerdown", (e) => { e.stopPropagation(); onRead(data.notes[+b.dataset.note]); }));
    this.inv.classList.remove("hidden");
    return new Promise((resolve) => { this.cur = { kind: "inv", resolve }; this.closeInv = () => { if (this.cur?.kind !== "inv") return; this.cur = null; this.inv.classList.add("hidden"); resolve(); }; });
  }

  // ---------------------------------------------------------------- TIÊU ĐỀ CHƯƠNG
  showTitle(big, small, dur = 3.2) {
    this.show();
    this.title.innerHTML = `<small>${esc(small ?? "")}</small><h1>${esc(big)}</h1>`;
    this.title.classList.remove("hidden");
    this.title.style.animation = "none"; void this.title.offsetWidth; this.title.style.animation = `stTitle ${dur}s ease forwards`;
    return new Promise((resolve) => setTimeout(() => { this.title.classList.add("hidden"); resolve(); }, dur * 1000));
  }

  // ---------------------------------------------------------------- CHẾT / HẾT CHƯƠNG
  showDeath(hasSave, onRetry, onMenu) {
    this.show();
    this.over.className = "so-wrap so-dead";
    this.over.innerHTML = `<div class="so-card"><h2>BẠN ĐÃ CHẾT</h2><p>Bóng tối nuốt chửng tất cả...</p>
      <div class="so-btns"><button type="button" class="btn-start" data-a="retry">${hasSave ? "TẢI LẦN LƯU CUỐI" : "CHƠI LẠI CHƯƠNG"}<small>Enter</small></button>
      <button type="button" class="btn-secondary" data-a="menu">VỀ DANH SÁCH CHƯƠNG<small>Esc</small></button></div></div>`;
    this.over.querySelector('[data-a="retry"]').addEventListener("click", onRetry);
    this.over.querySelector('[data-a="menu"]').addEventListener("click", onMenu);
    this.over.classList.remove("hidden");
    this.cur = { kind: "over", retry: onRetry, menu: onMenu };
  }
  showEnd(info, onMenu) {
    this.show();
    this.over.className = "so-wrap so-end";
    this.over.innerHTML = `<div class="so-card"><small>${esc(info.kicker ?? "")}</small><h2>${esc(info.title)}</h2><p>${rich(info.text ?? "")}</p>
      <dl class="so-stats"><div><dt>Thời gian</dt><dd>${esc(info.time)}</dd></div><div><dt>Zombie hạ gục</dt><dd>${info.kills}</dd></div><div><dt>Số lần lưu</dt><dd>${info.saves}</dd></div><div><dt>Tài liệu</dt><dd>${info.notes}</dd></div></dl>
      <div class="so-btns"><button type="button" class="btn-start" data-a="menu">VỀ DANH SÁCH CHƯƠNG<small>Enter</small></button></div></div>`;
    this.over.querySelector('[data-a="menu"]').addEventListener("click", onMenu);
    this.over.classList.remove("hidden");
    this.cur = { kind: "over", retry: onMenu, menu: onMenu };
  }

  // ---------------------------------------------------------------- PHÍM
  /** Trả về true nếu giao diện đang "ăn" phím (game không xử lý tiếp) */
  update(dt, input) {
    const c = this.cur, k = input.pressed;
    if (c?.kind === "say" && this.typing) {
      this.shown += dt * TYPE_SPEED;
      const n = Math.min(this.plain.length, Math.floor(this.shown));
      if (n >= this.plain.length) { this.typing = false; this.dlgText.innerHTML = this.full; this.dlgMore.classList.remove("hidden"); }
      else { this.dlgText.textContent = this.plain.slice(0, n).replace(/\*\*|\*|\[\/?r\]/g, ""); if (n % 3 === 0 && n !== this.lastBlip) { this.lastBlip = n; this.onBlip?.(); } }
    }
    if (!c) return false;
    const go = k.has("e") || k.has("enter") || k.has(" ") || k.has("mouse1x");
    if (c.kind === "say") { if (go) this.advance(); return true; }
    if (c.kind === "choice") {
      if (k.has("arrowup") || k.has("w")) { c.sel = (c.sel + c.n - 1) % c.n; this.markChoice(); }
      if (k.has("arrowdown") || k.has("s")) { c.sel = (c.sel + 1) % c.n; this.markChoice(); }
      for (let i = 0; i < c.n; i++) if (k.has(String(i + 1))) { this.pick(i); return true; }
      if (k.has("e") || k.has("enter") || k.has(" ")) this.pick(c.sel);
      return true;
    }
    if (c.kind === "note") { if (go || k.has("escape")) this.closeNote(); return true; }
    if (c.kind === "inv") { if (k.has("tab") || k.has("i") || k.has("escape")) this.closeInv(); return true; }
    if (c.kind === "over") { if (k.has("enter")) c.retry(); else if (k.has("escape")) c.menu(); return true; }
    return false;
  }
}

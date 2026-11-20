// =====================================================================================
//  ĐIỀU KHIỂN CẢM ỨNG (điện thoại / máy tính bảng, chơi màn hình NGANG)
//
//  - Nửa trái màn hình : cần điều khiển DI CHUYỂN (chạm ở đâu, cần hiện ở đó)
//  - Nửa phải màn hình : cần NGẮM + BẮN (kéo theo hướng nào là bắn hướng đó, có hỗ trợ ngắm)
//  - Cột nút bên phải  : Đổi súng · Nhặt/Tương tác (E) · Ghép vũ khí · Kỹ năng · Lướt · Tạm dừng
//  Kết quả ghi vào `input` (dùng chung với bàn phím/chuột trong main.js):
//    input.joy       = { x, y }  vector di chuyển (-1..1)
//    input.touchAim  = góc ngắm (radian) hoặc null nếu không ngắm
//    input.mouse.left = true khi đang kéo cần ngắm (= giữ cò)
// =====================================================================================

/** Thiết bị cảm ứng chính (điện thoại / tablet) — laptop cảm ứng sẽ tự bật khi chạm màn hình lần đầu */
export const isTouchDevice = () => matchMedia("(hover: none) and (pointer: coarse)").matches;

const STICK_EM = 3.4;     // bán kính cần điều khiển (đơn vị em của #stage)
const DEAD = 0.18;        // vùng chết

export class TouchControls {
  /** actions: { press(key), goMenu() } */
  constructor(stage, input, actions) {
    this.stage = stage;
    this.input = input;
    this.actions = actions;
    this.visible = false;
    input.joy = { x: 0, y: 0 };
    input.touchAim = null;
    this.build();
  }

  build() {
    const root = document.createElement("div");
    root.id = "touch";
    root.className = "touch-ui hidden";
    root.innerHTML = `
      <div class="tz tz-left"></div>
      <div class="tz tz-right"></div>
      <div class="stick stick-move idle"><div class="knob"></div><span class="stick-label">DI CHUYỂN</span></div>
      <div class="stick stick-aim idle"><div class="knob"></div><span class="stick-label">NGẮM · BẮN</span></div>
      <button type="button" class="tbtn t-pause" data-key="p" aria-label="Tạm dừng">❚❚</button>
      <button type="button" class="tbtn t-swap" data-key="q" aria-label="Đổi vũ khí">⇄<small>ĐỔI SÚNG</small></button>
      <button type="button" class="tbtn t-use disabled" data-key="e" aria-label="Nhặt / tương tác">E<small>NHẶT</small></button>
      <button type="button" class="tbtn t-merge hidden" data-key="g" aria-label="Ghép vũ khí">⚒<small>GHÉP</small></button>
      <button type="button" class="tbtn t-skill" data-key=" " aria-label="Kỹ năng"><span class="cd"></span>★<small>KỸ NĂNG</small></button>
      <button type="button" class="tbtn t-dash" data-key="shift" aria-label="Lướt"><span class="cd"></span>»<small>LƯỚT</small></button>
      <div class="t-pausemenu hidden">
        <p>TẠM DỪNG</p>
        <button type="button" class="btn-start t-resume">TIẾP TỤC</button>
        <button type="button" class="btn-secondary t-home">VỀ SẢNH CHỜ</button>
      </div>`;
    this.stage.append(root);
    this.root = root;
    this.el = {
      zl: root.querySelector(".tz-left"), zr: root.querySelector(".tz-right"),
      move: root.querySelector(".stick-move"), aim: root.querySelector(".stick-aim"),
      skill: root.querySelector(".t-skill"), dash: root.querySelector(".t-dash"), swap: root.querySelector(".t-swap"),
      use: root.querySelector(".t-use"), merge: root.querySelector(".t-merge"),
      pauseMenu: root.querySelector(".t-pausemenu"),
    };
    this.bindStick(this.el.zl, this.el.move, (x, y, on) => {
      this.input.joy.x = on ? x : 0;
      this.input.joy.y = on ? y : 0;
    });
    this.bindStick(this.el.zr, this.el.aim, (x, y, on) => {
      const m = Math.hypot(x, y);
      if (on && m > DEAD) { this.input.touchAim = Math.atan2(y, x); this.input.mouse.left = true; }
      else { if (!on) this.input.touchAim = null; this.input.mouse.left = false; }
    });
    // Nút bấm: chạm = nhấn phím tương ứng
    for (const b of root.querySelectorAll(".tbtn")) {
      const press = (e) => { e.preventDefault(); e.stopPropagation(); b.classList.add("down"); this.actions.press(b.dataset.key); navigator.vibrate?.(8); };
      const up = (e) => { e.preventDefault(); b.classList.remove("down"); };
      b.addEventListener("touchstart", press, { passive: false });
      b.addEventListener("touchend", up, { passive: false });
      b.addEventListener("touchcancel", up, { passive: false });
    }
    root.querySelector(".t-resume").addEventListener("click", () => this.actions.press("p"));
    root.querySelector(".t-home").addEventListener("click", () => this.actions.goMenu());
  }

  /** Cần điều khiển "nổi": chạm vào vùng nào thì tâm cần đặt tại đó */
  bindStick(zone, stick, onChange) {
    const knob = stick.querySelector(".knob");
    let id = null, ox = 0, oy = 0;
    const radius = () => STICK_EM * parseFloat(getComputedStyle(this.stage).fontSize);
    const local = (t) => { const r = this.stage.getBoundingClientRect(); return [t.clientX - r.left, t.clientY - r.top]; };
    const set = (t) => {
      const [x, y] = local(t), R = radius();
      let dx = x - ox, dy = y - oy;
      const d = Math.hypot(dx, dy);
      if (d > R) { dx = (dx / d) * R; dy = (dy / d) * R; }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      onChange(dx / R, dy / R, true);
    };
    zone.addEventListener("touchstart", (e) => {
      e.preventDefault();
      if (id !== null) return;
      const t = e.changedTouches[0];
      id = t.identifier;
      [ox, oy] = local(t);
      stick.style.left = `${ox}px`; stick.style.top = `${oy}px`;
      stick.classList.remove("idle"); stick.classList.add("active");
      set(t);
    }, { passive: false });
    zone.addEventListener("touchmove", (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) if (t.identifier === id) set(t);
    }, { passive: false });
    const end = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier !== id) continue;
        id = null;
        knob.style.transform = "";
        stick.style.left = stick.style.top = "";
        stick.classList.add("idle"); stick.classList.remove("active");
        onChange(0, 0, false);
      }
    };
    zone.addEventListener("touchend", end);
    zone.addEventListener("touchcancel", end);
  }

  /** Gọi mỗi frame: ẩn/hiện, vòng hồi chiêu trên nút */
  sync(game, playing) {
    const show = playing && !game.choosing && !game.shopping;
    if (show !== this.visible) {
      this.visible = show;
      this.root.classList.toggle("hidden", !show);
      if (!show) this.reset();
    }
    if (!show) return;
    this.el.pauseMenu.classList.toggle("hidden", !game.paused);
    const p = game.player;
    this.el.skill.style.setProperty("--cd", String(p.skillCd > 0 ? p.skillCd / p.skillCdMax : 0));
    this.el.skill.style.setProperty("--skill", p.skill.color);
    this.el.dash.style.setProperty("--cd", String(p.rollCd / p.rollCdMax));
    this.el.swap.classList.toggle("disabled", !p.weapons[1]);
    this.el.use.classList.toggle("disabled", !game.interactTarget);
    this.el.merge.classList.toggle("hidden", !p.mergeable);
  }

  reset() {
    this.input.joy.x = this.input.joy.y = 0;
    this.input.touchAim = null;
    this.input.mouse.left = false;
  }
}

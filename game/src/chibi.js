// =====================================================================================
//  NHÂN VẬT CHIBI KIỂU SOUL KNIGHT — đầu to, thân nhỏ, viền đậm, vẽ bằng code từng pixel
//
//  bakeChibi(spec) -> spritesheet 4 hàng: idle (8 frame, thở + chớp mắt) · run (8 frame) · skill (4 frame) · hurt (3 frame)
//  Mỗi bộ phận (chân, thân, tay, đầu, mũ...) là 1 "lớp" có viền riêng, tô sáng góc trên-trái và tối góc dưới-phải;
//  vẽ chồng theo thứ tự sau -> trước nên chỗ đầu đè lên thân tự có đường viền ngăn cách như pixel art vẽ tay.
//  File thuần JavaScript (không DOM): chạy được ở trình duyệt lẫn Node (game/tools/bake-sprites.mjs).
//
//  >>> MUỐN SỬA NGOẠI HÌNH: chỉnh bảng màu / kiểu đầu trong CHIBI_LOOKS (fx-config.js),
//      muốn sửa dáng chạy: CHIBI_ANIMS bên dưới.
// =====================================================================================

export const CHIBI_FRAME = { w: 40, h: 44, ax: 20, ay: 42 };   // cùng cỡ ô với spritesheet Bạch Ngưng Băng

/** Đổi "#rrggbb" -> [r, g, b] ; làm sáng / tối */
const rgb = (h) => { const v = parseInt(h.slice(1, 7), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; };
const mixc = (a, b, k) => a.map((c, i) => Math.round(c + (b[i] - c) * k));
const tone = (h) => { const c = rgb(h); return { mid: c, hi: mixc(c, [255, 255, 255], 0.35), lo: mixc(c, [10, 6, 20], 0.38) }; };
const INK = [22, 16, 30];

/** 1 lớp vẽ: mặt nạ + màu, toạ độ tính từ CHÂN nhân vật (x sang phải, y âm là lên trên) */
export class Layer {
  constructor() { this.px = new Map(); }
  key(x, y) { return `${x},${y}`; }
  set(x, y, c) { this.px.set(this.key(Math.round(x), Math.round(y)), { x: Math.round(x), y: Math.round(y), c }); }
  has(x, y) { return this.px.has(this.key(x, y)); }
  rect(x0, y0, w, h, c) { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) this.set(x, y, c); }
  /** elip đặc tâm (cx, cy) bán kính rx, ry */
  oval(cx, cy, rx, ry, c) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++)
        if (((x + 0.5 - cx - 0.5) / rx) ** 2 + ((y + 0.5 - cy - 0.5) / ry) ** 2 <= 1) this.set(x, y, c);
  }
  poly(pts, c) {   // đa giác đặc
    const ys = pts.map((p) => p[1]);
    for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++) {
      const xs = [];
      for (let i = 0; i < pts.length; i++) {
        const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length];
        if ((y0 <= y + 0.5 && y1 > y + 0.5) || (y1 <= y + 0.5 && y0 > y + 0.5)) xs.push(x0 + ((y + 0.5 - y0) / (y1 - y0)) * (x1 - x0));
      }
      xs.sort((a, b) => a - b);
      for (let i = 0; i + 1 < xs.length; i += 2) for (let x = Math.round(xs[i]); x < Math.round(xs[i + 1]); x++) this.set(x, y, c);
    }
  }
  /** Tô khối: viền sáng trên-trái, tối dưới-phải (chỉ với ô có màu dạng {mid,hi,lo}) */
  shade() {
    for (const p of this.px.values()) {
      if (!p.c.mid) continue;
      const lo = !this.has(p.x + 1, p.y) || !this.has(p.x, p.y + 1);
      const hi = !this.has(p.x - 1, p.y) || !this.has(p.x, p.y - 1);
      p.out = lo ? p.c.lo : hi ? p.c.hi : p.c.mid;
    }
    for (const p of this.px.values()) if (!p.out) p.out = p.c.mid ? p.c.mid : p.c;
  }
}

/** Ghép các lớp (sau -> trước) vào ảnh RGBA; mỗi lớp được viền mực 1px trước khi vẽ */
export function compose(layers, rgba, W, H, ax, ay, outline = true) {
  const put = (x, y, c) => {
    const X = ax + x, Y = ay + y;
    if (X < 0 || Y < 0 || X >= W || Y >= H) return;
    const j = (Y * W + X) * 4;
    rgba[j] = c[0]; rgba[j + 1] = c[1]; rgba[j + 2] = c[2]; rgba[j + 3] = 255;
  };
  for (const L of layers) {
    if (!L) continue;
    L.shade();
    if (outline && !L.noOutline) for (const p of L.px.values())
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]])
        if (!L.has(p.x + dx, p.y + dy)) put(p.x + dx, p.y + dy, INK);
    for (const p of L.px.values()) put(p.x, p.y, p.out);
  }
}

// -------------------------------------------------------------------------------------
//  TƯ THẾ theo frame: độ lệch của đầu / thân / chân / tay (pixel)
// -------------------------------------------------------------------------------------
export const CHIBI_ANIMS = {
  // ĐỨNG: thở (thân hạ 1px, ĐẦU hạ trễ 1 nhịp = chuyển động theo quán tính), phụ kiện đung đưa chậm,
  //       cột 7 = CHỚP MẮT; thứ tự `seq` cho chớp mắt ~3.5 giây/lần
  idle: {
    frames: 8, fps: 6, seq: [0, 1, 2, 3, 4, 5, 6, 0, 1, 2, 3, 4, 5, 6, 7, 1, 2, 3, 4, 5, 6],
    pose: (i) => {
      const k = i === 7 ? 0 : i, b = k >= 3 && k <= 5 ? 1 : 0, hb = k >= 4 && k <= 6 ? 1 : 0;
      return { bob: b, hb, lean: 0, legN: [0, 0], legF: [0, 0], armF: [0, 0], arm: [0, 0], tail: k >> 1, eyes: i === 7 ? "closed" : "open" };
    },
  },
  // CHẠY: người đổ về trước, chân sải, TAY SAU VUNG mạnh ngược chân, đầu nảy trễ 1 nhịp, tóc / lông / khăn bay
  run: {
    frames: 8, fps: 13, contact: [2, 6],
    pose: (i) => {
      const a = (i / 8) * Math.PI * 2, s = Math.sin(a), c = Math.cos(a);
      const bobOf = (j) => (j % 4 === 1 || j % 4 === 3 ? -1 : 0);
      return {
        bob: bobOf(i), hb: bobOf((i + 7) % 8), lean: 2,
        legN: [Math.round(3 * s), -Math.max(0, Math.round(2 * c))],
        legF: [Math.round(-3 * s), -Math.max(0, Math.round(-2 * c))],
        armF: [Math.round(-3.4 * s), -Math.round(Math.abs(s))], arm: [0, 0], tail: i, eyes: "open",
      };
    },
  },
  skill: {
    frames: 4, fps: 14,
    pose: (i) => ({ bob: 1, hb: i % 2, lean: 3, legN: [4, -1 + (i % 2)], legF: [-5, -1], armF: [-3, 1], arm: [1, 0], tail: i * 2, eyes: "open" }),
  },
  // TRÚNG ĐÒN: đầu bật ngửa ra sau, người giật lùi, tay văng, mắt nhắm tịt "> <" (dùng khi bị đánh + tư thế gục ngã)
  hurt: {
    frames: 3, fps: 14, loop: false,
    pose: (i) => [
      { bob: 0, hb: 0, lean: -2, hl: -1, legN: [1, 0], legF: [-2, 0], armF: [-3, -3], arm: [-2, -2], tail: 1, eyes: "pain" },
      { bob: 1, hb: 1, lean: -3, hl: -1, legN: [2, 0], legF: [-3, -1], armF: [-4, -2], arm: [-3, -1], tail: 2, eyes: "pain" },
      { bob: 0, hb: 1, lean: -1, hl: 0, legN: [1, 0], legF: [-1, 0], armF: [-2, 0], arm: [-1, 0], tail: 3, eyes: "closed" },
    ][i],
  },
};
const ROWS = ["idle", "run", "skill", "hurt"];

/**
 * Vẽ 1 frame. look = { skin, hair, outfit, outfit2, pants, shoes, eyes, head: "knight" | "monk" | "wizard" | "skull" | "helm" | "zombie", accent, accent2, arms: "reach" (tay giơ thẳng), belly: màu bụng phình }
 * Trả về { rgba, hand: [x, y] } — hand = vị trí bàn tay cầm vũ khí, tính từ chân.
 */
function drawFrame(look, P, W, H, ax, ay) {
  const T = (h) => tone(h);
  const skin = T(look.skin ?? "#ffd2a8"), outfit = T(look.outfit), outfit2 = T(look.outfit2 ?? look.outfit);
  const pants = T(look.pants ?? "#3a3f55"), shoes = T(look.shoes ?? "#26283a");
  const sole = look.sole ? T(look.sole) : null;            // đế giày khác màu (giày trắng đế xám)
  const lean = P.lean, bob = P.bob, hbob = P.hb ?? bob, EY = P.eyes ?? "open";
  const SH = look.short ?? 0;                              // nhân vật LÙN: hạ thân + đầu xuống SH pixel (chân ngắn tũn)
  const bodyY = -6 + bob + SH, headCY = -22 + hbob + SH, hx = lean + (P.hl ?? 0);   // tâm đầu (nảy trễ hơn thân 1 nhịp)

  const reach = look.arms === "reach";   // ZOMBIE: 2 tay giơ thẳng ra trước
  // --- tay sau (khuất sau thân)
  const armF = new Layer();
  if (reach) {
    const sway = [0, 1, 0, -1][P.tail % 4];   // tay đung đưa nhẹ
    armF.rect(-2 + P.armF[0] + lean, bodyY - 7 + sway, 11, 3, look.armSkin ? skin : outfit2);
    armF.rect(8 + lean, bodyY - 8 + sway, 3, 4, skin);
  } else armF.rect(-6 + P.armF[0], bodyY - 7 + P.armF[1], 3, 5, look.armSkin ? skin : outfit2);
  // --- chân: chân sau rồi chân trước, giày nhô về trước 1px
  const legF = new Layer(), legN = new Layer();
  const leg = (L, x, lift, robe) => {
    if (!robe) L.rect(x, -5 + lift + 1, 3, 4, pants);
    if (sole) { L.rect(x, -3 + lift + 1, 4, 2, shoes); L.rect(x, -1 + lift + 1, 4, 1, sole); }   // giày cổ cao hơn 1px + đế
    else L.rect(x, -2 + lift + 1, 4, 2, shoes);
  };
  leg(legF, -4 + P.legF[0], P.legF[1], look.robe);
  leg(legN, 0 + P.legN[0], P.legN[1], look.robe);
  // --- thân: hình thang bo góc + thắt lưng
  const body = new Layer();
  const bx = Math.round(lean / 2);
  body.poly([[-6 + bx, bodyY - 9], [5 + bx, bodyY - 9], [6 + bx, bodyY + 1], [-7 + bx, bodyY + 1]], outfit);
  if (look.robe) body.poly([[-7 + bx, bodyY], [6 + bx, bodyY], [7 + bx, 0], [-8 + bx, 0]], outfit);   // áo choàng dài
  if (look.belly) {   // bụng phình (Zombie Phun Độc): bóng bụng nhô ra trước, có đốm mủ sáng
    const bc = T(look.belly);
    body.oval(bx + 3, bodyY - 2, 8, 6, bc);
    body.set(bx + 5, bodyY - 4, bc.hi); body.set(bx + 6, bodyY - 3, bc.hi); body.set(bx + 2, bodyY, bc.lo);
  }
  if (look.vest) {   // áo giáp chiến thuật: tấm giáp ngực tối + 2 túi đạn + túi hông
    const v = T(look.vest), pc = T(look.pouch ?? "#5c5638");
    body.poly([[-5 + bx, bodyY - 9], [5 + bx, bodyY - 9], [6 + bx, bodyY - 2], [-6 + bx, bodyY - 2]], v);
    body.rect(-3 + bx, bodyY - 6, 3, 3, pc); body.rect(1 + bx, bodyY - 6, 3, 3, pc);
    body.set(-2 + bx, bodyY - 6, pc.hi); body.set(2 + bx, bodyY - 6, pc.hi);
  }
  if (look.belt) body.rect(-6 + bx, bodyY - 2, 12, 1, T(look.belt));
  if (look.vest) { const pc = T(look.pouch ?? "#5c5638"); body.rect(-7 + bx, bodyY - 1, 3, 3, pc); }
  if (look.chest) body.rect(-1 + bx, bodyY - 8, 2, 4, T(look.chest));
  // --- tay trước (cầm vũ khí) — bàn tay da
  const arm = new Layer();
  const handX = 4 + bx + P.arm[0], handY = bodyY - 4 + P.arm[1];
  if (reach) {
    const sway = [0, 0, 1, 1][P.tail % 4];
    arm.rect(1 + bx, bodyY - 7 + sway, 10, 3, look.armSkin ? skin : outfit2);
    arm.rect(10 + bx, bodyY - 8 + sway, 3, 4, skin);
    arm.set(12 + bx, bodyY - 4 + sway, [150, 20, 24]);   // móng tay dính máu
  } else {
    arm.rect(1 + bx, bodyY - 8 + P.arm[1], 3, 3, look.armSkin ? skin : outfit2);
    arm.rect(handX - 1, handY - 1, 3, 3, skin);
  }

  // --- ĐẦU (to!) + mặt + tóc / mũ
  const head = new Layer(), face = new Layer(), top = new Layer(), back = new Layer();
  face.noOutline = true;
  /** Mắt NHẮM (vạch ngang) hoặc NHĂN ĐAU ("> <") thay cho mắt mở. xL / xR = mép trái 2 mắt, y = hàng trên, w x h = cỡ mắt */
  const eyesShut = (xL, xR, y, w, h, col) => {
    if (EY === "pain") {
      const yc = y + Math.floor((h - 1) / 2);
      face.set(xL, yc - 1, col); face.set(xL + 1, yc, col); face.set(xL, yc + 1, col);
      face.set(xR + w - 1, yc - 1, col); face.set(xR + w - 2, yc, col); face.set(xR + w - 1, yc + 1, col);
    } else { face.rect(xL, y + h - 1, w, 1, col); face.rect(xR, y + h - 1, w, 1, col); }
  };
  if (look.cape) {   // áo choàng / khăn quàng sau lưng, bay phấp phới theo frame
    const capeC = T(look.cape), w = [0, 1, 2, 1][P.tail % 4];
    back.poly([[-5 + bx, bodyY - 9], [2 + bx, bodyY - 9], [-1 + bx - lean, -1], [-8 + bx - lean - w, 0], [-10 + bx - lean - w, -3]], capeC);
  }
  const hairC = T(look.hair ?? "#2a1c18");
  const hcx = hx + 0.5, rx = 9.5, ry = 8.5;
  const K = look.head;
  if (K === "knight" || K === "helm") {
    const steel = T(look.helm ?? "#b8c4d8");
    head.oval(hcx, headCY, rx, ry, steel);
    // kính che mặt tối có 2 mắt
    face.poly([[hx - 2, headCY - 2], [hx + 9, headCY - 3], [hx + 9, headCY + 3], [hx - 1, headCY + 3]], [20, 18, 32]);
    const ec = rgb(K === "knight" ? "#ffffff" : look.eyes ?? "#ffd34a");
    if (EY === "open") { face.rect(hx + 2, headCY - 1, 2, 2, ec); face.rect(hx + 6, headCY - 1, 2, 2, ec); }
    else eyesShut(hx + 2, hx + 6, headCY - 1, 2, 2, ec);
    face.rect(hx - 8, headCY - 5, 1, 4, steel.hi);                      // ánh kim
    if (K === "knight") {   // chùm lông đỏ trên đỉnh, phất ra sau theo frame
      const plume = T(look.accent ?? "#ff4a3a"), w = P.tail % 2;
      back.poly([[hx - 1, headCY - 8], [hx + 3, headCY - 9], [hx - 4, headCY - 13 - w], [hx - 9, headCY - 11 + w]], plume);
    } else {               // mũ sắt kín: sống mũ
      top.rect(hx - 1, headCY - 10, 3, 3, steel);
    }
  } else if (K === "zombie") {
    // ZOMBIE: da xanh xám bệnh hoạn, tóc xơ xác lưa thưa, 1 mắt đỏ phát sáng + 1 hốc mắt tối, miệng toạc, vết rách / máu
    head.oval(hcx, headCY, rx, ry, skin);
    face.rect(hx + 1, headCY - 2, 3, 3, [14, 8, 16]);                       // hốc mắt trái: tối đen
    face.set(hx + 2, headCY - 1, [60, 18, 28]);
    const eyeC = rgb(look.eyes ?? "#ff2a2a");
    face.rect(hx + 6, headCY - 2, 3, 3, [30, 6, 10]);                       // mắt phải: đỏ phát sáng
    if (EY === "open") { face.rect(hx + 6, headCY - 1, 2, 2, eyeC); face.set(hx + 6, headCY - 1, [255, 220, 200]); }
    else face.rect(hx + 6, headCY, 3, 1, [255, 200, 190]);              // trúng đòn: mắt nheo lại thành vạch sáng
    face.set(hx + 5, headCY - 3, mixc(eyeC, skin.mid, 0.5));               // quầng sáng
    face.rect(hx + 2, headCY + 3, 8, 3, [18, 6, 12]);                       // miệng toạc
    face.set(hx + 3, headCY + 3, [214, 208, 176]); face.set(hx + 5, headCY + 3, [214, 208, 176]); face.set(hx + 8, headCY + 3, [214, 208, 176]);
    face.set(hx + 4, headCY + 5, [214, 208, 176]); face.set(hx + 7, headCY + 5, [214, 208, 176]);
    face.rect(hx + 9, headCY + 4, 1, 3 + (P.tail % 2), [150, 14, 20]);      // máu nhỏ giọt khóe miệng
    face.set(hx + 3, headCY + 6, [150, 14, 20]);
    face.rect(hx - 3, headCY - 5, 4, 1, [120, 20, 26]);                     // vết rách trên trán
    face.set(hx - 2, headCY - 4, [120, 20, 26]); face.set(hx, headCY - 4, [120, 20, 26]);
    face.rect(hx - 6, headCY + 1, 2, 2, skin.lo);                           // mảng thối rữa bên má
    // tóc xơ xác: vài mảng lưa thưa trên đỉnh + chỏm dựng
    top.poly([[hx - 9, headCY - 2], [hx - 8, headCY - 6], [hx - 5, headCY - 9], [hx - 3, headCY - 7], [hx - 5, headCY - 4], [hx - 7, headCY]], hairC);
    top.poly([[hx + 4, headCY - 9], [hx + 7, headCY - 8], [hx + 6, headCY - 6]], hairC);
    const sw = P.tail % 2;
    top.poly([[hx - 3, headCY - 9], [hx - 2, headCY - 12 - sw], [hx - 1, headCY - 9]], hairC);
    top.poly([[hx + 1, headCY - 10], [hx + 3, headCY - 12 + sw], [hx + 4, headCY - 9]], hairC);
  } else if (K === "skull") {
    const bone = T(look.skin ?? "#f4f0e0");
    head.oval(hcx, headCY, rx - 0.5, ry, bone);
    face.rect(hx + 1, headCY - 1, 3, 3, [26, 16, 28]); face.rect(hx + 6, headCY - 1, 3, 3, [26, 16, 28]);
    const glow = rgb(look.eyes ?? "#ff3030");
    face.set(hx + 2, headCY, glow); face.set(hx + 7, headCY, glow);
    if (look.eyes) { face.set(hx + 3, headCY, glow); face.set(hx + 8, headCY, glow); }
    face.rect(hx + 3, headCY + 4, 5, 1, bone.lo);
    // mũ trùm
    const hood = T(look.accent ?? "#3a3040");
    top.poly([[hx - 10, headCY + 6], [hx - 9, headCY - 6], [hx - 3, headCY - 10], [hx + 6, headCY - 9], [hx + 9, headCY - 4], [hx + 2, headCY - 5], [hx - 4, headCY - 2], [hx - 5, headCY + 6]], hood);
  } else if (K === "paladin") {
    // mũ thánh kỵ sĩ: mũ vàng kín, khe mắt chữ T, đôi cánh nhỏ hai bên + chùm lông trắng
    const gold = T(look.helm ?? "#f0c040");
    head.oval(hcx, headCY, rx, ry, gold);
    face.poly([[hx + 1, headCY - 2], [hx + 9, headCY - 3], [hx + 9, headCY], [hx + 1, headCY + 1]], [24, 16, 20]);
    face.rect(hx + 4, headCY, 2, 4, [24, 16, 20]);
    if (EY === "open") { face.rect(hx + 2, headCY - 1, 2, 1, rgb(look.eyes ?? "#7cf0ff")); face.rect(hx + 6, headCY - 1, 2, 1, rgb(look.eyes ?? "#7cf0ff")); }
    face.rect(hx - 8, headCY - 4, 1, 4, gold.hi);
    const wing = T(look.accent2 ?? "#ffffff"), w = P.tail % 2;
    back.poly([[hx - 7, headCY - 3], [hx - 14, headCY - 9 - w], [hx - 12, headCY - 4], [hx - 15, headCY - 4 + w], [hx - 8, headCY + 1]], wing);
    const plume = T(look.accent ?? "#ff4a3a");
    back.poly([[hx - 1, headCY - 8], [hx + 3, headCY - 9], [hx - 3, headCY - 14 - w], [hx - 8, headCY - 12 + w]], plume);
  } else if (K === "ninja") {
    // ninja: khăn trùm đen kín đầu, chỉ hở đôi mắt, băng đô đỏ có 2 đuôi bay
    const cloth = T(look.hair ?? "#24222e");
    head.oval(hcx, headCY, rx, ry, cloth);
    face.poly([[hx, headCY - 3], [hx + 9, headCY - 4], [hx + 9, headCY + 1], [hx, headCY + 1]], skin.mid);
    if (EY === "open") {
      face.rect(hx + 2, headCY - 2, 2, 2, [20, 14, 24]); face.rect(hx + 6, headCY - 2, 2, 2, [20, 14, 24]);
      face.set(hx + 3, headCY - 2, [255, 255, 255]); face.set(hx + 7, headCY - 2, [255, 255, 255]);
    } else eyesShut(hx + 2, hx + 6, headCY - 2, 2, 2, [20, 14, 24]);
    face.rect(hx, headCY + 1, 10, 1, cloth.lo);
    const band = T(look.accent ?? "#e8343f"), w = [0, 1, 0, -1][P.tail % 4];
    const bandL = new Layer();
    bandL.poly([[hx - 9, headCY - 6], [hx + 9, headCY - 7], [hx + 9, headCY - 5], [hx - 9, headCY - 4]], band);
    bandL.poly([[hx - 9, headCY - 6], [hx - 17, headCY - 5 + w], [hx - 17, headCY - 3 + w], [hx - 9, headCY - 4]], band);
    bandL.poly([[hx - 9, headCY - 5], [hx - 14, headCY + w], [hx - 13, headCY + 1 + w], [hx - 9, headCY - 3]], band);
    top.extra = bandL;
  } else if (K === "hood") {
    // thợ săn: mũ trùm xanh rêu nhọn ra sau, mặt người, lông chim trên mũ
    head.oval(hcx, headCY, rx, ry, skin);
    const eye = rgb(look.eyes ?? "#1a1420");
    if (EY === "open") {
      face.rect(hx + 2, headCY, 2, 2, eye); face.rect(hx + 6, headCY, 2, 2, eye);
      face.set(hx + 2, headCY, [255, 255, 255]); face.set(hx + 6, headCY, [255, 255, 255]);
    } else eyesShut(hx + 2, hx + 6, headCY, 2, 2, eye);
    if (EY === "pain") face.rect(hx + 4, headCY + 3, 2, 2, [70, 24, 30]);
    face.rect(hx + 1, headCY + 3, 2, 1, mixc(skin.mid, [255, 110, 130], 0.45));
    face.rect(hx + 7, headCY + 3, 2, 1, mixc(skin.mid, [255, 110, 130], 0.45));
    const hoodC = T(look.accent ?? "#3a6a34"), w = P.tail % 2;
    top.poly([[hx - 11, headCY + 6], [hx - 11, headCY - 4], [hx - 6, headCY - 9], [hx + 3, headCY - 10], [hx + 9, headCY - 7], [hx + 11, headCY - 2],
      [hx + 9, headCY - 2], [hx + 4, headCY - 4], [hx - 2, headCY - 3], [hx - 5, headCY + 2], [hx - 7, headCY + 6]], hoodC);
    back.poly([[hx - 8, headCY - 6], [hx - 15, headCY - 2 + w], [hx - 9, headCY + 2]], hoodC);
    const feather = new Layer();
    feather.poly([[hx + 2, headCY - 9], [hx + 6, headCY - 15 - w], [hx + 4, headCY - 9]], T(look.accent2 ?? "#e8343f"));
    top.extra = feather;
  } else if (K === "bowl") {
    // TÓC NGỐ (bát úp) bết mồ hôi xẹp xuống, mắt to sợ sệt, 2 RĂNG THỎ, giọt mồ hôi rơi
    head.oval(hcx, headCY, rx, ry - 0.5, skin);
    const white = [246, 244, 236], pupil = rgb(look.eyes ?? "#2a1a12");
    if (EY === "open") {
      face.rect(hx + 1, headCY - 1, 3, 3, white); face.rect(hx + 5, headCY - 1, 3, 3, white);     // tròng trắng to (sợ)
      face.rect(hx + 2, headCY, 2, 2, pupil); face.rect(hx + 6, headCY, 2, 2, pupil);
      face.set(hx + 2, headCY, [255, 255, 255]); face.set(hx + 6, headCY, [255, 255, 255]);
    } else eyesShut(hx + 1, hx + 5, headCY - 1, 3, 3, pupil);
    face.rect(hx + 3, headCY + 3, 5, 1, [70, 24, 30]);                                          // miệng hé
    face.rect(hx + 4, headCY + 4, 1, 2, white); face.rect(hx + 6, headCY + 4, 1, 2, white);     // 2 RĂNG THỎ
    face.set(hx + 4, headCY + 5, [208, 204, 192]); face.set(hx + 6, headCY + 5, [208, 204, 192]);
    face.rect(hx, headCY + 2, 1, 1, mixc(skin.mid, [255, 110, 130], 0.4)); face.rect(hx + 8, headCY + 2, 1, 1, mixc(skin.mid, [255, 110, 130], 0.4));
    const dy = P.tail % 4;   // giọt mồ hôi chảy xuống thái dương
    face.set(hx - 2, headCY + dy - 1, [170, 220, 255]); face.set(hx - 2, headCY + dy, [110, 180, 245]);
    // tóc bát úp: đỉnh BẸT (không phồng), mái cắt ngang phủ trán tới sát mắt, mép mái lởm chởm từng lọn bết
    top.poly([[hx - 9.4, headCY + 4], [hx - 9.8, headCY - 3], [hx - 8, headCY - 6.8], [hx - 3, headCY - 7.8], [hx + 4, headCY - 7.8], [hx + 8, headCY - 6.8], [hx + 10.5, headCY - 4],
      [hx + 10.5, headCY - 2], [hx + 9, headCY - 2], [hx + 8, headCY - 1], [hx + 7, headCY - 2], [hx + 5, headCY - 2], [hx + 4, headCY - 1], [hx + 3, headCY - 2],
      [hx + 1, headCY - 2], [hx, headCY - 1], [hx - 1, headCY - 2], [hx - 3, headCY - 1], [hx - 4, headCY + 3], [hx - 6, headCY + 5]], hairC);
    const shine = mixc(hairC.mid, [150, 170, 200], 0.55), clump = mixc(hairC.mid, [0, 0, 0], 0.45);
    const shineL = new Layer(); shineL.noOutline = true;
    for (const [x, y] of [[-6, -6], [-5, -6], [-4, -7], [-3, -7], [2, -7], [3, -7], [5, -6], [-8, -3], [-8, -2], [-7, -1]]) shineL.set(hx + x, headCY + y, shine);   // vệt bóng dầu (bết)
    for (const [x, y] of [[2, -3], [6, -3], [-1, -3], [9, -3], [2, -4], [6, -4]]) shineL.set(hx + x, headCY + y, clump);                  // lọn bết dính trán
    top.extra = shineL;
  } else {
    // đầu người: da mặt + tóc
    head.oval(hcx, headCY, rx, ry, skin);
    const eye = rgb(look.eyes ?? "#1a1420");
    if (EY === "open") {
      face.rect(hx + 2, headCY - 1, 2, 3, eye); face.rect(hx + 6, headCY - 1, 2, 3, eye);
      face.set(hx + 2, headCY - 1, [255, 255, 255]); face.set(hx + 6, headCY - 1, [255, 255, 255]);
    } else eyesShut(hx + 2, hx + 6, headCY - 1, 2, 3, eye);
    if (EY === "pain") face.rect(hx + 4, headCY + 3, 2, 2, [70, 24, 30]);
    face.rect(hx + 1, headCY + 3, 2, 1, mixc(skin.mid, [255, 110, 130], 0.45));   // má hồng
    face.rect(hx + 7, headCY + 3, 2, 1, mixc(skin.mid, [255, 110, 130], 0.45));
    // tóc phủ nửa trên + sau gáy
    top.poly([[hx - 10, headCY + 4], [hx - 10, headCY - 4], [hx - 6, headCY - 9], [hx + 2, headCY - 10], [hx + 8, headCY - 8], [hx + 10, headCY - 4],
      [hx + 9, headCY - 3], [hx + 4, headCY - 4], [hx + 1, headCY - 3], [hx - 3, headCY - 4], [hx - 5, headCY + 1], [hx - 7, headCY + 5]], hairC);
    if (K === "monk") {   // tóc dựng + băng đô đỏ, 2 đuôi bay ra sau
      for (const [x, h] of [[-5, 3], [-1, 4], [3, 3]]) top.poly([[hx + x - 2, headCY - 8], [hx + x + 2, headCY - 9], [hx + x - 1, headCY - 9 - h]], hairC);
      const band = T(look.accent ?? "#ff3b4a");
      const bandL = new Layer();
      bandL.poly([[hx - 9, headCY - 5], [hx + 9, headCY - 6], [hx + 9, headCY - 4], [hx - 9, headCY - 3]], band);
      const w = [0, 1, 0, -1][P.tail % 4];
      bandL.poly([[hx - 9, headCY - 5], [hx - 15, headCY - 4 + w], [hx - 15, headCY - 2 + w], [hx - 9, headCY - 3]], band);
      bandL.poly([[hx - 9, headCY - 4], [hx - 13, headCY + 1 - w], [hx - 12, headCY + 2 - w], [hx - 9, headCY - 2]], band);
      top.extra = bandL;
    }
    if (K === "wizard") {   // mũ phù thủy to: vành + chóp cong ra sau, dải vàng
      const hat = T(look.accent ?? "#7a52d6");
      const hatL = new Layer();
      hatL.poly([[hx - 12, headCY - 5], [hx + 12, headCY - 6], [hx + 10, headCY - 3], [hx - 11, headCY - 2]], hat);   // vành
      const sw = P.tail % 2;
      hatL.poly([[hx - 7, headCY - 5], [hx + 7, headCY - 6], [hx + 3, headCY - 13], [hx - 3 - sw, headCY - 18], [hx - 8 - sw, headCY - 20], [hx - 4, headCY - 13]], hat);
      hatL.rect(hx - 6, headCY - 8, 12, 2, T(look.accent2 ?? "#ffd34a"));
      top.extra = hatL;
    }
  }

  const rgba = new Uint8ClampedArray(W * H * 4);
  compose([back, armF, legF, legN, body, head, top, top.extra, arm], rgba, W, H, ax, ay);
  compose([face], rgba, W, H, ax, ay, false);
  return { rgba, hand: [handX, handY] };
}

/** Xếp mọi frame thành sheet (mỗi hàng 1 hoạt ảnh) */
export function bakeChibi(look) {
  const { w, h, ax, ay } = CHIBI_FRAME;
  const cols = Math.max(...ROWS.map((r) => CHIBI_ANIMS[r].frames));
  const width = w * cols, height = h * ROWS.length, rgba = new Uint8ClampedArray(width * height * 4);
  const hands = [];
  ROWS.forEach((name, r) => {
    const A = CHIBI_ANIMS[name], row = [];
    for (let i = 0; i < A.frames; i++) {
      const f = drawFrame(look, A.pose(i), w, h, ax, ay);
      for (let y = 0; y < h; y++) rgba.set(f.rgba.subarray(y * w * 4, (y + 1) * w * 4), ((r * h + y) * width + i * w) * 4);
      row.push(f.hand);
    }
    hands.push(row);
  });
  return {
    rgba, width, height, cols, rows: ROWS.length, frameW: w, frameH: h, anchorX: ax, anchorY: ay, hands,
    anims: Object.fromEntries(ROWS.map((n, i) => {
      const A = CHIBI_ANIMS[n];
      return [n, { row: i, frames: A.frames, fps: A.fps, loop: A.loop !== false, contact: A.contact ?? [], ...(A.seq ? { seq: A.seq } : {}) }];
    })),
  };
}

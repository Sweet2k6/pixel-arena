// =====================================================================================
//  NHÂN VẬT TỈ LỆ NGƯỜI THẬT (pixel 2D) — nhóm SINH VIÊN
//
//  Không chibi: người cao ~3 đầu (đầu 12 px, người 33-37 px theo chiều cao thật), vai / bụng / tay chân theo vóc dáng.
//  ĐẦU + TÓC vẽ tay từng pixel (bảng chữ HAIR bên dưới) để mặt sáng, rõ, dễ thương; thân / tay / chân vẽ bằng code để
//  chuyển động mượt. Viền mỗi mảng = màu sẫm của chính mảng đó (không viền đen đều) cho cảm giác vẽ tay.
//
//  bakeHuman(look) -> spritesheet cùng định dạng chibi: 4 hàng
//    idle  (10 frame: thở, chớp mắt, + 2 frame ĐỘNG TÁC RIÊNG: đẩy gọng kính / cười / gãi đầu / nghiêng đầu ...)
//    run   (8 frame) · skill (4 frame: nổi giận) · hurt (3 frame)
//
//  >>> NGOẠI HÌNH (khối `human` trong students.js):
//    height  : chiều cao px (chân -> đỉnh sọ)          build : "slim" | "normal" | "fat" | "fatter"
//    head    : "normal" | "round" | "fat" | "female" | "crescent" (mặt lưỡi liềm)   (mặc định theo build / female)
//    skin, hair, hairTip (màu ngọn tóc), cap (màu mũ)  hairStyle: tên mẫu tóc trong HAIR
//    face    : "goofy" | "smart" | "mischief" | "calm" | "stubborn" | "dazed" | "grin" | "neutral"
//    glasses : "" | "rect" (kính cận gọng mảnh) | "big" (kính cận gọng to)   mole · stubble · mask (màu khẩu trang)
//    top     : { kind: "tee" | "polo" | "shirt" | "jacket" | "hoodie", color, color2, collar, print: "arizona" | "stripes" | "waffle", tucked }
//    bottom  : { kind: "pants" | "shorts" | "cargo", color, label }   belt · shoes · shoeSole
//    acc     : "crossbag" | "frontpack" | "briefcase" | "chain" | "earring" | "lollipop" | "glassesHang"
//    gesture : "glasses" | "laugh" | "chin" | "hair" | "tilt" | "point" | "strap" | "look"
// =====================================================================================
import { Layer } from "./chibi.js";

export const HUMAN_FRAME = { w: 48, h: 50, ax: 24, ay: 47 };

const rgb = (h) => { const v = parseInt(h.slice(1, 7), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; };
const C = (h) => (typeof h === "string" ? rgb(h) : h);
const mixc = (a, b, k) => a.map((c, i) => Math.round(c + (b[i] - c) * k));
/** Khối có sáng / tối (Layer.shade): sáng phía trên-trái, sẫm dưới-phải */
const tone = (h, k = 0.24) => { const c = C(h); return { mid: c, hi: mixc(c, [255, 250, 240], k), lo: mixc(c, [20, 14, 26], k + 0.04) }; };
/** Viền = màu của chính mảng, sẫm lại (ấm, không đen kịt) */
const inkOf = (h, k = 0.58) => mixc(C(h), [26, 16, 24], k);
const dk = (c, k) => mixc(C(c), [16, 10, 20], k);
const lt = (c, k) => mixc(C(c), [255, 252, 244], k);

const BUILD = {
  slim:   { tw: 9,  lw: 3, aw: 2, belly: 0, head: "normal" },
  normal: { tw: 10, lw: 3, aw: 2, belly: 0, head: "normal" },
  fat:    { tw: 13, lw: 5, aw: 3, belly: 2, head: "fat" },
  fatter: { tw: 14, lw: 5, aw: 3, belly: 3, head: "fat" },
};

// -------------------------------------------------------------------------------------
//  HỘP SỌ nhìn 3/4 sang phải: mỗi hàng [x trái, x phải] so với tâm đầu. Mặt quay phải, mũi nhô ở hàng 7.
//  Vị trí nét mặt chung: lông mày hàng 3 · mắt hàng 5-6 (mắt gần x=0, mắt xa x=4) · miệng hàng 9 · tai x=-3..-2
// -------------------------------------------------------------------------------------
const SKULL = {
  normal:   [[-3, 3], [-5, 4], [-6, 5], [-6, 5], [-6, 5], [-6, 5], [-6, 5], [-6, 6], [-5, 5], [-5, 5], [-4, 4], [-2, 3]],
  round:    [[-3, 3], [-5, 4], [-6, 5], [-6, 5], [-6, 5], [-6, 5], [-6, 5], [-6, 6], [-6, 5], [-6, 5], [-5, 4], [-3, 3]],
  fat:      [[-3, 3], [-5, 4], [-6, 5], [-7, 5], [-7, 5], [-7, 5], [-7, 5], [-7, 6], [-7, 6], [-7, 6], [-6, 5], [-4, 4]],
  female:   [[-3, 3], [-5, 4], [-6, 5], [-6, 5], [-6, 5], [-6, 5], [-6, 5], [-6, 6], [-5, 5], [-5, 4], [-4, 3], [-2, 2]],
  crescent: [[-3, 3], [-5, 4], [-6, 5], [-6, 5], [-6, 5], [-6, 5], [-6, 5], [-6, 6], [-6, 4], [-5, 4], [-5, 5], [-4, 6], [-2, 5]],   // trán nhô, giữa mặt lõm, cằm dài chìa
};
const FEAT = { browY: 3, eyeY: 5, eN: 0, eF: 4, noseY: 7, mouthY: 9, earX: -3 };

// -------------------------------------------------------------------------------------
//  TÓC VẼ TAY — mỗi mẫu 14 hàng (y = -4 .. 9 so với đỉnh sọ) x 17 cột (x = -8 .. 8 so với tâm đầu)
//  h tóc · H ánh sáng · d bóng tối · s chân tóc cạo (da xanh) · c mũ · C mũ sáng · k lưỡi trai · z bóng đổ trên da
//  G vệt bóng dầu (tóc bết) · . trống
// -------------------------------------------------------------------------------------
const HAIR = {
  // Diệu Phong: mái chéo bù xù, phồng, hất từ trái xuống phải che 1 bên trán
  sweep: [
    ".................",
    "......h.h..h.....",
    "....hhhhhhhhhh...",
    "...hhhhHHHhhhhh..",
    "..hhhhhHHhhhhhhh.",
    ".hhhhhhhhhhHHhhh.",
    ".hhhhhdhhhhhhhhhh",
    ".hhhhh..ddhhhhhh.",
    ".hhhh.......dhhh.",
    ".hhh..........h..",
    ".hhh.............",
    "..hh.............",
    "..h..............",
    ".................",
  ],
  // Trung: mái chéo CHẢI GỌN, ít phồng
  sweepNeat: [
    ".................",
    ".................",
    "......hhhhh......",
    "....hhhhhHHhh....",
    "...hhhhhHHhhhh...",
    "..hhhhhhhhhhhhh..",
    ".hhhhhdhhhhhhhh..",
    ".hhhh....ddhhhh..",
    ".hhh........dh...",
    ".hhh.............",
    ".hh..............",
    "..h..............",
    ".................",
    ".................",
  ],
  // Phương Duy: tóc dựng VUỐT NGƯỢC ra sau, ngọn nhọn, 2 bên cạo ngắn (ngầu)
  spiky: [
    "....h..h.h.......",
    "...hh.hhhh.h.....",
    "...hhhhhhhhhhh...",
    "..hhhHHhhHHhhhh..",
    "..hhhhhHHhhHhhhh.",
    "..shhhhhhhhhhhhhh",
    "..sshhhhhhhd.hhh.",
    "..sss.....dh.....",
    "..sss............",
    "..ss.............",
    "..ss.............",
    "...s.............",
    ".................",
    ".................",
  ],
  // Đặng Quyết: mái bằng dày phủ tới lông mày, tóc trùm tai kiểu nấm
  bangs: [
    ".................",
    ".................",
    ".....hhhhhh......",
    "...hhhhHHHhhh....",
    "..hhhhHHhhhhhh...",
    ".hhhhhhhhhhhhhh..",
    ".hhhhhhhhhhhhhhh.",
    ".hhhhhdhdhhdhdhh.",
    ".hhhhh.h.dh.h.hh.",
    ".hhhh............",
    ".hhhh............",
    "..hhh............",
    "..hh.............",
    ".................",
  ],
  // Tấn Đô: CẠO TRẮNG 2 BÊN, phần trên dày vuốt rẽ ngôi lệch trái, hất sang phải
  undercut: [
    ".................",
    "......hhhhh......",
    "....hhhhHHHhh....",
    "...hhhhhhhHHhhh..",
    "..hhhdhhhhhhhhh..",
    "..sshhhhhhhhhhhh.",
    "..ssss...hhhhhh..",
    "..ssss...........",
    "..sss............",
    "..ss.............",
    "..ss.............",
    "...s.............",
    ".................",
    ".................",
  ],
  // Vĩnh Thịnh: mũ lưỡi trai đen, bóng lưỡi trai đổ xuống mắt
  cap: [
    ".................",
    ".................",
    ".....ccccccc.....",
    "....cccCCcccc....",
    "...cccccCCcccc...",
    "..cccccccccccccc.",
    "..cccccccccccccc.",
    "..hccccccckkkkkkk",
    "..hh....zzzzz....",
    "..hh.............",
    "..h..............",
    ".................",
    ".................",
    ".................",
  ],
  // Nhu: tóc buộc (đuôi tóc vẽ riêng ở sau gáy), mái lệch mềm
  ponytail: [
    ".................",
    ".................",
    ".....hhhhhh......",
    "...hhhhHHhhhh....",
    "..hhhhHHhhhhhh...",
    ".hhhhhhhhhhhhhh..",
    ".hhhhhhhhhhhhhh..",
    ".hhhhh..hhhhhhh..",
    ".hhhh.....hh.hh..",
    ".hhhh............",
    "..hhh............",
    "..hh.............",
    ".................",
    ".................",
  ],
  // Lê Thịnh: MÌ TÔM — xoăn tít, phồng to, lọn xoăn rủ trán
  curly: [
    ".....h.hh.h......",
    "...hhhhhhhhhhh...",
    "..hhHhdhHhdhhhh..",
    ".hhdhHhhdhHhhdhh.",
    ".hHhhdhHhhdhHhhh.",
    ".hhdhhHhdhhHhdhh.",
    ".hHhhdhhHhdhhHhh.",
    ".hhdhh.h.h.h.hh..",
    ".hhhh............",
    ".hhh.............",
    ".hh..............",
    "..h..............",
    ".................",
    ".................",
  ],
  // ---- MẪU TÓC CHUNG (nhân vật phụ) ----
  // tóc ngắn gọn, ít phồng
  short: [
    ".................",
    ".................",
    ".................",
    "......hhhhh......",
    "....hhhHHhhhh....",
    "...hhhhhhhhhhh...",
    "..hhhhhhhhhhhh...",
    "..hhhh.......h...",
    "..hhh............",
    "..hhh............",
    "..hh.............",
    "..h..............",
    ".................",
    ".................",
  ],
  // rẽ ngôi lệch, chải gọn hất sang phải
  sidePart: [
    ".................",
    ".................",
    "......hhhhhh.....",
    "....hhhHHHhhhh...",
    "...hhdhhhhHHhhh..",
    "..hhhhhhhhhhhhhh.",
    "..hhhhhhhhhhhhh..",
    "..hhhh....hhhh...",
    "..hhh.......h....",
    "..hhh............",
    "..hh.............",
    "..h..............",
    ".................",
    ".................",
  ],
  // tóc dài vừa, rối, mái lởm chởm
  messy: [
    ".................",
    "......h..h.......",
    "....hhhhhhhh.h...",
    "...hhhhHHhhhhh...",
    "..hhhhHhhhhhhhh..",
    ".hhhhhhhhhhhhhhh.",
    ".hhhhhhhhhhhhhhh.",
    ".hhhhh.hh.hhh.h..",
    ".hhhh..h.....h...",
    ".hhhh............",
    ".hhh.............",
    "..hh.............",
    "..h..............",
    ".................",
  ],
  // nữ — tóc dài thẳng (phần xõa sau lưng vẽ riêng ở hairBack)
  long: [
    ".................",
    ".................",
    ".....hhhhhh......",
    "...hhhhHHhhhh....",
    "..hhhHHhhhhhhh...",
    ".hhhhhhhhhhhhhh..",
    ".hhhhhhhhhhhhhh..",
    ".hhhhh..hhhhhhh..",
    ".hhhh.....hh.h...",
    ".hhhh............",
    ".hhhh............",
    ".hhhh............",
    ".hhhh............",
    ".hhh.............",
  ],
  // nữ — tóc bob ngang cằm, mái thưa
  bob: [
    ".................",
    ".................",
    ".....hhhhhh......",
    "...hhhhHHhhhh....",
    "..hhhHHhhhhhhh...",
    ".hhhhhhhhhhhhhh..",
    ".hhhhhhhhhhhhhhh.",
    ".hhhhhhhhhhhhhhh.",
    ".hhhhhh.h.hh.hh..",
    ".hhhh............",
    ".hhhh............",
    ".hhhh............",
    ".hhhh............",
    ".hhh.............",
  ],
  // Thiện Nhân: rẽ 2 mái giữa, ép XẸP BẾT dính sát đầu (không phồng), vệt bóng dầu
  flatPart: [
    ".................",
    ".................",
    ".................",
    "......hhhhh......",
    "....hhhGhhhhh....",
    "...hhhhhhGhhhh...",
    "..hhhhhhhzhhhhh..",
    "..hhhhhhGzhhhhh..",
    "..hhhh.hh.dhhh...",
    "..hhh............",
    "..hhh............",
    "...hh............",
    ".................",
    ".................",
  ],
};

/** Ô nào thuộc hộp sọ (để viền tóc không vẽ đè lên mặt) */
const skinLoEarly = (c) => dk(c, 0.2);
const inSkull = (rows, x, y) => y >= 0 && y < rows.length && x >= rows[y][0] && x <= rows[y][1];

// -------------------------------------------------------------------------------------
//  TƯ THẾ theo frame
// -------------------------------------------------------------------------------------
export const HUMAN_ANIMS = {
  idle: {
    frames: 10, fps: 6,
    // thở 0-6 · chớp mắt 7 · động tác riêng 8-9 (~6 giây/lần)
    seq: [0, 1, 2, 3, 4, 5, 6, 0, 1, 2, 3, 4, 5, 6, 7, 1, 2, 3, 4, 5, 6, 0, 1, 2, 3, 8, 9, 9, 9, 8, 4, 5, 6],
    pose: (i) => {
      const k = i >= 7 ? 0 : i, b = k >= 3 && k <= 5 ? 1 : 0, hb = k >= 4 && k <= 6 ? 1 : 0;
      return { bob: b, hb, lean: 0, legN: [0, 0], legF: [0, 0], armB: [0, b], arm: [0, b], tail: k >> 1, eyes: i === 7 ? "closed" : "open", gesture: i >= 8 ? i - 7 : 0 };
    },
  },
  run: {
    frames: 8, fps: 12, contact: [0, 4],
    pose: (i) => {
      const a = (i / 8) * Math.PI * 2, s = Math.sin(a), c = Math.cos(a);
      const bob = i % 4 === 2 ? -1 : 0;
      return {
        bob, hb: (i + 7) % 4 === 2 ? -1 : 0, lean: 1,
        legN: [Math.round(4 * s), -Math.max(0, Math.round(2.2 * -c))],
        legF: [Math.round(-4 * s), -Math.max(0, Math.round(2.2 * c))],
        armB: [Math.round(-3 * s), -Math.round(Math.abs(s))], arm: [0, bob], tail: i, eyes: "open", gesture: 0,
      };
    },
  },
  skill: {   // NỔI GIẬN: đổ người tới, nhíu mày, quát, rung
    frames: 4, fps: 14,
    pose: (i) => ({ bob: i % 2, hb: (i + 1) % 2, lean: 1, shake: i % 2 ? 1 : 0, legN: [2, 0], legF: [-2, 0], armB: [-2, -1], arm: [1, -1], tail: i * 2, eyes: "angry", mouth: "shout", gesture: 0 }),
  },
  hurt: {
    frames: 3, fps: 14, loop: false,
    pose: (i) => [
      { bob: 0, hb: 0, lean: -1, hl: -1, legN: [1, 0], legF: [-2, 0], armB: [-3, -3], arm: [-2, -2], tail: 1, eyes: "pain", mouth: "ouch", gesture: 0 },
      { bob: 1, hb: 1, lean: -2, hl: -1, legN: [2, 0], legF: [-3, -1], armB: [-4, -2], arm: [-3, -1], tail: 2, eyes: "pain", mouth: "ouch", gesture: 0 },
      { bob: 0, hb: 1, lean: -1, hl: 0, legN: [1, 0], legF: [-1, 0], armB: [-2, 0], arm: [-1, 0], tail: 3, eyes: "closed", gesture: 0 },
    ][i],
  },
};
const ROWS = ["idle", "run", "skill", "hurt"];

/** Nét dày (tay / chân) từ (x0,y0) tới (x1,y1), bề ngang w */
function limb(L, x0, y0, x1, y1, w, c) {
  const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
  for (let i = 0; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n, y = y0 + ((y1 - y0) * i) / n;
    L.rect(Math.round(x - (w - 1) / 2), Math.round(y), w, 1, c);
  }
}

// -------------------------------------------------------------------------------------
//  VẼ 1 FRAME
// -------------------------------------------------------------------------------------
function drawFrame(look, P, W, H, ax, ay) {
  const B = BUILD[look.build ?? "normal"], Hh = look.height ?? 35;
  const headKind = look.head ?? (look.crescent ? "crescent" : look.round ? "round" : look.female ? "female" : B.head);
  const rows = SKULL[headKind];
  const skinH = look.skin ?? "#e8b88a", skin = C(skinH), hairH = look.hair ?? "#1c1612", hairC = C(hairH);
  const topH = look.top?.color ?? "#e8e8e8", botH = look.bottom?.color ?? "#2a2e38", shoeH = look.shoes ?? "#2a2a2a";
  const acc = new Set(look.acc ?? []), G = look.gesture, gesture = P.gesture ?? 0;
  const shake = P.shake ?? 0, lean = P.lean ?? 0, bob = P.bob ?? 0, hbob = P.hb ?? bob;
  const tilt = G === "tilt" && gesture ? 1 : 0;

  const bx = Math.round(lean / 2) + shake;                       // tâm thân
  const hx = lean + (P.hl ?? 0) + shake + tilt;                  // tâm đầu
  const top0 = -Hh + hbob + tilt;                                // đỉnh sọ
  const chinY = top0 + rows.length - 1;
  const shY = -Hh + rows.length + 1 + bob;                       // vai
  const tl = Math.round((Hh - rows.length - 1) * 0.45);          // dài thân
  const hipY = shY + tl;
  const tw = B.tw - (look.female ? 1 : 0), hwL = Math.ceil(tw / 2), hwR = tw - hwL - 1;   // thân: x từ bx-hwL .. bx+hwR

  // ---------------- lớp (sau -> trước)
  const hairBack = new Layer(), armBack = new Layer(), prop = new Layer(), legBack = new Layer(), legFront = new Layer();
  const body = new Layer(), gear = new Layer(), head = new Layer(), face = new Layer(), glass = new Layer(), hairTop = new Layer();
  const armFront = new Layer(), armG = new Layer(), handG = new Layer(), extraFront = [];
  face.noOutline = true; glass.noOutline = true; handG.noOutline = true;
  hairBack.ink = inkOf(hairH); hairTop.ink = inkOf(hairH); body.ink = inkOf(topH); head.ink = inkOf(skinH, 0.5);
  legBack.ink = inkOf(dk(botH, 0.2)); legFront.ink = inkOf(botH);
  hairTop.inkSkip = (x, y) => inSkull(rows, x - hx, y - top0);   // tóc không kẻ viền đè lên mặt

  // ---------------- CHÂN
  const shorts = look.bottom?.kind === "shorts";
  const leg = (L, x0, d, back) => {
    const fx = x0 + d[0], fy = d[1], kx = (x0 + fx) / 2 + 0.6, ky = (hipY + fy) / 2;
    const pc = back ? dk(botH, 0.18) : C(botH), sk = back ? dk(skin, 0.12) : skin;
    limb(L, x0, hipY, kx, ky, B.lw, pc);
    limb(L, kx, ky, fx, fy - 2, B.lw - (B.lw > 3 ? 1 : 0), shorts ? sk : pc);
    if (shorts) L.rect(Math.round(kx - (B.lw - 1) / 2), Math.round(ky) - 1, B.lw, 2, pc);                // ống quần đùi trùm qua gối
    if (look.bottom?.kind === "cargo" && !back) L.rect(Math.round(kx) - 1, Math.round(ky) - 3, 3, 3, dk(botH, 0.22));   // túi hộp
    if (look.bottom?.ripped) { L.set(Math.round(kx), Math.round(ky), sk); L.set(Math.round(kx) - 1, Math.round(ky), lt(botH, 0.35)); }   // rách gối
    if (look.hiTop) L.rect(Math.round(fx) - 1, fy - 4, B.lw - 1, 2, back ? dk(shoeH, 0.2) : C(shoeH));                                  // giày cổ cao
    const sc = back ? dk(shoeH, 0.2) : C(shoeH);
    L.rect(Math.round(fx) - 2, fy - 2, 5, 2, sc); L.set(Math.round(fx) + 3, fy - 1, sc);                  // giày mũi chĩa phải
    if (look.shoeSole) L.rect(Math.round(fx) - 2, fy - 1, 6, 1, back ? dk(look.shoeSole, 0.2) : C(look.shoeSole));
  };
  leg(legBack, bx - 2, P.legF ?? [0, 0], true);
  leg(legFront, bx + 1, P.legN ?? [0, 0], false);
  legFront.rect(bx - 3, hipY, 6, 2, C(botH));                                                              // đáy quần nối 2 ống
  if (look.bottom?.label) for (const [x, y] of [[0, 0], [1, 0], [1, 1], [0, 2], [2, 0], [3, 0], [3, 1], [3, 2]]) legFront.set(bx + 1 + x, hipY + 3 + y, [236, 236, 236]);   // số 21 nhỏ

  // ---------------- THÂN + ÁO (nhìn 3/4: ngực quay phải, bụng béo phình ra trước)
  const T = tone(topH), kind = look.top?.kind ?? "tee";
  for (let r = 0; r <= tl; r++) {
    const k = r / tl, y = shY + r;
    let L0 = bx - hwL + (r === 0 ? 1 : 0), R0 = bx + hwR - (r === 0 ? 1 : 0);
    if (B.belly) { R0 += Math.round(B.belly * Math.sin(Math.min(1, k * 1.15) * Math.PI * 0.95)); if (k > 0.5) L0 -= 1; }
    body.rect(L0, y, R0 - L0 + 1, 1, T);
  }
  const shirtC = C(topH);
  if (kind === "polo" || kind === "shirt") {   // cổ áo bẻ + nẹp cúc
    const cc = C(look.top.collar ?? lt(topH, 0.2));
    body.rect(hx - 1, shY, 2, 2, cc); body.rect(hx + 2, shY, 2, 2, cc); body.set(hx + 1, shY, skin);
    if (kind === "shirt") for (let y = shY + 2; y < hipY; y += 2) body.set(hx + 1, y, dk(topH, 0.3));
    else { body.set(hx + 1, shY + 1, dk(topH, 0.2)); body.set(hx + 1, shY + 2, lt(topH, 0.3)); body.set(hx + 1, shY + 3, lt(topH, 0.3)); }
  } else if (kind === "jacket" || kind === "hoodie") {
    for (let y = shY + 1; y < hipY; y++) body.set(hx + 1, y, kind === "jacket" ? lt(topH, 0.16) : dk(topH, 0.1));   // khóa kéo
    if (kind === "hoodie") { body.rect(bx - hwL, shY - 1, 4, 2, T); body.set(hx + 2, shY + 2, [244, 240, 236]); body.set(hx + 2, shY + 3, [244, 240, 236]); body.set(hx, shY + 2, [244, 240, 236]); }
    body.rect(bx - hwL + 1, hipY - 1, tw - 1, 1, dk(topH, 0.18));   // bo gấu
    body.rect(hx - 1, shY, 3, 1, dk(topH, 0.12));                    // cổ áo đứng
  } else body.rect(hx - 1, shY, 3, 1, mixc(skin, shirtC, 0.0));      // áo phông cổ tròn lộ cổ
  const pr = look.top?.print;
  if (pr === "arizona") {          // chữ cong xanh dương + số 82 vàng (áo ảnh 1)
    const y = shY + 3, x0 = bx - hwL + 2;
    [[0, 1], [1, 0], [2, 0], [3, 0], [4, 0], [5, 1]].forEach(([x, dy]) => body.set(x0 + x, y + dy, [44, 112, 150]));
    body.rect(x0 + 1, y + 3, 2, 2, [232, 196, 72]); body.rect(x0 + 4, y + 3, 2, 2, [232, 196, 72]);
    body.rect(x0 + 1, y + 6, 5, 1, [60, 130, 150]);
  } else if (pr === "stripes") {   // 2 sọc chéo xanh lá trên polo tím (ảnh 4)
    for (const off of [4, 8]) for (let k = 0; k < tw + 2; k++) { const y = shY + off - Math.round(k * 0.6); if (y > shY + 1 && y < hipY) body.set(bx - hwL + k, y, [72, 204, 92]); }
    body.rect(bx - hwL + 2, shY + 2, 2, 2, [232, 204, 128]);   // logo tròn
  } else if (pr === "waffle") {    // áo dệt tổ ong (ảnh 3)
    for (let y = shY + 2; y < hipY; y += 2) for (let x = bx - hwL + 1 + ((y >> 1) % 2); x <= bx + hwR; x += 2) body.set(x, y, dk(topH, 0.1));
  }
  if (look.top?.tucked) { body.rect(bx - hwL, hipY, tw + B.belly, 1, C(look.belt ?? "#2a2420")); body.set(hx + 1, hipY, [208, 196, 150]); }

  // ---------------- TAY SAU + đồ xách
  const aw = B.aw, shortSleeve = kind === "tee" || kind === "polo";
  const sleeveB = dk(topH, 0.22), skinB = dk(skin, 0.16);
  const arm = (L, x0, y0, x1, y1, w, sl, sk, long) => {
    const mx = x0 + (x1 - x0) * 0.45, my = y0 + (y1 - y0) * 0.45;
    limb(L, x0, y0, mx, my, w, sl);
    limb(L, mx, my, x1, y1, Math.max(2, w - 1), long ? sl : sk);
    L.rect(Math.round(x1) - 1, Math.round(y1), 2, 2, sk);   // bàn tay
  };
  const sbx = bx - hwL + 1, sby = shY + 1;
  let bhx = sbx - 1 + (P.armB?.[0] ?? 0), bhy = hipY + (P.armB?.[1] ?? 0);
  if (acc.has("briefcase")) { bhx = sbx; bhy = hipY + 1 + (P.armB?.[1] ?? 0) * 0; }
  armBack.ink = inkOf(sleeveB);
  // động tác tay sau (tay không cầm súng): vẽ trước ngực, bàn tay đè lên mặt
  const gx = { chin: [hx + 3, top0 + 10], hair: [hx - 1, top0 - 1], point: [bx + 1, shY - 2], strap: [bx + 1, shY + 3], glasses: [hx + 2, top0 + 6] }[G];
  const useBackGesture = gesture && gx && !(G === "glasses" && acc.has("briefcase"));
  if (useBackGesture && G === "hair") {   // GÃI ĐẦU: tay vòng ra SAU đầu, chỉ thấy bàn tay trên mái tóc
    const [tx, ty] = gx;
    limb(armBack, sbx, sby, sbx - 2, shY - 2, aw, sleeveB); limb(armBack, sbx - 2, shY - 2, tx - 2, ty + 2, Math.max(2, aw - 1), shortSleeve ? skinB : sleeveB);
    handG.rect(tx - 2, ty - (gesture === 2 ? 1 : 0), 3, 2, skin); handG.set(tx - 2, ty + 1 - (gesture === 2 ? 1 : 0), skinLoEarly(skin));
  } else if (useBackGesture) {
    const [tx, ty] = gx, ex = (sbx + tx) / 2 - 2, ey = Math.max(sby + 2, (sby + ty) / 2 + 3);
    limb(armBack, sbx, sby, ex, ey, aw, sleeveB);
    limb(armG, ex, ey, tx, ty + 1, Math.max(2, aw - 1), shortSleeve ? skin : C(topH));
    armG.ink = inkOf(shortSleeve ? skinH : topH);
    handG.rect(tx - 1, ty, 2, 2, skin);
    if (G === "point") { handG.set(tx, ty - 1, skin); handG.set(tx, ty - 2, skin); }                       // giơ ngón tay
    if (G === "glasses") { handG.set(tx + 1, ty, lt(skin, 0.2)); }
  } else arm(armBack, sbx, sby, bhx, bhy, aw, sleeveB, skinB, !shortSleeve);
  if (acc.has("briefcase")) {   // CẶP XÁCH NGANG như thầy giáo (quai trong lòng bàn tay, thân cặp nằm ngang)
    const bcH = look.briefcase ?? "#6a4428", cx0 = bhx - 6, cy0 = bhy + 2;
    prop.ink = inkOf(bcH);
    prop.rect(cx0, cy0, 12, 6, tone(bcH, 0.2)); prop.rect(cx0 + 1, cy0 + 2, 10, 1, dk(bcH, 0.22));
    prop.rect(bhx - 1, cy0 - 1, 3, 1, dk(bcH, 0.4)); prop.set(cx0 + 6, cy0 + 3, [226, 196, 92]);
  }

  // ---------------- ĐẦU: sọ + tai + bóng
  rows.forEach(([a, b], r) => head.rect(hx + a, top0 + r, b - a + 1, 1, skin));
  const skinLo = dk(skin, 0.2), skinHi = lt(skin, 0.18);
  rows.forEach(([a], r) => { if (r > 1) head.set(hx + a, top0 + r, skinLo); });                              // gáy tối
  head.rect(hx + rows[rows.length - 1][0], chinY, rows[rows.length - 1][1] - rows[rows.length - 1][0] + 1, 1, skinLo);   // dưới cằm
  head.rect(bx - 1, chinY + 1, 3, Math.max(1, shY - chinY - 1), skinLo);                                    // cổ
  const earX = hx + (headKind === "fat" ? -4 : FEAT.earX), eY = top0 + FEAT.eyeY;
  head.set(earX, eY, skin); head.set(earX + 1, eY, skin); head.set(earX, eY + 1, skinLo); head.set(earX + 1, eY + 1, skin); head.set(earX, eY + 2, skin);
  face.set(earX + 1, eY + 1, skinLo);
  face.set(hx + 3, top0 + 7, skinHi); face.set(hx + 2, top0 + 2, skinHi);                                    // gò má + trán bắt sáng
  face.set(hx + 5, top0 + FEAT.noseY + 1, skinLo);                                                          // bóng dưới mũi

  // ---------------- MẶT
  const F = look.face ?? "neutral", EY = P.eyes ?? "open", laugh = G === "laugh" && gesture;
  const eyeC = [40, 28, 32], white = [252, 250, 244], browC = dk(hairH, 0.05), lip = mixc(skin, [168, 70, 70], 0.38), mouthC = [96, 40, 46];
  const nX = hx + FEAT.eN, fX = hx + FEAT.eF, by = top0 + FEAT.browY, mY = top0 + (headKind === "crescent" ? 10 : FEAT.mouthY);
  const lookBack = G === "look" && gesture ? -1 : 0;
  // lông mày
  const brow = (x, w, dy = 0) => face.rect(x, by + dy, w, 1, browC);
  if (EY === "angry" || F === "stubborn") { face.set(nX - 1, by, browC); face.set(nX, by + 1, browC); face.set(fX + 1, by, browC); face.set(fX, by + 1, browC); }
  else if (EY === "pain") { face.set(nX - 1, by + 1, browC); face.set(nX, by, browC); face.set(fX, by, browC); face.set(fX + 1, by + 1, browC); }
  else if (F === "mischief") { brow(nX - 1, 2); brow(fX, 2, -1); }
  else if (F === "cool") { face.set(nX - 1, by + 1, browC); face.set(nX, by + 1, browC); face.set(nX + 1, by, browC); brow(fX, 2, -1); }   // mày gần hạ, mày xa nhướng
  else if (F === "dazed") { brow(nX - 1, 2, -1); brow(fX, 2, -1); }
  else { brow(nX - 1, 2); brow(fX, 2); }
  // mắt
  const openEye = (x) => {
    if (F === "dazed") { face.rect(x - 1, eY, 2, 2, white); face.rect(x + lookBack, eY, 1, 2, eyeC); face.set(x + lookBack, eY, [70, 50, 54]); if (look.female) face.set(x + 1, eY - 1, eyeC); }
    else if (F === "calm") { face.set(x, eY, mixc(skin, eyeC, 0.35)); face.set(x, eY + 1, eyeC); face.set(x - 1, eY + 1, mixc(skin, eyeC, 0.3)); }
    else if (F === "cool") { face.rect(x - 1, eY, 2, 1, dk(skin, 0.5)); face.set(x, eY + 1, eyeC); face.set(x - 1, eY + 1, mixc(skin, white, 0.5)); }   // mi sụp, liếc lạnh
    else { face.rect(x + lookBack, eY, 1, 2, eyeC); face.set(x + lookBack, eY, [74, 54, 60]); if (F !== "goofy") face.set(x - 1 + lookBack * -1 * 0, eY + 1, mixc(skin, white, 0.55)); if (look.female) face.set(x + 1, eY - 1, eyeC); }
  };
  const shutEye = (x) => face.rect(x - 1, eY + 1, 2, 1, eyeC);
  const happyEye = (x) => { face.set(x - 1, eY + 1, eyeC); face.set(x, eY, eyeC); face.set(x + 1, eY + 1, eyeC); };
  const painEye = (x) => { face.set(x - 1, eY, eyeC); face.set(x, eY + 1, eyeC); face.set(x - 1, eY + 2, eyeC); };
  const angryEye = (x) => { face.rect(x - 1, eY + 1, 2, 1, eyeC); face.set(x, eY, eyeC); };
  for (const x of [nX, fX]) {
    if (EY === "closed") shutEye(x);
    else if (EY === "pain") painEye(x);
    else if (EY === "angry") angryEye(x);
    else if (laugh || (F === "goofy" && EY === "open" && false)) happyEye(x);
    else openEye(x);
  }
  // má hồng
  if (look.female || F === "dazed" || F === "goofy") { face.set(nX - 2, eY + 3, mixc(skin, [255, 120, 130], 0.32)); face.set(fX + 1, eY + 3, mixc(skin, [255, 120, 130], 0.32)); }
  // miệng (khẩu trang thì bỏ qua)
  if (!look.mask) {
    const M = P.mouth ?? (laugh ? "laugh" : F);
    if (M === "shout") { face.rect(hx + 2, mY - 1, 3, 2, mouthC); face.rect(hx + 2, mY - 1, 3, 1, white); }
    else if (M === "ouch") { face.rect(hx + 2, mY, 2, 1, mouthC); face.set(hx + 4, mY - 1, mouthC); }
    else if (M === "laugh" || M === "goofy") { face.set(hx + 1, mY - 1, mouthC); face.rect(hx + 2, mY, 3, 1, mouthC); face.rect(hx + 2, mY - 1, 2, 1, white); face.set(hx + 4, mY - 1, mouthC); }   // cười toe ngờ nghệch
    else if (M === "cool") { face.rect(hx + 2, mY, 2, 1, dk(lip, 0.1)); face.set(hx + 4, mY - 1, dk(lip, 0.1)); }   // nhếch mép 1 bên
    else if (M === "smart" || M === "mischief" || M === "grin") { face.rect(hx + 2, mY, 2, 1, lip); face.set(hx + 4, mY - 1, lip); if (M === "grin") face.set(hx + 1, mY, lip); }   // nhếch mép
    else if (M === "stubborn") face.rect(hx + 2, mY, 3, 1, dk(lip, 0.15));
    else if (M === "dazed") face.set(hx + 3, mY, mouthC);
    else face.rect(hx + 2, mY, 2, 1, lip);
  }
  if (look.mole) face.set(nX - 1, eY + 3, [70, 40, 34]);                                                    // nốt ruồi trên má
  if (look.stubble) for (const [x, y] of [[0, 0], [2, 0], [4, 0], [1, 1], [3, 1]]) face.set(hx + x, chinY - 1 + y, mixc(skin, [60, 46, 44], 0.26));   // râu lún phún quanh cằm
  if (look.mask) {   // khẩu trang đen: che mũi tới cằm, quai móc tai
    const mc = C(look.mask);
    for (let y = eY + 2; y <= chinY; y++) { const r = rows[y - top0]; const x0 = Math.max(hx - 2, hx + r[0] + 3); face.rect(x0, y, hx + r[1] - x0 + 1, 1, mc); }
    face.set(hx + 6, top0 + FEAT.noseY, mc);
    face.rect(earX + 1, eY + 2, 2, 1, dk(mc, 0.1));
  }
  if (acc.has("lollipop")) {   // kẹo mút ngậm khóe miệng: que trắng chĩa chéo, viên kẹo nhỏ
    face.set(hx + 4, mY, [236, 236, 232]); face.set(hx + 5, mY, [236, 236, 232]);
    const cdy = new Layer(); cdy.ink = [150, 40, 80];
    cdy.set(hx + 6, mY - 1, [236, 236, 232]); cdy.rect(hx + 7, mY - 3, 2, 2, [232, 90, 140]); cdy.set(hx + 7, mY - 3, [255, 196, 220]);
    extraFront.push(cdy);
  }
  if (acc.has("earring")) { face.set(earX, eY + 3, [150, 156, 170]); face.set(earX, eY + 2, dk(skin, 0.2)); }   // khuyên tai bạc ở dái tai

  // ---------------- KÍNH CẬN: gọng mảnh (vành trên đậm, vành dưới nhạt), tròng TRONG sáng hơn da, thấy rõ con ngươi
  const gl = look.glasses;
  if (gl) {
    const fc = C(look.glassesColor ?? "#2a2226"), side = mixc(fc, skin, 0.3), bot = mixc(fc, skin, 0.55);
    const lensC = mixc(lt(skin, 0.32), [214, 236, 255], 0.3), pupil = [36, 26, 30];
    const box = (x0, y0, w, h, px, glint) => {
      for (let x = x0; x < x0 + w; x++) { glass.set(x, y0, fc); glass.set(x, y0 + h - 1, bot); }
      for (let y = y0 + 1; y < y0 + h - 1; y++) { glass.set(x0, y, side); glass.set(x0 + w - 1, y, side); }
      for (let y = y0 + 1; y < y0 + h - 1; y++) for (let x = x0 + 1; x < x0 + w - 1; x++) glass.set(x, y, lensC);
      if (EY === "open" && !laugh) { glass.rect(px + lookBack, eY, 1, 2, pupil); if (F === "calm") glass.set(px, eY, mixc(lensC, pupil, 0.4)); }
      else for (const [x, y, c] of face.px.size ? [...face.px.values()].filter((p) => p.x > x0 && p.x < x0 + w - 1 && p.y > y0 && p.y < y0 + h - 1).map((p) => [p.x, p.y, p.c]) : []) glass.set(x, y, c);
      if (glint) glass.set(x0 + 1, y0 + 1, [255, 255, 255]);
    };
    if (gl === "big") { box(nX - 3, eY - 2, 5, 5, nX, true); box(fX - 1, eY - 2, 3, 5, fX, false); glass.set(nX + 2, eY - 1, fc); }
    else { box(nX - 2, eY - 1, 4, 4, nX, true); box(fX - 1, eY - 1, 3, 4, fX, false); glass.set(nX + 2, eY, fc); }
    for (let x = earX + 1; x < nX - (gl === "big" ? 3 : 2); x++) glass.set(x, eY - (gl === "big" ? 1 : 0), side);   // càng kính về tai
  }

  // ---------------- TÓC (bảng vẽ tay)
  const hairT = tone(hairH), hiC = lt(hairH, 0.26), loC = dk(hairH, 0.3);
  const capC = C(look.cap ?? "#18181c");
  const pal = { h: hairC, H: hiC, d: loC, s: mixc(skin, hairC, 0.55), c: capC, C: lt(capC, 0.18), k: dk(capC, 0.25), z: dk(skin, 0.24), G: mixc(hairC, [190, 210, 230], 0.55) };
  const tpl = HAIR[look.hairStyle ?? "sweep"] ?? HAIR.sweep;
  const sway = [0, 0, 1, 0][(P.tail ?? 0) % 4];
  tpl.forEach((line, j) => {
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === "." || !pal[ch]) continue;
      const x = hx + i - 8, y = top0 + j - 4;
      if (ch === "z" || ch === "s" || ch === "G") face.set(x, y, pal[ch]);                                   // bóng / chân tóc nằm trên da
      if (ch === "z") continue;
      hairTop.set(x, y - (y < top0 && i % 3 === 0 ? sway : 0), pal[ch]);
    }
  });
  void hairT;
  if (look.hairStyle === "long") {   // TÓC DÀI: xõa sau lưng tới giữa lưng, đung đưa nhẹ khi chạy
    const sw = [0, 0, 1, 1, 0, 0, -1, -1][(P.tail ?? 0) % 8];
    for (let k = 0; k < 14; k++) { const x0 = hx - 7 + (k > 9 ? 1 : 0) + Math.round((sw * k) / 10), w = k > 11 ? 3 : 5; hairBack.rect(x0, top0 + 5 + k, w, 1, k % 5 === 2 ? lt(hairH, 0.18) : hairC); }
  }
  if (look.hairStyle === "ponytail") {   // ĐUÔI TÓC: đen hơi nâu, ngọn VÀNG, đung đưa theo bước chạy
    const sw = [0, 1, 1, 0, -1, -1, 0, 0][(P.tail ?? 0) % 8], tip = C(look.hairTip ?? "#e8c048");
    const len = look.tailLen ?? 17;
    for (let k = 0; k < len; k++) {
      const x = hx - 7 - Math.round(k * 0.22) + Math.round((sw * k) / 7), y = top0 + 2 + k, w = k > 1 && k < len - 3 ? 3 : 2;
      hairBack.rect(x - (w > 2 ? 1 : 0), y, w, 1, k >= len - 5 ? tip : k === len - 6 ? mixc(hairC, tip, 0.5) : hairC);
      if (k % 4 === 2 && k < len - 5) hairBack.set(x, y, lt(hairH, 0.22));          // ánh tóc
    }
    hairBack.rect(hx - 6, top0 + 6, 3, 5, hairC);                                        // tóc sau gáy dài phủ cổ
    hairTop.set(hx - 7, top0 + 2, [210, 70, 96]); hairTop.set(hx - 7, top0 + 3, [210, 70, 96]);              // dây buộc tóc
  }

  // ---------------- ĐỒ ĐEO
  if (acc.has("chain")) for (let k = 0; k < 4; k++) gear.set(hx - 1 + k, shY + 1 + (k === 1 || k === 2 ? 1 : 0), [210, 214, 222]);
  if (acc.has("glassesHang")) { gear.rect(hx + 2, shY + 1, 2, 2, [40, 38, 42]); gear.rect(hx + 4, shY + 1, 2, 2, [40, 38, 42]); gear.set(hx + 2, shY + 1, [150, 170, 190]); }
  if (acc.has("crossbag")) {   // túi đeo chéo: dây từ vai sau chéo xuống hông trước, túi ở hông
    const bgH = look.bag ?? "#4e5a32";
    gear.ink = inkOf(bgH);
    for (let k = 0; k <= tl; k++) gear.set(bx - hwL + 1 + Math.round((k * (tw - 1)) / tl), shY + k, C(bgH));
    gear.rect(bx + hwR - 1, hipY - 2, 5, 5, tone(bgH, 0.16)); gear.rect(bx + hwR - 1, hipY - 2, 5, 1, lt(bgH, 0.2));
  }
  if (acc.has("frontpack")) {  // ba lô đeo TRƯỚC NGỰC (ảnh 5): thân túi phồng tròn, 2 quai qua vai, khóa kéo cong, túi nhỏ phía trước
    const pkH = look.pack ?? "#3a3a44", pk = C(pkH), x0 = bx - hwL + 1, x1 = bx + hwR + 2, y0 = shY + 2, y1 = hipY + 1;
    gear.ink = dk(pkH, 0.55);
    for (let y = y0; y <= y1; y++) { const inset = y === y0 || y === y1 ? 1 : 0; gear.rect(x0 + inset, y, x1 - x0 + 1 - inset * 2, 1, tone(pkH, 0.2)); }
    for (let x = x0 + 2; x <= x1 - 2; x++) gear.set(x, y0 + 2 - (x > x0 + 2 && x < x1 - 2 ? 1 : 0), lt(pkH, 0.28));   // khóa kéo cong
    gear.rect(x0 + 2, y1 - 3, x1 - x0 - 3, 3, dk(pkH, 0.18)); gear.rect(x0 + 2, y1 - 3, x1 - x0 - 3, 1, lt(pkH, 0.12));   // túi nhỏ
    gear.set(x1 - 2, y0 + 1, [170, 172, 182]);                                                                              // đầu khóa
    gear.rect(bx - hwL + 1, shY - 1, 2, 3, dk(pkH, 0.1)); gear.rect(bx + hwR - 1, shY - 1, 2, 3, dk(pkH, 0.1));            // quai qua vai
    void pk;
  }

  // ---------------- TAY TRƯỚC (cầm súng)
  let handX = bx + hwR + 3 + (P.arm?.[0] ?? 0), handY = shY + 6 + (P.arm?.[1] ?? 0);
  if (G === "glasses" && gesture && acc.has("briefcase")) { handX = hx + 3; handY = top0 + 7 + (gesture === 1 ? 1 : 0); }   // tay cầm súng đẩy gọng kính
  armFront.ink = inkOf(shortSleeve ? topH : topH);
  const frontGlasses = G === "glasses" && gesture && acc.has("briefcase");
  if (frontGlasses) {   // khuỷu tay chìa ra trước, cẳng tay gập lên, ngón tay đẩy gọng
    const ex = bx + hwR + 3, ey = shY + 4, sc = C(look.top?.color2 ?? topH);
    limb(armFront, bx + hwR - 1, shY + 1, ex, ey, aw, sc);
    limb(armG, ex, ey, handX + 1, handY + 1, 2, shortSleeve ? skin : sc); armG.ink = inkOf(shortSleeve ? skinH : topH);
    handG.rect(handX, handY, 2, 2, skin);
  } else arm(armFront, bx + hwR - 1, shY + 1, handX, handY - 1, aw, C(look.top?.color2 ?? topH), skin, !shortSleeve);
  if (G === "glasses" && gesture && acc.has("briefcase")) handG.set(hx + 2, top0 + 5, lt(skin, 0.15));        // ngón tay chạm gọng

  // ---------------- GHÉP
  const rgba = new Uint8ClampedArray(W * H * 4);
  composeSoft([hairBack, armBack, prop, legBack, legFront, body, gear, head, face, glass, hairTop, ...extraFront, armFront, armG, handG], rgba, W, H, ax, ay);
  return { rgba, hand: [handX, handY] };
}

/** Như compose của chibi nhưng viền mỗi lớp bằng màu `ink` riêng; `inkSkip(x,y)` = bỏ viền tại ô đó */
function composeSoft(layers, rgba, W, H, ax, ay) {
  const put = (x, y, c) => {
    const X = ax + x, Y = ay + y;
    if (X < 0 || Y < 0 || X >= W || Y >= H) return;
    const j = (Y * W + X) * 4;
    rgba[j] = c[0]; rgba[j + 1] = c[1]; rgba[j + 2] = c[2]; rgba[j + 3] = 255;
  };
  for (const L of layers) {
    if (!L || !L.px.size) continue;
    L.shade();
    if (!L.noOutline) {
      const ink = L.ink ?? [40, 28, 40];
      for (const p of L.px.values()) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const x = p.x + dx, y = p.y + dy;
        if (!L.has(x, y) && !(L.inkSkip && L.inkSkip(x, y))) put(x, y, ink);
      }
    }
    for (const p of L.px.values()) put(p.x, p.y, p.out);
  }
}

// -------------------------------------------------------------------------------------
//  NƯỚNG SPRITESHEET
// -------------------------------------------------------------------------------------
export function bakeHuman(look) {
  const { w, h, ax, ay } = HUMAN_FRAME;
  const cols = Math.max(...ROWS.map((r) => HUMAN_ANIMS[r].frames));
  const width = w * cols, height = h * ROWS.length, rgba = new Uint8ClampedArray(width * height * 4);
  const hands = [];
  ROWS.forEach((name, r) => {
    const A = HUMAN_ANIMS[name], row = [];
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
      const A = HUMAN_ANIMS[n];
      return [n, { row: i, frames: A.frames, fps: A.fps, loop: A.loop !== false, contact: A.contact ?? [], ...(A.seq ? { seq: A.seq } : {}) }];
    })),
  };
}

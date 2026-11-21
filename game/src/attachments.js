// =====================================================================================
//  PHỤ KIỆN SÚNG + ẢNH CHI TIẾT (HD) — nền móng cho XƯỞNG VŨ KHÍ (build súng) sau này
//
//  Đã có:  - 7 phụ kiện (ảnh cắt từ tấm phụ kiện của bạn) + chỉ số + ô gắn (optic / muzzle / under / mag)
//          - applyAttachments(def, ids): trả về BẢN SAO định nghĩa súng đã cộng chỉ số phụ kiện
//          - slotsFor(def): súng này gắn được những ô nào (theo loại đạn)
//          - HD_GUNS: ảnh chi tiết lớn của 7 khẩu (hiện ở Kho Vũ Khí; trong trận vẫn dùng ảnh pixel nhỏ cho sắc nét)
//  Để làm Xưởng Vũ Khí: lưu danh sách phụ kiện theo từng súng (vd stash.weapons[i].parts = ["eotech", ...]),
//  rồi khi tạo súng trong trận dùng makeWeapon(applyAttachments(WEAPONS[id], parts), lvl).
//  >>> ĐỔI ẢNH: thay file trong game/assets/images/guns/parts/ và .../guns/hd/ (giữ tên file).
// =====================================================================================
const PARTS = "assets/images/guns/parts/";
const HD = "assets/images/guns/hd/";

export const ATTACH_SLOTS = {
  optic: "Ống ngắm",
  muzzle: "Đầu nòng",
  under: "Dưới nòng",
  mag: "Băng đạn",
};

/** mods: hệ số NHÂN lên chỉ số súng (critBonus: CỘNG thêm tỉ lệ chí mạng) */
export const ATTACHMENTS = {
  eotech:     { slot: "optic",  name: "Ống Ngắm Toàn Ký",  img: PARTS + "eotech.png",     mods: { spread: 0.8, critBonus: 0.04 },  desc: "-20% độ tản, +4% chí mạng" },
  reddot:     { slot: "optic",  name: "Kính Chấm Đỏ",      img: PARTS + "reddot.png",     mods: { spread: 0.85 },                  desc: "-15% độ tản, nhẹ" },
  scope4x:    { slot: "optic",  name: "Kính Ngắm 4x",      img: PARTS + "scope4x.png",    mods: { range: 1.35, spread: 0.7, critBonus: 0.08 }, desc: "+35% tầm bắn, -30% độ tản, +8% chí mạng" },
  suppressor: { slot: "muzzle", name: "Nòng Giảm Thanh",   img: PARTS + "suppressor.png", mods: { noise: 0.35, damage: 0.95 },     desc: "Tiếng súng nhỏ đi 65% (zombie khó nghe), -5% sát thương" },
  bayonet:    { slot: "muzzle", name: "Lưỡi Lê",           img: PARTS + "bayonet.png",    mods: { knockback: 1.4 },                desc: "+40% đẩy lùi" },
  foregrip:   { slot: "under",  name: "Tay Cầm Trước",     img: PARTS + "foregrip.png",   mods: { kick: 0.6, spread: 0.85 },       desc: "-40% giật, -15% độ tản" },
  stanag:     { slot: "mag",    name: "Băng Đạn Mở Rộng",  img: PARTS + "stanag.png",     mods: { mag: 1.5, reload: 1.1 },         desc: "+50% sức chứa, nạp chậm hơn 10%" },
};
/** Ảnh viên đạn (giao diện) */
export const AMMO_ART = { rifle: PARTS + "round556.png", shell: PARTS + "shell12.png" };

/** Ảnh chi tiết (lớn) theo `sprite` của súng trong weapons.js */
export const HD_GUNS = {
  carbine:  { file: HD + "m4a1.png",         note: "M4A1 gắn sẵn ống ngắm toàn ký, tay cầm trước, nòng giảm thanh" },
  rifle:    { file: HD + "akm.png",          note: "AKM" },
  smg:      { file: HD + "mp5a3.png",        note: "MP5A3" },
  sniper:   { file: HD + "awm.png",          note: "Accuracy International AWM" },
  shotgun:  { file: HD + "remington870.png", note: "Remington 870" },
  pistol:   { file: HD + "glock19.png",      note: "Glock 19 gắn đèn" },
  a_m249:   { file: HD + "m249.png",         note: "M249 SAW" },
};
/** Ảnh lưỡi lê gắn sẵn trên M4 (dùng cho Xưởng Vũ Khí sau này) */
export const HD_EXTRA = { m4a1_bayonet: HD + "m4a1_bayonet.png" };

/** Đường dẫn ảnh chi tiết của 1 vũ khí (bản thể / định nghĩa / tên sprite) hoặc null */
export function hdGunUrl(w) {
  const key = typeof w === "string" ? w : (w?.def ?? w)?.sprite;
  return HD_GUNS[key]?.file ?? null;
}

/** Súng này gắn được những ô phụ kiện nào (dựa vào loại đạn — xem src/ammo.js) */
export function slotsFor(def, ammoType) {
  if (!def?.mag) return [];
  switch (ammoType) {
    case "rifle": case "smg": case "lmg": return ["optic", "muzzle", "under", "mag"];
    case "sniper": return ["optic", "muzzle"];
    case "pistol": return ["optic", "muzzle", "mag"];
    case "shell": return ["optic", "under", "mag"];
    default: return [];   // súng năng lượng / súng nổ: chưa có phụ kiện
  }
}

/** Gắn phụ kiện: trả về BẢN SAO định nghĩa súng đã đổi chỉ số (không sửa WEAPONS gốc) */
export function applyAttachments(def, ids = []) {
  const d = { ...def, attachments: [...ids] };
  const used = new Set();
  for (const id of ids) {
    const a = ATTACHMENTS[id];
    if (!a || used.has(a.slot)) continue;   // mỗi ô chỉ 1 phụ kiện
    used.add(a.slot);
    for (const [k, m] of Object.entries(a.mods)) {
      if (k === "critBonus") d.critBonus = (d.critBonus ?? 0) + m;
      else if (k === "mag") d.mag = Math.max(1, Math.round((d.mag ?? 0) * m));
      else if (typeof d[k] === "number") d[k] = d[k] * m;
    }
  }
  return d;
}

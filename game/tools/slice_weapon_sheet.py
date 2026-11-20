# Tách 45 vũ khí từ ảnh kho vũ khí (ảnh AI, nền xám đậm, nhãn chữ kem viền đen) thành PNG nền trong suốt.
import json, sys
import numpy as np
import cv2
from PIL import Image
from scipy import ndimage as ndi

SRC = sys.argv[1] if len(sys.argv) > 1 else "sheet.png"
OUT = sys.argv[2] if len(sys.argv) > 2 else "out"

a = np.asarray(Image.open(SRC).convert("RGB")).astype(np.int16)
H, W, _ = a.shape
R, G, B = a[..., 0], a[..., 1], a[..., 2]
lum = 0.3 * R + 0.59 * G + 0.11 * B
mx, mn = a.max(2), a.min(2)
chroma = mx - mn

# ---------- chữ: thân kem trung tính (B <= R) + viền đen tuyền sát bên
text_core = (lum > 105) & (chroma < 40) & ((B - R) <= 3)
text_core = ndi.binary_opening(text_core, np.ones((2, 2)))
near_text = ndi.binary_dilation(text_core, iterations=4)
black = (mx < 22) & ((B - R) <= 4)
text_mask = ndi.binary_dilation(text_core, iterations=1) | (black & near_text)

# ---------- nền: xám ~ (35,36,40); tiền cảnh = lệch đủ xa
bg = np.array([35, 36, 40])
diff = np.abs(a - bg).max(2)
fg = diff > 13
fg &= ~text_mask

# ---------- dải hàng (y gốc) & cột
ROWS = [(18, 70), (86, 130), (140, 196), (196, 246), (258, 300), (304, 366), (366, 418), (424, 480), (494, 534)]
COLW = W / 5
NAMES = [
    ["glock", "colt", "revolver", "beretta", "deagle"],
    ["sawedoff", "pump", "combatsg", "autoshotgun", "doublebarrel"],
    ["m4", "ak", "scar", "famas", "g36c"],
    ["mp5", "uzi", "p90", "tommy", "vector"],
    ["awp", "barrett", "dragunov", "m24", "intervention"],
    ["m249", "rpk", "m60", "mg42", "stoner"],
    ["laserrifle", "plasmagun", "raygun", "ioncannon", "emp"],
    ["scifi1", "scifi2", "futurerifle", "proto1", "proto2"],
    ["knife", "crowbar", "machete", "hatchet", "baton"],
]

import os
os.makedirs(OUT, exist_ok=True)
meta = {}
sheet_tiles = []
for r, (y0, y1) in enumerate(ROWS):
    for c in range(5):
        x0, x1 = int(c * COLW) + 4, int((c + 1) * COLW) - 4
        sub = fg[y0:y1, x0:x1].copy()
        # bỏ vạch kẻ ô / vết xước mảnh
        sub = ndi.binary_opening(sub, np.ones((2, 2)))
        # nối mảnh để chọn khối lớn nhất (súng)
        joined = ndi.binary_closing(sub, np.ones((5, 5)), iterations=2)
        lab, n = ndi.label(joined)
        if n == 0:
            continue
        sizes = ndi.sum(joined, lab, range(1, n + 1))
        keep_ids = [i + 1 for i, s in enumerate(sizes) if s >= max(150, 0.12 * sizes.max())]
        region = np.isin(lab, keep_ids)
        mask = sub & region
        # lấp lỗ do xoá chữ đè lên súng: đóng hình rồi chỉ lấy phần trùng vùng chữ
        closed = ndi.binary_closing(mask, np.ones((7, 7)), iterations=1)
        closed = ndi.binary_fill_holes(closed)
        tm = text_mask[y0:y1, x0:x1]
        holes = closed & ~mask & (tm | ~fg[y0:y1, x0:x1])
        mask = mask | holes
        mask = ndi.binary_fill_holes(mask)
        # bỏ chấm lẻ (vết chữ / xước còn sót) — giữ mảnh lớn
        lab2, n2 = ndi.label(mask, structure=np.ones((3, 3)))
        if n2 > 1:
            s2 = ndi.sum(mask, lab2, range(1, n2 + 1))
            mask = np.isin(lab2, [i + 1 for i, s in enumerate(s2) if s >= 25])
        # màu cho lỗ: inpaint từ điểm ảnh súng xung quanh
        rgb = a[y0:y1, x0:x1].astype(np.uint8).copy()
        if holes.any():
            rgb = cv2.inpaint(rgb, (holes & tm).astype(np.uint8) * 255, 3, cv2.INPAINT_TELEA)
        ys, xs = np.nonzero(mask)
        if len(xs) == 0:
            continue
        bx0, bx1, by0, by1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
        crop = rgb[by0:by1, bx0:bx1]
        alpha = (mask[by0:by1, bx0:bx1] * 255).astype(np.uint8)
        img = Image.fromarray(np.dstack([crop, alpha]), "RGBA")
        name = NAMES[r][c]
        img.save(f"{OUT}/{name}.png", optimize=True)
        meta[name] = {"row": r, "col": c, "w": int(bx1 - bx0), "h": int(by1 - by0), "src": [int(x0 + bx0), int(y0 + by0)]}
json.dump(meta, open(f"{OUT}/meta.json", "w"), indent=1)

# tờ kiểm tra: nền ô caro để nhìn rõ alpha
cw, ch = 220, 80
contact = Image.new("RGBA", (cw * 5, ch * 9), (60, 140, 60, 255))
for r in range(9):
    for c in range(5):
        name = NAMES[r][c]
        p = f"{OUT}/{name}.png"
        if not os.path.exists(p):
            continue
        im = Image.open(p)
        k = min((cw - 10) / im.width, (ch - 10) / im.height, 1.2)
        im2 = im.resize((max(1, int(im.width * k)), max(1, int(im.height * k))), Image.NEAREST)
        contact.alpha_composite(im2, (c * cw + (cw - im2.width) // 2, r * ch + (ch - im2.height) // 2))
contact.save(f"{OUT}/_contact.png")
print(len(meta), "sprites")

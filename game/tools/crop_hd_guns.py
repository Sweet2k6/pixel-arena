# Cắt từng súng / phụ kiện từ ảnh đã tách nền (s3_cut.png, s4_cut.png) -> PNG trong suốt riêng.
import json, os
import numpy as np
import cv2
from PIL import Image
from scipy import ndimage as ndi

OUT = "out"
os.makedirs(f"{OUT}/hd", exist_ok=True); os.makedirs(f"{OUT}/parts", exist_ok=True)
SRC = {"s3": np.asarray(Image.open("s3_cut.png")).copy(), "s4": np.asarray(Image.open("s4_cut.png")).copy()}

# tên: (ảnh, khung x0,y0,x1,y1, thư mục, lật ngang?)
ITEMS = {
    "m4a1":        ("s3", (48, 49, 973, 377), "hd", False),
    "m4a1_bayonet":("s3", (48, 372, 650, 547), "hd", False),
    "akm":         ("s4", (2, 30, 416, 158), "hd", False),
    "mp5a3":       ("s4", (715, 17, 1024, 145), "hd", True),
    "awm":         ("s4", (15, 330, 420, 427), "hd", False),
    "remington870":("s4", (0, 458, 394, 516), "hd", False),
    "glock19":     ("s4", (546, 336, 670, 424), "hd", True),
    "m249":        ("s4", (638, 386, 1013, 533), "hd", True),
    "eotech":      ("s3", (780, 283, 868, 363), "parts", False),
    "foregrip":    ("s3", (871, 304, 927, 360), "parts", False),
    "stanag":      ("s3", (701, 273, 766, 362), "parts", False),
    "round556":    ("s3", (930, 291, 987, 362), "parts", False),
    "suppressor":  ("s4", (746, 226, 851, 261), "parts", False),
    "scope4x":     ("s4", (450, 489, 593, 547), "parts", False),
    "bayonet":     ("s4", (450, 443, 593, 484), "parts", True),
    "reddot":      ("s4", (594, 481, 660, 547), "parts", False),
    "shell12":     ("s4", (369, 512, 432, 540), "parts", False),
}
STAR = ("s4", 937, 471, 19)   # chữ ký hình ngôi sao của trình tạo ảnh (đè lên báng M249)

def remove_star(img):
    a = img.astype(np.int16)
    _, cx, cy, r = STAR
    H, W = a.shape[:2]
    yy, xx = np.mgrid[0:H, 0:W]
    near = (xx - cx) ** 2 + (yy - cy) ** 2 <= r * r
    v = a[..., :3].mean(2); ch = a[..., :3].max(2) - a[..., :3].min(2)
    star = near & (v > 92) & (ch < 16)
    star = ndi.binary_dilation(star, iterations=1) & near
    img[..., 3][star] = 0
    return img, star

img4, star = remove_star(SRC["s4"])
SRC["s4"] = img4
meta = {}
for name, (src, (x0, y0, x1, y1), folder, flip) in ITEMS.items():
    im = SRC[src][y0:y1, x0:x1].copy()
    al = im[..., 3] > 0
    lab, n = ndi.label(ndi.binary_dilation(al, iterations=2))
    if n:
        sizes = ndi.sum(al, lab, range(1, n + 1))
        keep = [i + 1 for i, s in enumerate(sizes) if s >= (0.999 if folder == 'hd' else 0.25) * sizes.max()]
        al = al & np.isin(lab, keep)
    # lấp lỗ do xoá ngôi sao (chỉ lỗ kín bên trong súng), tô lại màu từ xung quanh
    if src == "s4":
        filled = ndi.binary_fill_holes(al)
        st = star[y0:y1, x0:x1] & filled & ~al
        if st.any():
            rgb = np.ascontiguousarray(im[..., :3])
            rgb = cv2.inpaint(rgb, st.astype(np.uint8) * 255, 3, cv2.INPAINT_TELEA)
            im[..., :3] = rgb
            al = al | st
    if name == "glock19":
        # chữ "Glock 19" nằm dưới đèn pin (góc dưới trái) + mẩu thừa của khẩu khác ở mép trái
        hh, ww = al.shape
        yy, xx = np.mgrid[0:hh, 0:ww]
        al &= ~(((yy + y0) >= 394) & ((xx + x0) < 632))
        al &= ~((xx + x0) < 560)
    if name == "m249":
        # bỏ mẩu báng Glock dính ở góc trên trái (khung 2 khẩu chồng nhau)
        al[: 422 - y0, : 672 - x0] = False
        # chỗ ngôi sao vừa xoá: điểm ảnh trùng màu ô caro (đen ~0 / xám ~74) -> trong suốt
        _, sx, sy, r = STAR
        hh, ww = al.shape
        yy, xx = np.mgrid[0:hh, 0:ww]
        near = (xx - (sx - x0)) ** 2 + (yy - (sy - y0)) ** 2 <= (r + 6) ** 2
        vv = im[..., :3].astype(np.int16).mean(2); cc = im[..., :3].max(2).astype(np.int16) - im[..., :3].min(2)
        al &= ~(near & (cc < 14) & ((vv < 12) | ((vv > 58) & (vv < 90))))
        # mảng ô caro kẹt giữa tay cầm và báng: điểm phẳng (độ lệch cục bộ nhỏ) trùng màu ô caro -> trong suốt
        loc_std = ndi.generic_filter(vv.astype(float), np.std, size=3)
        box = (xx >= 205) & (xx <= 295) & (yy >= 75) & (yy <= 108)
        al &= ~(box & (cc < 14) & (loc_std < 4.5) & ((vv < 12) | ((vv > 56) & (vv < 92))))
        al = ndi.binary_opening(al, np.ones((3, 3))) | (al & ~box)
        lab2, n2 = ndi.label(ndi.binary_dilation(al, iterations=2))
        if n2: sz = ndi.sum(al, lab2, range(1, n2 + 1)); al &= np.isin(lab2, [int(np.argmax(sz)) + 1])
    im[..., 3] = al * 255
    ys, xs = np.nonzero(al)
    im = im[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    if flip: im = im[:, ::-1]
    Image.fromarray(im, "RGBA").save(f"{OUT}/{folder}/{name}.png", optimize=True)
    meta[name] = {"w": int(im.shape[1]), "h": int(im.shape[0]), "folder": folder}
json.dump(meta, open(f"{OUT}/meta.json", "w"), indent=1)
print(json.dumps(meta))

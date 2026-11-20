# Tự tính điểm tay cầm (grip) + đầu nòng (muzzle) cho từng sprite, xuất grips.json + ảnh kiểm tra có đánh dấu.
import json
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi

meta = json.load(open("out/meta.json"))
MELEE = {"knife", "crowbar", "machete", "hatchet", "baton"}
# Sửa tay sau khi soi ảnh: tên -> (gx, gy) hoặc muzzle
OVERRIDE_GRIP = json.load(open("override.json")) if __import__("os").path.exists("override.json") else {}

res = {}
for name in meta:
    im = Image.open(f"out/{name}.png")
    m = np.asarray(im)[..., 3] > 127
    H, W = m.shape
    ys, xs = np.nonzero(m)
    # đầu nòng: cột phải nhất, y = trung vị ở 3 cột cuối
    right = xs.max()
    sel = xs >= right - 2
    my = int(np.median(ys[sel]))
    muzzle = [int(right), my]
    if name in MELEE:
        # cán bên trái: grip ở 18% chiều dài, y = trung vị cột đó
        gx = int(W * 0.16)
        col = np.nonzero(m[:, gx])[0]
        gy = int(np.median(col)) if len(col) else H // 2
        grip = [gx, gy]
    else:
        # thân súng = các hàng phủ > 45% chiều ngang (tính trên cột 15%..95%)
        widths = m.sum(1)
        body_rows = np.nonzero(widths > 0.45 * W)[0]
        yb = int(body_rows.max()) if len(body_rows) else H // 2
        below = m.copy()
        below[: yb + 1] = False
        lab, n = ndi.label(below)
        best = None
        for i in range(1, n + 1):
            yy, xx = np.nonzero(lab == i)
            if len(xx) < 12:
                continue
            x0, x1 = xx.min(), xx.max()
            h = yy.max() - yb
            if x0 < 0.10 * W:          # báng súng chạm mép trái -> bỏ
                continue
            if h < 0.18 * H:
                continue
            cx = (x0 + x1) / 2
            if best is None or cx < best[0]:
                best = (cx, x0, x1, h)
        if best:
            cx, x0, x1, h = best
            grip = [int(round(cx)), int(round(yb + max(2, 0.3 * h)))]
        else:
            grip = [int(W * 0.35), int(min(H - 1, yb + 2))]
    if name in OVERRIDE_GRIP:
        o = OVERRIDE_GRIP[name]
        if "grip" in o: grip = o["grip"]
        if "muzzle" in o: muzzle = o["muzzle"]
    res[name] = {"w": W, "h": H, "grip": grip, "muzzle": muzzle}

json.dump(res, open("out/grips.json", "w"), indent=1)

# ảnh kiểm tra: phóng 2x, chấm vàng = grip, chấm đỏ = muzzle
names = list(meta)
k = 2
cw, ch = 400, 110
sheet = Image.new("RGBA", (cw * 3, ch * ((len(names) + 2) // 3)), (40, 44, 52, 255))
d = ImageDraw.Draw(sheet)
for i, name in enumerate(names):
    im = Image.open(f"out/{name}.png")
    j = im.resize((im.width * k, im.height * k), Image.NEAREST)
    ox, oy = (i % 3) * cw + 10, (i // 3) * ch + 14
    sheet.alpha_composite(j, (ox, oy))
    g, mz = res[name]["grip"], res[name]["muzzle"]
    d.ellipse([ox + g[0] * k - 4, oy + g[1] * k - 4, ox + g[0] * k + 4, oy + g[1] * k + 4], fill=(255, 220, 0, 255))
    d.ellipse([ox + mz[0] * k - 4, oy + mz[1] * k - 4, ox + mz[0] * k + 4, oy + mz[1] * k + 4], fill=(255, 40, 40, 255))
    d.text((ox, oy - 12), name, fill=(255, 255, 255, 255))
sheet.save("grips.png")
print("ok", len(res))

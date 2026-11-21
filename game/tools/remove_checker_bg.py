# Tách súng khỏi nền ô caro GIẢ (vẽ thẳng vào ảnh AI).
#  1) Dựng ranh giới hàng/cột ô caro từ chính ảnh (lưới gần đều 8.53px nhưng có chỗ lệch).
#  2) Ô "nền thật" = ô đồng màu (đen ~0 hoặc xám ~74) VÀ xen kẽ màu với ô bên cạnh (mảng phẳng trong súng không xen kẽ).
#  3) Ô lẫn súng: đoán màu nền của ô từ ô nền kế bên, pixel nào khớp màu đó là nền.
#  4) Lấp lỗ, giữ mảng lớn, thêm viền đen.
import sys
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

CELL = 1024 / 120

def boundaries(profile_list, n_max, period=CELL):
    pts = sorted(set(p for prof in profile_list for p in prof))
    merged = []
    for p in pts:
        if merged and p - merged[-1] <= 2: merged[-1] = (merged[-1] + p) / 2
        else: merged.append(p)
    out = [0.0]
    for p in merged:
        while p - out[-1] > period * 1.5: out.append(out[-1] + period)
        if p - out[-1] > period * 0.5: out.append(float(p))
    while n_max - out[-1] > period * 0.5: out.append(out[-1] + period)
    out.append(float(n_max))
    return np.array(out)

def transitions(line):
    v = (line > 36).astype(int)
    return [i for i in range(1, len(v)) if v[i] != v[i - 1]]

def segment(path, tol=13):
    a = np.asarray(Image.open(path).convert("RGB")).astype(np.int16)
    H, W, _ = a.shape
    v = a.mean(2); chroma = a.max(2) - a.min(2)
    xb = boundaries([transitions(v[y]) for y in (2, 4, H - 3, H - 5)], W)
    yb = boundaries([transitions(v[:, x]) for x in (2, 4, W - 3, W - 5)], H)
    nx, ny = len(xb) - 1, len(yb) - 1
    mean = np.zeros((ny, nx)); std = np.full((ny, nx), 99.0); chm = np.zeros((ny, nx))
    for j in range(ny):
        y0, y1 = int(round(yb[j])) + 2, int(round(yb[j + 1])) - 1
        for i in range(nx):
            x0, x1 = int(round(xb[i])) + 2, int(round(xb[i + 1])) - 1
            if y1 - y0 < 2 or x1 - x0 < 2: continue
            blk = v[y0:y1, x0:x1]
            mean[j, i] = blk.mean(); std[j, i] = blk.std(); chm[j, i] = chroma[y0:y1, x0:x1].mean()
    uni = (std < 5.5) & (chm < 12)
    typ = np.full((ny, nx), -1)
    typ[uni & (mean < 24)] = 0
    typ[uni & (mean > 50) & (mean < 100)] = 1
    conf = np.full((ny, nx), -1)
    for j in range(ny):
        for i in range(nx):
            t = typ[j, i]
            if t < 0: continue
            opp = same = 0
            for dj, di in ((0, 1), (0, -1), (1, 0), (-1, 0)):
                jj, ii = j + dj, i + di
                if 0 <= jj < ny and 0 <= ii < nx and typ[jj, ii] >= 0:
                    if typ[jj, ii] == t: same += 1
                    else: opp += 1
            if opp >= 2 and same <= 1: conf[j, i] = t
            elif opp >= 1 and same == 0 and (j in (0, ny - 1) or i in (0, nx - 1)): conf[j, i] = t
    exp_t = conf.copy().astype(float); exp_l = mean.copy()
    for j in range(ny):
        for i in range(nx):
            if conf[j, i] >= 0: continue
            v0, v1 = [], []
            for dj, di, flip in ((0, 1, 1), (0, -1, 1), (1, 0, 1), (-1, 0, 1), (1, 1, 0), (1, -1, 0), (-1, 1, 0), (-1, -1, 0)):
                jj, ii = j + dj, i + di
                if 0 <= jj < ny and 0 <= ii < nx and conf[jj, ii] >= 0:
                    t = conf[jj, ii] ^ flip
                    (v0 if t == 0 else v1).append(mean[jj, ii] if conf[jj, ii] == t else None)
            if not v0 and not v1: exp_t[j, i] = -2; continue
            t = 0 if len(v0) >= len(v1) else 1
            ls = [x for x in (v0 if t == 0 else v1) if x is not None]
            exp_t[j, i] = t; exp_l[j, i] = np.median(ls) if ls else (4.0 if t == 0 else 74.0)
    ci = np.clip(np.searchsorted(xb, np.arange(W), side="right") - 1, 0, nx - 1)
    cj = np.clip(np.searchsorted(yb, np.arange(H), side="right") - 1, 0, ny - 1)
    CI, CJ = np.meshgrid(ci, cj)
    et = exp_t[CJ, CI]; el = exp_l[CJ, CI]
    dx = np.minimum(np.arange(W) - xb[ci], xb[ci + 1] - np.arange(W))
    dy = np.minimum(np.arange(H) - yb[cj], yb[cj + 1] - np.arange(H))
    edge = (dx[None, :] < 1.4) | (dy[:, None] < 1.4)
    neutral = chroma < 14
    band = ((np.arange(H) >= 38) & (np.arange(H) <= 52))[:, None]   # dải mờ chạy ngang ảnh (ảnh AI) làm ô xám tối đi
    lowb = np.where((et == 1) & band, el * 0.55 - tol, el - tol)
    bg = neutral & (et >= 0) & (((v > lowb) & (v < el + tol)) | (edge & (v < 100)))
    bg |= conf[CJ, CI] >= 0
    # dải xám đặc (~28) cao 8px chạy ngang ảnh ở y=41..50 (lỗi của ảnh AI)
    yy = np.arange(H)[:, None]
    bg |= neutral & (yy >= 41) & (yy <= 50) & (v >= 10) & (v <= 42)
    fg = ndi.binary_opening(~bg, np.ones((2, 2)))
    return a, v, fg, bg, conf[CJ, CI] >= 0

def cleanup(a, v, fg, bg, bgconf, min_area=120):
    m0 = ndi.binary_closing(fg, np.ones((3, 3)), iterations=2)
    m = ndi.binary_fill_holes(m0)
    # lỗ hở THẬT của súng (khe cò, khung đầu ngắm): vùng kín có chứa ô nền chắc chắn -> trả lại trong suốt
    holes = m & ~m0
    hl, hn = ndi.label(holes)
    for k in range(1, hn + 1):
        r = hl == k
        if (r & bgconf).sum() >= 10: m &= ~r
    lab, n = ndi.label(m)
    sizes = ndi.sum(m, lab, range(1, n + 1))
    m = np.isin(lab, [i + 1 for i, s in enumerate(sizes) if s >= min_area])
    ring = ndi.binary_dilation(m, iterations=2) & ~m
    m = m | (ring & (v < 30))
    return m

if __name__ == "__main__":
    a, v, fg, bg, bgconf = segment(sys.argv[1])
    m = cleanup(a, v, fg, bg, bgconf)
    out = np.dstack([a.astype(np.uint8), (m * 255).astype(np.uint8)])
    Image.fromarray(out, "RGBA").save(sys.argv[2])
    prev = Image.new("RGBA", (a.shape[1], a.shape[0]), (200, 60, 160, 255))
    prev.alpha_composite(Image.fromarray(out, "RGBA"))
    prev.convert("RGB").save(sys.argv[3])

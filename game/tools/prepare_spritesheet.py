#!/usr/bin/env python3
# =====================================================================================
#  LÀM SẠCH SPRITESHEET VẼ BẰNG AI (nền ô caro "giả" dính vào ảnh) -> spritesheet PNG trong suốt cho game
#
#    python game/tools/prepare_spritesheet.py <ảnh gốc> <ảnh ra> [chiều cao nhân vật px] [số frame mỗi hàng ...]
#    ví dụ:  python game/tools/prepare_spritesheet.py nguon.png assets/images/actors/thanhxuan.png 40 4 8 4 --shy=0:3 --colors=14 --outline
#
#  Cần Python 3 + Pillow (pip install pillow). Các bước:
#    1. Xóa nền ô caro: loang từ mép ảnh qua các pixel giống màu ô caro (dừng ở viền đen của nhân vật)
#    2. Tìm từng nhân vật (vùng liền nhau), xếp theo hàng; bỏ vết nhỏ (logo, ngôi sao watermark)
#    3. Thu nhỏ về chiều cao mong muốn, căn CHÂN về cùng 1 điểm trong ô
#    4. Ghép lại: mỗi hàng 1 hoạt ảnh, mỗi cột 1 frame. In ra cấu hình để dán vào fx-config.js
# =====================================================================================
import sys, json
from collections import deque
from PIL import Image

args = [a for a in sys.argv[1:] if not a.startswith("--")]
opts = dict((a[2:].split("=", 1) + [""])[:2] for a in sys.argv[1:] if a.startswith("--"))
src, dst = args[0], args[1]
target_h = int(args[2]) if len(args) > 2 else 40
row_counts = [int(v) for v in args[3:]] or None
# --shy=HÀNG:CỘT  -> thêm 1 hàng hoạt ảnh "ngại ngùng" (mặt đỏ ửng, run run) dựng từ frame đó (đếm từ 0)
shy_from = tuple(int(v) for v in opts["shy"].split(":")) if "shy" in opts else None

im = Image.open(src).convert("RGBA")
W, H = im.size
px = im.load()

# ---------- 1. nền ô caro: 2 màu xuất hiện nhiều nhất ở mép ảnh ----------
from collections import Counter
edge = Counter()
for x in range(W):
    for y in (0, 1, H - 2, H - 1): edge[px[x, y][:3]] += 1
for y in range(H):
    for x in (0, 1, W - 2, W - 1): edge[px[x, y][:3]] += 1
tones = []
for c, _ in edge.most_common(40):
    if all(sum((a - b) ** 2 for a, b in zip(c, t)) > 200 for t in tones): tones.append(c)
    if len(tones) == 2: break
# Ô caro đều: tìm dải sáng/tối theo cột (từ hàng mép trên) và theo hàng (từ cột mép trái).
# Màu nền "đúng" tại (x, y) = sáng nếu 2 dải cùng loại, tối nếu khác loại. So với màu ĐÚNG ô đó
# (không phải màu bất kỳ của 2 ô) để tóc đen / áo xám gần giống màu ô caro không bị xóa nhầm.
light, dark = sorted(tones, key=sum)[::-1]
lum = lambda c: sum(c[:3])
mid = (lum(light) + lum(dark)) / 2
xband = [lum(px[x, 1]) > mid for x in range(W)]
yband = [lum(px[1, y]) > mid for y in range(H)]
TOL = 13   # chênh lệch tối đa mỗi kênh màu (nhiễu nén JPEG)
def is_bg(c, x, y):
    exp = light if xband[x] == yband[y] else dark
    if max(abs(a - b) for a, b in zip(c[:3], exp)) <= TOL: return True
    # sát ranh giới 2 ô: chấp nhận cả màu ô bên cạnh
    near_edge = any(0 <= x + d < W and xband[x + d] != xband[x] for d in (-1, 1)) or \
                any(0 <= y + d < H and yband[y + d] != yband[y] for d in (-1, 1))
    other = dark if exp is light else light
    return near_edge and max(abs(a - b) for a, b in zip(c[:3], other)) <= TOL

bg = bytearray(W * H)
q = deque()
for x in range(W):
    for y in (0, H - 1): q.append((x, y))
for y in range(H):
    for x in (0, W - 1): q.append((x, y))
while q:
    x, y = q.popleft()
    i = y * W + x
    if bg[i] or not is_bg(px[x, y], x, y): continue
    bg[i] = 1
    if x > 0: q.append((x - 1, y))
    if x < W - 1: q.append((x + 1, y))
    if y > 0: q.append((x, y - 1))
    if y < H - 1: q.append((x, y + 1))
for y in range(H):
    for x in range(W):
        if bg[y * W + x]: px[x, y] = (0, 0, 0, 0)

# Đường kẻ mờ còn sót ở ranh giới 2 ô caro (pixel pha trộn 2 màu): pixel nằm sát ranh giới mà 2 bên
# (cách 2px, vuông góc với đường kẻ) đều đã là nền -> cũng là nền. Lặp vài lần cho các giao điểm.
xedge = [any(0 <= x + d < W and xband[x + d] != xband[x] for d in (-1, 1)) for x in range(W)]
yedge = [any(0 <= y + d < H and yband[y + d] != yband[y] for d in (-1, 1)) for y in range(H)]
clear = lambda x, y: not (0 <= x < W and 0 <= y < H) or px[x, y][3] == 0
for _ in range(6):
    kill = []
    for y in range(H):
        for x in range(W):
            if px[x, y][3] == 0: continue
            if (xedge[x] and ((clear(x - 2, y) and clear(x + 2, y)) or (clear(x - 3, y) and clear(x + 3, y)))) or \
               (yedge[y] and ((clear(x, y - 2) and clear(x, y + 2)) or (clear(x, y - 3) and clear(x, y + 3)))):
                kill.append((x, y))
    for x, y in kill: px[x, y] = (0, 0, 0, 0)

# Mảng ô caro lệch pha (ô nhỏ hơn / lệch vị trí) dính vào nhân vật: loang tiếp từ vùng đã xóa qua những pixel
# trùng sát màu 1 trong 2 ô caro, với điều kiện xung quanh có CẢ ô sáng lẫn ô tối (dấu hiệu bàn cờ, tóc không có).
def tone_of(c, tol=9):
    for i, t in enumerate(tones):
        if max(abs(a - b) for a, b in zip(c[:3], t)) <= tol: return i
    return -1
def checkerish(x, y):
    if tone_of(px[x, y]) < 0: return False
    cnt = [0, 0]
    for yy in range(max(0, y - 3), min(H, y + 4)):
        for xx in range(max(0, x - 3), min(W, x + 4)):
            k2 = tone_of(px[xx, yy])
            if k2 >= 0: cnt[k2] += 1
    return cnt[0] >= 4 and cnt[1] >= 4
q = deque((x, y) for y in range(H) for x in range(W) if px[x, y][3] == 0 and any(
    0 <= x + dx < W and 0 <= y + dy < H and px[x + dx, y + dy][3] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))))
cleared = []
while q:
    x, y = q.popleft()
    for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
        if 0 <= nx < W and 0 <= ny < H and px[nx, ny][3] and checkerish(nx, ny):
            cleared.append((nx, ny)); q.append((nx, ny))
            px[nx, ny] = px[nx, ny][:3] + (0,)
for x, y in cleared: px[x, y] = (0, 0, 0, 0)

# --erase=x0:y0:x1:y1[;...]  xóa tay 1 vùng chữ nhật trong ảnh gốc (mảnh nền sót mà máy không tự nhận ra)
for box in filter(None, opts.get("erase", "").split(";")):
    x0, y0, x1, y1 = (int(v) for v in box.split(":"))
    for y in range(max(0, y0), min(H, y1 + 1)):
        for x in range(max(0, x0), min(W, x1 + 1)): px[x, y] = (0, 0, 0, 0)

# ---------- 2. tách từng nhân vật ----------
seen = bytearray(W * H)
comps = []
for y0 in range(H):
    for x0 in range(W):
        i = y0 * W + x0
        if seen[i] or px[x0, y0][3] == 0: continue
        q = deque([(x0, y0)]); seen[i] = 1
        xs0, ys0, xs1, ys1, n = x0, y0, x0, y0, 0
        while q:
            x, y = q.popleft(); n += 1
            xs0, xs1, ys0, ys1 = min(xs0, x), max(xs1, x), min(ys0, y), max(ys1, y)
            for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                if 0 <= nx < W and 0 <= ny < H:
                    j = ny * W + nx
                    if not seen[j] and px[nx, ny][3]: seen[j] = 1; q.append((nx, ny))
        comps.append((n, xs0, ys0, xs1, ys1))
# mảng ô caro sót lại (vùng lệch pha): gần như toàn bộ pixel trùng màu ô caro -> bỏ
def checker_ratio(c):
    _, x0, y0, x1, y1 = c
    tot = hit = 0
    for y in range(y0, y1 + 1, 2):
        for x in range(x0, x1 + 1, 2):
            col = px[x, y]
            if not col[3]: continue
            tot += 1
            if any(max(abs(a - b) for a, b in zip(col[:3], t)) <= TOL for t in tones): hit += 1
    return hit / max(1, tot)
comps = [c for c in comps if c[0] < 40 or checker_ratio(c) < 0.6]
big = max(c[0] for c in comps)
sprites = [c for c in comps if c[0] > big * 0.25]
# vết nhỏ nằm trong khung 1 nhân vật (tóc rời, chân rời) thì gộp vào nhân vật đó
for c in comps:
    if c in sprites or c[0] < 6: continue
    for k, s in enumerate(sprites):
        if c[1] >= s[1] - 4 and c[3] <= s[3] + 4 and c[2] >= s[2] - 4 and c[4] <= s[4] + 4:
            sprites[k] = (s[0] + c[0], min(s[1], c[1]), min(s[2], c[2]), max(s[3], c[3]), max(s[4], c[4]))
sprites.sort(key=lambda s: (s[2] + s[4]) / 2)
rows, cur = [], []
for s in sprites:
    if cur and (s[2] + s[4]) / 2 - (cur[-1][2] + cur[-1][4]) / 2 > (s[4] - s[2]) * 0.5:
        rows.append(cur); cur = []
    cur.append(s)
rows.append(cur)
rows = [sorted(r, key=lambda s: s[1]) for r in rows]
if row_counts: rows = [r[:n] for r, n in zip(rows, row_counts)]

# ---------- 3. thu nhỏ: cùng 1 tỉ lệ cho mọi frame, căn chân + căn theo đầu ----------
full_h = max(s[4] - s[2] + 1 for r in rows for s in r)
k = target_h / full_h
# --head=0.85  thu nhỏ ĐẦU (phần trên ~46% chiều cao nhân vật) còn 85%, giữ nguyên thân; đầu được đặt lại
#              đúng chỗ cổ (căn giữa theo tâm đầu cũ). Hợp với ảnh AI vẽ đầu quá to.
head_k = float(opts.get("head", 1) or 1)
def shrink_head(crop):
    cut = round(full_h * 0.46)
    if cut >= crop.height: return crop
    head = crop.crop((0, 0, crop.width, cut))
    hp = head.load()
    cols = [x for y in range(cut // 2) for x in range(crop.width) if hp[x, y][3]]
    cx = sum(cols) / len(cols) if cols else crop.width / 2
    nw, nh = max(1, round(crop.width * head_k)), max(1, round(cut * head_k))
    small = head.resize((nw, nh), Image.LANCZOS)
    out = Image.new("RGBA", (crop.width, crop.height), (0, 0, 0, 0))
    out.alpha_composite(crop.crop((0, cut, crop.width, crop.height)), (0, cut))
    # chồng phần dưới cùng của đầu mới lên cổ 1 chút để không hở
    out.alpha_composite(small, (round(cx - cx * head_k), cut - nh + max(1, round(cut * 0.02))))
    # bỏ phần trống phía trên
    bb = out.getbbox()
    return out.crop((0, bb[1], crop.width, crop.height)) if bb else out

def shrink(s):
    _, x0, y0, x1, y1 = s
    crop = im.crop((x0, y0, x1 + 1, y1 + 1))
    if head_k != 1: crop = shrink_head(crop)
    w, h = max(1, round(crop.width * k)), max(1, round(crop.height * k))
    small = crop.resize((w, h), Image.LANCZOS)
    p = small.load()
    for yy in range(h):          # alpha cứng (pixel art không có viền mờ)
        for xx in range(w):
            r, g, b, a = p[xx, yy]
            p[xx, yy] = (r, g, b, 255) if a >= 110 else (0, 0, 0, 0)
    # vệt ô caro mảnh còn dính vào viền: pixel màu xám-tím (giống nền) mà gần như không có hàng xóm -> bỏ
    def greyish(c): return 25 <= c[0] <= 80 and abs(c[0] - c[1]) <= 4 and 3 <= c[2] - c[0] <= 13
    for _ in range(4):
        kill = []
        for yy in range(h):
            for xx in range(w):
                if not p[xx, yy][3] or not greyish(p[xx, yy]): continue
                n4 = sum(1 for nx, ny in ((xx - 1, yy), (xx + 1, yy), (xx, yy - 1), (xx, yy + 1))
                         if 0 <= nx < w and 0 <= ny < h and p[nx, ny][3])
                if n4 <= 2 and (not (0 < yy < h - 1) or not p[xx, yy - 1][3] or not p[xx, yy + 1][3]): kill.append((xx, yy))
        for xx, yy in kill: p[xx, yy] = (0, 0, 0, 0)
    # bỏ chấm lẻ còn sót (giữ khối lớn nhất + khối nào đủ to)
    seen2, blobs = set(), []
    for yy in range(h):
        for xx in range(w):
            if p[xx, yy][3] and (xx, yy) not in seen2:
                q2, blob = deque([(xx, yy)]), []
                seen2.add((xx, yy))
                while q2:
                    cx, cy = q2.popleft(); blob.append((cx, cy))
                    for nx in (cx - 1, cx, cx + 1):
                        for ny in (cy - 1, cy, cy + 1):
                            if 0 <= nx < w and 0 <= ny < h and (nx, ny) not in seen2 and p[nx, ny][3]:
                                seen2.add((nx, ny)); q2.append((nx, ny))
                blobs.append(blob)
    top = max(len(b) for b in blobs)
    for b in blobs:
        if len(b) < top * 0.12:
            for cx, cy in b: p[cx, cy] = (0, 0, 0, 0)
    # tâm ngang của ĐẦU (1/3 trên) để các frame chạy không bị lắc qua lại
    cols = [xx for yy in range(h // 3) for xx in range(w) if p[xx, yy][3]]
    head_cx = sum(cols) / len(cols) if cols else w / 2
    return small, head_cx
frames = [[shrink(s) for s in r] for r in rows]

def blush(img, amount):
    """Má ửng hồng: 2 vệt hồng ở má + cả mặt ấm lên một chút"""
    out = img.copy(); p = out.load()
    skin = [(x, y) for y in range(out.height * 11 // 20) for x in range(out.width)
            if p[x, y][3] and p[x, y][0] > 170 and p[x, y][0] > p[x, y][2] + 25 and p[x, y][1] > 110]
    if not skin: return out
    xs = sorted(x for x, _ in skin); ys = sorted(y for _, y in skin)
    fx0, fx1 = xs[len(xs) // 10], xs[-1 - len(xs) // 10]
    fy0, fy1 = ys[len(ys) // 10], ys[-1 - len(ys) // 10]
    cheek_y = round(fy0 + (fy1 - fy0) * 0.62)
    span = fx1 - fx0
    cheeks = [(round(fx0 + span * 0.18), cheek_y), (round(fx0 + span * 0.78), cheek_y)]
    pink = (255, 105, 140)
    for x, y in skin:
        r, g, b, a = p[x, y]
        k = 0.12 * amount                                   # cả mặt ấm lên
        for cx, cy in cheeks:                               # vệt má hồng 3x2
            if abs(x - cx) <= 1 and 0 <= y - cy <= 1: k = 0.75 * amount
        p[x, y] = tuple(round(c + (t - c) * k) for c, t in zip((r, g, b), pink)) + (a,)
    return out
if shy_from:
    base, hc = frames[shy_from[0]][shy_from[1]]
    frames.append([(blush(base, a), hc + dx) for a, dx in ((0.7, 0), (0.85, 1), (1.0, 0), (0.85, -1))])
fw = max(f.width for r in frames for f, _ in r) + 8
fh = max(f.height for r in frames for f, _ in r) + 4
ax, ay = fw // 2, fh - 2
sheet = Image.new("RGBA", (fw * max(len(r) for r in frames), fh * len(frames)), (0, 0, 0, 0))
for ri, r in enumerate(frames):
    for ci, (f, hc) in enumerate(r):
        sheet.alpha_composite(f, (ci * fw + round(ax - hc), ri * fh + ay - f.height + 1))
# ---------- 5. "bớt AI": ít màu + viền sạch (giống pixel art vẽ tay) ----------
#   --colors=N  gom về N màu chung cho mọi frame (k-means), bỏ hàng trăm sắc độ lem nhem do thu nhỏ
#   --outline   viền ngoài 1px màu mực đậm, khử chấm lẻ
ncol = int(opts.get("colors", 0))
if ncol:
    import random
    sp = sheet.load()
    pts = [sp[x, y][:3] for y in range(sheet.height) for x in range(sheet.width) if sp[x, y][3]]
    random.seed(1)
    dd = lambda a, b: (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2
    pal = [pts[0]]
    sample = random.sample(pts, min(3000, len(pts)))
    while len(pal) < ncol: pal.append(max(sample, key=lambda q: min(dd(q, c) for c in pal)))
    for _ in range(12):
        acc = [[0, 0, 0, 0] for _ in pal]
        for q in pts:
            ki = min(range(len(pal)), key=lambda i: dd(q, pal[i])); a = acc[ki]
            a[0] += q[0]; a[1] += q[1]; a[2] += q[2]; a[3] += 1
        pal = [tuple(round(a[i] / a[3]) for i in range(3)) if a[3] else pal[j] for j, a in enumerate(acc)]
    if shy_from: pal.append((250, 128, 148))   # giữ màu má hồng của hàng "ngại ngùng"
    cache = {}
    for y in range(sheet.height):
        for x in range(sheet.width):
            c = sp[x, y]
            if not c[3]: continue
            if c[:3] not in cache: cache[c[:3]] = min(pal, key=lambda t: dd(c[:3], t))
            sp[x, y] = cache[c[:3]] + (255,)
    # chấm lẻ: pixel khác màu cả 4 hàng xóm mà 3/4 hàng xóm cùng 1 màu -> theo màu đó
    for _ in range(2):
        fix = []
        for y in range(1, sheet.height - 1):
            for x in range(1, sheet.width - 1):
                c = sp[x, y]
                if not c[3]: continue
                nb = [sp[x + 1, y], sp[x - 1, y], sp[x, y + 1], sp[x, y - 1]]
                if any(n[3] == 0 for n in nb) or c in nb: continue
                best = max(set(nb), key=nb.count)
                if nb.count(best) >= 3: fix.append((x, y, best))
        for x, y, c in fix: sp[x, y] = c
if "outline" in opts or "--outline" in sys.argv:
    sp = sheet.load(); ink = (24, 18, 30, 255)
    edge = []
    for y in range(sheet.height):
        for x in range(sheet.width):
            if not sp[x, y][3]: continue
            if any(not (0 <= x + dx < sheet.width and 0 <= y + dy < sheet.height) or sp[x + dx, y + dy][3] == 0
                   for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))): edge.append((x, y))
    for x, y in edge:
        if sum(sp[x, y][:3]) > 120: sp[x, y] = ink
sheet.save(dst)
print(json.dumps({"frameW": fw, "frameH": fh, "cols": max(len(r) for r in frames), "rows": len(frames),
                  "anchorX": ax, "anchorY": ay, "framesPerRow": [len(r) for r in frames], "scale": round(k, 4)}))

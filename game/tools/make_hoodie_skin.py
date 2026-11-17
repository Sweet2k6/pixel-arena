#!/usr/bin/env python3
# =====================================================================================
#  TẠO SKIN "HOODIE" CHO THANH XUÂN từ spritesheet gốc (cần Python 3 + Pillow)
#     python game/tools/make_hoodie_skin.py game/assets/images/actors/thanhxuan.png game/assets/images/actors/thanhxuan-hoodie.png
#
#  Áo thun đen -> áo thun TRẮNG lộ ra giữa ngực, khoác HOODIE ĐEN mở khóa (tay áo dài, mũ trùm hạ sau gáy)
#  Quần xám -> quần ĐEN. Hoạt động trên từng ô (39x41) của sheet, dựa vào màu da / màu quần để tìm cổ và eo.
# =====================================================================================
import sys
from collections import deque
from PIL import Image

src, dst = sys.argv[1], sys.argv[2]
FW, FH = (int(sys.argv[3]), int(sys.argv[4])) if len(sys.argv) > 4 else (39, 41)
im = Image.open(src).convert("RGBA")
px = im.load()

lum = lambda c: c[0] + c[1] + c[2]
def is_skin(c): return c[3] and c[0] > 120 and c[0] > c[2] + 35 and c[1] > 85 and not is_pink(c)
def is_pink(c): return c[3] and c[0] > 230 and c[1] < 150
def is_pants(c): return c[3] and abs(c[0] - c[1]) <= 6 and c[2] - c[0] >= 8 and 95 <= c[0] <= 200
def is_dark(c): return c[3] and lum(c) < 200 and not is_skin(c)

# bảng màu mới
PANTS = {(189, 193, 204): (66, 64, 78), (161, 165, 178): (50, 48, 60), (132, 135, 150): (38, 36, 46), (103, 106, 117): (28, 26, 34)}
SLEEVE = [(52, 50, 62), (40, 38, 48), (30, 28, 36)]          # hoodie đen (sáng -> tối)
SHIRT, SHIRT_SH = (240, 240, 246), (196, 198, 212)           # áo thun trắng + bóng
LAPEL = (78, 76, 92)                                          # mép áo khoác (vạt mở)

for fy in range(0, im.height, FH):
    for fx in range(0, im.width, FW):
        cells = [(x, y) for y in range(fy, fy + FH) for x in range(fx, fx + FW) if px[x, y][3]]
        if not cells: continue
        pants = [(x, y) for x, y in cells if is_pants(px[x, y])]
        skin = [(x, y) for x, y in cells if is_skin(px[x, y])]
        if not pants or not skin: continue
        # khuôn mặt = khối da phía trên cùng; cổ = đáy khuôn mặt
        top = min(y for _, y in skin)
        face = [(x, y) for x, y in skin if y <= top + 9]
        neck = max(y for _, y in face) + 1
        face_cx = sum(x for x, _ in face) / len(face)
        pants = [(x, y) for x, y in pants if y > neck + 3]   # bỏ con ngươi mắt (cùng màu xám-xanh với quần)
        if not pants: continue
        waist = min(y for _, y in pants)

        # 1) quần xám -> quần đen
        for x, y in pants:
            c = px[x, y][:3]
            if c in PANTS: px[x, y] = PANTS[c] + (255,)

        # 2) tay: khối da dưới cổ = cánh tay -> tay áo hoodie, chừa bàn tay (phần xa vai nhất)
        arm = set((x, y) for x, y in skin if y > neck)
        seen = set()
        for p0 in arm:
            if p0 in seen: continue
            blob, q = [], deque([p0]); seen.add(p0)
            while q:
                x, y = q.popleft(); blob.append((x, y))
                for n in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if n in arm and n not in seen: seen.add(n); q.append(n)
            sh = min(blob, key=lambda p: (p[1] - neck) ** 2 + (p[0] - face_cx) ** 2 * 0.3)   # điểm gần vai nhất
            dist = lambda p: ((p[0] - sh[0]) ** 2 + (p[1] - sh[1]) ** 2) ** 0.5
            far = max(dist(p) for p in blob)
            for p in blob:
                if far >= 3 and dist(p) < far - 2.2:          # bàn tay ~2px cuối giữ màu da
                    shade = 0 if px[p][0] > 230 else 1 if px[p][0] > 190 else 2
                    px[p] = SLEEVE[shade] + (255,)

        # 3) thân áo (giữa cổ và eo): dải áo thun trắng ở giữa ngực, 2 bên là vạt hoodie mở
        rows = range(neck, waist)
        for y in rows:
            xs = [x for x in range(fx, fx + FW) if is_dark(px[x, y]) and abs(x - face_cx) <= 6]
            if len(xs) < 4: continue
            cx = round(face_cx)                          # mặt quay sang phải -> khe áo lệch về trước
            for x in range(cx - 1, cx + 2):
                if is_dark(px[x, y]) and px[x, y][:3] != (24, 18, 30):   # chừa viền ngoài
                    px[x, y] = (SHIRT if x < cx + 1 else SHIRT_SH) + (255,)
            for x in (cx - 2, cx + 2):                        # mép vạt áo hơi sáng cho thấy áo khoác mở
                if is_dark(px[x, y]) and px[x, y][:3] not in (SHIRT, SHIRT_SH): px[x, y] = LAPEL + (255,)
        # 4) mũ trùm hạ sau gáy: 1 viền sáng nhẹ ngay dưới tóc phía sau cổ
        for x in range(round(face_cx) - 6, round(face_cx) - 2):
            y = neck
            if fx <= x < fx + FW and is_dark(px[x, y]) and px[x, y][:3] != (24, 18, 30): px[x, y] = LAPEL + (255,)

im.save(dst)
print("ok", dst)

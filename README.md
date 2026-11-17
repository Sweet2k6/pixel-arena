# ⚔️ Pixel Arena

Game đấu trường sinh tồn pixel art 2D (HTML5 Canvas + JavaScript thuần), giao diện 100% tiếng Việt.

**▶ Chơi ngay:** https://sweet2k6.github.io/pixel-arena/

## Tính năng
- **4 nhân vật chibi kiểu Soul Knight:** Xạ Thủ, Võ Sư, Pháp Sư Năng Lượng, **Thanh Xuân** (tay không bắn gai băng đóng băng quái 3 giây; tuyệt chiêu **Ngại Ngùng**: ôm mặt đỏ ửng, băng + sét xóa sổ mọi quái trên màn hình, hồi 10 giây) — giáp tự hồi khi không trúng đòn.
- **Bản đồ rộng 2400×1600** có camera bám mượt, minimap, mũi tên chỉ hướng rương / Mini-Boss.
- **4 bản đồ:** Hầm Ngục Đá Cổ · Rừng Độc Nấm Lùn (vũng axit) · Lò Rèn Dung Nham (hố nham thạch, bẫy lửa) · Tàn Tích Băng Giá (sàn trơn, tinh thể băng).
- **Thùng thuốc nổ**, cột đá chặn đạn, đạn nảy tường.
- **Rương Gỗ / Bạc / Vàng** mỗi 25 giây, mang **2 vũ khí** (Q / lăn chuột để đổi).
- **9 vũ khí nhặt từ rương:** Shotgun Săn Quái, Súng Laser Xuyên Thấu, Súng Phóng Lựu, Kiếm Năng Lượng (chém rụng đạn), Súng Máy Gatling (quay nhanh dần), Súng Phun Lửa (đốt cháy), Cung Băng (làm chậm), Boomerang Hồi Quy (bay về tay), Súng Sét Xích (nhảy qua 4 quái).
- **Chơi được trên điện thoại (màn hình ngang):** cần trái di chuyển, cần phải ngắm & bắn (có hỗ trợ ngắm), nút Kỹ năng / Lướt / Đổi súng / Tạm dừng, tự toàn màn hình. Mẹo: “Thêm vào màn hình chính” để chơi như app.
- **Quái chiến thuật:** Slime phân thân, Cung Thủ Xương, Hiệp Sĩ Khiên, Dơi Cảm Tử, quái Tinh Anh; **Mini-Boss** mỗi 60 giây.
- **Lên cấp & chọn thẻ nâng cấp** kiểu roguelike, **Lướt (Shift)** có bất tử ngắn.

## Điều khiển
| Phím | Tác dụng |
|---|---|
| WASD / mũi tên | Di chuyển |
| Chuột trái | Tấn công |
| Space / chuột phải | Kỹ năng nhân vật |
| Shift | Lướt nhanh |
| Q / lăn chuột / 1–2 | Đổi vũ khí |
| P / Esc | Tạm dừng · M: tắt tiếng |

**Điện thoại:** xoay ngang · ngón trái kéo để chạy · ngón phải kéo để ngắm và bắn · nút tròn bên phải để dùng Kỹ năng, Lướt, Đổi súng.

## Hoạt ảnh, hiệu ứng & hiệu năng
- **Nhân vật có hoạt ảnh thật:** Đứng yên · Chạy (bước nhanh dần theo tốc độ, tung bụi chân) · Lướt/Kỹ năng — điều khiển bởi `AnimationController` theo deltaTime (`game/src/animation.js`). Tự lật trái/phải theo chuột.
- **Vũ khí gắn vào tay** theo từng frame, xoay 360° theo chuột, tự lật trục dọc khi quay trái, giật lùi khi bắn, vung theo cung khi chém (chỉnh trong `WEAPON_CFG`, `game/main.js`).
- **Hiệu ứng spritesheet:** các hiệu ứng pixelfx đã được "nướng" sẵn thành PNG trong `game/assets/images/fx/` và `game/assets/images/actors/`, phát theo từng frame bởi `EffectManager` (`game/src/effects.js`, tối đa `MAX_EFFECTS = 150`).
- **Chống lag khi quái đông:** Object Pool cho đạn / quái / ngọc EXP / hiệu ứng, lưới không gian + khoảng cách bình phương cho va chạm, tản đội hình mềm (quái dàn vòng vây thay vì dồn cục — chỉnh `CROWD` trong `game/src/enemies.js`).
- **Bộ đếm FPS** ở góc trên phải. Phím **H** bật thông số debug, khi đó phím **J** thả thêm 50 quái. Thử tải: mở `/game/#stress-300`.

### Độ khó
Số quái: `SPAWN` trong `game/main.js` · Máu quái: `ENEMY_TYPES` trong `game/src/enemies.js` · Sát thương người chơi: `PLAYER_CFG.damageMul` trong `game/main.js`.

### Thêm nhân vật từ spritesheet vẽ bằng AI (nền ô caro giả)
`python game/tools/prepare_spritesheet.py anh_goc.png game/assets/images/actors/ten.png 40 4 8 4 --shy=0:3` (cần Pillow) — tự xóa nền ô caro, tách từng frame, thu nhỏ về cao 40px, căn chân. Rồi thêm khối `spritesheet` cho nhân vật trong `characters.js` (xem Thanh Xuân làm mẫu).

### Dùng spritesheet của bạn
Mở **`game/fx-config.js`**, đổi `src` của hiệu ứng (hoặc nhân vật) sang ảnh của bạn rồi điền `cols`, `rows` (hoặc `frameW`, `frameH`), `fps`, `anchorX`, `anchorY`; lệch thì chỉnh `offsetX`, `offsetY`. Ảnh chia không đều sẽ có cảnh báo trong Console (F12).

### Xuất lại PNG từ pixelfx
Sau khi đổi tham số pixelfx trong `fx-config.js` (palette, fps, số biến thể...): chạy `node game/tools/bake-sprites.mjs` (cần Node.js 18+). Thiếu file PNG nào thì game cũng tự nướng lại lúc tải (chậm hơn vài giây).

## Chạy trên máy
Bấm đúp `Chay_Game.bat` (cần Python), hoặc mở bằng bất kỳ web server tĩnh nào rồi vào `/game/`.

## Cập nhật lên GitHub
- Sửa xong bấm đúp **`Day_Len_GitHub.bat`** → link chơi tự cập nhật sau ~1 phút.
- Hoặc để **`Tu_Dong_Cap_Nhat.bat`** chạy trong lúc sửa: cứ 30 giây có thay đổi là tự đẩy lên.

## Ghi công
Hiệu ứng pixel dùng thư viện [pixelfx](pixelfx-main/) (MIT License — xem `pixelfx-main/LICENSE` và `pixelfx-main/NOTICE.md`).

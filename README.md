# ⚔️ Pixel Arena

Game đấu trường sinh tồn pixel art 2D (HTML5 Canvas + JavaScript thuần), giao diện 100% tiếng Việt.

**▶ Chơi ngay:** https://sweet2k6.github.io/pixel-arena/

## Tính năng
- **3 nhân vật:** Xạ Thủ, Võ Sư, Pháp Sư Năng Lượng — giáp tự hồi khi không trúng đòn.
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

## Chạy trên máy
Bấm đúp `Chay_Game.bat` (cần Python), hoặc mở bằng bất kỳ web server tĩnh nào rồi vào `/game/`.

## Cập nhật lên GitHub
- Sửa xong bấm đúp **`Day_Len_GitHub.bat`** → link chơi tự cập nhật sau ~1 phút.
- Hoặc để **`Tu_Dong_Cap_Nhat.bat`** chạy trong lúc sửa: cứ 30 giây có thay đổi là tự đẩy lên.

## Ghi công
Hiệu ứng pixel dùng thư viện [pixelfx](pixelfx-main/) (MIT License — xem `pixelfx-main/LICENSE` và `pixelfx-main/NOTICE.md`).

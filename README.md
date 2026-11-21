# ⚔️ Pixel Arena

Game đấu trường sinh tồn pixel art 2D (HTML5 Canvas + JavaScript thuần), giao diện 100% tiếng Việt.

**▶ Chơi ngay:** https://sweet2k6.github.io/pixel-arena/

## Có gì mới ở bản 5.5 — KHOANG MÁY BAY MỚI: RỘNG, CHI TIẾT, ĐI LẠI TỰ DO
- **Khoang C-130 dài 1120px** (gấp 2.3 màn hình), **camera trượt theo** nhân vật, có lớp tiền cảnh trôi nhanh hơn tạo chiều sâu. Từ mũi tới đuôi: **buồng lái** (2 phi công, kính lớn nhìn ra trời lửa, radar quét, đường chân trời nghiêng theo máy bay, đồng hồ rung kim, đèn cảnh báo) · **vách ngăn** (rìu cứu hộ, dưỡng khí) · **khu tổ lái** (bàn bộ đàm có máy hiện sóng, màn hình nhiệm vụ đếm ngược, mũ treo móc, **bàn bản đồ** có đèn treo đung đưa + cốc cà phê bốc khói, **lính ngủ gật** Zzz) · **khoang hàng** (giá súng ARMORY, dù treo, lưới hàng, thùng đạn = TRANG BỊ, thùng phuy) · **đuôi** (**chỉ huy nhảy dù** giơ tay hô "ĐI! ĐI! ĐI!" khi đèn xanh, cửa JUMP, dốc sau thủy lực, đèn đỏ quay).
- **Đi lại tự do**: WASD / mũi tên / cần ảo, tăng tốc mượt, giữ <kbd>Shift</kbd> để chạy. **Bấm / chạm sàn** = nhân vật tự tìm đường vòng qua đồ vật (A*). Đồ vật vẽ theo **chiều sâu**: đi ra sau bàn / thùng hàng thì bị che.
- **Tương tác <kbd>E</kbd>** (hoặc chạm): hỏi phi công · nghe bộ đàm (có tiếng rè) · xem bản đồ · lay lính ngủ gật · **nhìn ra cửa sổ** (cận cảnh cánh máy bay, động cơ phun lửa, cánh quạt quay, pháo nổ, thành phố cháy bên dưới) · hỏi chỉ huy nhảy · trang bị · cửa nhảy. Thoại hiện thành bóng chữ; sửa câu thoại ở `LINES` trong `src/cabin.js`.
- Thanh vị trí dưới đáy màn hình + mũi tên "CỬA NHẢY" khi đèn xanh. Bảng trang bị mặc định **ẩn** để ngắm khoang (mở bằng Tab / nút / E ở thùng hàng).

## Có gì mới ở bản 5.4 — TRỜI TẬN THẾ · ÂM THANH MÁY BAY · MINH HUY
- **Bầu trời ngày tận thế** ngoài máy bay (`src/cabin.js`, bảng màu `DOOM`): trời đỏ quạch tối sầm, mây đen cuồn cuộn, **tia chớp**, **pháo phòng không nổ** quanh máy bay (khói đen trôi qua cửa sổ, ánh lửa hắt vào khoang, nổ gần thì khoang rung mạnh + đèn chập chờn). Cảnh lên máy bay: thành phố đổ nát bốc cháy, cột khói, bom nổ thành nấm khói, đèn pha quét trời, zombie lê về phía máy bay, xác xe cháy, tro bụi bay. Cảnh rơi tự do: lao xuống thành phố đang cháy. Nhịp chớp/nổ chỉnh ở `SKY_EVENTS`.
- **Âm thanh khoang máy bay** (`src/cabinAudio.js`, tổng hợp bằng Web Audio — không cần file): động cơ cánh quạt ù ù + nhịp đập cánh quạt, gió rít giật từng cơn, còi báo động phòng không ở sân bay, tiếng nổ xa (thấy chớp trước, nghe tiếng sau) / gần (đanh + mảnh văng lách cách), sấm rền, khung máy bay kẽo kẹt khi nhiễu động, còi báo nhảy khi đèn xanh / mở cửa, gió gào khi rơi tự do. Vẫn nghe tiếng máy bay khi đang chọn điểm nhảy. Nút Tắt tiếng có tác dụng; chỉnh to nhỏ ở `CABIN_VOLUME`.
- **Tí Ngố đổi tên thành MINH HUY** và đi **giày trắng** đế xám (`chibi.sole` trong `characters.js`).

## Có gì mới ở bản 5.3 — ĐI LẠI TRONG KHOANG · CẢNH LÊN MÁY BAY / NHẢY DÙ · TÍ NGỐ (nay là MINH HUY)
- **Đi lại trong khoang máy bay**: WASD / phím mũi tên, hoặc click / chạm vào sàn để đi tới. Đứng cạnh đống thùng hàng bấm <kbd>E</kbd> = mở/ẩn **Trang bị**; ra **cửa JUMP** ở đuôi khoang bấm <kbd>E</kbd> = nhảy dù. Bảng trang bị **bật/tắt** bằng <kbd>Tab</kbd> / <kbd>I</kbd> / nút "Ẩn trang bị" / nút × trên bảng.
- **Cảnh LÊN MÁY BAY**: sân bay lúc hoàng hôn, nhân vật chạy lên dốc sau của C-130, cửa gập lại, cánh quạt quay nhanh dần, cất cánh (Enter / click để bỏ qua).
- **Cảnh NHẢY KHỎI MÁY BAY**: chọn điểm nhảy trên bản đồ chiến thuật -> về khoang, cửa JUMP trượt mở, gió lùa, nhân vật chạy vòng qua thùng hàng ra cửa và lao ra, **rơi tự do qua mây** (đồng hồ độ cao), rồi mới bung dù xuống điểm đã chọn.
- **Nhân vật mới TÍ NGỐ** (`characters.js`, vẽ bằng code ở `src/chibi.js` kiểu đầu `"bowl"`): tóc ngố bát úp bết mồ hôi, 2 răng thỏ, lùn, áo giáp chiến thuật đen. Yếu nhất game (4 Máu, 3 Giáp), súng tay run; bù lại **15% né đòn**, **lục hòm nhanh gấp đôi**, **thêm 1 hộp đạn mỗi hòm**. Tuyệt chiêu **Hoảng Loạn Xả Đạn**: 2.5 giây xả 40 viên tứ phía.

## Có gì mới ở bản 5.2 — KHOANG MÁY BAY · ĐẠN THEO LOẠI · KHO SÚNG HD
- **Khoang máy bay** (`game/src/cabin.js`): bấm **LÊN MÁY BAY** ở Cổng Xuất Kích -> vào khoang C-130 vẽ pixel art: cửa sổ tròn có **mây trôi**, giá súng, thùng đạn, ghế lưới đỏ, dù treo, đèn nhảy đỏ -> xanh, khoang **rung nhẹ + nhiễu động** (đèn chớp, dây đung đưa), tiếng động cơ. **Chọn đồ (Kho Đồ, Túi Chiến Thuật, súng, thời lượng) nằm trong khoang**; bấm **CHỌN ĐIỂM NHẢY** để ra bản đồ chiến thuật. Ảnh nền riêng: `CABIN_IMAGES` trong `cabin.js`.
- **Đạn theo loại** (`game/src/ammo.js`, chế độ Rút Quân): 8 loại đạn, thay băng chỉ lấy từ đạn dự trữ đúng loại; HUD hiện `trong băng | dự trữ` + vạch màu loại đạn, hết thì báo **HẾT ĐẠN**. Nhặt **hộp đạn** từ hòm tiếp tế, zombie (zombie to rơi nhiều), hoặc nhặt súng (kèm 1 băng). Chế độ Giải Trí vẫn vô hạn đạn.
- **Kho Vũ Khí ảnh chi tiết (HD)**: M4A1, AKM, MP5A3, AWM, Remington 870, Glock 19, M249 dùng ảnh lớn cắt từ tấm ảnh súng của bạn (`game/assets/images/guns/hd/`); mọi thẻ có khung ảnh lớn. Trong trận vẫn dùng ảnh pixel nhỏ (ở 480x270 ảnh chi tiết bị nhòe).
- **Phụ kiện súng — nền móng Xưởng Vũ Khí** (`game/src/attachments.js`): Ống Ngắm Toàn Ký, Kính Chấm Đỏ, Kính 4x, Nòng Giảm Thanh, Lưỡi Lê, Tay Cầm Trước, Băng Đạn Mở Rộng — có ảnh, ô gắn, chỉ số và hàm `applyAttachments()`; đang hiện xem trước ở Kho Vũ Khí.
- **Cổng Xuất Kích**: 2 tab Rút Quân / Giải Trí **cùng 1 kích thước**, mỗi tab có 4 bước giới thiệu. Nhân vật Thanh Xuân đổi tên **Bạch Ngưng Băng**.
- **Điện thoại**: chạm lần đầu ngay ở sảnh là bật **toàn màn hình + khóa ngang** (trước đây phải vào trận mới to ra).
- **Xem trực tiếp khi sửa**: chạy `Chay_Game.bat` -> mỗi khi file `game/dev-live.txt` đổi, trang tự tải lại (đang trong trận thì đợi về sảnh). Chỉ chạy trên máy nhà (localhost), không ảnh hưởng bản GitHub.
- Công cụ: `game/tools/remove_checker_bg.py` (tách nền ô caro GIẢ của ảnh AI), `game/tools/crop_hd_guns.py` (cắt súng/phụ kiện).

## Có gì mới ở bản 5.0 — NHẢY DÙ · NHIỆM VỤ · RÚT QUÂN
Lối chơi chính chuyển sang **Extraction Survival** (ván 5 / 7 / 10 phút). Lối chơi sinh tồn theo đợt cũ vẫn còn nguyên, nay là **Chế Độ Giải Trí** (chọn ở Cổng Xuất Kích).
- **Kho Đồ vĩnh viễn** (`game/src/stash.js`, localStorage): Hộp Cứu Thương, Bình Năng Lượng, Lựu Đạn, Mìn Cảm Ứng, Ống Tiêm Kích Thích + súng mang về từ trận. Người chơi mới được tặng bộ đồ khởi đầu.
- **Cổng Xuất Kích** (giữa sảnh, hoặc nút **Xuất Kích** / Enter): chọn chế độ, bỏ đồ từ Kho vào **Túi Chiến Thuật 4 ô** (`Z X C V` hoặc `3 4 5 6` trong trận), chọn 1 súng trong Kho, thời lượng và độ khó.
- **Rủi ro – phần thưởng:** rút quân thành công thì đồ còn trong túi + mọi thứ nhặt được về Kho, nhận Ngọc (Vàng nhặt được đổi ra Ngọc). Tử trận / bỏ trận thì mất toàn bộ đồ mang theo trong ván.
- **Nhảy dù** (`game/src/deploy.js`): bản đồ chiến thuật dạng ảnh trinh sát, click chọn 1 trong 6 Điểm Nhảy Dù (hiện mức nguy hiểm, khoảng cách tới nhiệm vụ, đường bay). Máy bay vận tải bay ngang kèm bóng đổ + tiếng động cơ, nhân vật bung dù rơi xuống, tiếp đất tạo bụi và **sóng xung kích** hất văng zombie, rồi mới tính giờ.
- **Bản đồ 3200x2240** (`game/src/extractMap.js`): 4 khu rõ rệt — Khu Dân Cư Đổ Nát, Trạm Quân Sự, Nghĩa Trang, Phòng Thí Nghiệm — chia bởi đường lớn hình chữ thập; 32 **Hòm Tiếp Tế / Túi Y Tế** rải rác (bấm **E** để lục, hòm có thể ra súng).
- **Zombie theo đàn 5–6 con** (`game/src/hordeAI.js`): Zombie Thường, Zombie Chạy Nhanh, Zombie Phun Độc (chết nổ axit), Zombie Đột Biến Khổng Lồ (Boss: húc, nhảy đập đất, gầm gọi đàn). Đàn tuần tra theo đội hình; thấy bạn hoặc nghe tiếng súng to thì **cả đàn hú lên (!)** và lao tới bao vây. Súng càng to càng vang xa (`noise` của từng vũ khí).
- **Nhiệm vụ động** (`game/src/missions.js`): mỗi ván 2–3 nhiệm vụ — Chiếm Cứ Điểm (0% → 100%, zombie tràn tới), Cứu Người Sống Sót (diệt đàn vây rồi E), Phá Hủy Ổ Dịch (kén đẻ zombie) hoặc Tải Dữ Liệu Hộp Đen. Có bảng nhiệm vụ, dấu trên minimap và mũi tên quanh nhân vật.
- **Rút quân** (`game/src/extraction.js`): xong ≥1 nhiệm vụ thì Điểm Rút Quân xanh mở; vào bãi đáp bấm **E** bắn pháo sáng, cầm cự **15 giây** trước đợt zombie cuối, trực thăng hạ cánh, chạy vào là **RÚT QUÂN THÀNH CÔNG**. Hết giờ: vùng độc + không kích.
- **Kho 48 vũ khí** (`game/src/guns.js`, `game/src/weapons.js`): **43 súng** có **băng đạn + nạp đạn (R)**, lửa nòng & vỏ đạn dạng sprite, và **5 vũ khí cận chiến** (Dao Găm, Xà Beng, Dao Rựa, Rìu, Dùi Cui), tất cả vẽ bằng ảnh thật. 14 khẩu dùng ảnh Pixel Armory (Pistol 17, Ổ Quay, UZI, MP5, M4A1, AK-47, Hoa Cải Bơm, Sawed-off, AWP, M79, Bazooka, Minigun, Laser Rifle, Plasma). Các khẩu còn lại cắt từ **tấm kho vũ khí 45 khẩu** (`game/assets/images/guns/armory/`): Colt M1911, Beretta M9, Desert Eagle, Combat Shotgun, Auto Shotgun, Double Barrel, SCAR-H, FAMAS, G36C, P90, Tommy Gun, Vector, Dragunov, M24, Barrett .50cal, Intervention, M249 SAW, RPK, M60, MG42, Stoner 63, Ray Gun, Ion Cannon, EMP Blaster, Súng Xung Kích, Súng Trường Lượng Tử, Súng Trường Tương Lai, Nguyên Mẫu X-1/X-2. Đổi `CLASSIC_USE_SHEET_ART = true` trong `guns.js` nếu muốn cả 11 khẩu cổ điển cũng dùng ảnh từ tấm này. Có ở Kho Vũ Khí (đã cuộn được hết danh sách), rương và hòm tiếp tế.
- **Thanh Máu / Giáp / Năng Lượng hiển thị theo %** ở cả 2 chế độ (năng lượng mỗi phát cũng tính theo %).
- **Hiệu năng:** zombie đi tuần ở xa camera chỉ cập nhật rẻ (viewport culling), đạn / quái / hiệu ứng vẫn dùng Object Pool; đo trong Chrome: ~135 zombie trên bản đồ, cả đàn lao vào cùng lúc vẫn 60 FPS.
- **Thay ảnh:** máy bay, dù, trực thăng, hòm đồ, túi y tế, pháo sáng, người sống sót, kén ổ dịch, trạm phát sóng → `EXTRACT_IMAGES` trong `game/src/extraction.js`; icon vật phẩm → `ITEM_IMAGES` trong `game/src/stash.js`; zombie → `game/assets/images/actors/zombie-*.png` (khai báo ở `game/fx-config.js`); súng → `game/assets/images/guns/` và `game/assets/images/guns/armory/` (`GUN_DATA`, `SHEET_GUNS` trong `game/src/guns.js`). Để trống thì game tự vẽ pixel art.
- **Thử nhanh:** `/game/#extract` (vào thẳng bản đồ chiến thuật), `/game/#autoplay-0-0-extract-god` (tự chơi chế độ Rút Quân, bất tử).

## Có gì mới ở bản 4.0
- **Sảnh chờ đi lại được** (thay menu tĩnh): nhân vật đang chọn đi bằng WASD trong căn phòng pixel ấm cúng; lại gần nhân vật khác + **E** (hoặc click / chạm) để đổi người. **Kho Vũ Khí** (góc trái) chế tạo & chọn vũ khí phụ, **Bàn Nâng Cấp** (góc phải) nâng vĩnh viễn Máu / Giáp / Hồi chiêu / Vũ khí khởi đầu cho từng nhân vật bằng **Ngọc**, **Cổng Dịch Chuyển** chọn bản đồ & độ khó. Nút **Vào Trận Nhanh** (Enter).
- **Ngọc** (lưu localStorage) nhận sau mỗi trận theo điểm, đợt, Boss.
- **Năng Lượng** (thanh xanh dương): vũ khí khởi đầu & cận chiến miễn phí, vũ khí mạnh tốn năng lượng mỗi phát. Quái, lọ năng lượng rơi ngọc xanh tự bay về.
- **5 độ hiếm** dùng chung cho vũ khí và thẻ: Thường (trắng) · Hiếm (xanh lá) · Sử Thi (xanh dương) · Huyền Thoại (cam) · Thần Thoại (đỏ). **21 vũ khí** (+ 8 vũ khí khởi đầu): mới có Găng Bão Tố, Cung Dài Thợ Săn, Búa Sấm Sét, Pháo Năng Lượng và 3 vũ khí Thần Thoại (Long Kiếm Diệt Thần, Pháo Hư Không, Cung Thần Bão).
- **Cận chiến combo 3 đòn** kiểu Dan the Man (đòn 3 quét rộng, hất văng, luôn chí mạng, khựng hình) và **mọi nhát chém phản đạn** của quái.
- **Vũ khí tích lực:** giữ chuột tụ lực (vòng sáng quanh chân), thả ra bắn xuyên thấu cực mạnh (Cung Săn của Thợ Săn cũng tích lực được).
- **Súng giật nòng, văng vỏ đạn** nảy trên sàn; **rung màn hình có hướng** theo hướng bắn / vụ nổ / trúng đòn.
- **Nhặt vũ khí bằng E**, 2 khẩu giống nhau cùng ★ → **GHÉP** (phím G / nút GHÉP) lên ★+1; 2 khẩu ★3 tiến hóa thành Thần Thoại; có công thức ghép chéo.
- **Báo hiệu sinh quái:** 0.5 giây trước khi quái xuất hiện có **vòng ngắm đỏ** phát sáng dưới đất đúng chỗ đó (Boss: vòng to, 1.1 giây).
- **Vật thể tương tác:** thùng gỗ, lọ năng lượng (đập vỡ rơi Vàng / Năng Lượng / Tim), bụi cây chắn đạn cả 2 phe.
- **Quái Tinh Anh** to hơn, viền phát sáng, có tố chất & kỹ năng riêng (Cuồng Phong, Bão Đạn, Bất Tử, Bạo Liệt), rơi nhiều thưởng.
- **Thương Nhân Bí Ẩn** (sau mỗi Boss) bán thuốc, bùa, vũ khí bằng **Vàng**; sự kiện **Tượng Thần** dâng vàng nhận bùa.
- **Game juice:** khựng hình 25ms khi chí mạng / đòn kết thúc combo / hạ Boss; số sát thương **trắng**, chí mạng **to vàng-đỏ có "!"**.

## Bản 3.0
- **8 nhân vật** (thêm Thánh Kỵ Sĩ, Thợ Săn, Tử Linh Sư, Bóng Đêm), mỗi người có **nội tại** riêng và tỉ lệ chí mạng riêng.
- **Hệ thống nâng cấp viết lại, chống "hack game":** thẻ có **độ hiếm** (Thường / Hiếm / Sử Thi / Huyền Thoại) và **giới hạn cấp**. Đạn Phân Tách tối đa +2 tia và mỗi tia yếu đi (2 tia x70%, 3 tia x55%). Chỉ số cộng tuyến tính, có trần/sàn (tốc bắn, hồi chiêu, tốc chạy...). 17 thẻ, được **đổi bộ thẻ 3 lần/trận** (phím R).
- **Đợt quái + 4 Boss luân phiên:** Hồn Ma Tím, Vua Slime (nhảy đè), Chúa Tể Đầu Lâu (xoáy cầu lửa), Mắt Quỷ Vương (tia laser quét). Mỗi đợt quái mạnh và đông hơn.
- **3 mức độ khó:** Dễ / Thường / Ác Mộng (nhân điểm x0.7 / x1 / x1.6).
- **5 loại quái mới:** Mắt Quỷ, Đầu Lâu Lửa (lao như tên bắn), Ếch Độc (nhảy cóc, phun axit), Rắn Độc, Pháp Sư Xương (triệu hồi + dịch chuyển).
- **6 vũ khí rương mới:** Súng Phun Độc, Đĩa Năng Lượng (nảy giữa các quái), Lưỡi Hái Tử Thần (hút máu), Súng Bắn Tỉa, Bệ Phóng Tên Lửa tầm nhiệt, Trượng Thiên Thạch. Vũ khí có độ hiếm; **nhặt trùng để nâng ★** (tối đa ★3).
- **Luật chơi mới:** chí mạng, combo nhân điểm (thưởng ở mốc x25/x50/x100), sự kiện ngẫu nhiên (Bầy Dơi, Mưa Thiên Thạch, Rương Vàng, Tinh Anh săn đuổi), Đền Thờ ban bùa 20 giây, quái rơi Tim hồi máu, ngọc EXP để lâu tự bay về.
- **Bản đồ thứ 5 — Nghĩa Trang Ma Ám** (sương mù, bia mộ, bàn tay ma giữ chân).
- **Bản đồ đẹp hơn:** sàn vẽ chi tiết theo từng biome (gạch vát cạnh, rêu, cỏ, xương, tuyết, phiến bazan...), đồ trang trí, đuốc và lò lửa, **ánh sáng động** (bóng tối + vùng sáng quanh nhân vật, đuốc, dung nham, đạn phép), thời tiết (bụi, đom đóm, tàn lửa, tuyết, sương mù), viền tối màn hình.
- **Màn hình Luật Chơi** (nút "?" ở menu), kỷ lục riêng từng nhân vật, thống kê cuối trận đầy đủ hơn, xem thẻ đã chọn khi tạm dừng.
- **Sửa lỗi & cân bằng:** Bạch Ngưng Băng không còn đóng băng quái vĩnh viễn (quái miễn nhiễm 1.2s sau khi tan băng), tuyệt chiêu Ngại Ngùng không còn xóa sổ Tinh Anh / Boss, gai băng không che nhân vật, Boss trâu hơn, nút tạm dừng trên điện thoại không đè chữ...
- **Tối ưu:** lưới va chạm tĩnh cho tường/cột (đạn và quái chỉ xét ô lân cận), ảnh PNG nén còn ~một nửa dung lượng, ánh sáng dùng vết sáng vẽ sẵn (bấm **L** để tắt nếu máy yếu).

## Nhân vật
| Nhân vật | Vũ khí | Kỹ năng | Nội tại |
|---|---|---|---|
| Xạ Thủ | Súng Lục | Cuồng Nộ (x2 tốc bắn) | 8% chí mạng |
| Võ Sư | Găng Sắt | Lướt Xung Kích | Bất tử lâu hơn khi bị đánh |
| Pháp Sư Năng Lượng | Trượng cầu năng lượng | Bão Cầu 360° | Giáp hồi nhanh gấp rưỡi |
| Bạch Ngưng Băng | Đường gai băng | Ngại Ngùng (băng + sét xóa quái thường) | Quái đóng băng nhận +20% sát thương |
| Minh Huy | Súng Trường Tập Bắn (tay run) | Hoảng Loạn Xả Đạn (40 viên tứ phía, 2.5s) | 15% né · lục hòm x2 · +1 hộp đạn/hòm |
| Thánh Kỵ Sĩ | Búa Thánh (choáng) | Khiên Thánh Quang (bất tử 3s, hồi máu) | Lên cấp hồi 1 Máu |
| Thợ Săn | Cung Săn (xuyên) | Mưa Tên | 12% chí mạng |
| Tử Linh Sư | Cầu linh hồn đuổi mục tiêu | Triệu Hồi Vong Linh | 15 quái gục hồi 1 Máu |
| Bóng Đêm | Phi Tiêu (nảy) | Ảnh Sát (dịch chuyển chém) | 18% chí mạng, lướt hồi nhanh |

## Điều khiển
| Phím | Tác dụng |
|---|---|
| WASD / mũi tên | Di chuyển (cả trong Sảnh chờ) |
| E | Sảnh: đổi nhân vật / dùng trạm · Trong trận: nhặt vũ khí, mua đồ, cầu phúc, lục hòm, giải cứu, bắn pháo sáng |
| Z X C V (hoặc 3 4 5 6) | Rút Quân: dùng đồ trong Túi Chiến Thuật |
| R | Nạp đạn (súng thật) |
| G | Ghép 2 vũ khí |
| Enter | Sảnh: Vào Trận Nhanh |
| Chuột trái | Tấn công (giữ để tích lực với cung / búa sấm / pháo) |
| Space / chuột phải | Kỹ năng nhân vật |
| Shift | Lướt nhanh |
| Q / lăn chuột / 1–2 | Đổi vũ khí |
| R | Đổi bộ thẻ nâng cấp (3 lần/trận) |
| P / Esc | Tạm dừng (xem thẻ đã chọn) · M: tắt tiếng · L: tắt/bật ánh sáng |

**Điện thoại:** xoay ngang · Sảnh chờ: chạm sàn để đi, chạm người / trạm để dùng · Trong trận: ngón trái kéo để chạy, ngón phải kéo để ngắm và bắn · nút tròn bên phải: Kỹ năng, Lướt, Đổi súng, E (nhặt), GHÉP.

## Chỉnh độ khó / cân bằng
- Số quái, rương, sự kiện, thời gian báo hiệu sinh quái: `SPAWN` · năng lượng: `ENERGY` · vàng: `GOLD` · luật đợt: `WAVE` · độ khó: `DIFFICULTY` · combo: `COMBO` · bùa: `BLESSINGS` — đầu file `game/main.js`.
- Chế độ Rút Quân: thời lượng, số đàn zombie, lịch Boss, pháo sáng, vùng độc → `EXTRACT` (`game/src/extraction.js`) · nhiệm vụ → `MISSION_TYPES` (`game/src/missions.js`) · đàn zombie → `HORDE` (`game/src/hordeAI.js`) · vật phẩm → `ITEM_DEFS` (`game/src/stash.js`) · máy bay / dù → `DROP` (`game/src/deploy.js`).
- Sảnh chờ (vị trí trạm, đồ đạc): `game/src/lobby.js` · giá nâng cấp / chế tạo bằng Ngọc: `UPGRADES`, `CRAFT_COST` trong `game/src/progress.js` · hàng của Thương Nhân / Tượng Thần: `game/src/shop.js` · độ hiếm: `game/src/rarity.js`.
- Tố chất Tinh Anh: `ELITE_AFFIXES` trong `game/src/enemies.js` · công thức ghép: `RECIPES` trong `game/src/weapons.js` · vật thể phá được: `ENV.props` trong `game/src/world.js`.
- Máu / tốc độ / chiêu của quái và Boss: `ENEMY_TYPES` trong `game/src/enemies.js`.
- Thẻ nâng cấp (giới hạn cấp, độ hiếm, % tăng): `PERKS`, `SPLIT_DMG`, lớp `Mods` trong `game/src/perks.js`.
- Vũ khí: `WEAPONS`, `WEAPON_LEVELS` trong `game/src/weapons.js` · nhân vật: `game/characters.js`.
- Bản đồ, bẫy, ánh sáng, thời tiết: `BIOMES`, `ENV` trong `game/src/world.js`.

## Hoạt ảnh, hiệu ứng & hiệu năng
- **Nhân vật có hoạt ảnh thật:** Đứng yên · Chạy (bước nhanh dần theo tốc độ, tung bụi chân) · Lướt/Kỹ năng — điều khiển bởi `AnimationController` theo deltaTime (`game/src/animation.js`). Tự lật trái/phải theo chuột.
- **Vũ khí gắn vào tay** theo từng frame, xoay 360° theo chuột, giật lùi khi bắn, vung theo cung khi chém (chỉnh trong `WEAPON_CFG`, `game/main.js`).
- **Hiệu ứng spritesheet:** các hiệu ứng pixelfx đã được "nướng" sẵn thành PNG trong `game/assets/images/fx/` và `game/assets/images/actors/`, phát theo từng frame bởi `EffectManager` (`game/src/effects.js`, tối đa `MAX_EFFECTS = 150`).
- **Ánh sáng & thời tiết:** `game/src/ambient.js` (lớp tối + vết sáng chia nấc kiểu pixel art, hạt môi trường).
- **Chống lag khi quái đông:** Object Pool cho đạn / quái / ngọc EXP / hiệu ứng, lưới không gian cho quái + lưới va chạm tĩnh cho tường, khoảng cách bình phương, tản đội hình mềm (`CROWD` trong `game/src/enemies.js`).
- **Bộ đếm FPS** ở góc trên phải. Phím **H** bật thông số debug, khi đó phím **J** thả thêm 50 quái. Thử tải: mở `/game/#stress-300`.
- **Tự chơi để kiểm tra:** `/game/#autoplay-<nhân vật>-<bản đồ>` (thêm `-god` bất tử, `-wave-5` bắt đầu từ đợt 5, `-diff-2` độ khó Ác Mộng).

### Thêm nhân vật từ spritesheet vẽ bằng AI (nền ô caro giả)
`python game/tools/prepare_spritesheet.py anh_goc.png game/assets/images/actors/ten.png 40 4 8 4 --shy=0:3` (cần Pillow) — tự xóa nền ô caro, tách từng frame, thu nhỏ về cao 40px, căn chân. Rồi thêm khối `spritesheet` cho nhân vật trong `characters.js` (xem Bạch Ngưng Băng làm mẫu).

### Dùng spritesheet của bạn
Mở **`game/fx-config.js`**, đổi `src` của hiệu ứng (hoặc nhân vật) sang ảnh của bạn rồi điền `cols`, `rows` (hoặc `frameW`, `frameH`), `fps`, `anchorX`, `anchorY`; lệch thì chỉnh `offsetX`, `offsetY`. Ảnh chia không đều sẽ có cảnh báo trong Console (F12).

### Xuất lại PNG từ pixelfx
Sau khi đổi tham số pixelfx trong `fx-config.js` (palette, fps, số biến thể...): chạy `node game/tools/bake-sprites.mjs` (cần Node.js 18+), hoặc chỉ vài mục: `node game/tools/bake-sprites.mjs meteor portal`. Thiếu file PNG nào thì game cũng tự nướng lại lúc tải (chậm hơn vài giây).

## Chạy trên máy
Bấm đúp `Chay_Game.bat` (cần Python): mở server **không cache** `serve.py` nên sửa code xong chỉ cần F5 là thấy bản mới. Hoặc mở bằng bất kỳ web server tĩnh nào rồi vào `/game/`.
- **Cập nhật xong mà game vẫn như cũ?** Trình duyệt đang dùng file cũ trong bộ nhớ đệm: bấm **Ctrl + F5** một lần. Mỗi lần sửa code / CSS, tăng `GAME_VERSION` ở đầu `game/index.html` (vd `5.1.2` → `5.1.3`) để mọi người chơi (kể cả trên GitHub Pages) tự tải bản mới. Thêm file `.js` mới thì thêm tên vào `CODE_FILES` cuối `game/index.html`.

## Cập nhật lên GitHub
- Sửa xong bấm đúp **`Day_Len_GitHub.bat`** → link chơi tự cập nhật sau ~1 phút.
- Hoặc để **`Tu_Dong_Cap_Nhat.bat`** chạy trong lúc sửa: cứ 30 giây có thay đổi là tự đẩy lên.

## Ghi công
Hiệu ứng pixel dùng thư viện [pixelfx](pixelfx-main/) (MIT License — xem `pixelfx-main/LICENSE` và `pixelfx-main/NOTICE.md`).

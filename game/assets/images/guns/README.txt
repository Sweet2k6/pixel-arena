PIXEL ARMORY — bộ sprite súng 2D
================================
• File PNG nền trong suốt, vẽ pixel gốc, không khử răng cưa.
• Hướng: mặt phải. Lật ngang (scaleX -1) để bắn sang trái.
• Khi lật, điểm neo X mới = chiều rộng - X cũ.
• Luôn vẽ với image-rendering: pixelated / imageSmoothingEnabled = false.
• weapons-sheet.png: mọi khẩu cùng một ô, cùng một điểm cầm (grip).
• manifest.json: kích thước, grip, muzzle, đạn, hiệu ứng nòng.

Cách gắn vào game (Canvas):
  ctx.imageSmoothingEnabled = false
  ctx.translate(handX, handY)
  ctx.rotate(aim)
  ctx.drawImage(img, -gun.grip[0] * scale, -gun.grip[1] * scale, gun.w * scale, gun.h * scale)
  // đạn xuất phát tại gun.muzzle, xoay quanh grip

Bạn có thể dùng các sprite này trong game của mình.

# =====================================================================================
#  WEB SERVER CHẠY THỬ GAME TRÊN MÁY — KHÔNG CACHE
#  Giống "python -m http.server" nhưng gửi kèm "Cache-Control: no-store", nên mỗi lần bấm F5
#  trình duyệt luôn tải bản code mới nhất (không còn cảnh sửa xong mà game vẫn như cũ).
#  Dùng: python serve.py [cổng]   (Chay_Game.bat gọi sẵn file này)
# =====================================================================================
import http.server
import sys


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    # Ép đúng kiểu file: trên một số máy Windows, .js bị nhận nhầm là text/plain làm ES module không chạy
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript",
        ".mjs": "text/javascript",
        ".css": "text/css",
        ".json": "application/json",
        ".webmanifest": "application/manifest+json",
        ".png": "image/png",
    }

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Expires", "0")
        super().end_headers()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    server = http.server.ThreadingHTTPServer(("", port), NoCacheHandler)
    print(f"Pixel Arena: http://localhost:{port}/game/  (khong cache - dong cua so nay de tat)")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass

@echo off
REM Chay game: mo web server KHONG CACHE (serve.py) tai thu muc Game_Dev roi mo trinh duyet
REM Khong co serve.py thi dung server mac dinh cua Python
cd /d "%~dp0"
start "" http://localhost:8000/game/
if exist serve.py (python serve.py 8000) else (python -m http.server 8000)

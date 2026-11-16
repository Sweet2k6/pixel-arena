@echo off
REM Chay game: mo web server tai thu muc Game_Dev roi mo trinh duyet
cd /d "%~dp0"
start "" http://localhost:8000/game/
python -m http.server 8000

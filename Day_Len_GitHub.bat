@echo off
REM ============================================================
REM  DAY CODE LEN GITHUB  ->  GitHub Pages tu cap nhat link choi
REM  Link choi: https://sweet2k6.github.io/pixel-arena/
REM  Bam dup file nay moi khi ban sua game xong.
REM ============================================================
cd /d "%~dp0"
set REPO=https://github.com/sweet2k6/pixel-arena.git
where git >nul 2>nul
if errorlevel 1 goto nogit
if not exist ".git" call :setup
git remote set-url origin %REPO%
git config user.name >nul 2>nul || git config user.name "sweet2k6"
git config user.email >nul 2>nul || git config user.email "sweet2k6@users.noreply.github.com"
git add -A
git diff --cached --quiet
if errorlevel 1 git commit -q -m "Cap nhat Pixel Arena %date% %time%"
git pull --rebase -q origin main >nul 2>nul
git push -u origin main
if errorlevel 1 goto fail
echo.
echo  XONG! Link choi game (cap nhat sau khoang 1 phut):
echo  https://sweet2k6.github.io/pixel-arena/
echo.
if "%1"=="quiet" exit /b 0
timeout /t 10
exit /b 0

:setup
git init -q
git branch -M main
git remote add origin %REPO%
exit /b 0

:nogit
echo [LOI] May chua cai Git. Tai tai: https://git-scm.com/download/win
pause
exit /b 1

:fail
echo.
echo [LOI] Day len GitHub that bai. Neu hien cua so dang nhap, hay dang nhap tai khoan sweet2k6 roi chay lai.
if "%1"=="quiet" exit /b 1
pause
exit /b 1

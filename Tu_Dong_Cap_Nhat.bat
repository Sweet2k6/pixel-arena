@echo off
REM ============================================================
REM  TU DONG CAP NHAT: de cua so nay chay trong luc ban sua game.
REM  Cu 30 giay kiem tra 1 lan, co thay doi la tu day len GitHub.
REM  Dong cua so nay de dung.
REM ============================================================
cd /d "%~dp0"
title Pixel Arena - Tu dong day len GitHub
if not exist ".git" call Day_Len_GitHub.bat quiet
echo Dang theo doi thay doi... (dong cua so de dung)
:loop
git status --porcelain 2>nul | findstr . >nul
if not errorlevel 1 (
  echo [%time%] Phat hien thay doi - dang day len GitHub...
  call Day_Len_GitHub.bat quiet
)
timeout /t 30 /nobreak >nul
goto loop

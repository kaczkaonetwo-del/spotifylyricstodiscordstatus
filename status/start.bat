@echo off
title Spotify-to-Discord Lyrics Status
color 0a

echo ====================================================
echo   🎵 SPOTIFY TO DISCORD LYRICS STATUS LAUNCHER 🎵
echo ====================================================
echo.

:: Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    color 0c
    echo [BLAD] Nie znaleziono srodowiska Node.js na Twoim komputerze!
    echo Aby uruchomic ten program, musisz miec zainstalowany Node.js.
    echo Pobierz i zainstaluj go ze strony: https://nodejs.org/
    echo.
    echo Wcisnij dowolny klawisz, aby zamknac...
    pause >nul
    exit
)

echo [*] Trwa uruchamianie serwera Node.js...
echo [*] Otwieranie panelu kontrolnego w przegladarce...

:: Start browser in background after 2 seconds delay
start /b cmd /c "timeout /t 2 >nul && start http://localhost:3000"

:: Start the main server
node server.js

pause

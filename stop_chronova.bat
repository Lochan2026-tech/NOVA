@echo off
title Chronova Stopper
echo ========================================================
echo               Stopping Chronova Servers
echo ========================================================
echo.

echo Stopping servers on ports 8000, 5173, and 5174...
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 8000,5173,5174 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }"

echo.
echo All Chronova servers have been stopped.
echo ========================================================
timeout /t 3 /nobreak >nul

@echo off
title Chronova Launcher
echo ========================================================
echo          Starting Chronova Local Demo Servers
echo ========================================================
echo.

:: Get the directory where this script is located
set "PROJECT_DIR=%~dp0"
cd /d "%PROJECT_DIR%"

:: Pre-clean previous instances to ensure clean ports
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 8000,5173,5174 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }"

echo [1/3] Starting FastAPI Backend on http://127.0.0.1:8000 ...
start "Chronova Backend (:8000)" cmd /k "cd /d ""%PROJECT_DIR%backend"" && python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload"

echo [2/3] Starting Vite Frontend on http://localhost:5173 ...
start "Chronova Frontend (:5173)" cmd /k "cd /d ""%PROJECT_DIR%frontend"" && npm run dev"

echo [3/3] Waiting 4 seconds for servers to initialize...
timeout /t 4 /nobreak >nul

echo Opening Chronova Dashboard in your default browser...
start http://localhost:5173/

echo.
echo ========================================================
echo   Chronova is now RUNNING!
echo   - Frontend: http://localhost:5173/
echo   - Backend:  http://127.0.0.1:8000/
echo   - API Docs: http://127.0.0.1:8000/docs
echo.
echo   Keep the two opened command windows running while using
echo   the demo. To stop Chronova, simply run stop_chronova.bat
echo ========================================================
echo.
pause

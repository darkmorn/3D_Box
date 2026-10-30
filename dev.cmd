@echo off
REM Dev: backend on :8000 + Vite on :8008 (proxies /api -> :8000)
cd /d "%~dp0"
start "3DBox backend" cmd /k python -m uvicorn main:app --host 127.0.0.1 --port 8000
timeout /t 3 >nul
start "3DBox frontend" cmd /k npm run dev
timeout /t 3 >nul
start "" http://127.0.0.1:8008

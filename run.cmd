@echo off
REM Prod: build the frontend, then serve everything from FastAPI on :8000
cd /d "%~dp0"
call npm run build || exit /b 1
start "" http://127.0.0.1:8000
python -m uvicorn main:app --host 127.0.0.1 --port 8000

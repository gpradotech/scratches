@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo O Node.js precisa estar instalado. Consulte o README.md.
  pause
  exit /b 1
)
node --use-system-ca scripts/open-app.mjs
set "SCRATCHES_EXIT=%ERRORLEVEL%"
if not "%SCRATCHES_EXIT%"=="0" pause
exit /b %SCRATCHES_EXIT%

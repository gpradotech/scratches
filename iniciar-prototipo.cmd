@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo O Node.js precisa estar instalado. Consulte o README.md.
  pause
  exit /b 1
)
if exist ".git" (
  if not exist "node_modules\vite\bin\vite.js" (
    echo Abra um terminal nesta pasta e execute: npm ci
    pause
    exit /b 1
  )
  call npm run dev
  if errorlevel 1 pause
  exit /b
)
if not exist "app\dist\index.html" if not exist "node_modules\vite\bin\vite.js" (
  echo As dependencias ainda nao estao instaladas.
  echo Abra um terminal nesta pasta e execute: npm ci
  pause
  exit /b 1
)
echo.
echo Scratches
echo Abra http://127.0.0.1:5174 no navegador.
echo Use Ctrl+C para encerrar.
echo.
if not exist "app\dist\index.html" (
  call npm run build
  if errorlevel 1 (
    pause
    exit /b 1
  )
)
call npm start
if errorlevel 1 pause
endlocal

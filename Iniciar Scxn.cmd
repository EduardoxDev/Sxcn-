@echo off
setlocal
cd /d "%~dp0"
set "SCXN_NODE=node"
where node >nul 2>nul
if errorlevel 1 (
  set "SCXN_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
)
if not exist "server\dist\index.js" (
  echo Execute npm install e npm run build antes de iniciar.
  pause
  exit /b 1
)
set "NODE_ENV=production"
echo Scxn - abra http://localhost:3001 no navegador.
echo Mantenha esta janela aberta. Ctrl+C encerra o servidor.
"%SCXN_NODE%" server\dist\index.js
if errorlevel 1 pause

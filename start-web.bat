@echo off
setlocal
cd /d "%~dp0"

if not exist node_modules (
  echo Installing dependencies...
  call npm install
  if errorlevel 1 goto failed
)

echo Starting web server...
echo Open: http://localhost:5173/
call npm run dev
if errorlevel 1 goto failed

goto end

:failed
echo.
echo Startup failed. Please check Node.js, npm, or the error messages above.
pause

:end
endlocal

@echo off
setlocal
cd /d "%~dp0"

if not exist node_modules (
  echo 正在安装依赖...
  call npm install
  if errorlevel 1 goto failed
)

echo 正在启动网页服务器...
echo 打开地址：http://localhost:5173/
call npm run dev -- --host 0.0.0.0
if errorlevel 1 goto failed

goto end

:failed
echo.
echo 启动失败，请检查 Node.js、npm 或上方错误信息。
pause

:end
endlocal

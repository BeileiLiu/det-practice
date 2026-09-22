@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

set "DET_PORT=8787"
set "PYTHON_CMD="

where py >nul 2>nul
if not errorlevel 1 set "PYTHON_CMD=py"

if not defined PYTHON_CMD (
  where python >nul 2>nul
  if not errorlevel 1 set "PYTHON_CMD=python"
)

if not defined PYTHON_CMD (
  echo.
  echo 没有找到 Python，网站暂时无法启动。
  echo 请打开 https://www.python.org/downloads/ 安装 Python，
  echo 并在安装时勾选 Add Python to PATH。
  echo.
  pause
  exit /b 1
)

echo.
echo DET Path 正在启动……
echo 浏览器地址：http://127.0.0.1:%DET_PORT%
echo 请保留这个窗口；关闭窗口会停止网站。
echo.

start "" powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 1; Start-Process 'http://127.0.0.1:%DET_PORT%'"
%PYTHON_CMD% server.py %DET_PORT%

echo.
echo 网站已经停止。按任意键关闭窗口。
pause >nul

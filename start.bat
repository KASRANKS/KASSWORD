@echo off
setlocal
title Kassword MAINNET build - local preview
cd /d "%~dp0"
set "PORT=7852"

rem --- find a Python launcher (py, then python, then python3) ---
set "PY="
where py >nul 2>&1 && set "PY=py"
if not defined PY ( where python  >nul 2>&1 && set "PY=python" )
if not defined PY ( where python3 >nul 2>&1 && set "PY=python3" )

if not defined PY (
  echo.
  echo   Python 3 was not found on your PATH.
  echo   Install it from https://www.python.org/downloads/  ^(tick "Add python.exe to PATH"^),
  echo   then double-click this file again.
  echo.
  pause
  exit /b 1
)

echo.
echo   Starting Kassword MAINNET build on http://127.0.0.1:%PORT%/
echo   Network: Kaspa mainnet via the public-node resolver (api.kaspa.org + *.kaspa.stream).
echo   Leave this window open while you use it. Ctrl+C or close it to stop.
echo.

%PY% "%~dp0serve_nocache.py" %PORT%

echo.
echo   Server stopped.
pause
endlocal

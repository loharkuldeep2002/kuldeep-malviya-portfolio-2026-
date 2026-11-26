@echo off
cd /d "%~dp0"
echo ========================================================
echo  Starting Kuldeep Malviya Portfolio Web Server...
echo  URL: http://localhost:3000
echo  Press Ctrl+C to stop the server.
echo ========================================================
node server.js
pause

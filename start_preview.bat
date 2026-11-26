@echo off
cd /d "%~dp0"
echo Starting your portfolio preview...
node scripts\open-preview.js
if errorlevel 1 pause

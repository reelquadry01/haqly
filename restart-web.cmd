@echo off
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3001 ^| findstr LISTENING') do taskkill /PID %%a /F
if exist "C:\Users\USER\Documents\FINOVA-ERP\apps\web\.next" rmdir /s /q "C:\Users\USER\Documents\FINOVA-ERP\apps\web\.next"
start "erp-web" /MIN cmd /c "cd /d C:\Users\USER\Documents\FINOVA-ERP && npm run web:dev > C:\Users\USER\Documents\FINOVA-ERP\apps\web\web-dev.log 2>&1"

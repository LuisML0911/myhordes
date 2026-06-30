@echo off
REM Ejecuta Playwright UI en una nueva ventana y cierra el .bat
start /b cmd /c "node --max-old-space-size=32768 ./node_modules/playwright/cli.js test --ui"
exit
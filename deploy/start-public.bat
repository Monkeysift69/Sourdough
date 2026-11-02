@echo off
REM Starts the Sourdough Log on http://localhost:3000.
REM Public URL: https://sourdough.maxgunit.org  (route in the "chronos" Cloudflare tunnel)
REM The chronos connector must be running on this PC (Windows service, or `cloudflared tunnel run --token ...`).
cd /d "%~dp0.."
set NODE_ENV=production
npm.cmd start

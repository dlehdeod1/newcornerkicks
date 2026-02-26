@echo off
set NODE=C:\Users\dlehd\AppData\Roaming\fnm\node-versions\v24.13.0\installation\node.exe
set NPM_CLI=C:\Users\dlehd\AppData\Roaming\fnm\node-versions\v24.13.0\installation\node_modules\npm\bin\npm-cli.js
set PATH=C:\Users\dlehd\AppData\Roaming\fnm\node-versions\v24.13.0\installation;%PATH%

cd /d D:\newCornerKicks\web

echo === next-on-pages 설치 중 ===
"%NODE%" "%NPM_CLI%" install --save-dev @cloudflare/next-on-pages
echo 설치 결과: %errorlevel%
if %errorlevel% neq 0 goto :error
echo.

echo === WEB 빌드 중 (next-on-pages) ===
"%NODE%" ".\node_modules\.bin\next-on-pages" 2>&1
echo WEB 빌드 결과: %errorlevel%
if %errorlevel% neq 0 goto :error
echo.

echo === WEB 배포 중 (Cloudflare Pages) ===
"%NODE%" ".\node_modules\.bin\wrangler" pages deploy .vercel/output/static --project-name cornerkicks --commit-dirty=true
echo WEB 배포 결과: %errorlevel%
echo.
echo === WEB 배포 완료! ===
goto :end

:error
echo [오류] 실패. 로그 확인하세요.

:end

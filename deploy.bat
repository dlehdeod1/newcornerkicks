@echo off
set NODE_INSTALL=C:\Users\dlehd\AppData\Roaming\fnm\node-versions\v24.13.0\installation
set PATH=%NODE_INSTALL%;%PATH%

echo node:
"%NODE_INSTALL%\node.exe" --version
echo.

echo === [1/3] API 배포 중 (Cloudflare Worker) ===
cd /d D:\newCornerKicks\api
"%NODE_INSTALL%\node.exe" ".\node_modules\wrangler\bin\wrangler.js" deploy
echo API 배포 결과: %errorlevel%
if %errorlevel% neq 0 goto :apierror
echo.

echo === [2/3] WEB 빌드 중 (next-on-pages) ===
cd /d D:\newCornerKicks\web
"%NODE_INSTALL%\node.exe" "%NODE_INSTALL%\node_modules\npm\bin\npx-cli.js" @cloudflare/next-on-pages@1
echo WEB 빌드 결과: %errorlevel%
if %errorlevel% neq 0 goto :builderror
echo.

echo === [3/3] WEB 배포 중 (Cloudflare Pages) ===
"%NODE_INSTALL%\node.exe" "%NODE_INSTALL%\node_modules\npm\bin\npx-cli.js" wrangler pages deploy .vercel/output/static --project-name cornerkicks --commit-dirty=true
echo WEB 배포 결과: %errorlevel%
echo.
echo === 전체 배포 완료! ===
goto :end

:apierror
echo [오류] API 배포 실패
goto :end

:builderror
echo [오류] WEB 빌드 실패
goto :end

:end

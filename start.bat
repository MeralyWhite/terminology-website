@echo off
echo ================================
echo    术语管理系统启动脚本
echo ================================
echo.

REM 检查 Node.js 是否安装
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo 错误: 未检测到 Node.js，请先安装 Node.js
    echo 下载地址: https://nodejs.org/
    pause
    exit /b 1
)

echo 检测到 Node.js 版本:
node --version
echo.

REM 检查是否存在 node_modules
if not exist "node_modules" (
    echo 正在安装依赖包...
    npm install
    if %errorlevel% neq 0 (
        echo 错误: 依赖包安装失败
        pause
        exit /b 1
    )
    echo 依赖包安装完成！
    echo.
)

REM 检查是否存在数据库文件
if not exist "database.sqlite" (
    echo 检测到首次运行，正在初始化数据库...
    npm run init
    if %errorlevel% neq 0 (
        echo 错误: 数据库初始化失败
        pause
        exit /b 1
    )
    echo 数据库初始化完成！
    echo.
)

echo 正在启动服务器...
echo 服务器地址: http://localhost:3000
echo 按 Ctrl+C 停止服务器
echo.

npm start

pause

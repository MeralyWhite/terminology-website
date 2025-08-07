#!/bin/bash

# 术语管理系统快速部署脚本
# 适用于 Linux/macOS 系统

echo "================================"
echo "    术语管理系统部署脚本"
echo "================================"
echo

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "❌ 错误: 未检测到 Node.js"
    echo "请先安装 Node.js: https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js 版本: $(node --version)"

# 检查 Git
if ! command -v git &> /dev/null; then
    echo "❌ 错误: 未检测到 Git"
    echo "请先安装 Git: https://git-scm.com/"
    exit 1
fi

echo "✅ Git 版本: $(git --version)"
echo

# 安装依赖
echo "📦 正在安装依赖..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ 依赖安装失败"
    exit 1
fi

echo "✅ 依赖安装完成"
echo

# 检查数据库
if [ ! -f "database.sqlite" ]; then
    echo "🗄️ 正在初始化数据库..."
    npm run init
    
    if [ $? -ne 0 ]; then
        echo "❌ 数据库初始化失败"
        exit 1
    fi
    
    echo "✅ 数据库初始化完成"
else
    echo "✅ 数据库文件已存在"
fi

echo

# 检查环境变量文件
if [ ! -f ".env" ]; then
    echo "⚙️ 创建环境变量文件..."
    cp .env.example .env
    echo "📝 请编辑 .env 文件配置邮箱等信息"
    echo "   主要配置项："
    echo "   - EMAIL_USER: 您的QQ邮箱"
    echo "   - EMAIL_PASS: QQ邮箱授权码"
    echo "   - SESSION_SECRET: 随机密钥"
    echo
fi

# Git 初始化
if [ ! -d ".git" ]; then
    echo "🔧 初始化 Git 仓库..."
    git init
    git add .
    git commit -m "Initial commit: 术语管理系统"
    echo "✅ Git 仓库初始化完成"
    echo
    echo "📝 下一步："
    echo "1. 在 GitHub 创建新仓库"
    echo "2. 运行: git remote add origin <your-repo-url>"
    echo "3. 运行: git push -u origin main"
    echo
fi

# 启动服务器
echo "🚀 启动开发服务器..."
echo "服务器地址: http://localhost:3000"
echo "按 Ctrl+C 停止服务器"
echo

npm start

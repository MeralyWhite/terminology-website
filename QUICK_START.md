# 🚀 术语管理系统 - 快速开始指南

## 📋 项目概述

这是一个完整的术语管理系统，具有以下特点：
- **企业级用户管理**：管理员创建员工账户
- **登录监控**：IP追踪、地理位置定位、异常登录邮件通知
- **术语管理**：添加、编辑、删除、搜索术语
- **多语言支持**：中英文界面和术语
- **响应式设计**：支持桌面和移动设备

## ⚡ 5分钟快速部署

### 步骤1：本地测试（可选）

```bash
# 1. 安装依赖（如果遇到权限问题，请以管理员身份运行）
npm install

# 2. 初始化数据库
npm run init

# 3. 启动服务器
npm start

# 4. 访问 http://localhost:3000
```

### 步骤2：GitHub 仓库

1. 在 GitHub 创建新仓库 `terminology-website`
2. 设置为 **Public**（Render免费版要求）
3. 上传代码：

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/yourusername/terminology-website.git
git push -u origin main
```

### 步骤3：Render.com 部署

1. 访问 [render.com](https://render.com) 并用 GitHub 登录
2. 点击 **New +** → **Web Service**
3. 选择您的 `terminology-website` 仓库
4. 配置：
   - **Name**: `terminology-management-system`
   - **Build Command**: `npm install && npm run init`
   - **Start Command**: `npm start`

### 步骤4：环境变量配置

在 Render 的 Environment 页面添加：

```
NODE_ENV=production
SESSION_SECRET=your-random-secret-key-here
EMAIL_USER=your-email@qq.com
EMAIL_PASS=your-qq-authorization-code
ADMIN_EMAIL=z-2024@qq.com
```

**重要：**
- `EMAIL_PASS` 使用QQ邮箱授权码，不是QQ密码
- `SESSION_SECRET` 使用随机字符串

### 步骤5：获取QQ邮箱授权码

1. 登录QQ邮箱网页版
2. **设置** → **账户** → **POP3/IMAP/SMTP服务**
3. 开启 **IMAP/SMTP服务**
4. 获取 **授权码**

## 🎯 部署完成

部署成功后：
1. Render 会提供访问URL
2. 首次访问会自动创建管理员账户
3. 登录后可以开始添加术语和创建员工账户

## 📁 项目文件说明

```
terminology-website/
├── views/              # EJS模板文件
├── public/             # 静态资源
├── server.js          # 主服务器文件
├── init.js            # 数据库初始化
├── package.json       # 项目配置
├── render.yaml        # Render部署配置
├── .env.example       # 环境变量示例
├── DEPLOYMENT.md      # 详细部署指南
└── start.bat          # Windows启动脚本
```

## 🔧 常见问题

**Q: 部署失败怎么办？**
A: 检查 Render 的构建日志，确认所有环境变量配置正确

**Q: 邮件发送失败？**
A: 确认使用QQ邮箱授权码，不是QQ密码

**Q: 无法访问网站？**
A: 等待部署完成（通常5-10分钟），检查 Render 服务状态

**Q: 数据库问题？**
A: Render 会自动运行初始化脚本，如有问题查看应用日志

## 📞 获取帮助

- 📖 详细文档：查看 `DEPLOYMENT.md`
- 🐛 问题反馈：GitHub Issues
- 📧 技术支持：查看项目文档

## 🌟 功能特色

- ✅ **零配置部署**：一键部署到 Render.com
- ✅ **企业级安全**：登录监控、IP追踪
- ✅ **邮件通知**：异常登录自动通知
- ✅ **多语言支持**：中英文界面
- ✅ **响应式设计**：完美支持移动端
- ✅ **免费托管**：使用 Render.com 免费计划

开始使用您的术语管理系统吧！🎉

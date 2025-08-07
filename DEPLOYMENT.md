# 🚀 术语管理系统部署指南

本指南将详细介绍如何将术语管理系统部署到 Render.com 免费平台，并配置相关服务。

## 📋 部署前准备

### 1. 环境要求
- Node.js 16+
- Git
- GitHub 账户
- Render.com 账户
- QQ邮箱（用于邮件通知）

### 2. 本地测试

首先确保项目在本地环境正常运行：

```bash
# 克隆或下载项目
git clone <your-repository-url>
cd terminology-website

# 安装依赖
npm install

# 初始化数据库
npm run init

# 启动服务器
npm start
```

访问 `http://localhost:3000` 确保系统正常运行。

## 🔧 邮件服务配置

### 1. 获取QQ邮箱授权码

1. 登录QQ邮箱网页版
2. 点击 **设置** → **账户**
3. 找到 **POP3/IMAP/SMTP/Exchange/CardDAV/CalDAV服务**
4. 开启 **IMAP/SMTP服务**
5. 获取 **授权码**（不是QQ密码）

### 2. 配置环境变量

创建 `.env` 文件（基于 `.env.example`）：

```bash
# 邮件配置
EMAIL_USER=your-email@qq.com
EMAIL_PASS=your-authorization-code  # QQ邮箱授权码
ADMIN_EMAIL=z-2024@qq.com

# 其他配置
SESSION_SECRET=your-random-secret-key
NODE_ENV=production
```

## 📂 GitHub 仓库设置

### 1. 创建 GitHub 仓库

1. 登录 GitHub
2. 点击 **New repository**
3. 仓库名称：`terminology-website`
4. 设置为 **Public**（Render免费版需要公开仓库）
5. 点击 **Create repository**

### 2. 上传代码

```bash
# 初始化 Git 仓库
git init

# 添加远程仓库
git remote add origin https://github.com/yourusername/terminology-website.git

# 添加所有文件
git add .

# 提交代码
git commit -m "Initial commit: 术语管理系统"

# 推送到 GitHub
git push -u origin main
```

## 🌐 Render.com 部署

### 1. 注册 Render 账户

1. 访问 [render.com](https://render.com)
2. 使用 GitHub 账户注册/登录
3. 授权 Render 访问您的 GitHub 仓库

### 2. 创建 Web Service

1. 在 Render 控制台点击 **New +**
2. 选择 **Web Service**
3. 连接您的 GitHub 仓库 `terminology-website`
4. 配置如下：

**基本设置：**
- **Name**: `terminology-management-system`
- **Region**: `Singapore` (亚洲用户推荐)
- **Branch**: `main`
- **Runtime**: `Node`

**构建设置：**
- **Build Command**: `npm install && npm run init`
- **Start Command**: `npm start`

### 3. 环境变量配置

在 Render 控制台的 **Environment** 标签页添加：

```
NODE_ENV=production
SESSION_SECRET=your-random-secret-key-here
EMAIL_USER=your-email@qq.com
EMAIL_PASS=your-qq-authorization-code
ADMIN_EMAIL=z-2024@qq.com
PORT=10000
DATABASE_PATH=./database.sqlite
```

**重要提示：**
- `SESSION_SECRET`: 使用随机字符串，可以用在线生成器
- `EMAIL_PASS`: 使用QQ邮箱授权码，不是QQ密码
- 其他变量保持默认值

### 4. 部署

1. 点击 **Create Web Service**
2. Render 会自动开始构建和部署
3. 等待部署完成（通常需要5-10分钟）
4. 部署成功后会显示访问URL

## 🔍 部署验证

### 1. 访问测试

1. 打开 Render 提供的URL
2. 确认首页正常显示
3. 测试登录功能
4. 测试术语搜索功能

### 2. 管理员账户

首次部署后，系统会自动创建管理员账户：
- 用户名：在初始化时设置
- 密码：在初始化时设置
- 邮箱：在初始化时设置

### 3. 邮件通知测试

1. 使用不同IP登录测试异常登录通知
2. 检查管理员邮箱是否收到通知邮件

## 🛠 故障排除

### 常见问题

**1. 部署失败**
- 检查 `package.json` 中的依赖版本
- 确认 Node.js 版本兼容性
- 查看 Render 构建日志

**2. 数据库初始化失败**
- 检查 `init.js` 脚本
- 确认 SQLite 依赖正确安装
- 查看应用日志

**3. 邮件发送失败**
- 验证QQ邮箱授权码
- 检查邮箱服务是否开启
- 确认环境变量配置正确

**4. 会话问题**
- 检查 `SESSION_SECRET` 环境变量
- 确认会话配置正确

### 日志查看

在 Render 控制台：
1. 进入您的服务
2. 点击 **Logs** 标签
3. 查看实时日志和错误信息

## 🔄 更新部署

### 自动部署

Render 已配置自动部署，当您推送代码到 GitHub 时会自动更新：

```bash
# 修改代码后
git add .
git commit -m "更新描述"
git push origin main
```

### 手动部署

在 Render 控制台：
1. 进入您的服务
2. 点击 **Manual Deploy**
3. 选择 **Deploy latest commit**

## 🌟 优化建议

### 1. 域名配置

1. 在 Render 控制台添加自定义域名
2. 配置 DNS 记录
3. 启用 HTTPS（Render 自动提供）

### 2. 性能优化

- 启用 Gzip 压缩
- 配置 CDN（Cloudflare）
- 优化数据库查询

### 3. 监控设置

- 配置 Render 健康检查
- 设置邮件通知
- 监控应用性能

## 📞 技术支持

如果遇到问题：

1. **查看文档**: 检查 `README.md` 和 `USER_GUIDE.md`
2. **检查日志**: 查看 Render 应用日志
3. **GitHub Issues**: 在项目仓库提交问题
4. **Render 支持**: 访问 Render 帮助文档

## 🎉 部署完成

恭喜！您的术语管理系统已成功部署到 Render.com。

**下一步：**
1. 配置管理员账户
2. 添加术语数据
3. 创建员工账户
4. 测试所有功能

**访问地址：** `https://your-app-name.onrender.com`


// 术语管理系统 - 主服务器文件
// 这是一个完整的术语查询和管理系统，支持多用户协作

const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const session = require('express-session');
const bodyParser = require('body-parser');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const nodemailer = require('nodemailer');
const useragent = require('useragent');

const app = express();
const PORT = process.env.PORT || 3000;

// 邮件配置
const transporter = nodemailer.createTransport({
  service: 'qq',
  auth: {
    user: process.env.EMAIL_USER || 'your-email@qq.com',
    pass: process.env.EMAIL_PASS || 'your-email-password'
  }
});

// 管理员邮箱 - 从环境变量获取
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@example.com';

// 安全中间件
app.use(helmet());
app.use(cors());

// 速率限制 - 防止滥用
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 100 // 每个IP最多100个请求
});
app.use(limiter);

// 中间件配置
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// 设置视图引擎和路径
app.set('view engine', 'ejs');

// 设置视图目录 - 使用绝对路径确保在所有环境中都能找到
const viewsPath = path.resolve(__dirname, 'views');
app.set('views', viewsPath);

console.log('📁 视图配置:');
console.log('  - 工作目录:', process.cwd());
console.log('  - __dirname:', __dirname);
console.log('  - 视图路径:', viewsPath);
console.log('  - 视图目录存在:', fs.existsSync(viewsPath));

// 检查关键视图文件
const keyViews = ['index.ejs', 'login.ejs', 'dashboard.ejs'];
keyViews.forEach(view => {
    const viewFile = path.join(viewsPath, view);
    console.log(`  - ${view}:`, fs.existsSync(viewFile) ? '✓' : '✗');
});

// 会话配置
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: false, // 在 Render 等平台上设置为 false，因为内部通信可能是 HTTP
    maxAge: 24 * 60 * 60 * 1000, // 24小时
    httpOnly: true, // 防止 XSS 攻击
    sameSite: 'lax' // CSRF 保护
  }
}));

// 数据库初始化
const db = new sqlite3.Database(process.env.DATABASE_PATH || './database.sqlite');

// 创建数据库表
db.serialize(() => {
  // 用户表 - 管理员密码加密，员工密码明文
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    password_plain TEXT,
    role TEXT DEFAULT 'user',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME,
    last_login_ip TEXT,
    last_login_location TEXT,
    login_count INTEGER DEFAULT 0,
    is_online INTEGER DEFAULT 0,
    force_password_change INTEGER DEFAULT 0
  )`);

  // 术语表
  db.run(`CREATE TABLE IF NOT EXISTS terms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    term TEXT NOT NULL,
    definition TEXT NOT NULL,
    category TEXT,
    language TEXT DEFAULT 'zh',
    source TEXT,
    notes TEXT,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users (id)
  )`);

  // 术语翻译表（支持多语言）
  db.run(`CREATE TABLE IF NOT EXISTS term_translations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    term_id INTEGER,
    language TEXT NOT NULL,
    translation TEXT NOT NULL,
    definition TEXT,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (term_id) REFERENCES terms (id),
    FOREIGN KEY (created_by) REFERENCES users (id)
  )`);

  // 分类表
  db.run(`CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // 登录日志表
  db.run(`CREATE TABLE IF NOT EXISTS login_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    username TEXT,
    login_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    ip_address TEXT,
    location TEXT,
    user_agent TEXT,
    login_result TEXT,
    FOREIGN KEY (user_id) REFERENCES users (id)
  )`);

  // 活动日志表
  db.run(`CREATE TABLE IF NOT EXISTS activity_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    username TEXT,
    action TEXT,
    details TEXT,
    ip_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id)
  )`);

  // 创建默认管理员账户（安全版本）
  console.log('🔧 正在检查管理员账户...');

  // 检查是否已存在管理员账户
  db.get('SELECT * FROM users WHERE username = ? OR role = ?', ['admin', 'admin'], async (err, existingAdmin) => {
    if (err) {
      console.error('检查管理员账户失败:', err);
      return;
    }

    if (!existingAdmin) {
      try {
        // 从环境变量获取管理员密码，如果没有设置则使用默认密码
        const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
        const hashedPassword = await bcrypt.hash(adminPassword, 10);

        db.run(`INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)`,
          ['admin', ADMIN_EMAIL, hashedPassword, 'admin'], (err) => {
          if (err) {
            console.error('创建管理员账户失败:', err);
          } else {
            console.log('✅ 默认管理员账户创建成功');
            console.log('   用户名: admin');
            console.log('   密码: 请查看环境变量 ADMIN_PASSWORD');
            console.log('   邮箱:', ADMIN_EMAIL);
          }
        });
      } catch (error) {
        console.error('密码加密失败:', error);
      }
    } else {
      console.log('✅ 管理员账户已存在');
    }
  });
});

// 获取客户端真实IP地址
function getClientIP(req) {
  return req.headers['x-forwarded-for'] || 
         req.headers['x-real-ip'] || 
         req.connection.remoteAddress || 
         req.socket.remoteAddress ||
         (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
         '127.0.0.1';
}

// 获取IP地理位置信息（详细地址）
async function getLocationFromIP(ip) {
  try {
    // 如果是本地IP，返回默认位置
    if (ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
      return '本地网络';
    }

    // 使用免费的IP地理位置API（支持中文，更详细）
    const response = await axios.get(`http://ip-api.com/json/${ip}?lang=zh-CN&fields=status,message,country,regionName,city,district,zip,lat,lon,timezone,isp,org,as,query`);
    
    if (response.data.status === 'success') {
      const data = response.data;
      // 构建详细地址
      let location = '';
      if (data.country) location += data.country;
      if (data.regionName) location += data.regionName;
      if (data.city) location += data.city;
      if (data.district) location += data.district;
      
      // 添加ISP信息
      if (data.isp) location += ` (${data.isp})`;
      
      return location || '未知位置';
    } else {
      return '位置解析失败';
    }
  } catch (error) {
    console.error('获取地理位置失败:', error.message);
    return '位置解析失败';
  }
}

// 发送异常登录邮件通知
async function sendAbnormalLoginAlert(username, ip, location, reason) {
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER || 'system@terminology.com',
      to: ADMIN_EMAIL,
      subject: `[术语系统] 异常登录提醒 - ${username}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #e74c3c;">🚨 异常登录提醒</h2>
          <div style="background: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <p><strong>用户名:</strong> ${username}</p>
            <p><strong>IP地址:</strong> ${ip}</p>
            <p><strong>登录位置:</strong> ${location}</p>
            <p><strong>异常原因:</strong> ${reason}</p>
            <p><strong>时间:</strong> ${new Date().toLocaleString('zh-CN')}</p>
          </div>
          <p style="color: #666;">请及时检查该账户的安全状况。</p>
          <hr>
          <p style="font-size: 12px; color: #999;">此邮件由术语管理系统自动发送</p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log(`异常登录邮件已发送: ${username} from ${location}`);
  } catch (error) {
    console.error('发送邮件失败:', error.message);
  }
}

// 记录登录日志
async function logLogin(userId, username, ip, location, userAgent, result) {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO login_logs (user_id, username, ip_address, location, user_agent, login_result) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, username, ip, location, userAgent, result],
      function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      }
    );
  });
}

// 记录用户活动
async function logActivity(userId, username, action, details, ip) {
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO activity_logs (user_id, username, action, details, ip_address) VALUES (?, ?, ?, ?, ?)',
      [userId, username, action, details, ip],
      function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      }
    );
  });
}
// 认证中间件
function requireAuth(req, res, next) {
  if (req.session.userId) {
    next();
  } else {
    res.redirect('/login');
  }
}

// 管理员权限中间件
function requireAdmin(req, res, next) {
  if (req.session.userId && req.session.userRole === 'admin') {
    next();
  } else {
    res.status(403).send('需要管理员权限');
  }
}

// 路由定义

// 首页 - 术语搜索
app.get('/', (req, res) => {
  const searchQuery = req.query.q || '';
  const category = req.query.category || '';
  const language = req.query.lang || 'zh';
  
  let sql = `
    SELECT t.*, u.username as creator, c.name as category_name
    FROM terms t
    LEFT JOIN users u ON t.created_by = u.id
    LEFT JOIN categories c ON t.category = c.name
    WHERE 1=1
  `;
  const params = [];

  if (searchQuery) {
    sql += ` AND (t.term LIKE ? OR t.definition LIKE ?)`;
    params.push(`%${searchQuery}%`, `%${searchQuery}%`);
  }

  if (category) {
    sql += ` AND t.category = ?`;
    params.push(category);
  }

  if (language) {
    sql += ` AND t.language = ?`;
    params.push(language);
  }

  sql += ` ORDER BY t.updated_at DESC LIMIT 50`;

  db.all(sql, params, (err, terms) => {
    if (err) {
      console.error(err);
      return res.status(500).send('数据库错误');
    }

    // 获取所有分类
    db.all('SELECT DISTINCT name FROM categories ORDER BY name', (err, categories) => {
      if (err) {
        console.error(err);
        categories = [];
      }

      // 渲染主页
      const user = req.session.userId ? {
        id: req.session.userId,
        username: req.session.username,
        role: req.session.userRole
      } : null;

      try {
        res.render('index', {
          terms,
          categories,
          searchQuery,
          selectedCategory: category,
          selectedLanguage: language,
          user
        });
      } catch (renderError) {
        console.error('渲染 index.ejs 时出错:', renderError);

        // 如果渲染失败，返回简单的 HTML 页面
        res.send(`
          <!DOCTYPE html>
          <html lang="zh-CN">
          <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>术语查询系统</title>
              <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
          </head>
          <body>
              <div class="container mt-5">
                  <h1 class="text-center">术语查询系统</h1>
                  <div class="alert alert-warning">
                      <h4>系统正在维护中</h4>
                      <p>视图渲染出现问题，请稍后再试。</p>
                      <p><strong>错误信息:</strong> ${renderError.message}</p>
                      <p><strong>视图路径:</strong> ${app.get('views')}</p>
                  </div>
                  <div class="text-center">
                      <a href="/test" class="btn btn-primary">系统诊断</a>
                  </div>
              </div>
          </body>
          </html>
        `);
      }
    });
  });
});

// 登录页面
app.get('/login', (req, res) => {
  res.render('login', { error: null });
});

// 登录处理 - 增强版本，支持IP监控和异常检测
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const clientIP = getClientIP(req);
  const userAgent = req.headers['user-agent'] || '';
  
  try {
    // 获取地理位置
    const location = await getLocationFromIP(clientIP);
    
    // 查找用户
    db.get('SELECT * FROM users WHERE username = ? OR email = ?', [username, username], async (err, user) => {
      if (err) {
        console.error(err);
        await logLogin(null, username, clientIP, location, userAgent, '系统错误');
        return res.render('login', { error: '系统错误' });
      }

      if (!user) {
        await logLogin(null, username, clientIP, location, userAgent, '用户不存在');
        return res.render('login', { error: '用户名或密码错误' });
      }

      let passwordMatch = false;
      
      // 管理员密码验证（加密）
      if (user.role === 'admin') {
        try {
          passwordMatch = await bcrypt.compare(password, user.password);
        } catch (bcryptErr) {
          console.error('密码验证错误:', bcryptErr);
          await logLogin(user.id, user.username, clientIP, location, userAgent, '密码验证失败');
          return res.render('login', { error: '系统错误' });
        }
      } else {
        // 员工密码验证（明文）
        passwordMatch = (password === user.password_plain);
      }

      if (!passwordMatch) {
        await logLogin(user.id, user.username, clientIP, location, userAgent, '密码错误');
        return res.render('login', { error: '用户名或密码错误' });
      }

      // 检查异常登录
      let isAbnormal = false;
      let abnormalReason = '';

      // 检查是否从新位置登录
      if (user.last_login_location && user.last_login_location !== location) {
        isAbnormal = true;
        abnormalReason = `从新位置登录: ${location} (上次: ${user.last_login_location})`;
      }

      // 检查是否从新IP登录
      if (user.last_login_ip && user.last_login_ip !== clientIP) {
        if (!isAbnormal) {
          isAbnormal = true;
          abnormalReason = `从新IP登录: ${clientIP} (上次: ${user.last_login_ip})`;
        }
      }

      // 如果是异常登录，发送邮件通知
      if (isAbnormal && user.role !== 'admin') {
        await sendAbnormalLoginAlert(user.username, clientIP, location, abnormalReason);
      }

      // 登录成功
      req.session.userId = user.id;
      req.session.username = user.username;
      req.session.userRole = user.role;

      // 更新用户登录信息
      db.run(`
        UPDATE users 
        SET last_login = CURRENT_TIMESTAMP, 
            last_login_ip = ?, 
            last_login_location = ?, 
            login_count = login_count + 1,
            is_online = 1
        WHERE id = ?
      `, [clientIP, location, user.id]);

      // 记录成功登录日志
      await logLogin(user.id, user.username, clientIP, location, userAgent, '登录成功');
      await logActivity(user.id, user.username, '用户登录', `从 ${location} 登录`, clientIP);

      // 检查是否需要强制修改密码
      if (user.force_password_change === 1 && user.role !== 'admin') {
        res.redirect('/change-password?first=1');
      } else {
        res.redirect('/dashboard');
      }
    });
  } catch (error) {
    console.error('登录处理错误:', error);
    res.render('login', { error: '系统错误，请稍后重试' });
  }
});

// 移除公开注册功能 - 只允许管理员创建用户账户

// 用户仪表板
app.get('/dashboard', requireAuth, (req, res) => {
  // 获取用户创建的术语统计
  db.get('SELECT COUNT(*) as count FROM terms WHERE created_by = ?', [req.session.userId], (err, result) => {
    if (err) {
      console.error(err);
      return res.status(500).send('数据库错误');
    }

    const userTermsCount = result.count;

    // 获取最近的术语
    db.all(`
      SELECT t.*, c.name as category_name 
      FROM terms t 
      LEFT JOIN categories c ON t.category = c.name 
      WHERE t.created_by = ? 
      ORDER BY t.updated_at DESC 
      LIMIT 10
    `, [req.session.userId], (err, recentTerms) => {
      if (err) {
        console.error(err);
        recentTerms = [];
      }

      res.render('dashboard', {
        user: {
          id: req.session.userId,
          username: req.session.username,
          role: req.session.userRole
        },
        userTermsCount,
        recentTerms
      });
    });
  });
});
// 添加术语页面
app.get('/add-term', requireAuth, (req, res) => {
  // 获取所有分类
  db.all('SELECT * FROM categories ORDER BY name', (err, categories) => {
    if (err) {
      console.error(err);
      categories = [];
    }
    res.render('add-term', { 
      user: {
        id: req.session.userId,
        username: req.session.username,
        role: req.session.userRole
      },
      categories,
      error: null,
      success: null
    });
  });
});

// 添加术语处理
app.post('/add-term', requireAuth, (req, res) => {
  const { term, definition, category, language, source, notes } = req.body;

  if (!term || !definition) {
    return res.render('add-term', { 
      error: '术语和定义是必填项',
      success: null,
      categories: [],
      user: {
        id: req.session.userId,
        username: req.session.username,
        role: req.session.userRole
      }
    });
  }

  db.run(`
    INSERT INTO terms (term, definition, category, language, source, notes, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [term, definition, category || null, language || 'zh', source || null, notes || null, req.session.userId], 
  function(err) {
    if (err) {
      console.error(err);
      return res.render('add-term', { 
        error: '添加术语失败',
        success: null,
        categories: [],
        user: {
          id: req.session.userId,
          username: req.session.username,
          role: req.session.userRole
        }
      });
    }

    res.redirect('/dashboard?success=术语添加成功');
  });
});

// 编辑术语页面
app.get('/edit-term/:id', requireAuth, (req, res) => {
  const termId = req.params.id;

  db.get('SELECT * FROM terms WHERE id = ?', [termId], (err, term) => {
    if (err) {
      console.error(err);
      return res.status(500).send('数据库错误');
    }

    if (!term) {
      return res.status(404).send('术语不存在');
    }

    // 检查权限：只有创建者或管理员可以编辑
    if (term.created_by !== req.session.userId && req.session.userRole !== 'admin') {
      return res.status(403).send('没有权限编辑此术语');
    }

    // 获取所有分类
    db.all('SELECT * FROM categories ORDER BY name', (err, categories) => {
      if (err) {
        console.error(err);
        categories = [];
      }

      res.render('edit-term', {
        term,
        categories,
        user: {
          id: req.session.userId,
          username: req.session.username,
          role: req.session.userRole
        },
        error: null,
        success: null
      });
    });
  });
});

// 编辑术语处理
app.post('/edit-term/:id', requireAuth, (req, res) => {
  const termId = req.params.id;
  const { term, definition, category, language, source, notes } = req.body;

  if (!term || !definition) {
    return res.redirect(`/edit-term/${termId}?error=术语和定义是必填项`);
  }

  // 检查权限
  db.get('SELECT created_by FROM terms WHERE id = ?', [termId], (err, termData) => {
    if (err) {
      console.error(err);
      return res.status(500).send('数据库错误');
    }

    if (!termData) {
      return res.status(404).send('术语不存在');
    }

    if (termData.created_by !== req.session.userId && req.session.userRole !== 'admin') {
      return res.status(403).send('没有权限编辑此术语');
    }

    // 更新术语
    db.run(`
      UPDATE terms 
      SET term = ?, definition = ?, category = ?, language = ?, source = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [term, definition, category || null, language || 'zh', source || null, notes || null, termId], 
    function(err) {
      if (err) {
        console.error(err);
        return res.redirect(`/edit-term/${termId}?error=更新失败`);
      }

      res.redirect('/dashboard?success=术语更新成功');
    });
  });
});

// 删除术语
app.post('/delete-term/:id', requireAuth, (req, res) => {
  const termId = req.params.id;

  // 检查权限
  db.get('SELECT created_by FROM terms WHERE id = ?', [termId], (err, term) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: '数据库错误' });
    }

    if (!term) {
      return res.status(404).json({ error: '术语不存在' });
    }

    if (term.created_by !== req.session.userId && req.session.userRole !== 'admin') {
      return res.status(403).json({ error: '没有权限删除此术语' });
    }

    // 删除术语
    db.run('DELETE FROM terms WHERE id = ?', [termId], function(err) {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: '删除失败' });
      }

      res.json({ success: true });
    });
  });
});

// 管理员面板 - 增强版本
app.get('/admin', requireAdmin, (req, res) => {
  // 获取统计信息
  db.get('SELECT COUNT(*) as userCount FROM users', (err, userStats) => {
    if (err) {
      console.error(err);
      userStats = { userCount: 0 };
    }

    db.get('SELECT COUNT(*) as termCount FROM terms', (err, termStats) => {
      if (err) {
        console.error(err);
        termStats = { termCount: 0 };
      }

      db.get('SELECT COUNT(*) as categoryCount FROM categories', (err, categoryStats) => {
        if (err) {
          console.error(err);
          categoryStats = { categoryCount: 0 };
        }

        // 获取在线用户数
        db.get('SELECT COUNT(*) as onlineCount FROM users WHERE is_online = 1', (err, onlineStats) => {
          if (err) {
            console.error(err);
            onlineStats = { onlineCount: 0 };
          }

          res.render('admin', {
            user: {
              id: req.session.userId,
              username: req.session.username,
              role: req.session.userRole
            },
            stats: {
              users: userStats.userCount,
              terms: termStats.termCount,
              categories: categoryStats.categoryCount,
              online: onlineStats.onlineCount
            }
          });
        });
      });
    });
  });
});

// 管理员 - 用户管理页面
app.get('/admin/users', requireAdmin, (req, res) => {
  db.all(`
    SELECT id, username, email, password_plain, role, created_at, 
           last_login, last_login_ip, last_login_location, login_count, is_online
    FROM users 
    ORDER BY created_at DESC
  `, (err, users) => {
    if (err) {
      console.error(err);
      return res.status(500).send('数据库错误');
    }

    res.render('admin-users', {
      user: {
        id: req.session.userId,
        username: req.session.username,
        role: req.session.userRole
      },
      users: users
    });
  });
});// 管理员 - 创建用户
app.post('/admin/create-user', requireAdmin, async (req, res) => {
  const { username, email, password, role } = req.body;
  const clientIP = getClientIP(req);

  if (!username || !email || !password) {
    return res.status(400).json({ error: '请填写所有必填字段' });
  }

  try {
    // 检查用户名和邮箱是否已存在
    const existingUser = await new Promise((resolve, reject) => {
      db.get('SELECT id FROM users WHERE username = ? OR email = ?', [username, email], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (existingUser) {
      return res.status(400).json({ error: '用户名或邮箱已存在' });
    }

    // 创建用户
    const userRole = role || 'user';
    let hashedPassword = '';
    let plainPassword = '';

    if (userRole === 'admin') {
      // 管理员密码加密存储
      hashedPassword = await bcrypt.hash(password, 10);
    } else {
      // 员工密码明文存储
      plainPassword = password;
      hashedPassword = await bcrypt.hash('temp-password', 10); // 临时加密密码
    }

    const userId = await new Promise((resolve, reject) => {
      db.run(`
        INSERT INTO users (username, email, password, password_plain, role, force_password_change) 
        VALUES (?, ?, ?, ?, ?, ?)
      `, [username, email, hashedPassword, plainPassword, userRole, userRole === 'user' ? 1 : 0], function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      });
    });

    // 记录管理员操作
    await logActivity(req.session.userId, req.session.username, '创建用户', `创建了用户: ${username} (${userRole})`, clientIP);

    res.json({ 
      success: true, 
      message: '用户创建成功',
      user: {
        id: userId,
        username: username,
        email: email,
        role: userRole,
        password: userRole === 'user' ? plainPassword : '(加密存储)'
      }
    });
  } catch (error) {
    console.error('创建用户失败:', error);
    res.status(500).json({ error: '创建用户失败' });
  }
});

// 管理员 - 重置用户密码
app.post('/admin/reset-password', requireAdmin, async (req, res) => {
  const { userId, newPassword } = req.body;
  const clientIP = getClientIP(req);

  if (!userId || !newPassword) {
    return res.status(400).json({ error: '请提供用户ID和新密码' });
  }

  try {
    // 获取用户信息
    const user = await new Promise((resolve, reject) => {
      db.get('SELECT username, role FROM users WHERE id = ?', [userId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }

    // 更新密码
    if (user.role === 'admin') {
      // 管理员密码加密存储
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await new Promise((resolve, reject) => {
        db.run('UPDATE users SET password = ?, force_password_change = 0 WHERE id = ?', 
          [hashedPassword, userId], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    } else {
      // 员工密码明文存储
      await new Promise((resolve, reject) => {
        db.run('UPDATE users SET password_plain = ?, force_password_change = 1 WHERE id = ?', 
          [newPassword, userId], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }

    // 记录管理员操作
    await logActivity(req.session.userId, req.session.username, '重置密码', `重置了用户 ${user.username} 的密码`, clientIP);

    res.json({ success: true, message: '密码重置成功' });
  } catch (error) {
    console.error('重置密码失败:', error);
    res.status(500).json({ error: '重置密码失败' });
  }
});

// 管理员 - 登录日志
app.get('/admin/login-logs', requireAdmin, (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = 50;
  const offset = (page - 1) * limit;

  db.all(`
    SELECT * FROM login_logs 
    ORDER BY login_time DESC 
    LIMIT ? OFFSET ?
  `, [limit, offset], (err, logs) => {
    if (err) {
      console.error(err);
      return res.status(500).send('数据库错误');
    }

    res.render('admin-logs', {
      user: {
        id: req.session.userId,
        username: req.session.username,
        role: req.session.userRole
      },
      logs: logs,
      currentPage: page
    });
  });
});

// 管理员 - 活动日志
app.get('/admin/activity-logs', requireAdmin, (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = 50;
  const offset = (page - 1) * limit;

  db.all(`
    SELECT * FROM activity_logs 
    ORDER BY created_at DESC 
    LIMIT ? OFFSET ?
  `, [limit, offset], (err, logs) => {
    if (err) {
      console.error(err);
      return res.status(500).send('数据库错误');
    }

    res.render('admin-activity', {
      user: {
        id: req.session.userId,
        username: req.session.username,
        role: req.session.userRole
      },
      logs: logs,
      currentPage: page
    });
  });
});

// API路由 - 搜索建议
app.get('/api/search', (req, res) => {
  const query = req.query.q || '';
  const limit = parseInt(req.query.limit) || 10;

  if (!query || query.length < 2) {
    return res.json([]);
  }

  db.all(`
    SELECT term, definition 
    FROM terms 
    WHERE term LIKE ? OR definition LIKE ? 
    ORDER BY term 
    LIMIT ?
  `, [`%${query}%`, `%${query}%`, limit], (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: '搜索失败' });
    }

    res.json(results);
  });
});

// 注销 - 更新在线状态
app.post('/logout', async (req, res) => {
  if (req.session.userId) {
    // 更新用户离线状态
    db.run('UPDATE users SET is_online = 0 WHERE id = ?', [req.session.userId]);
    
    // 记录登出活动
    const clientIP = getClientIP(req);
    await logActivity(req.session.userId, req.session.username, '用户登出', '用户退出系统', clientIP);
  }

  req.session.destroy((err) => {
    if (err) {
      console.error(err);
    }
    res.redirect('/');
  });
});

// 系统诊断页面
app.get('/test', (req, res) => {
    const viewsDir = app.get('views');
    let viewsContent = '目录不存在';

    if (fs.existsSync(viewsDir)) {
        try {
            viewsContent = fs.readdirSync(viewsDir).map(file => {
                const filePath = path.join(viewsDir, file);
                const stats = fs.statSync(filePath);
                return `${file} (${stats.size} bytes, ${stats.mtime.toISOString()})`;
            }).join('\n');
        } catch (err) {
            viewsContent = `读取目录出错: ${err.message}`;
        }
    }

    res.send(`
        <!DOCTYPE html>
        <html lang="zh-CN">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>系统诊断 - 术语管理系统</title>
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
        </head>
        <body>
            <div class="container mt-4">
                <h1 class="mb-4">🔧 系统诊断</h1>

                <div class="row">
                    <div class="col-md-6">
                        <div class="card">
                            <div class="card-header">
                                <h5>📁 路径信息</h5>
                            </div>
                            <div class="card-body">
                                <p><strong>当前工作目录:</strong><br><code>${process.cwd()}</code></p>
                                <p><strong>__dirname:</strong><br><code>${__dirname}</code></p>
                                <p><strong>视图路径:</strong><br><code>${viewsDir}</code></p>
                                <p><strong>Node.js 版本:</strong> ${process.version}</p>
                                <p><strong>平台:</strong> ${process.platform}</p>
                            </div>
                        </div>
                    </div>

                    <div class="col-md-6">
                        <div class="card">
                            <div class="card-header">
                                <h5>📄 视图文件</h5>
                            </div>
                            <div class="card-body">
                                <p><strong>视图目录存在:</strong> ${fs.existsSync(viewsDir) ? '✅ 是' : '❌ 否'}</p>
                                <p><strong>目录内容:</strong></p>
                                <pre style="background: #f8f9fa; padding: 10px; border-radius: 4px; font-size: 12px;">${viewsContent}</pre>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="mt-4">
                    <a href="/" class="btn btn-primary">返回首页</a>
                    <span class="text-muted ms-3">诊断时间: ${new Date().toISOString()}</span>
                </div>
            </div>
        </body>
        </html>
    `);
});

// 404处理
app.use((req, res) => {
  res.status(404).send(`
    <div style="text-align: center; padding: 50px; font-family: Arial, sans-serif;">
      <h1>404 - 页面未找到</h1>
      <p>您访问的页面不存在</p>
      <a href="/" style="color: #007bff; text-decoration: none;">返回首页</a>
    </div>
  `);
});

// 错误处理
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send(`
    <div style="text-align: center; padding: 50px; font-family: Arial, sans-serif;">
      <h1>500 - 服务器错误</h1>
      <p>服务器遇到了一个错误</p>
      <a href="/" style="color: #007bff; text-decoration: none;">返回首页</a>
    </div>
  `);
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`
===========================================
🚀 术语管理系统启动成功！
===========================================
📍 访问地址: http://localhost:${PORT}
📊 环境: ${process.env.NODE_ENV || 'development'}
📧 管理员邮箱: ${ADMIN_EMAIL}
🔧 系统诊断: http://localhost:${PORT}/test
===========================================
  `);

  console.log('✅ 数据库表已创建，管理员账户检查已完成');
});

// 优雅关闭
process.on('SIGINT', () => {
  console.log('\n正在关闭服务器...');
  db.close((err) => {
    if (err) {
      console.error('关闭数据库连接时出错:', err.message);
    } else {
      console.log('数据库连接已关闭');
    }
    process.exit(0);
  });
});


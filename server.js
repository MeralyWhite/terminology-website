// 术语管理系统 - 主服务器文件
// 修复版本 - 解决视图路径问题

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

// 管理员邮箱
const ADMIN_EMAIL = 'z-2024@qq.com';

// 安全中间件
app.use(helmet());
app.use(cors());

// 速率限制
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use(limiter);

// 中间件配置
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// 视图引擎配置 - 修复版本
app.set('view engine', 'ejs');
const viewsPath = path.resolve(__dirname, 'views');
app.set('views', viewsPath);

console.log('📁 视图配置:');
console.log('  - 工作目录:', process.cwd());
console.log('  - __dirname:', __dirname);
console.log('  - 视图路径:', viewsPath);
console.log('  - 视图目录存在:', fs.existsSync(viewsPath));

// 会话配置
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000
  }
}));

// 数据库初始化
const db = new sqlite3.Database('terminology.db');

function initializeDatabase() {
  console.log('🗄️ 正在初始化数据库...');
  
  // 用户表
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'user',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME,
    is_active BOOLEAN DEFAULT 1,
    profile_data TEXT
  )`);

  // 术语表
  db.run(`CREATE TABLE IF NOT EXISTS terms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    term TEXT NOT NULL,
    definition TEXT NOT NULL,
    category_id INTEGER,
    language TEXT DEFAULT 'zh',
    source TEXT,
    examples TEXT,
    synonyms TEXT,
    antonyms TEXT,
    difficulty_level INTEGER DEFAULT 1,
    usage_frequency INTEGER DEFAULT 0,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_approved BOOLEAN DEFAULT 0,
    tags TEXT,
    pronunciation TEXT,
    etymology TEXT,
    related_terms TEXT,
    FOREIGN KEY (category_id) REFERENCES categories (id),
    FOREIGN KEY (created_by) REFERENCES users (id)
  )`);

  // 分类表
  db.run(`CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    parent_id INTEGER,
    color TEXT DEFAULT '#007bff',
    icon TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_id) REFERENCES categories (id)
  )`);

  // 用户活动日志表
  db.run(`CREATE TABLE IF NOT EXISTS user_activities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    action TEXT NOT NULL,
    target_type TEXT,
    target_id INTEGER,
    details TEXT,
    ip_address TEXT,
    user_agent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id)
  )`);

  // 术语评分表
  db.run(`CREATE TABLE IF NOT EXISTS term_ratings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    term_id INTEGER,
    user_id INTEGER,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (term_id) REFERENCES terms (id),
    FOREIGN KEY (user_id) REFERENCES users (id),
    UNIQUE(term_id, user_id)
  )`);

  // 收藏表
  db.run(`CREATE TABLE IF NOT EXISTS favorites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    term_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id),
    FOREIGN KEY (term_id) REFERENCES terms (id),
    UNIQUE(user_id, term_id)
  )`);

  // 学习进度表
  db.run(`CREATE TABLE IF NOT EXISTS learning_progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    term_id INTEGER,
    mastery_level INTEGER DEFAULT 0,
    last_reviewed DATETIME,
    review_count INTEGER DEFAULT 0,
    correct_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id),
    FOREIGN KEY (term_id) REFERENCES terms (id),
    UNIQUE(user_id, term_id)
  )`);

  // 插入默认分类
  db.run(`INSERT OR IGNORE INTO categories (name, description, color, icon) VALUES 
    ('计算机科学', '计算机科学相关术语', '#007bff', 'fas fa-laptop-code'),
    ('数学', '数学相关术语', '#28a745', 'fas fa-calculator'),
    ('物理学', '物理学相关术语', '#dc3545', 'fas fa-atom'),
    ('化学', '化学相关术语', '#ffc107', 'fas fa-flask'),
    ('生物学', '生物学相关术语', '#17a2b8', 'fas fa-dna'),
    ('医学', '医学相关术语', '#6f42c1', 'fas fa-heartbeat'),
    ('工程学', '工程学相关术语', '#fd7e14', 'fas fa-cogs'),
    ('经济学', '经济学相关术语', '#20c997', 'fas fa-chart-line'),
    ('法律', '法律相关术语', '#6c757d', 'fas fa-balance-scale'),
    ('语言学', '语言学相关术语', '#e83e8c', 'fas fa-language')`);

  // 创建管理员账户
  const adminPassword = bcrypt.hashSync('admin123', 10);
  db.run(`INSERT OR IGNORE INTO users (username, email, password, role) VALUES (?, ?, ?, ?)`,
    ['admin', ADMIN_EMAIL, adminPassword, 'admin']);

  console.log('✅ 数据库初始化完成');
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

// 记录用户活动
function logActivity(userId, action, targetType = null, targetId = null, details = null, req = null) {
  const ipAddress = req ? req.ip : null;
  const userAgent = req ? req.get('User-Agent') : null;
  
  db.run(`INSERT INTO user_activities (user_id, action, target_type, target_id, details, ip_address, user_agent) 
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [userId, action, targetType, targetId, details, ipAddress, userAgent]);
}

// 安全渲染函数 - 防止视图错误
function safeRender(res, view, data = {}) {
  try {
    res.render(view, data);
  } catch (error) {
    console.error(`渲染 ${view} 时出错:`, error);
    res.status(500).send(`
      <!DOCTYPE html>
      <html lang="zh-CN">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>系统错误 - 术语管理系统</title>
          <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
      </head>
      <body>
          <div class="container mt-5">
              <div class="alert alert-danger">
                  <h4>🚫 系统错误</h4>
                  <p>视图渲染失败，请联系管理员。</p>
                  <p><strong>错误:</strong> ${error.message}</p>
                  <div class="mt-3">
                      <a href="/" class="btn btn-primary">返回首页</a>
                      <a href="/test" class="btn btn-secondary">系统诊断</a>
                  </div>
              </div>
          </div>
      </body>
      </html>
    `);
  }
}

// ==================== 路由定义 ====================

// 系统诊断页面
app.get('/test', (req, res) => {
    const viewsDir = app.get('views');
    let viewsContent = '目录不存在';

    if (fs.existsSync(viewsDir)) {
        try {
            viewsContent = fs.readdirSync(viewsDir).map(file => {
                const filePath = path.join(viewsDir, file);
                const stats = fs.statSync(filePath);
                return `${file} (${stats.size} bytes)`;
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
            <title>系统诊断</title>
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
        </head>
        <body>
            <div class="container mt-4">
                <h1>🔧 系统诊断</h1>
                <div class="row">
                    <div class="col-md-6">
                        <div class="card">
                            <div class="card-header"><h5>📁 路径信息</h5></div>
                            <div class="card-body">
                                <p><strong>工作目录:</strong><br><code>${process.cwd()}</code></p>
                                <p><strong>__dirname:</strong><br><code>${__dirname}</code></p>
                                <p><strong>视图路径:</strong><br><code>${viewsDir}</code></p>
                                <p><strong>Node.js:</strong> ${process.version}</p>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="card">
                            <div class="card-header"><h5>📄 视图文件</h5></div>
                            <div class="card-body">
                                <p><strong>目录存在:</strong> ${fs.existsSync(viewsDir) ? '✅' : '❌'}</p>
                                <pre style="background: #f8f9fa; padding: 10px;">${viewsContent}</pre>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="mt-4">
                    <a href="/" class="btn btn-primary">返回首页</a>
                </div>
            </div>
        </body>
        </html>
    `);
});

// 主页 - 术语查询
app.get('/', (req, res) => {
  const searchQuery = req.query.q || '';
  const category = req.query.category || '';
  const language = req.query.language || '';
  const page = parseInt(req.query.page) || 1;
  const limit = 20;
  const offset = (page - 1) * limit;

  let sql = `SELECT t.*, c.name as category_name, c.color as category_color,
             u.username as created_by_username,
             AVG(tr.rating) as avg_rating,
             COUNT(tr.rating) as rating_count
             FROM terms t
             LEFT JOIN categories c ON t.category_id = c.id
             LEFT JOIN users u ON t.created_by = u.id
             LEFT JOIN term_ratings tr ON t.id = tr.term_id
             WHERE t.is_approved = 1`;

  let params = [];

  if (searchQuery) {
    sql += ` AND (t.term LIKE ? OR t.definition LIKE ? OR t.tags LIKE ?)`;
    const searchPattern = `%${searchQuery}%`;
    params.push(searchPattern, searchPattern, searchPattern);
  }

  if (category) {
    sql += ` AND c.name = ?`;
    params.push(category);
  }

  if (language) {
    sql += ` AND t.language = ?`;
    params.push(language);
  }

  sql += ` GROUP BY t.id ORDER BY t.usage_frequency DESC, t.created_at DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

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

      const user = req.session.userId ? {
        id: req.session.userId,
        username: req.session.username,
        role: req.session.userRole
      } : null;

      safeRender(res, 'index', {
        terms,
        categories,
        searchQuery,
        selectedCategory: category,
        selectedLanguage: language,
        user
      });
    });
  });
});

// 登录页面
app.get('/login', (req, res) => {
  if (req.session.userId) {
    return res.redirect('/dashboard');
  }
  safeRender(res, 'login', { error: null });
});

// 登录处理
app.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return safeRender(res, 'login', { error: '请输入用户名和密码' });
  }

  db.get('SELECT * FROM users WHERE username = ? AND is_active = 1', [username], (err, user) => {
    if (err) {
      console.error(err);
      return safeRender(res, 'login', { error: '系统错误，请稍后重试' });
    }

    if (!user || !bcrypt.compareSync(password, user.password)) {
      return safeRender(res, 'login', { error: '用户名或密码错误' });
    }

    // 设置会话
    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.userRole = user.role;

    // 更新最后登录时间
    db.run('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);

    // 记录登录活动
    logActivity(user.id, 'login', null, null, null, req);

    res.redirect('/dashboard');
  });
});

// 注销
app.post('/logout', (req, res) => {
  if (req.session.userId) {
    logActivity(req.session.userId, 'logout', null, null, null, req);
  }
  req.session.destroy();
  res.redirect('/');
});

// 用户仪表板
app.get('/dashboard', requireAuth, (req, res) => {
  // 获取用户统计信息
  const userId = req.session.userId;

  db.get(`SELECT COUNT(*) as term_count FROM terms WHERE created_by = ?`, [userId], (err, termStats) => {
    if (err) {
      console.error(err);
      termStats = { term_count: 0 };
    }

    db.get(`SELECT COUNT(*) as favorite_count FROM favorites WHERE user_id = ?`, [userId], (err, favoriteStats) => {
      if (err) {
        console.error(err);
        favoriteStats = { favorite_count: 0 };
      }

      safeRender(res, 'dashboard', {
        user: {
          id: req.session.userId,
          username: req.session.username,
          role: req.session.userRole
        },
        stats: {
          terms: termStats.term_count,
          favorites: favoriteStats.favorite_count
        }
      });
    });
  });
});

// 添加术语页面
app.get('/add-term', requireAuth, (req, res) => {
  db.all('SELECT * FROM categories ORDER BY name', (err, categories) => {
    if (err) {
      console.error(err);
      categories = [];
    }

    safeRender(res, 'add-term', {
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
  const { term, definition, category_id, language, source, examples, tags, pronunciation, etymology } = req.body;

  if (!term || !definition) {
    return db.all('SELECT * FROM categories ORDER BY name', (err, categories) => {
      safeRender(res, 'add-term', {
        user: { id: req.session.userId, username: req.session.username, role: req.session.userRole },
        categories: categories || [],
        error: '术语和定义不能为空',
        success: null
      });
    });
  }

  const isApproved = req.session.userRole === 'admin' ? 1 : 0;

  db.run(`INSERT INTO terms (term, definition, category_id, language, source, examples, tags,
           pronunciation, etymology, created_by, is_approved)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [term, definition, category_id || null, language || 'zh', source, examples, tags,
     pronunciation, etymology, req.session.userId, isApproved], function(err) {

    if (err) {
      console.error(err);
      return db.all('SELECT * FROM categories ORDER BY name', (err, categories) => {
        safeRender(res, 'add-term', {
          user: { id: req.session.userId, username: req.session.username, role: req.session.userRole },
          categories: categories || [],
          error: '添加术语失败，请重试',
          success: null
        });
      });
    }

    logActivity(req.session.userId, 'create_term', 'term', this.lastID, term, req);

    db.all('SELECT * FROM categories ORDER BY name', (err, categories) => {
      safeRender(res, 'add-term', {
        user: { id: req.session.userId, username: req.session.username, role: req.session.userRole },
        categories: categories || [],
        error: null,
        success: isApproved ? '术语添加成功！' : '术语已提交，等待管理员审核'
      });
    });
  });
});

// 404处理
app.use((req, res) => {
  res.status(404).send(`
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>404 - 页面未找到</title>
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
    </head>
    <body>
        <div class="container mt-5 text-center">
            <h1>404 - 页面未找到</h1>
            <p>您访问的页面不存在</p>
            <a href="/" class="btn btn-primary">返回首页</a>
        </div>
    </body>
    </html>
  `);
});

// 错误处理
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send(`
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>500 - 服务器错误</title>
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
    </head>
    <body>
        <div class="container mt-5 text-center">
            <h1>500 - 服务器错误</h1>
            <p>服务器遇到了一个错误</p>
            <a href="/" class="btn btn-primary">返回首页</a>
        </div>
    </body>
    </html>
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

  // 初始化数据库
  initializeDatabase();
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

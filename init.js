// 初始化脚本 - 创建管理员账户和示例数据
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('=== 术语管理系统初始化 ===\n');

// 创建数据库连接
const db = new sqlite3.Database('./database.sqlite');

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function init() {
  try {
    console.log('正在初始化数据库...');

    // 创建表结构
    await new Promise((resolve, reject) => {
      db.serialize(() => {
        // 用户表
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

        // 术语翻译表
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
        )`, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    });

    console.log('数据库表创建完成！\n');

    // 检查是否已有管理员
    const existingAdmin = await new Promise((resolve, reject) => {
      db.get("SELECT id FROM users WHERE role = 'admin'", (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (existingAdmin) {
      console.log('管理员账户已存在，跳过创建步骤。');
    } else {
      console.log('创建管理员账户：');
      
      const username = await question('管理员用户名: ');
      const email = await question('管理员邮箱: ');
      const password = await question('管理员密码: ');

      if (!username || !email || !password) {
        console.log('错误：所有字段都是必填的！');
        process.exit(1);
      }

      // 加密密码
      const hashedPassword = await bcrypt.hash(password, 10);

      // 创建管理员账户
      await new Promise((resolve, reject) => {
        db.run(
          "INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, 'admin')",
          [username, email, hashedPassword],
          function(err) {
            if (err) reject(err);
            else resolve(this.lastID);
          }
        );
      });

      console.log(`\n✅ 管理员账户创建成功！`);
      console.log(`用户名: ${username}`);
      console.log(`邮箱: ${email}`);
    }

    // 创建默认分类
    console.log('\n正在创建默认分类...');
    const defaultCategories = [
      { name: '技术术语', description: '技术相关的专业术语' },
      { name: '商业术语', description: '商业和管理相关术语' },
      { name: '医学术语', description: '医学和健康相关术语' },
      { name: '法律术语', description: '法律和法规相关术语' },
      { name: '教育术语', description: '教育和学术相关术语' },
      { name: '其他', description: '其他未分类术语' }
    ];

    for (const category of defaultCategories) {
      try {
        await new Promise((resolve, reject) => {
          db.run(
            "INSERT OR IGNORE INTO categories (name, description) VALUES (?, ?)",
            [category.name, category.description],
            function(err) {
              if (err) reject(err);
              else resolve();
            }
          );
        });
        console.log(`✅ 分类 "${category.name}" 创建成功`);
      } catch (err) {
        console.log(`⚠️  分类 "${category.name}" 可能已存在`);
      }
    }

    // 创建示例术语
    console.log('\n正在创建示例术语...');
    const sampleTerms = [
      {
        term: 'API',
        definition: '应用程序编程接口（Application Programming Interface），是一组定义和协议，用于构建和集成应用软件。',
        category: '技术术语',
        language: 'zh',
        source: '计算机科学',
        notes: '常用于软件开发中'
      },
      {
        term: 'Database',
        definition: '数据库，是存储和管理数据的系统，允许用户存储、检索和管理信息。',
        category: '技术术语',
        language: 'zh',
        source: '数据库理论',
        notes: '数据管理的基础'
      },
      {
        term: 'ROI',
        definition: '投资回报率（Return on Investment），用于衡量投资效率的指标。',
        category: '商业术语',
        language: 'zh',
        source: '财务管理',
        notes: '重要的财务指标'
      }
    ];

    // 获取管理员ID
    const admin = await new Promise((resolve, reject) => {
      db.get("SELECT id FROM users WHERE role = 'admin' LIMIT 1", (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (admin) {
      for (const term of sampleTerms) {
        try {
          await new Promise((resolve, reject) => {
            db.run(
              "INSERT OR IGNORE INTO terms (term, definition, category, language, source, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)",
              [term.term, term.definition, term.category, term.language, term.source, term.notes, admin.id],
              function(err) {
                if (err) reject(err);
                else resolve();
              }
            );
          });
          console.log(`✅ 示例术语 "${term.term}" 创建成功`);
        } catch (err) {
          console.log(`⚠️  术语 "${term.term}" 可能已存在`);
        }
      }
    }

    console.log('\n🎉 初始化完成！');
    console.log('\n现在你可以运行以下命令启动服务器：');
    console.log('npm start');
    console.log('\n然后在浏览器中访问: http://localhost:3000');

  } catch (error) {
    console.error('初始化失败:', error);
  } finally {
    rl.close();
    db.close();
  }
}

init();
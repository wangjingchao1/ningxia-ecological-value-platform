const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3000;

// 开启跨域和 JSON 请求体解析
app.use(cors());
app.use(express.json());

// 连接 SQLite 数据库 (确保你的 mydb.db 文件和 server.js 在同级目录下)
const dbPath = path.join(__dirname, 'mydb.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ 数据库连接失败:', err.message);
  } else {
    console.log(`✅ 成功连接到 SQLite 数据库，路径: ${dbPath}`);
  }
});

// ==================== 0. 用户注册接口 (写入 users 表) ====================
app.post('/api/register', (req, res) => {
  const { username, phone, password, invite_code } = req.body;

  if (!username || !phone || !password) {
    return res.status(400).json({ success: false, message: '用户名、手机号和密码均为必填项！' });
  }

  const checkSql = `SELECT * FROM users WHERE phone = ?`;
  db.get(checkSql, [phone], (err, existingUser) => {
    if (err) {
      return res.status(500).json({ success: false, message: '服务器内部数据库异常' });
    }

    if (existingUser) {
      return res.json({ success: false, message: '注册失败：该手机号已被注册，请直接登录！' });
    }

    const unique_id = 'USER_' + Math.random().toString(36).substring(2, 9).toUpperCase() + Date.now().toString().slice(-4);
    const created_at = new Date().toISOString().slice(0, 19).replace('T', ' ');

    const insertSql = `INSERT INTO users (username, phone, password, invite_code, unique_id, created_at) VALUES (?, ?, ?, ?, ?, ?)`;
    
    db.run(insertSql, [username, phone, password, invite_code || '', unique_id, created_at], function(err) {
      if (err) {
        return res.status(500).json({ success: false, message: '注册失败：数据库写入错误' });
      }

      res.json({
        success: true,
        code: 200,
        message: '注册成功！',
        user: {
          id: this.lastID,
          username,
          phone,
          unique_id
        }
      });
    });
  });
});

// ==================== 1. 管理者系统登录处理核心逻辑 ====================
const handleAdminLogin = (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, message: '账号和密码不能为空！' });
  }

  const sql = `SELECT * FROM admin WHERE phone = ? OR username = ?`;

  db.get(sql, [username, username], (err, adminUser) => {
    if (err) {
      console.error('管理员登录数据库查询错误:', err.message);
      return res.status(500).json({ success: false, message: '服务器内部数据库查询异常' });
    }

    if (!adminUser) {
      return res.json({ success: false, message: '登录失败：该管理员手机号或账号未注册！' });
    }

    if (adminUser.password !== password) {
      return res.json({ success: false, message: '登录失败：密码错误，请重新输入！' });
    }

    res.json({
      success: true,
      code: 200,
      message: '管理员登录成功',
      token: 'admin_token_' + adminUser.id,
      admin: {
        id: adminUser.id,
        username: adminUser.username,
        phone: adminUser.phone,
        unique_id: adminUser.unique_id
      }
    });
  });
};

// 绑定管理员独立登录路由
app.post('/api/admin/login', handleAdminLogin);

// ==================== 2. 普通用户系统登录接口 (智能兼容 role 识别) ====================
app.post('/api/login', (req, res) => {
  const { role, username, password } = req.body;

  if (role === 'admin') {
    return handleAdminLogin(req, res);
  }

  if (!username || !password) {
    return res.status(400).json({ success: false, message: '账号和密码不能为空！' });
  }

  const sql = `SELECT * FROM users WHERE phone = ? OR username = ?`;

  db.get(sql, [username, username], (err, user) => {
    if (err) {
      return res.status(500).json({ success: false, message: '服务器内部数据库查询异常' });
    }

    if (!user) {
      return res.json({ success: false, message: '登录失败：该手机号或账号未注册！' });
    }

    if (user.password !== password) {
      return res.json({ success: false, message: '登录失败：密码错误，请重新输入！' });
    }

    res.json({
      success: true,
      code: 200,
      message: '登录成功',
      token: 'auth_token_' + user.id,
      user: {
        id: user.id,
        username: user.username,
        phone: user.phone,
        unique_id: user.unique_id
      }
    });
  });
});

// ==================== 3. 获取所有注册用户列表 (供后台管理查看) ====================
app.get('/api/users', (req, res) => {
  const sql = `SELECT * FROM users`;
  db.all(sql, [], (err, rows) => {
    if (err) {
      console.error('获取用户列表失败:', err.message);
      return res.status(500).json({ error: '数据库查询失败' });
    }
    res.json(rows);
  });
});

// ==================== 4. 根据 ID 删除用户 ====================
app.delete('/api/users/:id', (req, res) => {
  const userId = req.params.id;
  const sql = `DELETE FROM users WHERE id = ?`;
  
  db.run(sql, [userId], function(err) {
    if (err) {
      console.error('删除用户失败:', err.message);
      return res.status(500).json({ error: '数据库删除失败' });
    }
    res.json({ success: true, message: '用户删除成功' });
  });
});

// 启动后端服务
app.listen(PORT, () => {
  console.log(`🚀 后端服务器运行在 http://localhost:${PORT}`);
});
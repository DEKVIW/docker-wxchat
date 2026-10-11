const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const multer = require("multer");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const fs = require("fs");
const path = require("path");

// 简单的内存限流器
const rateLimitStore = new Map();

const createRateLimit = (windowMs, maxRequests) => {
  return (req, res, next) => {
    const key = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    const windowStart = now - windowMs;

    // 清理过期的记录
    if (rateLimitStore.has(key)) {
      const requests = rateLimitStore
        .get(key)
        .filter((time) => time > windowStart);
      rateLimitStore.set(key, requests);
    } else {
      rateLimitStore.set(key, []);
    }

    const requests = rateLimitStore.get(key);

    if (requests.length >= maxRequests) {
      return res.status(429).json({
        success: false,
        message: `请求过于频繁，请${Math.ceil(windowMs / 1000)}秒后再试`,
      });
    }

    // 记录当前请求
    requests.push(now);
    rateLimitStore.set(key, requests);

    next();
  };
};

const app = express();
const PORT = process.env.PORT || 3000;

// 环境变量
const DATABASE_PATH = process.env.DATABASE_PATH || "./data/wxchat.db";
const UPLOAD_PATH = process.env.UPLOAD_PATH || "./uploads";
const ACCESS_PASSWORD = process.env.ACCESS_PASSWORD || "3zHb0d44eW^mzLj";
const JWT_SECRET =
  process.env.JWT_SECRET || "lazily-plunder-overboard-washer-rants-lingo";
const SESSION_EXPIRE_HOURS = parseInt(process.env.SESSION_EXPIRE_HOURS || "24");
const MAX_LOGIN_ATTEMPTS = parseInt(process.env.MAX_LOGIN_ATTEMPTS || "5");
const MAX_FILE_SIZE_MB = parseInt(process.env.MAX_FILE_SIZE_MB || "100"); // 默认100MB
const MAX_FILE_SIZE = MAX_FILE_SIZE_MB * 1024 * 1024; // 转换为字节

// AI功能配置
const AI_ENABLED = process.env.AI_ENABLED === "true";
const IMAGE_GEN_ENABLED = process.env.IMAGE_GEN_ENABLED === "true";

// AI功能配置
const AI_CHAT_BASE_URL =
  process.env.AI_CHAT_BASE_URL ||
  "https://api.siliconflow.cn/v1/chat/completions";
const AI_CHAT_API_KEY = process.env.AI_CHAT_API_KEY;
const AI_CHAT_MODEL = process.env.AI_CHAT_MODEL || "gpt-4o-mini";

const AI_IMAGE_BASE_URL =
  process.env.AI_IMAGE_BASE_URL ||
  "https://api.siliconflow.cn/v1/images/generations";
const AI_IMAGE_API_KEY = process.env.AI_IMAGE_API_KEY;
const AI_IMAGE_MODEL = process.env.AI_IMAGE_MODEL || "Kwai-Kolors/Kolors";

const AI_RATE_LIMIT = parseInt(process.env.AI_RATE_LIMIT || "10");
const IMAGE_RATE_LIMIT = parseInt(process.env.IMAGE_RATE_LIMIT || "5");

// 中间件
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// 确保目录存在
fs.mkdirSync(path.dirname(DATABASE_PATH), { recursive: true });
fs.mkdirSync(UPLOAD_PATH, { recursive: true });

// 数据库连接
const db = new sqlite3.Database(DATABASE_PATH);

const initializeDatabase = () =>
  new Promise((resolve, reject) => {
    db.run(
      `CREATE TABLE IF NOT EXISTS conversations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        is_default INTEGER NOT NULL DEFAULT 0,
        is_pinned INTEGER NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      (error) => {
        if (error) return reject(error);
        db.all("PRAGMA table_info(conversations)", (error, conversationColumns) => {
          if (error) return reject(error);
          const ensurePinnedColumn = (next) => {
            if (conversationColumns.some((column) => column.name === "is_pinned")) return next();
            db.run(
              "ALTER TABLE conversations ADD COLUMN is_pinned INTEGER NOT NULL DEFAULT 0",
              (error) => (error ? reject(error) : next())
            );
          };
          ensurePinnedColumn(() => {
            db.all("PRAGMA table_info(messages)", (error, columns) => {
              if (error) return reject(error);
              const ensureConversationColumn = (next) => {
                if (columns.some((column) => column.name === "conversation_id")) {
                  return next();
                }
                db.run(
                  "ALTER TABLE messages ADD COLUMN conversation_id INTEGER REFERENCES conversations(id)",
                  (error) => (error ? reject(error) : next())
                );
              };
              ensureConversationColumn(() => {
                db.run(
                  "INSERT OR IGNORE INTO conversations (id, name, is_default) VALUES (1, '微信传输助手', 1)",
                  (error) => {
                    if (error) return reject(error);
                    db.run(
                      "UPDATE messages SET conversation_id = 1 WHERE conversation_id IS NULL",
                      (error) => {
                        if (error) return reject(error);
                        db.run(
                          "CREATE INDEX IF NOT EXISTS idx_messages_conversation_timestamp ON messages(conversation_id, timestamp DESC, id DESC)",
                          (error) => (error ? reject(error) : resolve())
                        );
                      }
                    );
                  }
                );
              });
            });
          });
        });
      }
    );
  });

// 文件上传配置
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_PATH);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname);
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: MAX_FILE_SIZE }, // 使用环境变量配置
});

// 认证中间件
const authMiddleware = (req, res, next) => {
  const token =
    req.headers.authorization?.replace("Bearer ", "") || req.query.token;

  if (!token) {
    return res.status(401).json({ success: false, message: "未提供认证令牌" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ success: false, message: "Token无效或已过期" });
  }
};

// 登录接口
app.post("/api/auth/login", async (req, res) => {
  try {
    const { password, deviceId } = req.body;

    if (!password) {
      return res.status(400).json({ success: false, message: "密码不能为空" });
    }

    if (password !== ACCESS_PASSWORD) {
      return res.status(401).json({ success: false, message: "密码错误" });
    }

    const payload = {
      iat: Date.now(),
      exp: Date.now() + SESSION_EXPIRE_HOURS * 60 * 60 * 1000,
      type: "access",
      deviceId: deviceId || "web-client",
    };

    const token = jwt.sign(payload, JWT_SECRET);

    res.json({ success: true, token });
  } catch (error) {
    res.status(500).json({ success: false, message: "登录失败" });
  }
});

// 验证token接口
app.get("/api/auth/verify", authMiddleware, (req, res) => {
  res.json({ success: true, valid: true, user: req.user });
});

// 登出接口
app.post("/api/auth/logout", (req, res) => {
  res.json({ success: true, message: "登出成功" });
});

app.get("/api/conversations", authMiddleware, (req, res) => {
  db.all(
    `SELECT c.id, c.name, c.is_default, c.is_pinned, c.created_at, c.updated_at,
      (SELECT CASE WHEN m.type = 'file' THEN f.original_name ELSE m.content END
       FROM messages m LEFT JOIN files f ON m.file_id = f.id
       WHERE m.conversation_id = c.id ORDER BY m.id DESC LIMIT 1) AS last_message,
      (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) AS message_count
     FROM conversations c ORDER BY c.is_default DESC, c.is_pinned DESC, c.updated_at DESC, c.id ASC`,
    (error, rows) => {
      if (error) return res.status(500).json({ success: false, message: error.message });
      res.json({ success: true, data: rows });
    }
  );
});

app.post("/api/conversations", authMiddleware, (req, res) => {
  const name = String(req.body.name || "").trim().slice(0, 40);
  if (!name) return res.status(400).json({ success: false, message: "会话名称不能为空" });
  db.run(
    "INSERT INTO conversations (name, is_default, updated_at) VALUES (?, 0, datetime('now'))",
    [name],
    function (error) {
      if (error) return res.status(500).json({ success: false, message: error.message });
      res.status(201).json({ success: true, data: { id: this.lastID, name, is_default: 0 } });
    }
  );
});

app.patch("/api/conversations/:id", authMiddleware, (req, res) => {
  const conversationId = Number(req.params.id);
  const updates = [];
  const values = [];
  if (Object.hasOwn(req.body, "name")) {
    const name = String(req.body.name || "").trim().slice(0, 40);
    if (!name) return res.status(400).json({ success: false, message: "会话名称不能为空" });
    updates.push("name = ?");
    values.push(name);
  }
  if (Object.hasOwn(req.body, "is_pinned")) {
    updates.push("is_pinned = ?");
    values.push(req.body.is_pinned ? 1 : 0);
  }
  if (!Number.isSafeInteger(conversationId) || conversationId < 1 || !updates.length) {
    return res.status(400).json({ success: false, message: "会话编号或操作无效" });
  }
  updates.push("updated_at = datetime('now')");
  values.push(conversationId);
  db.run(
    `UPDATE conversations SET ${updates.join(", ")} WHERE id = ?`,
    values,
    function (error) {
      if (error) return res.status(500).json({ success: false, message: error.message });
      if (!this.changes) return res.status(404).json({ success: false, message: "会话不存在" });
      res.json({ success: true, data: { id: conversationId } });
    }
  );
});

app.delete("/api/conversations/:id", authMiddleware, (req, res) => {
  const conversationId = Number(req.params.id);
  if (!Number.isSafeInteger(conversationId) || conversationId < 1) {
    return res.status(400).json({ success: false, message: "会话编号无效" });
  }
  db.get("SELECT id, is_default FROM conversations WHERE id = ?", [conversationId], (lookupError, conversation) => {
    if (lookupError) return res.status(500).json({ success: false, message: lookupError.message });
    if (!conversation) return res.status(404).json({ success: false, message: "会话不存在" });
    if (conversation.is_default) return res.status(400).json({ success: false, message: "默认聊天不可删除" });
    db.all(
      "SELECT DISTINCT f.id, f.file_name FROM files f JOIN messages m ON m.file_id = f.id WHERE m.conversation_id = ?",
      [conversationId],
      (filesError, files) => {
        if (filesError) return res.status(500).json({ success: false, message: filesError.message });
        db.run("DELETE FROM messages WHERE conversation_id = ?", [conversationId], function (deleteError) {
          if (deleteError) return res.status(500).json({ success: false, message: deleteError.message });
          const deletedMessages = this.changes;
          const finishDelete = () => {
            db.run("DELETE FROM conversations WHERE id = ?", [conversationId], function (conversationError) {
              if (conversationError) return res.status(500).json({ success: false, message: conversationError.message });
              res.json({ success: true, data: { deletedMessages, deletedFiles } });
            });
          };
          let deletedFiles = 0;
          const cleanupFile = (index) => {
            if (index >= files.length) return finishDelete();
            const file = files[index];
            db.get("SELECT COUNT(*) AS count FROM messages WHERE file_id = ?", [file.id], (countError, result) => {
              if (countError) return res.status(500).json({ success: false, message: countError.message });
              if (result.count > 0) return cleanupFile(index + 1);
              db.run("DELETE FROM files WHERE id = ?", [file.id], function (fileError) {
                if (fileError) return res.status(500).json({ success: false, message: fileError.message });
                if (this.changes > 0) {
                  deletedFiles += 1;
                  fs.unlink(path.join(UPLOAD_PATH, file.file_name), () => cleanupFile(index + 1));
                } else {
                  cleanupFile(index + 1);
                }
              });
            });
          };
          cleanupFile(0);
        });
      }
    );
  });
});

// 获取消息列表
app.get("/api/messages", authMiddleware, (req, res) => {
  // 支持 limit=0 表示不限制，或 limit=100000 表示最大限制
  let limit = parseInt(req.query.limit);
  const offset = parseInt(req.query.offset) || 0;
  const conversationId = Number(req.query.conversationId || 1);
  if (!Number.isSafeInteger(conversationId) || conversationId < 1) {
    return res.status(400).json({ success: false, message: "会话编号无效" });
  }

  // 如果 limit 为 0 或未指定，使用默认值 5000
  // 如果 limit 大于 100000，限制为 100000
  if (!limit || limit === 0) {
    limit = 5000; // 默认加载 5000 条
  } else if (limit > 100000) {
    limit = 100000; // 最大限制 100000 条
  }

  const query = `
    SELECT m.*, f.original_name, f.file_size, f.mime_type, f.r2_key 
    FROM messages m 
    LEFT JOIN files f ON m.file_id = f.id 
    WHERE m.conversation_id = ?
    ORDER BY m.timestamp ASC 
    LIMIT ? OFFSET ?
  `;

  db.all(query, [conversationId, limit, offset], (err, rows) => {
    if (err) {
      res.status(500).json({ success: false, message: err.message });
      return;
    }
    res.json({ success: true, data: rows });
  });
});

// 发送消息
app.post("/api/messages", authMiddleware, (req, res) => {
  const { content, type = "text", deviceId } = req.body;
  const conversationId = Number(req.body.conversationId || 1);

  if (!Number.isSafeInteger(conversationId) || conversationId < 1) {
    return res.status(400).json({ success: false, message: "会话编号无效" });
  }

  if (!content && type === "text") {
    return res
      .status(400)
      .json({ success: false, message: "消息内容不能为空" });
  }

  const query = `
    INSERT INTO messages (conversation_id, type, content, device_id, timestamp, created_at, updated_at) 
    VALUES (?, ?, ?, ?, datetime('now'), datetime('now'), datetime('now'))
  `;

  db.get("SELECT id FROM conversations WHERE id = ?", [conversationId], (lookupError, row) => {
    if (lookupError) return res.status(500).json({ success: false, message: lookupError.message });
    if (!row) return res.status(404).json({ success: false, message: "会话不存在" });
    db.run(query, [conversationId, type, content, deviceId || req.user.deviceId], function (err) {
      if (err) return res.status(500).json({ success: false, message: err.message });
      db.run("UPDATE conversations SET updated_at = datetime('now') WHERE id = ?", [conversationId]);
      res.json({ success: true, messageId: this.lastID });
    });
  });
});

// 文件上传
app.post(
  "/api/files/upload",
  authMiddleware,
  upload.single("file"),
  (req, res) => {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "没有上传文件" });
    }

    const { originalname, filename, size, mimetype } = req.file;
    const deviceId = req.user.deviceId;
    const conversationId = Number(req.body.conversationId || 1);

    if (!Number.isSafeInteger(conversationId) || conversationId < 1) {
      fs.unlink(req.file.path, () => {});
      return res.status(400).json({ success: false, message: "会话编号无效" });
    }

    // 插入文件记录
    const fileQuery = `
    INSERT INTO files (original_name, file_name, file_size, mime_type, r2_key, upload_device_id, created_at, updated_at) 
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `;

    db.get("SELECT id FROM conversations WHERE id = ?", [conversationId], (lookupError, conversation) => {
      if (lookupError || !conversation) {
        fs.unlink(req.file.path, () => {});
        return res.status(lookupError ? 500 : 404).json({
          success: false,
          message: lookupError ? lookupError.message : "会话不存在",
        });
      }
      db.run(
      fileQuery,
      [originalname, filename, size, mimetype, filename, deviceId],
      function (err) {
        if (err) {
          res.status(500).json({ success: false, message: err.message });
          return;
        }

        const fileId = this.lastID;

        // 插入消息记录
        const messageQuery = `
      INSERT INTO messages (conversation_id, type, content, file_id, device_id, timestamp, created_at, updated_at) 
      VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'), datetime('now'))
    `;

        db.run(
          messageQuery,
          [conversationId, "file", originalname, fileId, deviceId],
          function (err) {
            if (err) {
              res.status(500).json({ success: false, message: err.message });
              return;
            }

            res.json({
              success: true,
              data: {
                fileId: fileId,
                messageId: this.lastID,
                fileName: originalname,
                fileSize: size,
                r2Key: filename, // 添加r2_key字段
              },
            });
            db.run("UPDATE conversations SET updated_at = datetime('now') WHERE id = ?", [conversationId]);
          }
        );
      }
      );
    });
  }
);

// 文件下载
app.get("/api/files/download/:r2Key", authMiddleware, (req, res) => {
  const r2Key = req.params.r2Key;
  const filePath = path.join(UPLOAD_PATH, r2Key);

  // 检查文件是否存在
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, message: "文件不存在" });
  }

  // 获取文件信息
  db.get("SELECT * FROM files WHERE r2_key = ?", [r2Key], (err, file) => {
    if (err || !file) {
      return res
        .status(404)
        .json({ success: false, message: "文件记录不存在" });
    }

    // 更新下载次数
    db.run(
      "UPDATE files SET download_count = download_count + 1 WHERE id = ?",
      [file.id]
    );

    // 设置响应头
    res.setHeader("Content-Type", file.mime_type);

    // 对文件名进行编码，处理非ASCII字符
    const encodedFilename = encodeURIComponent(file.original_name);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename*=UTF-8''${encodedFilename}`
    );
    res.setHeader("Content-Length", file.file_size);

    // 发送文件
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  });
});

// 设备同步
app.post("/api/sync", authMiddleware, (req, res) => {
  const { deviceId, deviceName } = req.body;

  if (!deviceId) {
    return res.status(400).json({ success: false, message: "设备ID不能为空" });
  }

  const query = `
    INSERT OR REPLACE INTO devices (id, name, last_active, created_at, updated_at) 
    VALUES (?, ?, datetime('now'), datetime('now'), datetime('now'))
  `;

  db.run(query, [deviceId, deviceName || "未知设备"], function (err) {
    if (err) {
      res.status(500).json({ success: false, message: err.message });
      return;
    }
    res.json({ success: true });
  });
});

// 搜索消息
app.get("/api/search", authMiddleware, (req, res) => {
  const {
    q,
    type,
    timeRange,
    deviceId,
    fileType,
    conversationId = "1",
    limit = 20,
    offset = 0,
  } = req.query;

  if (!q || q.trim().length < 2) {
    return res
      .status(400)
      .json({ success: false, message: "搜索关键词至少2个字符" });
  }

  let query = `
    SELECT m.*, f.original_name, f.file_size, f.mime_type, f.r2_key 
    FROM messages m 
    LEFT JOIN files f ON m.file_id = f.id 
    WHERE m.conversation_id = ? AND (m.content LIKE ? OR f.original_name LIKE ?)
  `;
  const params = [Number(conversationId), `%${q}%`, `%${q}%`];

  // 添加过滤条件
  if (type && type !== "all") {
    query += " AND m.type = ?";
    params.push(type);
  }

  if (deviceId && deviceId !== "all") {
    query += " AND m.device_id = ?";
    params.push(deviceId);
  }

  if (timeRange && timeRange !== "all") {
    const timeMap = {
      today: "datetime('now', 'start of day')",
      week: "datetime('now', '-7 days')",
      month: "datetime('now', '-30 days')",
    };
    if (timeMap[timeRange]) {
      query += ` AND m.timestamp >= ${timeMap[timeRange]}`;
    }
  }

  query += " ORDER BY m.timestamp ASC LIMIT ? OFFSET ?";
  params.push(parseInt(limit), parseInt(offset));

  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ success: false, message: err.message });
      return;
    }
    res.json({ success: true, data: rows });
  });
});

// 搜索建议
app.get("/api/search/suggestions", authMiddleware, (req, res) => {
  const { q } = req.query;
  const conversationId = Number(req.query.conversationId || 1);

  if (!q || q.trim().length < 2) {
    return res.json({ success: true, data: [] });
  }

  const query = `
    SELECT DISTINCT content 
    FROM messages 
    WHERE conversation_id = ? AND type = 'text' AND content LIKE ? 
    ORDER BY timestamp DESC 
    LIMIT 10
  `;

  db.all(query, [conversationId, `%${q}%`], (err, rows) => {
    if (err) {
      res.status(500).json({ success: false, message: err.message });
      return;
    }
    res.json({ success: true, data: rows.map((row) => row.content) });
  });
});

// 清理所有数据
app.delete("/api/conversations/:id/messages", authMiddleware, (req, res) => {
  const conversationId = Number(req.params.id);
  if (!Number.isSafeInteger(conversationId) || conversationId < 1) {
    return res.status(400).json({ success: false, message: "会话编号无效" });
  }

  db.get("SELECT id FROM conversations WHERE id = ?", [conversationId], (lookupError, conversation) => {
    if (lookupError) return res.status(500).json({ success: false, message: lookupError.message });
    if (!conversation) return res.status(404).json({ success: false, message: "会话不存在" });
    db.all(
      "SELECT DISTINCT f.id, f.file_name FROM files f JOIN messages m ON m.file_id = f.id WHERE m.conversation_id = ?",
      [conversationId],
      (filesError, files) => {
        if (filesError) return res.status(500).json({ success: false, message: filesError.message });
        db.run("DELETE FROM messages WHERE conversation_id = ?", [conversationId], function (deleteError) {
          if (deleteError) return res.status(500).json({ success: false, message: deleteError.message });
          const deletedMessages = this.changes;
          const cleanupFile = (index) => {
            if (index >= files.length) {
              db.run("UPDATE conversations SET updated_at = datetime('now') WHERE id = ?", [conversationId]);
              return res.json({ success: true, data: { deletedMessages } });
            }
            const file = files[index];
            db.get("SELECT COUNT(*) AS count FROM messages WHERE file_id = ?", [file.id], (countError, result) => {
              if (countError || result.count > 0) return cleanupFile(index + 1);
              db.run("DELETE FROM files WHERE id = ?", [file.id], function (fileError) {
                if (!fileError && this.changes > 0) {
                  fs.unlink(path.join(UPLOAD_PATH, file.file_name), () => cleanupFile(index + 1));
                } else {
                  cleanupFile(index + 1);
                }
              });
            });
          };
          cleanupFile(0);
        });
      }
    );
  });
});

app.post("/api/clear-all", authMiddleware, (req, res) => {
  const { confirmCode } = req.body;

  if (confirmCode !== "1234") {
    return res.status(400).json({ success: false, message: "确认码错误" });
  }

  // 统计清理前的数据
  db.get("SELECT COUNT(*) as count FROM messages", (err, messageCount) => {
    if (err) {
      return res.status(500).json({ success: false, message: err.message });
    }

    db.get(
      "SELECT COUNT(*) as count, SUM(file_size) as totalSize FROM files",
      (err, fileStats) => {
        if (err) {
          return res.status(500).json({ success: false, message: err.message });
        }

        // 删除文件
        const files = fs.readdirSync(UPLOAD_PATH);
        let deletedFilesCount = 0;
        files.forEach((file) => {
          try {
            fs.unlinkSync(path.join(UPLOAD_PATH, file));
            deletedFilesCount++;
          } catch (error) {
            console.error("删除文件失败:", error);
          }
        });

        // 清空数据库
        db.serialize(() => {
          db.run("DELETE FROM messages");
          db.run("DELETE FROM files");
          db.run("DELETE FROM devices");
        });

        // 触发SSE通知所有客户端消息已清空
        global.sseClients.forEach((client) => {
          if (client.res && !client.res.destroyed) {
            client.res.write(
              `event: clearAll\ndata: {"action": "clearAll"}\n\n`
            );
          }
        });

        res.json({
          success: true,
          data: {
            message: "所有数据已成功清理",
            deletedMessages: messageCount.count,
            deletedFiles: fileStats.count,
            deletedFileSize: fileStats.totalSize || 0,
            deletedR2Files: deletedFilesCount,
          },
        });
      }
    );
  });
});

// 初始化SSE客户端管理
global.sseClients = global.sseClients || [];

// SSE实时通信
app.get("/api/events", authMiddleware, (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Cache-Control",
  });

  // 发送连接确认
  res.write("event: connection\ndata: connected\n\n");

  // 将客户端添加到全局列表
  const client = {
    res,
    deviceId: req.user.deviceId,
    conversationId: Number(req.query.conversationId || 1),
  };
  global.sseClients.push(client);

  // 定期检查新消息
  const checkInterval = setInterval(() => {
    db.all(
      "SELECT id FROM conversations WHERE updated_at > datetime('now', '-10 seconds')",
      (err, rows) => {
        if (rows && rows.length > 0) {
          const conversationIds = rows.map((row) => row.id);
          res.write(`event: message\ndata: ${JSON.stringify({
            newMessages: conversationIds.length,
            conversationIds,
          })}\n\n`);
        }
      }
    );
  }, 5000);

  // 心跳
  const heartbeat = setInterval(() => {
    res.write("event: heartbeat\ndata: ping\n\n");
  }, 30000);

  // 清理连接
  req.on("close", () => {
    clearInterval(checkInterval);
    clearInterval(heartbeat);
    // 从客户端列表中移除
    const index = global.sseClients.indexOf(client);
    if (index > -1) {
      global.sseClients.splice(index, 1);
    }
  });
});

// 长轮询接口（SSE降级方案）
app.get("/api/poll", authMiddleware, (req, res) => {
  const { lastMessageId = "0", timeout = 30 } = req.query;
  const conversationId = Number(req.query.conversationId || 1);

  const startTime = Date.now();
  const maxWaitTime = parseInt(timeout) * 1000;

  const checkMessages = () => {
    db.get(
      "SELECT COUNT(*) as count FROM messages WHERE conversation_id = ? AND id > ?",
      [conversationId, lastMessageId],
      (err, row) => {
        if (err) {
          return res.status(500).json({ success: false, message: err.message });
        }

        if (row.count > 0) {
          res.json({
            success: true,
            hasNewMessages: true,
            newMessageCount: row.count,
          });
        } else if (Date.now() - startTime < maxWaitTime) {
          setTimeout(checkMessages, 1000);
        } else {
          res.json({
            success: true,
            hasNewMessages: false,
            newMessageCount: 0,
          });
        }
      }
    );
  };

  checkMessages();
});

// 删除单条消息
app.delete("/api/messages/:id", authMiddleware, (req, res) => {
  const messageId = req.params.id;
  const conversationId = Number(req.query.conversationId || 1);

  if (!messageId) {
    return res.status(400).json({ success: false, message: "消息ID不能为空" });
  }

  // 先查询消息是否存在以及是否为文件消息
  db.get(
    "SELECT * FROM messages WHERE id = ? AND conversation_id = ?",
    [messageId, conversationId],
    (err, message) => {
    if (err) {
      return res.status(500).json({ success: false, message: err.message });
    }

    if (!message) {
      return res.status(404).json({ success: false, message: "消息不存在" });
    }

    // 如果是文件消息，需要删除相关文件
    if (message.type === "file") {
      // 查询文件信息
      db.get(
        "SELECT * FROM files WHERE id = ?",
        [message.file_id],
        (err, file) => {
          if (err) {
            return res
              .status(500)
              .json({ success: false, message: err.message });
          }

          // 删除物理文件 - 使用与清空所有消息相同的方法
          if (file && file.r2_key) {
            const filePath = path.join(UPLOAD_PATH, file.r2_key);
            console.log("尝试删除文件:", filePath);
            try {
              if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                console.log("文件删除成功:", filePath);
              } else {
                console.log("文件不存在:", filePath);
              }
            } catch (error) {
              console.error("删除文件失败:", error);
            }
          } else {
            console.log("文件信息不完整:", file);
          }

          // 删除数据库记录
          db.serialize(() => {
            // 删除文件记录
            db.run("DELETE FROM files WHERE id = ?", [message.file_id]);
            // 删除消息记录
            db.run(
              "DELETE FROM messages WHERE id = ?",
              [messageId],
              function (err) {
                if (err) {
                  return res
                    .status(500)
                    .json({ success: false, message: err.message });
                }

                // 触发SSE通知所有客户端消息已删除
                global.sseClients.forEach((client) => {
                  if (client.res && !client.res.destroyed) {
                    client.res.write(
                      `event: messageDeleted\ndata: {"messageId": "${messageId}"}\n\n`
                    );
                  }
                });

                res.json({
                  success: true,
                  data: {
                    message: "消息删除成功",
                    deletedMessageId: messageId,
                    deletedFile: file ? file.file_name : null,
                  },
                });
              }
            );
          });
        }
      );
    } else {
      // 普通文本消息，直接删除
      db.run("DELETE FROM messages WHERE id = ?", [messageId], function (err) {
        if (err) {
          return res.status(500).json({ success: false, message: err.message });
        }

        // 触发SSE通知所有客户端消息已删除
        global.sseClients.forEach((client) => {
          if (client.res && !client.res.destroyed) {
            client.res.write(
              `event: messageDeleted\ndata: {"messageId": "${messageId}"}\n\n`
            );
          }
        });

        res.json({
          success: true,
          data: {
            message: "消息删除成功",
            deletedMessageId: messageId,
          },
        });
      });
    }
  });
});

// AI聊天代理接口
app.post(
  "/api/ai/chat",
  authMiddleware,
  createRateLimit(60000, AI_RATE_LIMIT),
  async (req, res) => {
    try {
      // 检查AI功能是否启用
      if (!AI_ENABLED) {
        return res.status(403).json({
          success: false,
          message: "AI功能未启用",
        });
      }

      // 检查API密钥是否配置
      if (!AI_CHAT_API_KEY) {
        return res.status(500).json({
          success: false,
          message: "AI服务配置错误",
        });
      }

      const {
        message,
        model = AI_CHAT_MODEL,
        max_tokens = 4000,
        temperature = 0.7,
        stream = false, // 默认不使用流式
      } = req.body;

      if (!message || message.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: "消息内容不能为空",
        });
      }

      // 调用AI聊天API（添加超时和重试机制）
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒超时

      const response = await fetch(AI_CHAT_BASE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${AI_CHAT_API_KEY}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: message }],
          max_tokens,
          temperature,
          stream: stream, // 根据参数决定是否使用流式
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error
          ? typeof errorData.error === "string"
            ? errorData.error
            : JSON.stringify(errorData.error)
          : errorData.message || "未知错误";
        throw new Error(
          `AI API请求失败: ${response.status} ${response.statusText} - ${errorMessage}`
        );
      }

      // 智能检测响应类型
      const contentType = response.headers.get("content-type") || "";

      if (
        contentType.includes("text/event-stream") ||
        contentType.includes("text/plain")
      ) {
        // 处理流式响应
        res.setHeader("Content-Type", "text/plain; charset=utf-8");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            res.write(chunk);
          }
        } finally {
          reader.releaseLock();
          res.end(); // 结束流式响应
        }
      } else {
        // 处理JSON响应
        const responseData = await response.json();

        // 提取AI回复内容
        const aiResponse =
          responseData.choices?.[0]?.message?.content ||
          "抱歉，我无法生成回答。";

        // 返回JSON响应
        res.json({
          success: true,
          response: aiResponse,
          usage: responseData.usage,
          model: responseData.model,
        });
      }
    } catch (error) {
      console.error("AI聊天代理错误:", {
        error: error.message,
        stack: error.stack,
        user: req.user?.deviceId,
        message: req.body.message?.substring(0, 100),
      });

      // 根据错误类型返回不同的状态码
      if (error.message.includes("API请求失败")) {
        res.status(502).json({
          success: false,
          message: "AI服务暂时不可用，请稍后重试",
        });
      } else if (error.message.includes("网络")) {
        res.status(503).json({
          success: false,
          message: "网络连接失败，请检查网络",
        });
      } else {
        res.status(500).json({
          success: false,
          message: error.message || "AI请求失败",
        });
      }
    }
  }
);

// AI图片生成代理接口
app.post(
  "/api/ai/image",
  authMiddleware,
  createRateLimit(60000, IMAGE_RATE_LIMIT),
  async (req, res) => {
    try {
      // 检查图片生成功能是否启用
      if (!IMAGE_GEN_ENABLED) {
        return res.status(403).json({
          success: false,
          message: "AI图片生成功能未启用",
        });
      }

      // 检查API密钥是否配置
      if (!AI_IMAGE_API_KEY) {
        return res.status(500).json({
          success: false,
          message: "AI图片生成服务配置错误",
        });
      }

      const {
        prompt,
        negativePrompt,
        imageSize = "1024x1024",
        numInferenceSteps = 20,
        guidanceScale = 7.5,
        seed,
      } = req.body;

      if (!prompt || prompt.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: "图片描述不能为空",
        });
      }

      // 构建请求参数
      const requestBody = {
        model: AI_IMAGE_MODEL,
        prompt: prompt.trim(),
        image_size: imageSize,
        batch_size: 1,
        num_inference_steps: numInferenceSteps,
        guidance_scale: guidanceScale,
      };

      // 添加可选参数
      if (negativePrompt && negativePrompt.trim()) {
        requestBody.negative_prompt = negativePrompt.trim();
      }
      if (seed) {
        requestBody.seed = seed;
      }

      // 调用AI图片生成API
      const response = await fetch(AI_IMAGE_BASE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${AI_IMAGE_API_KEY}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `图片生成API请求失败: ${response.status} ${response.statusText} - ${
            errorData.error || "未知错误"
          }`
        );
      }

      const result = await response.json();
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error("AI图片生成代理错误:", {
        error: error.message,
        stack: error.stack,
        user: req.user?.deviceId,
        prompt: req.body.prompt?.substring(0, 100),
      });

      // 根据错误类型返回不同的状态码
      if (error.message.includes("API请求失败")) {
        res.status(502).json({
          success: false,
          message: "图片生成服务暂时不可用，请稍后重试",
        });
      } else if (error.message.includes("网络")) {
        res.status(503).json({
          success: false,
          message: "网络连接失败，请检查网络",
        });
      } else if (
        error.message.includes("quota") ||
        error.message.includes("limit")
      ) {
        res.status(429).json({
          success: false,
          message: "图片生成次数已达上限，请稍后再试",
        });
      } else {
        res.status(500).json({
          success: false,
          message: error.message || "图片生成失败",
        });
      }
    }
  }
);

// AI消息存储接口
app.post("/api/ai/message", authMiddleware, (req, res) => {
  const { content, deviceId = "ai-system", type = "ai_response" } = req.body;
  const conversationId = Number(req.body.conversationId || 1);

  if (!content) {
    return res.status(400).json({
      success: false,
      message: "消息内容不能为空",
    });
  }

  const query = `
    INSERT INTO messages (conversation_id, type, content, device_id, timestamp, created_at, updated_at) 
    VALUES (?, ?, ?, ?, datetime('now'), datetime('now'), datetime('now'))
  `;

  db.get("SELECT id FROM conversations WHERE id = ?", [conversationId], (lookupError, conversation) => {
    if (lookupError) return res.status(500).json({ success: false, message: lookupError.message });
    if (!conversation) return res.status(404).json({ success: false, message: "会话不存在" });
    db.run(query, [conversationId, type, content, deviceId], function (err) {
      if (err) return res.status(500).json({ success: false, message: err.message });
      db.run("UPDATE conversations SET updated_at = datetime('now') WHERE id = ?", [conversationId]);
      res.json({
        success: true,
        data: {
          id: this.lastID,
          messageId: this.lastID,
        },
      });
    });
    }
  );
});

// 配置接口 - 返回前端需要的配置信息（需要认证）
app.get("/api/config", authMiddleware, (req, res) => {
  res.json({
    success: true,
    data: {
      maxFileSize: MAX_FILE_SIZE,
      maxFileSizeMB: MAX_FILE_SIZE_MB,
      sessionExpireHours: SESSION_EXPIRE_HOURS,
      maxLoginAttempts: MAX_LOGIN_ATTEMPTS,
      aiEnabled: AI_ENABLED,
      imageGenEnabled: IMAGE_GEN_ENABLED,
      // AI配置（只返回前端需要的非敏感信息）
      aiConfig: {
        model: AI_CHAT_MODEL,
        maxTokens: 4000,
        temperature: 0.7,
        stream: true,
        // 注意：不返回API密钥、端点等敏感信息
      },
      // 图片生成配置
      imageGenConfig: {
        model: AI_IMAGE_MODEL,
        defaultSize: "1024x1024",
        defaultSteps: 20,
        defaultGuidance: 7.5,
      },
    },
  });
});

// 启动服务器前幂等迁移旧 SQLite 数据库
initializeDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 微信文件传输助手 Docker版本运行在端口 ${PORT}`);
      console.log(`📁 数据库路径: ${DATABASE_PATH}`);
      console.log(`📁 上传路径: ${UPLOAD_PATH}`);
      console.log(`⏰ 会话过期时间: ${SESSION_EXPIRE_HOURS}小时`);
      console.log(`📦 最大文件大小: ${MAX_FILE_SIZE_MB}MB`);
    });
  })
  .catch((error) => {
    console.error("数据库初始化失败，服务器未启动:", error);
    process.exit(1);
  });

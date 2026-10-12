import { Hono } from "hono";
import { cors } from "hono/cors";
import { getAssetFromKV } from "@cloudflare/kv-asset-handler";

const app = new Hono();

// CORS配置
app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  })
);

// 鉴权工具函数
const AuthUtils = {
  // 生成简单的JWT token
  async generateToken(payload, secret) {
    const header = { alg: "HS256", typ: "JWT" };
    const encodedHeader = btoa(JSON.stringify(header));
    const encodedPayload = btoa(JSON.stringify(payload));
    const signature = await this.sign(
      `${encodedHeader}.${encodedPayload}`,
      secret
    );
    return `${encodedHeader}.${encodedPayload}.${signature}`;
  },

  // 验证JWT token
  async verifyToken(token, secret) {
    try {
      const [header, payload, signature] = token.split(".");
      const expectedSignature = await this.sign(`${header}.${payload}`, secret);

      if (signature !== expectedSignature) {
        return null;
      }

      const decodedPayload = JSON.parse(atob(payload));

      // 检查过期时间
      if (decodedPayload.exp && Date.now() > decodedPayload.exp) {
        return null;
      }

      return decodedPayload;
    } catch (error) {
      return null;
    }
  },

  // 生成签名
  async sign(data, secret) {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const signature = await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(data)
    );
    return btoa(String.fromCharCode(...new Uint8Array(signature)));
  },
};

// 鉴权中间件
const authMiddleware = async (c, next) => {
  // 跳过登录和静态资源
  const path = c.req.path;
  if (
    path.startsWith("/api/auth/") ||
    path.startsWith("/login.html") ||
    path.includes(".css") ||
    path.includes(".js") ||
    path.includes(".ico") ||
    path.includes("favicon")
  ) {
    return next();
  }

  // 获取token - 优先从Authorization头获取，其次从URL参数获取（用于SSE）
  let token = null;
  const authHeader = c.req.header("Authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.substring(7);
  } else {
    // 从URL参数获取token（用于SSE连接）
    token = c.req.query("token");
  }

  if (!token) {
    // 对于API请求返回401，对于页面请求重定向到登录页
    if (path.startsWith("/api/")) {
      return c.json({ success: false, message: "未授权访问" }, 401);
    }
    return c.redirect("/login.html");
  }

  const payload = await AuthUtils.verifyToken(token, c.env.JWT_SECRET);

  if (!payload) {
    // 对于API请求返回401，对于页面请求重定向到登录页
    if (path.startsWith("/api/")) {
      return c.json({ success: false, message: "Token无效或已过期" }, 401);
    }
    return c.redirect("/login.html");
  }

  // 将用户信息添加到上下文
  c.set("user", payload);
  return next();
};

// API路由
const api = new Hono();

// 鉴权API路由
const authApi = new Hono();

// 登录接口
authApi.post("/login", async (c) => {
  try {
    const { password } = await c.req.json();

    if (!password) {
      return c.json({ success: false, message: "密码不能为空" }, 400);
    }

    // 直接验证明文密码（简化配置）
    const expectedPassword = c.env.ACCESS_PASSWORD;

    if (password !== expectedPassword) {
      return c.json({ success: false, message: "密码错误" }, 401);
    }

    // 生成token
    const expireHours = parseInt(c.env.SESSION_EXPIRE_HOURS || "24");
    const payload = {
      iat: Date.now(),
      exp: Date.now() + expireHours * 60 * 60 * 1000,
      type: "access",
    };

    const token = await AuthUtils.generateToken(payload, c.env.JWT_SECRET);

    return c.json({
      success: true,
      token,
      expiresIn: expireHours * 60 * 60,
    });
  } catch (error) {
    console.error("登录错误:", error);
    return c.json({ success: false, message: "服务器错误" }, 500);
  }
});

// 验证token接口
authApi.get("/verify", async (c) => {
  try {
    const authHeader = c.req.header("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return c.json({ valid: false, message: "缺少认证信息" }, 401);
    }

    const token = authHeader.substring(7);
    const payload = await AuthUtils.verifyToken(token, c.env.JWT_SECRET);

    if (!payload) {
      return c.json({ valid: false, message: "Token无效或已过期" }, 401);
    }

    return c.json({ valid: true, payload });
  } catch (error) {
    console.error("验证token错误:", error);
    return c.json({ valid: false, message: "服务器错误" }, 500);
  }
});

// 登出接口
authApi.post("/logout", async (c) => {
  // 简单的登出响应，实际的token清理在前端处理
  return c.json({ success: true, message: "已登出" });
});

api.get("/conversations", async (c) => {
  try {
    const result = await c.env.DB.prepare(`
      SELECT c.id, c.name, c.is_default, c.is_pinned, c.created_at, c.updated_at,
        (SELECT CASE WHEN m.type = 'file' THEN f.original_name ELSE m.content END
         FROM messages m LEFT JOIN files f ON m.file_id = f.id
         WHERE m.conversation_id = c.id ORDER BY m.id DESC LIMIT 1) AS last_message,
        (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) AS message_count
      FROM conversations c ORDER BY c.is_default DESC, c.is_pinned DESC, c.updated_at DESC, c.id ASC
    `).all();
    return c.json({ success: true, data: result.results || [] });
  } catch (error) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

api.post("/conversations", async (c) => {
  try {
    const { name = "" } = await c.req.json();
    const normalizedName = String(name).trim().slice(0, 40);
    if (!normalizedName) return c.json({ success: false, error: "会话名称不能为空" }, 400);
    const result = await c.env.DB.prepare(
      "INSERT INTO conversations (name, is_default) VALUES (?, 0)"
    ).bind(normalizedName).run();
    return c.json({ success: true, data: { id: result.meta.last_row_id, name: normalizedName, is_default: 0 } }, 201);
  } catch (error) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

api.patch("/conversations/:id", async (c) => {
  try {
    const conversationId = Number(c.req.param("id"));
    const body = await c.req.json();
    const updates = [];
    const bindings = [];
    if (Object.hasOwn(body, "name")) {
      const normalizedName = String(body.name).trim().slice(0, 40);
      if (!normalizedName) return c.json({ success: false, error: "会话名称不能为空" }, 400);
      updates.push("name = ?");
      bindings.push(normalizedName);
    }
    if (Object.hasOwn(body, "is_pinned")) {
      updates.push("is_pinned = ?");
      bindings.push(body.is_pinned ? 1 : 0);
    }
    if (!Number.isSafeInteger(conversationId) || conversationId < 1 || !updates.length) {
      return c.json({ success: false, error: "会话编号或操作无效" }, 400);
    }
    updates.push("updated_at = CURRENT_TIMESTAMP");
    bindings.push(conversationId);
    const result = await c.env.DB.prepare(
      `UPDATE conversations SET ${updates.join(", ")} WHERE id = ?`
    ).bind(...bindings).run();
    if (!result.meta.changes) return c.json({ success: false, error: "会话不存在" }, 404);
    return c.json({ success: true, data: { id: conversationId } });
  } catch (error) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

api.delete("/conversations/:id", async (c) => {
  try {
    const { DB, R2 } = c.env;
    const conversationId = Number(c.req.param("id"));
    if (!Number.isSafeInteger(conversationId) || conversationId < 1) {
      return c.json({ success: false, error: "会话编号无效" }, 400);
    }
    const conversation = await DB.prepare("SELECT id, is_default FROM conversations WHERE id = ?")
      .bind(conversationId).first();
    if (!conversation) return c.json({ success: false, error: "会话不存在" }, 404);
    if (conversation.is_default) return c.json({ success: false, error: "默认聊天不可删除" }, 400);

    const files = await DB.prepare(`
      SELECT DISTINCT f.id, f.r2_key
      FROM files f JOIN messages m ON m.file_id = f.id
      WHERE m.conversation_id = ?
    `).bind(conversationId).all();
    const deletedMessages = await DB.prepare("DELETE FROM messages WHERE conversation_id = ?")
      .bind(conversationId).run();
    let deletedFiles = 0;
    for (const file of files.results || []) {
      const references = await DB.prepare("SELECT COUNT(*) AS total FROM messages WHERE file_id = ?")
        .bind(file.id).first();
      if (references?.total) continue;
      await DB.prepare("DELETE FROM files WHERE id = ?").bind(file.id).run();
      if (R2 && file.r2_key) {
        try {
          await R2.delete(file.r2_key);
          deletedFiles++;
        } catch (error) {
          console.error("清理已删除聊天的文件失败:", error);
        }
      }
    }
    await DB.prepare("DELETE FROM conversations WHERE id = ?").bind(conversationId).run();
    return c.json({
      success: true,
      data: { deletedMessages: deletedMessages.meta.changes || 0, deletedFiles },
    });
  } catch (error) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// 获取消息列表
api.get("/messages", async (c) => {
  try {
    const { DB } = c.env;
    const limit = Number(c.req.query("limit") || 50);
    const offset = Number(c.req.query("offset") || 0);
    const conversationId = Number(c.req.query("conversationId") || 1);
    if (!Number.isSafeInteger(conversationId) || conversationId < 1) {
      return c.json({ success: false, error: "会话编号无效" }, 400);
    }

    const stmt = DB.prepare(`
      SELECT
        m.id,
        m.type,
        m.content,
        m.device_id,
        m.timestamp,
        m.conversation_id,
        f.original_name,
        f.file_size,
        f.mime_type,
        f.r2_key
      FROM messages m
      LEFT JOIN files f ON m.file_id = f.id
      WHERE m.conversation_id = ?
      ORDER BY m.timestamp ASC, m.id ASC
      LIMIT ? OFFSET ?
    `);

    const result = await stmt.bind(conversationId, limit, offset).all();

    return c.json({
      success: true,
      data: result.results,
      total: result.results.length,
    });
  } catch (error) {
    return c.json(
      {
        success: false,
        error: error.message,
      },
      500
    );
  }
});

// 发送文本消息
api.post("/messages", async (c) => {
  try {
    const { DB } = c.env;
    const { content, deviceId, type = "text", conversationId = 1 } = await c.req.json();
    const normalizedConversationId = Number(conversationId);

    if (!content || !deviceId) {
      return c.json(
        {
          success: false,
          error: "内容和设备ID不能为空",
        },
        400
      );
    }

    const conversation = await DB.prepare("SELECT id FROM conversations WHERE id = ?")
      .bind(normalizedConversationId).first();
    if (!conversation) return c.json({ success: false, error: "会话不存在" }, 404);

    const stmt = DB.prepare(`
      INSERT INTO messages (conversation_id, type, content, device_id)
      VALUES (?, ?, ?, ?)
    `);

    const result = await stmt.bind(normalizedConversationId, type, content, deviceId).run();
    await DB.prepare("UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?")
      .bind(normalizedConversationId).run();

    return c.json({
      success: true,
      data: { id: result.meta.last_row_id },
    });
  } catch (error) {
    return c.json(
      {
        success: false,
        error: error.message,
      },
      500
    );
  }
});

// 删除单条消息
api.delete("/messages/:id", async (c) => {
  try {
    const { DB, R2 } = c.env;
    const messageId = Number(c.req.param("id"));
    const conversationId = Number(c.req.query("conversationId") || 1);

    if (!Number.isSafeInteger(messageId) || messageId <= 0) {
      return c.json({ success: false, error: "消息ID无效" }, 400);
    }

    const message = await DB.prepare(`
      SELECT m.id, m.file_id, f.r2_key
      FROM messages m
      LEFT JOIN files f ON m.file_id = f.id
      WHERE m.id = ? AND m.conversation_id = ?
    `)
      .bind(messageId, conversationId)
      .first();

    if (!message) {
      return c.json({ success: false, error: "消息不存在" }, 404);
    }

    await DB.prepare("DELETE FROM messages WHERE id = ?")
      .bind(messageId)
      .run();

    if (message.file_id) {
      const references = await DB.prepare(
        "SELECT COUNT(*) AS total FROM messages WHERE file_id = ?"
      )
        .bind(message.file_id)
        .first();

      if (!references?.total) {
        await DB.prepare("DELETE FROM files WHERE id = ?")
          .bind(message.file_id)
          .run();

        if (R2 && message.r2_key) {
          try {
            await R2.delete(message.r2_key);
          } catch (error) {
            console.error("删除文件对象失败:", error);
          }
        }
      }
    }

    return c.json({ success: true, data: { id: messageId } });
  } catch (error) {
    console.error("删除消息失败:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// AI消息处理接口
api.post("/ai/message", async (c) => {
  try {
    const { DB } = c.env;
    const { content, deviceId, type = "ai_response", conversationId = 1 } = await c.req.json();
    const normalizedConversationId = Number(conversationId);

    if (!content || !deviceId) {
      return c.json(
        {
          success: false,
          error: "内容和设备ID不能为空",
        },
        400
      );
    }

    // 将AI消息作为特殊的文本消息存储，在内容前添加标识符
    let messageContent = content;
    if (type === "ai_response") {
      messageContent = `[AI] ${content}`;
    } else if (type === "ai_thinking") {
      messageContent = `[AI-THINKING] ${content}`;
    }

    const conversation = await DB.prepare("SELECT id FROM conversations WHERE id = ?")
      .bind(normalizedConversationId).first();
    if (!conversation) return c.json({ success: false, error: "会话不存在" }, 404);

    // 存储AI消息到数据库（使用text类型）
    const stmt = DB.prepare(`
      INSERT INTO messages (conversation_id, type, content, device_id)
      VALUES (?, ?, ?, ?)
    `);

    const result = await stmt.bind(normalizedConversationId, "text", messageContent, deviceId).run();
    await DB.prepare("UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?")
      .bind(normalizedConversationId).run();

    return c.json({
      success: true,
      data: {
        id: result.meta.last_row_id,
        type: "text",
        content: messageContent,
        device_id: deviceId,
        timestamp: new Date().toISOString(),
        originalType: type,
      },
    });
  } catch (error) {
    console.error("AI消息存储失败:", error);
    return c.json(
      {
        success: false,
        error: error.message,
      },
      500
    );
  }
});

// 文件上传
api.post("/files/upload", async (c) => {
  try {
    const { DB, R2 } = c.env;
    const formData = await c.req.formData();
    const file = formData.get("file");
    const deviceId = formData.get("deviceId");
    const conversationId = Number(formData.get("conversationId") || 1);

    if (!file || !deviceId) {
      return c.json(
        {
          success: false,
          error: "文件和设备ID不能为空",
        },
        400
      );
    }

    const conversation = await DB.prepare("SELECT id FROM conversations WHERE id = ?")
      .bind(conversationId).first();
    if (!Number.isSafeInteger(conversationId) || !conversation) {
      return c.json({ success: false, error: "会话不存在" }, 404);
    }

    // 检查文件大小限制（10MB）
    if (file.size > 100 * 1024 * 1024) {
      return c.json(
        {
          success: false,
          error: "文件大小不能超过10MB",
        },
        400
      );
    }

    // 生成唯一的文件名
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2);
    const fileExtension = file.name.split(".").pop() || "bin";
    const r2Key = `${timestamp}-${randomStr}.${fileExtension}`;

    // 上传到R2
    try {
      await R2.put(r2Key, file.stream(), {
        httpMetadata: {
          contentType: file.type || "application/octet-stream",
          contentDisposition: `attachment; filename="${file.name}"`,
        },
      });
    } catch (r2Error) {
      console.error("R2上传失败:", r2Error);
      return c.json(
        {
          success: false,
          error: `文件上传到存储失败: ${r2Error.message}`,
        },
        500
      );
    }

    // 保存文件信息到数据库
    try {
      const fileStmt = DB.prepare(`
        INSERT INTO files (original_name, file_name, file_size, mime_type, r2_key, upload_device_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      const fileResult = await fileStmt
        .bind(
          file.name,
          r2Key,
          file.size,
          file.type || "application/octet-stream",
          r2Key,
          deviceId
        )
        .run();

      // 创建文件消息
      const messageStmt = DB.prepare(`
        INSERT INTO messages (conversation_id, type, file_id, device_id)
        VALUES (?, ?, ?, ?)
      `);

      await messageStmt
        .bind(conversationId, "file", fileResult.meta.last_row_id, deviceId)
        .run();
      await DB.prepare("UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?")
        .bind(conversationId).run();

      return c.json({
        success: true,
        data: {
          fileId: fileResult.meta.last_row_id,
          fileName: file.name,
          fileSize: file.size,
          r2Key: r2Key,
        },
      });
    } catch (dbError) {
      console.error("数据库操作失败:", dbError);
      // 如果数据库操作失败，尝试删除已上传的R2文件
      try {
        await R2.delete(r2Key);
      } catch (deleteError) {
        console.error("清理R2文件失败:", deleteError);
      }

      return c.json(
        {
          success: false,
          error: `数据库操作失败: ${dbError.message}`,
        },
        500
      );
    }
  } catch (error) {
    console.error("文件上传总体失败:", error);
    return c.json(
      {
        success: false,
        error: `文件上传失败: ${error.message}`,
      },
      500
    );
  }
});

// 文件下载
api.get("/files/download/:r2Key", async (c) => {
  try {
    const { DB, R2 } = c.env;
    const r2Key = c.req.param("r2Key");

    // 获取文件信息
    const stmt = DB.prepare(`
      SELECT * FROM files WHERE r2_key = ?
    `);
    const fileInfo = await stmt.bind(r2Key).first();

    if (!fileInfo) {
      return c.json(
        {
          success: false,
          error: "文件不存在",
        },
        404
      );
    }

    // 从R2获取文件
    const object = await R2.get(r2Key);

    if (!object) {
      return c.json(
        {
          success: false,
          error: "文件不存在",
        },
        404
      );
    }

    // 更新下载次数
    const updateStmt = DB.prepare(`
      UPDATE files SET download_count = download_count + 1 WHERE r2_key = ?
    `);
    await updateStmt.bind(r2Key).run();

    return new Response(object.body, {
      headers: {
        "Content-Type": fileInfo.mime_type,
        "Content-Disposition": `attachment; filename="${fileInfo.original_name}"`,
        "Content-Length": fileInfo.file_size.toString(),
      },
    });
  } catch (error) {
    return c.json(
      {
        success: false,
        error: error.message,
      },
      500
    );
  }
});

// 调试接口 - 检查文件上传状态
api.get("/debug/upload-status", async (c) => {
  try {
    const { DB, R2 } = c.env;

    return c.json({
      success: true,
      data: {
        hasDB: !!DB,
        hasR2: !!R2,
        timestamp: new Date().toISOString(),
        workerVersion: "2024-12-23-v2",
      },
    });
  } catch (error) {
    return c.json(
      {
        success: false,
        error: error.message,
      },
      500
    );
  }
});

// 搜索功能 - 强大的多条件搜索
api.get("/search", async (c) => {
  try {
    const { DB } = c.env;
    const query = c.req.query("q");
    const type = c.req.query("type") || "all";
    const timeRange = c.req.query("timeRange") || "all";
    const deviceId = c.req.query("deviceId") || "all";
    const fileType = c.req.query("fileType") || "all";
    const conversationId = Number(c.req.query("conversationId") || 1);
    const limit = parseInt(c.req.query("limit") || "100");
    const offset = parseInt(c.req.query("offset") || "0");

    if (!query || query.trim().length === 0) {
      return c.json(
        {
          success: false,
          error: "搜索关键词不能为空",
        },
        400
      );
    }

    const normalizedQuery = query.trim();
    const matchConditions = [];
    const joinConditions = [];
    const params = [];

    // 文本搜索条件
    if (type === "all" || type === "text") {
      matchConditions.push(`(m.content LIKE ? AND m.type = 'text')`);
      params.push(`%${normalizedQuery}%`);
    }

    if (type === "all" || type === "file") {
      joinConditions.push("LEFT JOIN files f ON m.file_id = f.id");
      matchConditions.push(`(f.original_name LIKE ? AND m.type = 'file')`);
      params.push(`%${normalizedQuery}%`);
    }

    // 如果只搜索文件但没有JOIN，则添加JOIN
    if (type === "file" && joinConditions.length === 0) {
      joinConditions.push("LEFT JOIN files f ON m.file_id = f.id");
    }

    // 时间范围过滤
    params.unshift(conversationId);
    const whereConditions = [
      `m.conversation_id = ?`,
      `(${matchConditions.join(" OR ")})`,
    ];

    if (timeRange !== "all") {
      switch (timeRange) {
        case "today":
          whereConditions.push(`m.timestamp >= date('now', 'start of day')`);
          break;
        case "yesterday":
          whereConditions.push(
            `m.timestamp >= date('now', '-1 day', 'start of day') AND m.timestamp < date('now', 'start of day')`
          );
          break;
        case "week":
          whereConditions.push(`m.timestamp >= date('now', '-7 days')`);
          break;
        case "month":
          whereConditions.push(`m.timestamp >= date('now', '-30 days')`);
          break;
      }
    }

    // 设备过滤
    if (deviceId !== "all") {
      whereConditions.push(`m.device_id = ?`);
      params.push(deviceId);
    }

    // 文件类型过滤
    if (fileType !== "all" && (type === "all" || type === "file")) {
      // 确保有文件表的JOIN
      if (joinConditions.length === 0) {
        joinConditions.push("LEFT JOIN files f ON m.file_id = f.id");
      }

      // 文件类型映射
      const fileTypeMap = {
        image: [
          "image/jpeg",
          "image/jpg",
          "image/png",
          "image/gif",
          "image/bmp",
          "image/svg+xml",
          "image/webp",
        ],
        video: [
          "video/mp4",
          "video/avi",
          "video/mov",
          "video/wmv",
          "video/mkv",
          "video/flv",
          "video/webm",
        ],
        audio: [
          "audio/mp3",
          "audio/wav",
          "audio/aac",
          "audio/flac",
          "audio/ogg",
          "audio/m4a",
        ],
        document: [
          "application/pdf",
          "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ],
        archive: [
          "application/zip",
          "application/x-rar-compressed",
          "application/x-7z-compressed",
        ],
        text: [
          "text/plain",
          "text/html",
          "text/css",
          "text/javascript",
          "text/markdown",
        ],
        code: ["application/javascript", "application/json", "application/xml"],
      };

      const mimeTypes = fileTypeMap[fileType] || [];
      if (mimeTypes.length > 0) {
        const mimeConditions = mimeTypes
          .map(() => "f.mime_type = ?")
          .join(" OR ");
        whereConditions.push(`(m.type = 'file' AND (${mimeConditions}))`);
        params.push(...mimeTypes);
      }
    }

    // 如果没有WHERE条件，返回错误
    if (whereConditions.length === 0) {
      return c.json(
        {
          success: false,
          error: "无效的搜索条件",
        },
        400
      );
    }

    // 构建完整查询
    const joinClause =
      joinConditions.length > 0 ? joinConditions.join(" ") : "";
    const whereClause =
      whereConditions.length > 0
        ? `WHERE (${whereConditions.join(" AND ")})`
        : "";

    let selectFields = `
      m.id,
      m.type,
      m.content,
      m.device_id,
      m.timestamp,
      f.original_name,
      f.file_size,
      f.mime_type,
      f.r2_key
    `;

    // 总数查询
    const countQuery = `
      SELECT COUNT(DISTINCT m.id) as total
      FROM messages m
      ${joinClause}
      ${whereClause}
    `;

    // 数据查询
    const dataQuery = `
      SELECT ${selectFields}
      FROM messages m
      ${joinClause}
      ${whereClause}
      ORDER BY m.timestamp DESC
      LIMIT ? OFFSET ?
    `;

    // 执行查询
    const countStmt = DB.prepare(countQuery);
    const dataStmt = DB.prepare(dataQuery);

    // 为计数查询添加参数
    const countParams = [...params];

    // 为数据查询添加分页参数
    const dataParams = [...params, limit, offset];

    const [countResult, dataResult] = await Promise.all([
      countStmt.bind(...countParams).first(),
      dataStmt.bind(...dataParams).all(),
    ]);

    return c.json({
      success: true,
      data: dataResult.results || [],
      total: countResult.total || 0,
      limit,
      offset,
      query: {
        q: query,
        type,
        timeRange,
        deviceId,
        fileType,
        conversationId,
      },
    });
  } catch (error) {
    console.error("搜索失败:", error);
    return c.json(
      {
        success: false,
        error: `搜索失败: ${error.message}`,
      },
      500
    );
  }
});

// 搜索建议接口
api.get("/search/suggestions", async (c) => {
  try {
    const { DB } = c.env;
    const query = c.req.query("q");
    const conversationId = Number(c.req.query("conversationId") || 1);

    if (!query || query.trim().length < 2) {
      return c.json({
        success: true,
        data: [],
      });
    }

    // 获取最近的相关搜索词（基于消息内容）
    const stmt = DB.prepare(`
      SELECT DISTINCT 
        CASE 
          WHEN m.type = 'text' THEN substr(m.content, 1, 50)
          WHEN m.type = 'file' THEN f.original_name
          ELSE '未知'
        END as suggestion
      FROM messages m
      LEFT JOIN files f ON m.file_id = f.id
      WHERE m.conversation_id = ? AND suggestion LIKE ?
      ORDER BY m.timestamp DESC
      LIMIT 10
    `);

    const result = await stmt.bind(conversationId, `%${query}%`).all();

    return c.json({
      success: true,
      data: result.results?.map((row) => row.suggestion) || [],
    });
  } catch (error) {
    console.error("搜索建议失败:", error);
    return c.json({
      success: true,
      data: [], // 建议功能失败时静默处理
    });
  }
});

// 设备同步
api.post("/sync", async (c) => {
  try {
    const { DB } = c.env;
    const { deviceId, deviceName } = await c.req.json();

    // 更新或插入设备信息
    const stmt = DB.prepare(`
      INSERT OR REPLACE INTO devices (id, name, last_active)
      VALUES (?, ?, CURRENT_TIMESTAMP)
    `);

    await stmt.bind(deviceId, deviceName || "未知设备").run();

    return c.json({
      success: true,
      message: "设备同步成功",
    });
  } catch (error) {
    return c.json(
      {
        success: false,
        error: error.message,
      },
      500
    );
  }
});

// 数据清理 - 清空所有数据
api.delete("/conversations/:id/messages", async (c) => {
  try {
    const { DB, R2 } = c.env;
    const conversationId = Number(c.req.param("id"));
    if (!Number.isSafeInteger(conversationId) || conversationId < 1) {
      return c.json({ success: false, error: "会话编号无效" }, 400);
    }
    const conversation = await DB.prepare("SELECT id FROM conversations WHERE id = ?")
      .bind(conversationId).first();
    if (!conversation) return c.json({ success: false, error: "会话不存在" }, 404);
    const files = await DB.prepare(`
      SELECT DISTINCT f.id, f.r2_key
      FROM files f JOIN messages m ON m.file_id = f.id
      WHERE m.conversation_id = ?
    `).bind(conversationId).all();
    const deleted = await DB.prepare("DELETE FROM messages WHERE conversation_id = ?")
      .bind(conversationId).run();
    let deletedFiles = 0;
    for (const file of files.results || []) {
      const references = await DB.prepare("SELECT COUNT(*) AS total FROM messages WHERE file_id = ?")
        .bind(file.id).first();
      if (references?.total) continue;
      await DB.prepare("DELETE FROM files WHERE id = ?").bind(file.id).run();
      try {
        await R2.delete(file.r2_key);
        deletedFiles++;
      } catch (error) {
        console.error("清理会话文件失败:", error);
      }
    }
    await DB.prepare("UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?")
      .bind(conversationId).run();
    return c.json({
      success: true,
      data: { deletedMessages: deleted.meta.changes || 0, deletedFiles },
    });
  } catch (error) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

api.post("/clear-all", async (c) => {
  try {
    const { DB, R2 } = c.env;
    const { confirmCode } = await c.req.json();

    // 简单的确认码验证
    if (confirmCode !== "1234") {
      return c.json(
        {
          success: false,
          error: "确认码错误，请输入正确的确认码",
        },
        400
      );
    }

    // 统计清理前的数据
    const messageCountStmt = DB.prepare(
      "SELECT COUNT(*) as count FROM messages"
    );
    const fileCountStmt = DB.prepare(
      "SELECT COUNT(*) as count, COALESCE(SUM(file_size), 0) as totalSize FROM files"
    );

    const messageCount = await messageCountStmt.first();
    const fileStats = await fileCountStmt.first();

    // 获取所有文件的R2 keys
    const filesStmt = DB.prepare("SELECT r2_key FROM files");
    const files = await filesStmt.all();

    // 删除R2中的所有文件
    let deletedFilesCount = 0;
    for (const file of files.results) {
      try {
        await R2.delete(file.r2_key);
        deletedFilesCount++;
      } catch (error) {
        // 静默处理R2删除失败
      }
    }

    // 清空数据库表（使用事务确保原子性）
    const deleteMessagesStmt = DB.prepare("DELETE FROM messages");
    const deleteFilesStmt = DB.prepare("DELETE FROM files");
    const deleteDevicesStmt = DB.prepare("DELETE FROM devices");

    // 执行删除操作
    await deleteMessagesStmt.run();
    await deleteFilesStmt.run();
    await deleteDevicesStmt.run();

    return c.json({
      success: true,
      data: {
        deletedMessages: messageCount.count,
        deletedFiles: fileStats.count,
        deletedFileSize: fileStats.totalSize,
        deletedR2Files: deletedFilesCount,
        message: "所有数据已成功清理",
      },
    });
  } catch (error) {
    return c.json(
      {
        success: false,
        error: error.message,
      },
      500
    );
  }
});

// Server-Sent Events 实时通信
api.get("/events", async (c) => {
  const deviceId = c.req.query("deviceId");

  if (!deviceId) {
    return c.json({ error: "设备ID不能为空" }, 400);
  }

  try {
    // 设置SSE响应头
    const headers = new Headers({
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Cache-Control",
    });

    // 创建可读流
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    // 发送SSE消息的辅助函数
    const sendSSE = (data, event = "message") => {
      const message = `event: ${event}\ndata: ${data}\n\n`;
      writer.write(encoder.encode(message));
    };

    // 发送连接确认
    sendSSE("connected", "connection");

    // 定期发送心跳
    const heartbeat = setInterval(() => {
      try {
        sendSSE("ping", "heartbeat");
      } catch (error) {
        clearInterval(heartbeat);
      }
    }, 30000);

    // 监听新消息
    const checkMessages = setInterval(async () => {
      try {
        const { DB } = c.env;
        if (!DB) {
          return;
        }

        const stmt = DB.prepare(`
          SELECT id
          FROM conversations
          WHERE updated_at > datetime('now', '-10 seconds')
        `);
        const result = await stmt.all();
        const conversationIds = result.results?.map((row) => row.id) || [];

        if (conversationIds.length > 0) {
          sendSSE(JSON.stringify({
            newMessages: conversationIds.length,
            conversationIds,
          }), "message");
        }
      } catch (error) {
        // 静默处理SSE消息检查失败
      }
    }, 5000);

    // 处理连接关闭
    const cleanup = () => {
      clearInterval(heartbeat);
      clearInterval(checkMessages);
      try {
        writer.close();
      } catch (error) {
        // 静默处理writer关闭失败
      }
    };

    // 设置超时清理（防止连接泄漏）
    const timeout = setTimeout(cleanup, 300000); // 5分钟超时

    // 监听中断信号
    c.req.signal?.addEventListener("abort", () => {
      clearTimeout(timeout);
      cleanup();
    });

    return new Response(readable, { headers });
  } catch (error) {
    return c.json(
      {
        success: false,
        error: `SSE连接失败: ${error.message}`,
      },
      500
    );
  }
});

// 长轮询接口（SSE降级方案）
api.get("/poll", async (c) => {
  try {
    const { DB } = c.env;
    const deviceId = c.req.query("deviceId");
    const lastMessageId = c.req.query("lastMessageId") || "0";
    const conversationId = Number(c.req.query("conversationId") || 1);
    const timeout = parseInt(c.req.query("timeout") || "30"); // 30秒超时

    if (!deviceId) {
      return c.json({ error: "设备ID不能为空" }, 400);
    }

    if (!DB) {
      return c.json({ error: "数据库未绑定" }, 500);
    }

    const startTime = Date.now();
    const maxWaitTime = Math.min(timeout * 1000, 30000); // 最大30秒

    // 轮询检查新消息
    while (Date.now() - startTime < maxWaitTime) {
      const stmt = DB.prepare(`
        SELECT COUNT(*) as count
        FROM messages
        WHERE conversation_id = ? AND id > ?
      `);
      const result = await stmt.bind(conversationId, lastMessageId).first();

      if (result && result.count > 0) {
        // 有新消息，立即返回
        return c.json({
          success: true,
          hasNewMessages: true,
          newMessageCount: result.count,
          timestamp: new Date().toISOString(),
        });
      }

      // 等待1秒后再次检查
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    // 超时，返回无新消息
    return c.json({
      success: true,
      hasNewMessages: false,
      newMessageCount: 0,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return c.json(
      {
        success: false,
        error: error.message,
      },
      500
    );
  }
});

// 挂载鉴权API路由（无需认证）
app.route("/api/auth", authApi);

// 应用鉴权中间件到所有路由
app.use("*", authMiddleware);

// 挂载API路由（需要认证）
app.route("/api", api);

// 静态文件服务 - 使用getAssetFromKV
app.get("*", async (c) => {
  try {
    return await getAssetFromKV(c.env, {
      request: c.req.raw,
      waitUntil: c.executionCtx.waitUntil.bind(c.executionCtx),
    });
  } catch (e) {
    // 如果找不到文件，返回index.html
    try {
      return await getAssetFromKV(c.env, {
        request: new Request(new URL("/index.html", c.req.url).toString()),
        waitUntil: c.executionCtx.waitUntil.bind(c.executionCtx),
      });
    } catch {
      return c.text("Not Found", 404);
    }
  }
});

export default app;

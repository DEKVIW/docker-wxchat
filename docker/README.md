# 微信文件传输助手 - Docker 版本

这是微信文件传输助手的 Docker 部署版本，与 Cloudflare Workers 版本完全独立。

## 🚀 快速开始

### 1. 配置环境变量

```bash
cd docker
cp env.example .env
# 编辑 .env 文件修改密码等配置
```

### 2. 构建并启动

```bash
docker-compose up -d
```

### 3. 访问应用

打开浏览器访问：http://localhost:3000

### 4. 登录

- 默认密码：`3zHb0d44eW^mzLj`
- 可在 `.env` 文件中修改 `ACCESS_PASSWORD` 环境变量

## 📁 目录结构

```
docker/
├── .dockerignore          # Docker构建忽略文件
├── Dockerfile            # Docker镜像构建文件
├── docker-compose.yml    # Docker Compose配置
├── env.example           # 环境变量配置示例
├── .env                  # 环境变量配置（需要创建）
├── server.js             # Node.js服务器
├── package.json          # 依赖配置
├── deploy.sh             # 一键部署脚本
└── README.md             # 说明文档
```

## 🔧 配置说明

### 环境变量

所有环境变量都在 `.env` 文件中配置：

- `ACCESS_PASSWORD`: 访问密码（默认：3zHb0d44eW^mzLj）
- `JWT_SECRET`: JWT 密钥
- `SESSION_EXPIRE_HOURS`: 会话过期时间（小时）
- `MAX_LOGIN_ATTEMPTS`: 最大登录尝试次数
- `DATABASE_PATH`: 数据库文件路径
- `UPLOAD_PATH`: 文件上传目录
- `NODE_ENV`: 运行环境（production/development）
- `PORT`: 服务端口

### 数据持久化

- 数据库文件：`../data/wxchat.db`
- 上传文件：`../uploads/`

## 📊 功能特性

### ✅ 已实现功能

- 用户认证（JWT）
- 消息发送和接收
- 文件上传和下载
- 实时通信（SSE）
- 消息搜索
- 数据清理
- 设备同步

### 🔄 与 Cloudflare 版本的区别

- 使用 SQLite 替代 D1 数据库
- 使用本地文件系统替代 R2 存储
- 使用 Express 替代 Hono 框架
- 使用 Node.js 替代 Cloudflare Workers

## 🛠️ 开发模式

### 本地开发

```bash
cd docker
npm install
npm run dev
```

### 重新构建

```bash
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

## 📝 常用命令

```bash
# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down

# 重启服务
docker-compose restart

# 进入容器
docker-compose exec wxchat sh

# 查看容器状态
docker-compose ps
```

## 🔍 故障排除

### 1. 端口冲突

如果 3000 端口被占用，修改 `docker-compose.yml` 中的端口映射：

```yaml
ports:
  - "3001:3000" # 改为3001端口
```

### 2. 权限问题

确保数据目录有正确的权限：

```bash
chmod 755 ../data ../uploads
```

### 3. 数据库问题

重新初始化数据库：

```bash
docker-compose exec wxchat ./init-db.sh
```

## 📈 性能优化

### 1. 数据库优化

- 已创建必要的索引
- 支持分页查询
- 自动清理过期数据

### 2. 文件存储

- 支持大文件上传（最大 100MB）
- 自动生成唯一文件名
- 支持断点续传（可扩展）

### 3. 实时通信

- SSE 长连接
- 自动重连机制
- 心跳检测

## 🔒 安全说明

- 使用 JWT 进行身份认证
- 文件上传类型检查
- 访问频率限制
- 数据清理确认机制

## 📞 支持

如有问题，请查看：

1. 容器日志：`docker-compose logs`
2. 数据库文件：`../data/wxchat.db`
3. 上传文件：`../uploads/`

---

**注意**: 此 Docker 版本与 Cloudflare Workers 版本完全独立，数据不互通。

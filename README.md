# 微信文件传输助手 Docker 版本

## 项目简介

基于 [xiyewuqiu/wxchat](https://github.com/xiyewuqiu/wxchat) 开发的微信文件传输助手，使用 Docker 容器化部署，支持 AI 聊天和图片生成功能。

##  主要功能

- **跨设备文件传输** - 支持手机、电脑、平板等设备间文件传输
-  **AI 智能聊天** - 集成 AI 聊天功能，支持多种 AI 模型
-  **AI 图片生成** - 支持 AI 图片生成功能
-  **文件管理** - 支持各种文件类型的上传、下载、预览
-  **安全认证** - JWT 认证机制，保障数据安全
-  **PWA 支持** - 支持安装为桌面应用

###  Docker 版本优化

#### 用户体验优化

-  **长文本显示优化** - 长文本消息不会截断，完整显示内容
-  **滑动确认清空** - 清空数据使用滑动方法，无需再输入密码，操作更便捷
-  **一键复制功能** - 支持一键复制消息内容，方便快速分享
- **单条消息删除** - 支持删除单条消息，灵活管理聊天记录
-  **时间显示修正** - 修正了前端时间显示，时间格式更准确

#### 连接与状态优化

- **智能连接状态** - 智能显示连接状态，实时反馈网络连接情况
- **连接状态管理** - 优化连接状态逻辑，避免误显示"连接中"状态

#### 配置与性能优化

- **环境变量配置** - 添加 AI 模式、最大文件上传大小等环境变量，方便灵活配置
- **文件传输优化** - 优化上传和下载进度显示，动态显示下载和上传速度（MB/s 或 KB/s）
-  **消息加载优化** - 支持一次性加载最多 100000 条消息，默认加载 5000 条
-  **历史消息保留** - 修复消息数超过限制时历史消息被删除的问题
-  **滚动位置保持** - 修复用户向上滚动查看历史消息时自动跳回底部的问题
-  **自动刷新优化** - 自动刷新频率从 1 秒优化为 5 秒，减少不必要的请求

##  快速开始

### 一键部署

```bash
# 克隆项目
git clone https://github.com/DEKVIW/docker-wxchat.git
cd docker-wxchat

# 进入 Docker 目录
cd docker

# 复制环境配置文件
cp env.example .env

# 编辑配置文件（重要！）
nano .env

# 启动服务
docker-compose up -d

# 查看服务状态
docker-compose ps
```

### 访问应用

- **Web 界面**: http://localhost:3000
- **默认密码**: 123456

### 自打包镜像

如果需要自己构建 Docker 镜像，只需要以下三个目录即可：

#### 所需目录结构

```
项目根目录/
├── docker/          # Docker相关文件
│   ├── Dockerfile
│   ├── docker-compose.yml
│   ├── server.js
│   ├── package.json
│   ├── env.example
│   └── deploy.sh
├── database/        # 数据库schema
│   └── schema.sql
└── public/          # 前端文件
    ├── index.html
    ├── js/
    ├── css/
    └── ...
```

#### 构建步骤

1. **确保目录结构正确**（三个目录在同一父目录下）

2. **进入 docker 目录**：

   ```bash
   cd docker
   ```

3. **准备环境变量**（如果还没有）：

   ```bash
   cp env.example .env
   # 编辑 .env 文件修改配置
   ```

4. **执行构建**：

   ```bash
   # 方式1：使用部署脚本（推荐）
   chmod +x deploy.sh
   ./deploy.sh
   
   # 方式2：手动构建
   docker-compose build
   docker-compose up -d
   ```

#### 重要说明

- 构建上下文是项目根目录（`docker-compose.yml` 中 `context: ..`）
- 这三个目录必须在同一父目录下
- 需要在 `docker` 目录下执行构建命令
- 确保 `docker` 目录下有 `.env` 文件（或从 `env.example` 复制）

## 配置说明

### 基础配置

```bash
# 应用配置
NODE_ENV=production
PORT=3000

# 安全配置（必须修改）
ACCESS_PASSWORD=your_strong_password_here
JWT_SECRET=your_jwt_secret_key_here

# 文件上传配置
MAX_FILE_SIZE_MB=100
```

### AI 功能配置

```bash
# AI 聊天配置
AI_CHAT_BASE_URL=https://api.example.com/v1/chat/completions
AI_CHAT_API_KEY=your_ai_chat_api_key_here
AI_CHAT_MODEL=gpt-4o-mini

# AI 图片生成配置
AI_IMAGE_BASE_URL=https://api.example.com/v1/images/generations
AI_IMAGE_API_KEY=your_ai_image_api_key_here
AI_IMAGE_MODEL=example-model

# 功能开关
AI_ENABLED=true
IMAGE_GEN_ENABLED=true
```

## 开源协议

本项目遵循 [CC BY-NC-SA 4.0](https://github.com/xiyewuqiu/wxchat/blob/main/LICENSE) 开源协议。

**⚠️ 重要声明**：本项目仅用于学习和研究目的，禁止用于商业用途。

##  致谢

感谢原项目作者 [xiyewuqiu](https://github.com/xiyewuqiu) 提供的优秀基础代码。

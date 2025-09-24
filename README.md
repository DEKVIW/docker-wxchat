# 微信文件传输助手 Docker 版本

## 项目简介

基于 [xiyewuqiu/wxchat](https://github.com/xiyewuqiu/wxchat) 开发的微信文件传输助手，使用 Docker 容器化部署，支持 AI 聊天和图片生成功能。

## ✨ 主要功能

- 📱 **跨设备文件传输** - 支持手机、电脑、平板等设备间文件传输
- 🤖 **AI 智能聊天** - 集成 AI 聊天功能，支持多种 AI 模型
- 🎨 **AI 图片生成** - 支持 AI 图片生成功能
- 📁 **文件管理** - 支持各种文件类型的上传、下载、预览
- 🔒 **安全认证** - JWT 认证机制，保障数据安全
- 📱 **PWA 支持** - 支持安装为桌面应用

## 🚀 快速开始

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

## ⚙️ 配置说明

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

## 📄 开源协议

本项目遵循 [CC BY-NC-SA 4.0](https://github.com/xiyewuqiu/wxchat/blob/main/LICENSE) 开源协议。

**⚠️ 重要声明**：本项目仅用于学习和研究目的，禁止用于商业用途。

## 🙏 致谢

感谢原项目作者 [xiyewuqiu](https://github.com/xiyewuqiu) 提供的优秀基础代码。

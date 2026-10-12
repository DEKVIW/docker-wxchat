FROM node:18-alpine

# 仅安装本地 SQLite 初始化工具；业务数据仍由容器内 Express + SQLite 管理
RUN apk add --no-cache sqlite

# 设置工作目录
WORKDIR /app

# 复制package文件
COPY docker/package.json ./
# 只安装生产依赖，清理缓存
RUN npm install --omit=dev && npm cache clean --force

# 复制源代码
COPY docker/server.js ./
COPY public/ ./public/
COPY database/schema.sql ./database/

# 创建数据目录
RUN mkdir -p /app/data /app/uploads

# 暴露端口
EXPOSE 3000

# 首次启动时创建本地数据库结构，然后启动 Express 服务
CMD ["sh", "-c", "echo '🔧 初始化数据库...' && mkdir -p /app/data /app/uploads && sqlite3 /app/data/wxchat.db < /app/database/schema.sql && echo '✅ 数据库初始化完成！' && echo '🚀 启动微信文件传输助手 Docker版本...' && node server.js"]

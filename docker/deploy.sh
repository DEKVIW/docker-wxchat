#!/bin/bash

echo "🚀 微信文件传输助手 Docker部署脚本"
echo "=================================="

# 检查Docker是否安装
if ! command -v docker &> /dev/null; then
    echo "❌ Docker未安装，请先安装Docker"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose未安装，请先安装Docker Compose"
    exit 1
fi

echo "✅ Docker环境检查通过"

# 创建数据目录
echo "📁 创建数据目录..."
mkdir -p ../data ../uploads
chmod 755 ../data ../uploads

# 检查环境配置文件
if [ ! -f .env ]; then
    echo "📝 创建环境配置文件..."
    cp env.example .env
    echo "⚠️  请编辑 .env 文件修改密码等配置"
fi

# 构建镜像
echo "🔨 构建Docker镜像..."
docker-compose build

if [ $? -ne 0 ]; then
    echo "❌ 镜像构建失败"
    exit 1
fi

echo "✅ 镜像构建成功"

# 启动服务
echo "🌐 启动服务..."
docker-compose up -d

if [ $? -ne 0 ]; then
    echo "❌ 服务启动失败"
    exit 1
fi

echo "✅ 服务启动成功"

# 等待服务就绪
echo "⏳ 等待服务就绪..."
sleep 10

# 检查服务状态
if curl -s http://localhost:3000/login.html > /dev/null; then
    echo "✅ 服务运行正常"
    echo ""
    echo "🎉 部署完成！"
    echo "📱 访问地址: http://localhost:3000"
    echo "🔐 默认密码: 3zHb0d44eW^mzLj"
    echo ""
    echo "📋 常用命令:"
    echo "  查看日志: docker-compose logs -f"
    echo "  停止服务: docker-compose down"
    echo "  重启服务: docker-compose restart"
else
    echo "⚠️  服务可能未完全启动，请稍后访问 http://localhost:3000"
fi

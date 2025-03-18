#!/bin/bash

cd "$(dirname "$0")"


# Station2 startup script (connects to Station1)
# 服务器2启动脚本（连接到服务器1）
echo "=========================================================="
echo "Starting Mountain of Many Voices - Station 2"
echo "启动众鸣山项目 - 服务器2"
echo "=========================================================="

# Check if .env file exists
# 检查.env文件是否存在
if [ ! -f .env ]; then
  echo "ERROR: No .env file found at $(pwd)/.env"
  echo "错误：未找到配置文件 .env"
  echo ""
  echo "Please create a .env file with the following content:"
  echo "请创建一个包含以下内容的.env文件："
  echo "-------------------------------------------"
  echo "PORT=3001"
  echo "CENTRAL_BACKEND_URL=http://STATION1_IP:3001"
  echo "-------------------------------------------"
  echo ""
  echo "Replace STATION1_IP with the IP address of Station 1"
  echo "将 STATION1_IP 替换为服务器1的IP地址"
  echo ""
  echo "Exiting... | 退出中..."
  exit 1
fi

# Already in the project directory
# 已经在项目目录中

# Start the server in production mode, with remote central backend
# 以生产模式启动服务器，连接到远程中央后端
echo "Starting server... | 正在启动服务器..."
npm run prod &
SERVER_PID=$!
# Open the station interface in the default browser after a short delay
# 短暂延迟后在默认浏览器中打开服务器界面

sleep 3
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --kiosk "http://localhost:3001/station1" &

echo "=========================================================="
echo "Station 2 is now running. To stop, close this terminal window."
echo "服务器2已启动。要停止服务，请关闭此终端窗口。或者使用组合键：Control + C"
echo "=========================================================="


# Ensure cleanup happens even if script is terminated
trap "echo 'Stopping server2...'; kill -TERM $SERVER_PID; wait $SERVER_PID" EXIT SIGINT SIGTERM

# Keep script alive while server runs
wait $SERVER_PID
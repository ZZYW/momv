#!/bin/bash

# Station2 startup script (connects to Station1)
# 服务器2启动脚本（连接到服务器1）
echo "=========================================================="
echo "Starting Mountain of Many Voices - Station 2"
echo "启动众鸣山项目 - 服务器2"
echo "=========================================================="

# Create .env file if it doesn't exist
# 如果.env文件不存在，则创建
if [ ! -f ~/.momv/.env ]; then
  echo "Creating .env file... | 创建环境配置文件..."
  mkdir -p ~/.momv
  
  # Prompt for Station1 IP if not provided
  # 如果未提供服务器1的IP，则提示输入
  echo "Enter Station1 IP address (or press Enter to enter it later):"
  echo "请输入服务器1的IP地址（或按Enter键稍后输入）："
  read STATION1_IP
  
  if [ -z "$STATION1_IP" ]; then
    STATION1_IP="192.168.1.50" # Default placeholder
    echo "Using placeholder IP. Please edit ~/.momv/.env with the correct Station1 IP"
    echo "使用默认IP。请编辑 ~/.momv/.env 文件，填入正确的服务器1 IP地址"
  fi
  
  cat > ~/.momv/.env << EOL
PORT=3001
CENTRAL_BACKEND_URL=http://${STATION1_IP}:3001
EOL
fi

# Navigate to project directory
# 进入项目目录
cd ~/momv

# Start the server in production mode, with remote central backend
# 以生产模式启动服务器，连接到远程中央后端
echo "Starting server... | 正在启动服务器..."
npm run prod &
SERVER_PID=$!
# Open the station interface in the default browser after a short delay
# 短暂延迟后在默认浏览器中打开服务器界面
sleep 3
open http://localhost:3001/station2

echo "=========================================================="
echo "Station 2 is now running. To stop, close this terminal window."
echo "服务器2已启动。要停止服务，请关闭此终端窗口。或者使用组合键：Control + C"
echo "=========================================================="


# Ensure cleanup happens even if script is terminated
trap "echo 'Stopping server2...'; kill -TERM $SERVER_PID; wait $SERVER_PID" EXIT SIGINT SIGTERM

# Keep script alive while server runs
wait $SERVER_PID
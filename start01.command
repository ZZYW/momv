#!/bin/bash

cd "$(dirname "$0")"

# Station1 startup script (main server with printer)
# 服务器1启动脚本（主服务器，带打印机）
echo "=========================================================="
echo "Starting Mountain of Many Voices - Station 1 (Main Server)"
echo "启动众鸣山项目 - 服务器1（主服务器）"
echo "Checking for printer connection... | 检查打印机连接..."
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
  echo "DASHSCOPE_API_KEY=your_dashscope_api_key"
  echo "PORT=3001"
  echo "-------------------------------------------"
  echo ""
  echo "Exiting... | 退出中..."
  exit 1
fi

# Already in the project directory
# 已经在项目目录中

# Get the current IP address for troubleshooting
# 获取当前IP地址以便故障排除
CURRENT_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null)
echo "Current IP address | 当前IP地址: $CURRENT_IP"
echo "Other stations should use this IP in their CENTRAL_BACKEND_URL"
echo "其他服务器应在CENTRAL_BACKEND_URL中使用此IP地址"

# Start the server in production mode
# 以展览模式启动
# Start server and track PID
npm run prod &
SERVER_PID=$!

# Open the station interface in Chrome kiosk mode after a short delay
sleep 3
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --kiosk "http://localhost:3001/station1" &

echo "=========================================================="
echo "Station 1 is now running. To stop, close this terminal window."
echo "服务器1已启动。要停止服务，请关闭此终端窗口。或者使用组合键：Control + C"
echo "=========================================================="

# Ensure cleanup happens even if script is terminated
trap "echo 'Stopping server1...'; kill -TERM $SERVER_PID; wait $SERVER_PID" EXIT SIGINT SIGTERM

# Keep script alive while server runs
wait $SERVER_PID

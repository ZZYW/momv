#!/bin/bash

# Station1 startup script (main server with printer)
# 服务器1启动脚本（主服务器，带打印机）
echo "=========================================================="
echo "Starting Mountain of Many Voices - Station 1 (Main Server)"
echo "启动众鸣山项目 - 服务器1（主服务器）"
echo "Checking for printer connection... | 检查打印机连接..."
echo "=========================================================="

# Create .env file if it doesn't exist
# 如果.env文件不存在，则创建
if [ ! -f ~/.momv/.env ]; then
  echo "Creating .env file... | 创建环境配置文件..."
  mkdir -p ~/.momv
  cat > ~/.momv/.env << EOL
DASHSCOPE_API_KEY=your_dashscope_api_key
PORT=3001
EOL
  echo "Please edit ~/.momv/.env with your DashScope API key"
  echo "请编辑 ~/.momv/.env 文件，填入正确的DashScope API密钥"
fi

# Navigate to project directory
# 进入项目目录
cd ~/momv

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



# Open the station interface in the default browser after a short delay
# 短暂延迟后在默认浏览器中打开服务器界面
sleep 3
open http://localhost:3001/station1

echo "=========================================================="
echo "Station 1 is now running. To stop, close this terminal window."
echo "服务器1已启动。要停止服务，请关闭此终端窗口。或者使用组合键：Control + C"
echo "=========================================================="


# Ensure cleanup happens even if script is terminated
trap "echo 'Stopping server1...'; kill -TERM $SERVER_PID; wait $SERVER_PID" EXIT SIGINT SIGTERM

# Keep script alive while server runs
wait $SERVER_PID


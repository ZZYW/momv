# 『众鸣山』两台服务器部署与自启动脚本指南

**日期**：2025/3/9  
**作者**：zzyw  

---

## 总览

- **Station1**  
  - 连接 Epson TM T82III 热敏打印机 (USB)。  
  - 作为主服务器，负责数据库与 AI (LLM) 接口调用。  
  - 需要在系统启动后，双击 `start01.sh` 快捷方式以启动服务。  

- **Station2**  
  - 无需打印机。  
  - 通过局域网与 Station1 同步故事进程。  
  - 系统启动后，双击 `start02.sh` 快捷方式即可运行并与 Station1 通信。  

---

## 1. 一次性设置（仅需首次布置或重装后执行）

以下步骤在每台机器上只需做**一次**。若已经完成且配置无变化，则无需重复。

### 1.1 macOS 基础环境

1. **安装 Node.js**（版本≥14）  
   - 访问 [Node.js 官方网站](https://nodejs.org/) 下载并安装稳定版。  
   - 安装完成后，在“终端”(Terminal) 输入：  
     ```bash
     node -v
     ```  
     若能显示 `v14.x.x` 或更高版本号，则安装成功。

2. **安装 Git**（如系统尚未自带）  
   - 在“终端”输入：  
     ```bash
     git --version
     ```  
     如果显示版本号，则表示已安装。  
   - 若提示“未找到命令”，执行：  
     ```bash
     xcode-select --install
     ```  
     并按提示完成安装。

### 1.2 获取项目代码

> **此步骤两台机器都需要执行**，但配置有所区别。

1. **打开“终端”**：  
   - 可从 Launchpad > “其他” > “终端”打开，或使用 Spotlight 搜索“Terminal”。
2. **进入默认目录**:
   ```bash
   cd ~
   ```
3. **下载代码**：
   ```bash
   git clone https://github.com/ZZYW/momv.git
   ```
   - 完成后，会生成一个 `momv` 文件夹。
4. **进入项目文件夹**：
   ```bash
   cd momv
   ```
5. **安装依赖**：
   ```bash
   npm install
   ```
6. **创建环境配置文件**：
   
   对于**Station 1**（主服务器）, 创建 `.env` 文件:
   ```bash
   echo "DASHSCOPE_API_KEY=your_dashscope_api_key" > .env
   echo "PORT=3001" >> .env
   ```
   将 `your_dashscope_api_key` 替换为提供的 API 密钥。
   
   对于**Station 2**, 创建 `.env` 文件:
   ```bash
   echo "PORT=3001" > .env
   echo "CENTRAL_BACKEND_URL=http://STATION1_IP:3001" >> .env
   ```
   将 `STATION1_IP` 替换为 Station 1 的 IP 地址（Station 1 启动时会显示）。

### 1.3 配置自启动脚本及快捷方式

1. **在桌面创建脚本快捷方式**  
   - 在 Finder 中，定位到 `momv` 文件夹下
     - 如果是服务器1，那就使用 `start01.sh`。如果是服务器2，那就使用 `start02.sh`。  
   - 按住 `Option + Command` 键，将该文件拖拽到桌面，会创建一个“别名”（Alias）。  
   - 也可以右键该文件 > “制作别名”，再将别名拖到桌面。  
2. **测试脚本双击是否可执行**  
   - 双击 `.sh` 文件有时会默认在“文本编辑”中打开。若发生这种情况，可右键点击脚本的别名 > “打开方式” > 选择“终端”或“Terminal.app”。  
   - 如出现安全提示“无法打开，因为来自身份不明的开发者”，可在“系统设置”>“隐私与安全”中允许此脚本通过。

---

## 2. Station1 的专属一次性设置

1. **连接热敏打印机**  
   - 使用 USB 线缆将 Epson TM T82III 连接到 Station1。  
   - 无需在 macOS “系统偏好设置”中添加驱动。  
2. **获取 Station1 的 IP**  
   - 在 Station1 的“终端”输入：  
     ```bash
     ipconfig getifaddr en0
     ```  
     若用 Wi-Fi 则可能需要 `ipconfig getifaddr en1`，视网卡接口名称而定。  
   - 记下此 IP（例如 `192.168.1.50`），更新 Station2 的 `.env` 文件中的 `CENTRAL_BACKEND_URL` 值。
     ```bash
     # 在 Station2 上，更新 .env 文件
     cd ~/momv
     echo "PORT=3001" > .env
     echo "CENTRAL_BACKEND_URL=http://192.168.1.50:3001" >> .env
     ```
     （将 `192.168.1.50` 替换为你获取到的 Station1 实际 IP 地址）

> 注意：如果网络环境变动，IP 改变，需要更新 Station2 的 `.env` 文件中的 IP 地址。

---

## 3. 每次开机都需执行的操作

当机器重新启动后，需要让服务自动运行。我们使用**脚本 + 快捷方式**简化此过程。

### 3.1 Station1 开机后

1. **确保打印机已通电且 USB 连接到 Station1。**  
2. **双击桌面上的 `start01.sh` 别名（或脚本）**  
3. **此时 Station1 的后台已经准备好**，可以在本机浏览器输入 `http://localhost:3001/station1` 测试打印。

### 3.2 Station2 开机后

1. **双击桌面上的 `start02.sh` 别名（或脚本）**  
2. **本机浏览器访问**：  
   ```
   http://localhost:3001/station2
   ```
   - 即可进行故事交互，后台数据由 Station1 提供并生成。

---

## 4. 更新项目（如有新版本）

当创作者提供新功能或补丁时，两台机器都可**在“终端”中执行以下命令**完成更新：

```bash
cd ~/momv
git pull
npm install
```

- 结束后，重新**双击**相应脚本`start01.sh`或`start02.sh`启动即可。  
- 如果脚本中硬编码的内容有变化，请记得更新脚本（或直接覆盖旧文件），并再次执行  
  ```bash
  chmod +x start01.sh
  chmod +x start02.sh
  ```  
  以确保脚本保持可执行权限。

---


## 6. 联系与支持

如现场仍遇到无法解决的技术问题，请联系我们。我们将尽力提供远程支持或进一步指导。

---

**以上即为两台服务器（Station1/Station2）部署的完整流程**：  
- **一次性**完成操作系统、Node.js、Git、项目克隆、脚本权限设置；  
- **后续**每次开机仅需**双击对应脚本**即可启动服务。  




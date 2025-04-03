# Console Logger

一个基于WebSocket的实时控制台日志查看器，允许你在Web界面中实时查看和过滤多个页面的控制台日志，并支持远程代码执行功能。

## 功能特性

- 🔄 实时日志监控：实时捕获和显示页面的控制台日志
- 🔍 强大的过滤功能：
  - 按日志级别过滤（log、info、warn、error）
  - 文本搜索过滤
  - 按页面URL过滤
- 💻 远程代码执行：在连接的页面上远程执行JavaScript代码
- 🎨 美观的用户界面：
  - 暗色主题设计
  - 语法高亮
  - 自动滚动
  - 响应式布局
- 🔌 可靠的连接处理：
  - 自动重连机制
  - 连接状态显示
  - 手动重连选项
- 📊 日志统计功能

## 技术栈

- 后端：
  - Node.js
  - Fastify
  - WebSocket (ws)
- 前端：
  - 原生JavaScript
  - WebSocket API
  - CSS3

## 安装

1. 克隆仓库：
```bash
git clone [repository-url]
cd console-logger
```

2. 安装依赖：
```bash
npm install
# 或者使用 pnpm
pnpm install
```

## 使用方法

1. 启动服务器：
```bash
npm start
```

2. 访问日志查看器：
打开浏览器访问 `http://localhost:8080/logger-viewer.html`

3. 在需要监控的vite项目中集成插件：

```bash
  pnpm add -D vite-plugin-console-logger
```

```javascript
{
  plugins:[
      isProd()?false: // 只在测试及开发环境使用
      consoleLogger({
        useRemote: false, // 使用本地（局域网）模式
        remoteUrl: 'http://your-remote-url/logger-viewer.html' // 当前项目部署的路径
      })
  ]
}
```

## 功能说明

### 日志查看
- 实时显示所有连接页面的控制台日志
- 支持按日志级别筛选（log、info、warn、error）
- 支持文本搜索过滤
- 显示日志时间戳和来源页面URL
- 自动格式化JSON内容

### 远程代码执行
- 选择目标页面
- 在代码输入框中输入JavaScript代码
- 点击"Execute Code"执行
- 查看执行结果或错误信息

### 界面控制
- Clear Logs：清除当前显示的所有日志
- Reconnect：手动重新连接WebSocket
- Auto-scroll：启用/禁用日志自动滚动
- 连接状态指示器：显示当前WebSocket连接状态

## 配置说明

服务器配置（server.ts）：
- 默认端口：8080
- WebSocket路径：
  - 查看器：`/ws-logger/viewer`
  - 日志客户端：`/ws-logger`

## 许可证

ISC License
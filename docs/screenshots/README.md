# 实际界面截图与来源

拍摄日期：2026-11-13（Asia/Shanghai）。前端截图已更新为0.4.2书签芽机器人；Windows原生窗口图保留0.4.1（`fd5a9d3`）历史版本，便于对照。全部笔记、会话、模型目录与报告均为专门编写的合成演示资料，不包含真实账号、接口 Key、微信二维码或私人会话。

| 文件 | 内容 | 拍摄方式 |
| --- | --- | --- |
| [brand-preview.png](brand-preview.png) | 原始生成图、SVG与四种托盘状态的尺寸预览 | 浏览器渲染实际资源，包含16／20／24／32像素原尺寸 |
| [windows-main.png](windows-main.png) | 记忆看板、AI 侧栏及真实快捷键占用提示 | 0.4.1历史独立 Windows Tauri／WebView2 进程，Win32 PrintWindow 仅捕获该进程的主窗口 |
| [memory-light.png](memory-light.png) | 浅色记忆看板 | 实际构建前端，隔离浏览器演示桥 |
| [memory-dark.png](memory-dark.png) | 深色主题 | 同上，通过界面现有主题变量切换 |
| [conversation-archive.png](conversation-archive.png) | 会话列表、搜索与重要标记 | 实际前端，合成归档由 Rust SQLite 读取 |
| [conversation-original.png](conversation-original.png) | 会话原文与继续讨论／整理入口 | 同上 |
| [learning-review.png](learning-review.png) | 展开的每日摘录及复习配置 | 实际前端，合成报告；未发生真实模型调用或微信投递 |
| [model-picker.png](model-picker.png) | 模型目录、默认选择和侧栏勾选 | 实际前端与模拟目录响应，不证明已安装或获准调用截图中的模型 |
| [local-library.png](local-library.png) | 目录、备份、冲突与采集入口 | 实际前端；`D:/Jarvis-Demo/library` 是适配器提供的示例路径 |
| [data-sync.png](data-sync.png) | 独立同步页面 | 未连接服务器状态；地址／令牌为空，没有真实生产连接 |
| [wechat-setup.png](wechat-setup.png) | 微信接入入口 | 未绑定／未配对状态；未扫码、未读取账号 |
| [quick-capture.png](quick-capture.png) | 快捷框中的示例输入 | 实际快捷框组件的元素截图；输入尚未提交，不是操作系统热键的录像证明 |

浏览器演示桥运行与桌面相同的构建后 HTML／CSS／TypeScript，业务数据通过实际 Rust SQLite 驱动；窗口命令、原生文件对话框和模型／网络响应由测试适配器提供。截图没有用设计软件重画、没有拼装聊天成功状态，也没有用上游宣传图代替本项目。

Windows 截图保留了当时的快捷键冲突提示。独立演示进程与本机其他运行软件可能争用快捷键；这展示的是提示与调整行为，不代表所有安装环境都会出现相同提示。

当前没有 Mac 真机截图。Mac 构建通过、界面共享和实际 Mac 系统体验是不同证据；真实微信、真实模型与 Mac 真机验收仍按发布说明处理。

## 重新拍摄

在项目目录先构建前端和隔离驱动：

```sh
npm ci
npm run build
cargo build -p jarvis-workspace --bin workspace-driver
```

PowerShell 中开启合成资料演示桥：

```powershell
$env:JARVIS_PUBLIC_DEMO='1'
node scripts/fusion-browser-fixture.mjs
```

另开终端，使用已配置的 Playwright CLI：

```sh
npx @playwright/cli -s=jarvis-docs open http://127.0.0.1:1421
npx @playwright/cli -s=jarvis-docs run-code --filename scripts/capture-public-docs.js
```

脚本会生成 10 张前端截图并检查页面异常。截图应逐张人工检查；程序成功不代表可以跳过隐私与素材核对。

Windows 原生截图另外构建 `fusion-preview`，以 `node scripts/seed-public-demo.mjs` 准备独立合成目录，再用仅对该目录生效的 `JARVIS_DESKTOP_DATA_DIR` 启动。恢复演示主窗口后，对核对过的 PID 执行：

```powershell
& scripts/capture-native-preview.ps1 -PreviewId <演示进程PID> -OutFile docs/screenshots/windows-main.png -WindowTitle '贾维斯管家 · 单页本地版'
```

不要把用户正在使用的资料库拿来拍公开截图，也不要为截图开启远程调试端口。当前机器人原图为内置imagegen生成，界面／托盘为独立SVG适配，见[品牌来源](../branding.md)。

拍完停止自己启动的演示进程；不退出用户原先的应用。

各 PNG 的尺寸和 SHA-256 见 [manifest.json](manifest.json)。本目录截图为本项目自制演示资料，随本仓库按 AGPL-3.0-only 提供；图中第三方代码、字体与图标继续适用各自许可，见根目录的第三方清单。

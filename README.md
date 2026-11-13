# 贾维斯管家

基于 [Dingmi 1.0.8](https://github.com/qingzo/dingmi)，融合 Jarvis Butler 知识管理能力的 Windows／macOS 本地学习工作台。保留 Dingmi 主面板、快捷记录和主题，AI 与微信在同一窗口的侧栏。

[下载测试版](https://github.com/aiyinsitan520/jarvis-butler-desktop/releases) · [构建与 Mac 验收](docs/MAC_PORTING_PLAN.md) · [已知限制](docs/release-notes.md)

## 安装与打开

- Windows x64：下载 Release 的 EXE 安装包，安装后从开始菜单打开“贾维斯管家”。
- Mac Apple Silicon：下载 DMG，拖入 Applications。此测试版使用 ad-hoc 签名，未完成苹果公证；使用系统正常的安全审批流程，不关闭系统保护。Mac 真机体验仍待验收。
- 本机已有源码预览：双击 `启动贾维斯测试版.cmd`，需要先构建 preview example。测试版与安装版的数据目录独立；从“本地资料”备份后，可在安装版“从备份恢复”。旧资料保留。

## 本地资料与 AI 阅读

左侧“本地资料”可打开文件夹、迁移位置、备份和恢复。Markdown 的 notes／todos／inspirations 支持双向修改，保留 id、table、base 元数据。改名继续关联原记录，删除需确认；同时修改保留外部稿并显示冲突。新增资料先在应用中创建。

`conversations/` 为文字会话阅读版与索引；`reviews/` 为学习报告和可编辑的 `.notes.md` 复述笔记；`index.json` 为其他 AI 的记录索引。`.jarvis/` 是内部数据库，请勿手动修改或用网盘同步运行中的数据库。现有开发预览使用旧目录结构，迁移后采用新结构。

授权目录后可自动采集 Codex、Claude Code、Gemini CLI 的本地会话。ChatGPT／Claude 网页版通过官方导出文件导入。支持格式、增量、去重和错误状态；不读取浏览器账号或配置凭据。

## 学习回顾、模型与微信

在“学习回顾”开启每日提醒，默认本地时间9点；在“本地资料”选择是否使用当前模型自动整理、是否由本机推送到本人配对微信。每日成果包含重点、结论、待验证问题和复习问题，并链接原会话；原有1／3／7／14／30天复习保留。

关机期间暂停，启动后补报告并合并通知。模型失败保留原文，可单独重试。微信依赖当前会话上下文与腾讯协议；未送达显示状态，不假报成功、不盲目重发，也可以发送“今日回顾”获取报告。真实微信和真实模型效果需本人配置验收。

本地 SQLite／Markdown 为明文；凭据使用 Windows 凭据管理器或 Mac Keychain。云端模型会收到用户授权的会话摘录，可能计费；Ollama 可在本机推理。AI 不拥有终端或任意文件执行能力。

“数据同步”是独立页面，支持原 Jarvis VPS 的预览、确认合并与回执恢复；网盘／iCloud 仍为未实现的入口。会话归档不会进入六表同步。新设备重新配置密钥；微信推送只指定一台主设备。

## 构建与验证

需要 Node 24、Rust stable；Windows 需要 MSVC C++ 与 WebView2，Mac 需要 Xcode Command Line Tools。在本目录执行：

```sh
npm ci
npm test
npm run build
cargo test -p jarvis-workspace -- --test-threads=1
cargo test -p jarvis-desktop --lib -- --test-threads=1
node scripts/licenses.mjs --check
```

Windows：`npx tauri build --ci --bundles nsis`。
Mac：`npx tauri build --ci --target aarch64-apple-darwin --bundles dmg --config apps/desktop/src-tauri/tauri.macos.conf.json`。
源码预览：`cargo build -p jarvis-desktop --example fusion-preview --features tauri/custom-protocol`。
CI 为两个平台分别构建；构建成功不代表真机交互已验收。完整安装、升级、卸载保留资料及真实协议仍需按发布说明核验。

## 来源与许可

整体 **AGPL-3.0-only**，见 [LICENSE](LICENSE)。Dingmi 基线、修改与 Jarvis MIT 声明见 [UPSTREAM.md](UPSTREAM.md)、[licenses/JARVIS-MIT.txt](licenses/JARVIS-MIT.txt)。第三方许可证和原版权文本随安装包提供。

应用图标、托盘图标和纸页轨道伙伴为本版原创；不包含 Dingmi 团子猫、上游截图或 Islenote 提取素材。上游作者未为本版本背书。采用“贾维斯管家”名称不代表商标核验已完成。

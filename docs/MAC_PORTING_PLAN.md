# macOS 适配与验收

目标：macOS 12+、Apple Silicon，复用 Dingmi UI、Rust 业务、六表协议和本地资料库。

平台实现：Keychain 凭据、系统菜单、Dock 重新打开、Option+Space 快捷框、Command+Option+N 笔记；扫描 /Applications、/System/Applications 和用户 Applications，以 open 启动。窗口与提醒保留 Tauri 原生机制，Windows WebView2 修复继续由条件编译隔离。

首版差异：Mac 桌面组件为独立窗口，不使用 Windows Progman 置底；自定义程序启动参数和管理员启动不支持并返回错误。自定义图标提取暂用通用图标。Mac 开机自启需通过应用设置启用并真机验证。

构建：在项目根目录运行 npm ci、npm test，安装 Rust stable 和 Xcode Command Line Tools，然后执行：

```sh
npx tauri build --ci --target aarch64-apple-darwin --bundles dmg --config apps/desktop/src-tauri/tauri.macos.conf.json
```

测试版 ad-hoc 签名，未公证。正式公证需要用户自有 Apple Developer ID；不得将凭据写进仓库。

真机验收清单：从 DMG 拖入 Applications 后启动；浅深主题和 Retina；中文组合输入；快捷键占用与设置；关闭窗口后菜单栏继续采集；Dock 重开；原生提醒；Keychain 首次访问；目录权限拒绝；迁移与备份恢复；睡眠唤醒补回顾；卸载保留资料与重装。每项记录系统版本、结果和失败证据；当前均不冒充已验收。

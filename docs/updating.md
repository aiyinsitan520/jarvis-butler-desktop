# 发布与自动更新：已核对的机制和当前边界

核对日期：2026-11-13。参考 [Cockpit Tools](https://github.com/jlcodes99/cockpit-tools)，核对时 main 为 `c1e528fd545a0afad2ceb71476279e851e46b0b3`。本项目没有复制它的更新代码、品牌或签名密钥，仅研究机制；该仓库的根目录与 GitHub license 接口没有提供可核实的许可证正文。

## Cockpit Tools 怎样更新

1. 构建配置开启 `bundle.createUpdaterArtifacts`，配置 Tauri updater 插件、自有公钥及 GitHub Release 更新清单地址。先查询平台清单，再兼容 `latest.json`，不是让用户重新找安装包。[配置源码](https://github.com/jlcodes99/cockpit-tools/blob/c1e528fd545a0afad2ceb71476279e851e46b0b3/src-tauri/tauri.conf.json)
2. CI 使用 `TAURI_SIGNING_PRIVATE_KEY` 和 `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` 签名。Windows 发布安装包与 `.sig`；Mac 另有供 updater 使用的 `.app.tar.gz` 与签名，DMG 用于首次安装。更新签名与 Apple Developer ID／公证是不同事项。[发布流程](https://github.com/jlcodes99/cockpit-tools/blob/c1e528fd545a0afad2ceb71476279e851e46b0b3/docs/release-process.md)
3. 页面有可用、下载、安装、就绪等状态，提供进度、更新说明与手动下载入口；偏好支持自动检查、检查间隔、自动安装和跳过版本。[更新提示组件](https://github.com/jlcodes99/cockpit-tools/blob/c1e528fd545a0afad2ceb71476279e851e46b0b3/src/components/UpdateNotification.tsx)、[后端命令](https://github.com/jlcodes99/cockpit-tools/blob/c1e528fd545a0afad2ceb71476279e851e46b0b3/src-tauri/src/commands/update.rs)
4. 检查／下载的临时网络错误有退避重试，签名／校验错误不作为普通网络问题盲目重试。[重试实现](https://github.com/jlcodes99/cockpit-tools/blob/c1e528fd545a0afad2ceb71476279e851e46b0b3/src/utils/updaterRetry.ts)
5. 发版后脚本读取公开更新清单，核对版本、目标、URL 和非空签名，另生成安装包 SHA-256。签名校验与哈希清单作用不同，公开哈希不能替代可信签名。[清单核对脚本](https://github.com/jlcodes99/cockpit-tools/blob/c1e528fd545a0afad2ceb71476279e851e46b0b3/scripts/release/verify_published_updater_manifests.cjs)

以上是源码核查，没有运行或安装 Cockpit Tools，也没有把其更新验证结果当成本项目验证。

## 贾维斯现在的发布方式

本项目 `.github/workflows/desktop.yml` 已在推送 `v*` 标签后运行测试、构建 Windows x64 NSIS 与 Apple Silicon DMG、生成 SHA256SUMS 并创建 GitHub 测试版 Release。GitHub 页面有安装包和对应标签源码。这是自动构建发布，**尚不是客户端自动下载安装**。

目前默认 `no-update`，继承自 Dingmi 的网络更新通道关闭；没有连接 Dingmi 更新服务，没有用其公钥信任本项目安装包。本轮白猫图标发布仍沿用手动下载安装方式。

后续每次发版：同步修改根 `package.json`／`package-lock.json`、桌面 `Cargo.toml`／根 `Cargo.lock` 与 `tauri.conf.json` 的版本，更新 `docs/release-notes.md`，完成测试、许可证及公开源码检查，提交审核后的文件，再推送从未使用过的新标签。取消的标签不移动或重用；相同应用版本的修正测试包递增 `preview.N`。发布失败先查 Actions 日志，不把缺包的 Release 宣称为已交付。

## 接入自有更新的下一步

- 使用 Tauri 官方 updater 插件替换遗留 Windows 专用逻辑，保留 Windows／Mac 共用的检查、进度、失败和安装确认界面。
- 创建贾维斯自己的更新签名密钥；私钥只进入本机凭据存储及 GitHub Actions secrets，公钥随应用。不能复制其他项目的公钥或把私钥放到资料库、源码、日志中。
- CI 同时产生 Windows 签名安装包、Mac `.app.tar.gz` 签名包和平台更新清单；发布资产齐全且公开核对通过后才推广更新清单。
- 稳定版和测试版明确分开。当前都是 prerelease，GitHub `/releases/latest` 不能直接当作测试版通道；需设计独立、受控的测试版清单入口。
- 默认自动检查、用户确认安装；安装前保存编辑与备份两库，失败不删数据。资料库迁移与应用安装分别验证。
- 验收真实旧版到新版升级、断网恢复、签名不符拒绝安装、平台与架构不匹配拒绝安装、重复点击、安装失败和回滚。Mac 真机升级及 Gatekeeper 状态单独验证；updater 签名不会使未公证应用自动获得 Apple 公证。

上述接入尚未完成。本项目不会把“检查到了 GitHub 新版本”当作自动更新已经验收通过。

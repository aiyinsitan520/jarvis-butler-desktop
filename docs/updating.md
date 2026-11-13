# 发布与自动更新：已核对的机制和当前边界

核对日期：2026-11-13。参考 [Cockpit Tools](https://github.com/jlcodes99/cockpit-tools)，核对时 main 为 `c1e528fd545a0afad2ceb71476279e851e46b0b3`。本项目没有复制它的更新代码、品牌或签名密钥，仅研究机制；该仓库的根目录与 GitHub license 接口没有提供可核实的许可证正文。

## Cockpit Tools 怎样更新

1. 构建配置开启 `bundle.createUpdaterArtifacts`，配置 Tauri updater 插件、自有公钥及 GitHub Release 更新清单地址。先查询平台清单，再兼容 `latest.json`，不是让用户重新找安装包。[配置源码](https://github.com/jlcodes99/cockpit-tools/blob/c1e528fd545a0afad2ceb71476279e851e46b0b3/src-tauri/tauri.conf.json)
2. CI 使用 `TAURI_SIGNING_PRIVATE_KEY` 和 `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` 签名。Windows 发布安装包与 `.sig`；Mac 另有供 updater 使用的 `.app.tar.gz` 与签名，DMG 用于首次安装。更新签名与 Apple Developer ID／公证是不同事项。[发布流程](https://github.com/jlcodes99/cockpit-tools/blob/c1e528fd545a0afad2ceb71476279e851e46b0b3/docs/release-process.md)
3. 页面有可用、下载、安装、就绪等状态，提供进度、更新说明与手动下载入口；偏好支持自动检查、检查间隔、自动安装和跳过版本。[更新提示组件](https://github.com/jlcodes99/cockpit-tools/blob/c1e528fd545a0afad2ceb71476279e851e46b0b3/src/components/UpdateNotification.tsx)、[后端命令](https://github.com/jlcodes99/cockpit-tools/blob/c1e528fd545a0afad2ceb71476279e851e46b0b3/src-tauri/src/commands/update.rs)
4. 检查／下载的临时网络错误有退避重试，签名／校验错误不作为普通网络问题盲目重试。[重试实现](https://github.com/jlcodes99/cockpit-tools/blob/c1e528fd545a0afad2ceb71476279e851e46b0b3/src/utils/updaterRetry.ts)
5. 发版后脚本读取公开更新清单，核对版本、目标、URL 和非空签名，另生成安装包 SHA-256。签名校验与哈希清单作用不同，公开哈希不能替代可信签名。[清单核对脚本](https://github.com/jlcodes99/cockpit-tools/blob/c1e528fd545a0afad2ceb71476279e851e46b0b3/scripts/release/verify_published_updater_manifests.cjs)

以上是源码核查，没有运行或安装 Cockpit Tools，也没有把其更新验证结果当成本项目验证。

## 贾维斯当前实现（0.4.3起）

本版已接入 Tauri 官方 updater 2.14.1。左侧“软件更新”提供当前版本、检查更新、更新记录、下载进度、渠道与自动检查开关、确认安装。启动一分钟后检查，此后每六小时检查；只检查，不自动下载或强制安装。

- Windows x64：签名 NSIS 安装包；macOS Apple Silicon：签名 app.tar.gz 更新包，DMG用于首次安装。更新私钥存Windows凭据管理器和GitHub Actions secrets；源码仅有公钥。私钥不会进入资料目录、仓库或日志，备份机器时应另行备份凭据，丢失私钥不能静默换钥。
- 更新清单在独立 update-channel 分支的 preview.json／stable.json；测试版与稳定版分开。没有签名版本的渠道明确显示未发布，不假报最新。
- 下载限定本仓库、版本和平台；限制300MiB，检查大小、SHA-256、minisign签名和签名内的版本。官方插件安装前再次校验。断网可重试；已完成缓存重启后重新校验再恢复，未完成文件不当作就绪。
- 安装前需要确认；主窗口确认保存已完成。可见独立笔记／快捷框需要先保存关闭，未发送消息和灵感阻止安装。安装前在当前资料内部backups/update-*备份两库，暂停写入；失败解冻，原资料和备份保留。开发预览可检查下载，不能覆盖正式安装。
- Windows由官方插件启动安装器并退出，安装器负责重新启动；Mac替换成功后重启。失败不自动回滚应用，但可手动安装上一版本；数据恢复应在“本地资料”中另行操作，先保留当前备份。

## 每次发布新版

1. 递增根package.json／package-lock.json、桌面Cargo.toml／Cargo.lock及tauri.conf.json版本，更新release-notes。已经发布签名包后，即使测试标签不同，也必须递增应用版本。
2. 本地通过前端、核心、updater和原生测试、许可证及公开源码检查。
3. 提交审核后的源码，推送新标签，例如v0.4.3-preview.1。CI自动测试两平台，签名打包，生成清单／SHA并用独立Rust验证器验证全部更新包。
4. Release资产发布后，再把公开清单与本地已核验版本逐字比较，最后以非强推方式更新渠道分支。并发更新、缺包、版本回退或同版本换包均停止推广。
5. 用户安装过0.4.3及以后的版本，即可在应用内检查并确认更新。0.4.2及更早版本没有本通道，首次需要从Release手动安装。

已有自动发布工作流；不要运行遗留scripts/release.mjs。GitHub签名secret仅限可信标签构建，PR构建不生成签名产物。发布文档与结果以对应Release和validation记录为准。

## 验收范围

新增单元检查包括篡改包、错误密钥、版本冒充、跨仓库URL、大小和网络失败；页面桥检查覆盖渠道、进度、确认取消／确认安装、错误不假报最新、窄窗口和开发版禁装。页面桥中的下载与安装为替身，不能替代真实安装器验证。具体已完成项目请看对应版本验证记录。

Mac公证和updater签名不同，本版本仍为未公证测试版，Mac真机更新仍需验收。更新只传版本请求，不上传笔记、会话、模型凭据。

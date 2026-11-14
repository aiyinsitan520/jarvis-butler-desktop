# 发布与自动更新：已核对的机制和当前边界

核对日期：2026-11-13。参考 [Cockpit Tools](https://github.com/jlcodes99/cockpit-tools)，核对时 main 为 `c1e528fd545a0afad2ceb71476279e851e46b0b3`。本项目没有复制它的更新代码、品牌或签名密钥，仅研究机制；该仓库的根目录与 GitHub license 接口没有提供可核实的许可证正文。

## Cockpit Tools 怎样更新

1. 构建配置开启 `bundle.createUpdaterArtifacts`，配置 Tauri updater 插件、自有公钥及 GitHub Release 更新清单地址。先查询平台清单，再兼容 `latest.json`，不是让用户重新找安装包。[配置源码](https://github.com/jlcodes99/cockpit-tools/blob/c1e528fd545a0afad2ceb71476279e851e46b0b3/src-tauri/tauri.conf.json)
2. CI 使用 `TAURI_SIGNING_PRIVATE_KEY` 和 `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` 签名。Windows 发布安装包与 `.sig`；Mac 另有供 updater 使用的 `.app.tar.gz` 与签名，DMG 用于首次安装。更新签名与 Apple Developer ID／公证是不同事项。[发布流程](https://github.com/jlcodes99/cockpit-tools/blob/c1e528fd545a0afad2ceb71476279e851e46b0b3/docs/release-process.md)
3. 页面有可用、下载、安装、就绪等状态，提供进度、更新说明与手动下载入口；偏好支持自动检查、检查间隔、自动安装和跳过版本。[更新提示组件](https://github.com/jlcodes99/cockpit-tools/blob/c1e528fd545a0afad2ceb71476279e851e46b0b3/src/components/UpdateNotification.tsx)、[后端命令](https://github.com/jlcodes99/cockpit-tools/blob/c1e528fd545a0afad2ceb71476279e851e46b0b3/src-tauri/src/commands/update.rs)
4. 检查／下载的临时网络错误有退避重试，签名／校验错误不作为普通网络问题盲目重试。[重试实现](https://github.com/jlcodes99/cockpit-tools/blob/c1e528fd545a0afad2ceb71476279e851e46b0b3/src/utils/updaterRetry.ts)
5. 发版后脚本读取公开更新清单，核对版本、目标、URL 和非空签名，另生成安装包 SHA-256。签名校验与哈希清单作用不同，公开哈希不能替代可信签名。[清单核对脚本](https://github.com/jlcodes99/cockpit-tools/blob/c1e528fd545a0afad2ceb71476279e851e46b0b3/scripts/release/verify_published_updater_manifests.cjs)

以上是源码核查，没有运行或安装 Cockpit Tools，也没有把其更新验证结果当成本项目验证。

## 贾维喵当前实现（0.4.3起）

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

## 0.4.6 发布与真实升级验收（2026-11-14）

[对应源码与安装包](https://github.com/aiyinsitan520/jiavimiao-butler/releases/tag/v0.4.6-preview.1) · [双平台构建记录](https://github.com/aiyinsitan520/jiavimiao-butler/actions/runs/43450848342)

产品现名“贾维喵管家”，使用确认的原创白猫图标。Windows 与 Apple Silicon Mac 包已发布，公开 preview 清单与 Release 内容一致；下载后两平台更新包的 minisign 签名、签名版本、大小和 SHA-256 均通过独立 Rust 验证。全部发行校验值匹配。

Windows 使用真实安装的0.4.3和隔离演示资料，完成“检查 → 下载 → 校验 → 安装 → 自动重启”到0.4.6。安装位置保持原目录，旧名称卸载登记移除；3条笔记及本地设置测试标记保留，安装前两库备份存在。此前0.4.5改名会另建安装目录，0.4.6通过安装器兼容旧名称及后续显式传入当前目录修复。测试安装已卸载，临时启动资料指针按原状态恢复。确认按钮通过无障碍接口触发后安装完成；随后寻找系统确认对话框未找到，不能据此声称真实确认弹窗展示已验证。页面桥的确认取消／同意逻辑有独立检查。

CI两平台各通过608项前端、31项核心、5项更新策略、12项共享记录及18项服务器同步检查；Windows原生144通过11忽略，Mac原生140通过9忽略。原生构建有继承的未使用代码警告；CI有Action运行时迁移警告。Mac仍未公证，没有真机窗口／快捷键／安装及更新验证，真实模型与微信链路仍需本人配置验收。

README与指南的11张新版照片全部来自Windows原生窗口，资料为隔离合成示例。测试没有写入正式VPS，也没有调用真实模型或发送微信。AGPL-3.0-only与上游版权声明保留。未调用外部代理，外部代理用量0；主模型用量未知。

## 仓库改名后的更新兼容（2026-11-14）

正式仓库为 [aiyinsitan520/jiavimiao-butler](https://github.com/aiyinsitan520/jiavimiao-butler)，仓库ID未变。Git remote、README、指南、应用内项目／发布入口、原生更新端点与后续Release发布脚本已切换新地址。历史标签、签名包和现有安装版本保持原样，没有同版本重新打包。

0.4.6及以前的已发布客户端只接受原仓库路径。后续发布保留两份各有用途的元数据：Release的latest.json使用新仓库地址；update-channel渠道清单只把下载URL映射为原仓库重定向别名，保留签名、版本、大小和SHA不变。新源码只额外接受这个同一仓库的旧别名，不放宽到其他仓库。不要重新创建旧名称仓库，以免破坏GitHub重定向。发布脚本仍先逐字核对已验证Release，再生成兼容清单；同版本不同签名／哈希拒绝发布。

已实测：新旧仓库API返回同一ID；新旧raw渠道端点返回相同0.4.6清单；两个旧签名包下载地址均经重定向返回HTTP 200。更新策略6项和渠道兼容2项检查通过。新地址代码将随下一个递增版本安装包分发；本次改名不重新发布0.4.6二进制。未来版本的完整双平台安装升级仍以对应发版验收为准。

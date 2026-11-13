# 贾维喵管家新版实机图库

拍摄日期：2026-11-13（Asia/Shanghai）。以下11张产品界面图全部来自本机Windows 11／WebView2中运行的0.4.5版Tauri原生窗口，150%显示缩放，多数为2160×1350，个别窗口按实际大小拍摄。原生预览在83ae24a基线构建，之后的8fbf161兼容修正不改变图中页面布局。没有用浏览器演示桥或设计稿替代本批产品照片。

所有笔记、会话与报告是专门准备的合成演示资料，存放在隔离SQLite中。侧栏AI文字是预先编写、保存后由本机归档读取的示例，不是实时模型回答。模型列表通过真实原生HTTP请求连接本机临时目录服务，返回演示模型ID，不代表模型已安装或可真实推理。未扫码、未配对、未发送微信；无私人数据、Key、二维码或真实账号。

| 文件 | 实际拍摄内容 |
| --- | --- |
| [windows-main.png](windows-main.png) | 新名称、白猫、完整随手记提示与AI侧栏 |
| [memory-light.png](memory-light.png) | 浅色记忆看板与已归档示例文字 |
| [memory-dark.png](memory-dark.png) | 通过原生设置切换的深色主题 |
| [conversation-archive.png](conversation-archive.png) | 本地会话列表 |
| [conversation-original.png](conversation-original.png) | 原会话阅读与继续讨论入口 |
| [learning-review.png](learning-review.png) | 展开的每日摘录与间隔复习 |
| [model-picker.png](model-picker.png) | 原生设置中拉取的本机演示模型目录 |
| [local-library.png](local-library.png) | 隔离资料目录、备份与采集设置 |
| [data-sync.png](data-sync.png) | 独立同步页，未连接正式服务器 |
| [wechat-setup.png](wechat-setup.png) | 未绑定的微信入口与侧栏 |
| [software-update.png](software-update.png) | 真实渠道检查、版本与自动检查偏好 |

没有Mac真机图；Mac编译通过不能代替Mac系统体验验收。图片未拼接成功状态或覆盖文字，关闭当前窗口的快捷键占用提示后再拍摄；具体生效热键以每台电脑设置为准。旧品牌图和浏览器桥图片已从当前图库移除，Git历史仍保留早期提交。

重拍应使用合成资料启动独立fusion-preview实例，打开所需页面，用系统无障碍接口操作，运行scripts/capture-native-preview.ps1只捕获指定进程／窗口。脚本会恢复最小化窗口并限制安装版捕获为隔离测试实例；不要拍摄用户正在使用的资料。manifest.json记录PNG尺寸及SHA-256，node scripts/check-public-docs.mjs核对链接和图片完整性。

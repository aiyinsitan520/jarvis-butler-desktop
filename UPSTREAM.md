# 来源与修改记录

2026-11-13：贾维斯管家 Windows 融合版。

- 桌面程序、编辑器、提醒、快捷记录、主题和同步协议的基础代码来自 [qingzo/dingmi](https://github.com/qingzo/dingmi)，版权所有 © 2026 李青菜，基线 3d633889d9ec6bf3184db1f7150e039f5b6df7ec（1.0.8），AGPL-3.0-only。
- 本融合版整体以 AGPL-3.0-only 提供。修改包括独立品牌、Jarvis 六表数据适配、知识工作台、AI 流程和微信入口。原作者未为本版本背书。
- 知识管理页面和六表模型来自用户现有 Jarvis Butler 项目，MIT 原声明见 licenses/JARVIS-MIT.txt。
- 微信协议依据 Tencent/openclaw-weixin 的公开协议文档，参考基线 0ad1ae91347a938f52f1e4e2abd6dcda51e05f9e；协议客户端为本项目实现。
- shared/mascot.ts 现为原创纸页轨道图形，其兼容函数名沿用旧接口，不包含上游猫形象。应用图标由该源文件生成。
- 没有包含 Islenote 提取代码、标志、图片或原安装包。上游截图和 Dingmi 图标未复制。
- 字体和第三方代码的原许可继续适用，见 THIRD_PARTY_LICENSES.md、字体目录 OFL.txt。

2026-11-13 0.4.0 修改：可迁移Markdown资料库、会话采集、学习报告、Mac Keychain／菜单／路径／启动器／通知适配与CI。应用及手机网页图标均由原创shared/mascot.ts重新生成；apps/server/web/app.html由本版mobile源码重新构建，替换上游旧内嵌图形。保留字体OFL与第三方许可全文；原更新公钥仅为遗留验证测试的公开材料，默认no-update禁止上游更新。

0.4.1 模型选择交互参考 farion1231/cc-switch（MIT）的 ModelInputWithFetch／FetchedModelPicker：获取、搜索、点选回填与可选模型勾选。本版独立实现组件及原生接口，没有复制该项目代码或品牌素材。参考 https://github.com/farion1231/cc-switch/tree/main/src/components/providers/forms 。

2026-11-13 图标更新：原纸页轨道图标替换为内置image_gen生成的书签芽机器人，原图与提示词纳入shared/assets；shared/mascot.ts提供独立SVG适配及状态托盘。旧纸页轨道说明为历史版本记录；当前生成方式与范围见docs/branding.md。

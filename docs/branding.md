# 贾维斯书签芽机器人

2026-11-13：用户要求图标可爱、简洁且有识别度，允许在线素材或自行生成。本版选择自行生成，不引入网上来源不明的图标。

形象为鼠尾草绿的圆润机器人，深色双眼、轻微笑脸和橙色书签芽。没有沿用 Dingmi 团子猫、Islenote 标志或第三方角色。

- `shared/assets/jarvis-sprout-source.png`：通过内置 image_gen 生成的原始图，已复制到项目；不是手工绘制，也不是第三方素材下载。
- `shared/mascot.ts`：按同一设计编写的 SVG 适配，供界面、助手形象和简化托盘使用。兼容函数名继续保留。
- `scripts/build-icons.mjs`：由原图生成 Windows ICO、macOS ICNS 等平台资源；由 SVG 生成四种托盘状态与安装器标识。
- `apps/desktop/ui/public/logo.svg`、`jarvis-mark.svg`：由上述脚本生成，不单独手工修改。

图形及代码随本项目按 AGPL-3.0-only 提供；字体和第三方工具仍适用原许可。AI 生成和独立设计不等于已完成商标检索或可以承诺没有相似图形。

原始生成提示词保存在 `shared/assets/jarvis-sprout-prompt.txt`。使用内置工具，未使用付费 API 凭据、网页图库或外部模型代理；图片生成 token 与费用未由工具返回，记为未知。

桌面大图与小尺寸 SVG 是同一品牌的不同适配：托盘减少腮红与细节、加强眼睛和书签轮廓；深浅任务栏分开配色。专注使用闭眼线条，提醒使用圆点，错误使用感叹号，不能只靠颜色区分。助手按钮仍支持鼠标眼神跟随。

![应用／SVG／托盘尺寸预览](screenshots/brand-preview.png)

// 从原创白色小猫（shared/mascot.ts）生成图标图片。改了伙伴或者图标后跑一次：node scripts/build-icons.mjs
// - 托盘：程序图标（浅蓝色方块）的 4 种状态 × 16、20、24、32 像素 → apps/desktop/src-tauri/icons/tray/
//   深浅两套分别加强轮廓。安装器与应用使用同一张用户确认的白猫原图。
// - 程序图标（浅蓝色方块 + 白色小猫）：先出 1024 的图，再用 tauri icon 生成安装包、任务栏用的那几个
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";
import { appIcon, trayIcon } from "../shared/mascot.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const icons = join(root, "apps/desktop/src-tauri/icons");
const png = (svg, px) => new Resvg(svg, { fitTo: { mode: "width", value: px } }).render().asPng();

// 小尺寸托盘使用高对比的简化SVG，深浅任务栏分别生成。
mkdirSync(join(icons, "tray"), { recursive: true });
for (const state of ["normal", "remind", "focus", "bad"]) {
  for (const dark of [false, true]) {
    for (const px of [16, 20, 24, 32]) {
      writeFileSync(join(icons, "tray", `${state}-${dark ? "dark" : "light"}-${px}.png`), png(trayIcon(px, state, dark), px));
    }
  }
}

const tmp = mkdtempSync(join(tmpdir(), "dingmi-icon-"));
const big = join(tmp, "app-icon.png");
// Keep the original generated raster; tauri icon only derives platform formats/sizes.
copyFileSync(join(root, "shared/assets/jarvis-kitten-source.png"), big);
writeFileSync(join(icons, "app-icon.svg"), appIcon(64) + "\n");
writeFileSync(join(root, "apps/desktop/ui/public/logo.svg"), appIcon(64) + "\n");
writeFileSync(join(root, "apps/desktop/ui/public/jarvis-mark.svg"), appIcon(64) + "\n");
execFileSync(process.execPath, [join(root, "node_modules/@tauri-apps/cli/tauri.js"), "icon", big, "-o", join(tmp, "out")], { stdio: "inherit" });
for (const f of ["32x32.png", "64x64.png", "128x128.png", "128x128@2x.png", "icon.icns", "icon.ico", "icon.png",
  "Square30x30Logo.png", "Square44x44Logo.png", "Square71x71Logo.png", "Square89x89Logo.png", "Square107x107Logo.png",
  "Square142x142Logo.png", "Square150x150Logo.png", "Square284x284Logo.png", "Square310x310Logo.png", "StoreLogo.png"]) {
  copyFileSync(join(tmp, "out", f), join(icons, f));
}

// 安装器与应用使用同一张用户确认的原图。
copyFileSync(join(icons, "icon.ico"), join(icons, "installer.ico"));
copyFileSync(join(icons, "icon.png"), join(root, "apps/server/web/icon.png"));
if (!tmp.startsWith(join(tmpdir(), "dingmi-icon-"))) throw new Error("Unexpected icon temp directory");
rmSync(tmp, { recursive: true, force: true });
console.log("图标生成好了：", icons);

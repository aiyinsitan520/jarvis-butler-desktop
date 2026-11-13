import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));
const page = (name: string) => here(`./ui/${name}.html`);

export default defineConfig({
  root: here("./ui"),
  plugins: [react(), tailwindcss()],
  clearScreen: false,
  // 电脑端和手机网页共用的代码（md、表格、util），见 shared/
  resolve: { alias: { "@shared": here("../../shared"), "@": here("./ui/knowledge") } },
  server: {
    port: 1420,
    strictPort: true,
    // Rust 的代码和编译产物不归前端管，不监视（编译时文件被锁住会让 Vite 报 EBUSY 退出）
    watch: { ignored: ["**/src-tauri/**", "**/target/**", "**/release/**"] },
    // 共用的 shared/ 在 ui/ 外面
    fs: { allow: [here("../.."), here("../../node_modules")] },
  },
  build: {
    target: "es2021",
    outDir: here("./dist"),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: page("index"),
        workspace: page("workspace"),
        flash: page("flash"),
        qnote: page("qnote"),
        remind: page("remind"),
        morning: page("morning"),
        wrap: page("wrap"),
        widget: page("widget"),
        note: page("note"),
        onboard: page("onboard"),
      },
    },
  },
});

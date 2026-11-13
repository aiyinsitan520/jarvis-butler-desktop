import {invoke} from "@tauri-apps/api/core";
import {listen} from "@tauri-apps/api/event";
type Status={local:boolean;online:boolean;configured:boolean;pending:number;conflicts:number};
const badge=document.createElement("div");badge.setAttribute("role","status");badge.style.cssText="position:fixed;bottom:4px;left:10px;font-size:10px;line-height:15px;color:var(--ink-3);pointer-events:none;z-index:5;max-width:75%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis";
document.body.append(badge);
async function refresh(){try{const s=await invoke<Status>("workspace_view");badge.textContent=s.conflicts?`有 ${s.conflicts} 项草稿待核对 · 知识工作台 → 设置`:s.pending?`已存本机 · ${s.pending} 项待同步`:s.local?"本机知识库 · 数据保存在此电脑":s.online?"共享资料已连接":s.configured?"共享暂离线 · 新内容先存本机":"本机记录 · 在知识工作台设置共享连接";}catch{badge.textContent="共享状态不可用";}}
void refresh();void listen("workspace-changed",()=>{void refresh();});

import {useEffect,useState} from 'react'
import {invoke} from '@tauri-apps/api/core'
import {listen} from '@tauri-apps/api/event'
import './Updates.css'
type Status={current:string;state:'idle'|'available'|'downloading'|'ready'|'installing';checking:boolean;version:string|null;notes:string|null;date:string|null;size:number;got:number;error:string|null;checked_at:string|null;channel:string;auto_check:boolean;can_install:boolean;disabled:boolean}
type Release={version:string;name:string;date:string;body:string;url:string}
const mb=(n:number)=>(n/1048576).toFixed(1)+' MB'
export function Updates(){
 const [status,setStatus]=useState<Status|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[history,setHistory]=useState<Release[]>([]),[historyOpen,setHistoryOpen]=useState(false)
 useEffect(()=>{let alive=true;let off:(()=>void)|undefined;const load=()=>void invoke<Status>('update_status').then(s=>{if(alive)setStatus(s)}).catch(e=>{if(alive)setError(String(e))});load();const timer=setInterval(load,1500);void listen<Status>('update-status',e=>{if(alive)setStatus(e.payload)}).then(f=>{if(alive)off=f;else f()});return()=>{alive=false;off?.();clearInterval(timer)}},[])
 const run=async(action:()=>Promise<unknown>)=>{setBusy(true);setError('');try{await action();setStatus(await invoke<Status>('update_status'))}catch(e){setError(String(e))}finally{setBusy(false)}}
 const locked=busy||status?.checking||status?.state==='downloading'||status?.state==='installing'
 const prefs=(channel:string,auto:boolean)=>void run(async()=>setStatus(await invoke<Status>('update_preferences',{channel,autoCheck:auto})))
 const percent=status?.size?Math.min(100,Math.floor(status.got/status.size*100)):0
 const message=!status?'正在读取版本…':status.disabled?'本构建已关闭软件更新':status.checking?'正在检查更新…':status.state==='installing'?'正在保存编辑、备份并安装，请稍候…':status.state==='downloading'?`正在下载 ${percent}%`:status.error||error?'更新操作未完成，请查看原因并重试':status.state==='ready'?`新版本 ${status.version} 已下载并通过签名校验`:status.state==='available'?`发现新版本 ${status.version}`:status.checked_at?'已是所选渠道的最新版本':'尚未检查更新'
 return <div className="jarvis-updates"><header><img src="/jarvis-mark.svg" alt="白猫图标"/><h1>贾维斯管家</h1><p>当前版本 <strong>{status?.current??'—'}</strong></p></header>
 <div className="update-actions"><button disabled={!status||locked||status.disabled} onClick={()=>void run(()=>invoke('update_check'))}>检查更新</button><button disabled={busy} onClick={()=>{setHistoryOpen(true);void run(async()=>setHistory(await invoke<Release[]>('update_history')))}}>更新记录</button><button onClick={()=>void invoke('open_url',{url:'https://github.com/aiyinsitan520/jarvis-butler-desktop/releases'})}>下载安装包</button></div>
 <div className={'update-result'+(status?.error||error?' has-error':'')} role="status"><strong>{message}</strong>{status?.checked_at&&<small>上次成功检查：{status.checked_at}</small>}{(status?.error||error)&&<p role="alert">{error||status?.error}</p>}{status?.state==='downloading'&&<><progress value={status.got} max={status.size||1}/><small>{mb(status.got)} / {mb(status.size)}</small></>}</div>
 {status?.version&&<section><h2>{status.version} 更新说明</h2><pre>{status.notes||'此版本未提供说明。'}</pre>{status.state==='available'&&<button disabled={locked} onClick={()=>void run(()=>invoke('update_download'))}>下载并校验更新 · {mb(status.size)}</button>}{status.state==='ready'&&<button disabled={locked||!status.can_install} onClick={()=>{if(confirm('安装将重启贾维斯。请保存或清空未发送内容，并关闭笔记／快捷记录窗口。确认后自动备份两份数据库，再安装签名更新包。是否继续？'))void run(()=>invoke('update_install',{confirmed:true}))}}>确认安装并重启</button>}{status.state==='ready'&&!status.can_install&&<p>开发预览支持检查、下载与校验。执行覆盖升级请使用正式安装的测试包。</p>}</section>}
 <section><h2>更新偏好</h2><label>更新渠道<select aria-label="更新渠道" disabled={!status||locked} value={status?.channel??'preview'} onChange={e=>prefs(e.target.value,status?.auto_check??true)}><option value="preview">测试版</option><option value="stable">稳定版</option></select></label><label className="update-auto"><input type="checkbox" disabled={!status||locked} checked={status?.auto_check??false} onChange={e=>prefs(status?.channel??'preview',e.target.checked)}/>启动后自动检查，此后每六小时检查一次</label><p>只自动检查；下载和安装由你确认。更新仅访问本项目发布渠道，不发送笔记、会话或模型凭据。</p><p>安装前保存编辑并备份本机两库。Mac 测试包尚未公证，更新签名与 Apple 公证是不同事项。</p></section>
 {historyOpen&&<section><h2>更新记录</h2>{!history.length&&<p>{busy?'正在读取发布记录…':'尚未取得记录；可重试或打开发布页面。'}</p>}{history.map(r=><details key={r.version}><summary>{r.name||r.version} <small>{r.date}</small></summary><pre>{r.body}</pre><button onClick={()=>void invoke('open_url',{url:r.url})}>查看此版本发布页</button></details>)}</section>}
 </div>
}

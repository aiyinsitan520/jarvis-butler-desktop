import {useEffect,useState} from 'react'
import {invoke} from '@tauri-apps/api/core'
import {refreshStorage,useStorage} from '@/db/store'

type Counts=Record<string,number>
interface Preview{id:string;baseUrl:string;localCounts:Counts;remoteCounts:Counts;uploadLocal:boolean;conflictCount:number;conflicts:{table:string;id:string;title:string}[]}
interface SyncInfo{connection:{baseUrl:string}|null;sync?:{candidate?:{baseUrl:string;hasToken:boolean}|null;lastSuccess:string|null;transfer:{status:string;error?:string;backupKey?:string}|null}}
const tables=[['notebooks','笔记本'],['notes','笔记'],['sources','来源'],['todos','待办'],['inspirations','灵感'],['relations','关联']]

export function SyncSettings(){
 const {view}=useStorage()
 const [method,setMethod]=useState('server'),[info,setInfo]=useState<SyncInfo|null>(null),[base,setBase]=useState(''),[token,setToken]=useState(''),[preview,setPreview]=useState<Preview|null>(null),[resolution,setResolution]=useState('keep'),[consent,setConsent]=useState(false),[busy,setBusy]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState('')
 async function load(fill=false){const s=await invoke<SyncInfo>('workspace_settings');setInfo(s);if(fill)setBase(s.connection?.baseUrl??s.sync?.candidate?.baseUrl??'')}
 useEffect(()=>{void load(true).catch(e=>setError(String(e)));const t=setInterval(()=>{void load().catch(()=>{})},5000);return()=>clearInterval(t)},[])
 async function run(name:string,action:()=>Promise<void>){setBusy(name);setError('');setNotice('');try{await action()}catch(e){setError(String(e))}finally{await Promise.allSettled([load(),refreshStorage()]);setBusy('')}}
 function invalidate(){setPreview(null);setConsent(false);setNotice('');setError('')}
 const transfer=info?.sync?.transfer,active=['pending','unknown'].includes(transfer?.status??'')
 const normalizedBase=base.trim().replace(/\/+$/,'')
 const savedToken=info?.connection?.baseUrl===normalizedBase||!!info?.sync?.candidate?.hasToken&&normalizedBase===info.sync.candidate.baseUrl
 return <section aria-label="数据同步"><h2>数据同步</h2><p>记录先保存在此电脑。选择同步方式，让多台设备使用同一份笔记、待办和灵感。</p>
 <div role="tablist" aria-label="同步方式" style={{display:'flex',gap:8,flexWrap:'wrap'}}>{[['server','自建服务器'],['folder','云端网盘'],['icloud','iCloud Drive']].map(([id,label])=><button key={id} role="tab" aria-selected={method===id} onClick={()=>setMethod(id)}>{label}</button>)}</div>
 {method==='server'?<div role="tabpanel" aria-label="自建服务器">
 <p role="status">{active?'首次同步结果待核对，已保留原资料':view?.local?'仅存本机，尚未启用服务器同步':view?.online?'服务器已连接':'服务器暂不可达，显示本机缓存'} · 待同步 {view?.pending??0} 项 · 待核对 {view?.conflicts??0} 项</p>
 {info?.connection&&<p>当前服务器：{info.connection.baseUrl}</p>}
 {info?.sync?.lastSuccess&&<p>最近成功同步：{new Date(info.sync.lastSuccess).toLocaleString()}</p>}
 {view?.lastError&&<p className="error">{view.lastError}</p>}
 <label>服务器地址<input aria-label="同步服务器地址" type="url" placeholder="https://你的服务器" value={base} disabled={!!busy||active} onChange={e=>{setBase(e.target.value);invalidate()}}/></label>
 <label>设备令牌{savedToken?'（本机已保存，留空使用）':''}<input aria-label="同步设备令牌" type="password" autoComplete="off" value={token} disabled={!!busy} onChange={e=>{setToken(e.target.value);invalidate()}}/></label>
 {info?.sync?.candidate&&!info.connection&&<p>已准备原贾维喵服务器的连接凭据，尚未上传本机资料。请先检查连接并预览。</p>}
 <button disabled={!!busy||active||!base.trim()||(!token&&!savedToken)} onClick={()=>void run('preview',async()=>{setPreview(null);setConsent(false);setPreview(await invoke<Preview>('workspace_preview_server',{baseUrl:base,token}));setNotice('检查完成，尚未上传任何本机记录')})}>{busy==='preview'?'正在检查…':'检查连接并预览'}</button>
 {!view?.local&&<button disabled={!!busy||active} onClick={()=>void run('refresh',async()=>{await invoke('workspace_refresh');setNotice('已从服务器刷新资料')})}>立即同步</button>}
 {active&&<div><p>上次连接可能已经提交，请恢复核对。期间提交的新编辑存为本机草稿，连接确认后可在下方核对重试。令牌已失效时可在上方补充新令牌。</p><button disabled={!!busy} onClick={()=>void run('resume',async()=>{await invoke('workspace_resume_server',{token:token||null});setToken('');setNotice('回执核对已完成，请查看连接状态')})}>恢复连接并核对回执</button></div>}
 {transfer?.error&&<p className="error">{transfer.error}</p>}
 {preview&&<div className="jarvis-task" aria-label="首次同步预览"><h3>{preview.uploadLocal?'首次同步预览':'服务器连接预览'}</h3><table style={{width:'100%',textAlign:'left'}}><thead><tr><th>内容</th><th>本机</th><th>服务器</th></tr></thead><tbody>{tables.map(([t,label])=><tr key={t}><td>{label}</td><td>{preview.localCounts[t]}</td><td>{preview.remoteCounts[t]}</td></tr>)}</tbody></table>
 {preview.uploadLocal?<><p>确认后，将本机六类记录合并到此服务器，后续由服务器统一保存。其他设备的独有记录也会显示在此电脑。首次连接前自动保存本机备份。</p><p>同 ID 内容冲突：{preview.conflictCount} 项。名称相同、ID 不同的记录会分别保留。</p>{preview.conflictCount>0&&<><details><summary>查看冲突记录（最多显示 100 项）</summary><ul>{preview.conflicts.map(c=><li key={c.table+c.id}>{tables.find(([t])=>t===c.table)?.[1]}：{c.title}</li>)}</ul></details><label>冲突处理<select aria-label="首次同步冲突处理" value={resolution} onChange={e=>{setResolution(e.target.value);setConsent(false)}}><option value="keep">保留服务器内容（本机原文留备份）</option><option value="replace">使用本机内容更新服务器同 ID 记录</option></select></label></>}</>:<p>将核对同一服务器的连接，服务器资料会更新本机缓存。</p>}
 <p>同步范围：笔记本、笔记、来源、待办、灵感和关联。AI 会话归档、附件文件、模型密钥、微信凭据及桌面设置留在本机；笔记和来源中的正文会同步。</p>
 <label style={{display:'flex',alignItems:'start',gap:8}}><input style={{width:'auto'}} aria-label="确认同步范围" type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/>我已核对服务器、同步范围和冲突处理，确认连接{preview.uploadLocal?'并合并':''}</label>
 <button disabled={!!busy||!consent||active} onClick={()=>void run('connect',async()=>{await invoke('workspace_connect_server',{baseUrl:base,token,previewId:preview.id,resolution});setToken('');setPreview(null);setConsent(false);setNotice('服务器已连接，资料已核对并保存')})}>{busy==='connect'?'正在连接…':preview.uploadLocal?'确认合并并启用同步':'确认连接服务器'}</button><button disabled={!!busy} onClick={invalidate}>取消预览</button></div>}
 <p>支持现有贾维喵六表同步服务。请输入 HTTPS 地址；本机测试可使用 HTTP。同步正文可由服务器管理员读取，请选择你信任的服务器。断网新建进入待同步箱，修改冲突保留草稿，提交结果不明时先查回执。</p>
 </div>:<div role="tabpanel" aria-label={method==='folder'?'云端网盘':'iCloud Drive'}><h3>{method==='folder'?'云端网盘文件夹':'iCloud Drive 文件夹'}</h3><p>入口已保留，双向文件同步尚未接通。{method==='icloud'?'后续通过 Windows 官方 iCloud 客户端选择同步目录。':'后续可选择坚果云、OneDrive、Dropbox 等网盘的本机同步目录。'}</p><p>尚未选择目录、上传或读取网盘文件。当前资料继续使用原保存方式。</p><button disabled>文件夹同步开发中</button></div>}
 {error&&<p role="alert" className="error">{error}</p>}{notice&&<p role="status">{notice}</p>}
 </section>
}

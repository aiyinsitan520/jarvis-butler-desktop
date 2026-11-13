import {useEffect,useState} from 'react'
import {invoke} from '@tauri-apps/api/core'
import {refreshStorage} from '@/db/store'
import {SyncSettings} from '@/components/SyncSettings'
interface Operation{id:string;status:string;command:{type:string};error?:string}
export function DataSync(){
 const [operations,setOperations]=useState<Operation[]>([]),[busy,setBusy]=useState(''),[error,setError]=useState('')
 const load=async()=>{const tasks=await invoke<{operations:Operation[]}>('workspace_tasks');setOperations(tasks.operations.filter(o=>!['committed','replaced','discarded'].includes(o.status)))}
 useEffect(()=>{void load().catch(e=>setError(String(e)));const timer=setInterval(()=>{void load().catch(()=>{})},5000);return()=>clearInterval(timer)},[])
 async function run(name:string,action:()=>Promise<unknown>){setBusy(name);setError('');try{await action();await load();await refreshStorage()}catch(e){setError(String(e))}finally{setBusy('')}}
 return <div className="jarvis-settings"><h1>数据同步</h1><SyncSettings/>{error&&<p role="alert" className="error">{error}</p>}
 <section><h2>待同步与草稿</h2>{operations.length===0?<p>没有待处理的业务命令。</p>:operations.map(o=><div className="jarvis-task" key={o.id}><p>{{createNote:'新建笔记',createNotebook:'新建笔记本',createSource:'保存来源',createTodo:'新建待办',createInspiration:'保存灵感',update:'保存修改',delete:'删除记录',createRelation:'建立关联'}[o.command.type]??'保存记录'} · {{pending:'待同步',unknown:'结果待核对',draft:'本机草稿',conflict:'修改冲突'}[o.status]??'待处理'}</p><details><summary>查看草稿内容</summary><pre className="whitespace-pre-wrap text-xs">{JSON.stringify(o.command,null,2)}</pre></details>{o.error&&<p className="error">{o.error}</p>}{['draft','conflict'].includes(o.status)&&<button disabled={!!busy} onClick={()=>void run(o.id,()=>invoke('workspace_retry',{id:o.id}))}>已核对内容，重新提交</button>}{o.status!=='unknown'&&<button disabled={!!busy} onClick={()=>void run(o.id,()=>invoke('workspace_discard',{id:o.id}))}>放弃此任务</button>}<code>{o.id}</code></div>)}</section>
 </div>
}

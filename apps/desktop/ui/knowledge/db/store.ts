// Native-only data bridge. No browser business storage or network credentials.
import {useSyncExternalStore} from 'react'
import {invoke} from '@tauri-apps/api/core'
import {listen} from '@tauri-apps/api/event'
import type {Command} from './domain'
import {emptyDump} from './schema'
import type {ModelConfig,StorageSnapshot} from './schema'
export interface WorkspaceView {snapshot:StorageSnapshot|null;local:boolean;online:boolean;configured:boolean;pending:number;conflicts:number;lastError:string}
interface State{snapshot:StorageSnapshot|null;config:ModelConfig|null;configHash:string;remote:boolean;error:string;ready:boolean;view:WorkspaceView|null}
let state:State={snapshot:null,config:null,configHash:'',remote:false,error:'',ready:false,view:null}
const listeners=new Set<()=>void>()
function update(patch:Partial<State>){state={...state,...patch};listeners.forEach(f=>f())}
export function useStorage(){return useSyncExternalStore(f=>{listeners.add(f);return()=>{listeners.delete(f)}},()=>state)}
export function storageState(){return state}
function apply(view:WorkspaceView){const snap=view.snapshot??{data:{...emptyDump(),revision:0},hash:'',savedAt:'',testMode:false,runId:'',mode:'sync' as const};update({view,snapshot:snap,ready:true,error:view.local?'':view.configured?(view.lastError||(!view.online?'正在连接共享资料，显示本机缓存':'')):'尚未连接共享数据服务，请先打开设置',remote:false})}
export async function refreshStorage(){
  const [view,settings]=await Promise.all([invoke<WorkspaceView>('workspace_view'),invoke<{model:ModelConfig|null}>('workspace_settings')]);apply(view);update({config:settings.model,configHash:JSON.stringify(settings.model)});window.dispatchEvent(new Event('jarvis-ai-change'))
}
export async function request<T>(route:string,payload?:unknown):Promise<T>{
  if(route==='snapshot'){await refreshStorage();return state.snapshot as T}
  if(route==='model')return {config:state.config,hash:state.configHash}as T
  if(route==='command'){const p=payload as {command:Command};const result=await sendCommand(p.command);return {result,snapshot:state.snapshot}as T}
  throw new Error('该操作不在桌面数据接口中')
}
let queue:Promise<unknown>=Promise.resolve()
export function sendCommand(command:Command):Promise<string>{
  const run=queue.then(async()=>{
    const snap=state.snapshot;const expected=snap?.hash?{revision:snap.data.revision,hash:snap.hash}:null
    const reply=await invoke<{operation:{id:string;status:string;result:string|null;error:string|null};view:WorkspaceView}>('workspace_command',{command,expected});apply(reply.view)
    if(reply.operation.status!=='committed')throw new Error(reply.operation.error??'内容已保存到本机待同步箱；尚未确认共享保存，可在设置中查看')
    return reply.operation.result??''
  });queue=run.catch(()=>{});return run
}
export async function writeModel(config:ModelConfig|null){if(!config)throw new Error('请在桌面设置中管理模型');await invoke('workspace_save_model',{config:{...config,apiKey:config.apiKey??'__KEEP__',autoOrganize:false}});await refreshStorage()}
void listen('workspace-changed',()=>{void refreshStorage().catch(()=>{})})

import {invoke} from '@tauri-apps/api/core'
import {storageState,writeModel} from '@/db/store'
export interface ChatMessage{role:'system'|'user'|'assistant';content:string}
export interface ProviderConfig{kind:'ollama'|'openai'|'jumbo';baseUrl:string;apiKey?:string;model:string;models?:string[]}
export interface AIProvider{label:string;listModels():Promise<string[]>;chatStream(messages:ChatMessage[],model:string,signal?:AbortSignal):AsyncIterable<string>}
export function loadConfig():ProviderConfig|null{return storageState().config}
export async function saveConfig(config:ProviderConfig){await writeModel(config)}
export async function clearConfig(){throw new Error('请在桌面设置中管理模型')}
export function getProvider(config:ProviderConfig|null=loadConfig()):AIProvider|null{
 if(!config)return null
 return {label:config.kind==='ollama'?'Ollama':config.kind==='jumbo'?'超级大反代':'OpenAI 兼容',listModels:()=>invoke<string[]>('workspace_models'),async *chatStream(messages,model,signal){signal?.throwIfAborted();const requestId=crypto.randomUUID();const cancel=()=>{void invoke('workspace_ai_cancel',{requestId}).catch(()=>{})};signal?.addEventListener('abort',cancel,{once:true});try{const result=await invoke<string>('workspace_ai_chat',{messages,selectedModel:model,requestId});signal?.throwIfAborted();yield result}finally{signal?.removeEventListener('abort',cancel)}}}
}

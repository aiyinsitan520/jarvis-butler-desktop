import {invoke} from '@tauri-apps/api/core'
export interface ArchiveMessage{role:'user'|'assistant';content:string}
export interface Session{id:string;title:string;source:string;createdAt:number;updatedAt:number;messages:ArchiveMessage[];important?:boolean}
export interface Archive{sessions:Session[];review:{enabled:boolean;hour:number;lastDay:string;completed:Record<string,number>}}
let pending:Promise<unknown>=Promise.resolve()
export const readArchive=()=>invoke<Archive>('workspace_archive_load')
export function changeArchive(change:(a:Archive)=>void){const job=pending.then(async()=>{const a=await readArchive();change(a);await invoke('workspace_archive_save',{value:a});return a});pending=job.catch(()=>{});return job}
export function saveSession(session:Session){return changeArchive(a=>{const at=a.sessions.findIndex(s=>s.id===session.id);if(at<0)a.sessions.unshift(session);else a.sessions[at]=session})}
export function dayKey(time=Date.now()){const d=new Date(time);return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`}
const DAY=86400000
export function reviewDue(s:Session,review:Archive['review'],now=Date.now()){
 const elapsed=(now-s.createdAt)/DAY;const last=review.completed[s.id]??0
 const stage=[1,3,7,14,30].filter(days=>elapsed>=days).at(-1)
 return stage!==undefined&&last<s.createdAt+stage*DAY
}
export async function parseConversations(text:string,filename:string):Promise<Session[]>{
 if(text.length>20*1024*1024)throw new Error('单次导入上限20MiB')
 let raw:unknown
 if(/\.json$/i.test(filename)){try{raw=JSON.parse(text)}catch{throw new Error('JSON文件格式不正确')}}
 else raw=[{title:filename.replace(/\.[^.]+$/,''),messages:[{role:'user',content:text}]}]
 const record=raw as {conversations?:unknown[];sessions?:unknown[]};const backup=!!record&&Array.isArray(record.sessions);const list=Array.isArray(raw)?raw:record?.conversations??record?.sessions??[raw]
 if(list.length>1000)throw new Error('一次最多导入1000个会话')
 const out:Session[]=[]
 for(const unknownItem of list){
  if(!unknownItem||typeof unknownItem!=='object')continue
  const item=unknownItem as Record<string,any>;let source='导入文本';let messages:ArchiveMessage[]=[]
  if(item.mapping&&typeof item.mapping==='object'){
   source='ChatGPT';const map=item.mapping;let node=typeof item.current_node==='string'?item.current_node:Object.keys(map).find(k=>!(map[k]?.children?.length))
   const path:any[]=[];const seen=new Set<string>()
   while(node&&map[node]&&!seen.has(node)){seen.add(node);path.unshift(map[node]);node=map[node].parent}
   messages=path.flatMap(n=>{const m=n.message;const role=m?.author?.role;const content=m?.content?.parts?.filter((x:unknown)=>typeof x==='string').join('\n');return ['user','assistant'].includes(role)&&content?[{role,content}]:[]})
  }else{
   const input=Array.isArray(item.chat_messages)?item.chat_messages:Array.isArray(item.messages)?item.messages:[];source=backup&&typeof item.source==='string'?item.source:item.chat_messages?'Claude':'通用会话'
   messages=input.flatMap((m:any)=>{const role=m.role??(m.sender==='human'?'user':m.sender==='assistant'?'assistant':'');const body=m.text??m.content;const content=typeof body==='string'?body:Array.isArray(body)?body.map((p:any)=>p.text??'').join('\n'):'';return ['user','assistant'].includes(role)&&content?[{role,content}]:[]})
  }
  if(!messages.length)continue
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify({source,messages}))))).map(b=>b.toString(16).padStart(2,'0')).join('')
  const ts=item.createdAt??item.create_time??item.created_at;const parsed=typeof ts==='number'?ts*(ts<1e12?1000:1):Date.parse(String(ts??''));const at=Number.isFinite(parsed)&&parsed>0&&parsed<=Date.now()?parsed:Date.now()
  out.push({id:backup&&typeof item.id==='string'&&/^[a-zA-Z0-9_-]{8,128}$/.test(item.id)?item.id:'import-'+hash,title:String(item.title??item.name??filename).slice(0,200),source,createdAt:at,updatedAt:Date.now(),messages,...(backup&&item.important===true?{important:true}:{})})
 }
 if(!out.length)throw new Error('未找到支持的文字会话。支持 ChatGPT conversations.json、Claude 会话JSON、messages JSON和Markdown/TXT。')
 return out
}

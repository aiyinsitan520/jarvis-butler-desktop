// Isolated browser bridge to the actual Rust local store; fake AI, no production data.
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {mkdtemp,readFile} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {once} from 'node:events';
import {createSyncServer} from '../tests/compatibility/server/api.ts';
const cwd=process.cwd(),root=await mkdtemp(path.join(tmpdir(),'jarvis-fusion-browser-'));
const driver=spawn(path.join(cwd,'target/debug/workspace-driver.exe'),[path.join(root,'workspace.db')],{stdio:['pipe','pipe','inherit']});
const waiting=[];createInterface({input:driver.stdout}).on('line',line=>{const job=waiting.shift();const reply=JSON.parse(line);if(reply.error)job.reject(Error(reply.error));else job.resolve(reply.value)});
const call=action=>new Promise((resolve,reject)=>{waiting.push({resolve,reject});driver.stdin.write(JSON.stringify(action)+'\n')});
let syncServer,syncStore,syncBaseUrl='',connection=null;
if(process.env.JARVIS_SYNC_FIXTURE==='1'){
 const s=await createSyncServer({root:path.join(root,'sync-server'),port:0,sharedToken:'synthetic-browser-sync-token'});syncServer=s.server;syncStore=s.store;
 syncServer.listen(0,'127.0.0.1');await once(syncServer,'listening');syncBaseUrl=`http://127.0.0.1:${syncServer.address().port}`;
 await call({action:'submit',expected:null,command:{type:'createTodo',data:{title:'本机同步预览示例'}}});
 const snap=await syncStore.snapshot();await syncStore.command({revision:snap.data.revision,hash:snap.hash},{type:'createTodo',data:{title:'另一端的学习计划'}});
}
let model=null,aiCalls=0;const launches=[],openedWindows=[];let savedNotes=[],fitHeight=0;
const launchItems=['Claude Code','微信','截图工具','UU远程','DeskBox','反代8080','Hermes','QQ'].map((name,i)=>({id:`fixture-app-${i}`,name,kind:'app',path:'fixture-only',pys:[...(name==='微信'?[['wei'],['xin']]:name.toLowerCase().split(' ').map(s=>[s]))],icon:'data:image/svg+xml,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" rx="14" fill="${['#e3c5a8','#15ba79','#4da4da','#5c88ea','#4ba7de','#46526b','#626b59','#252525'][i]}"/><text x="32" y="42" text-anchor="middle" font-family="sans-serif" font-size="26" fill="white">${i+1}</text></svg>`),junk:false,missing:false,runs:0}));
const settings={style:'warm',theme:'light',font_size:'m',mascot:true,motion:'reduce',tags:[],note_cats:[],widget:false,launcher:{pins:launchItems.map(i=>i.id),aliases:[],custom:[],hidden:[],off:[]},hk_flash:'Alt+Space',hk_qnote:'Ctrl+Alt+N',hk_main:'Ctrl+Alt+H',hk_focus:'Ctrl+Alt+F',ai_key:'',ai_base:'',ai_model:'',morning:false,wrap:false,wrap_time:'18:00',widget_hide:[],web_keys:[],sync_ai_key:false,auto_update:false};
const emptyArchive=()=>({sessions:[],review:{enabled:false,hour:9,lastDay:'',completed:{}}});
async function invoke(command,args={}){
 if(command==='workspace_local_status')return {root:path.join(root,'library'),vault:await call({action:'getValue',key:'vault-state'}),collectors:await call({action:'getValue',key:'collectors'})??[],learning:await call({action:'getValue',key:'learning-config'})??{auto:false,wechat:false},reports:await call({action:'getValue',key:'learning-reports'})??{}};
 if(command==='workspace_local_scan')return call({action:'vaultScan'});
 if(command==='workspace_learning_config')return call({action:'setValue',key:'learning-config',value:args});
 if(command==='workspace_collector_preview')return {id:'fixture-collector',path:path.join(root,'synthetic-logs'),kind:args.kind,preview:{files:2}};
 if(command==='workspace_collector_save')return call({action:'setValue',key:'collectors',value:[{id:args.id,kind:'codex',path:'synthetic-logs',enabled:args.enabled}]});

 if(command==='workspace_view')return call({action:'view'});
 if(command==='workspace_refresh'){await call({action:'refresh'});return call({action:'view'})}
 if(command==='workspace_command'){const operation=await call({action:'submit',command:args.command,expected:args.expected??null});return {operation,view:await call({action:'view'})}}
 if(command==='workspace_archive_load')return await call({action:'getValue',key:'learning-archive'})??emptyArchive();
 if(command==='workspace_archive_save')return call({action:'compareValue',key:'learning-archive',value:args.value,revision:args.value.revision??0});
 if(command==='workspace_settings')return {model,connection,sync:{candidate:syncBaseUrl?{baseUrl:syncBaseUrl,hasToken:true}:null,transfer:await call({action:'serverStatus'}),lastSuccess:await call({action:'getValue',key:'sync-last-success'})},memoryRoot:null,wechat:{bound:false,paired:false,enabled:false,state:{channelStatus:'stopped'}}};
 if(command==='workspace_preview_server')return call({action:'previewServer',baseUrl:args.baseUrl,token:args.token||(args.baseUrl.replace(/\/+$/,'')===syncBaseUrl?'synthetic-browser-sync-token':'')});
 if(command==='workspace_connect_server'){const result=await call({action:'connectServer',baseUrl:args.baseUrl,token:args.token||(args.baseUrl.replace(/\/+$/,'')===syncBaseUrl?'synthetic-browser-sync-token':''),previewId:args.previewId,resolution:args.resolution});connection={baseUrl:args.baseUrl};return result;}
 if(command==='fixture_sync_info'){const snap=await syncStore.snapshot();return {baseUrl:syncBaseUrl,revision:snap.data.revision,todoCount:snap.data.todos.length};}
 if(command==='workspace_save_model'){model={...args.config,hasKey:false};delete model.apiKey;return null;}
 if(command==='workspace_models')return ['fixture-local-model'];
 if(command==='workspace_ai_chat'){aiCalls++;await new Promise(r=>setTimeout(r,80));return '学习要点：主动回忆与间隔复习。建议明天回顾今天的概念，并用自己的例子解释。';}
 if(command==='workspace_ai_cancel')return null;
 if(command==='workspace_tasks')return {operations:await call({action:'operations'}),captures:await call({action:'captures'})};
 if(command==='launcher_list')return launchItems;
 if(command==='launcher_stats')return {n:{},last:{},q:{}};
 if(command==='launcher_open'){launches.push(args);return null;}
 if(command==='fit_window'){fitHeight=args.height;return null;}
 if(command==='open_window'){openedWindows.push(args.name);return null;}
 if(command==='save_note'){const n={...args.note,id:args.note.id||savedNotes.length+1};savedNotes=savedNotes.filter(v=>v.id!==n.id);savedNotes.push(n);return n;}
 if(command==='delete_note'){savedNotes=savedNotes.filter(v=>v.id!==args.id);return null;}
 if(command==='list_notes')return savedNotes;
 if(command==='get_settings')return settings;
 if(command==='save_settings'){Object.assign(settings,args.settings);return settings;}
 if(command==='get_focus')return {manual:false,auto:false,active:false,held:0};
 if(command==='sync_status')return {state:'off',official:false,held_files:0,large_files:0,unsynced:0};
 if(command==='list_trash')return {notes:[],reminders:[]};
 if(['list_notes','list_reminders','inbox_list','list_devices','list_attachments','note_windows'].includes(command))return [];
 if(command==='update_status')return {current:'0.3.0',state:'idle',checking:false,too_old:false};
 if(command==='checklist_get')return {hidden:true,items:[],done:0,total:0};
 if(command==='terms_info')return Object.fromEntries(['terms','privacy','sync_terms'].map(k=>[k,{recent:null,notice:null,started:false}]));
 if(command==='is_test_copy')return true;
 if(command==='attachment_dir')return '';
 if(command==='fixture_counts')return {aiCalls,launches,openedWindows,savedNotes,fitHeight};
 return null;
}
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{try{
 if(req.method==='POST'&&req.url==='/invoke'){let body='';for await(const part of req){body+=part;if(body.length>26*1024*1024)throw Error('fixture request too large')}const {command,args}=JSON.parse(body);res.setHeader('Content-Type','application/json');try{res.end(JSON.stringify({value:await invoke(command,args)}))}catch(e){res.end(JSON.stringify({error:e.message}))}return;}
 const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);const dist=path.resolve('apps/desktop/dist');const file=path.resolve(dist,'.'+(pathname==='/'?'/index.html':pathname));if(!file.startsWith(dist+path.sep)){res.writeHead(403);res.end();return;}res.setHeader('Content-Type',mime[path.extname(file)]??'application/octet-stream');res.end(await readFile(file));
 }catch{res.writeHead(404);res.end('not found')}});
server.listen(1421,'127.0.0.1',()=>console.log('Fusion browser fixture: http://127.0.0.1:1421 (Rust local store, fake AI)'));
process.on('SIGINT',()=>{server.close();syncServer?.close();driver.kill();process.exit(0)});

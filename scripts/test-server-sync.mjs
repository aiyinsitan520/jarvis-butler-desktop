// Actual Rust client against the unchanged six-table Jarvis API. All data is synthetic.
import assert from 'node:assert/strict';
import {mkdtemp,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {once} from 'node:events';
import {createServer,request} from 'node:http';
import {createSyncServer} from '../tests/compatibility/server/api.ts';

const root=await mkdtemp(path.join(tmpdir(),'jarvis-server-sync-'));
const token='synthetic-server-sync-token';
const {server,store}=await createSyncServer({root:path.join(root,'server'),port:0,sharedToken:token});
server.listen(0,'127.0.0.1');await once(server,'listening');
let posts=0,dropNext=false,beforePost=null,offline=false,lastEnvelope;
const proxy=createServer(async(req,res)=>{
 if(offline){res.writeHead(503,{'Content-Type':'application/json'});res.end('{}');return;}
 if(req.method==='POST'){posts++;if(beforePost){const f=beforePost;beforePost=null;await f();}}
 const upstream=request({hostname:'127.0.0.1',port:server.address().port,path:req.url,method:req.method,headers:req.headers},r=>{
  if(req.method==='POST'&&dropNext){dropNext=false;r.resume();r.on('end',()=>res.destroy());return;}
  res.writeHead(r.statusCode,r.headers);r.pipe(res);
 });upstream.on('error',()=>res.destroy());
 if(req.method==='POST'){let raw='';for await(const c of req)raw+=c;lastEnvelope=JSON.parse(raw);upstream.end(raw);}else req.pipe(upstream);
});
proxy.listen(0,'127.0.0.1');await once(proxy,'listening');
const baseUrl=`http://127.0.0.1:${proxy.address().port}`,connection={baseUrl,token};
const expected=s=>({revision:s.data.revision,hash:s.hash});
const children=[];
function driver(name){
 const c=spawn(path.resolve(`target/debug/workspace-driver${process.platform==='win32'?'.exe':''}`),[path.join(root,`${name}.db`)],{stdio:['pipe','pipe','pipe'],windowsHide:true});children.push(c);let jobs=[];let err='';c.stderr.on('data',s=>err+=s);createInterface({input:c.stdout}).on('line',line=>{const job=jobs.shift(),r=JSON.parse(line);if(r.error)job.reject(Error(r.error));else job.resolve(r.value)});c.on('exit',code=>{for(const j of jobs)j.reject(Error(`driver exited ${code}: ${err}`));jobs=[];});
 return {call:v=>new Promise((resolve,reject)=>{jobs.push({resolve,reject});c.stdin.write(JSON.stringify(v)+'\n')}),close:async()=>{c.stdin.end();await once(c,'exit')}};
}
let passed=0;const ok=name=>{passed++;console.log('PASS '+name)};
async function submit(d,command){return d.call({action:'submit',command,expected:null});}
async function remote(command){const s=await store.snapshot();return store.command(expected(s),command);}
async function preview(d){return d.call({action:'previewServer',...connection});}
async function connect(d,p,resolution='keep'){return d.call({action:'connectServer',...connection,previewId:p.id,resolution});}
try{
 let a=driver('a');const b=driver('b');
 const nb=await submit(a,{type:'createNotebook',data:{name:'本机学习',tone:'amber'}});
 const note=await submit(a,{type:'createNote',data:{notebookId:nb.result,title:'本机笔记',content:'只上传此六表正文'}});
 const todo=await submit(a,{type:'createTodo',data:{title:'本机待办',due:'2026-11-15'}});
 await submit(a,{type:'createInspiration',data:{title:'本机灵感',content:'主动回忆'}});
 await submit(a,{type:'createSource',data:{notebookId:nb.result,title:'来源',type:'file',content:'原文'}});
 await submit(a,{type:'createRelation',data:{fromId:note.result,fromType:'note',toId:todo.result,toType:'todo',relationType:'mentions'}});
 await a.call({action:'compareValue',key:'learning-archive',revision:0,value:{revision:0,sessions:[{title:'PRIVATE_ARCHIVE_SENTINEL'}]}});
 await remote({type:'createTodo',data:{title:'服务器原有待办'}});
 const p=await preview(a);assert.equal(posts,0);assert.equal(p.localCounts.notes,1);assert.equal(p.remoteCounts.todos,1);assert.equal((await a.call({action:'view'})).local,true);ok('preview is read-only and reports both sides without switching local authority');
 await assert.rejects(()=>a.call({action:'previewServer',baseUrl,token:'wrong-synthetic-token'}),/令牌/);assert.equal(posts,0);ok('invalid token rejects read-only preflight without uploading');
 await submit(a,{type:'createTodo',data:{title:'预览后的编辑'}});await assert.rejects(()=>connect(a,p),/本机资料/);assert.equal(posts,0);ok('changed local records invalidate consent and prevent upload');
 const stale=await preview(a);await remote({type:'createTodo',data:{title:'预览后的远端编辑'}});await assert.rejects(()=>connect(a,stale),/服务器资料/);assert.equal(posts,0);ok('changed remote revision requires a new preview before uploading');
 const fresh=await preview(a);const connected=await connect(a,fresh);assert.equal(connected.status,'complete');assert.equal(posts,1);const localView=await a.call({action:'view'});assert.equal(localView.local,false);assert.equal(localView.configured,true);assert.equal(localView.snapshot.data.notes[0].id,note.result);assert.equal(localView.snapshot.data.todos.length,4);assert.equal(localView.snapshot.data.relations.length,1);ok('confirmed import merges six tables once, preserves IDs and keeps remote-only records');
 const confirmedCredential=await a.call({action:'getValue',key:'server-connection-credential'});const renew=await preview(a);const failedCredentialId='00000000000000000000000000000001';await assert.rejects(()=>a.call({action:'connectServer',baseUrl,token:'invalid-renewal-token',previewId:renew.id,resolution:'keep',credentialId:failedCredentialId}),/令牌/);assert.equal(await a.call({action:'getValue',key:'server-connection-credential'}),confirmedCredential);assert.equal((await a.call({action:'refresh'})).data.notes[0].id,note.result);ok('failed credential renewal cannot become a confirmed recovery identity or replace working connection');
 await a.call({action:'connectServer',...connection,previewId:renew.id,resolution:'keep',credentialId:'00000000000000000000000000000002'});assert.equal(await a.call({action:'getValue',key:'server-connection-credential'}),'00000000000000000000000000000002');assert.equal(posts,1);ok('validated same-server credential renewal commits a distinct recovery identity without another import');
 const backup=await a.call({action:'getValue',key:connected.backupKey});assert.equal(backup.data.notes[0].id,note.result);assert.equal(backup.data.todos.length,2);ok('original local snapshot is durably backed up before first upload');
 assert.equal(JSON.stringify(lastEnvelope).includes('PRIVATE_ARCHIVE_SENTINEL'),false);assert.equal((await a.call({action:'getValue',key:'learning-archive'})).sessions[0].title,'PRIVATE_ARCHIVE_SENTINEL');ok('private AI archive stays local and is absent from the import envelope');
 await b.call({action:'configure',...connection});await b.call({action:'refresh'});await submit(b,{type:'update',table:'notes',id:note.result,data:{content:'另一端修改'}});let s=await a.call({action:'refresh'});assert.equal(s.data.notes[0].content,'另一端修改');await submit(a,{type:'update',table:'todos',id:todo.result,data:{done:true}});s=await b.call({action:'refresh'});assert.equal(s.data.todos.find(t=>t.id===todo.result).done,true);await submit(b,{type:'delete',table:'notes',id:note.result});s=await a.call({action:'refresh'});assert.equal(s.data.notes.length,0);ok('two actual clients share edits, todo completion and deletion after connection');
 await a.close();a=driver('a');await a.call({action:'configure',...connection});assert.equal((await a.call({action:'refresh'})).data.todos.find(t=>t.id===todo.result).done,true);ok('connected database reopens with the same server and persistent records');
 await assert.rejects(()=>a.call({action:'previewServer',baseUrl:'http://127.0.0.1:12345',token}),/另一台服务器/);ok('switching an existing database to an unrelated server is refused');
 const lost=driver('lost');const lostTodo=await submit(lost,{type:'createTodo',data:{title:'响应丢失仍只导入一次'}});const lp=await preview(lost);dropNext=true;const before=posts;await assert.rejects(()=>connect(lost,lp),/待核对/);assert.equal((await lost.call({action:'serverStatus'})).status,'unknown');const held=await submit(lost,{type:'createTodo',data:{title:'未确认时保留为草稿'}});assert.equal(held.status,'draft');await assert.rejects(()=>lost.call({action:'retry',id:held.id}),/首次同步/);await assert.rejects(()=>lost.call({action:'resumeServer',baseUrl,token:'revoked-synthetic-token'}),/回执/);await lost.close();const resumed=driver('lost');assert.equal((await resumed.call({action:'serverStatus'})).status,'unknown');const recovered=await resumed.call({action:'resumeServer',...connection});assert.equal(recovered.status,'complete');assert.equal(posts,before+1);assert.equal((await store.snapshot()).data.todos.filter(t=>t.id===lostTodo.result).length,1);assert.equal((await resumed.call({action:'operations'})).find(o=>o.id===held.id).status,'draft');const accepted=await resumed.call({action:'retry',id:held.id});assert.equal(accepted.status,'committed');ok('lost response retains new edits as drafts; restart and corrected credentials recover receipt without repeating import');
 const racing=driver('racing');await submit(racing,{type:'createTodo',data:{title:'保留的本机原稿'}});const rp=await preview(racing);beforePost=()=>remote({type:'createTodo',data:{title:'提交竞态远端新内容'}});await assert.rejects(()=>connect(racing,rp),/重新预览/);assert.equal((await racing.call({action:'view'})).local,true);assert.equal((await racing.call({action:'view'})).snapshot.data.todos[0].title,'保留的本机原稿');assert.equal((await racing.call({action:'serverStatus'})).status,'rejected');await connect(racing,await preview(racing));ok('commit-time remote race rejects safely, retains local draft and accepts explicit new preview');
 for(const resolution of ['keep','replace']){
  const d=driver('conflict-'+resolution);const item=await submit(d,{type:'createTodo',data:{title:'本机同ID内容'}});const dump=(await d.call({action:'view'})).snapshot.data;dump.todos[0].title='远端同ID内容';await remote({type:'import',dump,resolution:'keep'});const cp=await preview(d);assert.equal(cp.conflictCount,1);await connect(d,cp,resolution);assert.equal((await store.snapshot()).data.todos.find(t=>t.id===item.result).title,resolution==='keep'?'远端同ID内容':'本机同ID内容');ok(`same-ID conflicts use explicit ${resolution} policy without losing unique rows`);
 }
 offline=true;await assert.rejects(()=>a.call({action:'refresh'}));const queued=await submit(a,{type:'createTodo',data:{title:'云端连接后的离线记录'}});assert.equal(queued.status,'pending');offline=false;await a.call({action:'flush'});assert.equal((await store.snapshot()).data.todos.filter(t=>t.title==='云端连接后的离线记录').length,1);ok('offline new record remains queued and syncs once when server returns');
 await a.close();assert.equal((await readFile(path.join(root,'a.db'))).includes(Buffer.from(token)),false);ok('device token is absent from durable business database');
 console.log(JSON.stringify({passed,productionWrites:0,realModelCalls:0,root}));
}finally{for(const c of children)if(c.exitCode===null){c.stdin.end();c.kill();}await new Promise(r=>proxy.close(r));await new Promise(r=>server.close(r));await store.close();}

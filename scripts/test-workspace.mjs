import assert from 'node:assert/strict';
import {mkdtemp,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {createServer,request} from 'node:http';
import {once} from 'node:events';
import {createSyncServer} from '../tests/compatibility/server/api.ts';
import {fingerprintOf} from '../tests/compatibility/server/storage.ts';

const root=await mkdtemp(path.join(tmpdir(),'jarvis-workspace-e2e-'));
const token='isolated-integration-test-token';
const {server,store}=await createSyncServer({root:path.join(root,'server'),port:0,sharedToken:token});
server.listen(0,'127.0.0.1');await once(server,'listening');
const port=server.address().port;
let dropNext=false,postCount=0,forceOffline=false;
const proxy=createServer((req,res)=>{
 if(forceOffline){res.writeHead(503,{'Content-Type':'application/json'});res.end('{}');return;}
 const upstream=request({hostname:'127.0.0.1',port,path:req.url,method:req.method,headers:{...req.headers,host:`127.0.0.1:${port}`}},r=>{
  if(req.method==='POST'&&req.url==='/api/sync/command'){postCount++;if(dropNext){dropNext=false;r.resume();r.on('end',()=>res.destroy());return}}
  res.writeHead(r.statusCode,r.headers);r.pipe(res);
 });upstream.on('error',()=>res.destroy());req.pipe(upstream);
});proxy.listen(0,'127.0.0.1');await once(proxy,'listening');
const baseUrl=`http://127.0.0.1:${proxy.address().port}`;
let modelCalls=0,modelFail=false;
const modelServer=createServer(async(req,res)=>{let raw='';for await(const c of req)raw+=c;const body=JSON.parse(raw);assert.equal(body.stream,false);assert.ok(!('tools'in body));modelCalls++;res.setHeader('Content-Type','application/json');if(modelFail){res.writeHead(500);res.end('{}');return}res.end(JSON.stringify({choices:[{message:{content:JSON.stringify({title:'整理测试',body:'保留事实：42',summary:'测试摘要',tags:['测试'],notebookId:'not-real',reminderCandidates:['明天下午核对']})}}]}))});modelServer.listen(0,'127.0.0.1');await once(modelServer,'listening');
const model={kind:'openai',baseUrl:`http://127.0.0.1:${modelServer.address().port}`,model:'fake-model',apiKey:'',models:[],autoOrganize:true};
const children=[];
function driver(name){
 const child=spawn(path.resolve(`target/debug/workspace-driver${process.platform==='win32'?'.exe':''}`),[path.join(root,`${name}.db`)],{stdio:['pipe','pipe','pipe'],windowsHide:true});children.push(child);let pending=[];let stderr='';child.stderr.on('data',c=>stderr+=c);const lines=createInterface({input:child.stdout});lines.on('line',s=>{const next=pending.shift();if(next)next.resolve(JSON.parse(s))});child.on('exit',code=>{for(const p of pending)p.reject(new Error(`driver exited ${code}: ${stderr.slice(0,500)}`));pending=[]});
 return {async call(v){const out=await new Promise((resolve,reject)=>{pending.push({resolve,reject});child.stdin.write(JSON.stringify(v)+'\n')});if(out.error)throw new Error(out.error);return out.value},async close(){child.stdin.end();await once(child,'exit')}};
}
let passed=0;const ok=name=>{passed++;console.log(`PASS ${name}`)};
const expected=s=>({revision:s.data.revision,hash:s.hash});
try{
 let a=driver('a'),b=driver('b');for(const d of[a,b])await d.call({action:'configure',baseUrl,token});
 const sa=await a.call({action:'refresh'}),sb=await b.call({action:'refresh'});
 const nb=await a.call({action:'submit',expected:expected(sa),command:{type:'createNotebook',data:{name:'共享测试',desc:'',tone:'amber'}}});assert.equal(nb.status,'committed');ok('native client creates data accepted by unchanged Jarvis six-table service');
 const stale=await b.call({action:'submit',expected:expected(sb),command:{type:'createNote',data:{notebookId:nb.result,title:'两个客户端',content:'正文'}}});assert.equal(stale.status,'conflict');assert.equal((await store.snapshot()).data.notes.length,0);ok('stale revision preserves draft and does not overwrite another client');
 const retried=await b.call({action:'retry',id:stale.id});assert.equal(retried.status,'committed');const updated=await a.call({action:'refresh'});assert.equal(updated.data.notes[0].id,retried.result);ok('explicit conflict review retries and other client sees same string ID');
 assert.equal(retried.fingerprint,fingerprintOf(retried.expected,retried.command));ok('Rust fingerprint matches production Node canonical JSON implementation');
 dropNext=true;const before=postCount;const dropped=await a.call({action:'submit',expected:expected(updated),command:{type:'createTodo',data:{title:'响应丢失测试'}}});assert.equal(dropped.status,'unknown');assert.equal((await store.snapshot()).data.todos.length,1);await a.close();a=driver('a');await a.call({action:'configure',baseUrl,token});await a.call({action:'flush'});assert.equal(postCount,before+1);assert.equal((await store.snapshot()).data.todos.length,1);assert.equal((await a.call({action:'operations'})).find(o=>o.id===dropped.id).status,'committed');ok('lost response and restart recover from receipt without repeating create');
 const offline=driver('offline');await offline.call({action:'configure',baseUrl,token});forceOffline=true;const queued=await offline.call({action:'submit',expected:null,command:{type:'createInspiration',data:{content:'离线草稿'}}});assert.equal(queued.status,'pending');forceOffline=false;await offline.close();const restored=driver('offline');await restored.call({action:'configure',baseUrl,token});await restored.call({action:'flush'});assert.equal((await store.snapshot()).data.inspirations.length,1);ok('offline capture persists across process restart then commits once');
 const capture=await a.call({action:'capture',key:'test-original-1',raw:'事实是42，不要自动创建提醒'});const organized=await a.call({action:'process',id:capture.id,model,retry:false});assert.equal(organized.status,'complete');assert.ok(organized.sourceId&&organized.noteId);let snapshot=await store.snapshot();assert.equal(snapshot.data.sources.find(s=>s.id===organized.sourceId).content,'事实是42，不要自动创建提醒');assert.deepEqual(snapshot.data.notes.find(n=>n.id===organized.noteId).tags,['测试']);assert.ok(snapshot.data.relations.some(r=>r.fromId===organized.noteId&&r.toId===organized.sourceId));assert.equal(snapshot.data.todos.length,1);ok('raw source, AI note, tags and derived relation save; reminder is only a candidate');
 const calls=modelCalls;await a.call({action:'capture',key:'test-original-1',raw:'事实是42，不要自动创建提醒'});await a.call({action:'process',id:capture.id,model,retry:false});assert.equal(modelCalls,calls);ok('duplicate source and completed retry neither call model nor create duplicate note');
 modelFail=true;const failure=await a.call({action:'capture',raw:'模型失败仍保存原文'});const failed=await a.call({action:'process',id:failure.id,model,retry:false});assert.ok(failed.sourceId);assert.equal(failed.status,'needs_attention');const failedCalls=modelCalls;await a.call({action:'process',id:failure.id,model,retry:false});assert.equal(modelCalls,failedCalls);modelFail=false;const repaired=await a.call({action:'process',id:failure.id,model,retry:true});assert.equal(repaired.status,'complete');ok('model failure retains source and requires explicit retry without duplicate billing');
 const local=driver('local');assert.equal((await local.call({action:'view'})).local,true);const localCapture=await local.call({action:'capture',key:'local-original',raw:'本机学习成果：主动回忆'});const localNote=await local.call({action:'process',id:localCapture.id,model,retry:false});assert.equal(localNote.status,'complete');const localView=await local.call({action:'view'});assert.equal(localView.snapshot.data.notes.length,1);assert.equal(localView.snapshot.data.sources.length,1);assert.equal(localView.snapshot.data.relations.length,1);ok('local authority completes source, fake AI note, tags and derived relation without sync service');await local.close();const reopen=driver('local');assert.equal((await reopen.call({action:'view'})).snapshot.data.notes[0].id,localNote.noteId);const countBefore=modelCalls;await reopen.call({action:'process',id:localCapture.id,model,retry:false});assert.equal(modelCalls,countBefore);ok('local capture survives process restart and never repeats completed model request');
 const data=await readFile(path.join(root,'a.db'));assert.equal(data.includes(Buffer.from(token)),false);ok('sync token never enters SQLite business/cache file');
 console.log(JSON.stringify({passed,modelCalls,realModelCalls:0,productionWrites:0,root}));
}finally{for(const c of children)if(c.exitCode===null){c.stdin.end();c.kill()}await new Promise(r=>proxy.close(r));await new Promise(r=>server.close(r));await new Promise(r=>modelServer.close(r));await store.close();}

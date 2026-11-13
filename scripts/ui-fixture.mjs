// Isolated UI fixture: no production files, external model, or credentials.
import {createSyncServer} from '../tests/compatibility/server/api.ts';
import {mkdtemp} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {createServer} from 'node:http';
const root=await mkdtemp(path.join(tmpdir(),'jarvis-desktop-ui-'));
const {server,store}=await createSyncServer({root,port:5297,sharedToken:'ui-fixture-token'});
server.listen(5297,'127.0.0.1',()=>console.log('Isolated Jarvis fixture ready on 5297'));
const model=createServer(async(req,res)=>{let body='';for await(const c of req)body+=c;res.setHeader('Content-Type','application/json');if(req.method==='GET'){res.end(JSON.stringify({data:[{id:'fixture-model'}]}));return}res.end(JSON.stringify({choices:[{message:{content:JSON.stringify({title:'测试笔记：今天的想法',body:'保留原文中的想法，并分成清楚的段落。',summary:'一次隔离环境中的整理测试。',tags:['演示'],notebookId:'',reminderCandidates:['明天下午核对计划']})}}]}))});
model.listen(5298,'127.0.0.1');
process.on('SIGINT',()=>{server.close();model.close();void store.close().then(()=>process.exit())});

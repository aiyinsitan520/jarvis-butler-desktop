// Synthetic public documentation data; never opens a user's profile or account.
import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {mkdir,writeFile,access} from 'node:fs/promises';
import {once} from 'node:events';
import path from 'node:path';
export const demoDate='2026-11-13';
const ago=n=>Date.parse(`${demoDate}T10:00:00+08:00`)-n*86400000;
export const demoArchive={revision:1,sessions:[
 {id:'demo-codex-active-recall',source:'Codex',title:'主动回忆：把“看懂”变成“能复述”',createdAt:ago(1),updatedAt:ago(1),important:true,messages:[{role:'user',content:'我看完了线性代数的视频，第二天却说不清特征向量是什么。应该怎么复习？'},{role:'assistant',content:'先合上资料，用自己的话解释：特征向量的方向在这个线性变换下保持不变。再画一个二维例子，检查解释是否成立。\n\n把复习拆成三步：独立复述 → 做例题 → 对照资料修正。标记“讨论过”和“已验证”，不要把聊天完成当成已经掌握。'}]},
 {id:'demo-claude-reading',source:'Claude Code',title:'阅读代码：先梳理数据流，再修改实现',createdAt:ago(3),updatedAt:ago(3),important:true,messages:[{role:'user',content:'面对一个陌生项目，怎样找到真正需要修改的地方？'},{role:'assistant',content:'沿着入口、状态、保存接口和界面刷新这条路径阅读。先写出最小复现和预期行为，再选择验证方法。保留原始数据与失败证据。'}]},
 {id:'demo-jarvis-conversation',source:'贾维喵',title:'帮我把学习记录变成明天的复习计划',createdAt:ago(0),updatedAt:ago(0),messages:[{role:'user',content:'帮我把学习记录变成明天的复习计划。'},{role:'assistant',content:'可以从今天记录的三个概念开始：\n\n1. 合上笔记，用自己的话解释“主动回忆”。\n2. 画图说明特征向量，并做一道例题。\n3. 对照原会话，记录仍然说不清的问题。\n\n这些是演示资料中的建议。实际使用时，请结合练习结果确认掌握程度。'}]}
],review:{enabled:false,hour:9,lastDay:'',completed:{}}};
export const demoReports={'2026-11-12':{day:'2026-11-12',status:'excerpt',desktop:'pending',wechat:'pending',sources:[{id:'demo-codex-active-recall',title:demoArchive.sessions[0].title}],body:'# 2026-11-12 学习回顾\n\n## 昨日重点\n\n- 主动回忆：先独立复述，再对照原资料。\n- 特征向量：关注变换前后的方向是否保持不变。\n\n## 待验证的问题\n\n能否不用原文解释概念，并完成一道二维矩阵例题？\n\n## 明天试一试\n\n合上笔记写出定义，再用自己的例子检查理解。\n\n来源：demo-codex-active-recall。\n\n本报告为公开截图准备的合成摘录，不代表真实模型推理或真实微信投递。'}};
export async function seed(call){
 const nb=(await call({action:'submit',expected:null,command:{type:'createNotebook',data:{name:'学习与研究',desc:'把对话沉淀为可以复习的知识',tone:'amber'}}})).result;
 for(const [title,content]of [
 ['主动回忆的三步练习','## 先回忆，再核对\n\n1. 合上资料，用自己的话解释。\n2. 画图或举一个具体例子。\n3. 对照原文，修正遗漏与误解。\n\n**明日复习问题**：不用资料，我能否解释今天学到的概念？'],
 ['线性代数：特征向量的直观理解','矩阵作用后，方向保持不变的非零向量可以成为特征向量。\n\n下一步：画出二维变换，再用一道例题验证。'],
 ['阅读陌生项目的检查清单','入口 → 状态 → 保存接口 → 刷新。\n\n先复现，再修改；先备份，再迁移。记录验证日期与未覆盖的情况。']
 ])await call({action:'submit',expected:null,command:{type:'createNote',data:{notebookId:nb,title,content}}});
 for(const title of ['明天不看资料解释特征向量','复盘本周三条最重要的学习记录'])await call({action:'submit',expected:null,command:{type:'createTodo',data:{title,notebookId:nb,priority:'normal'}}});
 await call({action:'submit',expected:null,command:{type:'createInspiration',data:{title:'让 AI 对话成为复习入口',content:'每条重要结论链接到原会话；先自己复述，再看 AI 的解释。'}}});
 await call({action:'setValue',key:'learning-archive',value:demoArchive});
 await call({action:'setValue',key:'learning-reports',value:demoReports});
 await call({action:'setValue',key:'model-public',value:{kind:'ollama',baseUrl:'http://127.0.0.1:11434',model:'qwen3:8b',models:['qwen3:8b','deepseek-r1:8b'],apiKey:'',autoOrganize:false}});
}
if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(import.meta.filename)){
 const root=path.resolve('output/public-demo/profile');if(await access(path.join(root,'workspace.db')).then(()=>true,()=>false))throw Error('Synthetic profile already exists; choose a fresh isolated directory rather than overwrite it.');await mkdir(root,{recursive:true});
 const driver=spawn(path.resolve(`target/debug/workspace-driver${process.platform==='win32'?'.exe':''}`),[path.join(root,'workspace.db')],{stdio:['pipe','pipe','inherit'],windowsHide:true});
 const jobs=[];createInterface({input:driver.stdout}).on('line',line=>{const job=jobs.shift(),r=JSON.parse(line);r.error?job.reject(Error(r.error)):job.resolve(r.value);});
 await seed(value=>new Promise((resolve,reject)=>{jobs.push({resolve,reject});driver.stdin.write(JSON.stringify(value)+'\n');}));driver.stdin.end();await once(driver,'exit');
 await writeFile('output/public-demo/fixture.json',JSON.stringify({dataDir:root,synthetic:true,date:demoDate},null,2));console.log('Synthetic documentation profile prepared; no user profile read.');
}

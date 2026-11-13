async (page)=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  let cb=0;const callbacks={};
  window.__TAURI_INTERNALS__={metadata:{currentWindow:{label:'main'},currentWebview:{label:'main'}},transformCallback:(fn)=>{callbacks[++cb]=fn;return cb},unregisterCallback:id=>delete callbacks[id],convertFileSrc:p=>p,invoke:async(command,args)=>{
   if(command.startsWith('plugin:event|'))return command.endsWith('listen')?++cb:null;
   if(command.startsWith('plugin:window|')||command.startsWith('plugin:webview|'))return null;
   if(command==='plugin:app|version')return '0.3.0';
   const reply=await fetch('/invoke',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({command,args})}).then(r=>r.json());if(reply.error)throw Error(reply.error);return reply.value;
  }};window.__TAURI_EVENT_PLUGIN_INTERNALS__={unregisterListener:()=>{}};
 });
 await page.setViewportSize({width:1440,height:940});await page.goto('http://127.0.0.1:1421');
 const results=[];const check=(ok,label)=>{if(!ok)throw Error(label);results.push(label)};
 const invoke=(command,args={})=>page.evaluate(({command,args})=>window.__TAURI_INTERNALS__.invoke(command,args),{command,args});
 await page.getByRole('button',{name:'记忆看板',exact:true}).click();await page.getByRole('heading',{name:'记忆看板',exact:true}).waitFor();
 check((await invoke('workspace_view')).local,'default authority is local, no sync configuration');
 check(await page.locator('.sbar').count()===1,'one Dingmi navigation shell');
 check(await page.locator('.xiaoyu-panel').isVisible(),'AI sits inside the same main page');
 const filename='conversations.json';const fixture=[{title:'测试学习：间隔复习',create_time:(Date.now()-4*86400000)/1000,current_node:'answer',mapping:{question:{parent:null,message:{author:{role:'user'},content:{parts:['我怎样记住学过的知识？']}}},answer:{parent:'question',message:{author:{role:'assistant'},content:{parts:['使用主动回忆，在第1、3、7天复习。']}}},discarded:{parent:'question',message:{author:{role:'assistant'},content:{parts:['这是一条不应导入的旧分支']}}}}}];
 await page.locator('[data-fusion=archive]').click();
 await page.locator('input[type=file][accept=".json,.md,.txt,.markdown"]').setInputFiles({name:filename,mimeType:'application/json',buffer:Buffer.from(JSON.stringify(fixture))});
 await page.getByRole('status').filter({hasText:'已导入 1 个会话'}).waitFor();
 let a=await invoke('workspace_archive_load');check(a.sessions.length===1&&a.sessions[0].messages.length===2,'ChatGPT import stores active branch in Rust SQLite archive');
 await page.locator('input[type=file][accept=".json,.md,.txt,.markdown"]').setInputFiles({name:filename,mimeType:'application/json',buffer:Buffer.from(JSON.stringify(fixture))});
 await page.getByRole('status').filter({hasText:'重复 1 个'}).waitFor();check((await invoke('workspace_archive_load')).sessions.length===1,'repeat import is deduplicated');
 await page.getByLabel('标记重要：测试学习：间隔复习').click();await page.getByText('★ 重要',{exact:true}).waitFor();
 await page.locator('[data-fusion=review]').click();await page.getByRole('heading',{name:'学习回顾',exact:true}).waitFor();
 await page.getByRole('button',{name:'回到原会话',exact:true}).click();await page.getByText('使用主动回忆，在第1、3、7天复习。',{exact:true}).waitFor();check(await page.getByText('这是一条不应导入的旧分支',{exact:true}).count()===0,'review links to original branch');
 await page.getByRole('button',{name:'返回列表',exact:true}).click();await page.getByRole('button',{name:'已回顾',exact:true}).click();await page.getByText('今天暂时没有到期内容。',{exact:false}).waitFor();
 check(!!(await invoke('workspace_archive_load')).review.completed[a.sessions[0].id],'review acknowledgment is durable');
 await page.locator('[data-fusion=inspirations]').click();await page.getByLabel('灵感内容').fill('把每次 AI 讨论变成可回顾的学习材料');await page.getByRole('button',{name:'保存灵感',exact:true}).click();await page.locator('.fusion-card').getByText('把每次 AI 讨论变成可回顾的学习材料',{exact:true}).first().waitFor();check((await invoke('workspace_view')).snapshot.data.inspirations.length===1,'inspiration saves through real Rust local authority');
 const heading=await page.locator('#main .pg:not([hidden]) h2').first().textContent();await page.locator('[data-fusion=im]').click();await page.locator('.fusion-im-dock').waitFor();check(await page.locator('.fusion-im-dock').isVisible(),'WeChat opens as side conversation');check(await page.locator('#main .pg:not([hidden]) h2').first().textContent()===heading,'IM preserves middle panel');
 await page.getByRole('button',{name:'贾维斯 AI',exact:true}).click();
 await invoke('workspace_save_model',{config:{kind:'ollama',baseUrl:'http://127.0.0.1:1',model:'fixture-local-model',models:[],apiKey:'',autoOrganize:false}});
 await page.reload();await page.getByLabel('贾维斯消息',{exact:true}).fill('解释主动回忆');await page.getByRole('button',{name:'发送贾维斯消息',exact:true}).click();await page.getByText('学习要点：主动回忆与间隔复习。建议明天回顾今天的概念，并用自己的例子解释。',{exact:true}).waitFor();
 check((await invoke('workspace_archive_load')).sessions.some(s=>s.source==='贾维斯'&&s.messages.length===2),'AI user message and answer are persisted');
 await page.reload();await page.getByText('学习要点：主动回忆与间隔复习。建议明天回顾今天的概念，并用自己的例子解释。',{exact:true}).waitFor();check((await invoke('fixture_counts')).aiCalls===1,'reload restores conversation without repeating model call');
 await page.locator('[data-fusion=memory]').click();await page.screenshot({path:'output/playwright/fusion-memory-light.png'});
 await page.locator('[data-fusion=archive]').click();await page.screenshot({path:'output/playwright/fusion-archive-light.png'});
 await page.evaluate(()=>document.documentElement.dataset.mode='dark');await page.screenshot({path:'output/playwright/fusion-archive-dark.png'});
 check(errors.length===0,'no browser page errors');return {passed:results,errors,realModelCalls:0,productionWrites:0};
}

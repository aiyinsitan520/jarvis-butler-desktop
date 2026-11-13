// Run through Playwright CLI against JARVIS_PUBLIC_DEMO=1 fixture only.
async(page)=>{
 const errors=[],shots=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{let id=0;window.__TAURI_INTERNALS__={metadata:{currentWindow:{label:'main'},currentWebview:{label:'main'}},transformCallback:()=>++id,unregisterCallback:()=>{},convertFileSrc:p=>p,invoke:async(command,args)=>{if(command.startsWith('plugin:event|'))return command.endsWith('listen')?++id:null;if(command.startsWith('plugin:window|')||command.startsWith('plugin:webview|'))return null;if(command==='plugin:app|version')return '0.4.1';const r=await fetch('/invoke',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({command,args})}).then(r=>r.json());if(r.error)throw Error(r.error);return r.value;}};window.__TAURI_EVENT_PLUGIN_INTERNALS__={unregisterListener:()=>{}};});
 await page.setViewportSize({width:1440,height:960});await page.goto('http://127.0.0.1:1421');
 async function shot(name){if(name!=='wechat-setup')await page.evaluate(()=>document.querySelectorAll('*').forEach(e=>{if(e.scrollHeight>e.clientHeight&&e.clientHeight>0)e.scrollTop=0}));await page.waitForTimeout(180);await page.screenshot({path:`docs/screenshots/${name}.png`});shots.push(name);}
 await page.locator('[data-fusion=memory]').click();await page.getByText('主动回忆：把“看懂”变成“能复述”',{exact:true}).first().waitFor();await shot('memory-light');
 await page.evaluate(()=>document.documentElement.dataset.mode='dark');await shot('memory-dark');await page.evaluate(()=>document.documentElement.dataset.mode='light');
 await page.locator('[data-fusion=archive]').click();await page.getByRole('searchbox').count();await shot('conversation-archive');
 await page.getByRole('button',{name:'主动回忆：把“看懂”变成“能复述”',exact:true}).click();await page.getByText('我看完了线性代数的视频，第二天却说不清特征向量是什么。应该怎么复习？',{exact:true}).waitFor();await shot('conversation-original');
 await page.locator('[data-fusion=review]').click();await page.getByRole('heading',{name:'每日学习成果'}).waitFor();await page.locator('details.fusion-card').first().locator('summary').click();await shot('learning-review');
 await page.locator('[data-fusion=settings]').click();await page.getByRole('heading',{name:'AI 模型',exact:true}).waitFor();await page.getByRole('button',{name:'刷新模型列表',exact:true}).click();await page.getByRole('button',{name:'设为默认模型 qwen3:8b',exact:true}).waitFor();await page.locator('.jarvis-settings').evaluate(e=>e.scrollIntoView({block:'start'}));await shot('model-picker');
 await page.getByRole('heading',{name:'微信 IM 接入',exact:true}).evaluate(e=>e.closest('section').scrollIntoView({block:'start'}));await shot('wechat-setup');
 await page.locator('[data-fusion=local]').click();await page.getByRole('heading',{name:'资料文件夹',exact:true}).waitFor();await shot('local-library');
 await page.locator('[data-fusion=sync]').click();await page.getByRole('heading',{name:'数据同步',exact:true}).first().waitFor();await shot('data-sync');
 await page.goto('http://127.0.0.1:1421/flash.html');await page.waitForTimeout(300);await page.locator('#inp').fill('笔记 明天用自己的话解释特征向量');await page.waitForTimeout(200);await page.locator('#card').screenshot({path:'docs/screenshots/quick-capture.png'});shots.push('quick-capture');
 if(errors.length)throw Error(errors.join('\n'));return {screenshots:shots.length,shots,errors,source:'Built 0.4.1 frontend, real Rust SQLite bridge, synthetic public demo data; native dialogs and model/network responses are fixtures.'};
}

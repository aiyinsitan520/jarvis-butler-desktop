async (page)=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  let cb=0;window.__TAURI_INTERNALS__={metadata:{currentWindow:{label:'main'},currentWebview:{label:'main'}},transformCallback:()=>++cb,unregisterCallback:()=>{},convertFileSrc:p=>p,invoke:async(command,args)=>{
   if(command.startsWith('plugin:event|'))return command.endsWith('listen')?++cb:null;
   if(command.startsWith('plugin:window|')||command.startsWith('plugin:webview|'))return null;
   if(command==='plugin:app|version')return '0.3.0';
   const r=await fetch('/invoke',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({command,args})}).then(r=>r.json());if(r.error)throw Error(r.error);return r.value;
  }};window.__TAURI_EVENT_PLUGIN_INTERNALS__={unregisterListener:()=>{}};
 });
 const results=[];function check(v,label){if(!v)throw Error(label);results.push(label)}
 await page.setViewportSize({width:1300,height:940});await page.goto('about:blank');await page.goto('http://127.0.0.1:1421/index.html#/sync');
 const section=page.getByRole('region',{name:'数据同步'});await section.waitFor();
 check(await page.locator('[data-fusion=sync]').count()===1&&await page.locator('[data-fusion=settings]').count()===1,'sidebar has separate data-sync and AI settings entries');
 check(await page.getByRole('heading',{name:'AI 模型',exact:true}).count()===0,'sync page excludes AI configuration');
 await page.locator('[data-fusion=settings]').click();await page.getByRole('heading',{name:'AI 模型',exact:true}).waitFor();
 check(await page.getByRole('region',{name:'数据同步'}).count()===0&&await page.getByRole('heading',{name:'待同步与草稿',exact:true}).count()===0,'AI page excludes sync controls and drafts');
 await page.reload();await page.getByRole('heading',{name:'AI 模型',exact:true}).waitFor();check(page.url().endsWith('#/settings'),'AI route survives reload independently');
 await page.screenshot({path:'output/playwright/settings-ai-separated.png'});
 await page.locator('[data-fusion=sync]').click();await section.waitFor();await page.getByRole('heading',{name:'待同步与草稿',exact:true}).waitFor();check(page.url().endsWith('#/sync'),'sync drafts live on the independent sync route');
 await page.goBack();await page.getByRole('heading',{name:'AI 模型',exact:true}).waitFor();await page.goForward();await section.waitFor();check(true,'back and forward restore the correct settings page');

 for(const label of ['自建服务器','云端网盘','iCloud Drive'])await section.getByRole('tab',{name:label,exact:true}).waitFor();check(true,'three sync entry tabs are visible');
 for(const label of ['云端网盘','iCloud Drive']){await section.getByRole('tab',{name:label,exact:true}).click();await section.getByText(/双向文件同步尚未接通/).waitFor();check(await section.getByRole('button',{name:'文件夹同步开发中'}).isDisabled(),label+' accurately marks pending implementation');}
 await section.getByRole('tab',{name:'自建服务器',exact:true}).click();
 const invoke=(command,args={})=>page.evaluate(({command,args})=>window.__TAURI_INTERNALS__.invoke(command,args),{command,args});
 const server=await invoke('fixture_sync_info');await page.waitForFunction(base=>document.querySelector('input[aria-label="同步服务器地址"]')?.value===base,server.baseUrl);
 check((await section.getByLabel('同步服务器地址',{exact:true}).inputValue())===server.baseUrl&&(await section.getByLabel('同步设备令牌',{exact:true}).inputValue())==='','prepared server fills address without exposing saved token');
 await section.getByLabel('同步服务器地址',{exact:true}).fill(server.baseUrl);await section.getByLabel('同步设备令牌',{exact:true}).fill('invalid-token');
 await section.getByRole('button',{name:'检查连接并预览',exact:true}).click();await section.getByRole('alert').filter({hasText:/令牌/}).waitFor();check(true,'bad credentials show error instead of connected state');
 await section.getByLabel('同步设备令牌',{exact:true}).fill('');await section.getByRole('button',{name:'检查连接并预览',exact:true}).click();
 await section.getByRole('heading',{name:'首次同步预览',exact:true}).waitFor();
 const connect=section.getByRole('button',{name:'确认合并并启用同步',exact:true});check(await connect.isDisabled(),'merge requires explicit scope confirmation');
 check((await invoke('fixture_sync_info')).todoCount===1,'preflight did not upload synthetic local todo');
 await section.getByLabel('同步服务器地址',{exact:true}).fill(server.baseUrl+'/');check(await section.getByRole('heading',{name:'首次同步预览',exact:true}).count()===0,'changing server address invalidates previous preview');
 await section.getByRole('button',{name:'检查连接并预览',exact:true}).click();await section.getByRole('heading',{name:'首次同步预览',exact:true}).waitFor();
 await page.screenshot({path:'output/playwright/server-sync-preview.png'});
 await section.getByLabel('确认同步范围',{exact:true}).check();check(await connect.isEnabled(),'scope checkbox enables the confirmed merge');await connect.click();
 await section.getByText('服务器已连接，资料已核对并保存',{exact:true}).waitFor();check((await invoke('fixture_sync_info')).todoCount===2,'confirmation performs real Rust import into isolated Jarvis server');
 check((await section.getByLabel('同步设备令牌',{exact:true}).inputValue())==='','device token input clears after successful connection');
 await section.getByRole('button',{name:'立即同步',exact:true}).click();await section.getByText('已从服务器刷新资料',{exact:true}).waitFor();check(true,'manual sync works after connection');
 await page.reload();await section.getByText(/当前服务器：/).waitFor();check(await section.getByRole('button',{name:'立即同步',exact:true}).count()===1,'server mode survives settings page reload');
 await page.screenshot({path:'output/playwright/server-sync-connected.png'});check(errors.length===0,'no page errors');return {passed:results,errors,productionWrites:0,realModelCalls:0};
}

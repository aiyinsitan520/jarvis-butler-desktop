async(page)=>{
 const checks=[],errors=[];page.on('pageerror',e=>errors.push(e.message));
 const check=(ok,label)=>{if(!ok)throw Error(label);checks.push(label)};
 await page.addInitScript(()=>{
  let id=0;const preview=new URL(location.href).searchParams.has('preview');
  window.previewUpdateFixture={installs:0,downloads:0,urls:[],status:{current:'0.4.6',state:'ready',version:'0.4.7',notes:'synthetic update',checking:false,date:'2026-11-14',size:10,got:10,error:null,checked_at:'2026-11-14',channel:'preview',auto_check:true,can_install:!preview,disabled:false,dismissed:false,too_old:false}};
  window.__TAURI_INTERNALS__={metadata:{currentWindow:{label:'main'},currentWebview:{label:'main'}},transformCallback:()=>++id,unregisterCallback:()=>{},invoke:async(command,args={})=>{
   const f=window.previewUpdateFixture;
   if(command==='plugin:app|version')return '0.4.6';
   if(command.startsWith('plugin:'))return command==='plugin:event|listen'?++id:null;
   if(command==='update_status'||command==='update_check')return f.status;
   if(command==='update_install'){f.installs++;return null;}
   if(command==='update_download'){f.downloads++;return null;}
   if(command==='open_url'){f.urls.push(args.url);return null;}
   if(command==='update_history')return [];
   const r=await fetch('/invoke',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({command,args})}).then(r=>r.json());if(r.error)throw Error(r.error);return r.value;
  }};window.__TAURI_EVENT_PLUGIN_INTERNALS__={unregisterListener:()=>{}};
 });
 await page.setViewportSize({width:1440,height:1000});await page.goto('http://127.0.0.1:1421/?preview=1');
 const banner=page.locator('#banner');await banner.getByRole('button',{name:'查看更新说明',exact:true}).waitFor();
 check((await banner.innerText()).includes('不能通过安装包更新'),'preview banner explains inability to install');
 check(await page.getByRole('button',{name:'重启更新',exact:true}).count()===0,'preview banner never offers restart install');
 await banner.getByRole('button',{name:'查看更新说明',exact:true}).click();await page.getByRole('heading',{name:'预览版更新说明'}).waitFor();
 check(await page.evaluate(()=>window.previewUpdateFixture.installs)===0,'preview banner opens explanation without native installation');await page.getByRole('button',{name:'关闭',exact:true}).click();
 await page.getByRole('button',{name:'设置',exact:true}).click();await page.locator('[data-sec=about]').click();
 check(await page.locator('#set').getByRole('button',{name:'检查软件更新与更新记录',exact:true}).isVisible(),'about page links to the software update page');await page.locator('[data-fusion=updates]').click();
 await page.getByRole('note').filter({hasText:'你正在使用开发预览'}).waitFor();
 check(await page.getByRole('button',{name:'确认安装并重启',exact:true}).count()===0,'software update page does not present an install action to preview');
 await page.screenshot({path:'output/preview-update-fix-20261114/preview-ready.png'});
 await page.locator('.jarvis-updates').getByRole('button',{name:'查看新版安装包',exact:true}).click();
 check(await page.evaluate(()=>window.previewUpdateFixture.urls.length)===1,'preview action opens release page');check(await page.evaluate(()=>window.previewUpdateFixture.installs)===0,'all preview actions make zero install requests');
 await page.goto('http://127.0.0.1:1421/');await banner.getByRole('button',{name:'重启更新',exact:true}).waitFor();
 check((await banner.innerText()).includes('重启一下就是新版'),'installed build retains restart action');
 await page.evaluate(()=>window.confirm=()=>false);await banner.getByRole('button',{name:'重启更新',exact:true}).click();check(await page.evaluate(()=>window.previewUpdateFixture.installs)===0,'installed build confirmation cancel never installs');
 await page.evaluate(()=>window.confirm=()=>true);await banner.getByRole('button',{name:'重启更新',exact:true}).click();await page.waitForFunction(()=>window.previewUpdateFixture.installs===1);checks.push('installed build explicit confirmation invokes install exactly once');
 check(errors.length===0,'no browser page exceptions');return {passed:checks.length,checks,errors,nativeInstall:'fixture only',productionWrites:0};
}

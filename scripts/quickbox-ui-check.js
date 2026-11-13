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
 await page.getByRole('button',{name:'打开快捷框',exact:true}).click();check((await invoke('fixture_counts')).openedWindows.includes('flash'),'main toolbar opens native quickbox');
 check((await page.locator('#quickbox-key').textContent()).includes('Alt'),'toolbar shows configured shortcut');
 await page.setViewportSize({width:688,height:720});await page.goto('http://127.0.0.1:1421/flash.html#open');
 const input=page.getByRole('combobox',{name:'快捷框',exact:true});await input.waitFor();await page.locator('.pin').nth(7).waitFor();
 check(await page.locator('.pin').count()===8,'empty input shows eight familiar apps in one row');
 const card=await page.locator('#card').boundingBox();check(card.width===640,'card keeps upstream 640px logical width');
 check(await page.locator('[role=status]').count()===1,'only original saved-result status remains; no extra workspace badge');
 await page.locator('.pin').nth(1).hover();await page.screenshot({path:'output/playwright/quickbox-matching.png'});
 await input.focus();await page.keyboard.press('ArrowRight');check(await page.locator('.pin[aria-selected=true]').count()===1,'arrow keys select pinned apps');
 await page.keyboard.press('ArrowLeft');await page.keyboard.press('Alt+2');check((await invoke('fixture_counts')).launches.at(-1).id==='fixture-app-1','Alt+number invokes matching app without executing real apps');
 await page.reload();await input.fill('微信');await page.getByRole('option').filter({hasText:'微信'}).first().waitFor();check((await page.locator('.r').first().textContent()).includes('微信'),'typing app name ranks the app first');
 await input.fill('wx');await page.getByRole('option').filter({hasText:'微信'}).first().waitFor();check((await page.locator('.r').first().textContent()).includes('微信'),'pinyin initials search works');
 await input.fill('10*12');await page.locator('.r').first().filter({hasText:'120'}).waitFor();check((await page.locator('.r').first().textContent()).includes('120'),'calculator result uses original first row');
 await input.fill('这是一条快捷记录的测试');await page.keyboard.press('Enter');await page.locator('#saved:not([hidden])').waitFor();check((await invoke('fixture_counts')).savedNotes.length===1,'Enter records a note through the native save envelope');
 await page.getByRole('button',{name:'撤销',exact:true}).click();check((await invoke('fixture_counts')).savedNotes.length===0,'saved result undo invokes note removal');
 await page.reload();await input.fill('?不存在的笔记');await page.getByText('没找到呀，换个说法试试？',{exact:true}).waitFor();check(true,'question-mark searches local notes and reminders');
 await input.fill('不应保存的临时输入');await page.keyboard.press('Escape');await page.locator('.stage.gone').waitFor();check((await invoke('fixture_counts')).savedNotes.length===0,'Escape dismisses without saving');
 check(errors.length===0,'no page errors');return {passed:results,errors,realAppLaunches:0};
}

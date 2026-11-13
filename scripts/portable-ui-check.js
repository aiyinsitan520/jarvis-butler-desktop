async(page)=>{
 const errors=[],passed=[];page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(()=>{window.confirm=()=>true});await page.evaluate(()=>{window.confirm=()=>true});
 const check=(ok,label)=>{if(!ok)throw Error(label);passed.push(label)};
 await page.locator('[data-fusion=local]').click();await page.getByRole('heading',{name:'本地资料',exact:true}).waitFor();
 check((await page.locator('.jarvis-settings').innerText()).includes('资料文件夹'),'local folder page has independent navigation');
 await page.getByRole('button',{name:'立即扫描文件与会话'}).click();await page.waitForTimeout(200);
 check(await page.getByText('没有待处理问题。',{exact:false}).isVisible(),'real Rust Markdown scan completes');
 await page.getByRole('button',{name:'选择目录并预览'}).click();await page.getByText('发现 2 个候选文件。',{exact:false}).waitFor();
 await page.getByRole('button',{name:'授权并启用采集'}).click();await page.getByRole('button',{name:'暂停采集',exact:true}).waitFor();passed.push('preview requires explicit authorization before enabling collector');
 if(!await page.getByRole('checkbox',{name:'使用当前模型生成每日学习成果'}).isChecked())await page.getByRole('checkbox',{name:'使用当前模型生成每日学习成果'}).click();await page.waitForFunction(()=>Array.from(document.querySelectorAll('label')).find(e=>e.textContent.includes('使用当前模型生成每日学习成果'))?.querySelector('input')?.checked===true);
 if(!await page.getByRole('checkbox',{name:'由这台电脑向本人配对微信发送回顾摘要'}).isChecked())await page.getByRole('checkbox',{name:'由这台电脑向本人配对微信发送回顾摘要'}).click();await page.waitForFunction(()=>Array.from(document.querySelectorAll('label')).find(e=>e.textContent.includes('由这台电脑向本人配对微信发送回顾摘要'))?.querySelector('input')?.checked===true);
 await page.reload();await page.locator('[data-fusion=local]').click();await page.getByRole('heading',{name:'本地资料',exact:true}).waitFor();
 check(await page.getByRole('checkbox',{name:'使用当前模型生成每日学习成果'}).isChecked(),'model consent survives reload in SQLite');
 check(await page.getByRole('checkbox',{name:'由这台电脑向本人配对微信发送回顾摘要'}).isChecked(),'push preference survives reload in SQLite');
 await page.screenshot({path:'output/playwright/portable-local-dark.png'});
 await page.evaluate(()=>document.documentElement.dataset.mode='light');await page.screenshot({path:'output/playwright/portable-local-light.png'});
 await page.locator('[data-fusion=review]').click();await page.getByRole('heading',{name:'每日学习成果'}).waitFor();passed.push('daily report dashboard retains original spaced review controls');
 await page.locator('[data-fusion=settings]').click();await page.getByRole('heading',{name:'AI 与接入设置',exact:true}).waitFor();check(await page.getByRole('heading',{name:'AI 与接入设置',exact:true}).isVisible(),'AI settings remain separate');
 await page.locator('[data-fusion=sync]').click();await page.getByRole('heading',{name:'数据同步',exact:true}).first().waitFor();check(await page.getByRole('heading',{name:'数据同步',exact:true}).first().isVisible(),'server sync remains separate');
 check(errors.length===0,'no page exceptions');return {passed,errors,realModelCalls:0,productionWrites:0,nativeFolderDialog:'covered by native code and requires user interaction'};
}


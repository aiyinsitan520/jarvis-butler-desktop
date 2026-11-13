async(page)=>{
 const results=[];
 for(const width of [1040,760]){
  await page.setViewportSize({width,height:780});
  const fits=await page.evaluate(()=>document.querySelector('.shell').scrollWidth<=document.querySelector('.shell').clientWidth+1);
  if(!fits)throw Error(`Main shell overflows at ${width}`);
  results.push(`main shell fits ${width}px`);
 }
 await page.getByRole('button',{name:'收起贾维斯助手',exact:true}).click();
 await page.locator('.xiaoyu-panel').waitFor({state:'hidden'});
 await page.getByRole('button',{name:'打开贾维斯助手',exact:true}).click();
 await page.locator('.xiaoyu-panel').waitFor({state:'visible'});
 results.push('side assistant collapses and reopens without another window');
 await page.setViewportSize({width:1440,height:940});
 return {passed:results};
}

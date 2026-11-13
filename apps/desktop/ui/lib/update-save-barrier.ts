// Wait for native note writes already requested before acknowledging update readiness.
const saves=new Set<Promise<unknown>>()
let lastError=false
export function trackNoteSave<T>(promise:Promise<T>):Promise<T>{saves.add(promise);void promise.then(()=>{lastError=false},()=>{lastError=true}).finally(()=>saves.delete(promise));return promise}
export async function flushNoteSaves(){while(saves.size)await Promise.allSettled([...saves]);if(lastError)throw new Error('有笔记保存失败，请先重新保存或导出草稿，再安装更新。')}

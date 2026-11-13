import {describe,it,expect,vi} from 'vitest'
describe('update waits for durable note saves',()=>{
 it('waits for pending save completion',async()=>{vi.resetModules();const {trackNoteSave,flushNoteSaves}=await import('./update-save-barrier');let resolve!:()=>void;trackNoteSave(new Promise<void>(r=>{resolve=r}));let ready=false;const waiting=flushNoteSaves().then(()=>ready=true);await Promise.resolve();expect(ready).toBe(false);resolve();await waiting;expect(ready).toBe(true)})
 it('blocks install when a save fails',async()=>{vi.resetModules();const {trackNoteSave,flushNoteSaves}=await import('./update-save-barrier');await trackNoteSave(Promise.reject(new Error('disk full'))).catch(()=>{});await expect(flushNoteSaves()).rejects.toThrow('保存失败')})
 it('allows retry after a successful resave',async()=>{vi.resetModules();const {trackNoteSave,flushNoteSaves}=await import('./update-save-barrier');await trackNoteSave(Promise.reject(new Error('offline'))).catch(()=>{});await trackNoteSave(Promise.resolve('durable draft'));await expect(flushNoteSaves()).resolves.toBeUndefined()})
})

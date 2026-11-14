import {describe,it,expect} from 'vitest'
import {canInstallUpdate,readyUpdateText} from './update-install-policy'
describe('native update install capability',()=>{
 it('requires explicit backend permission',()=>{expect(canInstallUpdate(undefined)).toBe(false);expect(canInstallUpdate(null)).toBe(false);expect(canInstallUpdate({})).toBe(false)})
 it('allows installed builds and blocks preview or disabled builds',()=>{expect(canInstallUpdate({can_install:true})).toBe(true);expect(canInstallUpdate({can_install:false})).toBe(false);expect(canInstallUpdate({can_install:true,disabled:true})).toBe(false)})
 it('never promises restart installation when preview only downloaded an artifact',()=>{expect(readyUpdateText('0.4.7',{can_install:false})).toContain('不能通过安装包更新');expect(readyUpdateText('0.4.7',{can_install:false})).not.toContain('重启一下就是新版');expect(readyUpdateText('0.4.7',{can_install:true})).toContain('重启一下就是新版')})
})

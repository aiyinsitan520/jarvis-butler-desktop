/** Install capability comes from the native backend, independently of download state. */
export type InstallCapability={can_install?:boolean;disabled?:boolean}
export function canInstallUpdate(status:InstallCapability|null|undefined):boolean {
  return status?.can_install===true&&status.disabled!==true
}
export function readyUpdateText(version:string,status:InstallCapability):string {
  return canInstallUpdate(status)?`新版本 ${version} 下载好了，重启一下就是新版`:`新版本 ${version} 已下载；当前预览不能通过安装包更新`
}
export const PREVIEW_UPDATE_HELP='你正在使用开发预览，支持检查、下载和校验，但不能用安装包覆盖此预览程序。请使用更新后的预览入口；如改用安装版，请先备份资料，再在安装版恢复。两者的资料目录独立。'

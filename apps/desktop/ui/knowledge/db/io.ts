import {sendCommand, storageState} from './store'
import {validateDump} from './validation'
export async function dumpAll() {
  const current = storageState().snapshot
  if (!current) throw new Error('磁盘服务未连接')
  return {...validateDump(current.data), exportedAt: new Date().toISOString()}
}
export async function importDump(input: unknown, resolution?: 'keep' | 'replace', migration = false) {
  const dump = validateDump(input, false)
  return sendCommand({type: 'import', dump, resolution, migration})
}
export async function clearAll() {await sendCommand({type: 'clear'})}
export async function downloadJson(filename = 'jarvis-butler-backup.json') {
  const blob = new Blob([JSON.stringify(await dumpAll(), null, 2)], {type: 'application/json'})
  const url = URL.createObjectURL(blob), a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

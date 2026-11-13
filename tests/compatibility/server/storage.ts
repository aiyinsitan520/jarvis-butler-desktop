import {createHash, randomUUID} from 'node:crypto'
import {copyFile, mkdir, open, readFile, rename, unlink, lstat, realpath} from 'node:fs/promises'
import path from 'node:path'
import {applyCommand} from '../src/db/domain.ts'
import type {Command} from '../src/db/domain.ts'
import {emptyDump} from '../src/db/schema.ts'
import type {DiskData, StorageSnapshot} from '../src/db/schema.ts'
import {object, StorageError, validateDump, validateModel} from '../src/db/validation.ts'
export const DATA_ROOT = '__PRODUCTION_DATA_NOT_AVAILABLE_IN_FIXTURE__'
const hash = (s: string) => createHash('sha256').update(s).digest('hex')
const serialize = (v: unknown) => JSON.stringify(v, null, 2) + '\n'
export function stable(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']'
  if (value && typeof value === 'object') return '{' + Object.keys(value as object).sort().filter(k => (value as Record<string, unknown>)[k] !== undefined).map(k => JSON.stringify(k) + ':' + stable((value as Record<string, unknown>)[k])).join(',') + '}'
  return JSON.stringify(value)
}
export function fingerprintOf(expected: {revision: number; hash: string}, command: Command): string {
  return hash(stable({expected, command}))
}
export interface StorageOptions {root: string; testMode?: boolean; runId?: string; journal?: boolean}
export interface JournalReceipt {requestId: string; fingerprint: string; baseRevision: number; baseHash: string; targetRevision: number; targetHash: string; result: string; status: 'prepared' | 'committed' | 'unresolved'; preparedAt: string; committedAt?: string}
export interface CommandOutcome {snapshot: StorageSnapshot; result: string; receipt?: JournalReceipt}
export async function createStorage(options: StorageOptions) {
  const root = path.resolve(options.root)
  if (options.testMode && (!options.runId || root === path.resolve(DATA_ROOT) || root.startsWith(path.resolve(DATA_ROOT) + path.sep))) throw new StorageError('测试存储不能使用正式目录')
  await mkdir(root, {recursive: true})
  const canonical = await realpath(root)
  if (options.testMode && (canonical.toLowerCase() === path.resolve(DATA_ROOT).toLowerCase() || canonical.toLowerCase().startsWith(path.resolve(DATA_ROOT).toLowerCase() + path.sep))) throw new StorageError('测试目录映射到了正式目录')
  const main = path.join(root, 'jarvis-butler-data.json')
  const lock = path.join(root, '.jarvis-storage.lock')
  const owner = serialize({pid: process.pid, token: randomUUID()})
  const safe = async (file: string, directory = false) => {
    try {const info = await lstat(file); if (info.isSymbolicLink() || (directory ? !info.isDirectory() : !info.isFile())) throw new StorageError('存储路径类型异常，拒绝跟随链接', 503)} catch (e) {if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e}
  }
  const managedDirectory = async (name: string) => {const dir = path.join(root, name); await safe(dir, true); await mkdir(dir, {recursive: true}); return dir}
  // 锁持有进程已退出时自动接管：Windows 上进程被强杀不会释放 wx 锁文件，
  // 残留锁会让之后每次重启都报"已被另一服务锁定"。读取 pid 并用 process.kill(pid, 0)
  // 探活（ESRCH=进程不存在；EPERM=存在但无权探测，仍视为活着）。只处理能确认已死亡的锁，
  // 活进程的锁照旧拒绝，不由本进程替用户做删除决定。
  const takeOverDeadLock = async (): Promise<boolean> => {
    let raw: string
    try {raw = await readFile(lock, 'utf8')} catch {return false}
    // Windows/PowerShell Out-File 写 UTF-8 会带上 BOM；readFile 'utf8' 不会自动剥掉，直接 JSON.parse 会抛 Unexpected token。
    if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1)
    let pid: unknown
    try {pid = JSON.parse(raw)?.pid} catch {return false}
    if (typeof pid !== 'number' || !Number.isInteger(pid) || pid <= 0 || pid > 0x7fffffff || pid === process.pid) return false
    try {process.kill(pid, 0)} catch (e) {
      // ESRCH = 进程不存在；ERR_INVALID_ARG_TYPE = PID 超出系统范围，同样不可能活着。
      if ((e as NodeJS.ErrnoException).code === 'ESRCH' || (e as NodeJS.ErrnoException).code === 'ERR_INVALID_ARG_TYPE') {
        try {await managedDirectory('backups'); await copyFile(lock, path.join(root, 'backups', `stale-lock-pid${pid}-${Date.now()}.json`))} catch {/* 备份失败不阻塞接管 */}
        await unlink(lock)
        return true
      }
      return false
    }
    return false
  }
  await safe(lock)
  let lockHandle
  try {lockHandle = await open(lock, 'wx', 0o600)} catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'EEXIST') {
      if (await takeOverDeadLock()) lockHandle = await open(lock, 'wx', 0o600)
      else throw new StorageError('数据目录已被另一服务锁定。请核实进程；不要直接删除锁文件。', 503)
    } else throw e
  }
  await lockHandle.writeFile(owner); await lockHandle.close()
  let closed = false, queue: Promise<unknown> = Promise.resolve()
  const exclusive = <T>(task: () => Promise<T>): Promise<T> => {
    const run = queue.then(() => {if (closed) throw new StorageError('存储服务已关闭', 503); return task()})
    queue = run.catch(() => {})
    return run
  }
  const close = async () => {
    await queue
    if (closed) return
    closed = true
    if (await readFile(lock, 'utf8').catch(() => '') === owner) await unlink(lock)
  }
  const atomic = async (file: string, content: string) => {
    await safe(file)
    const temp = `${file}.${randomUUID()}.tmp`
    try {
      const handle = await open(temp, 'wx', 0o600)
      try {await handle.writeFile(content, 'utf8'); await handle.sync()} finally {await handle.close()}
      await rename(temp, file)
    } finally {await unlink(temp).catch(e => {if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e})}
  }
  const snapshot = async (): Promise<StorageSnapshot> => {
    await safe(main)
    const raw = await readFile(main, 'utf8')
    let parsed: unknown
    try {parsed = JSON.parse(raw)} catch {throw new StorageError('主数据文件损坏，请保留文件并从备份恢复；未创建空库', 503)}
    const data = validateDump(parsed)
    if (!object(parsed) || !Number.isSafeInteger(parsed.revision) || (parsed.revision as number) < 0) throw new StorageError('磁盘数据版本无效', 503)
    return {data: {...data, revision: parsed.revision as number}, hash: hash(raw), path: main, savedAt: data.exportedAt, testMode: !!options.testMode, runId: options.runId ?? ''}
  }
  try {
    await safe(main)
    try {await snapshot()} catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e
      try {await lstat(path.join(root, '.jarvis-initialized')); throw new StorageError('主数据文件丢失；请恢复备份，不会重新创建空库', 503)} catch (markerError) {if ((markerError as NodeJS.ErrnoException).code !== 'ENOENT') throw markerError}
      const initial: DiskData = {...emptyDump(), revision: 0}
      const handle = await open(main, 'wx', 0o600)
      try {await handle.writeFile(serialize(initial)); await handle.sync()} finally {await handle.close()}
    }
    await safe(path.join(root, '.jarvis-initialized'))
    const marker = await open(path.join(root, '.jarvis-initialized'), 'a', 0o600); await marker.close()
  } catch (e) {await close(); throw e}
  const backup = async (content: string, label: string) => {
    const dir = await managedDirectory('backups')
    const target = path.join(dir, `${label}-${Date.now()}-${randomUUID()}.json`)
    const handle = await open(target, 'wx', 0o600)
    try {await handle.writeFile(content); await handle.sync()} finally {await handle.close()}
  }
  // 幂等日志：仅在 options.journal 时启用，垂直保存在受保护的 journal/ 目录。
  // 每次明确提交按 requestId 记一条 prepared 记录，落盘后才替换主文件，替换成功后再写 committed。
  const journalDir = path.join(root, 'journal')
  const receiptPath = (requestId: string) => path.join(journalDir, `${requestId}.json`)
  const readReceipt = async (requestId: string): Promise<JournalReceipt | null> => {
    await safe(receiptPath(requestId))
    const raw = await readFile(receiptPath(requestId), 'utf8').catch((e: NodeJS.ErrnoException) => {if (e.code === 'ENOENT') return null; throw e})
    if (raw === null) return null
    const parsed = JSON.parse(raw) as JournalReceipt
    if (!object(parsed) || typeof parsed.requestId !== 'string' || typeof parsed.fingerprint !== 'string' || typeof parsed.status !== 'string') throw new StorageError('请求回执损坏，拒绝继续写入', 503)
    return parsed
  }
  const writeReceipt = async (receipt: JournalReceipt) => {
    await managedDirectory('journal')
    await atomic(receiptPath(receipt.requestId), serialize(receipt))
  }
  // 对账：把 prepared 状态按主文件实际内容恢复到 committed 或 unresolved。
  const reconcile = async (receipt: JournalReceipt): Promise<JournalReceipt> => {
    if (receipt.status !== 'prepared') return receipt
    const raw = await readFile(main, 'utf8').catch(() => '')
    const current = raw ? hash(raw) : ''
    if (current === receipt.targetHash) {
      const done: JournalReceipt = {...receipt, status: 'committed', committedAt: new Date().toISOString()}
      await writeReceipt(done)
      return done
    }
    const unresolved: JournalReceipt = {...receipt, status: 'unresolved'}
    await writeReceipt(unresolved)
    return unresolved
  }
  return {
    snapshot: () => exclusive(snapshot), close,
    receipt: async (requestId: string, fingerprint: string) => {
      if (!options.journal) throw new StorageError('当前存储模式不支持请求回执', 404)
      const found = await readReceipt(requestId)
      if (!found) return null
      if (found.fingerprint !== fingerprint) throw new StorageError('同一请求编号的载荷不一致，拒绝执行', 409)
      return reconcile(found)
    },
    command: (expected: {revision: number; hash: string}, command: Command, requestId?: string) => exclusive(async (): Promise<CommandOutcome> => {
      const fingerprint = requestId ? fingerprintOf(expected, command) : ''
      if (requestId) {
        const found = await readReceipt(requestId)
        if (found) {
          if (found.fingerprint !== fingerprint) throw new StorageError('同一请求编号的载荷不一致，拒绝执行', 409)
          const settled = await reconcile(found)
          if (settled.status === 'committed') return {snapshot: await snapshot(), result: settled.result, receipt: settled}
          throw new StorageError('该请求已提交但结果未确认，请查询回执，不要重发', 409)
        }
      }
      const before = await snapshot()
      if (!expected || expected.revision !== before.data.revision || expected.hash !== before.hash) throw new StorageError('磁盘数据已变化，请刷新后检查并重试；输入未清空', 409)
      const {data, result} = applyCommand(before.data, command)
      if (command.type === 'import' && command.migration) await backup(serialize(validateDump(command.dump, false)), 'migration-source')
      const rawBefore = await readFile(main, 'utf8')
      if (hash(rawBefore) !== before.hash) throw new StorageError('文件被外部修改，请停止外部编辑后重新加载', 409)
      await backup(rawBefore, 'revision-' + before.data.revision)
      const rawAfter = serialize({...data, revision: before.data.revision + 1})
      const targetHash = hash(rawAfter)
      if (requestId) await writeReceipt({requestId, fingerprint, baseRevision: before.data.revision, baseHash: before.hash, targetRevision: before.data.revision + 1, targetHash, result, status: 'prepared', preparedAt: new Date().toISOString()})
      const lastCheck = await readFile(main, 'utf8')
      if (hash(lastCheck) !== before.hash) throw new StorageError('保存期间文件被外部修改，未覆盖', 409)
      await atomic(main, rawAfter)
      const committed = requestId ? {requestId, fingerprint, baseRevision: before.data.revision, baseHash: before.hash, targetRevision: before.data.revision + 1, targetHash, result, status: 'committed' as const, preparedAt: new Date().toISOString(), committedAt: new Date().toISOString()} : undefined
      if (committed) await writeReceipt(committed)
      return {snapshot: await snapshot(), result, receipt: committed}
    }),
    model: () => exclusive(async () => {
      const dir = await managedDirectory('.private'), file = path.join(dir, 'model-config.json')
      await safe(file)
      const raw = await readFile(file, 'utf8').catch(e => {if ((e as NodeJS.ErrnoException).code === 'ENOENT') return 'null'; throw e})
      return {config: validateModel(JSON.parse(raw)), hash: hash(raw)}
    }),
    saveModel: (input: unknown, expectedHash: string) => exclusive(async () => {
      const cfg = validateModel(input)
      const dir = await managedDirectory('.private'), file = path.join(dir, 'model-config.json')
      await safe(file)
      const before = await readFile(file, 'utf8').catch(e => {if ((e as NodeJS.ErrnoException).code === 'ENOENT') return 'null'; throw e})
      if (hash(before) !== expectedHash) throw new StorageError('模型配置已变化，请重新加载后保存', 409)
      const raw = serialize(cfg)
      await atomic(file, raw)
      return {config: cfg, hash: hash(raw)}
    }),
  }
}
export type FileStorage = Awaited<ReturnType<typeof createStorage>>

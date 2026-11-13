// jarvis sync server — 纯 Node http，不依赖 Vite。
// 监听 127.0.0.1:<port>，Bearer 令牌认证，幂等 requestId，journal 启用。
import {randomBytes, scryptSync, timingSafeEqual} from 'node:crypto'
import {createServer, type IncomingMessage, type ServerResponse} from 'node:http'
import {mkdir, open, readFile, lstat} from 'node:fs/promises'
import path from 'node:path'
import {createStorage, type FileStorage, type StorageOptions} from './storage.ts'
import type {Command} from '../src/db/domain.ts'
import {object, StorageError} from '../src/db/validation.ts'

const LIMIT = 25 * 1024 * 1024
const ALLOWED_ROUTES = new Set(['/api/sync/snapshot', '/api/sync/command', '/api/sync/receipt', '/api/sync/health'])

function env(name: string, required = true): string {
  const v = process.env[name]?.trim()
  if (!v && required) throw new Error(`缺少环境变量 ${name}`)
  return v ?? ''
}

function constantCompare(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8'), bb = Buffer.from(b, 'utf8')
  if (ab.length !== bb.length) return false
  return timingSafeEqual(ab, bb)
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  const size = req.headers['content-length']
  if (size !== undefined && Number(size) > LIMIT) throw new StorageError('请求超过25 MB限制', 413)
  let total = 0
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    total += chunk.length
    if (total > LIMIT) throw new StorageError('请求超过25 MB限制', 413)
    chunks.push(Buffer.from(chunk))
  }
  const raw = Buffer.concat(chunks).toString('utf8')
  if (!raw) throw new StorageError('请求体为空')
  try { return JSON.parse(raw) as unknown } catch { throw new StorageError('请求JSON无效') }
}

function send(res: ServerResponse, status: number, value: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.end(JSON.stringify(value))
}

interface DeviceEntry {deviceId: string; name: string; tokenHash: string; tokenSalt: string}

// 设备注册表：dataRoot/.auth/devices.json。每台设备一个独立高熵令牌，
// 服务端只存 scrypt 摘要，删掉一条即可单独吊销该设备。
async function loadDevices(root: string): Promise<DeviceEntry[]> {
  const file = path.join(root, '.auth', 'devices.json')
  try {
    await lstat(file)
    const parsed = JSON.parse(await readFile(file, 'utf8')) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((d): d is DeviceEntry =>
      object(d) && typeof d.deviceId === 'string' && typeof d.name === 'string' && typeof d.tokenHash === 'string' && typeof d.tokenSalt === 'string')
  } catch { return [] }
}

function matchDevice(devices: DeviceEntry[], token: string): DeviceEntry | null {
  for (const d of devices) {
    const derived = scryptSync(token, d.tokenSalt, 32).toString('hex')
    if (constantCompare(derived, d.tokenHash)) return d
  }
  return null
}

// 登记一台设备并签发令牌。仅在本地管理命令里调用，不暴露为 HTTP 路由。
export async function registerDevice(root: string, name: string): Promise<{deviceId: string; name: string; token: string}> {
  const authDir = path.join(root, '.auth')
  await mkdir(authDir, {recursive: true})
  const file = path.join(authDir, 'devices.json')
  const devices = await loadDevices(root)
  const token = randomBytes(32).toString('hex')
  const salt = randomBytes(16).toString('hex')
  const entry: DeviceEntry = {
    deviceId: randomBytes(8).toString('hex'),
    name,
    tokenSalt: salt,
    tokenHash: scryptSync(token, salt, 32).toString('hex'),
  }
  devices.push(entry)
  const handle = await open(file, 'w', 0o600)
  try { await handle.writeFile(JSON.stringify(devices, null, 2) + '\n'); await handle.sync() } finally { await handle.close() }
  return {deviceId: entry.deviceId, name: entry.name, token}
}

export interface SyncServerOptions {root: string; port: number; sharedToken?: string}
export async function createSyncServer(options: SyncServerOptions) {
  const storageOptions: StorageOptions = {root: options.root, journal: true, testMode: false}
  const store: FileStorage = await createSyncServerStorage(storageOptions)
  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    try {
      const urlPath = req.url?.split('?')[0] ?? ''
      // Host 必须指向回环地址。本机直连时是 127.0.0.1:<绑定端口>；
      // 经 SSH 隧道进来时 Host 是客户端侧的本地端口，所以只校验主机名是回环地址。
      const host = req.headers.host ?? ''
      const hostName = host.startsWith('[') ? host.slice(1, host.indexOf(']')) : host.split(':')[0]
      if (hostName !== '127.0.0.1' && hostName !== 'localhost' && hostName !== '::1') throw new StorageError('拒绝非本机请求', 403)
      if (!/^(\[[0-9a-fA-F:]+\]|[0-9a-zA-Z.-]+)(:\d{1,5})?$/.test(host)) throw new StorageError('Host 头格式非法', 403)
      if (!ALLOWED_ROUTES.has(urlPath)) throw new StorageError('接口不存在', 404)
      if (req.method !== 'GET' && req.method !== 'POST') throw new StorageError('请求方法不支持', 405)

      const authHeader = req.headers.authorization ?? ''
      const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
      if (!bearer) throw new StorageError('未授权', 401)
      let device: DeviceEntry | null = null
      if (options.sharedToken && constantCompare(bearer, options.sharedToken)) device = {deviceId: 'shared', name: 'shared', tokenHash: '', tokenSalt: ''}
      else device = matchDevice(await loadDevices(options.root), bearer)
      if (!device) throw new StorageError('未授权', 401)

      if (urlPath === '/api/sync/health' && req.method === 'GET') { send(res, 200, {ok: true, deviceId: device.deviceId}); return }
      if (urlPath === '/api/sync/snapshot' && req.method === 'GET') {
        // 不向客户端暴露服务端真实绝对路径，前端只显示“云端业务存储”。
        const {path: _p, ...snap} = await store.snapshot()
        send(res, 200, snap)
        return
      }
      if (urlPath === '/api/sync/command' && req.method === 'POST') {
        const body = await readBody(req)
        if (!object(body) || !object(body.expected) || !object(body.command) || typeof body.requestId !== 'string') throw new StorageError('存储命令缺少 requestId 或载荷无效')
        // requestId 会用于 journal 文件名，必须与回执路由同样严格校验，避免路径穿越。
        if (!/^[a-zA-Z0-9_-]{16,128}$/.test(body.requestId)) throw new StorageError('请求编号非法')
        const outcome = await store.command(
          {revision: body.expected.revision as number, hash: body.expected.hash as string},
          body.command as unknown as Command,
          body.requestId,
        )
        send(res, 200, outcome)
        return
      }
      if (urlPath === '/api/sync/receipt' && req.method === 'GET') {
        const q = new URL(req.url ?? '', 'http://127.0.0.1').searchParams
        const requestId = q.get('id') ?? ''
        const fingerprint = q.get('fingerprint') ?? ''
        if (!/^[a-zA-Z0-9_-]{16,128}$/.test(requestId)) throw new StorageError('请求编号非法')
        const receipt = await store.receipt(requestId, fingerprint)
        if (!receipt) { send(res, 404, {error: '未找到该请求的回执'}); return }
        send(res, 200, receipt)
        return
      }
      throw new StorageError('请求方法不支持', 405)
    } catch (e) {
      const status = e instanceof StorageError ? e.status : 503
      if (!res.headersSent) send(res, status, {error: e instanceof Error ? e.message : String(e)})
      else res.end()
    }
  })
  return {server, store}
}

// 直接执行时启动默认实例。测试请改用 createSyncServer。
async function createSyncServerStorage(options: StorageOptions): Promise<FileStorage> {
  return createStorage(options)
}

async function main() {
  const root = env('JARVIS_SYNC_ROOT')
  const port = Number(env('JARVIS_SYNC_PORT', false) || '8787')
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('JARVIS_SYNC_PORT 无效')
  if (port === 5273) throw new Error('禁止占用本地开发端口 5273')
  const sharedToken = env('JARVIS_SYNC_TOKEN', false)
  const {server} = await createSyncServer({root, port, sharedToken})
  server.listen(port, '127.0.0.1', () => console.log(`jarvis-sync listening on 127.0.0.1:${port} root=${root}`))
  const shut = () => { server.close(); process.exit(0) }
  process.on('SIGINT', shut)
  process.on('SIGTERM', shut)
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  main().catch(err => { console.error(err); process.exit(1) })
}

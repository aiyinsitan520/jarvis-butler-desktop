// Obsidian 记忆仓库的前端客户端。不进业务六表，不走 sendCommand；
// 只读、独立、带会话内内存缓存 + 自动 30 秒刷新。
import {useEffect, useSyncExternalStore} from 'react'

export interface ObsidianNoteBrief {
  path: string
  title: string
  displayTitle?: string
  folder: string
  frontmatter: Record<string, string | string[]>
  excerpt: string
  tags: string[]
  links: string[]
  modified: number
  size: number
}

export interface ObsidianNoteDetail {
  path: string
  title: string
  content: string
  modified: number
}

export interface ObsidianBrowse {
  vaultName: string
  scannedAt: string
  notes: ObsidianNoteBrief[]
  folders: {name: string; count: number}[]
  tags: {name: string; count: number}[]
  total: number
  withContent: number
  linked: number
  recent: number
}

interface MemoryState {
  browse: ObsidianBrowse | null
  notes: Record<string, ObsidianNoteDetail>
  loading: boolean
  error: string | null
  lastFetch: number
}

let state: MemoryState = {browse: null, notes: {}, loading: false, error: null, lastFetch: 0}
const listeners = new Set<() => void>()
function update(patch: Partial<MemoryState>) {state = {...state, ...patch}; listeners.forEach(fn => fn())}

export function useObsidian() {
  return useSyncExternalStore(
    fn => {listeners.add(fn); return () => {listeners.delete(fn)}},
    () => state,
  )
}

async function fetchMemory<T>(query: string): Promise<T> {
  const q = new URLSearchParams(query)
  const {invoke} = await import('@tauri-apps/api/core')
  if (q.get('action') === 'read') return invoke<T>('workspace_memory_read', {path:q.get('path') ?? ''})
  return invoke<T>('workspace_memory_index', {refresh:q.get('refresh') === '1'})
}

let browsePending: Promise<ObsidianBrowse> | undefined
/** 拉取索引；refresh=1 强制重扫 vault */
export function loadMemoryIndex(refresh = false): Promise<ObsidianBrowse> {
  if (!refresh && browsePending) return browsePending
  browsePending = fetchMemory<ObsidianBrowse>(refresh ? 'refresh=1' : '')
    .then(browse => {
      update({browse, loading: false, error: null, lastFetch: Date.now()})
      return browse
    })
    .catch(e => {
      update({loading: false, error: e instanceof Error ? e.message : String(e)})
      throw e
    })
    .finally(() => { browsePending = undefined })
  update({loading: true})
  return browsePending
}

const notePending = new Map<string, Promise<ObsidianNoteDetail>>()
export function loadMemoryNote(relativePath: string): Promise<ObsidianNoteDetail> {
  const existing = notePending.get(relativePath)
  if (existing) return existing
  const encoded = encodeURIComponent(relativePath)
  const pending = fetchMemory<ObsidianNoteDetail>(`action=read&path=${encoded}`)
    .then(note => {
      update({notes: {...state.notes, [relativePath]: note}, error: null})
      return note
    })
    .catch(e => {
      update({error: e instanceof Error ? e.message : String(e)})
      throw e
    })
    .finally(() => { notePending.delete(relativePath) })
  notePending.set(relativePath, pending)
  return pending
}

/** 30 秒静默自动刷新索引（仅页面可见时） */
export function useMemoryAutoRefresh(enabled = true) {
  useEffect(() => {
    if (!enabled) return
    loadMemoryIndex().catch(() => {})
    const timer = window.setInterval(() => {
      if (!document.hidden) loadMemoryIndex().catch(() => {})
    }, 30_000)
    const onVisibility = () => { if (!document.hidden && Date.now() - state.lastFetch > 15_000) loadMemoryIndex().catch(() => {}) }
    document.addEventListener('visibilitychange', onVisibility)
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVisibility) }
  }, [enabled])
}

/** 找到双链指向的笔记（Obsidian 不区分大小写匹配文件名） */
export function resolveLink(browse: ObsidianBrowse | null | undefined, target: string): ObsidianNoteBrief | null {
  if (!browse || !target) return null
  // 先按完整相对路径精确匹配；再按文件名去掉 .md 匹配（允许带目录前缀）。
  const needle = target.toLowerCase().replace(/^.*?\//, '')
  const byPath = browse.notes.find(n => n.path.toLowerCase() === target.toLowerCase() || n.path.toLowerCase() === (target + '.md').toLowerCase())
  if (byPath) return byPath
  const byTitle = browse.notes.find(n => n.title.toLowerCase() === needle || n.title.toLowerCase() === target.toLowerCase())
  return byTitle ?? null
}

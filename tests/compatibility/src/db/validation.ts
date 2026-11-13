import {kindTables, tables} from './schema.ts'
import type {Dump, ModelConfig, TableName} from './schema.ts'
export class StorageError extends Error {
  status: number
  constructor(message: string, status = 400) {super(message); this.status = status}
}
export function object(value: unknown): value is Record<string, unknown> {return !!value && typeof value === 'object' && !Array.isArray(value)}
const text = (v: unknown): v is string => typeof v === 'string'
const strings = (v: unknown) => Array.isArray(v) && v.every(text)
const timestamp = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0
const oneOf = (v: unknown, all: readonly string[]) => text(v) && all.includes(v)
const fields: Record<TableName, string[]> = {
  notebooks: ['id','name','desc','tone','createdAt','updatedAt'], notes: ['id','notebookId','title','content','tags','createdAt','updatedAt'],
  sources: ['id','notebookId','title','type','url','content','metadata','createdAt'], todos: ['id','notebookId','title','done','priority','due','createdAt'],
  inspirations: ['id','title','content','tags','relatedNotes','createdAt'], relations: ['id','fromId','fromType','toId','toType','relationType','weight','createdAt'],
}
export function validateDump(input: unknown, references = true): Dump {
  if (!object(input) || input.version !== 1) throw new StorageError('不是受支持的 v1 六表数据')
  const result = {version: 1, exportedAt: typeof input.exportedAt === 'string' ? input.exportedAt : new Date().toISOString()} as Dump
  for (const table of tables) {
    const rows = input[table]
    if (!Array.isArray(rows)) throw new StorageError(`缺少 ${table} 数据表`)
    const ids = new Set<string>()
    const clean = rows.map((row: unknown) => {
      if (!object(row) || !text(row.id) || !row.id.trim() || ids.has(row.id) || !timestamp(row.createdAt)) throw new StorageError(`${table} 中存在无效或重复记录`)
      ids.add(row.id)
      if (Object.keys(row).some(k => !fields[table].includes(k))) throw new StorageError(`${table} 含有未知字段，不写入磁盘`)
      let valid = false
      switch (table) {
        case 'notebooks': valid = text(row.name) && !!row.name.trim() && text(row.desc) && oneOf(row.tone, ['blue','purple','teal','rose','amber']) && timestamp(row.updatedAt); break
        case 'notes': valid = text(row.notebookId) && text(row.title) && text(row.content) && strings(row.tags) && timestamp(row.updatedAt); break
        case 'sources': {
          valid = text(row.notebookId) && text(row.title) && oneOf(row.type, ['web','pdf','video','file','audio']) && (row.url === undefined || text(row.url)) && (row.content === undefined || text(row.content)) && (row.metadata === undefined || object(row.metadata))
          if (row.url) {try {if (!['http:','https:'].includes(new URL(String(row.url)).protocol)) valid = false} catch {valid = false}}
          break
        }
        case 'todos': valid = text(row.title) && !!row.title.trim() && typeof row.done === 'boolean' && oneOf(row.priority, ['high','normal','low']) && (row.notebookId === undefined || text(row.notebookId)) && (row.due === undefined || text(row.due)); break
        case 'inspirations': valid = text(row.title) && text(row.content) && !!row.content.trim() && strings(row.tags) && strings(row.relatedNotes); break
        case 'relations': valid = text(row.fromId) && text(row.toId) && oneOf(row.fromType, Object.keys(kindTables)) && oneOf(row.toType, Object.keys(kindTables)) && oneOf(row.relationType, ['mentions','derived_from','contradicts']) && typeof row.weight === 'number' && Number.isFinite(row.weight); break
      }
      if (!valid) throw new StorageError(`${table} 的记录 ${row.id} 字段无效，未写入数据`)
      return structuredClone(row)
    })
    Object.assign(result, {[table]: clean})
  }
  if (references) {
    const ids = Object.fromEntries(tables.map(t => [t, new Set(result[t].map(r => r.id))])) as Record<TableName, Set<string>>
    for (const row of [...result.notes, ...result.sources, ...result.todos]) if (row.notebookId !== undefined && !ids.notebooks.has(row.notebookId)) throw new StorageError('存在悬空笔记本引用')
    for (const row of result.inspirations) if (row.relatedNotes.some(id => !ids.notes.has(id))) throw new StorageError('灵感引用的笔记不存在')
    for (const row of result.relations) if (!ids[kindTables[row.fromType]].has(row.fromId) || !ids[kindTables[row.toType]].has(row.toId)) throw new StorageError('图谱包含不存在的节点引用')
  }
  return result
}
export function validateModel(input: unknown): ModelConfig | null {
  if (input === null) return null
  if (!object(input) || !oneOf(input.kind, ['ollama','openai','jumbo']) || !text(input.baseUrl) || !text(input.model) || !input.model.trim() || (input.apiKey !== undefined && !text(input.apiKey))) throw new StorageError('模型配置无效')
  let url: URL
  try {url = new URL(input.baseUrl)} catch {throw new StorageError('模型服务地址无效')}
  if (!['http:','https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new StorageError('模型地址须为无凭证与查询参数的 HTTP(S) 地址')
  let models: string[] | undefined
  if (input.models !== undefined) {
    if (input.kind !== 'jumbo' || !strings(input.models) || input.models.length > 200) throw new StorageError('模型列表无效')
    models = [...new Set(input.models.map(m => m.trim()).filter(Boolean))]
  }
  return {kind: input.kind as ModelConfig['kind'], baseUrl: input.baseUrl.trim(), model: input.model.trim(), ...(input.apiKey ? {apiKey: input.apiKey as string} : {}), ...(models && models.length ? {models} : {})}
}
export function conflicts(current: Dump, incoming: Dump) {
  return tables.flatMap(table => incoming[table].flatMap(row => {
    const old = current[table].find(item => item.id === row.id)
    return old && stable(old) !== stable(row) ? [`${table}:${row.id}`] : []
  }))
}
export function stable(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']'
  if (object(value)) return '{' + Object.keys(value).sort().filter(k => value[k] !== undefined).map(k => JSON.stringify(k) + ':' + stable(value[k])).join(',') + '}'
  return JSON.stringify(value)
}

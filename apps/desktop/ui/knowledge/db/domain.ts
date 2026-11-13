import {emptyDump, kindTables, tables} from './schema.ts'
import type {Dump, Inspiration, Notebook, Note, Relation, Source, TableName, Todo} from './schema.ts'
import {conflicts, object, StorageError, validateDump} from './validation.ts'
export interface Command {type: string; id?: string; table?: TableName; data?: Record<string, unknown>; dump?: unknown; resolution?: 'keep' | 'replace'; migration?: boolean}
const string = (data: Record<string, unknown>, key: string, fallback?: string) => {
  const value = data[key] ?? fallback
  if (typeof value !== 'string') throw new StorageError(`缺少有效的 ${key}`)
  return value
}
export function applyCommand(current: Dump, command: Command): {data: Dump; result: string} {
  if (!object(command) || typeof command.type !== 'string' || (command.data !== undefined && !object(command.data))) throw new StorageError('无效的存储命令')
  let next = structuredClone(current)
  const d = command.data ?? {}, now = Date.now()
  const uid = (prefix: string) => prefix + crypto.randomUUID()
  let result = command.id ?? ''
  const notebook = (id: string) => {const nb = next.notebooks.find(n => n.id === id); if (!nb) throw new StorageError('笔记本不存在'); return nb}
  const remove = (nodes: {id: string; kind: Relation['fromType']}[]) => {
    const keys = new Set(nodes.map(n => `${n.kind}:${n.id}`))
    const notes = new Set(nodes.filter(n => n.kind === 'note').map(n => n.id))
    next.relations = next.relations.filter(r => !keys.has(`${r.fromType}:${r.fromId}`) && !keys.has(`${r.toType}:${r.toId}`))
    next.inspirations.forEach(i => {i.relatedNotes = i.relatedNotes.filter(id => !notes.has(id))})
  }
  const createNote = (nbId: string, title: string, content: string) => {
    notebook(nbId).updatedAt = now
    const id = uid('n-')
    next.notes.push({id, notebookId: nbId, title: title.trim() || '未命名笔记', content, tags: [], createdAt: now, updatedAt: now})
    return id
  }
  switch (command.type) {
    case 'createNotebook':
      result = uid('nb-'); next.notebooks.push({id: result, name: string(d,'name').trim(), desc: string(d,'desc','').trim(), tone: (d.tone ?? 'blue') as Notebook['tone'], createdAt: now, updatedAt: now}); break
    case 'createNote': result = createNote(string(d,'notebookId'), string(d,'title'), string(d,'content','')); break
    case 'createSource':
      notebook(string(d,'notebookId'))
      result = uid('s-'); next.sources.push({id: result, notebookId: string(d,'notebookId'), title: string(d,'title').trim(), type: d.type as Source['type'], url: string(d,'url','').trim() || undefined, content: string(d,'content',''), createdAt: now}); break
    case 'createTodo':
      result = uid('t-'); next.todos.push({id: result, title: string(d,'title').trim(), done: false, priority: (d.priority ?? 'normal') as Todo['priority'], ...(d.notebookId === undefined ? {} : {notebookId: string(d,'notebookId')}), ...(d.due === undefined ? {} : {due: string(d,'due')}), createdAt: now}); break
    case 'createInspiration': {
      const content = string(d,'content').trim()
      result = uid('i-'); next.inspirations.push({id: result, title: string(d,'title',content.split('\n')[0]!.slice(0,24)).trim(), content, tags: [], relatedNotes: [], createdAt: now}); break
    }
    case 'update': {
      const table = command.table
      if (!table || !tables.includes(table)) throw new StorageError('无效的数据表')
      const row = next[table].find(n => n.id === command.id)
      if (!row) throw new StorageError('记录已不存在，未保存修改')
      if ('id' in d || 'createdAt' in d) throw new StorageError('不能修改记录标识或创建时间')
      Object.assign(row, d)
      if (table === 'notes' || table === 'notebooks') Object.assign(row, {updatedAt: now})
      if (table === 'notes') notebook((row as Note).notebookId).updatedAt = now
      break
    }
    case 'delete': {
      const kind = Object.keys(kindTables).find(k => kindTables[k as keyof typeof kindTables] === command.table) as Relation['fromType'] | undefined
      if (command.table === 'relations') {next.relations = next.relations.filter(r => r.id !== command.id); break}
      if (!kind || !command.id) throw new StorageError('无效的删除目标')
      const nodes: {id: string; kind: Relation['fromType']}[] = [{id: command.id, kind}]
      if (kind === 'notebook') {
        nodes.push(...next.notes.filter(n => n.notebookId === command.id).map(n => ({id: n.id, kind: 'note' as const})), ...next.sources.filter(n => n.notebookId === command.id).map(n => ({id: n.id, kind: 'source' as const})), ...next.todos.filter(n => n.notebookId === command.id).map(n => ({id: n.id, kind: 'todo' as const})))
        next.notes = next.notes.filter(n => n.notebookId !== command.id)
        next.sources = next.sources.filter(n => n.notebookId !== command.id)
        next.todos = next.todos.filter(n => n.notebookId !== command.id)
      }
      remove(nodes)
      Object.assign(next, {[command.table!]: next[command.table!].filter(n => n.id !== command.id)})
      break
    }
    case 'deriveSource': {
      const source = next.sources.find(s => s.id === command.id)
      if (!source) throw new StorageError('来源已被删除')
      result = createNote(source.notebookId, source.title, source.content || source.url || source.title)
      next.relations.push({id: uid('r-'), fromId: result, fromType: 'note', toId: source.id, toType: 'source', relationType: 'derived_from', weight: 1, createdAt: now}); break
    }
    case 'createRelation': {
      const relation = {...d, id: uid('r-'), createdAt: now, weight: 1} as unknown as Relation
      if (relation.fromId === relation.toId && relation.fromType === relation.toType) throw new StorageError('不能关联同一节点')
      if (next.relations.some(r => r.fromId === relation.fromId && r.fromType === relation.fromType && r.toId === relation.toId && r.toType === relation.toType && r.relationType === relation.relationType)) throw new StorageError('这条关联已经存在')
      next.relations.push(relation); result = relation.id; break
    }
    case 'import': {
      const incoming = validateDump(command.dump, false)
      if (conflicts(next, incoming).length && !['keep','replace'].includes(command.resolution ?? '')) throw new StorageError('导入存在同 id 内容冲突，请选择保留现有或使用导入记录', 409)
      for (const table of tables) {
        const merged = new Map(next[table].map(row => [row.id, row]))
        for (const row of incoming[table]) if (!merged.has(row.id) || command.resolution !== 'keep') merged.set(row.id, row)
        Object.assign(next, {[table]: [...merged.values()]})
      }
      break
    }
    case 'clear': next = emptyDump(); break
    default: throw new StorageError('不支持的存储操作')
  }
  next.exportedAt = new Date().toISOString()
  return {data: validateDump(next), result}
}
// 保持公开实体类型可由旧调用点逐步迁移，不引入浏览器数据库。
export type Editable = Notebook | Note | Source | Todo | Inspiration

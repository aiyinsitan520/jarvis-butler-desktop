import {useStorage, sendCommand} from './store'
import type {Inspiration, Notebook, Note, Source, Todo, Tone, TableName, Relation, Dump} from './schema'
export function useData(): Dump | undefined {return useStorage().snapshot?.data}
export function useNotebooks() {return useData()?.notebooks.slice().sort((a,b) => b.updatedAt - a.updatedAt)}
export function useNotebook(id: string | undefined) {const data = useData(); return data ? data.notebooks.find(n => n.id === id) ?? null : undefined}
export function useNotes(id: string | undefined) {return useData()?.notes.filter(n => n.notebookId === id).slice().sort((a,b) => b.updatedAt - a.updatedAt)}
export function useSources(id: string | undefined) {return useData()?.sources.filter(s => s.notebookId === id).slice().sort((a,b) => b.createdAt - a.createdAt)}
export function useTodos() {return useData()?.todos.slice().sort((a,b) => b.createdAt - a.createdAt)}
export function useInspirations() {return useData()?.inspirations.slice().sort((a,b) => b.createdAt - a.createdAt)}
export function useCount(select: (data: Dump) => number) {const data = useData(); return data ? select(data) : undefined}
export function uid(prefix = '') {return prefix + crypto.randomUUID()}
export const createNotebook = (data: {name: string; desc: string; tone?: Tone}) => sendCommand({type: 'createNotebook', data})
export const createNote = (data: {notebookId: string; title: string; content?: string}) => sendCommand({type: 'createNote', data})
export const createSource = (data: {notebookId: string; title: string; type: Source['type']; url?: string; content?: string}) => sendCommand({type: 'createSource', data})
export const createTodo = (data: {title: string; priority?: Todo['priority']; due?: string; notebookId?: string}) => sendCommand({type: 'createTodo', data})
export const createInspiration = (data: {title?: string; content: string}) => sendCommand({type: 'createInspiration', data})
export const updateRecord = (table: TableName, id: string, data: Partial<Notebook | Note | Source | Todo | Inspiration>) => sendCommand({type: 'update', table, id, data})
export const updateNote = (id: string, data: Partial<Omit<Note,'id'>>) => updateRecord('notes', id, data)
export const toggleTodo = (id: string, done: boolean) => updateRecord('todos', id, {done})
const remove = (table: TableName, id: string) => sendCommand({type: 'delete', table, id})
export const deleteNotebook = (id: string) => remove('notebooks', id)
export const deleteNote = (id: string) => remove('notes', id)
export const deleteSource = (id: string) => remove('sources', id)
export const deleteTodo = (id: string) => remove('todos', id)
export const deleteInspiration = (id: string) => remove('inspirations', id)
export const deleteRelation = (id: string) => remove('relations', id)
export const deriveSource = (id: string) => sendCommand({type: 'deriveSource', id})
export const createRelation = (data: Pick<Relation,'fromId'|'fromType'|'toId'|'toType'|'relationType'>) => sendCommand({type: 'createRelation', data})

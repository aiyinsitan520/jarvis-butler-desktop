export type Tone = 'blue' | 'teal' | 'amber' | 'rose' | 'purple'
export type SourceType = 'web' | 'pdf' | 'video' | 'file' | 'audio'
export type RelationType = 'mentions' | 'derived_from' | 'contradicts'
export interface Notebook {id: string; name: string; desc: string; tone: Tone; createdAt: number; updatedAt: number}
export interface Note {id: string; notebookId: string; title: string; content: string; tags: string[]; createdAt: number; updatedAt: number}
export interface Source {id: string; notebookId: string; title: string; type: SourceType; url?: string; content?: string; metadata?: Record<string, unknown>; createdAt: number}
export interface Todo {id: string; notebookId?: string; title: string; done: boolean; priority: 'high' | 'normal' | 'low'; due?: string; createdAt: number}
export interface Inspiration {id: string; title: string; content: string; tags: string[]; relatedNotes: string[]; createdAt: number}
export interface Relation {id: string; fromId: string; fromType: 'notebook' | 'source' | 'note' | 'todo' | 'inspiration'; toId: string; toType: Relation['fromType']; relationType: RelationType; weight: number; createdAt: number}
export const tables = ['notebooks', 'notes', 'sources', 'todos', 'inspirations', 'relations'] as const
export type TableName = typeof tables[number]
export interface Dump {version: 1; exportedAt: string; notebooks: Notebook[]; notes: Note[]; sources: Source[]; todos: Todo[]; inspirations: Inspiration[]; relations: Relation[]}
export interface DiskData extends Dump {revision: number}
export interface StorageSnapshot {data: DiskData; hash: string; path?: string; savedAt: string; testMode: boolean; runId: string; mode?: 'disk' | 'sync'}
export interface ModelConfig {kind: 'ollama' | 'openai' | 'jumbo'; baseUrl: string; apiKey?: string; model: string; models?: string[]}
export const kindTables = {notebook: 'notebooks', note: 'notes', source: 'sources', todo: 'todos', inspiration: 'inspirations'} as const
export function emptyDump(): Dump {return {version: 1, exportedAt: new Date().toISOString(), notebooks: [], notes: [], sources: [], todos: [], inspirations: [], relations: []}}

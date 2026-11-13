import {useMemo, useRef, useState} from 'react'
import {Check, Plus, Trash2} from 'lucide-react'
import {toast} from 'sonner'
import {Badge, Button, Card, Dialog, Field, Input, Select, Tabs} from '@/components/ui'
import type {Todo} from '@/db/schema'
import {createTodo, deleteTodo, toggleTodo, updateRecord, useTodos} from '@/db/hooks'
import {cn} from '@/lib/cn'

type Scope = 'all' | 'open' | 'done'

const priorityMeta = {
  high: {label: '高', tone: 'rose' as const},
  normal: {label: '普通', tone: 'blue' as const},
  low: {label: '低', tone: 'neutral' as const},
}

export function Todos() {
  const [scope, setScope] = useState<Scope>('open')
  const todos = useTodos()
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const savingRef = useRef(false)
  const [editing, setEditing] = useState<Todo | null>(null)

  const list = useMemo(() => {
    if (!todos) return []
    if (scope === 'open') return todos.filter((t) => !t.done)
    if (scope === 'done') return todos.filter((t) => t.done)
    return todos
  }, [todos, scope])

  async function handleAdd(e?: React.FormEvent) {
    e?.preventDefault()
    if (savingRef.current) return
    const title = draft.trim()
    if (!title) {
      setError('请先输入待办内容')
      inputRef.current?.focus()
      return
    }
    savingRef.current = true
    setSaving(true)
    setError('')
    try {
      await createTodo({title})
      setDraft('')
      setScope('open')
      toast.success('已添加待办')
    } catch (e) {
      setError(`保存失败，内容已保留：${e instanceof Error ? e.message : String(e)}`)
    } finally {
      savingRef.current = false
      setSaving(false)
      inputRef.current?.focus()
    }
  }

  async function handleToggle(id: string, done: boolean) {
    await toggleTodo(id, done)
  }

  async function handleDelete(id: string) {
    await deleteTodo(id)
    toast.success('已删除')
  }

  const openCount = todos?.filter((t) => !t.done).length ?? 0
  const doneCount = todos?.filter((t) => t.done).length ?? 0

  if (todos === undefined) return null

  return (
    <div className="mx-auto max-w-[880px] px-3 py-6 sm:px-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-semibold text-[var(--color-ink)]">待办</h1>
          <p className="mt-1 text-[12.5px] text-[var(--color-ink-soft)]">
            勾选 / 删除都会立即保存，刷新页面仍在。
          </p>
        </div>
        <Tabs
          value={scope}
          onChange={(v) => setScope(v as Scope)}
          items={[
            {value: 'open', label: '待处理', count: openCount},
            {value: 'done', label: '已完成', count: doneCount},
            {value: 'all', label: '全部', count: todos.length},
          ]}
        />
      </div>

      <Card className="mb-4 p-3">
        <form className="flex flex-col gap-2 sm:flex-row sm:items-end" onSubmit={handleAdd}>
          <label className="block min-w-0 flex-1" htmlFor="new-todo">
            <span className="mb-1.5 block text-[12px] text-[var(--color-ink-soft)]">待办内容</span>
            <Input
              id="new-todo"
              ref={inputRef}
              value={draft}
              onChange={(e) => {setDraft(e.target.value); setError('')}}
              onKeyDown={(e) => {if (e.key === 'Enter' && e.nativeEvent.isComposing) e.preventDefault()}}
              readOnly={saving}
              placeholder="输入待办内容，回车或点添加"
              className="min-w-0"
              aria-label="新增待办"
              aria-invalid={!!error}
              aria-describedby={error ? 'todo-save-error' : undefined}
            />
          </label>
          <Button type="submit" disabled={saving}>
            <Plus size={14} /> {saving ? '保存中…' : '添加'}
          </Button>
        </form>
        {error && <p id="todo-save-error" role="alert" className="mt-2 text-[12px] text-[var(--color-destructive)]">{error}</p>}
      </Card>

      {list.length === 0 ? (
        <Card className="py-14 text-center">
          <p className="text-[12.5px] text-[var(--color-ink-faint)]">
            {scope === 'done'
              ? '还没有完成任何待办'
              : scope === 'open'
                ? '当前没有待办，添加一条吧'
                : '还没有待办'}
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {list.map((t) => (
            <Card key={t.id} className="group flex items-start gap-3 px-4 py-3">
              <button
                onClick={() => handleToggle(t.id, !t.done)}
                aria-label={t.done ? `恢复：${t.title}` : `完成：${t.title}`}
                className={cn(
                  'mt-0.5 flex h-[18px] w-[18px] shrink-0 cursor-pointer items-center justify-center rounded-full border transition-colors',
                  t.done
                    ? 'romance-grad text-white'
                    : 'border-[var(--color-input)] hover:border-[var(--color-ocean)]',
                )}
              >
                <Check size={11} className={t.done ? '' : 'text-transparent'} />
              </button>
              <div className="min-w-0 flex-1">
                <div
                  className={cn(
                    'text-[13px]',
                    t.done && 'text-[var(--color-ink-soft)] line-through',
                  )}
                >
                  {t.title}
                </div>
                <button className="mt-1 text-[11px] text-[var(--color-ocean)]" onClick={() => setEditing({...t})}>编辑待办</button>
                <div className="mt-1 flex items-center gap-2 text-[11.5px] text-[var(--color-ink-faint)]">
                  {t.due && <span>{t.due}</span>}
                  <Badge tone={priorityMeta[t.priority].tone}>
                    {priorityMeta[t.priority].label}
                  </Badge>
                </div>
              </div>
              <button
                aria-label={`删除 ${t.title}`}
                onClick={() => handleDelete(t.id)}
                className="rounded-md p-1 text-[var(--color-ink-faint)] opacity-0 transition-opacity group-hover:opacity-100 hover:bg-[var(--color-muted)] hover:text-[var(--color-destructive)]"
              >
                <Trash2 size={13} />
              </button>
            </Card>
          ))}
        </div>
      )}
      <Dialog open={!!editing} onClose={() => setEditing(null)} title="编辑待办" footer={<Button onClick={async () => {
        if (!editing?.title.trim()) {toast.error('标题不能为空'); return}
        await updateRecord('todos', editing.id, {title: editing.title.trim(), priority: editing.priority, due: editing.due})
        setEditing(null); toast.success('待办已更新')
      }}>保存修改</Button>}>
        {editing && <div className="space-y-3"><Field label="标题"><Input value={editing.title} onChange={(e) => setEditing({...editing, title:e.target.value})}/></Field><Field label="优先级"><Select value={editing.priority} onChange={(e) => setEditing({...editing, priority:e.target.value as Todo['priority']})}>{Object.entries(priorityMeta).map(([id,m]) => <option key={id} value={id}>{m.label}</option>)}</Select></Field><Field label="到期时间（可选）"><Input value={editing.due ?? ''} onChange={(e) => setEditing({...editing, due:e.target.value})} placeholder="例如：明天下午"/></Field></div>}
      </Dialog>
    </div>
  )
}

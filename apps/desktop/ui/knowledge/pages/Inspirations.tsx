import {useRef, useState} from 'react'
import {Lightbulb, Plus, Quote, Trash2} from 'lucide-react'
import {toast} from 'sonner'
import {Button, Card, Dialog, Field, Input, Textarea} from '@/components/ui'
import type {Inspiration} from '@/db/schema'
import {createInspiration, deleteInspiration, updateRecord, useInspirations} from '@/db/hooks'

export function Inspirations() {
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const savingRef = useRef(false)
  const inspirations = useInspirations()
  const [editing, setEditing] = useState<Inspiration | null>(null)

  async function handleSave(e?: React.FormEvent) {
    e?.preventDefault()
    if (savingRef.current) return
    if (!draft.trim()) {
      setError('请先输入灵感内容')
      inputRef.current?.focus()
      return
    }
    savingRef.current = true
    setSaving(true)
    setError('')
    try {
      await createInspiration({content: draft})
      setDraft('')
      toast.success('已记下灵感')
    } catch (e) {
      setError(`保存失败，内容已保留：${e instanceof Error ? e.message : String(e)}`)
    } finally {
      savingRef.current = false
      setSaving(false)
      inputRef.current?.focus()
    }
  }

  async function handleDelete(id: string) {
    await deleteInspiration(id)
    toast.success('已删除')
  }

  if (inspirations === undefined) return null

  return (
    <div className="mx-auto max-w-[1080px] px-3 py-6 sm:px-6">
      <div className="mb-5">
        <h1 className="text-[20px] font-semibold text-[var(--color-ink)]">灵感</h1>
        <p className="mt-1 text-[12.5px] text-[var(--color-ink-soft)]">
          先扔进来，之后再整理。灵感不必完整；点击「记下」立即保存到本机。
        </p>
      </div>

      <Card className="mb-5 p-3">
        <form className="space-y-3" onSubmit={handleSave}>
          <label htmlFor="new-inspiration" className="flex items-center gap-2 text-[12px] text-[var(--color-ink-soft)]">
            <Lightbulb size={16} className="text-[var(--color-tag-rose-text)]" />
            灵感内容
          </label>
          <Textarea
            id="new-inspiration"
            ref={inputRef}
            value={draft}
            onChange={(e) => {setDraft(e.target.value); setError('')}}
            readOnly={saving}
            placeholder="一句话、一个画面、一个突然冒出的念头…"
            className="block min-h-[112px] min-w-0"
            aria-label="记录灵感"
            aria-invalid={!!error}
            aria-describedby={error ? 'inspiration-save-error' : 'inspiration-save-hint'}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !e.nativeEvent.isComposing) {
                e.preventDefault()
                e.currentTarget.form?.requestSubmit()
              }
            }}
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span id="inspiration-save-hint" className="text-[11px] text-[var(--color-ink-faint)]">输入后点击记下，或按 Ctrl / ⌘ + Enter</span>
            <Button type="submit" disabled={saving}>
              <Plus size={14} /> {saving ? '保存中…' : '记下'}
            </Button>
          </div>
          {error && <p id="inspiration-save-error" role="alert" className="text-[12px] text-[var(--color-destructive)]">{error}</p>}
        </form>
      </Card>

      {inspirations.length === 0 ? (
        <Card className="py-14 text-center">
          <p className="text-[12.5px] text-[var(--color-ink-faint)]">
            还没有灵感，随手记一条吧
          </p>
        </Card>
      ) : (
        <div className="columns-1 gap-3 sm:columns-2 lg:columns-3">
          {inspirations.map((item, i) => (
            <Card
              key={item.id}
              className="group relative mb-3 break-inside-avoid p-4"
              style={{
                backgroundColor:
                  i % 3 === 0
                    ? 'color-mix(in srgb, var(--color-tag-rose) 55%, var(--color-card))'
                    : undefined,
              }}
            >
              <Quote size={14} className="text-[var(--color-tag-rose-text)] opacity-70" />
              <h3 className="mt-2 text-[13.5px] font-semibold text-[var(--color-ink)]">{item.title}</h3>
              <p className="mt-1.5 text-[12.5px] leading-[1.75] text-[var(--color-ink-soft)]">
                {item.content}
              </p>
              <button className="mt-3 text-[12px] text-[var(--color-ocean)]" onClick={() => setEditing({...item})}>编辑灵感</button>
              <div className="mt-3 flex items-center justify-between text-[11px] text-[var(--color-ink-faint)]">
                <span>{new Date(item.createdAt).toLocaleString('zh-CN')}</span>
                <button
                  aria-label={`删除 ${item.title}`}
                  onClick={() => handleDelete(item.id)}
                  className="rounded-md p-1 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-[var(--color-muted)] hover:text-[var(--color-destructive)]"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
      <Dialog open={!!editing} onClose={() => setEditing(null)} title="编辑灵感" footer={<Button onClick={async () => {
        if (!editing || !editing.content.trim() || !editing.title.trim()) {toast.error('标题和内容不能为空'); return}
        await updateRecord('inspirations', editing.id, {title: editing.title.trim(), content: editing.content.trim()})
        setEditing(null); toast.success('灵感已更新')
      }}>保存修改</Button>}>
        {editing && <div className="space-y-3"><Field label="标题"><Input value={editing.title} onChange={(e) => setEditing({...editing, title:e.target.value})}/></Field><Field label="内容"><Textarea aria-label="灵感内容" value={editing.content} onChange={(e) => setEditing({...editing, content:e.target.value})}/></Field></div>}
      </Dialog>
    </div>
  )
}

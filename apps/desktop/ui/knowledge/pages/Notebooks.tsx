import {useState} from 'react'
import {useNavigate} from 'react-router-dom'
import {BookOpen, FileText, Plus, Search, Trash2} from 'lucide-react'
import {toast} from 'sonner'
import {Badge, Button, Card, Dialog, Field, Input, Textarea} from '@/components/ui'
import {createNotebook, deleteNotebook, updateRecord, useNotebooks, useCount} from '@/db/hooks'
import type {Tone} from '@/db/schema'
import {cn} from '@/lib/cn'

const tones: Tone[] = ['blue', 'purple', 'teal', 'rose', 'amber']

function timeAgo(ts: number) {
  const diff = Date.now() - ts
  const m = Math.floor(diff / 60_000)
  if (m < 1) return '刚刚'
  if (m < 60) return `${m} 分钟前`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} 小时前`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d} 天前`
  return new Date(ts).toLocaleDateString('zh-CN')
}

export function Notebooks() {
  const navigate = useNavigate()
  const list = useNotebooks()
  const noteCount = useCount(data => data.notes.length)
  const sourceCount = useCount(data => data.sources.length)

  const [q, setQ] = useState('')
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [tone, setTone] = useState<Tone>('blue')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const filtered = (list ?? []).filter(
    (n) => n.name.includes(q.trim()) || n.desc.includes(q.trim()),
  )

  async function handleCreate() {
    if (!name.trim()) {
      toast.error('请填写笔记本名称')
      return
    }
    if (editingId) {
      await updateRecord('notebooks', editingId, {name: name.trim(), desc: desc.trim(), tone})
      setCreating(false)
      setEditingId(null)
      toast.success('笔记本已更新')
      return
    }
    const id = await createNotebook({name, desc, tone})
    toast.success('已创建笔记本')
    setCreating(false)
    setName('')
    setDesc('')
    setTone('blue')
    navigate(`/notebooks/${id}`)
  }

  async function handleDelete() {
    if (!confirmDelete) return
    await deleteNotebook(confirmDelete)
    toast.success('已删除笔记本及其内容')
    setConfirmDelete(null)
  }

  return (
    <div className="mx-auto max-w-[1180px] px-6 py-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-semibold text-[var(--color-ink)]">笔记本</h1>
          <p className="mt-1 text-[12.5px] text-[var(--color-ink-soft)]">
            按主题把来源与笔记收在一起，每个笔记本都有自己的知识图谱。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search
              size={14}
              className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-[var(--color-ink-faint)]"
            />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="搜索笔记本…"
              className="w-[200px] pl-8"
              aria-label="搜索笔记本"
            />
          </div>
          <Button onClick={() => {setEditingId(null); setName(''); setDesc(''); setTone('blue'); setCreating(true)}}>
            <Plus size={15} /> 新建
          </Button>
        </div>
      </div>

      {list === undefined ? (
        <p className="py-10 text-center text-[12.5px] text-[var(--color-ink-faint)]">加载中…</p>
      ) : filtered.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 py-14 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-[var(--color-tint-lavender)] text-[var(--color-ocean-deep)]">
            <BookOpen size={20} />
          </span>
          <div>
            <h3 className="text-[14px] font-semibold text-[var(--color-ink)]">
              {q ? '没有匹配的笔记本' : '还没有笔记本'}
            </h3>
            <p className="mt-1 text-[12px] text-[var(--color-ink-soft)]">
              {q ? '换个关键词试试' : '建一个主题，把相关的来源与笔记放进去'}
            </p>
          </div>
          {!q && (
            <Button size="sm" onClick={() => {setEditingId(null); setName(''); setDesc(''); setTone('blue'); setCreating(true)}}>
              <Plus size={14} /> 新建第一个笔记本
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((nb) => (
            <Card
              key={nb.id}
              className="group relative cursor-pointer p-4 transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-float)]"
              onClick={() => navigate(`/notebooks/${nb.id}`)}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-[var(--color-tag-blue)]/70 text-[var(--color-tag-blue-text)]">
                  <BookOpen size={16} />
                </span>
                <div className="flex items-center gap-1">
                  <button className="text-[11px] text-[var(--color-ocean)]" aria-label={`编辑笔记本 ${nb.name}`} onClick={(e) => {
                    e.stopPropagation(); setEditingId(nb.id); setName(nb.name); setDesc(nb.desc); setTone(nb.tone); setCreating(true)
                  }}>编辑</button>
                  <Badge tone={nb.tone}>笔记本</Badge>
                  <button
                    aria-label={`删除 ${nb.name}`}
                    className="rounded-md p-1 text-[var(--color-ink-faint)] opacity-0 transition-opacity group-hover:opacity-100 hover:bg-[var(--color-muted)] hover:text-[var(--color-destructive)]"
                    onClick={(e) => {
                      e.stopPropagation()
                      setConfirmDelete(nb.id)
                    }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
              <h3 className="mt-3 truncate text-[14px] font-semibold text-[var(--color-ink)]">
                {nb.name}
              </h3>
              <p className="mt-1 line-clamp-2 text-[12px] leading-[1.6] text-[var(--color-ink-soft)]">
                {nb.desc || '还没有描述'}
              </p>
              <div className="mt-3 flex items-center gap-3 text-[11.5px] text-[var(--color-ink-faint)]">
                <span className="inline-flex items-center gap-1">
                  <FileText size={12} /> 更新于 {timeAgo(nb.updatedAt)}
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}

      {list && list.length > 0 && (
        <p className="mt-4 text-[11.5px] text-[var(--color-ink-faint)]">
          共 {list.length} 个笔记本 · {noteCount ?? 0} 条笔记 · {sourceCount ?? 0} 个来源 · 全部保存在指定磁盘目录
        </p>
      )}

      <Dialog
        open={creating}
        onClose={() => setCreating(false)}
        title={editingId ? '编辑笔记本' : '新建笔记本'}
        desc="用一个主题把相关的来源、笔记和对话收在一起。"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreating(false)}>
              取消
            </Button>
            <Button onClick={handleCreate}>{editingId ? '保存修改' : '创建'}</Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <Field label="名称">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：本地优先产品研究"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate()
              }}
            />
          </Field>
          <Field label="描述（可选）">
            <Textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="一句话说明这个笔记本要解决什么"
            />
          </Field>
          <Field label="主题色">
            <div className="flex gap-2">
              {tones.map((t) => (
                <button
                  key={t}
                  aria-label={`主题色 ${t}`}
                  onClick={() => setTone(t)}
                  className={cn(
                    'h-7 w-7 cursor-pointer rounded-full border-2 transition-transform',
                    tone === t ? 'scale-110 border-[var(--color-ink)]' : 'border-transparent',
                  )}
                  style={{backgroundColor: `var(--color-tag-${t})`}}
                />
              ))}
            </div>
          </Field>
        </div>
      </Dialog>

      <Dialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="删除这个笔记本？"
        desc="笔记本下的来源、笔记、待办会一并删除，此操作不可撤销。"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDelete(null)}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              确认删除
            </Button>
          </>
        }
      />
    </div>
  )
}

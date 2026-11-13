import {useEffect, useMemo, useRef, useState} from 'react'
import {useNavigate, useParams, useSearchParams} from 'react-router-dom'
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  FileText,
  Link2,
  MessageSquareText,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react'
import {toast} from 'sonner'
import {Badge, Button, Card, Textarea, Tooltip} from '@/components/ui'
import {
  createNote,
  deleteNote,
  deleteSource,
  updateNote,
  useNotebook,
  useNotes,
  useSources,
} from '@/db/hooks'
import type {Note, Source} from '@/db/schema'
import {useAssistant} from '@/components/Assistant'
import {cn} from '@/lib/cn'

const sourceTypeLabel = {
  web: '网页',
  pdf: 'PDF',
  video: '视频',
  file: '文件',
  audio: '音频',
} as const

function timeAgo(ts: number) {
  const m = Math.floor((Date.now() - ts) / 60_000)
  if (m < 1) return '刚刚'
  if (m < 60) return `${m} 分钟前`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} 小时前`
  return new Date(ts).toLocaleDateString('zh-CN')
}

export function NotebookDetail() {
  const {id} = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const notebook = useNotebook(id)
  const notes = useNotes(id)
  const sources = useSources(id)

  const [sourceOpen, setSourceOpen] = useState(true)
  const {show: showAssistant} = useAssistant()
  const [activeNoteId, setActiveNoteId] = useState<string | null>(params.get('note'))
  const [editing, setEditing] = useState(false)
  const [draftTitle, setDraftTitle] = useState('')
  const [draftBody, setDraftBody] = useState('')
  const [quick, setQuick] = useState('')
  const [writing, setWriting] = useState(false)
  const pendingEditId = useRef<string | null>(null)
  useEffect(() => {setActiveNoteId(params.get('note'))}, [id, params])

  const activeNote = useMemo(
    () => notes?.find((n) => n.id === activeNoteId) ?? notes?.[0],
    [notes, activeNoteId],
  )

  useEffect(() => {
    if (activeNote) {
      setDraftTitle(activeNote.title)
      setDraftBody(activeNote.content)
      setEditing(pendingEditId.current === activeNote.id)
      pendingEditId.current = null
    }
  }, [activeNote?.id])

  const dirty = !!quick.trim() || (editing && !!activeNote && (draftTitle !== activeNote.title || draftBody !== activeNote.content))
  useEffect(() => {
    if (!dirty && !writing) return
    const warn = (e: BeforeUnloadEvent) => {e.preventDefault(); e.returnValue = ''}
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty, writing])

  if (!id) return null
  if (notebook === undefined || notes === undefined) return null

  async function handleNewNote() {
    if (writing || (dirty && !confirm('有未保存的内容，仍要新建笔记吗？'))) return
    const nid = await createNote({
      notebookId: id!,
      title: '未命名笔记',
      content: '',
    })
    pendingEditId.current = nid
    setActiveNoteId(nid)
    toast.success('已新建笔记，开始写吧')
  }

  async function handleSaveNote() {
    if (!activeNote || writing) return
    setWriting(true)
    try {
      await updateNote(activeNote.id, {title: draftTitle.trim() || '未命名笔记', content: draftBody})
      setEditing(false)
      toast.success('已保存')
    } finally {setWriting(false)}
  }

  async function handleDeleteNote(note: Note) {
    if (!confirm(`删除笔记「${note.title}」？`)) return
    await deleteNote(note.id)
    setActiveNoteId(null)
    toast.success('已删除笔记')
  }

  async function handleQuickSave() {
    const text = quick.trim()
    if (!text || writing) return
    setWriting(true)
    try {
    const lines = text.split('\n')
    const title = lines[0]!.slice(0, 28) || '快速记录'
    const nid = await createNote({notebookId: id!, title, content: text})
    setQuick('')
    setActiveNoteId(nid)
    toast.success('已保存到当前笔记本')
    } finally {setWriting(false)}
  }

  async function handleAddSource() {
    navigate(`/sources?notebook=${encodeURIComponent(id!)}`)
  }

  if (!notebook) {
    return (
      <div className="flex h-full items-center justify-center">
        <Card className="px-8 py-10 text-center">
          <p className="text-[13px] text-[var(--color-ink-soft)]">找不到这个笔记本</p>
          <Button className="mt-3" size="sm" onClick={() => navigate('/notebooks')}>
            返回列表
          </Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* 顶部工具条 */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-[var(--color-border)] bg-[var(--color-card)]/30 px-4 py-2.5 backdrop-blur-xl">
        <Button variant="ghost" size="icon" aria-label="返回笔记本列表" onClick={() => navigate('/notebooks')}>
          <ArrowLeft size={16} />
        </Button>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-[14.5px] font-semibold text-[var(--color-ink)]">
              {notebook.name}
            </h1>
            <Badge tone={notebook.tone}>笔记本</Badge>
          </div>
          <div className="mt-0.5 text-[11.5px] text-[var(--color-ink-faint)]">
            {sources?.length ?? 0} 个来源 · {notes.length} 条笔记 · 更新于 {timeAgo(notebook.updatedAt)}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <Tooltip label={sourceOpen ? '收起来源栏' : '展开来源栏'}>
            <Button
              variant="ghost"
              size="icon"
              aria-label={sourceOpen ? '收起来源栏' : '展开来源栏'}
              onClick={() => setSourceOpen((v) => !v)}
            >
              {sourceOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
            </Button>
          </Tooltip>
          <Button variant="outline" size="sm" onClick={showAssistant}>
            <MessageSquareText size={14} /> AI 对话
          </Button>
          <Button size="sm" onClick={handleNewNote}>
            <Plus size={14} /> 新建笔记
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* 左栏：来源 */}
        <div
          className={cn(
            'shrink-0 overflow-hidden border-r border-[var(--color-border)] bg-[var(--color-card)]/25 backdrop-blur-xl transition-[width] duration-200',
            sourceOpen ? 'w-[248px]' : 'w-0',
          )}
        >
          <div className="w-[248px] p-3">
            <div className="mb-2 flex items-center justify-between px-1">
              <h2 className="text-[12px] font-semibold tracking-wide text-[var(--color-ink-soft)]">
                来源
              </h2>
              <button
                onClick={handleAddSource}
                className="cursor-pointer text-[11.5px] text-[var(--color-ocean)] hover:underline"
              >
                + 添加
              </button>
            </div>
            <div className="flex flex-col gap-1.5">
              {(sources ?? []).map((s: Source) => (
                <Card
                  key={s.id}
                  onClick={() => navigate(`/sources?source=${encodeURIComponent(s.id)}`)}
                  className="group/item cursor-pointer px-3 py-2.5 transition-colors hover:bg-[var(--color-muted)]"
                >
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-[8px] bg-[var(--color-tint-mint)] text-[var(--color-tag-teal-text)]">
                      <FileText size={12} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="line-clamp-2 text-[12.5px] leading-[1.5] font-medium text-[var(--color-ink)]">
                        {s.title}
                      </div>
                      <div className="mt-1 text-[11px] text-[var(--color-ink-faint)]">
                        {sourceTypeLabel[s.type]} · {timeAgo(s.createdAt)}
                      </div>
                    </div>
                    <button
                      aria-label={`删除来源 ${s.title}`}
                      onClick={async (e) => {
                        e.stopPropagation()
                        await deleteSource(s.id)
                        toast.success('已删除来源')
                      }}
                      className="rounded p-0.5 text-[var(--color-ink-faint)] opacity-0 group-hover/item:opacity-100 hover:text-[var(--color-destructive)]"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                </Card>
              ))}
            </div>
            <div className="mt-3 rounded-[12px] border border-dashed border-[var(--color-border)] px-3 py-4 text-center text-[11.5px] leading-[1.6] text-[var(--color-ink-faint)]">
              {(sources ?? []).length === 0
                ? '还没有来源，点击「+ 添加」'
                : '点击来源查看或整理正文；目前支持文本导入与手动摘录'}
            </div>
          </div>
        </div>

        {/* 中栏：笔记 */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex shrink-0 gap-1.5 overflow-x-auto border-b border-[var(--color-border)] px-4 py-2">
            {notes.length === 0 ? (
              <span className="py-1.5 text-[12px] text-[var(--color-ink-faint)]">
                还没有笔记
              </span>
            ) : (
              notes.map((n) => (
                <button
                  key={n.id}
                  onClick={() => {if (!writing && (!dirty || confirm('有未保存的内容，仍要切换笔记吗？'))) setActiveNoteId(n.id)}}
                  className={cn(
                    'shrink-0 cursor-pointer rounded-full px-3 py-1.5 text-[12px] transition-colors',
                    activeNote?.id === n.id
                      ? 'bg-[var(--color-ocean-soft)] font-medium text-[var(--color-ocean-deep)]'
                      : 'text-[var(--color-ink-soft)] hover:bg-[var(--color-muted)]',
                  )}
                >
                  {n.title}
                </button>
              ))
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-8 py-6">
            {!activeNote ? (
              <div className="mx-auto max-w-[680px] py-16 text-center">
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-[14px] bg-[var(--color-tint-lavender)] text-[var(--color-ocean-deep)]">
                  <FileText size={20} />
                </span>
                <h3 className="mt-3 text-[14px] font-semibold text-[var(--color-ink)]">
                  这个笔记本还没有笔记
                </h3>
                <p className="mt-1 text-[12px] text-[var(--color-ink-soft)]">
                  点右上角「新建笔记」，或在底部快速记录一条
                </p>
                <Button className="mt-4" size="sm" onClick={handleNewNote}>
                  <Plus size={14} /> 新建笔记
                </Button>
              </div>
            ) : editing ? (
              <article className="mx-auto flex max-w-[680px] flex-col gap-3">
                <input
                  value={draftTitle}
                  onChange={(e) => setDraftTitle(e.target.value)}
                  className="w-full border-0 bg-transparent text-[22px] leading-tight font-semibold text-[var(--color-ink)] outline-none"
                  placeholder="笔记标题"
                  aria-label="笔记标题"
                  autoFocus
                />
                <Textarea
                  value={draftBody}
                  onChange={(e) => setDraftBody(e.target.value)}
                  className="min-h-[420px] resize-none border-transparent bg-transparent text-[13.5px] leading-[1.9] shadow-none"
                  placeholder="开始写…"
                  aria-label="笔记正文"
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSaveNote} disabled={writing}>
                    {writing ? '保存中…' : '保存'}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditing(false)
                      setDraftTitle(activeNote.title)
                      setDraftBody(activeNote.content)
                    }}
                  >
                    取消
                  </Button>
                </div>
              </article>
            ) : (
              <article className="mx-auto max-w-[680px]">
                <div className="flex items-start justify-between gap-3">
                  <h1 className="text-[22px] leading-tight font-semibold text-[var(--color-ink)]">
                    {activeNote.title}
                  </h1>
                  <div className="flex shrink-0 gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
                      编辑
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="删除笔记"
                      onClick={() => handleDeleteNote(activeNote)}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-3 text-[11.5px] text-[var(--color-ink-faint)]">
                  <span>{timeAgo(activeNote.updatedAt)}</span>
                  <span className="inline-flex items-center gap-1">
                    <Link2 size={11} /> 0 条关联
                  </span>
                </div>
                <div className="mt-5 text-[13.5px] leading-[1.9] whitespace-pre-wrap text-[var(--color-ink-soft)]">
                  {activeNote.content || '（空笔记，点击「编辑」开始写）'}
                </div>
                <div className="mt-6 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-tint-lavender)]/40 px-4 py-3 text-[12px] leading-[1.7] text-[var(--color-ink-soft)]">
                  <span className="mr-1.5 inline-flex items-center gap-1 font-medium text-[var(--color-ocean-deep)]">
                    <Sparkles size={12} /> 小提示
                  </span>
                  笔记与来源、灵感之间的引用会出现在知识图谱里。建立关联越多，图谱越有用。
                </div>
              </article>
            )}
          </div>
        </div>

      </div>

      {/* 底部快速记录 */}
      <div className="shrink-0 border-t border-[var(--color-border)] bg-[var(--color-card)]/35 px-4 py-2.5 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[760px] items-end gap-2">
          <Textarea
            value={quick}
            onChange={(e) => setQuick(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleQuickSave()
            }}
            placeholder="随手记一条（⌘/Ctrl + Enter 保存）；会归入当前笔记本"
            className="min-h-[42px] flex-1 resize-none py-2.5"
            aria-label="快速记录"
          />
          <Button onClick={handleQuickSave} disabled={writing || !quick.trim()}>
            {writing ? '保存中…' : '保存'}
          </Button>
        </div>
      </div>
    </div>
  )
}


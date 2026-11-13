import {useData} from '@/db/hooks'
import {useStorage} from '@/db/store'
import {useAssistant} from '@/components/Assistant'
import {useNavigate} from 'react-router-dom'
import {
  ArrowRight,
  BookOpen,
  CheckSquare,
  FileText,
  Lightbulb,
  MessageSquareText,
  Plus,
  Sparkles,
} from 'lucide-react'
import {Badge, Button, Card, CardHeader, ListItem} from '@/components/ui'
import {useCount, useInspirations, useNotebooks, useTodos} from '@/db/hooks'
import type {BadgeTone} from '@/components/ui'

const kindMeta = {
  note: {label: '笔记', tone: 'purple' as BadgeTone, icon: FileText},
  todo: {label: '待办', tone: 'amber' as BadgeTone, icon: CheckSquare},
  inspiration: {label: '灵感', tone: 'rose' as BadgeTone, icon: Lightbulb},
}

type FeedRow = {
  id: string
  kind: 'note' | 'todo' | 'inspiration'
  title: string
  excerpt: string
  ts: number
  notebookName?: string
}

function timeAgo(ts: number) {
  const m = Math.floor((Date.now() - ts) / 60_000)
  if (m < 1) return '刚刚'
  if (m < 60) return `${m} 分钟前`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} 小时前`
  return new Date(ts).toLocaleDateString('zh-CN')
}

export function Workbench() {
  const navigate = useNavigate()
  const {show: showAssistant} = useAssistant()
  const notebooks = useNotebooks()
  const todos = useTodos()
  const inspirations = useInspirations()

  const data = useData()
  const {remote, snapshot} = useStorage()
  const noteCount = useCount(data => data.notes.length)
  const openTodoCount = todos?.filter((t) => !t.done).length
  const dayStart = new Date()
  dayStart.setHours(0, 0, 0, 0)
  const inspirationTodayCount = inspirations?.filter(i => i.createdAt >= dayStart.getTime()).length
  const recentNotes = data?.notes.slice().sort((a,b) => b.updatedAt - a.updatedAt).slice(0,8)

  const feed: FeedRow[] = [
    ...(recentNotes ?? []).map((n) => ({
      id: n.id,
      kind: 'note' as const,
      title: n.title,
      excerpt: n.content.slice(0, 90),
      ts: n.updatedAt,
      notebookName: (notebooks ?? []).find((nb) => nb.id === n.notebookId)?.name,
    })),
    ...(todos ?? []).slice(0, 8).map((t) => ({
      id: t.id,
      kind: 'todo' as const,
      title: t.title,
      excerpt: '',
      ts: t.createdAt,
    })),
    ...(inspirations ?? []).slice(0, 8).map((i) => ({
      id: i.id,
      kind: 'inspiration' as const,
      title: i.title,
      excerpt: i.content,
      ts: i.createdAt,
    })),
  ]
  const sorted = feed.sort((a, b) => b.ts - a.ts).slice(0, 12)

  const stats = [
    {label: '待办', value: openTodoCount ?? 0, icon: CheckSquare},
    {label: '今日灵感', value: inspirationTodayCount ?? 0, icon: Lightbulb},
    {label: '笔记本', value: notebooks?.length ?? 0, icon: BookOpen},
    {label: '笔记', value: noteCount ?? 0, icon: FileText},
  ]

  const hour = new Date().getHours()
  const greeting =
    hour < 6 ? '夜深了' : hour < 12 ? '早上好' : hour < 18 ? '下午好' : '晚上好'

  return (
    <div className="mx-auto max-w-[1180px] px-6 py-6">
      {/* 今日概览 */}
      <section className="romance-grad relative mb-5 overflow-hidden rounded-[20px] px-6 py-5 text-white shadow-[var(--shadow-float)]">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              'radial-gradient(600px 300px at 100% 0%, #ffffff55, transparent 60%), radial-gradient(400px 240px at 0% 100%, #ffffff33, transparent 60%)',
          }}
        />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-[11.5px] tracking-[0.18em] text-white/75">JARVIS BUTLER</div>
            <h1 className="mt-1 text-[22px] leading-tight font-semibold">{greeting}，今天想理清什么？</h1>
            <p className="mt-1.5 max-w-[440px] text-[12.5px] leading-[1.7] text-white/85">
              {remote ? '通过私网访问同一份记录；请保持 Windows 在线。此入口暂不启用 AI，不支持离线保存。' : snapshot?.mode === 'sync' ? '核心资料通过共享服务保存；本机保留缓存与待同步内容。AI 可选。' : '所有数据都留在这台设备上。AI 是可选的——不配置也能完整使用。'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="border-white/40 bg-white/15 text-white hover:bg-white/25"
              onClick={() => navigate('/notebooks')}
            >
              <Plus size={15} /> 新建笔记本
            </Button>
            <Button
              variant="outline"
              className="border-white/40 bg-white/15 text-white hover:bg-white/25"
              onClick={() => navigate('/sources')}
            >
              <FileText size={15} /> 导入来源
            </Button>
          </div>
        </div>
        <div className="relative mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {stats.map((s) => (
            <div
              key={s.label}
              className="flex items-center gap-2.5 rounded-[12px] border border-white/25 bg-white/12 px-3 py-2.5 backdrop-blur-sm"
            >
              <s.icon size={16} className="shrink-0 text-white/80" />
              <div className="min-w-0">
                <div className="text-[17px] leading-none font-semibold">{s.value}</div>
                <div className="mt-0.5 truncate text-[11px] text-white/75">{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* 混合流 */}
        <section>
          <div className="mb-2.5 flex items-center justify-between">
            <h2 className="text-[15px] font-semibold text-[var(--color-ink)]">全部动态</h2>
            <span className="text-[11.5px] text-[var(--color-ink-faint)]">按时间倒序</span>
          </div>
          {sorted.length === 0 ? (
            <Card className="py-14 text-center">
              <p className="text-[12.5px] text-[var(--color-ink-faint)]">
                还没有动态——去添加一条待办或灵感
              </p>
              <Button className="mt-3" size="sm" onClick={() => navigate('/todos')}>
                <Plus size={14} /> 添加待办
              </Button>
            </Card>
          ) : (
            <div className="flex flex-col gap-2.5">
              {sorted.map((item) => {
                const meta = kindMeta[item.kind]
                return (
                  <Card
                    key={`${item.kind}-${item.id}`}
                    className="px-4 py-3.5 transition-shadow hover:shadow-[var(--shadow-float)]"
                  >
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[var(--color-tag-blue)]/70 text-[var(--color-tag-blue-text)]">
                        <meta.icon size={15} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone={meta.tone}>{meta.label}</Badge>
                          <h3 className="truncate text-[13.5px] font-medium text-[var(--color-ink)]">
                            {item.title}
                          </h3>
                        </div>
                        {item.excerpt && (
                          <p className="mt-1.5 line-clamp-2 text-[12.5px] leading-[1.7] text-[var(--color-ink-soft)]">
                            {item.excerpt}
                          </p>
                        )}
                        <div className="mt-2 text-[11.5px] text-[var(--color-ink-faint)]">
                          {timeAgo(item.ts)}
                        </div>
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </section>

        {/* 右栏 */}
        <aside className="flex flex-col gap-4">
          <Card glass>
            <CardHeader title="快速开始" desc="从这里进入常用工作流" />
            <div className="flex flex-col gap-1 px-3 pb-3">
              <ListItem
                icon={<MessageSquareText size={14} />}
                title="打开贾维斯助手"
                meta="整理灵感、讨论文字、查询内容"
                onClick={showAssistant}
              />
              <ListItem
                icon={<FileText size={14} />}
                title="添加一个来源"
                meta="来源 → 笔记本 → 笔记"
                onClick={() => navigate('/sources')}
              />
              <ListItem
                icon={<Sparkles size={14} />}
                title="记录一条灵感"
                meta="先扔进收集箱，之后再整理"
                onClick={() => navigate('/inspirations')}
              />
            </div>
          </Card>

          <Card>
            <CardHeader
              title="最近笔记本"
              action={
                <button
                  onClick={() => navigate('/notebooks')}
                  className="inline-flex cursor-pointer items-center gap-1 text-[11.5px] text-[var(--color-ocean)] hover:underline"
                >
                  全部 <ArrowRight size={12} />
                </button>
              }
            />
            {(notebooks ?? []).length === 0 ? (
              <p className="px-4 pb-4 text-[12px] text-[var(--color-ink-faint)]">还没有笔记本</p>
            ) : (
              <div className="flex flex-col gap-0.5 px-3 pb-3">
                {(notebooks ?? []).slice(0, 3).map((nb) => (
                  <ListItem
                    key={nb.id}
                    icon={<BookOpen size={14} />}
                    title={nb.name}
                    meta={timeAgo(nb.updatedAt)}
                    onClick={() => navigate(`/notebooks/${nb.id}`)}
                  />
                ))}
              </div>
            )}
          </Card>
        </aside>
      </div>
    </div>
  )
}

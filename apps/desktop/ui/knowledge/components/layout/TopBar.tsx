import {useState} from 'react'
import {useNavigate} from 'react-router-dom'
import {useData} from '@/db/hooks'
import {Monitor, Moon, Search, Sun} from 'lucide-react'
import {Avatar, Button, Input, ModelStatus, Tooltip} from '@/components/ui'
import {useTheme} from '@/hooks/useTheme'
import {AssistantToggle} from '@/components/Assistant'

const pad = (n: number) => String(n).padStart(2, '0')

function todayLabel() {
  const d = new Date()
  return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日 · ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function TopBar() {
  const {theme, setTheme} = useTheme()
  const [query, setQuery] = useState('')
  const navigate = useNavigate()
  const data = useData()
  const results = (() => {
    const q = query.trim().toLowerCase()
    if (!q || !data) return []
    const match = (s: string) => s.toLowerCase().includes(q)
    return [
      ...data.notebooks.filter(n => match(n.name + n.desc)).map(n => ({id:`nb:${n.id}`, title:n.name, kind:'笔记本', path:`/notebooks/${n.id}`})),
      ...data.notes.filter(n => match(n.title + n.content)).map(n => ({id:`n:${n.id}`, title:n.title, kind:'笔记', path:`/notebooks/${n.notebookId}?note=${encodeURIComponent(n.id)}`})),
      ...data.sources.filter(n => match(n.title + (n.content ?? ''))).map(n => ({id:`s:${n.id}`, title:n.title, kind:'来源', path:`/sources?source=${encodeURIComponent(n.id)}`})),
      ...data.todos.filter(n => match(n.title)).map(n => ({id:`t:${n.id}`, title:n.title, kind:'待办', path:'/todos'})),
      ...data.inspirations.filter(n => match(n.title + n.content)).map(n => ({id:`i:${n.id}`, title:n.title, kind:'灵感', path:'/inspirations'})),
    ]
  })()
  const next = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light'
  const ThemeIcon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor
  const themeLabel = theme === 'light' ? '浅色' : theme === 'dark' ? '深色' : '跟随系统'

  return (
    <header className="relative z-20 flex h-[58px] shrink-0 items-center gap-3 border-b border-[var(--color-border)] bg-[var(--color-card)]/35 px-5 backdrop-blur-xl">
      <div className="relative max-w-[420px] flex-1">
        <Search
          size={15}
          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[var(--color-ink-faint)]"
        />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {if (e.key === 'Escape') setQuery('')}}
          placeholder="搜索笔记、来源、想法…"
          className="h-9 bg-[var(--color-card)]/70 pl-9"
          aria-label="全局搜索"
        />
        {query.trim() && <div className="absolute top-full left-0 mt-2 max-h-[420px] w-full overflow-y-auto rounded-xl border bg-[var(--color-popover)] p-2 shadow-[var(--shadow-float)]" role="region" aria-label="搜索结果">
          <p className="p-2 text-[11px] text-[var(--color-ink-soft)]">{results?.length ?? 0} 条结果，最多展示 30 条 · Esc 关闭</p>
          {results?.slice(0,30).map((r) => <button key={r.id} className="block w-full rounded-lg px-3 py-2 text-left text-[12px] hover:bg-[var(--color-muted)]" onClick={() => {navigate(r.path); setQuery('')}}>{r.kind} · {r.title}</button>)}
        </div>}
      </div>
      <span className="hidden text-[12px] text-[var(--color-ink-faint)] lg:block">
        {todayLabel()}
      </span>
      <div className="ml-auto flex items-center gap-2">
        <ModelStatus className="hidden sm:inline-flex" />
        <Tooltip label={`主题：${themeLabel}（点击切换）`}>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`切换主题，当前${themeLabel}`}
            onClick={() => setTheme(next)}
          >
            <ThemeIcon size={16} />
          </Button>
        </Tooltip>
        <AssistantToggle />
        <Avatar name="我" size={30} />
      </div>
    </header>
  )
}

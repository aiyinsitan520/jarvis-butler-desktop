import {useEffect, useMemo, useState, type ReactNode} from 'react'
import {
  Clock, FileText, Folder, GitBranch, Link2, RefreshCw, Search, Tag, X,
} from 'lucide-react'
import {toast} from 'sonner'
import {Badge, Button, Card, CardHeader, Input, Tabs} from '@/components/ui'
import {
  loadMemoryIndex,
  loadMemoryNote,
  resolveLink,
  useMemoryAutoRefresh,
  useObsidian,
  type ObsidianNoteBrief,
} from '@/db/obsidian-store'
import {cn} from '@/lib/cn'

type SortKey = 'modified' | 'title' | 'folder'
type FilterKey = 'all' | 'linked' | 'recent' | 'with-tag'
const sortLabels: Record<SortKey, string> = {modified: '最近修改', title: '标题', folder: '目录'}
const oneWeek = 7 * 24 * 60 * 60 * 1000

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

/** 渲染一段行内 Markdown：优先解析 [[双链]]，再处理图片/链接/代码/粗体/斜体。 */
function renderInline(text: string, onWiki: (target: string) => void, keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = []
  const wiki = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g
  let cursor = 0
  let idx = 0
  for (let m = wiki.exec(text); m; m = wiki.exec(text)) {
    if (m.index > cursor) out.push(...renderEmphasis(text.slice(cursor, m.index), `${keyPrefix}s${idx}`))
    const target = m[1]!.trim()
    out.push(
      <button
        key={`${keyPrefix}w${idx}`}
        type="button"
        className="rounded px-0.5 text-[var(--color-ocean)] underline decoration-dotted underline-offset-2 hover:bg-[var(--color-ocean-soft)]"
        onClick={() => onWiki(target)}
      >
        {m[2]?.trim() || target}
      </button>,
    )
    cursor = m.index + m[0].length
    idx++
  }
  if (cursor < text.length) out.push(...renderEmphasis(text.slice(cursor), `${keyPrefix}e`))
  return out
}

function renderEmphasis(text: string, keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = []
  const re = /(`[^`]+`)|(!?\[[^\]]*\]\([^)]+\))|(\*\*[^*]+\*\*)|(__[^_]+__)|(\*[^*]+\*)|(_[^_]+_)/g
  let cursor = 0
  let idx = 0
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > cursor) out.push(text.slice(cursor, m.index))
    const token = m[0]
    const key = `${keyPrefix}-${idx++}`
    if (m[1]) out.push(<code key={key} className="rounded bg-[var(--color-muted)] px-1 text-[12px] text-[var(--color-ocean-deep)]">{token.slice(1, -1)}</code>)
    else if (m[2]) {
      const img = /^!\[([^\]]*)\]\(([^)]+)\)$/.exec(token)
      if (img) out.push(<img key={key} alt={img[1]} src={img[2]} className="my-2 inline max-h-[320px] rounded-md"/>)
      else {
        const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token)
        if (link) out.push(<a key={key} href={link[2]} target="_blank" rel="noopener noreferrer" className="text-[var(--color-ocean)] underline underline-offset-2">{link[1]}</a>)
        else out.push(token)
      }
    } else if (m[3]) out.push(<strong key={key}>{token.slice(2, -2)}</strong>)
    else if (m[4]) out.push(<strong key={key}>{token.slice(2, -2)}</strong>)
    else if (m[5]) out.push(<em key={key}>{token.slice(1, -1)}</em>)
    else if (m[6]) out.push(<em key={key}>{token.slice(1, -1)}</em>)
    cursor = m.index + token.length
  }
  if (cursor < text.length) out.push(text.slice(cursor))
  return out
}

const CALLOUT_TONES: Record<string, string> = {
  info: 'border-[#7ab0f0] bg-[var(--color-tag-teal)]/30',
  note: 'border-[#8a72da] bg-[var(--color-tag-blue)]/40',
  warning: 'border-[#e89184] bg-[var(--color-tag-rose)]/30',
  tip: 'border-[#6fbfa8] bg-[var(--color-tag-teal)]/30',
  abstract: 'border-[#cf9be0] bg-[var(--color-tag-purple)]/30',
  example: 'border-[#eba0c4] bg-[var(--color-tag-amber)]/30',
  quote: 'border-[var(--color-ink-faint)] bg-[var(--color-muted)]/50',
  success: 'border-[#6fbfa8] bg-[var(--color-tag-teal)]/30',
  question: 'border-[#7ab0f0] bg-[var(--color-tag-blue)]/40',
  failure: 'border-[#e89184] bg-[var(--color-tag-rose)]/30',
}

function MarkdownPreview({content, onWiki}: {content: string; onWiki: (target: string) => void}) {
  const blocks: ReactNode[] = []
  const lines = content.split(/\r?\n/)
  let key = 0
  let i = 0
  while (i < lines.length) {
    const line = lines[i]!
    const fence = /^```(\w*)\s*$/.exec(line)
    if (fence) {
      const body: string[] = []
      let j = i + 1
      while (j < lines.length && !/^```\s*$/.test(lines[j]!)) { body.push(lines[j]!); j++ }
      blocks.push(<pre key={key++} className="my-3 overflow-x-auto rounded-[12px] bg-[var(--color-muted)]/80 p-3 text-[12.5px] leading-[1.7]"><code className="text-[var(--color-ink)]">{body.join('\n')}</code></pre>)
      i = j + 1
      continue
    }
    const callout = /^\s*>\s*\[!([A-Za-z]+)\][-+]?\s*(.*)$/.exec(line)
    if (callout) {
      const kind = callout[1]!.toLowerCase()
      const title = callout[2]?.trim()
      const body: string[] = []
      let j = i + 1
      while (j < lines.length && /^\s*>/.test(lines[j]!)) { body.push(lines[j]!.replace(/^\s*> ?/, '')); j++ }
      blocks.push(
        <div key={key++} className={cn('my-3 rounded-[12px] border-l-4 p-3 text-[13px] leading-[1.75]', CALLOUT_TONES[kind] ?? CALLOUT_TONES.quote)}>
          {title && <div className="mb-1 font-medium text-[var(--color-ink)]">{renderInline(title, onWiki, `c${key}t`)}</div>}
          <div className="text-[var(--color-ink-soft)]">{renderInline(body.join(' '), onWiki, `c${key}b`)}</div>
        </div>,
      )
      i = j
      continue
    }
    const heading = /^(#{1,6})\s+(.*)$/.exec(line)
    if (heading) {
      const level = heading[1]!.length
      const size = ['text-[22px] mt-5', 'text-[18px] mt-4', 'text-[15.5px] mt-3', 'text-[14px] mt-2.5', 'text-[13.5px] mt-2', 'text-[13px] mt-2'][level - 1]
      blocks.push(<div key={key++} className={cn('font-semibold text-[var(--color-ink)]', size)}>{renderInline(heading[2]!, onWiki, `h${key}`)}</div>)
      i++
      continue
    }
    if (/^\s*([-*+]|\d+\.)\s+/.test(line)) {
      const items: {marker: string; text: string}[] = []
      let j = i
      while (j < lines.length) {
        const ul = /^\s*[-*+]\s+(.*)$/.exec(lines[j]!)
        const ol = /^\s*(\d+)\.\s+(.*)$/.exec(lines[j]!)
        if (ul) { items.push({marker: '•', text: ul[1]!}); j++; continue }
        if (ol) { items.push({marker: `${ol[1]}.`, text: ol[2]!}); j++; continue }
        break
      }
      blocks.push(
        <ul key={key++} className="my-2 ml-1 space-y-1 text-[13px] leading-[1.8]">
          {items.map((it, k) => (
            <li key={k} className="flex gap-2 text-[var(--color-ink)]"><span className="w-5 shrink-0 text-right text-[var(--color-ink-faint)]">{it.marker}</span><span className="min-w-0">{renderInline(it.text, onWiki, `l${key}-${k}`)}</span></li>
          ))}
        </ul>,
      )
      i = j
      continue
    }
    const quote = /^\s*>\s?(.*)$/.exec(line)
    if (quote) {
      const body: string[] = [quote[1]!]
      let j = i + 1
      while (j < lines.length && /^\s*>/.test(lines[j]!)) { body.push(lines[j]!.replace(/^\s*> ?/, '')); j++ }
      blocks.push(<blockquote key={key++} className="my-2 border-l-2 border-[var(--color-ink-faint)] pl-3 text-[12.5px] italic leading-[1.8] text-[var(--color-ink-soft)]">{renderInline(body.join(' '), onWiki, `q${key}`)}</blockquote>)
      i = j
      continue
    }
    if (/^\s*$/.test(line)) { i++; continue }
    if (/^\s*(---+|\*\*\*+|___+)\s*$/.test(line)) { blocks.push(<hr key={key++} className="my-4 border-[var(--color-border)]"/>); i++; continue }
    // 表格：连续含 | 的行
    if (line.includes('|') && lines[i + 1]?.includes('|') && /^\s*\|?[\s:-]+\|/.test(lines[i + 1]!)) {
      const rows: string[][] = []
      let j = i
      while (j < lines.length && lines[j]!.includes('|')) {
        const cells = lines[j]!.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim())
        if (!/^[\s:-]+$/.test(cells.join(''))) rows.push(cells)
        j++
      }
      blocks.push(
        <div key={key++} className="my-3 overflow-x-auto">
          <table className="w-full border-collapse text-[12.5px]">
            <thead><tr>{rows[0]?.map((c, ci) => <th key={ci} className="border border-[var(--color-border)] bg-[var(--color-muted)]/60 px-2 py-1 text-left font-medium">{renderInline(c, onWiki, `th${ci}`)}</th>)}</tr></thead>
            <tbody>{rows.slice(1).map((row, ri) => <tr key={ri}>{row.map((c, ci) => <td key={ci} className="border border-[var(--color-border)] px-2 py-1 align-top">{renderInline(c, onWiki, `td${ri}-${ci}`)}</td>)}</tr>)}</tbody>
          </table>
        </div>,
      )
      i = j
      continue
    }
    const para: string[] = [line]
    let j = i + 1
    while (j < lines.length && lines[j]!.trim() && !/^(#{1,6}\s|>\s?|[-*+]\s|\d+\.\s|```)/.test(lines[j]!)) { para.push(lines[j]!); j++ }
    blocks.push(<p key={key++} className="my-2 text-[13px] leading-[1.8] text-[var(--color-ink)]">{renderInline(para.join(' '), onWiki, `p${key}`)}</p>)
    i = j
  }
  return <div className="markdown-preview">{blocks}</div>
}

function FrontmatterList({data}: {data: Record<string, string | string[]>}) {
  const entries = Object.entries(data)
  if (!entries.length) return null
  return (
    <div className="mb-4 rounded-[12px] border border-dashed border-[var(--color-border)] bg-[var(--color-muted)]/30 p-3 text-[11.5px]">
      <div className="mb-1 font-medium text-[var(--color-ink-faint)]">frontmatter</div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {entries.map(([k, v]) => (
          <div key={k} className="break-all"><span className="text-[var(--color-ink-faint)]">{k}:</span> <span className="text-[var(--color-ink)]">{Array.isArray(v) ? v.join(' · ') : v}</span></div>
        ))}
      </div>
    </div>
  )
}

function LinkGraph({selected, browse, onNavigate}: {selected: ObsidianNoteBrief; browse: NonNullable<ReturnType<typeof useObsidian>['browse']>; onNavigate: (path: string) => void}) {
  const graph = useMemo(() => {
    const forward = selected.links.map(t => resolveLink(browse, t)).filter((n): n is ObsidianNoteBrief => !!n)
    const back = browse.notes.filter(n => n.path !== selected.path && n.links.some(l => {
      const r = resolveLink(browse, l)
      return r?.path === selected.path
    }))
    const seen = new Set<string>([selected.path])
    const nodes = [selected, ...forward, ...back].filter(n => { if (seen.has(n.path) && n.path !== selected.path) return false; seen.add(n.path); return true })
    const links: {a: string; b: string; dir: 'out' | 'in'}[] = []
    for (const t of forward) links.push({a: selected.path, b: t.path, dir: 'out'})
    for (const b of back) links.push({a: b.path, b: selected.path, dir: 'in'})
    return {nodes, links}
  }, [selected, browse])

  if (graph.nodes.length < 2) {
    return <p className="mt-6 border-t border-[var(--color-border)] pt-4 text-[12px] text-[var(--color-ink-faint)]">这篇笔记还没有双向链接。</p>
  }

  const placed = graph.nodes.map((n, i) => {
    if (i === 0) return {node: n, x: 320, y: 170, r: 34, color: '#8a72da'}
    const angle = (i / (graph.nodes.length - 1)) * Math.PI * 2 - Math.PI / 2
    const radius = 120
    return {node: n, x: 320 + Math.cos(angle) * radius, y: 170 + Math.sin(angle) * radius, r: 22, color: graph.nodes[i]!.path === selected.path ? '#8a72da' : '#b6a8e0'}
  })
  const pos = new Map(placed.map(p => [p.node.path, p]))

  return (
    <div className="mt-6 border-t border-[var(--color-border)] pt-4">
      <div className="mb-2 flex items-center gap-2 text-[13px] font-medium text-[var(--color-ink)]"><GitBranch size={14}/> 双链图谱 <span className="text-[11px] font-normal text-[var(--color-ink-faint)]">{graph.links.length} 条关系</span></div>
      <div className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-muted)]/20 p-2">
        <svg viewBox="0 0 640 360" className="w-full" role="img" aria-label="双链图谱">
          {graph.links.map((l, i) => {
            const a = pos.get(l.a), b = pos.get(l.b)
            if (!a || !b) return null
            return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#8a72da" strokeOpacity=".45" strokeWidth="1.4" strokeDasharray={l.dir === 'in' ? '4 3' : undefined}/>
          })}
          {placed.map(p => (
            <g key={p.node.path} role="button" tabIndex={0} aria-label={`打开 ${p.node.displayTitle ?? p.node.title}`} onClick={() => onNavigate(p.node.path)} onKeyDown={(e) => {if (e.key === 'Enter') onNavigate(p.node.path)}} className="cursor-pointer">
              <circle cx={p.x} cy={p.y} r={p.r} fill={p.color}/>
              <text x={p.x} y={p.y + 4} textAnchor="middle" fill="white" fontSize="10">{p.node.title.slice(0, 9)}</text>
            </g>
          ))}
        </svg>
        <div className="mt-1 flex flex-wrap gap-3 px-1 text-[11px] text-[var(--color-ink-soft)]">
          <span><span className="mr-1 inline-block h-2 w-2 rounded-full align-middle" style={{background: '#8a72da'}}/>当前</span>
          <span><span className="mr-1 inline-block h-2 w-2 rounded-full align-middle" style={{background: '#b6a8e0'}}/>关联</span>
          <span className="ml-auto italic">实线=本篇引用 · 虚线=引用本篇 · 点节点跳转</span>
        </div>
      </div>
    </div>
  )
}

export function Memory() {
  useMemoryAutoRefresh()
  const {browse, notes, loading, error} = useObsidian()
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [folderFilter, setFolderFilter] = useState('all')
  const [sortBy, setSortBy] = useState<SortKey>('modified')
  const [filter, setFilter] = useState<FilterKey>('all')
  const [selectedTag, setSelectedTag] = useState<string | null>(null)

  useEffect(() => {
    if (!selectedPath || notes[selectedPath]) return
    loadMemoryNote(selectedPath).catch(() => {})
  }, [selectedPath, notes])

  const filteredNotes = useMemo(() => {
    if (!browse) return []
    const needle = q.trim().toLowerCase()
    const list = browse.notes.filter(n => {
      if (folderFilter !== 'all' && n.folder !== folderFilter) return false
      if (filter === 'linked' && !n.links.length) return false
      if (filter === 'recent' && n.modified < Date.now() - oneWeek) return false
      if (filter === 'with-tag' && !n.tags.length) return false
      if (selectedTag && !n.tags.includes(selectedTag)) return false
      if (needle) {
        const hay = `${n.title} ${n.displayTitle ?? ''} ${n.excerpt} ${n.tags.join(' ')} ${n.links.join(' ')}`.toLowerCase()
        if (!hay.includes(needle)) return false
      }
      return true
    })
    list.sort((a, b) => {
      if (sortBy === 'title') return (a.displayTitle ?? a.title).localeCompare(b.displayTitle ?? b.title, 'zh-CN')
      if (sortBy === 'folder') { const c = a.folder.localeCompare(b.folder, 'zh-CN'); if (c) return c }
      return b.modified - a.modified
    })
    return list
  }, [browse, q, folderFilter, sortBy, filter, selectedTag])

  const selected = selectedPath ? browse?.notes.find(n => n.path === selectedPath) ?? null : null
  const selectedDetail = selectedPath ? notes[selectedPath] : null

  const navigateToLink = (target: string) => {
    const target_note = resolveLink(browse, target)
    if (target_note) setSelectedPath(target_note.path)
    else toast.error(`未在当前仓库找到双链「${target}」`)
  }

  const stats = browse ? [
    {label: '笔记总数', value: browse.total, icon: FileText},
    {label: '近 7 天修改', value: browse.recent, icon: Clock},
    {label: '有双链', value: browse.linked, icon: Link2},
    {label: '标签', value: browse.tags.length, icon: Tag},
  ] : null

  return (
    <div className="mx-auto max-w-[1400px] px-5 py-5">
      <section className="romance-grad relative mb-5 overflow-hidden rounded-[20px] px-6 py-5 text-white shadow-[var(--shadow-float)]">
        <div className="pointer-events-none absolute inset-0 opacity-40" style={{backgroundImage: 'radial-gradient(600px 300px at 100% 0%, #ffffff55, transparent 60%), radial-gradient(400px 240px at 0% 100%, #ffffff33, transparent 60%)'}}/>
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-[11.5px] tracking-[0.18em] text-white/75">OBSIDIAN MEMORY</div>
            <h1 className="mt-1 text-[22px] leading-tight font-semibold">记忆看板 · {browse?.vaultName ?? '加载中…'}</h1>
            <p className="mt-1.5 max-w-[520px] text-[12.5px] leading-[1.7] text-white/85">
              只读浏览 iCloud 上的 Obsidian 仓库，本地不写、不触网、不修改 vault；已跳过 iCloud 未下载的占位文件。
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="border-white/40 bg-white/15 text-white hover:bg-white/25" onClick={() => {loadMemoryIndex(true).catch(() => {})}}>
              <RefreshCw size={14} className={cn(loading && 'animate-spin')}/> 重扫仓库
            </Button>
          </div>
        </div>
        {stats && (
          <div className="relative mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {stats.map(s => (
              <div key={s.label} className="flex items-center gap-2.5 rounded-[12px] border border-white/25 bg-white/12 px-3 py-2.5 backdrop-blur-sm">
                <s.icon size={16} className="shrink-0 text-white/80"/>
                <div className="min-w-0"><div className="text-[17px] leading-none font-semibold">{s.value}</div><div className="mt-0.5 truncate text-[11px] text-white/75">{s.label}</div></div>
              </div>
            ))}
          </div>
        )}
      </section>

      {error && (
        <Card className="mb-4 border-[var(--color-destructive)]/40 bg-[var(--color-destructive)]/5 p-4">
          <div className="font-medium text-[var(--color-destructive)]">Obsidian 仓库读取失败</div>
          <p className="mt-1 text-[12.5px] text-[var(--color-ink-soft)]">{error}</p>
          <p className="mt-1 text-[11.5px] text-[var(--color-ink-faint)]">请确认「第二大脑」仓库存在且 iCloud Drive 已同步；默认路径为 %USERPROFILE%\iCloudDrive\iCloud~md~obsidian\第二大脑，可用环境变量 JARVIS_OBSIDIAN_VAULT 覆盖。</p>
        </Card>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Tabs
          value={filter}
          onChange={v => setFilter(v as FilterKey)}
          items={[
            {value: 'all', label: '全部', count: browse?.total ?? 0},
            {value: 'linked', label: '已连双链', count: browse?.linked ?? 0},
            {value: 'recent', label: '近 7 天', count: browse?.recent ?? 0},
            {value: 'with-tag', label: '含标签', count: browse?.tags.length ?? 0},
          ]}
        />
        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-[var(--color-ink-faint)]"/>
            <Input value={q} onChange={e => setQ(e.target.value)} placeholder="搜索标题/正文/标签…" className="w-[240px] pl-8" aria-label="搜索 Obsidian 笔记"/>
          </div>
          <select value={sortBy} onChange={e => setSortBy(e.target.value as SortKey)} aria-label="排序方式" className="h-9 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-card)] px-2.5 text-[12.5px] text-[var(--color-ink)]">
            {Object.entries(sortLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(190px,240px)_minmax(0,1fr)_minmax(0,1.15fr)]">
        <aside className="flex flex-col gap-3">
          <Card>
            <CardHeader title="目录" desc={browse ? `${browse.folders.length} 个目录` : '加载中'}/>
            <div className="max-h-[260px] overflow-y-auto px-3 pb-3">
              <button onClick={() => setFolderFilter('all')} className={cn('mb-0.5 flex w-full items-center gap-2 rounded-[9px] px-2.5 py-1.5 text-left text-[12.5px] transition-colors', folderFilter === 'all' ? 'bg-[var(--color-ocean-soft)] font-medium text-[var(--color-ocean-deep)]' : 'text-[var(--color-ink-soft)] hover:bg-[var(--color-muted)]')}>
                <Folder size={13} className="shrink-0"/> 全部目录 <span className="ml-auto text-[11px] opacity-70">{browse?.total ?? 0}</span>
              </button>
              {browse?.folders.map(f => (
                <button key={f.name} onClick={() => setFolderFilter(folderFilter === f.name ? 'all' : f.name)} className={cn('mb-0.5 flex w-full items-center gap-2 rounded-[9px] px-2.5 py-1.5 text-left text-[12.5px] transition-colors', folderFilter === f.name ? 'bg-[var(--color-ocean-soft)] font-medium text-[var(--color-ocean-deep)]' : 'text-[var(--color-ink-soft)] hover:bg-[var(--color-muted)]')}>
                  <Folder size={13} className="shrink-0"/><span className="truncate">{f.name}</span><span className="ml-auto text-[11px] opacity-70">{f.count}</span>
                </button>
              ))}
            </div>
          </Card>
          <Card>
            <CardHeader title="标签" desc={selectedTag ? `筛选中：#${selectedTag}` : '点击标签筛选'}/>
            <div className="flex flex-wrap gap-1.5 px-3 pb-3">
              {browse && browse.tags.length === 0 && <p className="text-[11.5px] text-[var(--color-ink-faint)]">仓库里还没有标签</p>}
              {browse?.tags.map(t => (
                <button key={t.name} onClick={() => setSelectedTag(selectedTag === t.name ? null : t.name)} className={cn('rounded-full px-2.5 py-1 text-[11px] transition-colors', selectedTag === t.name ? 'bg-[var(--color-ocean-soft)] font-medium text-[var(--color-ocean-deep)]' : 'bg-[var(--color-muted)] text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]')}>
                  #{t.name}<span className="ml-1 opacity-60">{t.count}</span>
                </button>
              ))}
            </div>
          </Card>
          {selectedTag && <Button variant="ghost" size="sm" onClick={() => setSelectedTag(null)}><X size={12}/> 清除标签筛选</Button>}
        </aside>

        <Card className="flex min-h-[520px] flex-col p-0">
          <div className="flex shrink-0 items-center justify-between border-b border-[var(--color-border)] px-4 py-2.5">
            <div className="text-[13px] font-medium">笔记列表</div>
            <div className="text-[11.5px] text-[var(--color-ink-faint)]">{filteredNotes.length} / {browse?.total ?? 0}</div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {!browse ? (
              <p className="p-6 text-center text-[12.5px] text-[var(--color-ink-faint)]">{loading ? '正在扫描 vault…' : error ? '加载失败，请重试' : '等待加载…'}</p>
            ) : filteredNotes.length === 0 ? (
              <p className="p-6 text-center text-[12.5px] text-[var(--color-ink-faint)]">没有匹配的笔记</p>
            ) : (
              <div className="flex flex-col gap-1">
                {filteredNotes.map(n => (
                  <button key={n.path} onClick={() => setSelectedPath(n.path)} className={cn('w-full rounded-[11px] px-3 py-2.5 text-left transition-colors', selectedPath === n.path ? 'bg-[var(--color-ocean-soft)]' : 'hover:bg-[var(--color-muted)]')}>
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[13px] font-medium text-[var(--color-ink)]">{n.displayTitle ?? n.title}</span>
                      {n.links.length > 0 && <Badge tone="blue" className="shrink-0"><Link2 size={9}/> {n.links.length}</Badge>}
                      {n.tags.length > 0 && <Badge tone="purple" className="shrink-0"><Tag size={9}/> {n.tags.length}</Badge>}
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-[12px] leading-[1.6] text-[var(--color-ink-soft)]">{n.excerpt || '（空笔记）'}</p>
                    <div className="mt-1 text-[11px] text-[var(--color-ink-faint)]">{n.folder} · {timeAgo(n.modified)}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </Card>

        <Card className="flex min-h-[520px] flex-col p-0">
          {!selected ? (
            <div className="flex flex-1 items-center justify-center p-10 text-center text-[12.5px] text-[var(--color-ink-faint)]">{browse ? '从中间选一篇笔记开始阅读' : '请稍候…'}</div>
          ) : (
            <>
              <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--color-border)] px-5 py-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {selected.folder !== '(根目录)' && <Badge tone="neutral">{selected.folder}</Badge>}
                    {selected.tags.slice(0, 4).map(t => <Badge key={t} tone="purple">#{t}</Badge>)}
                  </div>
                  <h2 className="mt-2 text-[18px] font-semibold text-[var(--color-ink)]">{selected.displayTitle ?? selected.title}</h2>
                  <div className="mt-1 text-[11.5px] text-[var(--color-ink-faint)]"><Clock size={11} className="mr-0.5 inline"/>{timeAgo(selected.modified)} · {selected.size} 字节 · {selected.links.length} 条双链</div>
                </div>
                <Button variant="ghost" size="icon" aria-label="关闭详情" onClick={() => setSelectedPath(null)}><X size={14}/></Button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                <FrontmatterList data={selected.frontmatter}/>
                {!selectedDetail ? (
                  <p className="mt-6 text-center text-[12.5px] text-[var(--color-ink-faint)]">正在加载详情…</p>
                ) : selectedDetail.content.trim() ? (
                  <MarkdownPreview content={selectedDetail.content} onWiki={navigateToLink}/>
                ) : (
                  <p className="mt-6 text-center text-[12.5px] text-[var(--color-ink-faint)]">笔记正文为空</p>
                )}
                {browse && <LinkGraph selected={selected} browse={browse} onNavigate={setSelectedPath}/>}
              </div>
            </>
          )}
        </Card>
      </div>

      {browse && browse.notes.length > 0 && (
        <section className="mt-5">
          <div className="mb-2 flex items-center gap-2 text-[13px] font-medium text-[var(--color-ink)]"><Clock size={14}/> 最近修改</div>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {browse.notes.slice(0, 18).map(n => (
              <button key={n.path} onClick={() => setSelectedPath(n.path)} className={cn('min-w-[180px] shrink-0 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-left transition-colors hover:bg-[var(--color-muted)]', selectedPath === n.path && 'border-[var(--color-ocean)] bg-[var(--color-ocean-soft)]')}>
                <div className="truncate text-[12.5px] font-medium">{n.displayTitle ?? n.title}</div>
                <div className="mt-0.5 truncate text-[11px] text-[var(--color-ink-faint)]">{n.folder} · {timeAgo(n.modified)}</div>
              </button>
            ))}
          </div>
        </section>
      )}

      <p className="mt-4 text-right text-[11px] text-[var(--color-ink-faint)]">
        {error ? '仓库不可用' : loading ? '扫描中…' : browse ? `本地只读 · 上次扫描 ${new Date(browse.scannedAt).toLocaleString('zh-CN')} · 每 30 秒静默刷新` : '尚未加载'}
      </p>
    </div>
  )
}

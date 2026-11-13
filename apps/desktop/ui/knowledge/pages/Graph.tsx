import {useState} from 'react'
import {useNavigate} from 'react-router-dom'
import {createRelation, deleteRelation, useData} from '@/db/hooks'
import {Link2, Trash2} from 'lucide-react'
import {toast} from 'sonner'
import {Badge, Button, Card, CardBody, CardHeader, Input, Select} from '@/components/ui'
import type {Relation, RelationType} from '@/db/schema'
import {cn} from '@/lib/cn'

type Kind = Relation['fromType']
type Node = {id: string; kind: Kind; title: string; path: string; x: number; y: number}
const styles = {
  notebook: {label: '笔记本', fill: '#5b95e2'}, source: {label: '来源', fill: '#6aa2c9'},
  note: {label: '笔记', fill: '#8a72da'}, todo: {label: '待办', fill: '#e8a0b6'}, inspiration: {label: '灵感', fill: '#f096c2'},
}
const relationLabels = {mentions: '引用', derived_from: '派生', contradicts: '矛盾'}
const key = (n: {id: string; kind: Kind}) => `${n.kind}:${n.id}`

export function Graph() {
  const navigate = useNavigate()
  const snapshot = useData()
  const data = snapshot ? {nodes: [
    ...snapshot.notebooks.map(n => ({id: n.id, kind: 'notebook' as const, title: n.name, path: `/notebooks/${n.id}`})),
    ...snapshot.notes.map(n => ({id: n.id, kind: 'note' as const, title: n.title, path: `/notebooks/${n.notebookId}?note=${encodeURIComponent(n.id)}`})),
    ...snapshot.sources.map(n => ({id: n.id, kind: 'source' as const, title: n.title, path: `/sources?source=${encodeURIComponent(n.id)}`})),
    ...snapshot.todos.map(n => ({id: n.id, kind: 'todo' as const, title: n.title, path: '/todos'})),
    ...snapshot.inspirations.map(n => ({id: n.id, kind: 'inspiration' as const, title: n.title, path: '/inspirations'})),
  ], relations: snapshot.relations} : undefined
  const [filter, setFilter] = useState<Kind | 'all'>('all')
  const [q, setQ] = useState('')
  const [selectedKey, setSelectedKey] = useState('')
  const [targetKey, setTargetKey] = useState('')
  const [relationType, setRelationType] = useState<RelationType>('mentions')
  const [saving, setSaving] = useState(false)
  const nodes: Node[] = (data?.nodes ?? []).map((n, i, all) => {
    const angle = i * Math.PI * (3 - Math.sqrt(5))
    const radius = 50 + 300 * Math.sqrt(i / Math.max(1, all.length - 1))
    return {...n, x: 420 + Math.cos(angle) * radius, y: 270 + Math.sin(angle) * radius * .62}
  })
  const selected = nodes.find((n) => key(n) === selectedKey) ?? nodes[0]
  const visible = nodes.filter((n) => (filter === 'all' || n.kind === filter) && n.title.toLowerCase().includes(q.trim().toLowerCase()))
  const byKey = new Map(visible.map((n) => [key(n), n]))
  const related = (data?.relations ?? []).filter((r) => selected && ((r.fromId === selected.id && r.fromType === selected.kind) || (r.toId === selected.id && r.toType === selected.kind)))

  async function link() {
    const target = nodes.find((n) => key(n) === targetKey)
    if (!selected || !target || key(selected) === key(target) || saving) return
    setSaving(true)
    try {
      await createRelation({fromId: selected.id, fromType: selected.kind, toId: target.id, toType: target.kind, relationType})
      setTargetKey('')
      toast.success('关联已保存')
    } catch (e) { toast.error(e instanceof Error ? e.message : String(e)) }
    finally { setSaving(false) }
  }

  return <div className="flex h-full min-h-0 flex-col">
    <div className="flex shrink-0 flex-wrap items-center gap-3 border-b px-5 py-3">
      <div><h1 className="text-[16px] font-semibold">知识图谱</h1><p className="text-[11.5px] text-[var(--color-ink-soft)]">真实本地数据 · {nodes.length} 个节点 / {data?.relations.length ?? 0} 条关联 · 确定性散点布局</p></div>
      <div className="ml-auto flex flex-wrap gap-1">{(['all', ...Object.keys(styles)] as (Kind | 'all')[]).map((kind) => <button key={kind} onClick={() => setFilter(kind)} className={cn('rounded-full px-2.5 py-1 text-[12px]', filter === kind && 'bg-[var(--color-ocean-soft)]')}>{kind === 'all' ? '全部' : styles[kind].label}</button>)}</div>
    </div>
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row">
      <div className="min-h-[360px] min-w-0 flex-1">
        {visible.length ? <svg viewBox="0 0 840 540" className="h-full min-h-[360px] w-full" role="img" aria-label="本地知识图谱">
          {(data?.relations ?? []).map((r) => {
            const a = byKey.get(`${r.fromType}:${r.fromId}`), b = byKey.get(`${r.toType}:${r.toId}`)
            if (!a || !b) return null
            return <g key={r.id}><line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={r.relationType === 'contradicts' ? '#e05d5d' : '#8a72da'} strokeWidth="1.6" strokeOpacity=".6" strokeDasharray={r.relationType === 'derived_from' ? '5 4' : undefined}/><text x={(a.x+b.x)/2} y={(a.y+b.y)/2} fill="var(--color-ink-soft)" fontSize="9">{relationLabels[r.relationType]}</text></g>
          })}
          {visible.map((n) => <g key={key(n)} role="button" tabIndex={0} aria-label={`选择节点 ${n.title}`} onClick={() => setSelectedKey(key(n))} onKeyDown={(e) => {if (e.key === 'Enter' || e.key === ' ') {e.preventDefault(); setSelectedKey(key(n))}}} className="cursor-pointer">
            <circle cx={n.x} cy={n.y} r={selected && key(selected) === key(n) ? 26 : 20} fill={styles[n.kind].fill}/>
            <text x={n.x} y={n.y+4} textAnchor="middle" fill="white" fontSize="10">{styles[n.kind].label}</text>
            <text x={n.x} y={n.y+40} textAnchor="middle" fill="var(--color-ink-soft)" fontSize="10">{n.title.slice(0, 15)}{n.title.length > 15 ? '…' : ''}</text>
          </g>)}
        </svg> : <p className="p-10 text-center">没有匹配的节点；先创建笔记本、笔记或灵感。</p>}
      </div>
      <aside className="w-full shrink-0 space-y-3 border-l p-4 lg:w-[300px] lg:overflow-y-auto">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索节点…" aria-label="搜索图谱节点"/>
        {selected && <><Card><CardHeader title="节点详情" action={<Badge>{styles[selected.kind].label}</Badge>}/><CardBody><p>{selected.title}</p><p className="mt-2 text-[12px] text-[var(--color-ink-soft)]">关联数：{related.length}</p><Button className="mt-3" size="sm" onClick={() => navigate(selected.path)}>打开详情</Button></CardBody></Card>
        <Card><CardHeader title="建立关联" desc="选择起点节点 → 选择目标 → 保存"/><CardBody>
          <p className="mb-2 text-[12px]">起点：{selected.title}</p>
          <Select aria-label="目标节点" value={targetKey} onChange={(e) => setTargetKey(e.target.value)}><option value="">选择目标节点</option>{nodes.filter((n) => key(n) !== key(selected)).map((n) => <option key={key(n)} value={key(n)}>{styles[n.kind].label} · {n.title}</option>)}</Select>
          <Select className="mt-2" aria-label="关联类型" value={relationType} onChange={(e) => setRelationType(e.target.value as RelationType)}>{Object.entries(relationLabels).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</Select>
          <Button className="mt-3 w-full" size="sm" disabled={!targetKey || saving} onClick={link}><Link2 size={13}/>保存关联</Button>
        </CardBody></Card>
        {related.map((r) => <Card key={r.id} className="flex items-center gap-2 p-3 text-[12px]"><span className="min-w-0 flex-1">{relationLabels[r.relationType]}：{nodes.find((n) => n.id === r.fromId && n.kind === r.fromType)?.title} → {nodes.find((n) => n.id === r.toId && n.kind === r.toType)?.title}</span><Button size="icon" variant="ghost" aria-label={`删除关联 ${r.id}`} onClick={async () => {await deleteRelation(r.id); toast.success('已删除关联')}}><Trash2 size={12}/></Button></Card>)}</>}
      </aside>
    </div>
  </div>
}

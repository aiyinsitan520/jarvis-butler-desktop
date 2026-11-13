import {useEffect, useState} from 'react'
import {useNavigate, useSearchParams} from 'react-router-dom'
import {FileText, FileVideo, Globe, Music, Plus, Trash2, Upload} from 'lucide-react'
import {toast} from 'sonner'
import {Badge, Button, Card, Dialog, Field, Input, Select, Tabs, Textarea} from '@/components/ui'
import {createSource, deleteSource, deriveSource, updateRecord, useData, useNotebooks} from '@/db/hooks'
import type {Source} from '@/db/schema'

const typeMeta = {
  web: {icon: Globe, label: '网页', tone: 'teal' as const},
  pdf: {icon: FileText, label: 'PDF', tone: 'rose' as const},
  video: {icon: FileVideo, label: '视频', tone: 'purple' as const},
  file: {icon: Upload, label: '文本文件', tone: 'blue' as const},
  audio: {icon: Music, label: '音频', tone: 'amber' as const},
}

export function Sources() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const [tab, setTab] = useState<'all' | 'web' | 'file'>('all')
  const [q, setQ] = useState('')
  const [adding, setAdding] = useState(false)
  const [title, setTitle] = useState('')
  const [type, setType] = useState<Source['type']>('web')
  const [notebookId, setNotebookId] = useState(params.get('notebook') ?? '')
  const [url, setUrl] = useState('')
  const [content, setContent] = useState('')
  const [selectedId, setSelectedId] = useState(params.get('source') ?? '')
  const [saving, setSaving] = useState(false)
  const notebooks = useNotebooks()
  const all = useData()?.sources.slice().sort((a,b) => b.createdAt - a.createdAt)
  const selected = all?.find((s) => s.id === selectedId)
  useEffect(() => { if (selected) setContent(selected.content ?? '') }, [selected?.id])
  useEffect(() => { setSelectedId(params.get('source') ?? '') }, [params])
  const notebookName = (id: string) => notebooks?.find((n) => n.id === id)?.name ?? '未知笔记本'
  const list = (all ?? []).filter((s) => (tab === 'all' || (tab === 'web' ? s.type === 'web' : s.type !== 'web')) && s.title.toLowerCase().includes(q.trim().toLowerCase()))

  async function save() {
    if (saving) return
    const nb = notebookId || notebooks?.[0]?.id
    if (!nb || !title.trim()) { toast.error('请填写标题并选择笔记本'); return }
    setSaving(true)
    try {
      await createSource({notebookId: nb, title, type, url, content})
      setAdding(false); setTitle(''); setUrl(''); setContent('')
      toast.success('来源已保存到本机')
    } catch (e) { toast.error(e instanceof Error ? e.message : String(e)) }
    finally { setSaving(false) }
  }

  async function toNote() {
    if (!selected || saving) return
    setSaving(true)
    try {
      await deriveSource(selected.id)
      toast.success('已生成笔记并建立派生关联')
      navigate(`/notebooks/${selected.notebookId}`)
    } finally { setSaving(false) }
  }

  return <div className="mx-auto max-w-[1180px] px-6 py-6">
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="text-[20px] font-semibold">来源</h1><p className="mt-1 text-[12.5px] text-[var(--color-ink-soft)]">保存链接与摘录，或导入 TXT / Markdown 文本；PDF、视频、音频暂保存引用与手动摘录，不自动解析。</p></div>
      <Button onClick={() => {setTitle(''); setUrl(''); setContent(''); setAdding(true)}}><Plus size={15}/>添加来源</Button>
    </div>
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <Tabs value={tab} onChange={setTab} items={[{value:'all',label:'全部',count:all?.length ?? 0},{value:'web',label:'网页',count:all?.filter((s) => s.type === 'web').length ?? 0},{value:'file',label:'其他来源',count:all?.filter((s) => s.type !== 'web').length ?? 0}]}/>
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索来源…" aria-label="搜索来源" className="ml-auto max-w-[220px]"/>
    </div>
    {list.length === 0 ? <Card className="p-10 text-center">{all ? '没有匹配的来源，添加第一个吧' : '加载中…'}</Card> : <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {list.map((s) => {const meta = typeMeta[s.type]; return <Card key={s.id} glass className="group p-4">
        <div className="flex items-center justify-between"><meta.icon size={20}/><Badge tone={meta.tone}>{meta.label}</Badge></div>
        <button className="mt-3 text-left text-[14px] font-semibold hover:underline" onClick={() => setParams({source:s.id})}>{s.title}</button>
        <p className="mt-2 line-clamp-2 text-[12px] text-[var(--color-ink-soft)]">{s.content || s.url || '尚未添加正文摘录'}</p>
        <div className="mt-3 flex items-center justify-between text-[11px] text-[var(--color-ink-faint)]"><span>{notebookName(s.notebookId)} · {new Date(s.createdAt).toLocaleDateString('zh-CN')}</span><Button variant="ghost" size="icon" aria-label={`删除来源 ${s.title}`} onClick={async () => {if (confirm(`删除来源「${s.title}」？`)) {await deleteSource(s.id); toast.success('已删除来源')}}}><Trash2 size={13}/></Button></div>
      </Card>})}
    </div>}
    <Dialog open={adding} onClose={() => !saving && setAdding(false)} title="添加来源" desc="内容直接保存到指定磁盘目录；不会自动请求来源链接。" footer={<><Button variant="ghost" onClick={() => setAdding(false)} disabled={saving}>取消</Button><Button onClick={save} disabled={saving}>{saving ? '保存中…' : '添加'}</Button></>}>
      <div className="max-h-[60vh] space-y-3 overflow-y-auto">
        <Field label="标题"><Input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus/></Field>
        <Field label="类型"><Select value={type} onChange={(e) => setType(e.target.value as Source['type'])}>{Object.entries(typeMeta).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}</Select></Field>
        <Field label="归入笔记本"><Select value={notebookId || notebooks?.[0]?.id || ''} onChange={(e) => setNotebookId(e.target.value)}>{notebooks?.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}</Select></Field>
        <Field label="链接（可选）"><Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="HTTP(S) 链接"/></Field>
        <Field label="正文 / 摘录"><Textarea aria-label="来源摘录" value={content} onChange={(e) => setContent(e.target.value)} className="min-h-[140px]"/></Field>
        <Field label="导入文本文件（最大 5 MB）"><Input type="file" accept=".txt,.md,.markdown,.csv,.json" onChange={async (e) => {
          const file = e.target.files?.[0]; if (!file) return
          if (file.size > 5 * 1024 * 1024 || !/\.(txt|md|markdown|csv|json)$/i.test(file.name)) {toast.error('请选取 5 MB 以内的文本文件'); return}
          try {setContent(await file.text()); setTitle((old) => old || file.name); setType('file')} catch {toast.error('文件读取失败')}
        }}/></Field>
      </div>
    </Dialog>
    <Dialog open={!!selected} onClose={() => {setSelectedId(''); setParams({})}} title={selected?.title ?? '来源'} desc={selected ? notebookName(selected.notebookId) : ''} footer={<><Button variant="outline" onClick={() => {if (selected) navigate(`/notebooks/${selected.notebookId}`)}}>打开笔记本</Button><Button onClick={toNote} disabled={saving}>加入笔记</Button></>}>
      <div className="max-h-[60vh] space-y-3 overflow-y-auto">
        {selected?.url && /^https?:\/\//i.test(selected.url) && <a href={selected.url} target="_blank" rel="noopener noreferrer" className="break-all text-[var(--color-ocean)]">打开原链接</a>}
        <Textarea aria-label="来源正文" key={selected?.id} defaultValue={selected?.content ?? ''} placeholder="填写正文后点击保存摘录" onChange={(e) => setContent(e.target.value)}/>
        <Button size="sm" variant="outline" onClick={async () => {if (selected) {await updateRecord('sources', selected.id, {content}); toast.success('摘录已保存')}}}>保存摘录</Button>
      </div>
    </Dialog>
  </div>
}

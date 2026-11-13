import {useState} from 'react'
import './ModelPicker.css'
interface Props{models:string[];model:string;selected:string[];busy:boolean;fetching:boolean;onModel:(id:string)=>void;onToggle:(id:string)=>void;onFetch:()=>void}
export function ModelPicker({models,model,selected,busy,fetching,onModel,onToggle,onFetch}:Props){
 const [query,setQuery]=useState('')
 const options=[...new Set([...models,...selected,...(model?[model]:[])])]
 const filtered=options.filter(id=>id.toLowerCase().includes(query.trim().toLowerCase()))
 return <div className="jarvis-model-picker">
 <div className="jarvis-model-toolbar"><label>默认模型<input aria-label="默认模型" value={model} disabled={busy} placeholder="拉取后点击模型，也可直接填写模型 ID" onChange={e=>onModel(e.target.value)}/></label><button type="button" disabled={busy} onClick={onFetch}>{fetching?'正在拉取…':models.length?'刷新模型列表':'一键拉取模型'}</button></div>
 {options.length>0?<><div className="jarvis-model-search"><input type="search" aria-label="搜索模型" placeholder="搜索名称，例如 deepseek、claude、qwen…" value={query} onChange={e=>setQuery(e.target.value)}/><small>{filtered.length} / {options.length} 个模型</small></div>
 <div className="jarvis-model-list" role="group" aria-label="模型列表">{filtered.map(id=><div className={`jarvis-model-row ${model===id?'is-default':''}`} key={id}><button type="button" className="jarvis-model-choice" disabled={busy} aria-label={`设为默认模型 ${id}`} aria-pressed={model===id} onClick={()=>onModel(id)}><span>{id}</span>{model===id&&<small>默认</small>}</button><label title="勾选后可在助手侧栏快速切换"><input type="checkbox" aria-label={`助手可切换 ${id}`} checked={id===model||selected.includes(id)} disabled={busy||id===model} onChange={()=>onToggle(id)}/><span>侧栏可选</span></label></div>)}</div>
 {!filtered.length&&<p>没有匹配的模型。可以清空搜索，或手动填写模型 ID。</p>}<p className="jarvis-model-hint">点击名称设为默认；勾选“侧栏可选”后可在对话中切换。无需按住 Ctrl，最后点击“保存模型”生效。</p></>:<p>填写接口地址和 API Key 后，一键获取模型。Ollama 通常无需 API Key。拉取只读取模型目录，不发送笔记或调用推理。</p>}
 </div>
}

import {useEffect, useState} from 'react'
import {loadConfig} from '@/ai/providers'
import {useStorage} from '@/db/store'
import {cn} from '@/lib/cn'

export type ModelState = 'offline' | 'local' | 'remote' | 'configured'

const labels: Record<ModelState, string> = {
  configured: '模型已配置（非连接检测）',
  offline: '仅本地模式',
  local: '本地模型已接入',
  remote: '远端模型已接入',
}

const dots: Record<ModelState, string> = {
  configured: 'bg-[var(--color-ocean)]',
  offline: 'bg-[var(--color-ink-faint)]',
  local: 'bg-[#5fbf9b]',
  remote: 'bg-[var(--color-ocean)]',
}

export function ModelStatus({
  state,
  detail,
  className,
}: {
  state?: ModelState
  detail?: string
  className?: string
}) {
  const {remote} = useStorage()
  const [configured, setConfigured] = useState(() => !!loadConfig())
  useEffect(() => {
    const update = () => setConfigured(!!loadConfig())
    window.addEventListener('jarvis-ai-change', update)
    window.addEventListener('storage', update)
    return () => {window.removeEventListener('jarvis-ai-change', update); window.removeEventListener('storage', update)}
  }, [])
  state ??= configured ? 'configured' : 'offline'
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-card)]/70 px-2.5 py-1 text-[11.5px] text-[var(--color-ink-soft)]',
        className,
      )}
      title={remote ? '私网远程入口暂未启用 AI' : detail ?? labels[state]}
    >
      <span className={cn('inline-block h-1.5 w-1.5 rounded-full', dots[state])} />
      {remote ? '远程 AI 未启用' : labels[state]}
    </span>
  )
}

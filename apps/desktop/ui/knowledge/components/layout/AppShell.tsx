import {useEffect, useState} from 'react'
import {Outlet} from 'react-router-dom'
import {Sidebar} from './Sidebar'
import {TopBar} from './TopBar'
import {AssistantPanel, AssistantProvider} from '@/components/Assistant'

const COLLAPSE_KEY = 'jarvis.sidebar.collapsed'

export function AppShell() {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSE_KEY) === '1')
  const [compact, setCompact] = useState(() => window.matchMedia('(max-width: 767px)').matches)

  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)')
    const update = () => setCompact(media.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  const toggle = () => {
    setCollapsed((c) => {
      localStorage.setItem(COLLAPSE_KEY, c ? '0' : '1')
      return !c
    })
  }

  return (
    <AssistantProvider>
    <div className="ambiance flex h-full overflow-hidden">
      <Sidebar collapsed={collapsed || compact} compact={compact} onToggle={toggle} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="min-h-0 flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
      <AssistantPanel />
    </div>
    </AssistantProvider>
  )
}

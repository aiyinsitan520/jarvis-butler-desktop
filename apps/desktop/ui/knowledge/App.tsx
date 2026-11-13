import {useEffect} from 'react'
import {HashRouter, Navigate, Route, Routes} from 'react-router-dom'
import {Toaster, toast} from 'sonner'
import {AppShell} from '@/components/layout/AppShell'
import {ThemeProvider, useTheme} from '@/hooks/useTheme'
import {Workbench} from '@/pages/Workbench'
import {Notebooks} from '@/pages/Notebooks'
import {NotebookDetail} from '@/pages/NotebookDetail'
import {Graph} from '@/pages/Graph'
import {Sources} from '@/pages/Sources'
import {Todos} from '@/pages/Todos'
import {Inspirations} from '@/pages/Inspirations'
import {Memory} from '@/pages/Memory'
import {Inbox} from '@/pages/Inbox'
import {Settings} from '@/pages/Settings'
import {DataSync} from '@/pages/DataSync'
import {refreshStorage, useStorage} from '@/db/store'

function ThemedToaster() {
  const {mode} = useTheme()
  return (
    <Toaster
      position="bottom-right"
      theme={mode}
      toastOptions={{
        style: {
          borderRadius: '12px',
          fontSize: '12.5px',
          border: '1px solid var(--color-border)',
          background: 'var(--color-popover)',
          color: 'var(--color-ink)',
        },
      }}
    />
  )
}

function DiskGate({children}: {children: React.ReactNode}) {
  const {ready, error} = useStorage()
  useEffect(() => {
    const refresh = () => {void refreshStorage().catch(() => {})}
    refresh()
    const timer = window.setInterval(() => {if (!document.hidden) refresh()}, 5000)
    window.addEventListener('focus', refresh)
    return () => {clearInterval(timer); window.removeEventListener('focus', refresh)}
  }, [])
  if (!ready) return <div className="p-8"><p role={error ? 'alert' : 'status'}>{error ? `数据服务未连接：${error}。未回退浏览器存储，请勿清除旧数据。` : '正在连接数据服务…'}</p>{error && <button className="mt-4 underline" onClick={() => {void refreshStorage().catch(() => {})}}>重试连接</button>}</div>
  return <>{error && <div role="alert" className="fixed right-4 bottom-4 z-50 max-w-md rounded-xl border bg-[var(--color-card)] p-3 text-[var(--color-destructive)]">数据连接异常，显示的是上次读取的数据：{error}</div>}{children}</>
}

export function App() {
  useEffect(() => {
    const onFailure = (event: PromiseRejectionEvent) => {
      toast.error(`操作未完成，内容未清空：${event.reason instanceof Error ? event.reason.message : String(event.reason)}`)
    }
    window.addEventListener('unhandledrejection', onFailure)
    return () => window.removeEventListener('unhandledrejection', onFailure)
  }, [])

  return (
    <ThemeProvider>
      <HashRouter>
        <DiskGate>
          <Routes>
            <Route element={<AppShell />}>
              <Route index element={<Workbench />} />
              <Route path="notebooks" element={<Notebooks />} />
              <Route path="notebooks/:id" element={<NotebookDetail />} />
              <Route path="sources" element={<Sources />} />
              <Route path="graph" element={<Graph />} />
              <Route path="todos" element={<Todos />} />
              <Route path="inspirations" element={<Inspirations />} />
              <Route path="memory" element={<Memory />} />
              <Route path="settings" element={<Settings />} />
              <Route path="sync" element={<DataSync />} />
              <Route path="inbox" element={<Inbox />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </DiskGate>
      </HashRouter>
      <ThemedToaster />
    </ThemeProvider>
  )
}

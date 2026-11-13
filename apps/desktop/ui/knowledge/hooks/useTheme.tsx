import {api} from '../../lib/api'
import {listen} from '@tauri-apps/api/event'
import {createContext, useCallback, useContext, useEffect, useState, type ReactNode} from 'react'

type Theme = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'jarvis.theme'

function resolve(theme: Theme): 'light' | 'dark' {
  if (theme !== 'system') return theme
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function apply(theme: Theme) {
  const mode = resolve(theme)
  document.documentElement.classList.toggle('dark', mode === 'dark')
  document.documentElement.dataset.mode = mode
}

const ThemeContext = createContext<{
  theme: Theme
  mode: 'light' | 'dark'
  setTheme: (t: Theme) => void
}>({theme: 'system', mode: 'light', setTheme: () => {}})

export function ThemeProvider({children}: {children: ReactNode}) {
  const [theme, setThemeState] = useState<Theme>(
    () => (localStorage.getItem(STORAGE_KEY) as Theme | null) ?? 'system',
  )
  const [mode, setMode] = useState<'light' | 'dark'>(() => resolve(theme))

  useEffect(() => {
    apply(theme)
    setMode(resolve(theme))
    if (theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      apply('system')
      setMode(resolve('system'))
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [theme])

  useEffect(() => { void api.getSettings().then(s=>setThemeState(s.theme));const u=listen<{theme:Theme}>('settings-changed',e=>setThemeState(e.payload.theme));return()=>{void u.then(f=>f())}},[])

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t)
    localStorage.setItem(STORAGE_KEY, t)
    void api.getSettings().then(s=>api.saveSettings({...s,theme:t})).catch(()=>{})
  }, [])

  return <ThemeContext.Provider value={{theme, mode, setTheme}}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  return useContext(ThemeContext)
}

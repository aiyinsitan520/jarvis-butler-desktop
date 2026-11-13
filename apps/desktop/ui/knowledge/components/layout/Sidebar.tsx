import {NavLink} from 'react-router-dom'
import {
  BookOpen,
  Brain,
  CheckSquare,
  FolderOpen,
  LayoutDashboard,
  Lightbulb,
  PanelLeftClose,
  Settings,
  Share2,
} from 'lucide-react'
import {cn} from '@/lib/cn'
import {Badge, ModelStatus} from '@/components/ui'
import {useStorage} from '@/db/store'

const groups = [
  {
    label: '收束',
    items: [{to: '/', label: '工作台', icon: LayoutDashboard}, {to:'/inbox', label:'收件箱', icon:FolderOpen}],
  },
  {
    label: '收集与整理',
    items: [
      {to: '/notebooks', label: '笔记本', icon: BookOpen},
      {to: '/sources', label: '来源', icon: FolderOpen},
      {to: '/graph', label: '知识图谱', icon: Share2},
      {to: '/memory', label: '记忆看板', icon: Brain},
    ],
  },
  {
    label: '日常',
    items: [
      {to: '/todos', label: '待办', icon: CheckSquare},
      {to: '/inspirations', label: '灵感', icon: Lightbulb},
      {to: '/sync', label: '数据同步', icon: Share2},
    ],
  },
]

export function Sidebar({
  collapsed,
  compact = false,
  onToggle,
}: {
  collapsed: boolean
  compact?: boolean
  onToggle: () => void
}) {
  const {remote, view} = useStorage()
  return (
    <aside
      className={cn(
        'flex h-full shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-card)]/45 backdrop-blur-xl transition-[width] duration-200',
        collapsed ? 'w-[68px]' : 'w-[232px]',
      )}
    >
      <div className="flex h-[58px] items-center gap-2 px-4">
        {(!collapsed || compact) && <img src="/logo.svg" alt="" className="h-7 w-7 shrink-0" aria-hidden="true" />}
        {!collapsed && (
          <div className="min-w-0">
            <div className="truncate text-[14px] leading-tight font-semibold text-[var(--color-ink)]">
              贾维喵管家
            </div>
            <div className="text-[10.5px] tracking-wide text-[var(--color-ink-faint)]">
              JARVIS BUTLER
            </div>
          </div>
        )}
        {!compact && <button
          onClick={onToggle}
          aria-label={collapsed ? '展开侧栏' : '收起侧栏'}
          className={cn(
            'ml-auto rounded-lg p-1.5 text-[var(--color-ink-faint)] transition-colors hover:bg-[var(--color-muted)] hover:text-[var(--color-ink)]',
            collapsed && 'mx-auto ml-0',
          )}
        >
          <PanelLeftClose size={16} className={cn(collapsed && 'rotate-180')} />
        </button>}
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-2.5 pb-2">
        {groups.map((group) => (
          <div key={group.label} className="mb-4">
            {!collapsed && (
              <div className="mb-1.5 px-2 text-[10.5px] font-medium tracking-wider text-[var(--color-ink-faint)]">
                {group.label}
              </div>
            )}
            <div className="flex flex-col gap-0.5">
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  title={collapsed ? item.label : undefined}
                  className={({isActive}) =>
                    cn(
                      'flex items-center gap-2.5 rounded-[11px] px-2.5 py-2 text-[13px] transition-colors',
                      collapsed && 'justify-center px-0',
                      isActive
                        ? 'bg-[var(--color-ocean-soft)] font-medium text-[var(--color-ocean-deep)]'
                        : 'text-[var(--color-ink-soft)] hover:bg-[var(--color-muted)] hover:text-[var(--color-ink)]',
                    )
                  }
                >
                  <item.icon size={16} className="shrink-0" />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-[var(--color-border)] p-2.5">
        {!collapsed && (
          <div className="mb-2 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-tint-lavender)]/60 px-3 py-2">
            <div className="mb-1 flex items-center gap-1.5 text-[12px] font-medium text-[var(--color-ink)]">
              <span aria-hidden="true">📁</span>
              {remote ? '私网远程访问' : view?.online ? '共享资料已连接' : '本地存储'}
            </div>
            <div className="text-[11px] leading-[1.55] text-[var(--color-ink-soft)]">
              {remote ? '依赖 Windows 在线 · 不支持离线保存' : view?.online ? '共享主数据 · 本机投影缓存' : '磁盘文件 · 仅本机服务'}
            </div>
          </div>
        )}
        <div className={cn('flex items-center gap-1.5', collapsed && 'flex-col')}>
          <NavLink
            to="/settings"
            title="设置"
            className={({isActive}) =>
              cn(
                'flex items-center gap-2 rounded-[11px] px-2.5 py-2 text-[12.5px] transition-colors',
                collapsed ? 'justify-center px-0' : 'flex-1',
                isActive
                  ? 'bg-[var(--color-ocean-soft)] text-[var(--color-ocean-deep)]'
                  : 'text-[var(--color-ink-soft)] hover:bg-[var(--color-muted)] hover:text-[var(--color-ink)]',
              )
            }
          >
            <Settings size={16} className="shrink-0" />
            {!collapsed && <span>设置</span>}
          </NavLink>
          {!collapsed && (
            <Badge tone="blue" className="shrink-0">
              v0.3
            </Badge>
          )}
        </div>
        {!collapsed && (
          <div className="mt-2 flex justify-center">
            <ModelStatus />
          </div>
        )}
      </div>
    </aside>
  )
}

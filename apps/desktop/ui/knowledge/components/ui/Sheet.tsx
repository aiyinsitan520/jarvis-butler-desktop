import {useEffect, type ReactNode} from 'react'
import {X} from 'lucide-react'
import {cn} from '@/lib/cn'

export function Sheet({
  open,
  onClose,
  title,
  desc,
  children,
  footer,
  width = 380,
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  desc?: ReactNode
  children: ReactNode
  footer?: ReactNode
  width?: number
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <div
      className={cn('fixed inset-0 z-40 transition-opacity', open ? 'visible' : 'invisible')}
      aria-hidden={!open}
    >
      <div
        className={cn(
          'absolute inset-0 bg-[#1a1428]/25 backdrop-blur-[1px] transition-opacity duration-200',
          open ? 'opacity-100' : 'opacity-0',
        )}
        onClick={onClose}
      />
      <aside
        className={cn(
          'absolute top-0 right-0 flex h-full flex-col border-l border-[var(--color-border)] bg-[var(--color-card)] shadow-[var(--shadow-drawer)] transition-transform duration-250 ease-out',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
        style={{width}}
      >
        <header className="flex items-start justify-between gap-3 border-b border-[var(--color-border)] px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-[14px] font-semibold text-[var(--color-ink)]">{title}</h2>
            {desc && <p className="mt-0.5 text-[11.5px] text-[var(--color-ink-soft)]">{desc}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="收起面板"
            className="rounded-lg p-1 text-[var(--color-ink-faint)] transition-colors hover:bg-[var(--color-muted)] hover:text-[var(--color-ink)]"
          >
            <X size={16} />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        {footer && <div className="border-t border-[var(--color-border)] p-3">{footer}</div>}
      </aside>
    </div>
  )
}

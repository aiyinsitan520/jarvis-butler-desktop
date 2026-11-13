import {useEffect, type ReactNode} from 'react'
import {X} from 'lucide-react'
import {cn} from '@/lib/cn'

export function Dialog({
  open,
  onClose,
  title,
  desc,
  children,
  footer,
  className,
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  desc?: ReactNode
  children?: ReactNode
  footer?: ReactNode
  className?: string
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-[#1a1428]/35 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'relative w-full max-w-[440px] overflow-hidden rounded-[20px] border border-[var(--color-border)] bg-[var(--color-popover)] shadow-[var(--shadow-float)]',
          className,
        )}
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-4">
          <div>
            <h2 className="text-[15px] font-semibold text-[var(--color-ink)]">{title}</h2>
            {desc && <p className="mt-1 text-[12px] text-[var(--color-ink-soft)]">{desc}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="关闭"
            className="rounded-lg p-1 text-[var(--color-ink-faint)] transition-colors hover:bg-[var(--color-muted)] hover:text-[var(--color-ink)]"
          >
            <X size={16} />
          </button>
        </div>
        {children && <div className="px-5 py-4">{children}</div>}
        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-[var(--color-border)] px-5 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

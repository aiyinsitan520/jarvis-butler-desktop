import type {ReactNode} from 'react'
import {cn} from '@/lib/cn'

export function ListItem({
  icon,
  title,
  meta,
  trailing,
  active = false,
  onClick,
  className,
}: {
  icon?: ReactNode
  title: ReactNode
  meta?: ReactNode
  trailing?: ReactNode
  active?: boolean
  onClick?: () => void
  className?: string
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex w-full cursor-pointer items-center gap-2.5 rounded-[12px] px-2.5 py-2 text-left transition-colors',
        active
          ? 'bg-[var(--color-ocean-soft)] text-[var(--color-ocean-deep)]'
          : 'text-[var(--color-ink)] hover:bg-[var(--color-muted)]',
        className,
      )}
    >
      {icon && (
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] bg-[var(--color-muted)] text-[var(--color-ink-soft)]">
          {icon}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium">{title}</span>
        {meta && (
          <span className="mt-0.5 block truncate text-[11.5px] text-[var(--color-ink-faint)]">
            {meta}
          </span>
        )}
      </span>
      {trailing}
    </button>
  )
}

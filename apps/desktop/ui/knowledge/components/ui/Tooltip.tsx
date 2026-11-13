import type {ReactNode} from 'react'
import {cn} from '@/lib/cn'

export function Tooltip({
  label,
  side = 'top',
  children,
  className,
}: {
  label: ReactNode
  side?: 'top' | 'bottom'
  children: ReactNode
  className?: string
}) {
  return (
    <span className={cn('group/tt relative inline-flex', className)}>
      {children}
      <span
        role="tooltip"
        className={cn(
          'pointer-events-none absolute left-1/2 z-30 -translate-x-1/2 rounded-lg bg-[var(--color-ink)] px-2 py-1 text-[11px] whitespace-nowrap text-[var(--color-background)] opacity-0 shadow-[var(--shadow-card)] transition-opacity duration-150 group-hover/tt:opacity-100',
          side === 'top' ? 'bottom-full mb-1.5' : 'top-full mt-1.5',
        )}
      >
        {label}
      </span>
    </span>
  )
}

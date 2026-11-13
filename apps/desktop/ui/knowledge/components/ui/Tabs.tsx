import type {ReactNode} from 'react'
import {cn} from '@/lib/cn'

export function Tabs<T extends string>({
  items,
  value,
  onChange,
  className,
}: {
  items: {value: T; label: ReactNode; count?: number}[]
  value: T
  onChange: (v: T) => void
  className?: string
}) {
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)} role="tablist">
      {items.map((item) => {
        const active = item.value === value
        return (
          <button
            key={item.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.value)}
            className={cn(
              'inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12.5px] font-medium transition-all',
              active
                ? 'romance-grad text-white shadow-[0_2px_10px_rgba(122,102,214,.25)]'
                : 'bg-[var(--color-card)] text-[var(--color-ink-soft)] hover:text-[var(--color-ink)] shadow-[var(--shadow-card)]',
            )}
          >
            {item.label}
            {typeof item.count === 'number' && (
              <span
                className={cn(
                  'rounded-full px-1.5 text-[11px]',
                  active ? 'bg-white/25' : 'bg-[var(--color-muted)] text-[var(--color-ink-faint)]',
                )}
              >
                {item.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

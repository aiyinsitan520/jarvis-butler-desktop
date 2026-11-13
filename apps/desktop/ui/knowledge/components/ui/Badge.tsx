import type {ReactNode} from 'react'
import {cn} from '@/lib/cn'

export type BadgeTone = 'blue' | 'teal' | 'amber' | 'rose' | 'purple' | 'neutral'

const tones: Record<BadgeTone, string> = {
  blue: 'bg-[var(--color-tag-blue)] text-[var(--color-tag-blue-text)]',
  teal: 'bg-[var(--color-tag-teal)] text-[var(--color-tag-teal-text)]',
  amber: 'bg-[var(--color-tag-amber)] text-[var(--color-tag-amber-text)]',
  rose: 'bg-[var(--color-tag-rose)] text-[var(--color-tag-rose-text)]',
  purple: 'bg-[var(--color-tag-purple)] text-[var(--color-tag-purple-text)]',
  neutral: 'bg-[var(--color-muted)] text-[var(--color-ink-soft)]',
}

export function Badge({
  tone = 'neutral',
  className,
  children,
}: {
  tone?: BadgeTone
  className?: string
  children: ReactNode
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

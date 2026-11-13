import type {ReactNode} from 'react'
import {cn} from '@/lib/cn'

export function EmptyState({
  icon,
  title,
  desc,
  action,
  className,
}: {
  icon?: ReactNode
  title: ReactNode
  desc?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-[20px] border border-[var(--color-border)] bg-[var(--color-card)] px-10 py-12 text-center shadow-[var(--shadow-card)]',
        className,
      )}
    >
      {icon && <div className="mb-3 text-[36px] leading-none opacity-70">{icon}</div>}
      <h3 className="text-[16px] font-semibold text-[var(--color-ink)]">{title}</h3>
      {desc && (
        <p className="mt-2 max-w-[360px] text-[13px] leading-[1.7] text-[var(--color-ink-soft)]">
          {desc}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

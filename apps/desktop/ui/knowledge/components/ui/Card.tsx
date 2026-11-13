import type {HTMLAttributes, ReactNode} from 'react'
import {cn} from '@/lib/cn'

type CardProps = HTMLAttributes<HTMLDivElement> & {
  glass?: boolean
  children?: ReactNode
}

export function Card({glass = false, className, children, ...props}: CardProps) {
  return (
    <div
      className={cn(
        'rounded-[14px] border border-[var(--color-border)]',
        glass
          ? 'bg-[var(--color-card)]/60 shadow-[var(--shadow-card)] backdrop-blur-xl backdrop-saturate-150'
          : 'bg-[var(--color-card)] shadow-[var(--shadow-card)]',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export function CardHeader({
  title,
  desc,
  action,
  className,
}: {
  title: ReactNode
  desc?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex items-start justify-between gap-3 px-5 pt-4 pb-3', className)}>
      <div className="min-w-0">
        <div className="text-[14px] font-semibold text-[var(--color-ink)]">{title}</div>
        {desc && <div className="mt-0.5 text-[12px] text-[var(--color-ink-soft)]">{desc}</div>}
      </div>
      {action}
    </div>
  )
}

export function CardBody({
  className,
  children,
}: {
  className?: string
  children?: ReactNode
}) {
  return <div className={cn('px-5 pb-4', className)}>{children}</div>
}

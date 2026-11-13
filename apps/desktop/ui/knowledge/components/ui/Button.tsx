import type {ButtonHTMLAttributes, ReactNode} from 'react'
import {cn} from '@/lib/cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'destructive'
type Size = 'sm' | 'md' | 'lg' | 'icon'

const variants: Record<Variant, string> = {
  primary:
    'romance-grad text-white shadow-[0_1px_2px_rgba(0,0,0,.05),0_4px_16px_rgba(59,47,110,.18)] hover:brightness-[1.06] active:brightness-95',
  secondary:
    'bg-[var(--color-ocean-soft)] text-[var(--color-ocean-deep)] hover:brightness-[0.97] border border-transparent',
  ghost:
    'text-[var(--color-ink-soft)] hover:bg-[var(--color-ocean-soft)] hover:text-[var(--color-ocean-deep)]',
  outline:
    'border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-ink)] hover:bg-[var(--color-muted)]',
  destructive:
    'bg-[var(--color-destructive)] text-white hover:brightness-[1.06]',
}

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-[12px] gap-1.5 rounded-[10px]',
  md: 'h-9 px-3.5 text-[13px] gap-2 rounded-[12px]',
  lg: 'h-11 px-5 text-[14px] gap-2 rounded-[14px]',
  icon: 'h-9 w-9 rounded-[12px] justify-center',
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  size?: Size
  children?: ReactNode
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex shrink-0 cursor-pointer items-center justify-center font-medium transition-all duration-150 select-none disabled:pointer-events-none disabled:opacity-50',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}

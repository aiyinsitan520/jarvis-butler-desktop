import type {
  InputHTMLAttributes,
  ReactNode,
  Ref,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react'
import {cn} from '@/lib/cn'

const fieldBase =
  'w-full rounded-[12px] border border-[var(--color-input)] bg-[var(--color-card)] px-3 text-[13px] text-[var(--color-ink)] outline-none transition-colors placeholder:text-[var(--color-ink-faint)] focus:border-[var(--color-ring)]'

export function Input({className, ...props}: InputHTMLAttributes<HTMLInputElement> & {ref?: Ref<HTMLInputElement>}) {
  return <input className={cn(fieldBase, 'h-9', className)} {...props} />
}

export function Textarea({className, ...props}: TextareaHTMLAttributes<HTMLTextAreaElement> & {ref?: Ref<HTMLTextAreaElement>}) {
  return (
    <textarea
      className={cn(fieldBase, 'min-h-[84px] resize-y py-2 leading-[1.7]', className)}
      {...props}
    />
  )
}

export function Select({className, children, ...props}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(fieldBase, 'h-9 cursor-pointer', className)} {...props}>
      {children}
    </select>
  )
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] font-medium text-[var(--color-ink-soft)]">
        {label}
      </span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-[var(--color-ink-faint)]">{hint}</span>}
    </label>
  )
}

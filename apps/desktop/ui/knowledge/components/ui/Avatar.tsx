import {UserRound} from 'lucide-react'
import {cn} from '@/lib/cn'

export function Avatar({
  name,
  size = 32,
  className,
}: {
  name: string
  size?: number
  className?: string
}) {
  const initial = name.trim().slice(0, 1).toUpperCase()
  return (
    <span
      className={cn(
        'romance-grad inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white',
        className,
      )}
      style={{width: size, height: size, fontSize: size * 0.42}}
      title={name}
      aria-label={name}
    >
      {initial || <UserRound size={size * 0.5} />}
    </span>
  )
}

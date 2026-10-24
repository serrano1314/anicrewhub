import { useState } from 'react'
import { cn } from '../lib/ui'
import type { AvatarId } from '../types/auth'

const SIZE_CLASS = {
  sm: 'h-7 w-7 text-[11px]',
  md: 'h-12 w-12 text-sm',
  lg: 'h-20 w-20 text-xl',
} as const

type ProfileAvatarProps = {
  username?: string
  avatarId?: AvatarId | null
  avatarUrl?: string | null
  size?: keyof typeof SIZE_CLASS
  className?: string
}

export function userInitials(username: string | undefined): string {
  const trimmed = username?.trim() ?? ''
  if (!trimmed) {
    return '?'
  }
  return trimmed.slice(0, 2).toUpperCase()
}

export function ProfileAvatar({
  username,
  avatarUrl = null,
  size = 'md',
  className,
}: ProfileAvatarProps) {
  const initials = userInitials(username)

  if (avatarUrl) {
    return (
      <AvatarImage
        src={avatarUrl}
        fallback={initials}
        className={cn(SIZE_CLASS[size], className)}
      />
    )
  }

  return <InitialAvatar initials={initials} className={cn(SIZE_CLASS[size], className)} />
}

function InitialAvatar({ initials, className }: { initials: string; className?: string }) {
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400/30 to-violet-500/20 font-semibold text-indigo-100 ring-1 ring-white/10',
        className,
      )}
      aria-hidden={true}
    >
      {initials}
    </span>
  )
}

function AvatarImage({ src, fallback, className }: { src: string; fallback: string; className?: string }) {
  const [imageFailed, setImageFailed] = useState(false)

  if (imageFailed) {
    return <InitialAvatar initials={fallback} className={className} />
  }

  return (
    <img
      src={src}
      alt=""
      onError={() => setImageFailed(true)}
      className={cn('shrink-0 rounded-full object-cover ring-1 ring-white/10', className)}
    />
  )
}

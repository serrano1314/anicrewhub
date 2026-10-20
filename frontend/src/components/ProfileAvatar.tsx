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
  avatarId = null,
  size = 'md',
  className,
}: ProfileAvatarProps) {
  const initials = userInitials(username)

  if (avatarId) {
    return (
      <PresetAvatarArt key={avatarId} avatarId={avatarId} className={cn(SIZE_CLASS[size], className)} />
    )
  }

  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400/30 to-violet-500/20 font-semibold text-indigo-100 ring-1 ring-white/10',
        SIZE_CLASS[size],
        className,
      )}
      aria-hidden={true}
    >
      {initials}
    </span>
  )
}

export function PresetAvatarArt({ avatarId, className }: { avatarId: AvatarId; className?: string }) {
  const [imageFailed, setImageFailed] = useState(false)

  if (imageFailed) {
    return (
      <span
        aria-hidden="true"
        className={cn(
          'flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400/30 to-violet-950 text-xs font-semibold text-white ring-1 ring-white/10',
          className,
        )}
      >
        {avatarId}
      </span>
    )
  }

  return (
    <img
      src={`/avatars/${avatarId}.png`}
      alt=""
      onError={() => setImageFailed(true)}
      className={cn('shrink-0 rounded-full object-cover ring-1 ring-white/10', className)}
    />
  )
}

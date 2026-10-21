import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { ApiError } from '../api/client'
import { approveFollowRequest, followUser, rejectFollowRequest, unfollowUser } from '../api/sharing'
import { cn } from '../lib/ui'
import type { FollowState } from '../types/sharing'

type FollowTarget = {
  username: string
  is_self: boolean
  profile_public: boolean
  follow_state: FollowState | null
  follows_you: FollowState | null
}

function iconTone(label: string): string {
  if (label === 'Confirm') {
    return 'text-emerald-300 hover:text-emerald-200'
  }
  if (label === 'Reject') {
    return 'text-rose-300 hover:text-rose-200'
  }
  if (label === 'Cancel request') {
    return 'text-amber-300 hover:text-amber-200'
  }
  if (label === 'Follow Back' || label === 'Request to follow back') {
    return 'text-sky-300 hover:text-sky-200'
  }
  if (label === 'Unfollow') {
    return 'text-zinc-400 hover:text-zinc-200'
  }
  return 'text-indigo-300 hover:text-indigo-200'
}

function FollowActionIcon({ label }: { label: string }) {
  const common = { viewBox: '0 0 24 24', 'aria-hidden': true, className: 'size-5', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8 } as const
  if (label === 'Confirm') {
    return (
      <svg {...common}>
        <path d="m5 12 5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }
  if (label === 'Reject') {
    return (
      <svg {...common}>
        <path d="m6 6 12 12M18 6 6 18" strokeLinecap="round" />
      </svg>
    )
  }
  if (label === 'Cancel request') {
    return (
      <svg {...common}>
        <path d="M16 21v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 19.5V21" strokeLinecap="round" />
        <circle cx="10" cy="8" r="3" />
        <path d="m17 8 4 4m0-4-4 4" strokeLinecap="round" />
      </svg>
    )
  }
  if (label === 'Follow Back' || label === 'Request to follow back') {
    return (
      <svg {...common}>
        <path d="M15 21v-1.5a3.5 3.5 0 0 0-3.5-3.5H7A3.5 3.5 0 0 0 3.5 19.5V21" strokeLinecap="round" />
        <circle cx="9.5" cy="8" r="3" />
        <path d="M17 7v4h4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M21 7a4 4 0 0 0-4 4" strokeLinecap="round" />
      </svg>
    )
  }
  if (label === 'Unfollow') {
    return (
      <svg {...common}>
        <path d="M16 21v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 19.5V21" strokeLinecap="round" />
        <circle cx="10" cy="8" r="3" />
        <path d="M17 11h6" strokeLinecap="round" />
      </svg>
    )
  }
  return (
    <svg {...common}>
      <path d="M16 21v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 19.5V21" strokeLinecap="round" />
      <circle cx="10" cy="8" r="3" />
      <path d="M19 8v6M16 11h6" strokeLinecap="round" />
    </svg>
  )
}

function FollowIconButton({
  label,
  disabled,
  onClick,
  busy = false,
}: {
  label: string
  disabled?: boolean
  onClick: () => void
  busy?: boolean
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={busy ? 'Saving' : label}
      title={label}
      className={cn(
        'inline-flex size-9 items-center justify-center rounded-full bg-transparent p-0 transition disabled:opacity-50',
        iconTone(label),
      )}
    >
      {busy ? (
        <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : (
        <FollowActionIcon label={label} />
      )}
    </button>
  )
}

function followLabel(target: FollowTarget): string | null {
  if (target.is_self) {
    return null
  }
  if (target.follow_state === 'accepted') {
    return 'Unfollow'
  }
  if (target.follow_state === 'pending') {
    return 'Cancel request'
  }
  if (target.follows_you === 'accepted') {
    return target.profile_public ? 'Follow Back' : 'Request to follow back'
  }
  return target.profile_public ? 'Follow' : 'Request to follow'
}

export function FollowActions({ target }: { target: FollowTarget }) {
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const label = followLabel(target)

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ['public-profile', target.username] })
    void queryClient.invalidateQueries({ queryKey: ['user-search'] })
    void queryClient.invalidateQueries({ queryKey: ['shared-collection', target.username] })
    void queryClient.invalidateQueries({ queryKey: ['shared-sites', target.username] })
    void queryClient.invalidateQueries({ queryKey: ['follow-requests'] })
    void queryClient.invalidateQueries({ queryKey: ['notifications'] })
  }

  const followMutation = useMutation({
    mutationFn: () => (target.follow_state ? unfollowUser(target.username) : followUser(target.username)),
    onSuccess: (next) => {
      setError(null)
      queryClient.setQueryData(['public-profile', target.username], next)
      refresh()
    },
    onError: (err: unknown) => {
      setError(err instanceof ApiError ? err.message : 'Could not update follow')
    },
  })

  const requestMutation = useMutation({
    mutationFn: (approve: boolean) =>
      approve ? approveFollowRequest(target.username) : rejectFollowRequest(target.username),
    onSuccess: () => {
      setError(null)
      refresh()
    },
    onError: (err: unknown) => {
      setError(err instanceof ApiError ? err.message : 'Could not update that request')
    },
  })

  if (target.is_self) {
    return null
  }

  return (
    <div className="flex shrink-0 items-center gap-0.5">
      {target.follows_you === 'pending' ? (
        <>
          <FollowIconButton
            label="Confirm"
            disabled={requestMutation.isPending}
            onClick={() => requestMutation.mutate(true)}
          />
          <FollowIconButton
            label="Reject"
            disabled={requestMutation.isPending}
            onClick={() => requestMutation.mutate(false)}
          />
        </>
      ) : null}
      {label ? (
        <FollowIconButton
          label={label}
          disabled={followMutation.isPending}
          busy={followMutation.isPending}
          onClick={() => followMutation.mutate()}
        />
      ) : null}
      {error ? <p className="max-w-36 text-right text-xs text-rose-300" role="alert">{error}</p> : null}
    </div>
  )
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError } from '../api/client'
import { fetchPrivacy, updatePrivacy } from '../api/sharing'
import { ErrorPanel, LoadingIndicator } from './PageStatus'
import { cn } from '../lib/ui'
import type { PrivacySettings } from '../types/sharing'

function ToggleRow({
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  label: string
  description: string
  checked: boolean
  disabled: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-zinc-100">{label}</p>
        <p className="mt-1 text-sm leading-relaxed text-zinc-400">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative mt-0.5 h-7 w-12 shrink-0 rounded-full transition disabled:opacity-50',
          checked ? 'bg-indigo-400' : 'bg-zinc-700',
        )}
      >
        <span className={cn('absolute top-0.5 size-6 rounded-full bg-white transition', checked ? 'left-5' : 'left-0.5')} />
      </button>
    </div>
  )
}

export function PrivacySharingSection() {
  const queryClient = useQueryClient()
  const privacyQuery = useQuery({ queryKey: ['privacy'], queryFn: fetchPrivacy })
  const save = useMutation({
    mutationFn: (body: Partial<PrivacySettings>) => updatePrivacy(body),
    onSuccess: (privacy) => {
      queryClient.setQueryData(['privacy'], privacy)
      void queryClient.invalidateQueries({ queryKey: ['me'] })
    },
  })

  if (privacyQuery.isPending) {
    return <LoadingIndicator label="Loading sharing settings…" />
  }
  if (privacyQuery.isError || !privacyQuery.data) {
    return <ErrorPanel message="Could not load sharing settings." onRetry={() => { void privacyQuery.refetch() }} />
  }

  const privacy = privacyQuery.data
  return (
    <div className="space-y-5">
      <p className="text-sm leading-relaxed text-zinc-400">
        Private profiles can still be found by username. Collection and watch sites stay hidden until you approve a follow, and only for the settings you leave on.
      </p>
      <ToggleRow
        label={privacy.profile_public ? 'Public profile' : 'Private profile'}
        description="Private profiles can be found in search. Their collection and sites stay hidden until you approve a follow."
        checked={privacy.profile_public}
        disabled={save.isPending}
        onChange={(profile_public) => save.mutate({ profile_public })}
      />
      <ToggleRow
        label="Share my collection"
        description="Shows title, cover, status, and episode progress. Ratings and favorites stay private."
        checked={privacy.share_collection}
        disabled={save.isPending}
        onChange={(share_collection) => save.mutate({ share_collection })}
      />
      <ToggleRow
        label="Share my reusable watch sites"
        description="Lets approved viewers copy a site name, address, and episode or search templates. Links saved for one specific anime stay private."
        checked={privacy.share_watch_sites}
        disabled={save.isPending}
        onChange={(share_watch_sites) => save.mutate({ share_watch_sites })}
      />
      {save.isError ? (
        <p className="text-sm text-red-300" role="alert">
          {save.error instanceof ApiError ? save.error.message : 'Could not save sharing settings'}
        </p>
      ) : null}
    </div>
  )
}

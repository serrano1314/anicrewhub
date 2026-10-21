import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ApiError } from '../api/client'
import { approveFollowRequest, fetchFollowRequests, rejectFollowRequest } from '../api/sharing'
import { ErrorPanel, LoadingIndicator } from './PageStatus'
import { ProfileAvatar } from './ProfileAvatar'
import { UI } from '../lib/ui'

export function FollowRequestsSection() {
  const queryClient = useQueryClient()
  const requestsQuery = useQuery({ queryKey: ['follow-requests'], queryFn: fetchFollowRequests })
  const decision = useMutation({
    mutationFn: ({ username, approve }: { username: string; approve: boolean }) =>
      approve ? approveFollowRequest(username) : rejectFollowRequest(username),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['follow-requests'] })
      void queryClient.invalidateQueries({ queryKey: ['public-profile'] })
      void queryClient.invalidateQueries({ queryKey: ['profile-connections'] })
    },
  })

  if (requestsQuery.isPending) {
    return <LoadingIndicator label="Loading follow requests…" />
  }
  if (requestsQuery.isError) {
    return <ErrorPanel message="Could not load follow requests." onRetry={() => { void requestsQuery.refetch() }} />
  }
  if (requestsQuery.data.length === 0) {
    return null
  }

  return (
    <section className="space-y-3 rounded-3xl border border-white/10 bg-zinc-900/55 p-5">
      <h2 className="text-base font-semibold text-zinc-50">Follow requests</h2>
      <ul className="space-y-2">
        {requestsQuery.data.map((request) => (
          <li key={request.username} className="flex flex-wrap items-center gap-3">
            <ProfileAvatar username={request.username} avatarId={request.avatar_id} size="sm" />
            <Link to={`/users/${encodeURIComponent(request.username)}`} className="min-w-0 flex-1 truncate text-sm text-zinc-100 hover:text-indigo-200">
              {request.username}
            </Link>
            <button
              type="button"
              disabled={decision.isPending}
              onClick={() => decision.mutate({ username: request.username, approve: true })}
              className={UI.btnPrimary}
            >
              Approve
            </button>
            <button
              type="button"
              disabled={decision.isPending}
              onClick={() => decision.mutate({ username: request.username, approve: false })}
              className={UI.btnSecondary}
            >
              Reject
            </button>
          </li>
        ))}
      </ul>
      {decision.isError ? (
        <p className="text-sm text-red-300" role="alert">
          {decision.error instanceof ApiError ? decision.error.message : 'Could not update that request'}
        </p>
      ) : null}
    </section>
  )
}

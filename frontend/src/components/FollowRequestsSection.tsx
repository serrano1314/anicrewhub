import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ApiError } from '../api/client'
import { approveFollowRequest, fetchFollowRequests, rejectFollowRequest } from '../api/sharing'
import { ErrorPanel, LoadingIndicator } from './PageStatus'
import { ProfileAvatar } from './ProfileAvatar'

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
            {/* replace button to icon-only */}
            <button
              type="button"
              disabled={decision.isPending}
              onClick={() => decision.mutate({ username: request.username, approve: true })}
              className="rounded-full bg-indigo-400/10 p-1 text-indigo-400 transition hover:bg-indigo-400/20"
            >
              <span className="sr-only">Approve</span>
              <svg viewBox="0 0 20 20" aria-hidden="true" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="m4.5 10.5 3.5 3.5 7.5-8" />
              </svg>
            </button>
            <button
              type="button"
              disabled={decision.isPending}
              onClick={() => decision.mutate({ username: request.username, approve: false })}
              className="rounded-full bg-rose-400/10 p-1 text-rose-400 transition hover:bg-rose-400/20"
            >
              <span className="sr-only">Reject</span>
              <svg viewBox="0 0 20 20" aria-hidden="true" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="m5 5 10 10M15 5 5 15" />
              </svg>
            </button>
            {/* <button
              type="button"
              disabled={decision.isPending}
              onClick={() => decision.mutate({ username: request.username, approve: true })}
              className={UI.btnPrimary}
            >
              Approve
            </button> */}
            {/* <button
              type="button"
              disabled={decision.isPending}
              onClick={() => decision.mutate({ username: request.username, approve: false })}
              className={UI.btnSecondary}
            >
              Reject
            </button> */}
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

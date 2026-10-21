import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError } from '../api/client'
import { deleteCopiedSite, fetchCopiedSites } from '../api/sharing'
import { useDialog } from './dialogContext'
import { EmptyState, ErrorPanel, LoadingIndicator } from './PageStatus'

export function CopiedSitesSection() {
  const dialog = useDialog()
  const queryClient = useQueryClient()
  const sitesQuery = useQuery({ queryKey: ['copied-sites'], queryFn: fetchCopiedSites })
  const remove = useMutation({
    mutationFn: deleteCopiedSite,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['copied-sites'] })
      void queryClient.invalidateQueries({ queryKey: ['shared-sites'] })
    },
  })

  if (sitesQuery.isPending) {
    return <LoadingIndicator label="Loading copied sites…" />
  }
  if (sitesQuery.isError) {
    return <ErrorPanel message="Could not load copied sites." onRetry={() => { void sitesQuery.refetch() }} />
  }
  if (sitesQuery.data.length === 0) {
    return <EmptyState>Sites you copy from other people show up here, separate from sites you add yourself.</EmptyState>
  }

  return (
    <ul className="space-y-2">
      {sitesQuery.data.map((site) => (
        <li key={site.id} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-zinc-950/30 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-zinc-100">{site.name}</p>
            <a href={site.base_url} target="_blank" rel="noopener noreferrer" className="block truncate text-xs text-zinc-500 hover:text-indigo-200">
              {site.base_url}
            </a>
            {site.episode_url_template ? (
              <p className="mt-1 truncate font-mono text-[11px] text-indigo-200/80" title={site.episode_url_template}>
                Episode · {site.episode_url_template}
              </p>
            ) : null}
            {site.search_url_template ? (
              <p className="truncate font-mono text-[11px] text-violet-200/80" title={site.search_url_template}>
                Search · {site.search_url_template}
              </p>
            ) : null}
            <p className="mt-1 text-xs text-zinc-400">Copied from {site.source_username}</p>
          </div>
          <button
            type="button"
            disabled={remove.isPending}
            onClick={() => {
              void dialog.confirm({
                title: `Remove ${site.name}?`,
                message: 'This removes the copied snapshot from your account. It does not change the original site.',
                confirmLabel: 'Remove',
                tone: 'danger',
              }).then((confirmed) => {
                if (confirmed) {
                  remove.mutate(site.id)
                }
              })
            }}
            className="text-sm text-rose-200 hover:text-rose-100 disabled:opacity-50"
          >
            Remove
          </button>
        </li>
      ))}
      {remove.isError ? (
        <p className="text-sm text-red-300" role="alert">
          {remove.error instanceof ApiError ? remove.error.message : 'Could not remove that site'}
        </p>
      ) : null}
    </ul>
  )
}

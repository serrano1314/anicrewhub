import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ApiError } from '../api/client'
import {
  copySharedSites,
  fetchProfile,
  fetchSharedCollection,
  fetchSharedSites,
} from '../api/sharing'
import { useDialog } from '../components/dialogContext'
import { BackLink } from '../components/BackLink'
import { FollowActions } from '../components/FollowActions'
import { EmptyState, ErrorPanel, LoadingIndicator } from '../components/PageStatus'
import { Pager } from '../components/Pager'
import { ProfileAvatar } from '../components/ProfileAvatar'
import { displayTitle, metaLine } from '../lib/display'
import { UI, cn } from '../lib/ui'
import { LIBRARY_STATUSES, STATUS_LABELS, type LibraryStatus } from '../types/library'

const COPY_WARNING_KEY = 'anime-tracker-site-copy-warning'
const COPY_WARNING =
  'These links were added by another user. They can change, stop working, or be unsafe. Anime Tracker does not run those sites and does not check that a copied address stays reliable. Copying saves the site name, address, and episode or search templates. Links saved for one specific anime stay on their account.'

function CollectionFilterIcon({ status }: { status: LibraryStatus | 'all' }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4">
      {status === 'all' ? (
        <path fill="currentColor" d="M3 3h14v3H3zm0 5.5h14v3H3zm0 5.5h14v3H3z" />
      ) : status === 'watching' ? (
        <path fill="currentColor" d="M10 1.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17ZM8 6l6 4-6 4z" />
      ) : status === 'completed' ? (
        <path fill="currentColor" d="M10 1.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17Zm-1.1 12.2-3-3 1.4-1.4 1.6 1.6 3.8-4 1.5 1.4z" />
      ) : status === 'plan_to_watch' ? (
        <path fill="currentColor" d="M4 2.5h12a1 1 0 0 1 1 1v14l-7-3.7-7 3.7v-14a1 1 0 0 1 1-1Zm1 2v9.7l5-2.6 5 2.6V4.5z" />
      ) : status === 'on_hold' ? (
        <path fill="currentColor" d="M10 1.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17ZM7 6h2.5v8H7zm4.5 0H14v8h-2.5z" />
      ) : (
        <path fill="currentColor" d="M10 1.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17Zm3.4 10.5-1.4 1.4-2-2-2 2-1.4-1.4 2-2-2-2 1.4-1.4 2 2 2-2 1.4 1.4-2 2z" />
      )}
    </svg>
  )
}

function parsePage(value: string | null): number {
  const page = Number(value)
  if (!Number.isInteger(page) || page < 1) {
    return 1
  }
  return page
}

function hasSeenCopyWarning(): boolean {
  try {
    return window.localStorage.getItem(COPY_WARNING_KEY) === '1'
  } catch {
    return false
  }
}

function rememberCopyWarning(): void {
  try {
    window.localStorage.setItem(COPY_WARNING_KEY, '1')
  } catch {
    // The warning can show again if storage is unavailable.
  }
}

export function UserProfilePage() {
  const { username = '' } = useParams()
  const dialog = useDialog()
  const queryClient = useQueryClient()
  const [params, setParams] = useSearchParams()
  const page = parsePage(params.get('page'))
  const statusParam = params.get('status')
  const status = LIBRARY_STATUSES.find((item) => item === statusParam) ?? null
  const [selectedSiteIds, setSelectedSiteIds] = useState<string[]>([])
  const [copyMessage, setCopyMessage] = useState<string | null>(null)

  const profileQuery = useQuery({
    queryKey: ['public-profile', username],
    queryFn: () => fetchProfile(username),
    enabled: username.length > 0,
  })
  const profile = profileQuery.data
  const collectionQuery = useQuery({
    queryKey: ['shared-collection', username, page, status],
    queryFn: () => fetchSharedCollection(username, page, status),
    enabled: profile?.can_view_collection === true,
  })
  const sitesQuery = useQuery({
    queryKey: ['shared-sites', username],
    queryFn: () => fetchSharedSites(username),
    enabled: profile?.can_view_sites === true,
  })

  const copyMutation = useMutation({
    mutationFn: (siteIds: string[]) => copySharedSites(username, siteIds),
    onSuccess: (result) => {
      setSelectedSiteIds([])
      setCopyMessage(
        result.copied.length > 0
          ? `Copied ${result.copied.length} ${result.copied.length === 1 ? 'site' : 'sites'}.`
          : 'Those sites are already in your copied sites.',
      )
      void queryClient.invalidateQueries({ queryKey: ['shared-sites', username] })
      void queryClient.invalidateQueries({ queryKey: ['copied-sites'] })
    },
  })

  async function copySites(siteIds: string[]) {
    if (siteIds.length === 0) {
      return
    }
    if (!hasSeenCopyWarning()) {
      const confirmed = await dialog.confirm({
        title: 'Copy someone else’s watch sites?',
        message: COPY_WARNING,
        confirmLabel: 'Copy sites',
      })
      if (!confirmed) {
        return
      }
      rememberCopyWarning()
    }
    setCopyMessage(null)
    copyMutation.mutate(siteIds)
  }

  function setStatus(next: LibraryStatus | null) {
    const nextParams = new URLSearchParams(params)
    nextParams.delete('page')
    if (next) {
      nextParams.set('status', next)
    } else {
      nextParams.delete('status')
    }
    setParams(nextParams)
  }

  if (profileQuery.isPending) {
    return (
      <div className={UI.page}>
        <BackLink />
        <LoadingIndicator label="Loading profile…" />
      </div>
    )
  }
  if (profileQuery.isError || !profile) {
    return (
      <div className={UI.page}>
        <BackLink />
        <ErrorPanel
          message={profileQuery.error instanceof ApiError ? profileQuery.error.message : 'Could not load this profile'}
          onRetry={() => { void profileQuery.refetch() }}
        />
      </div>
    )
  }

  const copyableSites = sitesQuery.data?.filter((site) => !site.already_copied) ?? []

  return (
    <div className={UI.page}>
      <BackLink />
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <ProfileAvatar username={profile.username} avatarId={profile.avatar_id} size="lg" className="size-20" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-semibold tracking-tight text-zinc-50">{profile.username}</h1>
          <p className="mt-1 text-sm text-zinc-400">
            {profile.profile_public ? 'Public profile' : 'Private profile'}
            {profile.follower_count != null ? ` · ${profile.follower_count} followers` : ''}
            {profile.following_count != null ? ` · ${profile.following_count} following` : ''}
          </p>
          {!profile.profile_public && !profile.can_view_collection && !profile.can_view_sites ? (
            <p className="mt-2 max-w-lg text-sm leading-relaxed text-zinc-400">
              This profile is private. You can send a follow request. Collection and watch sites stay hidden until the owner approves you, and only while those sharing settings are on.
            </p>
          ) : null}
        </div>
        {profile.is_self ? (
          <>
          <span className="text-sm text-zinc-400">
            You cannot follow yourself. lol.
          </span>
          <Link to="/settings" className={UI.btnSecondary}>Sharing settings</Link>
          </>
        ) : (
          <FollowActions target={profile} />
        )}
      </header>
      {profile.follows_you === 'pending' ? (
        <p className="text-sm text-zinc-300">{profile.username} requested to follow you.</p>
      ) : null}

      {profile.can_view_collection ? (
        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-lg font-semibold text-zinc-50">Collection</h2>
            {/* <p className="text-xs text-zinc-500">Read only. Ratings and favorites stay private.</p> */}
          </div>
          <div className="ui-tablist" role="tablist" aria-label="Collection status">
            {([{ id: 'all' as const, label: 'All' }, ...LIBRARY_STATUSES.map((item) => ({ id: item, label: STATUS_LABELS[item] }))]).map((tab) => {
              const selected = tab.id === 'all' ? status == null : status === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  aria-label={tab.label}
                  title={tab.label}
                  onClick={() => setStatus(tab.id === 'all' ? null : tab.id)}
                  className={cn(
                    'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 text-sm whitespace-nowrap text-zinc-300 transition-all duration-200 hover:border-white/20 hover:bg-white/5',
                    selected
                      ? 'h-9 w-auto gap-2 px-3'
                      : 'size-9 gap-0 p-0',
                    selected && 'border-indigo-400/40 bg-indigo-500/20 font-medium text-indigo-100 ring-1 ring-indigo-400/30',
                  )}
                >
                  <CollectionFilterIcon status={tab.id} />
                  <span
                    aria-hidden={!selected}
                    className={cn(
                      'grid transition-[grid-template-columns] duration-200 ease-out motion-reduce:transition-none',
                      selected ? 'grid-cols-[1fr]' : 'grid-cols-[0fr]',
                    )}
                  >
                    <span
                      className={cn(
                        'min-w-0 overflow-hidden whitespace-nowrap transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none',
                        selected ? 'translate-x-0 opacity-100' : '-translate-x-1 opacity-0',
                      )}
                    >
                      {tab.label}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
          {collectionQuery.isPending ? <LoadingIndicator label="Loading collection…" /> : null}
          {collectionQuery.isError ? (
            <ErrorPanel message="Could not load this collection." onRetry={() => { void collectionQuery.refetch() }} />
          ) : null}
          {collectionQuery.data?.results.length === 0 ? <EmptyState>Nothing in this collection view.</EmptyState> : null}
          {collectionQuery.data && collectionQuery.data.results.length > 0 ? (
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {collectionQuery.data.results.map((item) => (
                <li key={item.anilist_id} className="min-w-0">
                  <Link
                    to={`/anime/${item.anilist_id}`}
                    className="flex min-w-0 gap-3 rounded-2xl border border-white/10 bg-zinc-900/50 p-3 transition hover:border-indigo-300/30"
                  >
                    {item.cover_url ? (
                      <img src={item.cover_url} alt="" className="h-20 w-14 shrink-0 rounded-lg object-cover" />
                    ) : (
                      <span className="h-20 w-14 shrink-0 rounded-lg bg-zinc-800" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-zinc-50">{displayTitle(item)}</span>
                      <span className="mt-1 block text-xs text-zinc-400">
                        {STATUS_LABELS[item.status]}
                        {metaLine(item.format, null, null) ? ` · ${metaLine(item.format, null, null)}` : ''}
                      </span>
                      <span className="mt-1 block text-xs text-zinc-500">
                        {item.watched_count} watched
                        {item.total_episodes != null ? ` / ${item.total_episodes}` : ''}
                        {item.last_episode_watched > 0 ? ` · last ep ${item.last_episode_watched}` : ''}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
          {collectionQuery.data ? (
            <Pager
              page={collectionQuery.data.page}
              hasNext={collectionQuery.data.has_next_page}
              totalCount={collectionQuery.data.total_count}
              onPage={(nextPage) => {
                const nextParams = new URLSearchParams(params)
                nextParams.set('page', String(nextPage))
                setParams(nextParams)
              }}
            />
          ) : null}
        </section>
      ) : profile.profile_public ? (
        <EmptyState>This collection is not shared.</EmptyState>
      ) : null}

      {profile.can_view_sites ? (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-zinc-50">Reusable watch sites</h2>
            {!profile.is_self ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={copyableSites.length === 0 || copyMutation.isPending}
                  onClick={() => { void copySites(copyableSites.map((site) => site.id)) }}
                  className={UI.btnSecondary}
                >
                  Copy all
                </button>
                <button
                  type="button"
                  disabled={selectedSiteIds.length === 0 || copyMutation.isPending}
                  onClick={() => { void copySites(selectedSiteIds) }}
                  className={UI.btnPrimary}
                >
                  Copy selected
                </button>
              </div>
            ) : null}
          </div>
          {sitesQuery.isPending ? <LoadingIndicator label="Loading sites…" /> : null}
          {sitesQuery.isError ? (
            <ErrorPanel message="Could not load shared sites." onRetry={() => { void sitesQuery.refetch() }} />
          ) : null}
          {sitesQuery.data?.length === 0 ? <EmptyState>No reusable sites are shared.</EmptyState> : null}
          {sitesQuery.data && sitesQuery.data.length > 0 ? (
            <ul className="space-y-2">
              {sitesQuery.data.map((site) => {
                const selectable = !profile.is_self && !site.already_copied
                const selected = selectable && selectedSiteIds.includes(site.id)
                const details = (
                  <>
                    <p className="truncate text-sm font-medium text-zinc-100">{site.name}</p>
                    <p className="truncate text-xs text-zinc-500">{site.base_url}</p>
                    {site.episode_url_template ? (
                      <p className="truncate font-mono text-[11px] text-indigo-200/80" title={site.episode_url_template}>
                        Episode · {site.episode_url_template}
                      </p>
                    ) : null}
                    {site.search_url_template ? (
                      <p className="truncate font-mono text-[11px] text-violet-200/80" title={site.search_url_template}>
                        Search · {site.search_url_template}
                      </p>
                    ) : null}
                  </>
                )
                return (
                  <li
                    key={site.id}
                    className={cn(
                      'flex items-center gap-3 rounded-2xl border bg-zinc-900/50 pr-3',
                      selected ? 'border-indigo-300/80' : selectable ? 'border-transparent' : 'border-white/10',
                    )}
                  >
                    {selectable ? (
                      <button
                        type="button"
                        disabled={copyMutation.isPending}
                        aria-pressed={selected}
                        aria-label={selected ? `Deselect ${site.name}` : `Select ${site.name}`}
                        onClick={() => {
                          setSelectedSiteIds((current) =>
                            current.includes(site.id) ? current.filter((id) => id !== site.id) : [...current, site.id],
                          )
                        }}
                        className="min-w-0 flex-1 px-4 py-3 text-left disabled:opacity-60"
                      >
                        {details}
                      </button>
                    ) : (
                      <div className="min-w-0 flex-1 px-4 py-3">{details}</div>
                    )}
                    {site.already_copied ? (
                      <span className="shrink-0 text-xs text-emerald-300">Already copied</span>
                    ) : !profile.is_self ? (
                      <button
                        type="button"
                        disabled={copyMutation.isPending}
                        onClick={() => { void copySites([site.id]) }}
                        className={UI.btnSecondary}
                      >
                        Copy
                      </button>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          ) : null}
          {copyMessage ? <p className="text-sm text-emerald-300">{copyMessage}</p> : null}
          {copyMutation.isError ? (
            <p className="text-sm text-red-300" role="alert">
              {copyMutation.error instanceof ApiError ? copyMutation.error.message : 'Could not copy sites'}
            </p>
          ) : null}
        </section>
      ) : profile.profile_public && profile.can_view_collection ? (
        <EmptyState>Reusable watch sites are not shared.</EmptyState>
      ) : null}
    </div>
  )
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Fragment, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ApiError } from '../api/client'
import { INPUT_PLACEHOLDERS } from '../lib/placeholders'
import { UI, cn } from '../lib/ui'
import { Select } from './Select'
import { addAnimeSite, fetchAnimeSites, fetchSites, removeAnimeSite, updateAnimeSite } from '../api/sites'
import { useDialog } from './dialogContext'

type AnimeSitesSectionProps = {
  anilistId: number
}

function errorText(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback
}

export function AnimeSitesSection({ anilistId }: AnimeSitesSectionProps) {
  const queryClient = useQueryClient()
  const dialog = useDialog()
  const [siteId, setSiteId] = useState('')
  const [animeUrl, setAnimeUrl] = useState('')
  const [editingSiteId, setEditingSiteId] = useState<string | null>(null)
  const [editingAnimeUrl, setEditingAnimeUrl] = useState('')
  const [isOpen, setIsOpen] = useState(false)

  const sitesQuery = useQuery({
    queryKey: ['sites'],
    queryFn: fetchSites,
    enabled: isOpen,
  })
  const animeSitesQuery = useQuery({
    queryKey: ['anime-sites', anilistId],
    queryFn: () => fetchAnimeSites(anilistId),
    enabled: isOpen,
  })

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ['anime-sites', anilistId] })
    await queryClient.invalidateQueries({ queryKey: ['watch-links', anilistId] })
  }

  const addMutation = useMutation({
    mutationFn: () => addAnimeSite(anilistId, siteId, animeUrl),
    onSuccess: async () => {
      setSiteId('')
      setAnimeUrl('')
      await refresh()
    },
  })
  const removeMutation = useMutation({
    mutationFn: (id: string) => removeAnimeSite(anilistId, id),
    onSuccess: refresh,
  })
  const updateMutation = useMutation({
    mutationFn: (input: { siteId: string; animeUrl: string }) =>
      updateAnimeSite(anilistId, input.siteId, input.animeUrl),
    onSuccess: async () => {
      setEditingSiteId(null)
      setEditingAnimeUrl('')
      await refresh()
    },
  })

  const linked = new Set((animeSitesQuery.data ?? []).map((site) => site.site_id))
  const available = (sitesQuery.data ?? []).filter((site) => !linked.has(site.id))
  const error =
    sitesQuery.error ?? animeSitesQuery.error ?? addMutation.error ?? removeMutation.error ?? updateMutation.error

  async function onRemove(id: string, name: string) {
    const confirmed = await dialog.confirm({
      title: 'Remove site',
      message: `Stop using ${name} for this anime?`,
      confirmLabel: 'Remove',
      tone: 'danger',
    })
    if (!confirmed) {
      return
    }
    try {
      await removeMutation.mutateAsync(id)
    } catch (removeError) {
      await dialog.error({
        title: 'Could not remove site',
        message: errorText(removeError, 'Could not remove this site.'),
      })
    }
  }

  function onAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!siteId) {
      return
    }
    addMutation.mutate()
  }

  return (
    <section className={`relative w-full min-w-0 max-w-full rounded-2xl border border-white/10 bg-zinc-900/55 shadow-lg shadow-black/20 backdrop-blur-sm ${isOpen ? 'z-[70]' : 'z-0'}`} aria-labelledby="anime-sites-title">
      <h2 id="anime-sites-title">
        <button
          type="button"
          aria-expanded={isOpen}
          aria-controls="anime-sites-content"
          onClick={() => setIsOpen((open) => !open)}
          className="flex w-full min-w-0 items-center justify-between gap-3 px-4 py-3 text-left text-sm font-semibold text-zinc-100 transition hover:bg-white/[0.03]"
        >
          <span>My sites for this anime</span>
          <svg
            viewBox="0 0 20 20"
            aria-hidden="true"
            className={`size-4 shrink-0 text-zinc-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
          >
            <path d="m4 7 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </h2>
      <div
        id="anime-sites-content"
        hidden={!isOpen}
        className="space-y-4 border-t border-white/[0.08] p-4"
      >
        <div>
            <p className="mt-1 text-sm text-zinc-400">
              Add a site once in Settings, then link it here. A page URL overrides that site’s episode
              and search templates; leave it blank to use the templates from{' '}
              <Link to="/settings" className="text-indigo-300 hover:underline">
                Settings
              </Link>
              .
            </p>
          </div>
          {animeSitesQuery.isPending || sitesQuery.isPending ? (
            <p className="text-sm text-zinc-400" role="status">Loading watch sites…</p>
          ) : null}
          {animeSitesQuery.data?.length ? (
            <ul className="space-y-2">
              {animeSitesQuery.data.map((site) => (
                <Fragment key={site.site_id}>
                  <li className="flex flex-col gap-2 rounded-lg border border-zinc-800 px-3 py-2 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{site.name}</p>
                      <a
                        href={site.anime_url ?? site.base_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block truncate text-sm text-indigo-300 hover:underline"
                      >
                        {site.anime_url ?? site.base_url}
                      </a>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (editingSiteId === site.site_id) {
                            setEditingSiteId(null)
                            return
                          }
                          setEditingSiteId(site.site_id)
                          setEditingAnimeUrl(site.anime_url ?? '')
                        }}
                        aria-label={editingSiteId === site.site_id ? 'Cancel editing URL' : 'Edit URL'}
                        title={editingSiteId === site.site_id ? 'Cancel editing URL' : 'Edit URL'}
                        aria-expanded={editingSiteId === site.site_id}
                        className="inline-flex size-9 items-center justify-center rounded-full border border-zinc-700 text-zinc-300 transition hover:bg-zinc-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300/70"
                      >
                        {editingSiteId === site.site_id ? (
                          <svg viewBox="0 0 20 20" aria-hidden="true" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
                            <path d="m5 5 10 10M15 5 5 15" />
                          </svg>
                        ) : (
                          <svg viewBox="0 0 20 20" aria-hidden="true" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                            <path d="m12.8 3.2 4 4M3 17l4-.8L16.4 6.8a1.7 1.7 0 0 0-2.4-2.4L4.6 13.8 3 17Z" />
                          </svg>
                        )}
                      </button>
                      <button
                        type="button"
                        disabled={removeMutation.isPending}
                        aria-label={`Remove ${site.name}`}
                        title="Remove site"
                        onClick={() => {
                          void onRemove(site.site_id, site.name)
                        }}
                        className="inline-flex size-9 items-center justify-center rounded-full border border-zinc-700 text-zinc-400 transition hover:border-rose-300/30 hover:bg-rose-400/[0.06] hover:text-rose-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-200/60 disabled:opacity-60"
                      >
                        <svg viewBox="0 0 20 20" aria-hidden="true" className="size-4" fill="currentColor">
                          <path d="M7.5 2.5h5l.5 1.5H16a1 1 0 1 1 0 2h-.6l-.7 10.1A2 2 0 0 1 12.7 18H7.3a2 2 0 0 1-2-1.9L4.6 6H4a1 1 0 1 1 0-2h3zm-1 3.5.6 9.5h6.8l.6-9.5zM8.5 8a1 1 0 0 1 1 1v5a1 1 0 1 1-2 0V9a1 1 0 0 1 1-1zm3 0a1 1 0 0 1 1 1v5a1 1 0 1 1-2 0V9a1 1 0 0 1 1-1z" />
                        </svg>
                      </button>
                    </div>
                  </li>
                  {editingSiteId === site.site_id ? (
                    <li className="rounded-lg border border-indigo-300/20 bg-indigo-400/[0.04] p-3">
                      <form
                        onSubmit={(event) => {
                          event.preventDefault()
                          updateMutation.mutate({ siteId: site.site_id, animeUrl: editingAnimeUrl })
                        }}
                        className="flex flex-col gap-2 sm:flex-row"
                      >
                        <label className="min-w-0 flex-1 space-y-1">
                          <span className={UI.fieldLabel}>Anime page URL override</span>
                          <input
                            type="url"
                            value={editingAnimeUrl}
                            onChange={(event) => setEditingAnimeUrl(event.target.value)}
                            placeholder={INPUT_PLACEHOLDERS.animePageUrl}
                            className={UI.input}
                          />
                          <span className="block text-xs text-zinc-400">
                            Leave blank to use this site’s episode/search templates from Settings.
                          </span>
                        </label>
                        <button
                          type="submit"
                          disabled={updateMutation.isPending}
                          aria-label={updateMutation.isPending ? 'Saving URL' : 'Save URL'}
                          title={updateMutation.isPending ? 'Saving URL' : 'Save URL'}
                          className={cn(UI.btn, UI.btnPrimary, 'size-10 shrink-0 self-start p-0 sm:mt-5')}
                        >
                          {updateMutation.isPending ? (
                            <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                          ) : (
                            <svg viewBox="0 0 20 20" aria-hidden="true" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M3 3h11l3 3v11H3z" />
                              <path d="M6 3v5h7V3M6 17v-6h8v6" />
                            </svg>
                          )}
                        </button>
                      </form>
                    </li>
                  ) : null}
                </Fragment>
              ))}
            </ul>
          ) : animeSitesQuery.isSuccess ? (
            <p className="text-sm text-zinc-400">No sites saved for this anime yet.</p>
          ) : null}
          {sitesQuery.data && sitesQuery.data.length === 0 ? (
            <p className="text-sm text-zinc-300">
              Add a watch site in{' '}
              <Link to="/settings" className="text-indigo-300 hover:underline">
                Settings
              </Link>
              .
            </p>
          ) : null}
          {available.length > 0 ? (
            <form onSubmit={onAdd} className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1.5">
                <span className={UI.fieldLabel}>Site</span>
                <Select
                  value={siteId}
                  onChange={setSiteId}
                  placeholder="Choose a site"
                  options={available.map((site) => ({ value: site.id, label: site.name }))}
                />
              </label>
              <label className="block space-y-1.5">
                <span className={UI.fieldLabel}>Page URL for this anime</span>
                <input
                  value={animeUrl}
                  onChange={(event) => setAnimeUrl(event.target.value)}
                  placeholder={INPUT_PLACEHOLDERS.animePageUrl}
                  className={UI.input}
                />
              </label>
              <button
                type="submit"
                disabled={!siteId || addMutation.isPending}
                className={cn(UI.btn, UI.btnPrimary, 'sm:col-span-2 sm:justify-self-start')}
              >
                {addMutation.isPending ? 'Saving…' : 'Add site'}
              </button>
            </form>
          ) : null}
          {error ? <p className="text-sm text-red-400">{errorText(error, 'Could not update sites')}</p> : null}
        </div>
    </section>
  )
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useId, useState, type FormEvent, type ReactNode } from 'react'
import { ApiError } from '../api/client'
import { INPUT_PLACEHOLDERS } from '../lib/placeholders'
import { createSite, deleteSite, fetchSites, updateSite } from '../api/sites'
import { useAuth } from '../auth/AuthProvider'
import { useDialog } from '../components/dialogContext'
import { fetchReleaseNote } from '../api/releaseNotes'
import { LibraryBackupSection } from '../components/LibraryBackupSection'
import { ExtensionDownloadSection } from '../components/ExtensionDownloadSection'
import { ErrorPanel, LoadingIndicator } from '../components/PageStatus'
import { ChangePasswordSection } from '../components/ChangePasswordSection'
import { CopiedSitesSection } from '../components/CopiedSitesSection'
import { PrivacySharingSection } from '../components/PrivacySharingSection'
import { ContactSupportFooterButton } from '../components/ContactSupportSection'
import { ExtensionTokensSection } from '../components/ExtensionTokensSection'
import { APP_VERSION } from '../lib/config'
import { UI, cn } from '../lib/ui'
import {
  getPreferredWatchLinkGroup,
  savePreferredWatchLinkGroup,
  type WatchLinkGroup,
} from '../lib/watchLinkPreferences'
import { renderReleaseNotesHtml } from '../lib/releaseNotes'
import type { SiteInput, WatchSite } from '../types/sites'

type SiteDraft = {
  name: string
  base_url: string
  episode_url_template: string
  search_url_template: string
}

const emptyDraft = (): SiteDraft => ({
  name: '',
  base_url: '',
  episode_url_template: '',
  search_url_template: '',
})

function draftFromSite(site: WatchSite): SiteDraft {
  return {
    name: site.name,
    base_url: site.base_url,
    episode_url_template: site.episode_url_template ?? '',
    search_url_template: site.search_url_template ?? '',
  }
}

function toInput(draft: SiteDraft): SiteInput {
  return {
    name: draft.name.trim(),
    base_url: draft.base_url.trim(),
    episode_url_template: draft.episode_url_template.trim() || null,
    search_url_template: draft.search_url_template.trim() || null,
  }
}

function errorText(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback
}

function SettingsSection({
  title,
  description,
  icon,
  accent,
  children,
  defaultOpen = false,
}: {
  title: string
  description: string
  icon: ReactNode
  accent: string
  children: ReactNode
  defaultOpen?: boolean
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const contentId = useId()

  return (
    <section className="overflow-hidden rounded-3xl border border-white/[0.09] bg-white/[0.035] shadow-[0_16px_50px_rgba(0,0,0,0.16),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl transition-colors hover:border-white/[0.14]">
      <button
        type="button"
        className="flex w-full items-center gap-4 px-4 py-4 text-left outline-none transition-colors hover:bg-white/[0.025] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-400/60 sm:px-5"
        aria-expanded={isOpen}
        aria-controls={contentId}
        onClick={() => setIsOpen((open) => !open)}
      >
        <span className={cn('flex size-11 shrink-0 items-center justify-center rounded-2xl border bg-zinc-950/35 shadow-inner', accent)}>
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-base font-semibold tracking-tight text-zinc-50 sm:text-lg">{title}</span>
          <span className="mt-1 block text-sm leading-relaxed text-zinc-400">{description}</span>
        </span>
        {/* <span className="hidden shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-500 sm:inline">
          {isOpen ? 'Open' : 'Manage'}
        </span> */}
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`size-5 shrink-0 text-zinc-400 transition-transform duration-300 ${isOpen ? 'rotate-180 text-indigo-200' : ''}`}
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <div
        id={contentId}
        className={`grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
      >
        <div className="overflow-hidden">
          <div className={`border-t border-white/[0.08] bg-zinc-950/15 px-4 py-5 transition-all duration-300 sm:px-5 ${isOpen ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0'}`}>
            {children}
          </div>
        </div>
      </div>
    </section>
  )
}

export function SettingsPage() {
  const queryClient = useQueryClient()
  const dialog = useDialog()
  const { logout } = useAuth()
  const [draft, setDraft] = useState<SiteDraft>(emptyDraft)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [preferredLinkGroup, setPreferredLinkGroup] = useState<WatchLinkGroup>(
    getPreferredWatchLinkGroup,
  )

  const sitesQuery = useQuery({
    queryKey: ['sites'],
    queryFn: fetchSites,
  })
  const releaseNoteQuery = useQuery({
    queryKey: ['release-notes', APP_VERSION],
    queryFn: () => fetchReleaseNote(APP_VERSION),
    retry: false,
  })

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ['sites'] })
    await queryClient.invalidateQueries({ queryKey: ['anime-sites'] })
    await queryClient.invalidateQueries({ queryKey: ['watch-links'] })
  }

  const saveMutation = useMutation({
    mutationFn: () => {
      const body = toInput(draft)
      return editingId ? updateSite(editingId, body) : createSite(body)
    },
    onSuccess: async () => {
      setDraft(emptyDraft())
      setEditingId(null)
      await refresh()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteSite,
    onSuccess: async (_data, siteId) => {
      if (editingId === siteId) {
        setDraft(emptyDraft())
        setEditingId(null)
      }
      await refresh()
    },
  })

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    saveMutation.mutate()
  }

  async function onDelete(site: WatchSite) {
    const confirmed = await dialog.confirm({
      title: 'Delete watch site',
      message: `Delete ${site.name}? It will also be removed from every anime that uses it.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    })
    if (!confirmed) {
      return
    }
    try {
      await deleteMutation.mutateAsync(site.id)
    } catch (error) {
      await dialog.error({
        title: 'Could not delete site',
        message: errorText(error, 'Could not delete this site.'),
      })
    }
  }

  async function onLogout() {
    const confirmed = await dialog.confirm({
      title: 'Log out?',
      message: 'You can sign back in at any time to continue tracking your anime.',
      confirmLabel: 'Log out',
      tone: 'danger',
    })
    if (confirmed) {
      await logout()
    }
  }

  const error = sitesQuery.error ?? saveMutation.error ?? deleteMutation.error
  const siteCount = sitesQuery.data?.length ?? 0

  return (
    <section className="space-y-5 pb-8 pt-10">
      <header className="relative isolate overflow-hidden rounded-3xl border border-white/10 bg-zinc-900/55 px-5 py-6 shadow-[0_20px_60px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-2xl sm:px-7 sm:py-8">
        <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-24 -z-10 size-64 rounded-full bg-indigo-500/20 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-28 left-1/3 -z-10 size-56 rounded-full bg-sky-400/10 blur-3xl" />
        <div className="flex items-start gap-4">
          <button
            type="button"
            aria-label="Log out"
            title="Log out"
            onClick={() => {
              void onLogout()
            }}
            className="absolute right-4 top-4 inline-flex size-10 items-center justify-center rounded-full border border-rose-300/25 bg-rose-500/10 text-rose-200 transition hover:border-rose-300/40 hover:bg-rose-500/20 hover:text-rose-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-200/70 sm:right-6 sm:top-6"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-4" aria-hidden="true">
              <path d="M10 17l5-5-5-5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M15 12H3" strokeLinecap="round" />
              <path d="M13 4h5a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-indigo-200/20 bg-indigo-400/10 text-indigo-100 shadow-lg shadow-indigo-950/20">
            <svg viewBox="0 0 24 24" aria-hidden="true" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3.5a2 2 0 0 1 2 2v.3a6.8 6.8 0 0 1 1.8 1l.2-.2a2 2 0 1 1 2.8 2.8l-.2.2a6.8 6.8 0 0 1 0 2l.2.2a2 2 0 1 1-2.8 2.8l-.2-.2a6.8 6.8 0 0 1-1.8 1v.3a2 2 0 1 1-4 0v-.3a6.8 6.8 0 0 1-1.8-1l-.2.2a2 2 0 1 1-2.8-2.8l.2-.2a6.8 6.8 0 0 1 0-2l-.2-.2a2 2 0 1 1 2.8-2.8l.2.2a6.8 6.8 0 0 1 1.8-1v-.3a2 2 0 0 1 2-2Z" />
              <circle cx="12" cy="10.6" r="2.4" />
            </svg>
          </span>
          <div className="min-w-0 pr-12">
            <p className={UI.eyebrow}>Personalize</p>
            <h1 className={`${UI.pageTitle} mt-1`}>Settings</h1>
            <p className={UI.pageLead}>
              Tune your watch experience, manage your sites, and keep your account and data in order.
            </p>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2 pl-16">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-zinc-950/30 px-3 py-1.5 text-xs text-zinc-300">
            <svg viewBox="0 0 20 20" aria-hidden="true" className="size-3.5 text-indigo-200" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M3 5h14M5 10h10M7 15h6" strokeLinecap="round" />
            </svg>
            {sitesQuery.isPending
              ? 'Loading watch sites…'
              : `${siteCount} ${siteCount === 1 ? 'watch site' : 'watch sites'}`}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-zinc-950/30 px-3 py-1.5 text-xs text-zinc-300">
            <svg viewBox="0 0 20 20" aria-hidden="true" className="size-3.5 text-indigo-200" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H17v13H6.5A2.5 2.5 0 0 0 4 18.5zM4 5.5v13M8 7h5" />
            </svg>
            Default: {preferredLinkGroup === 'saved' ? 'My sites' : preferredLinkGroup === 'copied' ? 'Copied' : 'Official'}
          </span>
        </div>
      </header>
      <SettingsSection
        title="Release notes"
        description={`What's new in AnimeCrew Hub ${APP_VERSION}.`}
        accent="border-fuchsia-200/10 text-fuchsia-200"
        icon={(
          <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 4.5A2.5 2.5 0 0 1 7.5 2H20v17H7.5A2.5 2.5 0 0 0 5 21.5zM5 4.5v17M9 7h7M9 10h7M9 13h5" />
          </svg>
        )}
      >
        {releaseNoteQuery.isPending ? <LoadingIndicator label={`Loading release notes for v${APP_VERSION}…`} /> : null}
        {releaseNoteQuery.isError ? (
          <ErrorPanel
            message={errorText(releaseNoteQuery.error, 'Could not load release notes')}
            onRetry={() => { void releaseNoteQuery.refetch() }}
          />
        ) : null}
        {releaseNoteQuery.data ? (
          <div className="space-y-3 rounded-2xl border border-fuchsia-200/[0.08] bg-fuchsia-400/[0.025] p-4 text-sm leading-relaxed text-zinc-300 sm:p-5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold text-zinc-100">AnimeCrew Hub</h2>
              <span className="rounded-full border border-fuchsia-200/15 bg-fuchsia-400/[0.08] px-2.5 py-1 text-[10px] font-semibold tracking-wide text-fuchsia-100">
                v{releaseNoteQuery.data.version}
              </span>
            </div>
            {renderReleaseNotesHtml(releaseNoteQuery.data.content_html)}
          </div>
        ) : null}
      </SettingsSection>
      <SettingsSection
        title="Account security"
        description="Update your password and account access."
        accent="border-emerald-200/10 text-emerald-200"
        icon={(
          <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="10" width="16" height="11" rx="2.5" />
            <path d="M8 10V7a4 4 0 1 1 8 0v3M12 14v3" />
          </svg>
        )}
        defaultOpen
      >
        <ChangePasswordSection compact />
      </SettingsSection>
      <SettingsSection
        title="Privacy and sharing"
        description="Choose who can find your profile, collection, and reusable watch sites."
        accent="border-teal-200/10 text-teal-200"
        icon={(
          <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3 19 6v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" />
            <path d="M9 12h6M12 9v6" />
          </svg>
        )}
      >
        <PrivacySharingSection />
      </SettingsSection>
      <SettingsSection
        title="Watch experience"
        description="Choose which links open first when you play an episode."
        accent="border-indigo-200/10 text-indigo-200"
        icon={(
          <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5zM4 5.5v16M8 7h8M8 10h5" />
            <path d="m14 14 4 2.5-4 2.5z" />
          </svg>
        )}
      >
        <div className="rounded-2xl border border-white/[0.08] bg-zinc-950/25 p-4 sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-md">
              <h2 className="text-sm font-semibold text-zinc-100">Default episode link group</h2>
              <p className="mt-1 text-sm leading-relaxed text-zinc-400">
                The other group stays available in the episode player. Change your preference any time.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-1 rounded-full border border-white/10 bg-zinc-950/50 p-1" role="group" aria-label="Default episode link group">
              {([
                ['saved', 'My sites'],
                ['copied', 'Copied'],
                ['official', 'Official'],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={preferredLinkGroup === value}
                  onClick={() => {
                    setPreferredLinkGroup(value)
                    savePreferredWatchLinkGroup(value)
                  }}
                  className={cn(
                    'inline-flex min-h-10 items-center justify-center gap-2 rounded-full px-4 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300/70',
                    preferredLinkGroup === value
                      ? 'bg-indigo-400/15 text-indigo-100 shadow-sm ring-1 ring-indigo-200/20'
                      : 'text-zinc-400 hover:text-zinc-100',
                  )}
                >
                  {value === 'saved' ? (
                    <svg viewBox="0 0 20 20" aria-hidden="true" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 8.5 10 3l7 5.5v7a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 15.5z" />
                      <path d="M7.5 17v-5h5v5" />
                    </svg>
                  ) : value === 'copied' ? (
                    <svg viewBox="0 0 20 20" aria-hidden="true" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="7" y="7" width="9" height="9" rx="1.5" />
                      <path d="M5 13V4.5A1.5 1.5 0 0 1 6.5 3H13" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 20 20" aria-hidden="true" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10 2 16 4.5v4.2c0 4-2.6 6.6-6 8.3-3.4-1.7-6-4.3-6-8.3V4.5z" />
                      <path d="m7 9 2 2 4-4" />
                    </svg>
                  )}
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </SettingsSection>
      <SettingsSection
        title="Watch sites"
        description="Add and manage sites used for episode links."
        accent="border-sky-200/10 text-sky-200"
        icon={(
          <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M3.5 12h17M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
          </svg>
        )}
      >
        <div className="space-y-5">
          <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-white/[0.08] bg-zinc-950/25 p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-sky-400/10 text-sky-200">
                <svg viewBox="0 0 20 20" aria-hidden="true" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  {editingId ? <path d="m12.8 3.2 4 4M3 17l4-.8L16.4 6.8a1.7 1.7 0 0 0-2.4-2.4L4.6 13.8 3 17Z" /> : <path d="M10 3v14M3 10h14" />}
                </svg>
              </span>
              <div>
                <h2 className="text-sm font-semibold text-zinc-100">
                  {editingId ? 'Edit watch site' : 'Add a watch site'}
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                  Use {'{slug}'}, {'{title}'}, and {'{episode}'} in templates. The slug uses the English title when available, otherwise romaji.
                </p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1.5">
                <span className={UI.fieldLabel}>Name</span>
                <input required value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder={INPUT_PLACEHOLDERS.siteName} className={UI.input} />
              </label>
              <label className="space-y-1.5">
                <span className={UI.fieldLabel}>Site URL</span>
                <input required type="url" value={draft.base_url} onChange={(event) => setDraft({ ...draft, base_url: event.target.value })} placeholder={INPUT_PLACEHOLDERS.siteBaseUrl} className={UI.input} />
              </label>
              <label className="space-y-1.5">
                <span className={UI.fieldLabel}>Episode URL template</span>
                <input value={draft.episode_url_template} onChange={(event) => setDraft({ ...draft, episode_url_template: event.target.value })} placeholder={INPUT_PLACEHOLDERS.episodeUrlTemplate} className={UI.input} />
              </label>
              <label className="space-y-1.5">
                <span className={UI.fieldLabel}>Search URL template</span>
                <input value={draft.search_url_template} onChange={(event) => setDraft({ ...draft, search_url_template: event.target.value })} placeholder={INPUT_PLACEHOLDERS.searchUrlTemplate} className={UI.input} />
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="submit" disabled={saveMutation.isPending} className={cn(UI.btn, UI.btnPrimary, 'rounded-full px-5')}>
                {saveMutation.isPending ? (
                  <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                ) : editingId ? (
                  <svg viewBox="0 0 20 20" aria-hidden="true" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 3h11l3 3v11H3z" />
                    <path d="M6 3v5h7V3M6 17v-6h8v6" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 20 20" aria-hidden="true" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                    <path d="M10 3v14M3 10h14" />
                  </svg>
                )}
                {saveMutation.isPending ? 'Saving…' : editingId ? 'Save changes' : 'Add site'}
              </button>
              {editingId ? (
                <button type="button" onClick={() => { setEditingId(null); setDraft(emptyDraft()) }} className={cn(UI.btn, UI.btnSecondary, 'rounded-full')}>
                  Cancel
                </button>
              ) : null}
            </div>
          </form>
          {sitesQuery.isPending ? <LoadingIndicator label="Loading sites…" /> : null}
          {sitesQuery.isError ? (
            <ErrorPanel message={errorText(sitesQuery.error, 'Could not load sites')} onRetry={() => { void sitesQuery.refetch() }} />
          ) : null}
          {sitesQuery.data?.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-zinc-950/20 px-4 py-6 text-center">
              <span className="mx-auto flex size-10 items-center justify-center rounded-2xl bg-white/[0.04] text-zinc-400">
                <svg viewBox="0 0 20 20" aria-hidden="true" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="10" cy="10" r="7.5" /><path d="M10 6v8M6 10h8" strokeLinecap="round" />
                </svg>
              </span>
              <p className="mt-3 text-sm font-medium text-zinc-200">Your site list is empty</p>
              <p className="mt-1 text-xs text-zinc-500">Add a site above to make it available for anime episodes.</p>
            </div>
          ) : null}
          {sitesQuery.data?.length ? (
            <ul className="grid gap-2 sm:grid-cols-2">
              {sitesQuery.data.map((site) => (
                <li key={site.id} className="flex min-w-0 items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-3 transition hover:border-white/[0.14] hover:bg-white/[0.04]">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-sky-200/10 bg-sky-400/[0.08] text-sky-200">
                    <svg viewBox="0 0 20 20" aria-hidden="true" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="10" cy="10" r="7.5" /><path d="M2.8 10h14.4M10 2.5a12 12 0 0 1 0 15M10 2.5a12 12 0 0 0 0 15" />
                    </svg>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-zinc-100">{site.name}</p>
                    <a href={site.base_url} target="_blank" rel="noopener noreferrer" className="block truncate text-xs text-zinc-500 transition hover:text-sky-200">{site.base_url}</a>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {site.episode_url_template ? <span className="rounded-full border border-indigo-200/10 bg-indigo-400/[0.06] px-2 py-0.5 text-[9px] uppercase tracking-wider text-indigo-200/80">Episode</span> : null}
                      {site.search_url_template ? <span className="rounded-full border border-violet-200/10 bg-violet-400/[0.06] px-2 py-0.5 text-[9px] uppercase tracking-wider text-violet-200/80">Search</span> : null}
                      {!site.episode_url_template && !site.search_url_template ? <span className="text-[10px] text-zinc-600">Base URL only</span> : null}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button type="button" aria-label={`Edit ${site.name}`} title="Edit site" onClick={() => { setEditingId(site.id); setDraft(draftFromSite(site)) }} className="inline-flex size-9 items-center justify-center rounded-full border border-white/10 text-zinc-400 transition hover:border-indigo-200/25 hover:bg-indigo-400/10 hover:text-indigo-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300/70">
                      <svg viewBox="0 0 20 20" aria-hidden="true" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="m12.8 3.2 4 4M3 17l4-.8L16.4 6.8a1.7 1.7 0 0 0-2.4-2.4L4.6 13.8 3 17Z" /></svg>
                    </button>
                    <button type="button" disabled={deleteMutation.isPending} aria-label={`Delete ${site.name}`} title="Delete site" onClick={() => { void onDelete(site) }} className="inline-flex size-9 items-center justify-center rounded-full border border-white/10 text-zinc-500 transition hover:border-rose-200/25 hover:bg-rose-400/[0.08] hover:text-rose-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-200/60 disabled:opacity-50">
                      <svg viewBox="0 0 20 20" aria-hidden="true" className="size-4" fill="currentColor"><path d="M7.5 2.5h5l.5 1.5H16a1 1 0 1 1 0 2h-.6l-.7 10.1A2 2 0 0 1 12.7 18H7.3a2 2 0 0 1-2-1.9L4.6 6H4a1 1 0 1 1 0-2h3zm-1 3.5.6 9.5h6.8l.6-9.5z" /></svg>
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
          {error ? <p className="text-sm text-red-300" role="alert">{errorText(error, 'Could not update sites')}</p> : null}
        </div>
      </SettingsSection>
      <SettingsSection
        title="Copied sites"
        description="Snapshots copied from other people, including their episode and search templates. These stay separate from sites you created."
        accent="border-cyan-200/10 text-cyan-200"
        icon={(
          <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <rect x="8" y="8" width="12" height="12" rx="2" />
            <path d="M6 16V6a2 2 0 0 1 2-2h10" />
          </svg>
        )}
      >
        <CopiedSitesSection />
      </SettingsSection>
      <SettingsSection
        title="Backup"
        description="Export your library or merge an existing JSON backup."
        accent="border-amber-200/10 text-amber-200"
        icon={(
          <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3v12M7.5 10.5 12 15l4.5-4.5M4 18v2h16v-2" />
          </svg>
        )}
      >
        <LibraryBackupSection compact />
      </SettingsSection>
      <SettingsSection
        title="Browser extension"
        description="Install the extension and manage its access tokens."
        accent="border-violet-200/10 text-violet-200"
        icon={(
          <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 4h8v4h4v12H4V8h4zM8 4v4h8V4M9 13h6M9 16h4" />
          </svg>
        )}
      >
        <div className="space-y-8">
          <ExtensionDownloadSection compact />
          <div className="border-t border-white/10" />
          <ExtensionTokensSection compact />
        </div>
      </SettingsSection>
      <div className="flex justify-center pt-1">
        <ContactSupportFooterButton />
      </div>
    </section>
  )
}

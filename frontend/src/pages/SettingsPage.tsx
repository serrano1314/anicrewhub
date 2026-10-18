import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useId, useState, type FormEvent, type ReactNode } from 'react'
import { ApiError } from '../api/client'
import { INPUT_PLACEHOLDERS } from '../lib/placeholders'
import { createSite, deleteSite, fetchSites, updateSite } from '../api/sites'
import { useDialog } from '../components/dialogContext'
import { LibraryBackupSection } from '../components/LibraryBackupSection'
import { ExtensionDownloadSection } from '../components/ExtensionDownloadSection'
import { ErrorPanel, LoadingIndicator } from '../components/PageStatus'
import { ChangePasswordSection } from '../components/ChangePasswordSection'
import { ContactSupportFooterButton } from '../components/ContactSupportSection'
import { ExtensionTokensSection } from '../components/ExtensionTokensSection'
import { PageHeader } from '../components/PageHeader'
import { UI } from '../lib/ui'
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
  children,
  defaultOpen = false,
}: {
  title: string
  description: string
  children: ReactNode
  defaultOpen?: boolean
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const contentId = useId()

  return (
    <section className="rounded-2xl border border-white/10 bg-zinc-900/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-4 rounded-2xl px-5 py-4 text-left outline-none transition-colors hover:bg-white/[0.03] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-400/60"
        aria-expanded={isOpen}
        aria-controls={contentId}
        onClick={() => setIsOpen((open) => !open)}
      >
        <span>
          <span className="block text-lg font-medium tracking-tight text-zinc-50">{title}</span>
          <span className="mt-1 block text-sm text-zinc-400">{description}</span>
        </span>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`size-5 shrink-0 text-zinc-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
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
          <div className={`border-t border-white/10 px-5 py-5 transition-all duration-300 ${isOpen ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0'}`}>
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
  const [draft, setDraft] = useState<SiteDraft>(emptyDraft)
  const [editingId, setEditingId] = useState<string | null>(null)

  const sitesQuery = useQuery({
    queryKey: ['sites'],
    queryFn: fetchSites,
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

  const error = sitesQuery.error ?? saveMutation.error ?? deleteMutation.error

  return (
    <section className={UI.page}>
      <PageHeader
        title="Settings"
        description="Account security, watch sites, backups, and extension tools."
      />
      <SettingsSection
        title="Account security"
        description="Update your password and account access."
        defaultOpen
      >
        <ChangePasswordSection compact />
      </SettingsSection>
      <SettingsSection
        title="Watch sites"
        description="Add and manage sites used for episode links."
      >
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <h2 className="text-lg font-medium tracking-tight text-zinc-50">
            {editingId ? 'Edit watch site' : 'Add a watch site'}
          </h2>
          <p className="mt-1 text-sm text-zinc-400">
            Episode links can use {'{slug}'}, {'{title}'}, and {'{episode}'}. {'{slug}'} is the
            lowercase English title when there is one, otherwise romaji, with only letters and numbers
            kept and spaces as hyphens.
          </p>
        </div>
        <label className="block space-y-1 text-sm">
          <span className="text-zinc-300">Name</span>
          <input
            required
            value={draft.name}
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            placeholder={INPUT_PLACEHOLDERS.siteName}
            className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2"
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="text-zinc-300">Site URL</span>
          <input
            required
            type="url"
            value={draft.base_url}
            onChange={(event) => setDraft({ ...draft, base_url: event.target.value })}
            placeholder={INPUT_PLACEHOLDERS.siteBaseUrl}
            className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2"
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="text-zinc-300">Episode URL template</span>
          <input
            value={draft.episode_url_template}
            onChange={(event) => setDraft({ ...draft, episode_url_template: event.target.value })}
            placeholder={INPUT_PLACEHOLDERS.episodeUrlTemplate}
            className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2"
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="text-zinc-300">Search URL template</span>
          <input
            value={draft.search_url_template}
            onChange={(event) => setDraft({ ...draft, search_url_template: event.target.value })}
            placeholder={INPUT_PLACEHOLDERS.searchUrlTemplate}
            className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={saveMutation.isPending}
            className="rounded-md bg-indigo-500 px-4 py-2 font-medium hover:bg-indigo-400 disabled:opacity-60"
          >
            {saveMutation.isPending ? 'Saving…' : editingId ? 'Save changes' : 'Add site'}
          </button>
          {editingId ? (
            <button
              type="button"
              onClick={() => {
                setEditingId(null)
                setDraft(emptyDraft())
              }}
              className="rounded-md border border-zinc-700 px-4 py-2 hover:bg-zinc-800"
            >
              Cancel
            </button>
          ) : null}
        </div>
      </form>
      {sitesQuery.isPending ? <LoadingIndicator label="Loading sites…" /> : null}
      {sitesQuery.isError ? (
        <ErrorPanel
          message={errorText(sitesQuery.error, 'Could not load sites')}
          onRetry={() => {
            void sitesQuery.refetch()
          }}
        />
      ) : null}
      {sitesQuery.data?.length === 0 ? (
        <p className="text-sm text-zinc-400">No watch sites yet. Add one above to use watch links.</p>
      ) : null}
      {sitesQuery.data?.length ? (
        <ul className="space-y-2">
          {sitesQuery.data.map((site) => (
            <li
              key={site.id}
              className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-4 sm:flex-row sm:items-center"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium">{site.name}</p>
                <p className="truncate text-sm text-zinc-400">{site.base_url}</p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(site.id)
                    setDraft(draftFromSite(site))
                  }}
                  className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm hover:bg-zinc-800"
                >
                  Edit
                </button>
                <button
                  type="button"
                  disabled={deleteMutation.isPending}
                  onClick={() => {
                    void onDelete(site)
                  }}
                  className="rounded-md border border-red-500/60 px-3 py-1.5 text-sm text-red-300 hover:bg-red-500/10 disabled:opacity-60"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      {error ? <p className="text-sm text-red-400">{errorText(error, 'Could not update sites')}</p> : null}
      </SettingsSection>
      <SettingsSection
        title="Backup"
        description="Export your library or merge an existing JSON backup."
      >
        <LibraryBackupSection compact />
      </SettingsSection>
      <SettingsSection
        title="Browser extension"
        description="Install the extension and manage its access tokens."
      >
        <div className="space-y-8">
          <ExtensionDownloadSection compact />
          <div className="border-t border-white/10" />
          <ExtensionTokensSection compact />
        </div>
      </SettingsSection>
      {/* <SettingsSection
        title="Support"
        description="Get help or share feedback with the administrator."
      >
        <ContactSupportFooterButton />
      </SettingsSection> */}
      <ContactSupportFooterButton />
    </section>
  )
}

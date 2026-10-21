/** Shared Tailwind class groups (see index.css for `.ui-*` definitions). */
export const UI = {
  page: 'space-y-6 pt-10',
  eyebrow: 'text-[10px] font-semibold uppercase tracking-[0.24em] text-indigo-200/80',
  pageTitle: 'text-2xl font-semibold tracking-tight text-zinc-50 sm:text-3xl',
  pageLead: 'mt-1 max-w-xl text-sm leading-relaxed text-zinc-400',
  card: 'ui-card',
  cardInteractive: 'ui-card ui-card-interactive',
  fieldLabel: 'ui-field-label',
  input: 'ui-input',
  btn: 'ui-btn',
  btnPrimary: 'ui-btn ui-btn-primary',
  btnSecondary: 'ui-btn ui-btn-secondary',
  btnDangerSoft: 'ui-btn ui-btn-danger-soft',
  pill: 'ui-pill',
  pillActive: 'ui-pill ui-pill-active',
  episodePanel: 'ui-episode-panel',
  scrollbar: 'ui-scrollbar',
  tablist: 'ui-tablist',
  episodeBtn: 'ui-episode-btn',
  episodeBtnWatched: 'ui-episode-btn ui-episode-btn-watched',
} as const

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

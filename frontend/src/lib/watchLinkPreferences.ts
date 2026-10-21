export type WatchLinkGroup = 'saved' | 'copied' | 'official'

const STORAGE_KEY = 'anime-tracker-watch-link-group'
const GROUPS: readonly WatchLinkGroup[] = ['saved', 'copied', 'official']

export function getPreferredWatchLinkGroup(): WatchLinkGroup {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return GROUPS.includes(stored as WatchLinkGroup) ? (stored as WatchLinkGroup) : 'saved'
  } catch (error) {
    console.warn('Unable to load the watch link preference.', error)
    return 'saved'
  }
}

export function savePreferredWatchLinkGroup(group: WatchLinkGroup): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, group)
  } catch (error) {
    console.warn('Unable to save the watch link preference.', error)
  }
}

export type WatchLinkGroup = 'saved' | 'official'

const STORAGE_KEY = 'anime-tracker-watch-link-group'

export function getPreferredWatchLinkGroup(): WatchLinkGroup {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'official' ? 'official' : 'saved'
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

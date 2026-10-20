export type BackTarget = {
  label: string
  to: string
}

export type AnimeDetailLocationState = {
  back?: BackTarget
}

export function backFromLibrary(params: URLSearchParams): BackTarget {
  const query = params.toString()
  return {
    label: 'My Collection',
    to: query ? `/?${query}` : '/',
  }
}

export function backFromSearch(params: URLSearchParams): BackTarget {
  const query = params.toString()
  return {
    label: 'Anime Finder',
    to: query ? `/search?${query}` : '/search',
  }
}

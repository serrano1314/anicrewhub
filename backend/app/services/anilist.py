import time
from datetime import datetime, timezone
from collections.abc import Callable
from typing import Protocol

import httpx

from app.core.config import get_settings
from app.schemas.anime import (
    AnimeData,
    AnimeDetails,
    AnimeDiscoveryKind,
    AnimeReview,
    AnimeReviewSort,
    AnimeReviewsResponse,
    AnimeSearchResponse,
    AnimeTag,
    CharacterAvatar,
    ExternalLink,
    RelatedAnime,
)

ANILIST_URL = "https://graphql.anilist.co"
SEARCH_PER_PAGE = 12
MAX_ATTEMPTS = 3
MAX_RETRY_AFTER_SECONDS = 30.0

_MEDIA_SELECTION = """
  id
  idMal
  title {
    romaji
    english
  }
  synonyms
  bannerImage
  coverImage {
    extraLarge
    large
    medium
  }
  description(asHtml: false)
  format
  episodes
  averageScore
  meanScore
  status
  nextAiringEpisode {
    episode
  }
  seasonYear
  externalLinks {
    site
    url
    type
  }
"""

SEARCH_QUERY = f"""
query ($search: String, $page: Int, $perPage: Int) {{
  Page(page: $page, perPage: $perPage) {{
    pageInfo {{
      currentPage
      hasNextPage
    }}
    media(search: $search, type: ANIME, sort: SEARCH_MATCH) {{
      {_MEDIA_SELECTION}
    }}
  }}
}}
"""

DISCOVERY_QUERY = f"""
query ($page: Int, $perPage: Int, $sort: [MediaSort], $status: MediaStatus) {{
  Page(page: $page, perPage: $perPage) {{
    pageInfo {{
      currentPage
      hasNextPage
    }}
    media(type: ANIME, sort: $sort, status: $status) {{
      {_MEDIA_SELECTION}
    }}
  }}
}}
"""

MEDIA_QUERY = f"""
query ($id: Int) {{
  Media(id: $id, type: ANIME) {{
    {_MEDIA_SELECTION}
    bannerImage
    genres
    source
    duration
    countryOfOrigin
    season
    startDate {{ year month day }}
    endDate {{ year month day }}
    popularity
    favourites
    studios(isMain: true) {{ nodes {{ name }} }}
    trailer {{ site id }}
    tags {{ name rank isMediaSpoiler }}
    nextAiringEpisode {{ episode airingAt }}
  }}
}}
"""

RELATED_ANIME_QUERY = """
query ($id: Int) {
  Media(id: $id, type: ANIME) {
    relations {
      edges {
        relationType(version: 2)
        node {
          id
          type
          title { romaji english }
          format
          coverImage { medium }
        }
      }
    }
  }
}
"""

REVIEWS_QUERY = """
query ($id: Int, $page: Int, $perPage: Int, $sort: [ReviewSort]) {
  Media(id: $id, type: ANIME) {
    reviews(page: $page, perPage: $perPage, sort: $sort) {
      pageInfo {
        currentPage
        hasNextPage
      }
      nodes {
        id
        summary
        body
        rating
        ratingAmount
        score
        createdAt
        user {
          name
          avatar {
            large
          }
        }
      }
    }
  }
}
"""

CHARACTER_SEARCH_QUERY = """
query ($search: String, $page: Int, $perPage: Int) {
  Page(page: $page, perPage: $perPage) {
    characters(search: $search, sort: SEARCH_MATCH) {
      id
      name { full }
      image { large medium }
      media(perPage: 1) {
        nodes { title { romaji english } }
      }
    }
  }
}
"""

MEDIA_CHARACTERS_QUERY = """
query ($id: Int, $perPage: Int) {
  Media(id: $id, type: ANIME) {
    title { romaji english }
    characters(perPage: $perPage, sort: ROLE) {
      nodes {
        id
        name { full }
        image { large medium }
      }
    }
  }
}
"""

_HEADERS = {
    "Accept": "application/json",
    "Content-Type": "application/json",
}


class AniListError(Exception):
    pass


class AniListNotFound(AniListError):
    pass


class AniListRateLimited(AniListError):
    pass


class AniListUnavailable(AniListError):
    pass


class HttpPoster(Protocol):
    def post(
        self,
        url: str,
        *,
        json: dict[str, object],
        headers: dict[str, str],
    ) -> httpx.Response: ...


class TtlCache:
    def __init__(self, ttl_seconds: float, clock: Callable[[], float] = time.monotonic) -> None:
        self._ttl_seconds = ttl_seconds
        self._clock = clock
        self._items: dict[tuple[str, int], tuple[float, AnimeSearchResponse]] = {}

    def get(self, key: tuple[str, int]) -> AnimeSearchResponse | None:
        item = self._items.get(key)
        if item is None:
            return None
        expires_at, value = item
        if self._clock() >= expires_at:
            del self._items[key]
            return None
        return value

    def set(self, key: tuple[str, int], value: AnimeSearchResponse) -> None:
        self._items[key] = (self._clock() + self._ttl_seconds, value)


def normalize_search_query(query: str) -> str:
    return " ".join(query.split()).casefold()


def _as_int(value: object) -> int | None:
    if isinstance(value, bool) or not isinstance(value, int):
        return None
    return value


def _as_str(value: object) -> str | None:
    if isinstance(value, str) and value.strip():
        return value
    return None


def _date_label(value: object) -> str | None:
    if not isinstance(value, dict):
        return None
    year = _as_int(value.get("year"))
    month = _as_int(value.get("month"))
    day = _as_int(value.get("day"))
    if year is None:
        return None
    if month is None:
        return str(year)
    if day is None:
        return f"{year}-{month:02d}"
    return f"{year}-{month:02d}-{day:02d}"


def _detail_names(value: object) -> list[str]:
    if not isinstance(value, list):
        return []
    return [name for item in value if isinstance(item, str) and (name := _as_str(item))]


def _map_details(media: dict[str, object]) -> AnimeDetails:
    studios: list[str] = []
    raw_studios = media.get("studios")
    nodes = raw_studios.get("nodes") if isinstance(raw_studios, dict) else None
    if isinstance(nodes, list):
        studios = [
            name
            for item in nodes
            if isinstance(item, dict) and (name := _as_str(item.get("name")))
        ]

    tags: list[AnimeTag] = []
    raw_tags = media.get("tags")
    if isinstance(raw_tags, list):
        for item in raw_tags:
            if not isinstance(item, dict):
                continue
            name = _as_str(item.get("name"))
            if name:
                tags.append(
                    AnimeTag(
                        name=name,
                        rank=_as_int(item.get("rank")),
                        is_spoiler=bool(item.get("isMediaSpoiler")),
                    )
                )

    trailer_url: str | None = None
    trailer = media.get("trailer")
    if isinstance(trailer, dict):
        trailer_site = _as_str(trailer.get("site"))
        trailer_id = _as_str(trailer.get("id"))
        if trailer_site == "youtube" and trailer_id:
            trailer_url = f"https://www.youtube.com/watch?v={trailer_id}"
        elif trailer_site == "dailymotion" and trailer_id:
            trailer_url = f"https://www.dailymotion.com/video/{trailer_id}"

    next_airing = media.get("nextAiringEpisode")
    next_episode = next_airing.get("episode") if isinstance(next_airing, dict) else None
    next_airing_at = next_airing.get("airingAt") if isinstance(next_airing, dict) else None

    return AnimeDetails(
        genres=_detail_names(media.get("genres")),
        studios=studios,
        tags=tags,
        source=_as_str(media.get("source")),
        duration_minutes=_as_int(media.get("duration")),
        country_of_origin=_as_str(media.get("countryOfOrigin")),
        season=_as_str(media.get("season")),
        start_date=_date_label(media.get("startDate")),
        end_date=_date_label(media.get("endDate")),
        popularity=_as_int(media.get("popularity")),
        favorites=_as_int(media.get("favourites")),
        banner_url=_as_str(media.get("bannerImage")),
        trailer_url=trailer_url,
        next_episode=_as_int(next_episode),
        next_airing_at=_as_int(next_airing_at),
    )


def map_related_anime(media: object) -> list[RelatedAnime]:
    if not isinstance(media, dict):
        return []
    related: list[RelatedAnime] = []
    raw_relations = media.get("relations")
    edges = raw_relations.get("edges") if isinstance(raw_relations, dict) else None
    if isinstance(edges, list):
        for edge in edges:
            if not isinstance(edge, dict):
                continue
            node = edge.get("node")
            if not isinstance(node, dict) or node.get("type") != "ANIME":
                continue
            related_id = _as_int(node.get("id"))
            if related_id is None:
                continue
            title = node.get("title")
            title_text = (
                _as_str(title.get("english")) or _as_str(title.get("romaji"))
                if isinstance(title, dict)
                else None
            )
            if not title_text:
                continue
            cover = node.get("coverImage")
            related.append(
                RelatedAnime(
                    anilist_id=related_id,
                    title=title_text,
                    relation=_as_str(edge.get("relationType")) or "RELATED",
                    format=_as_str(node.get("format")),
                    cover_url=_as_str(cover.get("medium")) if isinstance(cover, dict) else None,
                )
            )
    return related


def episode_count(media: dict[str, object], airing_status: str | None) -> int | None:
    """Prefer AniList's finished total. While a show is airing and that total is missing, use episodes aired so far."""
    total = _as_int(media.get("episodes"))
    if total is not None:
        return total
    if airing_status != "RELEASING":
        return None
    upcoming = media.get("nextAiringEpisode")
    if not isinstance(upcoming, dict):
        return None
    next_episode = _as_int(upcoming.get("episode"))
    if next_episode is None or next_episode <= 1:
        return None
    return next_episode - 1


def map_media(media: object) -> AnimeData | None:
    if not isinstance(media, dict):
        return None
    anilist_id = _as_int(media.get("id"))
    if anilist_id is None:
        return None

    title = media.get("title")
    romaji: str | None = None
    english: str | None = None
    if isinstance(title, dict):
        romaji = _as_str(title.get("romaji"))
        english = _as_str(title.get("english"))

    synonyms: list[str] = []
    raw_synonyms = media.get("synonyms")
    if isinstance(raw_synonyms, list):
        synonyms = [item for item in raw_synonyms if isinstance(item, str) and item.strip()]

    cover_url: str | None = None
    cover = media.get("coverImage")
    if isinstance(cover, dict):
        cover_url = (
            _as_str(cover.get("extraLarge"))
            or _as_str(cover.get("large"))
            or _as_str(cover.get("medium"))
        )
    links: list[ExternalLink] = []
    raw_links = media.get("externalLinks")
    if isinstance(raw_links, list):
        for item in raw_links:
            if not isinstance(item, dict) or item.get("type") != "STREAMING":
                continue
            site = _as_str(item.get("site"))
            url = _as_str(item.get("url"))
            if site and url:
                links.append(ExternalLink(site=site, url=url))

    airing_status = _as_str(media.get("status"))
    average_score = _as_int(media.get("averageScore"))
    if average_score is None:
        average_score = _as_int(media.get("meanScore"))

    return AnimeData(
        anilist_id=anilist_id,
        mal_id=_as_int(media.get("idMal")),
        title_romaji=romaji or english or "Unknown",
        title_english=english,
        title_synonyms=synonyms,
        cover_url=cover_url,
        description=_as_str(media.get("description")),
        format=_as_str(media.get("format")),
        total_episodes=episode_count(media, airing_status),
        average_score=average_score,
        airing_status=airing_status,
        season_year=_as_int(media.get("seasonYear")),
        external_links=links,
        details=_map_details(media),
    )


def map_character_avatar(character: object, anime_title: str | None = None) -> CharacterAvatar | None:
    if not isinstance(character, dict):
        return None
    character_id = _as_int(character.get("id"))
    name = character.get("name")
    image = character.get("image")
    character_name = name.get("full") if isinstance(name, dict) else None
    image_url = (
        image.get("large") or image.get("medium")
        if isinstance(image, dict)
        else None
    )
    if character_id is None or not isinstance(character_name, str) or not character_name.strip():
        return None
    if not isinstance(image_url, str) or not image_url.strip():
        return None
    return CharacterAvatar(
        anilist_id=character_id,
        name=character_name.strip(),
        image_url=image_url,
        anime_title=anime_title,
    )


def _retry_delay(response: httpx.Response, attempt: int) -> float:
    header = response.headers.get("Retry-After", "").strip()
    if header:
        try:
            seconds = float(header)
        except ValueError:
            seconds = -1
        if seconds >= 0:
            return min(seconds, MAX_RETRY_AFTER_SECONDS)
    return min(float(2 ** (attempt - 1)), MAX_RETRY_AFTER_SECONDS)


def _raise_for_graphql(payload: dict[str, object]) -> None:
    errors = payload.get("errors")
    if not isinstance(errors, list) or not errors:
        return
    for error in errors:
        if isinstance(error, dict) and error.get("status") == 404:
            raise AniListNotFound("Anime not found")
    raise AniListError("AniList request failed")


class AniListClient:
    def __init__(
        self,
        http_client: HttpPoster | None = None,
        *,
        search_ttl_seconds: float = 300,
        sleep: Callable[[float], None] = time.sleep,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self._http = http_client or httpx.Client(timeout=get_settings().ANILIST_TIMEOUT_SECONDS)
        self._sleep = sleep
        self._cache = TtlCache(search_ttl_seconds, clock)

    def search(self, query: str, page: int) -> AnimeSearchResponse:
        normalized = normalize_search_query(query)
        if not normalized:
            raise AniListError("Search query is required")
        key = (normalized, page)
        cached = self._cache.get(key)
        if cached is not None:
            return cached

        payload = self._post(
            SEARCH_QUERY,
            {"search": normalized, "page": page, "perPage": SEARCH_PER_PAGE},
        )
        data = payload.get("data")
        page_data = data.get("Page") if isinstance(data, dict) else None
        if not isinstance(page_data, dict):
            raise AniListUnavailable("AniList returned an unexpected search payload")

        info = page_data.get("pageInfo")
        current_page = page
        has_next_page = False
        if isinstance(info, dict):
            parsed_page = _as_int(info.get("currentPage"))
            if parsed_page is not None:
                current_page = parsed_page
            has_next_page = bool(info.get("hasNextPage"))

        results: list[AnimeData] = []
        media = page_data.get("media")
        if isinstance(media, list):
            for item in media:
                mapped = map_media(item)
                if mapped is not None:
                    results.append(mapped)

        result = AnimeSearchResponse(
            page=current_page,
            has_next_page=has_next_page,
            results=results,
        )
        self._cache.set(key, result)
        return result

    def search_characters(self, query: str, page: int = 1) -> list[CharacterAvatar]:
        payload = self._post(
            CHARACTER_SEARCH_QUERY,
            {"search": normalize_search_query(query), "page": page, "perPage": 10},
        )
        data = payload.get("data")
        page_data = data.get("Page") if isinstance(data, dict) else None
        raw_characters = page_data.get("characters") if isinstance(page_data, dict) else None
        if not isinstance(raw_characters, list):
            raise AniListUnavailable("AniList returned an unexpected character search payload")

        results: list[CharacterAvatar] = []
        for character in raw_characters:
            anime_title: str | None = None
            if isinstance(character, dict):
                media = character.get("media")
                nodes = media.get("nodes") if isinstance(media, dict) else None
                first_media = nodes[0] if isinstance(nodes, list) and nodes else None
                title = first_media.get("title") if isinstance(first_media, dict) else None
                if isinstance(title, dict):
                    anime_title = _as_str(title.get("english")) or _as_str(title.get("romaji"))
            mapped = map_character_avatar(character, anime_title)
            if mapped is not None:
                results.append(mapped)
        return results

    def fetch_characters(self, anilist_id: int, limit: int = 10) -> list[CharacterAvatar]:
        payload = self._post(
            MEDIA_CHARACTERS_QUERY,
            {"id": anilist_id, "perPage": limit},
        )
        data = payload.get("data")
        media = data.get("Media") if isinstance(data, dict) else None
        if not isinstance(media, dict):
            raise AniListNotFound("Anime not found")
        title = media.get("title")
        anime_title = (
            _as_str(title.get("english")) or _as_str(title.get("romaji"))
            if isinstance(title, dict)
            else None
        )
        characters = media.get("characters")
        nodes = characters.get("nodes") if isinstance(characters, dict) else None
        if not isinstance(nodes, list):
            raise AniListUnavailable("AniList returned an unexpected character payload")
        results: list[CharacterAvatar] = []
        for character in nodes:
            mapped = map_character_avatar(character, anime_title)
            if mapped is not None:
                results.append(mapped)
        return results

    def discover(self, kind: AnimeDiscoveryKind) -> AnimeSearchResponse:
        key = (f"discover:{kind.value}", 1)
        cached = self._cache.get(key)
        if cached is not None:
            return cached

        variables: dict[str, object] = {
            "page": 1,
            "perPage": 10,
            "sort": ["START_DATE_DESC"] if kind == AnimeDiscoveryKind.latest else ["TRENDING_DESC"],
        }
        if kind == AnimeDiscoveryKind.latest:
            variables["status"] = "RELEASING"

        payload = self._post(DISCOVERY_QUERY, variables)
        data = payload.get("data")
        page_data = data.get("Page") if isinstance(data, dict) else None
        if not isinstance(page_data, dict):
            raise AniListUnavailable("AniList returned an unexpected discovery payload")

        info = page_data.get("pageInfo")
        current_page = 1
        has_next_page = False
        if isinstance(info, dict):
            parsed_page = _as_int(info.get("currentPage"))
            if parsed_page is not None:
                current_page = parsed_page
            has_next_page = bool(info.get("hasNextPage"))

        media = page_data.get("media")
        results = []
        if isinstance(media, list):
            for item in media:
                mapped = map_media(item)
                if mapped is not None:
                    results.append(mapped)

        result = AnimeSearchResponse(page=current_page, has_next_page=has_next_page, results=results)
        self._cache.set(key, result)
        return result

    def fetch_media(self, anilist_id: int) -> AnimeData:
        payload = self._post(MEDIA_QUERY, {"id": anilist_id})
        data = payload.get("data")
        media = data.get("Media") if isinstance(data, dict) else None
        if media is None:
            raise AniListNotFound("Anime not found")
        mapped = map_media(media)
        if mapped is None:
            raise AniListUnavailable("AniList returned an unexpected anime payload")
        return mapped

    def fetch_related(self, anilist_id: int) -> list[RelatedAnime]:
        payload = self._post(RELATED_ANIME_QUERY, {"id": anilist_id})
        data = payload.get("data")
        media = data.get("Media") if isinstance(data, dict) else None
        if media is None:
            raise AniListNotFound("Anime not found")
        return map_related_anime(media)

    def fetch_reviews(
        self,
        anilist_id: int,
        page: int,
        sort: AnimeReviewSort,
    ) -> AnimeReviewsResponse:
        sort_value = {
            AnimeReviewSort.newest: "ID_DESC",
            AnimeReviewSort.highest: "RATING_DESC",
            AnimeReviewSort.lowest: "RATING",
        }[sort]
        payload = self._post(
            REVIEWS_QUERY,
            {"id": anilist_id, "page": page, "perPage": 5, "sort": [sort_value]},
        )
        data = payload.get("data")
        media = data.get("Media") if isinstance(data, dict) else None
        reviews_page = media.get("reviews") if isinstance(media, dict) else None
        if not isinstance(reviews_page, dict):
            raise AniListUnavailable("AniList returned an unexpected reviews payload")

        info = reviews_page.get("pageInfo")
        current_page = page
        has_next_page = False
        if isinstance(info, dict):
            parsed_page = _as_int(info.get("currentPage"))
            if parsed_page is not None:
                current_page = parsed_page
            has_next_page = bool(info.get("hasNextPage"))

        reviews: list[AnimeReview] = []
        nodes = reviews_page.get("nodes")
        if isinstance(nodes, list):
            for node in nodes:
                if not isinstance(node, dict):
                    continue
                user = node.get("user")
                user_name = _as_str(user.get("name")) if isinstance(user, dict) else None
                avatar = user.get("avatar") if isinstance(user, dict) else None
                user_avatar_url = _as_str(avatar.get("large")) if isinstance(avatar, dict) else None
                body = _as_str(node.get("body"))
                review_id = _as_int(node.get("id"))
                created_at = _as_int(node.get("createdAt"))
                if review_id is None or not user_name or not body or created_at is None:
                    continue
                reviews.append(
                    AnimeReview(
                        id=review_id,
                        summary=_as_str(node.get("summary")),
                        body=body,
                        rating=_as_int(node.get("rating")),
                        rating_amount=_as_int(node.get("ratingAmount")),
                        score=_as_int(node.get("score")),
                        user_name=user_name,
                        user_avatar_url=user_avatar_url,
                        created_at=datetime.fromtimestamp(created_at, tz=timezone.utc),
                    )
                )
        return AnimeReviewsResponse(
            page=current_page,
            has_next_page=has_next_page,
            reviews=reviews,
        )

    def _post(self, query: str, variables: dict[str, object]) -> dict[str, object]:
        body: dict[str, object] = {"query": query, "variables": variables}
        attempt = 0
        while True:
            attempt += 1
            try:
                response = self._http.post(ANILIST_URL, json=body, headers=_HEADERS)
            except httpx.TimeoutException as exc:
                raise AniListUnavailable("AniList timed out") from exc
            except httpx.HTTPError as exc:
                raise AniListUnavailable("AniList request failed") from exc

            if response.status_code == 429:
                if attempt >= MAX_ATTEMPTS:
                    raise AniListRateLimited("AniList rate limit")
                self._sleep(_retry_delay(response, attempt))
                continue
            if response.status_code >= 500:
                raise AniListUnavailable("AniList is unavailable")
            if response.status_code != 200:
                raise AniListError("AniList request failed")
            payload = _read_json(response)
            _raise_for_graphql(payload)
            return payload


def _read_json(response: httpx.Response) -> dict[str, object]:
    try:
        payload = response.json()
    except ValueError as exc:
        raise AniListUnavailable("AniList returned invalid JSON") from exc
    if not isinstance(payload, dict):
        raise AniListUnavailable("AniList returned invalid JSON")
    return payload


_client: AniListClient | None = None


def get_anilist_client() -> AniListClient:
    global _client
    if _client is None:
        settings = get_settings()
        _client = AniListClient(
            httpx.Client(timeout=settings.ANILIST_TIMEOUT_SECONDS),
            search_ttl_seconds=settings.ANILIST_SEARCH_CACHE_TTL_SECONDS,
        )
    return _client

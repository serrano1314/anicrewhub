from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.anime import Anime
from app.models.library import UserAnime
from app.models.user import User
from app.schemas.anime import CharacterAvatar
from app.services.anilist import AniListClient, get_anilist_client

ONE_PIECE_ANILIST_ID = 21
MAX_RECOMMENDATION_ANIME = 5
DEFAULT_CHARACTER_PAGE_SIZE = 10


def _deduplicate(characters: list[CharacterAvatar]) -> list[CharacterAvatar]:
    unique: list[CharacterAvatar] = []
    seen: set[int] = set()
    for character in characters:
        if character.anilist_id in seen:
            continue
        seen.add(character.anilist_id)
        unique.append(character)
    return unique


def _library_anime_ids(db: Session, user: User) -> list[int]:
    rows = db.scalars(
        select(Anime.anilist_id)
        .join(UserAnime, UserAnime.anime_id == Anime.id)
        .where(UserAnime.user_id == user.id)
        .order_by(UserAnime.is_favorite.desc(), UserAnime.updated_at.desc())
        .limit(MAX_RECOMMENDATION_ANIME)
    ).all()
    return list(rows)


def list_character_avatars(
    db: Session,
    user: User,
    query: str | None = None,
    offset: int = 0,
    limit: int = DEFAULT_CHARACTER_PAGE_SIZE,
    client: AniListClient | None = None,
) -> tuple[list[CharacterAvatar], bool]:
    anilist = client or get_anilist_client()
    normalized_query = " ".join((query or "").split())
    if normalized_query:
        pages = max(1, (offset + limit + 9) // 10)
        characters: list[CharacterAvatar] = []
        for page in range(1, pages + 1):
            characters.extend(anilist.search_characters(normalized_query, page))
        anime_results = anilist.search(normalized_query, 1).results[:3]
        for anime in anime_results:
            characters.extend(anilist.fetch_characters(anime.anilist_id))
        unique = _deduplicate(characters)
        return unique[offset : offset + limit], len(unique) > offset + limit

    anime_ids = _library_anime_ids(db, user) or [ONE_PIECE_ANILIST_ID]
    characters: list[CharacterAvatar] = []
    for anime_id in anime_ids:
        characters.extend(anilist.fetch_characters(anime_id))
    unique = _deduplicate(characters)
    return unique[offset : offset + limit], len(unique) > offset + limit

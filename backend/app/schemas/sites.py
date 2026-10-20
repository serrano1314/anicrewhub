from urllib.parse import urlsplit
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


def require_http_url(value: str) -> str:
    cleaned = value.strip()
    if not cleaned:
        raise ValueError("URL is required")
    parts = urlsplit(cleaned)
    if parts.scheme not in {"http", "https"} or not parts.netloc:
        raise ValueError("URL must start with http:// or https://")
    return cleaned


def _blank_to_none(value: object) -> object:
    if isinstance(value, str) and not value.strip():
        return None
    return value


class SiteCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    base_url: str = Field(min_length=1, max_length=2000)
    episode_url_template: str | None = Field(default=None, max_length=2000)
    search_url_template: str | None = Field(default=None, max_length=2000)

    @field_validator("name")
    @classmethod
    def clean_name(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Name is required")
        return cleaned

    @field_validator("base_url")
    @classmethod
    def clean_base_url(cls, value: str) -> str:
        return require_http_url(value)

    @field_validator("episode_url_template", "search_url_template", mode="before")
    @classmethod
    def blank_template(cls, value: object) -> object:
        return _blank_to_none(value)

    @field_validator("episode_url_template", "search_url_template")
    @classmethod
    def clean_template(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return require_http_url(value)


class SiteUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    base_url: str | None = Field(default=None, max_length=2000)
    episode_url_template: str | None = Field(default=None, max_length=2000)
    search_url_template: str | None = Field(default=None, max_length=2000)

    @field_validator("name")
    @classmethod
    def clean_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Name is required")
        return cleaned

    @field_validator("base_url")
    @classmethod
    def clean_base_url(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return require_http_url(value)

    @field_validator("episode_url_template", "search_url_template", mode="before")
    @classmethod
    def blank_template(cls, value: object) -> object:
        return _blank_to_none(value)

    @field_validator("episode_url_template", "search_url_template")
    @classmethod
    def clean_template(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return require_http_url(value)


class SiteResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    base_url: str
    episode_url_template: str | None
    search_url_template: str | None


class AnimeSiteCreateRequest(BaseModel):
    site_id: UUID
    anime_url: str | None = Field(default=None, max_length=2000)

    @field_validator("anime_url", mode="before")
    @classmethod
    def blank_anime_url(cls, value: object) -> object:
        return _blank_to_none(value)

    @field_validator("anime_url")
    @classmethod
    def clean_anime_url(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return require_http_url(value)


class AnimeSiteUpdateRequest(BaseModel):
    anime_url: str | None = Field(default=None, max_length=2000)

    @field_validator("anime_url", mode="before")
    @classmethod
    def blank_anime_url(cls, value: object) -> object:
        return _blank_to_none(value)

    @field_validator("anime_url")
    @classmethod
    def clean_anime_url(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return require_http_url(value)


class AnimeSiteResponse(BaseModel):
    site_id: UUID
    name: str
    base_url: str
    episode_url_template: str | None
    search_url_template: str | None
    anime_url: str | None

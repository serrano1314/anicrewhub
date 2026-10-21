from enum import StrEnum

from pydantic import BaseModel


class WatchLinkSource(StrEnum):
    saved = "saved"
    copied = "copied"
    official = "official"
    search = "search"


class WatchLink(BaseModel):
    label: str
    url: str
    source: WatchLinkSource

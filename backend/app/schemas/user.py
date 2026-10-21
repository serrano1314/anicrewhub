from uuid import UUID

from typing import Annotated

from pydantic import BaseModel, ConfigDict, EmailStr, Field, StringConstraints

AvatarId = Annotated[str, StringConstraints(pattern=r"^[1-9][0-9]*$", max_length=8)]


class AvatarUpdateRequest(BaseModel):
    avatar_id: AvatarId | None = Field(...)


class ProfileUpdateRequest(BaseModel):
    email: EmailStr
    username: str = Field(min_length=3, max_length=32, pattern=r"^[a-zA-Z0-9_]+$")


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: EmailStr
    username: str
    avatar_id: AvatarId | None = None
    profile_public: bool = True
    share_collection: bool = True
    share_watch_sites: bool = True
    terms_accepted: bool = False

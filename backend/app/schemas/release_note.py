from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ReleaseNoteResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    version: str
    content_html: str
    created_at: datetime

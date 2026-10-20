from fastapi import APIRouter, Depends, HTTPException, Path, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.release_note import ReleaseNote
from app.models.user import User
from app.schemas.release_note import ReleaseNoteResponse

router = APIRouter(tags=["release notes"])


@router.get("/release-notes/{version}", response_model=ReleaseNoteResponse)
def read_release_note(
    version: str = Path(min_length=1, max_length=32, pattern=r"^[0-9]+\.[0-9]+\.[0-9]+$"),
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
) -> ReleaseNoteResponse:
    release_note = db.get(ReleaseNote, version)
    if release_note is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Release notes not found",
        )
    return ReleaseNoteResponse.model_validate(release_note)

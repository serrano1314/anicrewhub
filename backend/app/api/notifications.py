from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.core.deps import require_accepted_terms
from app.db.session import get_db
from app.models.user import User
from app.schemas.notifications import NotificationListResponse
from app.services.notifications import (
    clear_notification,
    clear_notifications,
    list_notifications,
    mark_notifications_read,
)

router = APIRouter(tags=["notifications"])


@router.get("/me/notifications", response_model=NotificationListResponse)
def get_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_accepted_terms),
) -> NotificationListResponse:
    return list_notifications(db, current_user)


@router.post("/me/notifications/read", status_code=status.HTTP_204_NO_CONTENT)
def read_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_accepted_terms),
) -> Response:
    mark_notifications_read(db, current_user)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/me/notifications", status_code=status.HTTP_204_NO_CONTENT)
def delete_all_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_accepted_terms),
) -> Response:
    clear_notifications(db, current_user)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/me/notifications/{notification_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_notification(
    notification_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_accepted_terms),
) -> Response:
    if not clear_notification(db, current_user, notification_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)

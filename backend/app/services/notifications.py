from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.models.notification import Notification
from app.models.user import User
from app.schemas.notifications import NotificationItem, NotificationListResponse

TYPE_FOLLOW_REQUEST = "follow_request"
TYPE_FOLLOW = "follow"
LIST_LIMIT = 20


def create_notification(
    db: Session,
    *,
    recipient: User,
    notification_type: str,
    title: str,
    actor: User | None = None,
    body: str | None = None,
    href: str | None = None,
) -> Notification:
    notification = Notification(
        user_id=recipient.id,
        type=notification_type,
        actor_user_id=None if actor is None else actor.id,
        actor_username=None if actor is None else actor.username,
        title=title,
        body=body,
        href=href,
        created_at=datetime.now(timezone.utc),
    )
    db.add(notification)
    return notification


def delete_actor_notifications(
    db: Session,
    *,
    recipient_id: UUID,
    actor_id: UUID,
    notification_type: str,
) -> None:
    db.execute(
        delete(Notification).where(
            Notification.user_id == recipient_id,
            Notification.actor_user_id == actor_id,
            Notification.type == notification_type,
        )
    )


def list_notifications(db: Session, user: User) -> NotificationListResponse:
    rows = db.scalars(
        select(Notification)
        .where(Notification.user_id == user.id)
        .order_by(Notification.created_at.desc())
        .limit(LIST_LIMIT)
    ).all()
    unread_count = int(
        db.scalar(
            select(func.count())
            .select_from(Notification)
            .where(Notification.user_id == user.id, Notification.read_at.is_(None))
        )
        or 0
    )
    return NotificationListResponse(
        unread_count=unread_count,
        notifications=[
            NotificationItem(
                id=row.id,
                type=row.type,
                title=row.title,
                body=row.body,
                actor_username=row.actor_username,
                href=row.href,
                read=row.read_at is not None,
                created_at=row.created_at,
            )
            for row in rows
        ],
    )


def clear_notifications(db: Session, user: User) -> None:
    db.execute(delete(Notification).where(Notification.user_id == user.id))
    db.commit()


def clear_notification(db: Session, user: User, notification_id: UUID) -> bool:
    result = db.execute(
        delete(Notification).where(Notification.id == notification_id, Notification.user_id == user.id)
    )
    db.commit()
    return result.rowcount > 0


def mark_notifications_read(db: Session, user: User) -> None:
    now = datetime.now(timezone.utc)
    rows = db.scalars(
        select(Notification).where(Notification.user_id == user.id, Notification.read_at.is_(None))
    ).all()
    for row in rows:
        row.read_at = now
    db.commit()

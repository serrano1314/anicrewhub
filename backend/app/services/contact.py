import logging
import time

from fastapi import HTTPException, status

from app.models.user import User
from app.services.mailer import send_admin_email, smtp_configured

logger = logging.getLogger(__name__)

MIN_FORM_SECONDS = 2
MAX_FORM_SECONDS = 24 * 60 * 60


def submit_contact_ticket(
    user: User,
    subject: str,
    message: str,
    website_honeypot: str,
    started_at_ms: int,
) -> bool:
    """
    Returns True when a ticket was accepted and delivery was attempted.
    Returns False for honeypot spam (caller should still respond 204).
    """
    if website_honeypot.strip():
        logger.info("Contact honeypot triggered for user %s", user.id)
        return False

    now_ms = int(time.time() * 1000)
    elapsed_ms = now_ms - started_at_ms
    if elapsed_ms < MIN_FORM_SECONDS * 1000 or elapsed_ms > MAX_FORM_SECONDS * 1000:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not send your message. Please wait a moment and try again.",
        )

    if not smtp_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Contact is temporarily unavailable. Try again later.",
        )

    email_subject = f"[AnimeCrew Hub] {subject}"
    body = (
        f"Support ticket from AnimeCrew Hub\n\n"
        f"Username: {user.username}\n"
        f"Email: {user.email}\n"
        f"User id: {user.id}\n"
        f"Subject: {subject}\n\n"
        f"{message}\n"
    )
    try:
        send_admin_email(email_subject, body, reply_to=user.email)
    except Exception:
        logger.exception("Failed to deliver contact ticket for user %s", user.id)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Could not send your message right now. Try again later.",
        ) from None
    return True

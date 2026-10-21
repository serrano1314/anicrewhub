from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_accepted_terms
from app.core.rate_limit import enforce_rate_limit
from app.db.session import get_db
from app.models.user import User
from app.schemas.contact import ContactTicketRequest
from app.services.contact import submit_contact_ticket

router = APIRouter(prefix="/support", tags=["support"], dependencies=[Depends(require_accepted_terms)])


@router.post("/tickets", status_code=status.HTTP_204_NO_CONTENT)
def create_support_ticket(
    request: Request,
    body: ContactTicketRequest,
    current_user: User = Depends(get_current_user),
    _db: Session = Depends(get_db),
) -> None:
    enforce_rate_limit(request, "contact")
    enforce_rate_limit(request, "contact", subject=str(current_user.id))
    submit_contact_ticket(
        current_user,
        body.subject,
        body.message,
        body.website,
        body.started_at_ms,
    )  # honeypot spam still returns 204

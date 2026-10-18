from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_refresh_token_subject
from app.core.rate_limit import enforce_rate_limit
from app.core.security import (
    clear_refresh_cookie,
    create_access_token,
    create_refresh_token,
    set_refresh_cookie,
)
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import (
    ChangePasswordRequest,
    ForgotPasswordRequest,
    LoginRequest,
    RegisterRequest,
    ResetPasswordRequest,
    TokenResponse,
)
from app.schemas.user import UserResponse
from app.services.auth import authenticate_user, get_user_by_id, register_user
from app.services.password_reset import change_password, request_password_reset, reset_password_with_token

router = APIRouter(prefix="/auth", tags=["auth"])


def _issue_tokens(response: Response, user: User) -> TokenResponse:
    set_refresh_cookie(response, create_refresh_token(user.id))
    return TokenResponse(access_token=create_access_token(user.id))


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(
    request: Request,
    body: RegisterRequest,
    response: Response,
    db: Session = Depends(get_db),
) -> TokenResponse:
    enforce_rate_limit(request, "auth")
    user = register_user(db, body.email, body.username, body.password)
    return _issue_tokens(response, user)


@router.post("/login", response_model=TokenResponse)
def login(
    request: Request,
    body: LoginRequest,
    response: Response,
    db: Session = Depends(get_db),
) -> TokenResponse:
    enforce_rate_limit(request, "auth")
    user = authenticate_user(db, body.email, body.password)
    return _issue_tokens(response, user)


@router.post("/refresh", response_model=TokenResponse)
def refresh(
    request: Request,
    response: Response,
    user_id: UUID = Depends(get_refresh_token_subject),
    db: Session = Depends(get_db),
) -> TokenResponse:
    enforce_rate_limit(request, "auth")
    user = get_user_by_id(db, user_id)
    if user is None:
        clear_refresh_cookie(response)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return _issue_tokens(response, user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    response: Response,
    _current_user: User = Depends(get_current_user),
) -> None:
    clear_refresh_cookie(response)


@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user)) -> User:
    return current_user


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
def change_password_route(
    body: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    change_password(db, current_user, body.current_password, body.new_password)


@router.post("/forgot-password", status_code=status.HTTP_204_NO_CONTENT)
def forgot_password(
    request: Request,
    body: ForgotPasswordRequest,
    db: Session = Depends(get_db),
) -> None:
    enforce_rate_limit(request, "auth")
    request_password_reset(db, body.email)


@router.post("/reset-password", status_code=status.HTTP_204_NO_CONTENT)
def reset_password(
    request: Request,
    body: ResetPasswordRequest,
    db: Session = Depends(get_db),
) -> None:
    enforce_rate_limit(request, "auth")
    reset_password_with_token(db, body.token, body.new_password)

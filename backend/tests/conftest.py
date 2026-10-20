import os

os.environ.setdefault("DATABASE_URL", "postgresql://user:pass@localhost/test")
os.environ.setdefault("DIRECT_URL", "postgresql://user:pass@localhost/test")
os.environ.setdefault("CORS_ORIGINS", "http://localhost:5173")
os.environ.setdefault("JWT_SECRET", "test-jwt-secret-key-32chars-min!")
os.environ.setdefault("COOKIE_SECURE", "false")

from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.db.session import get_db
from app.core.rate_limit import reset_rate_limits_for_tests
from app.main import app
from app.models.anime import Anime as AnimeModel
from app.models.extension import ExtensionTitleMap as ExtensionTitleMapModel
from app.models.extension import ExtensionToken as ExtensionTokenModel
from app.models.library import EpisodeProgress as EpisodeProgressModel
from app.models.library import UserAnime as UserAnimeModel
from app.models.sites import UserAnimeSite as UserAnimeSiteModel
from app.models.sites import UserSite as UserSiteModel
from app.models.password_reset import PasswordResetToken as PasswordResetTokenModel
from app.models.release_note import ReleaseNote as ReleaseNoteModel
from app.models.user import User as UserModel

_ = AnimeModel
_ = EpisodeProgressModel
_ = ExtensionTitleMapModel
_ = ExtensionTokenModel
_ = UserAnimeModel
_ = UserAnimeSiteModel
_ = UserSiteModel
_ = PasswordResetTokenModel
_ = ReleaseNoteModel
_ = UserModel

engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


@pytest.fixture(autouse=True)
def _reset_rate_limits() -> Generator[None, None, None]:
    reset_rate_limits_for_tests()
    yield
    reset_rate_limits_for_tests()


@pytest.fixture
def db() -> Generator[Session, None, None]:
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client(db: Session) -> Generator[TestClient, None, None]:
    def override_get_db() -> Generator[Session, None, None]:
        yield db

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()

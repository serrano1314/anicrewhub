from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

from app.core.config import get_settings
from app.core.db_url import to_sqlalchemy_url
from app.db.base import Base
from app.models.anime import Anime as AnimeModel
from app.models.extension import ExtensionTitleMap as ExtensionTitleMapModel
from app.models.extension import ExtensionToken as ExtensionTokenModel
from app.models.library import EpisodeProgress as EpisodeProgressModel
from app.models.library import UserAnime as UserAnimeModel
from app.models.sites import UserAnimeSite as UserAnimeSiteModel
from app.models.sites import UserSite as UserSiteModel
from app.models.password_reset import PasswordResetToken as PasswordResetTokenModel
from app.models.release_note import ReleaseNote as ReleaseNoteModel
from app.models.notification import Notification as NotificationModel
from app.models.social import CopiedSite as CopiedSiteModel
from app.models.social import UserFollow as UserFollowModel
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
_ = NotificationModel
_ = CopiedSiteModel
_ = UserFollowModel
_ = UserModel

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

settings = get_settings()
config.set_main_option("sqlalchemy.url", to_sqlalchemy_url(settings.DIRECT_URL))

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()

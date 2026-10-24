"""add AniList character avatar URLs

Revision ID: 0020_user_avatar_url
Revises: 0019_share_favorites_only
Create Date: 2026-10-24

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "0020_user_avatar_url"
down_revision: Union[str, Sequence[str], None] = "0019_share_favorites_only"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("avatar_url", sa.String(length=500), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "avatar_url")

"""add selectable user avatar

Revision ID: 0009_user_avatar
Revises: 0008_library_favorites
Create Date: 2026-10-20

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0009_user_avatar"
down_revision: Union[str, Sequence[str], None] = "0008_library_favorites"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("avatar_id", sa.String(length=16), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "avatar_id")

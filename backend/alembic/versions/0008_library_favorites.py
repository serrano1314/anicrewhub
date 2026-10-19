"""add library favorites

Revision ID: 0008_library_favorites
Revises: 0007_password_reset_tokens
Create Date: 2026-10-19

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0008_library_favorites"
down_revision: Union[str, Sequence[str], None] = "0007_password_reset_tokens"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "user_anime",
        sa.Column("is_favorite", sa.Boolean(), server_default=sa.false(), nullable=False),
    )


def downgrade() -> None:
    op.drop_column("user_anime", "is_favorite")

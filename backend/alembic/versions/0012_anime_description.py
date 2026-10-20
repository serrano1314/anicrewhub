"""cache AniList anime synopsis

Revision ID: 0012_anime_description
Revises: 0011_anime_details
Create Date: 2026-10-20

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0012_anime_description"
down_revision: Union[str, Sequence[str], None] = "0011_anime_details"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("anime", sa.Column("description", sa.Text(), nullable=True))
    op.execute("UPDATE anime SET details_synced_at = NULL")


def downgrade() -> None:
    op.drop_column("anime", "description")

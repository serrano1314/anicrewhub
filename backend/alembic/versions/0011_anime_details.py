"""cache extended AniList anime details

Revision ID: 0011_anime_details
Revises: 0010_numbered_user_avatars
Create Date: 2026-10-20

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0011_anime_details"
down_revision: Union[str, Sequence[str], None] = "0010_numbered_user_avatars"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    details_type = sa.JSON().with_variant(postgresql.JSONB(), "postgresql")
    op.add_column(
        "anime",
        sa.Column(
            "details",
            details_type,
            nullable=False,
            server_default=sa.text("'{}'"),
        ),
    )
    op.add_column(
        "anime",
        sa.Column("details_synced_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("anime", "details_synced_at")
    op.drop_column("anime", "details")

"""add favorites-only collection sharing

Revision ID: 0019_share_favorites_only
Revises: 0018_copied_site_templates
Create Date: 2026-10-23

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0019_share_favorites_only"
down_revision: Union[str, Sequence[str], None] = "0018_copied_site_templates"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("share_favorites_only", sa.Boolean(), server_default=sa.false(), nullable=False),
    )


def downgrade() -> None:
    op.drop_column("users", "share_favorites_only")

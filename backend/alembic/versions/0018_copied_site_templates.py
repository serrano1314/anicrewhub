"""copy watch-site templates with copied sites

Revision ID: 0018_copied_site_templates
Revises: 0017_notifications
Create Date: 2026-10-22

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0018_copied_site_templates"
down_revision: Union[str, Sequence[str], None] = "0017_notifications"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("copied_sites", sa.Column("episode_url_template", sa.Text(), nullable=True))
    op.add_column("copied_sites", sa.Column("search_url_template", sa.Text(), nullable=True))
    op.execute(
        sa.text(
            """
            UPDATE copied_sites
            SET episode_url_template = user_sites.episode_url_template,
                search_url_template = user_sites.search_url_template
            FROM user_sites
            WHERE user_sites.id = copied_sites.source_site_id
            """
        )
    )


def downgrade() -> None:
    op.drop_column("copied_sites", "search_url_template")
    op.drop_column("copied_sites", "episode_url_template")

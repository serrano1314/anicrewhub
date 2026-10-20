"""store versioned release notes

Revision ID: 0013_release_notes
Revises: 0012_anime_description
Create Date: 2026-10-21

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0013_release_notes"
down_revision: Union[str, Sequence[str], None] = "0012_anime_description"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "release_notes",
        sa.Column("version", sa.Text(), nullable=False),
        sa.Column("content_html", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("version"),
    )
    release_notes = sa.table(
        "release_notes",
        sa.column("version", sa.Text()),
        sa.column("content_html", sa.Text()),
    )
    op.bulk_insert(
        release_notes,
        [
            {
                "version": "1.2.0",
                "content_html": (
                    "<ul>"
                    "<li>Choose whether saved or official watch links open first in the episode player.</li>"
                    "<li>View added-site and official streaming links together from episode selections.</li>"
                    "<li>Edit anime-specific watch URLs, or fall back to reusable site templates.</li>"
                    "<li>Keep your Anime Finder search when navigating away and returning.</li>"
                    "<li>Improve account recovery for temporary connection or service failures.</li>"
                    "<li>Customize your profile with an avatar, and update your username and email from the profile modal.</li>"
                    "<li>Refresh Settings and add the anime spotlight carousel on Login and My Collection Page.</li>"
                    "<li>Read release notes for the current app version directly from Settings.</li>"
                    "<li>Improve UI design and move the profile modal to navigation bar.</li>"
                    "</ul>"
                ),
            }
        ],
    )


def downgrade() -> None:
    op.drop_table("release_notes")

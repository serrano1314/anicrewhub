"""ensure v1.2.0 release notes exist

Revision ID: 0015_ensure_release_notes_120
Revises: 0014_update_release_notes_120
Create Date: 2026-10-21

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import insert

revision: str = "0015_ensure_release_notes_120"
down_revision: Union[str, Sequence[str], None] = "0014_update_release_notes_120"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

release_notes = sa.table(
    "release_notes",
    sa.column("version", sa.Text()),
    sa.column("content_html", sa.Text()),
)

content_html = (
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
)


def upgrade() -> None:
    statement = insert(release_notes).values(version="1.2.0", content_html=content_html)
    statement = statement.on_conflict_do_update(
        index_elements=[release_notes.c.version],
        set_={"content_html": statement.excluded.content_html},
    )
    op.execute(statement)


def downgrade() -> None:
    previous_content = (
        "<ul>"
        "<li>Choose whether saved or official watch links open first in the episode player.</li>"
        "<li>View added-site and official streaming links together from episode selections.</li>"
        "<li>Edit anime-specific watch URLs, or fall back to reusable site templates.</li>"
        "<li>Keep your Anime Finder search when navigating away and returning.</li>"
        "<li>Improve account recovery for temporary connection or service failures.</li>"
        "<li>Customize your profile with an avatar, and update your username and email from the profile modal.</li>"
        "<li>Refresh Settings and add the anime spotlight carousel on Login and My Collection Page.</li>"
        "<li>Read release notes for the current app version directly from Settings.</li>"
        "</ul>"
    )
    op.execute(
        sa.update(release_notes)
        .where(release_notes.c.version == "1.2.0")
        .values(content_html=previous_content)
    )

"""user sharing preferences, follows, copied sites, and terms acceptance

Revision ID: 0016_user_sharing
Revises: 0015_ensure_release_notes_120
Create Date: 2026-10-21

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0016_user_sharing"
down_revision: Union[str, Sequence[str], None] = "0015_ensure_release_notes_120"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("profile_public", sa.Boolean(), server_default=sa.true(), nullable=False),
    )
    op.add_column(
        "users",
        sa.Column("share_collection", sa.Boolean(), server_default=sa.true(), nullable=False),
    )
    op.add_column(
        "users",
        sa.Column("share_watch_sites", sa.Boolean(), server_default=sa.true(), nullable=False),
    )
    op.add_column("users", sa.Column("terms_accepted_version", sa.String(length=32), nullable=True))
    op.add_column("users", sa.Column("terms_accepted_at", sa.DateTime(timezone=True), nullable=True))
    op.create_table(
        "user_follows",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("follower_id", sa.Uuid(), nullable=False),
        sa.Column("followed_id", sa.Uuid(), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["follower_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["followed_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("follower_id", "followed_id", name="uq_user_follows_pair"),
        sa.CheckConstraint("follower_id != followed_id", name="ck_user_follows_not_self"),
    )
    op.create_table(
        "copied_sites",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("source_user_id", sa.Uuid(), nullable=True),
        sa.Column("source_site_id", sa.Uuid(), nullable=False),
        sa.Column("source_username", sa.String(length=50), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("base_url", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["source_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "source_site_id", name="uq_copied_sites_user_source_site"),
    )


def downgrade() -> None:
    op.drop_table("copied_sites")
    op.drop_table("user_follows")
    op.drop_column("users", "terms_accepted_at")
    op.drop_column("users", "terms_accepted_version")
    op.drop_column("users", "share_watch_sites")
    op.drop_column("users", "share_collection")
    op.drop_column("users", "profile_public")

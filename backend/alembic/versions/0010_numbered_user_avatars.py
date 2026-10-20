"""convert preset avatar ids to numbered image ids

Revision ID: 0010_numbered_user_avatars
Revises: 0009_user_avatar
Create Date: 2026-10-20

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0010_numbered_user_avatars"
down_revision: Union[str, Sequence[str], None] = "0009_user_avatar"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_OLD_TO_NEW = {
    "coral": "1",
    "azure": "2",
    "violet": "3",
    "jade": "4",
    "amber": "5",
    "rose": "6",
    "slate": "7",
    "mint": "8",
}
_NEW_TO_OLD = {value: key for key, value in _OLD_TO_NEW.items()}


def _replace_values(mapping: dict[str, str]) -> None:
    connection = op.get_bind()
    for old_value, new_value in mapping.items():
        connection.execute(
            sa.text(
                "UPDATE users SET avatar_id = :new_value WHERE avatar_id = :old_value"
            ),
            {"new_value": new_value, "old_value": old_value},
        )


def upgrade() -> None:
    _replace_values(_OLD_TO_NEW)


def downgrade() -> None:
    _replace_values(_NEW_TO_OLD)

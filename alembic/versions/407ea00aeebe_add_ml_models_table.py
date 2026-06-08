"""add ml_models table

Revision ID: 407ea00aeebe
Revises: 0001_base_schema
Create Date: 2026-06-05 14:26:24.968299

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

from sqlalchemy.dialects.postgresql import JSONB

# revision identifiers, used by Alembic.
revision: str = '0002_schema_with_ml'
down_revision: Union[str, None] = '0001_base_schema'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "ml_models",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("model_type", sa.String(length=100), nullable=False),
        sa.Column("model_path", sa.Text(), nullable=False),
        sa.Column("trained_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("trained_on_count", sa.Integer(), nullable=False),
        sa.Column("mae", sa.Float(), nullable=True),
        sa.Column("fallback_mae", sa.Float(), nullable=True),
        sa.Column("accepted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("metadata", JSONB, nullable=True),
    )

    op.create_index("ix_ml_models_user_id", "ml_models", ["user_id"])
    op.create_index("ix_ml_models_user_active", "ml_models", ["user_id", "is_active"])


def downgrade() -> None:
    op.drop_index("ix_ml_models_user_active", table_name="ml_models")
    op.drop_index("ix_ml_models_user_id", table_name="ml_models")
    op.drop_table("ml_models")
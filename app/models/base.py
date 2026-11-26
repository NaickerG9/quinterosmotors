from datetime import datetime, timezone

from ..extensions import db


def utcnow():
    """Hora UTC ingenua, consistente con el almacenamiento de SQLite."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


class BaseModel(db.Model):
    __abstract__ = True

    id = db.Column(db.Integer, primary_key=True)


class TimestampMixin:
    created_at = db.Column(db.DateTime, nullable=False, default=utcnow)
    updated_at = db.Column(
        db.DateTime, nullable=False, default=utcnow, onupdate=utcnow
    )

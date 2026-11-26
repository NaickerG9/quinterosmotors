from flask_login import UserMixin
from werkzeug.security import check_password_hash, generate_password_hash

from ..extensions import db
from .base import BaseModel, TimestampMixin
from .enums import ROLES


class Usuario(BaseModel, TimestampMixin, UserMixin):
    __tablename__ = "usuarios"

    nombre = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(255), nullable=False, unique=True, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    rol = db.Column(db.String(20), nullable=False, default="vendedor")
    activo = db.Column(db.Boolean, nullable=False, default=True)

    ventas = db.relationship("Venta", back_populates="vendedor", lazy="dynamic")
    prospectos_asignados = db.relationship(
        "Prospecto", back_populates="vendedor", lazy="dynamic"
    )

    @property
    def is_active(self):
        return bool(self.activo)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {
            "id": self.id,
            "nombre": self.nombre,
            "email": self.email,
            "rol": self.rol,
            "rol_label": ROLES.get(self.rol, self.rol),
            "activo": self.activo,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

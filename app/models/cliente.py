from ..extensions import db
from .base import BaseModel, TimestampMixin


class Cliente(BaseModel, TimestampMixin):
    __tablename__ = "clientes"

    nombre = db.Column(db.String(160), nullable=False, index=True)
    documento = db.Column(db.String(40), unique=True, nullable=True, index=True)
    email = db.Column(db.String(255), nullable=True)
    telefono = db.Column(db.String(40), nullable=True, index=True)
    direccion = db.Column(db.String(255), nullable=True)
    notas = db.Column(db.Text, nullable=True)
    activo = db.Column(db.Boolean, nullable=False, default=True, index=True)

    ventas = db.relationship("Venta", back_populates="cliente", lazy="dynamic")
    prospectos = db.relationship("Prospecto", back_populates="cliente")

    def to_dict(self, incluir_ventas=False):
        data = {
            "id": self.id,
            "nombre": self.nombre,
            "documento": self.documento,
            "email": self.email,
            "telefono": self.telefono,
            "direccion": self.direccion,
            "notas": self.notas,
            "activo": self.activo,
            "total_compras": self.ventas.filter_by(estado="completada").count(),
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
        if incluir_ventas:
            from .venta import Venta

            data["ventas"] = [
                venta.to_dict(resumen=True)
                for venta in self.ventas.order_by(Venta.created_at.desc()).all()
            ]
        return data

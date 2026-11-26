from ..extensions import db
from .base import BaseModel, TimestampMixin
from .enums import ESTADOS_PROSPECTO, ORIGENES_PROSPECTO


class Prospecto(BaseModel, TimestampMixin):
    __tablename__ = "prospectos"

    nombre = db.Column(db.String(160), nullable=False, index=True)
    telefono = db.Column(db.String(40), nullable=True, index=True)
    email = db.Column(db.String(255), nullable=True)
    vehiculo_id = db.Column(
        db.Integer, db.ForeignKey("vehiculos.id", ondelete="SET NULL"), nullable=True
    )
    vendedor_id = db.Column(
        db.Integer, db.ForeignKey("usuarios.id", ondelete="SET NULL"), nullable=True
    )
    cliente_id = db.Column(
        db.Integer, db.ForeignKey("clientes.id", ondelete="SET NULL"), nullable=True
    )
    origen = db.Column(db.String(30), nullable=False, default="presencial")
    estado = db.Column(db.String(30), nullable=False, default="nuevo", index=True)
    mensaje = db.Column(db.Text, nullable=True)
    notas = db.Column(db.Text, nullable=True)

    vehiculo = db.relationship("Vehiculo", back_populates="prospectos")
    vendedor = db.relationship("Usuario", back_populates="prospectos_asignados")
    cliente = db.relationship("Cliente", back_populates="prospectos")

    def to_dict(self):
        return {
            "id": self.id,
            "nombre": self.nombre,
            "telefono": self.telefono,
            "email": self.email,
            "origen": self.origen,
            "origen_label": ORIGENES_PROSPECTO.get(self.origen, self.origen),
            "estado": self.estado,
            "estado_label": ESTADOS_PROSPECTO.get(self.estado, self.estado),
            "mensaje": self.mensaje,
            "notas": self.notas,
            "vehiculo": {
                "id": self.vehiculo.id,
                "titulo": self.vehiculo.titulo,
                "precio_ves_centavos": self.vehiculo.precio_ves_centavos,
            }
            if self.vehiculo
            else None,
            "vendedor": {
                "id": self.vendedor.id,
                "nombre": self.vendedor.nombre,
            }
            if self.vendedor
            else None,
            "cliente_id": self.cliente_id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

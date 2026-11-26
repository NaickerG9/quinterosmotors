from sqlalchemy import text

from ..extensions import db
from ..utils.money import rate_from_micros
from .base import BaseModel, TimestampMixin, utcnow
from .enums import ESTADOS_VENTA, FORMAS_PAGO


class Venta(BaseModel, TimestampMixin):
    __tablename__ = "ventas"
    __table_args__ = (
        db.Index(
            "uq_ventas_vehiculo_activa",
            "vehiculo_id",
            unique=True,
            sqlite_where=text("estado IN ('apartado', 'completada')"),
        ),
        db.Index("ix_ventas_estado_fecha", "estado", "fecha_venta"),
    )

    vehiculo_id = db.Column(
        db.Integer,
        db.ForeignKey("vehiculos.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    cliente_id = db.Column(
        db.Integer,
        db.ForeignKey("clientes.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    vendedor_id = db.Column(
        db.Integer,
        db.ForeignKey("usuarios.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    tasa_id = db.Column(
        db.Integer, db.ForeignKey("tasas_cambio.id"), nullable=True, index=True
    )

    estado = db.Column(db.String(20), nullable=False, default="completada", index=True)
    precio_lista_ves_centavos = db.Column(db.BigInteger, nullable=False)
    precio_final_ves_centavos = db.Column(db.BigInteger, nullable=False)
    tasa_ves_por_usd_micros = db.Column(db.BigInteger, nullable=False)
    precio_usd_centavos = db.Column(db.BigInteger, nullable=False)
    forma_pago = db.Column(db.String(20), nullable=False, default="contado")
    notas = db.Column(db.Text, nullable=True)
    fecha_venta = db.Column(db.DateTime, nullable=True)
    completada_at = db.Column(db.DateTime, nullable=True)
    cancelada_at = db.Column(db.DateTime, nullable=True)

    vehiculo = db.relationship("Vehiculo", back_populates="ventas")
    cliente = db.relationship("Cliente", back_populates="ventas")
    vendedor = db.relationship("Usuario", back_populates="ventas")
    tasa = db.relationship("TasaCambio")

    @property
    def tasa_ves_por_usd(self):
        value = rate_from_micros(self.tasa_ves_por_usd_micros)
        return float(value) if value is not None else None

    def to_dict(self, resumen=False):
        data = {
            "id": self.id,
            "estado": self.estado,
            "estado_label": ESTADOS_VENTA.get(self.estado, self.estado),
            "forma_pago": self.forma_pago,
            "forma_pago_label": FORMAS_PAGO.get(self.forma_pago, self.forma_pago),
            "precio_lista_ves_centavos": self.precio_lista_ves_centavos,
            "precio_final_ves_centavos": self.precio_final_ves_centavos,
            "precio_usd_centavos": self.precio_usd_centavos,
            "tasa_ves_por_usd": self.tasa_ves_por_usd,
            "tasa_ves_por_usd_micros": self.tasa_ves_por_usd_micros,
            "notas": self.notas,
            "fecha_venta": self.fecha_venta.isoformat() if self.fecha_venta else None,
            "completada_at": self.completada_at.isoformat()
            if self.completada_at
            else None,
            "cancelada_at": self.cancelada_at.isoformat()
            if self.cancelada_at
            else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "vendedor": {
                "id": self.vendedor.id,
                "nombre": self.vendedor.nombre,
            }
            if self.vendedor
            else None,
            "cliente": self.cliente.to_dict() if self.cliente else None,
            "vehiculo": {
                "id": self.vehiculo.id,
                "titulo": self.vehiculo.titulo,
                "marca": self.vehiculo.marca,
                "modelo": self.vehiculo.modelo,
                "anio": self.vehiculo.anio,
                "vin": self.vehiculo.vin,
                "placa": self.vehiculo.placa,
                "imagen_principal": self.vehiculo.imagen_principal.to_dict()
                if self.vehiculo and self.vehiculo.imagen_principal
                else None,
            }
            if self.vehiculo
            else None,
        }
        if not resumen:
            data["cliente"] = self.cliente.to_dict(incluir_ventas=False)
        return data

    def marcar_completada(self):
        self.estado = "completada"
        self.completada_at = utcnow()
        self.fecha_venta = self.completada_at
        if self.vehiculo:
            self.vehiculo.estado = "vendido"

    def marcar_cancelada(self):
        self.estado = "cancelada"
        self.cancelada_at = utcnow()

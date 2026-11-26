from flask import has_request_context, url_for

from ..extensions import db
from ..utils.money import usd_centavos_from_ves
from .base import BaseModel, TimestampMixin
from .enums import ESTADOS_VEHICULO


class Vehiculo(BaseModel, TimestampMixin):
    __tablename__ = "vehiculos"
    __table_args__ = (
        db.Index("ix_vehiculos_estado_archivado", "estado", "archivado"),
        db.Index("ix_vehiculos_marca_modelo", "marca", "modelo"),
    )

    vin = db.Column(db.String(32), unique=True, nullable=True, index=True)
    placa = db.Column(db.String(16), unique=True, nullable=True, index=True)
    marca = db.Column(db.String(80), nullable=False, index=True)
    modelo = db.Column(db.String(80), nullable=False, index=True)
    version = db.Column(db.String(120), nullable=True)
    anio = db.Column(db.Integer, nullable=False)
    color = db.Column(db.String(40), nullable=True)
    kilometraje = db.Column(db.Integer, nullable=False, default=0)
    transmision = db.Column(db.String(30), nullable=True)
    combustible = db.Column(db.String(30), nullable=True)
    carroceria = db.Column(db.String(30), nullable=True)

    precio_ves_centavos = db.Column(db.BigInteger, nullable=False)
    costo_ves_centavos = db.Column(db.BigInteger, nullable=True)

    estado = db.Column(
        db.String(20), nullable=False, default="disponible", index=True
    )
    descripcion = db.Column(db.Text, nullable=True)
    destacado = db.Column(db.Boolean, nullable=False, default=False)
    archivado = db.Column(db.Boolean, nullable=False, default=False, index=True)

    imagenes = db.relationship(
        "VehiculoImagen",
        back_populates="vehiculo",
        cascade="all, delete-orphan",
        order_by="VehiculoImagen.orden",
    )
    ventas = db.relationship("Venta", back_populates="vehiculo", lazy="dynamic")
    prospectos = db.relationship("Prospecto", back_populates="vehiculo")

    @property
    def titulo(self):
        parts = [self.marca, self.modelo]
        if self.version:
            parts.append(self.version)
        return " ".join(parts)

    @property
    def imagen_principal(self):
        principal = next((img for img in self.imagenes if img.es_principal), None)
        return principal or (self.imagenes[0] if self.imagenes else None)

    @property
    def tiene_venta_activa(self):
        from .venta import Venta

        return (
            Venta.query.filter(
                Venta.vehiculo_id == self.id,
                Venta.estado.in_(("apartado", "completada")),
            ).first()
            is not None
        )

    def to_dict(self, incluir_costos=False, tasa_micros=None):
        precio_usd = (
            usd_centavos_from_ves(self.precio_ves_centavos, tasa_micros)
            if tasa_micros
            else None
        )
        data = {
            "id": self.id,
            "vin": self.vin,
            "placa": self.placa,
            "marca": self.marca,
            "modelo": self.modelo,
            "version": self.version,
            "titulo": self.titulo,
            "anio": self.anio,
            "color": self.color,
            "kilometraje": self.kilometraje,
            "transmision": self.transmision,
            "combustible": self.combustible,
            "carroceria": self.carroceria,
            "precio_ves_centavos": self.precio_ves_centavos,
            "precio_usd_centavos": precio_usd,
            "estado": self.estado,
            "estado_label": ESTADOS_VEHICULO.get(self.estado, self.estado),
            "descripcion": self.descripcion,
            "destacado": self.destacado,
            "archivado": self.archivado,
            "imagen_principal": self.imagen_principal.to_dict()
            if self.imagen_principal
            else None,
            "imagenes": [imagen.to_dict() for imagen in self.imagenes],
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
        if incluir_costos:
            data["costo_ves_centavos"] = self.costo_ves_centavos
            data["costo_usd_centavos"] = (
                usd_centavos_from_ves(self.costo_ves_centavos, tasa_micros)
                if self.costo_ves_centavos is not None and tasa_micros
                else None
            )
            data["margen_ves_centavos"] = (
                self.precio_ves_centavos - self.costo_ves_centavos
                if self.costo_ves_centavos is not None
                else None
            )
        return data


class VehiculoImagen(BaseModel):
    __tablename__ = "vehiculo_imagenes"

    vehiculo_id = db.Column(
        db.Integer,
        db.ForeignKey("vehiculos.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    ruta = db.Column(db.String(255), nullable=False, unique=True)
    orden = db.Column(db.Integer, nullable=False, default=0)
    es_principal = db.Column(db.Boolean, nullable=False, default=False)
    ancho = db.Column(db.Integer, nullable=True)
    alto = db.Column(db.Integer, nullable=True)
    bytes = db.Column(db.Integer, nullable=True)
    created_at = db.Column(
        db.DateTime, nullable=False, default=db.func.current_timestamp()
    )

    vehiculo = db.relationship("Vehiculo", back_populates="imagenes")

    @property
    def url(self):
        if has_request_context():
            return url_for("media.media_file", filename=self.ruta)
        return f"/media/vehiculos/{self.ruta}"

    def to_dict(self):
        return {
            "id": self.id,
            "ruta": self.ruta,
            "url": self.url,
            "orden": self.orden,
            "es_principal": self.es_principal,
            "ancho": self.ancho,
            "alto": self.alto,
            "bytes": self.bytes,
        }

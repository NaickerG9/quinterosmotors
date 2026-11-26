from ..extensions import db
from ..utils.money import RATE_SCALE, rate_from_micros
from .base import BaseModel, TimestampMixin, utcnow


class TasaCambio(BaseModel, TimestampMixin):
    __tablename__ = "tasas_cambio"

    ves_por_usd_micros = db.Column(db.BigInteger, nullable=False)
    fuente = db.Column(db.String(20), nullable=False, default="manual")
    vigente_desde = db.Column(db.DateTime, nullable=False, default=utcnow)
    usuario_id = db.Column(
        db.Integer, db.ForeignKey("usuarios.id"), nullable=True, index=True
    )

    usuario = db.relationship("Usuario")

    @property
    def ves_por_usd(self):
        return rate_from_micros(self.ves_por_usd_micros)

    @property
    def ves_por_usd_float(self):
        value = self.ves_por_usd
        return float(value) if value is not None else None

    @staticmethod
    def micros_from_ves(rate):
        return int(rate * RATE_SCALE)

    def to_dict(self):
        return {
            "id": self.id,
            "ves_por_usd": self.ves_por_usd_float,
            "ves_por_usd_micros": self.ves_por_usd_micros,
            "fuente": self.fuente,
            "vigente_desde": self.vigente_desde.isoformat()
            if self.vigente_desde
            else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "usuario": self.usuario.nombre if self.usuario else None,
        }

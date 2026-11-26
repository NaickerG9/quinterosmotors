from flask import current_app

from ..extensions import db
from ..models import TasaCambio
from ..utils.errors import ValidationError
from ..utils.money import parse_rate_to_micros
from ..utils.time import utcnow


def get_tasa_actual():
    return (
        TasaCambio.query.order_by(TasaCambio.created_at.desc(), TasaCambio.id.desc())
        .first()
    )


def get_tasa_micros():
    tasa = get_tasa_actual()
    return tasa.ves_por_usd_micros if tasa else None


def tasa_vencida(tasa, horas=None):
    if not tasa:
        return False
    limite = horas or current_app.config["TASA_MAX_AGE_HORAS"]
    delta = utcnow() - tasa.created_at
    return delta.total_seconds() > limite * 3600


def info_tasa(tasa=None):
    tasa = tasa if tasa is not None else get_tasa_actual()
    if not tasa:
        return {
            "configurada": False,
            "es_vencida": False,
            "advertencia": "No hay tasa configurada. Las ventas están bloqueadas.",
        }
    return {
        "configurada": True,
        **tasa.to_dict(),
        "es_vencida": tasa_vencida(tasa),
        "advertencia": (
            "La tasa tiene más de "
            f"{current_app.config['TASA_MAX_AGE_HORAS']} horas. Actualízala antes de vender."
            if tasa_vencida(tasa)
            else None
        ),
    }


def crear_tasa(value, usuario_id=None, fuente="manual"):
    try:
        micros = parse_rate_to_micros(value)
    except ValueError as exc:
        raise ValidationError(str(exc), fields={"ves_por_usd": "Tasa inválida"}) from exc
    tasa = TasaCambio(
        ves_por_usd_micros=micros,
        fuente=fuente,
        vigente_desde=utcnow(),
        usuario_id=usuario_id,
    )
    db.session.add(tasa)
    db.session.commit()
    return tasa

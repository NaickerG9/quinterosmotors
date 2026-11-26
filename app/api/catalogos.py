from flask import Blueprint, current_app
from flask_login import login_required

from ..models.enums import (
    CARROCERIAS,
    COMBUSTIBLES,
    ESTADOS_PROSPECTO,
    ESTADOS_VEHICULO,
    ESTADOS_VENTA,
    FORMAS_PAGO,
    ORIGENES_PROSPECTO,
    TRANSMISIONES,
    choices,
)
from ..services.tasas import info_tasa
from ..utils.responses import ok

bp = Blueprint("api_catalogos", __name__, url_prefix="/api/v1/catalogos")


@bp.get("")
@login_required
def catalogos():
    return ok(
        {
            "moneda_principal": "VES",
            "moneda_referencia": "USD",
            "max_imagenes_por_vehiculo": current_app.config["MAX_IMAGENES_POR_VEHICULO"],
            "tasa": info_tasa(),
            "estados_vehiculo": choices(ESTADOS_VEHICULO),
            "transmisiones": choices(TRANSMISIONES),
            "combustibles": choices(COMBUSTIBLES),
            "carrocerias": choices(CARROCERIAS),
            "formas_pago": choices(FORMAS_PAGO),
            "estados_venta": choices(ESTADOS_VENTA),
            "estados_prospecto": choices(ESTADOS_PROSPECTO),
            "origenes_prospecto": choices(ORIGENES_PROSPECTO),
        }
    )

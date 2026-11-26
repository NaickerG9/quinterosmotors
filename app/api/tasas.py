from flask import Blueprint, request
from flask_login import current_user, login_required

from ..models import TasaCambio
from ..services.tasas import crear_tasa, info_tasa
from ..utils.responses import created, ok, pagination_meta, parse_pagination
from ..utils.validators import json_body

bp = Blueprint("api_tasas", __name__, url_prefix="/api/v1/tasa")


@bp.get("")
@login_required
def actual():
    return ok(info_tasa())


@bp.put("")
@login_required
def actualizar():
    if current_user.rol != "admin":
        from ..utils.errors import ForbiddenError

        raise ForbiddenError("Solo un administrador puede actualizar la tasa")
    data = json_body()
    tasa = crear_tasa(data.get("ves_por_usd"), current_user.id)
    return created(info_tasa(tasa))


@bp.get("/historial")
@login_required
def historial():
    if current_user.rol != "admin":
        from ..utils.errors import ForbiddenError

        raise ForbiddenError("Solo un administrador puede ver el historial de tasas")
    page, per_page = parse_pagination(request.args, default_per_page=20)
    pagination = (
        TasaCambio.query.order_by(TasaCambio.created_at.desc(), TasaCambio.id.desc())
        .paginate(page=page, per_page=per_page, error_out=False)
    )
    return ok(
        [tasa.to_dict() for tasa in pagination.items],
        meta=pagination_meta(pagination),
    )

from flask import Blueprint, request
from flask_login import current_user, login_required

from ..services.dashboard import resumen
from ..utils.responses import ok
from ..utils.validators import parse_date_arg

bp = Blueprint("api_dashboard", __name__, url_prefix="/api/v1/dashboard")


@bp.get("/resumen")
@login_required
def resumen_dashboard():
    desde = parse_date_arg(request.args, "desde")
    hasta = parse_date_arg(request.args, "hasta")
    return ok(resumen(current_user, desde=desde, hasta=hasta))

from datetime import timedelta

from flask import Blueprint, request
from flask_login import current_user, login_required
from sqlalchemy import func, or_

from ..extensions import db
from ..models import Cliente, Vehiculo, Venta
from ..models.enums import ESTADOS_VENTA, ESTADOS_VENTA_ACTIVA
from ..services.ventas import (
    cancelar_venta,
    completar_venta,
    crear_venta,
    puede_gestionar_venta,
)
from ..utils.errors import ForbiddenError, NotFoundError, ValidationError
from ..utils.responses import created, ok, pagination_meta, parse_pagination
from ..utils.validators import json_body, parse_date_arg

bp = Blueprint("api_ventas", __name__, url_prefix="/api/v1/ventas")


def _get_or_404(venta_id):
    venta = db.session.get(Venta, venta_id)
    if not venta:
        raise NotFoundError("Venta no encontrada")
    return venta


@bp.get("")
@login_required
def listar():
    page, per_page = parse_pagination(request.args)
    query = Venta.query

    q = (request.args.get("q") or "").strip()
    if q:
        like = f"%{q}%"
        query = query.join(
            Cliente, Venta.cliente_id == Cliente.id
        ).join(Vehiculo, Venta.vehiculo_id == Vehiculo.id)
        query = query.filter(
            or_(
                Cliente.nombre.ilike(like),
                Cliente.documento.ilike(like),
                Vehiculo.marca.ilike(like),
                Vehiculo.modelo.ilike(like),
                Vehiculo.vin.ilike(like),
                Vehiculo.placa.ilike(like),
            )
        )

    estado = request.args.get("estado")
    if estado:
        if estado not in ESTADOS_VENTA:
            raise ValidationError("Estado inválido", fields={"estado": "Estado inválido"})
        query = query.filter(Venta.estado == estado)

    vendedor_id = request.args.get("vendedor_id")
    if vendedor_id:
        try:
            query = query.filter(Venta.vendedor_id == int(vendedor_id))
        except ValueError as exc:
            raise ValidationError(
                "Vendedor inválido", fields={"vendedor_id": "ID inválido"}
            ) from exc

    fecha_ref = func.coalesce(Venta.fecha_venta, Venta.created_at)
    desde = parse_date_arg(request.args, "desde")
    hasta = parse_date_arg(request.args, "hasta")
    if desde:
        query = query.filter(fecha_ref >= desde)
    if hasta:
        query = query.filter(fecha_ref < hasta + timedelta(days=1))

    query = query.order_by(Venta.created_at.desc())
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)
    return ok(
        [venta.to_dict(resumen=True) for venta in pagination.items],
        meta=pagination_meta(pagination),
    )


@bp.get("/<int:venta_id>")
@login_required
def detalle(venta_id):
    venta = _get_or_404(venta_id)
    data = venta.to_dict()
    puede = puede_gestionar_venta(venta, current_user)
    data["puede_completar"] = venta.estado == "apartado" and puede
    data["puede_cancelar"] = (
        venta.estado in ESTADOS_VENTA_ACTIVA
        and puede
        and (venta.estado != "completada" or current_user.rol == "admin")
    )
    return ok(data)


@bp.post("")
@login_required
def crear():
    venta = crear_venta(json_body(), current_user)
    return created(venta.to_dict())


@bp.post("/<int:venta_id>/completar")
@login_required
def completar(venta_id):
    venta = _get_or_404(venta_id)
    if not puede_gestionar_venta(venta, current_user):
        raise ForbiddenError("Solo el vendedor asignado o un administrador puede completar la venta")
    completar_venta(venta)
    return ok(venta.to_dict())


@bp.post("/<int:venta_id>/cancelar")
@login_required
def cancelar(venta_id):
    venta = _get_or_404(venta_id)
    if not puede_gestionar_venta(venta, current_user):
        raise ForbiddenError("Solo el vendedor asignado o un administrador puede cancelar la venta")
    if venta.estado == "completada" and current_user.rol != "admin":
        raise ForbiddenError("Solo un administrador puede cancelar una venta completada")
    cancelar_venta(venta)
    return ok(venta.to_dict())

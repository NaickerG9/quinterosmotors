from flask import Blueprint, request
from flask_login import current_user, login_required
from sqlalchemy import or_

from ..extensions import db
from ..models import Cliente
from ..utils.errors import ConflictError, NotFoundError
from ..utils.responses import created, ok, pagination_meta, parse_pagination
from ..utils.validators import (
    json_body,
    optional_str,
    parse_bool,
    required,
    validate_email,
)

bp = Blueprint("api_clientes", __name__, url_prefix="/api/v1/clientes")


def _get_or_404(cliente_id):
    cliente = db.session.get(Cliente, cliente_id)
    if not cliente:
        raise NotFoundError("Cliente no encontrado")
    return cliente


def _check_documento(documento, excluir_id=None):
    if not documento:
        return
    query = Cliente.query.filter(Cliente.documento == documento)
    if excluir_id:
        query = query.filter(Cliente.id != excluir_id)
    if query.first():
        raise ConflictError(
            "Ya existe un cliente con ese documento",
            code="DOCUMENTO_DUPLICADO",
            fields={"documento": "Documento ya registrado"},
        )


def _apply_fields(cliente, data, crear=False):
    if crear or "nombre" in data:
        cliente.nombre = required(data, "nombre", "Nombre")[:160]
    if crear or "documento" in data:
        cliente.documento = optional_str(data, "documento", 40)
    if crear or "email" in data:
        cliente.email = validate_email(optional_str(data, "email", 255))
    if crear or "telefono" in data:
        cliente.telefono = optional_str(data, "telefono", 40)
    if crear or "direccion" in data:
        cliente.direccion = optional_str(data, "direccion", 255)
    if crear or "notas" in data:
        cliente.notas = optional_str(data, "notas")
    if "activo" in data:
        cliente.activo = parse_bool(data.get("activo"), True)
    return cliente


@bp.get("")
@login_required
def listar():
    page, per_page = parse_pagination(request.args)
    query = Cliente.query
    incluir_inactivos = parse_bool(
        request.args.get("incluir_inactivos")
    ) and current_user.rol == "admin"
    if not incluir_inactivos:
        query = query.filter(Cliente.activo.is_(True))

    q = (request.args.get("q") or "").strip()
    if q:
        like = f"%{q}%"
        query = query.filter(
            or_(
                Cliente.nombre.ilike(like),
                Cliente.documento.ilike(like),
                Cliente.telefono.ilike(like),
                Cliente.email.ilike(like),
            )
        )

    query = query.order_by(Cliente.nombre.asc())
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)
    return ok(
        [cliente.to_dict() for cliente in pagination.items],
        meta=pagination_meta(pagination),
    )


@bp.get("/<int:cliente_id>")
@login_required
def detalle(cliente_id):
    return ok(_get_or_404(cliente_id).to_dict(incluir_ventas=True))


@bp.post("")
@login_required
def crear():
    data = json_body()
    cliente = _apply_fields(Cliente(), data, crear=True)
    _check_documento(cliente.documento)
    db.session.add(cliente)
    db.session.commit()
    return created(cliente.to_dict())


@bp.route("/<int:cliente_id>", methods=["PUT", "PATCH"])
@login_required
def actualizar(cliente_id):
    cliente = _get_or_404(cliente_id)
    data = json_body()
    _apply_fields(cliente, data, crear=False)
    _check_documento(cliente.documento, cliente.id)
    db.session.commit()
    return ok(cliente.to_dict())


@bp.delete("/<int:cliente_id>")
@login_required
def eliminar(cliente_id):
    cliente = _get_or_404(cliente_id)
    total_ventas = cliente.ventas.count()
    if total_ventas:
        raise ConflictError(
            "No se puede eliminar un cliente con ventas registradas. Desactívalo en su lugar.",
            code="CLIENTE_CON_VENTAS",
        )
    db.session.delete(cliente)
    db.session.commit()
    return ok({"id": cliente_id, "eliminado": True})

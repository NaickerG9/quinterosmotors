from flask import Blueprint, request
from flask_login import current_user, login_required
from sqlalchemy import or_

from ..extensions import db
from ..models import Cliente, Prospecto, Usuario, Vehiculo
from ..models.enums import ESTADOS_PROSPECTO, ORIGENES_PROSPECTO
from ..utils.errors import ForbiddenError, NotFoundError, ValidationError
from ..utils.responses import created, ok, pagination_meta, parse_pagination
from ..utils.validators import (
    json_body,
    optional_str,
    required,
    validate_choice,
    validate_email,
)

bp = Blueprint("api_prospectos", __name__, url_prefix="/api/v1/prospectos")


def _get_or_404(prospecto_id):
    prospecto = db.session.get(Prospecto, prospecto_id)
    if not prospecto:
        raise NotFoundError("Prospecto no encontrado")
    return prospecto


def _optional_id(data, field):
    value = data.get(field)
    if value in (None, ""):
        return None
    try:
        return int(value)
    except (TypeError, ValueError) as exc:
        raise ValidationError(
            f"{field} inválido", fields={field: "ID inválido"}
        ) from exc


def _vendedor_permitido(data, actual=None):
    vendedor_id = _optional_id(data, "vendedor_id")
    if vendedor_id is None:
        return actual or current_user.id
    if current_user.rol != "admin" and vendedor_id != current_user.id:
        raise ForbiddenError("Solo un administrador puede asignar prospectos a otro vendedor")
    if not db.session.get(Usuario, vendedor_id):
        raise ValidationError(
            "Vendedor no encontrado", fields={"vendedor_id": "Usuario inexistente"}
        )
    return vendedor_id


def _apply_fields(prospecto, data, crear=False):
    if crear or "nombre" in data:
        prospecto.nombre = required(data, "nombre", "Nombre")[:160]
    if crear or "telefono" in data:
        prospecto.telefono = optional_str(data, "telefono", 40)
    if crear or "email" in data:
        prospecto.email = validate_email(optional_str(data, "email", 255))
    if crear and not prospecto.telefono and not prospecto.email:
        raise ValidationError(
            "Registra al menos un teléfono o correo de contacto",
            fields={"telefono": "Teléfono o correo requerido"},
        )
    if crear or "mensaje" in data:
        prospecto.mensaje = optional_str(data, "mensaje")
    if crear or "notas" in data:
        prospecto.notas = optional_str(data, "notas")
    if crear or "origen" in data:
        prospecto.origen = validate_choice(
            data,
            "origen",
            tuple(ORIGENES_PROSPECTO),
            "Origen",
            default="presencial",
        )
    if crear or "estado" in data:
        prospecto.estado = validate_choice(
            data,
            "estado",
            tuple(ESTADOS_PROSPECTO),
            "Estado",
            default="nuevo",
        )
    if crear or "vehiculo_id" in data:
        vehiculo_id = _optional_id(data, "vehiculo_id")
        if vehiculo_id and not db.session.get(Vehiculo, vehiculo_id):
            raise ValidationError(
                "Vehículo no encontrado",
                fields={"vehiculo_id": "Vehículo inexistente"},
            )
        prospecto.vehiculo_id = vehiculo_id
    if crear or "vendedor_id" in data:
        prospecto.vendedor_id = _vendedor_permitido(data, prospecto.vendedor_id)
    return prospecto


@bp.get("")
@login_required
def listar():
    page, per_page = parse_pagination(request.args)
    query = Prospecto.query

    q = (request.args.get("q") or "").strip()
    if q:
        like = f"%{q}%"
        query = query.filter(
            or_(
                Prospecto.nombre.ilike(like),
                Prospecto.telefono.ilike(like),
                Prospecto.email.ilike(like),
            )
        )

    estado = request.args.get("estado")
    if estado:
        if estado not in ESTADOS_PROSPECTO:
            raise ValidationError("Estado inválido", fields={"estado": "Estado inválido"})
        query = query.filter(Prospecto.estado == estado)

    origen = request.args.get("origen")
    if origen:
        if origen not in ORIGENES_PROSPECTO:
            raise ValidationError("Origen inválido", fields={"origen": "Origen inválido"})
        query = query.filter(Prospecto.origen == origen)

    vendedor_id = request.args.get("vendedor_id")
    if vendedor_id:
        try:
            query = query.filter(Prospecto.vendedor_id == int(vendedor_id))
        except ValueError as exc:
            raise ValidationError(
                "Vendedor inválido", fields={"vendedor_id": "ID inválido"}
            ) from exc

    query = query.order_by(Prospecto.created_at.desc())
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)
    return ok(
        [prospecto.to_dict() for prospecto in pagination.items],
        meta=pagination_meta(pagination),
    )


@bp.get("/<int:prospecto_id>")
@login_required
def detalle(prospecto_id):
    return ok(_get_or_404(prospecto_id).to_dict())


@bp.post("")
@login_required
def crear():
    data = json_body()
    prospecto = _apply_fields(Prospecto(), data, crear=True)
    db.session.add(prospecto)
    db.session.commit()
    return created(prospecto.to_dict())


@bp.route("/<int:prospecto_id>", methods=["PUT", "PATCH"])
@login_required
def actualizar(prospecto_id):
    prospecto = _get_or_404(prospecto_id)
    data = json_body()
    _apply_fields(prospecto, data, crear=False)
    db.session.commit()
    return ok(prospecto.to_dict())


@bp.patch("/<int:prospecto_id>/estado")
@login_required
def cambiar_estado(prospecto_id):
    prospecto = _get_or_404(prospecto_id)
    data = json_body()
    prospecto.estado = validate_choice(
        data, "estado", tuple(ESTADOS_PROSPECTO), "Estado"
    )
    db.session.commit()
    return ok(prospecto.to_dict())


@bp.post("/<int:prospecto_id>/convertir-cliente")
@login_required
def convertir_cliente(prospecto_id):
    prospecto = _get_or_404(prospecto_id)
    if prospecto.cliente_id:
        cliente = db.session.get(Cliente, prospecto.cliente_id)
        if cliente:
            return ok(cliente.to_dict())

    cliente = None
    if prospecto.email:
        cliente = Cliente.query.filter(
            Cliente.activo.is_(True),
            db.func.lower(Cliente.email) == prospecto.email.lower(),
        ).first()
    if not cliente and prospecto.telefono:
        cliente = Cliente.query.filter(
            Cliente.activo.is_(True),
            Cliente.telefono == prospecto.telefono,
        ).first()
    creado = cliente is None
    if not cliente:
        cliente = Cliente(
            nombre=prospecto.nombre,
            email=prospecto.email,
            telefono=prospecto.telefono,
            notas=f"Convertido desde prospecto #{prospecto.id}",
        )
        db.session.add(cliente)
        db.session.flush()
    prospecto.cliente_id = cliente.id
    prospecto.estado = "ganado"
    db.session.commit()
    return created(cliente.to_dict()) if creado else ok(cliente.to_dict())

from flask import Blueprint, request
from flask_login import current_user, login_required

from ..extensions import db
from ..models import ROLES, Prospecto, Usuario, Venta
from ..utils.errors import ConflictError, ForbiddenError, NotFoundError, ValidationError
from ..utils.responses import created, ok, pagination_meta, parse_pagination
from ..utils.validators import json_body, optional_str, parse_bool, validate_email

bp = Blueprint("usuarios", __name__, url_prefix="/api/v1/usuarios")


def _only_admin():
    if current_user.rol != "admin":
        raise ForbiddenError("Solo un administrador puede gestionar usuarios")


def _get_or_404(usuario_id):
    usuario = db.session.get(Usuario, usuario_id)
    if not usuario:
        raise NotFoundError("Usuario no encontrado")
    return usuario


def _to_dict(usuario):
    return usuario.to_dict()


@bp.get("")
@login_required
def listar():
    _only_admin()
    page, per_page = parse_pagination(request.args)
    query = Usuario.query

    busqueda = optional_str(request.args, "q")
    if busqueda:
        like = f"%{busqueda}%"
        query = query.filter(
            db.or_(
                Usuario.nombre.ilike(like),
                Usuario.email.ilike(like),
            )
        )

    rol = request.args.get("rol")
    if rol:
        if rol not in ROLES:
            raise ValidationError("Rol inválido", fields={"rol": f"Opciones: {', '.join(ROLES)}"})
        query = query.filter(Usuario.rol == rol)

    activo_arg = request.args.get("activo")
    if activo_arg not in (None, ""):
        query = query.filter(Usuario.activo.is_(parse_bool(activo_arg)))

    pagination = query.order_by(Usuario.id.asc()).paginate(
        page=page, per_page=per_page, error_out=False
    )
    return ok(
        [_to_dict(usuario) for usuario in pagination.items],
        meta=pagination_meta(pagination),
    )


@bp.get("/<int:usuario_id>")
@login_required
def detalle(usuario_id):
    _only_admin()
    return ok(_to_dict(_get_or_404(usuario_id)))


@bp.post("")
@login_required
def crear():
    _only_admin()
    data = json_body()

    nombre = data.get("nombre")
    if not isinstance(nombre, str) or not nombre.strip():
        raise ValidationError("El nombre es obligatorio", fields={"nombre": "Campo requerido"})
    nombre = nombre.strip()

    email = validate_email(data.get("email"))
    if not email:
        raise ValidationError("El correo es obligatorio", fields={"email": "Campo requerido"})
    email = email.lower()

    rol = data.get("rol", "vendedor")
    if rol not in ROLES:
        raise ValidationError("Rol inválido", fields={"rol": f"Opciones: {', '.join(ROLES)}"})

    password = data.get("password")
    if not isinstance(password, str) or len(password) < 8:
        raise ValidationError(
            "La contraseña debe tener al menos 8 caracteres",
            fields={"password": "Mínimo 8 caracteres"},
        )

    if Usuario.query.filter(db.func.lower(Usuario.email) == email).first():
        raise ConflictError(
            "Ya existe un usuario con ese correo",
            code="EMAIL_DUPLICADO",
            fields={"email": "Este correo ya está registrado"},
        )

    usuario = Usuario(nombre=nombre, email=email, rol=rol, activo=True)
    usuario.set_password(password)
    db.session.add(usuario)
    db.session.commit()
    return created(_to_dict(usuario))


@bp.put("/<int:usuario_id>")
@login_required
def actualizar(usuario_id):
    _only_admin()
    usuario = _get_or_404(usuario_id)
    data = json_body()

    if "nombre" in data:
        nombre = data.get("nombre")
        if not isinstance(nombre, str) or not nombre.strip():
            raise ValidationError("El nombre es obligatorio", fields={"nombre": "Campo requerido"})
        usuario.nombre = nombre.strip()

    if "email" in data:
        email = validate_email(data.get("email"))
        if not email:
            raise ValidationError("El correo es obligatorio", fields={"email": "Campo requerido"})
        email = email.lower()
        if Usuario.query.filter(
            db.func.lower(Usuario.email) == email, Usuario.id != usuario.id
        ).first():
            raise ConflictError(
                "Ya existe un usuario con ese correo",
                code="EMAIL_DUPLICADO",
                fields={"email": "Este correo ya está registrado"},
            )
        usuario.email = email

    if "rol" in data:
        rol = data.get("rol")
        if rol not in ROLES:
            raise ValidationError("Rol inválido", fields={"rol": f"Opciones: {', '.join(ROLES)}"})
        usuario.rol = rol

    if "activo" in data:
        if usuario.id == current_user.id and not parse_bool(data.get("activo")):
            raise ValidationError(
                "No puedes desactivar tu propia cuenta", fields={"activo": "Acción no permitida"}
            )
        usuario.activo = parse_bool(data.get("activo"))

    db.session.commit()
    return ok(_to_dict(usuario))


@bp.delete("/<int:usuario_id>")
@login_required
def eliminar(usuario_id):
    _only_admin()
    usuario = _get_or_404(usuario_id)

    if usuario.id == current_user.id:
        raise ConflictError(
            "No puedes eliminar tu propia cuenta", code="SELF_DELETE"
        )

    if Venta.query.filter_by(vendedor_id=usuario.id).first():
        raise ConflictError(
            "No se puede eliminar: el usuario tiene ventas asociadas",
            code="VENTAS_ASOCIADAS",
        )
    if Prospecto.query.filter_by(vendedor_id=usuario.id).first():
        raise ConflictError(
            "No se puede eliminar: el usuario tiene prospectos asociados",
            code="PROSPECTOS_ASOCIADOS",
        )

    db.session.delete(usuario)
    db.session.commit()
    return ok({"message": "Usuario eliminado"})

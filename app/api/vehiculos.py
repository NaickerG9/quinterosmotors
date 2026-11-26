from flask import Blueprint, request
from flask_login import current_user, login_required
from sqlalchemy import or_

from ..extensions import db
from ..models import Vehiculo, VehiculoImagen
from ..models.enums import (
    CARROCERIAS,
    COMBUSTIBLES,
    ESTADOS_VEHICULO,
    TRANSMISIONES,
)
from ..services.storage import get_storage
from ..services.tasas import get_tasa_micros
from ..services.ventas import venta_activa_de_vehiculo
from ..utils.errors import ConflictError, NotFoundError, ValidationError
from ..utils.images import validate_image
from ..utils.responses import created, ok, pagination_meta, parse_pagination
from ..utils.validators import (
    json_body,
    optional_str,
    parse_bool,
    parse_int_field,
    parse_money_field,
    required,
    validate_choice,
    validate_year,
)

bp = Blueprint("api_vehiculos", __name__, url_prefix="/api/v1/vehiculos")


def _get_or_404(vehiculo_id):
    vehiculo = db.session.get(Vehiculo, vehiculo_id)
    if not vehiculo:
        raise NotFoundError("Vehículo no encontrado")
    return vehiculo


def _series(vehiculo):
    return vehiculo.to_dict(
        incluir_costos=current_user.rol == "admin",
        tasa_micros=get_tasa_micros(),
    )


def _check_unique(vehiculo_id, vin, placa):
    if vin:
        other = Vehiculo.query.filter(
            Vehiculo.vin == vin, Vehiculo.id != vehiculo_id
        ).first()
        if other:
            raise ConflictError(
                "Ya existe un vehículo con ese VIN",
                code="VIN_DUPLICADO",
                fields={"vin": "VIN ya registrado"},
            )
    if placa:
        other = Vehiculo.query.filter(
            Vehiculo.placa == placa, Vehiculo.id != vehiculo_id
        ).first()
        if other:
            raise ConflictError(
                "Ya existe un vehículo con esa placa",
                code="PLACA_DUPLICADA",
                fields={"placa": "Placa ya registrada"},
            )


def _apply_fields(vehiculo, data, crear=False):
    if crear or "marca" in data:
        vehiculo.marca = required(data, "marca", "Marca")[:80]
    if crear or "modelo" in data:
        vehiculo.modelo = required(data, "modelo", "Modelo")[:80]
    if crear or "anio" in data:
        vehiculo.anio = validate_year(parse_int_field(data, "anio", "Año"))
    if crear or "precio_ves_centavos" in data:
        vehiculo.precio_ves_centavos = parse_money_field(
            data, "precio_ves_centavos", "Precio en VES"
        )
        if vehiculo.precio_ves_centavos <= 0:
            raise ValidationError(
                "El precio debe ser mayor que cero",
                fields={"precio_ves_centavos": "Debe ser mayor que cero"},
            )
    if "kilometraje" in data or crear:
        vehiculo.kilometraje = parse_int_field(
            data, "kilometraje", "Kilometraje", default=0, minimum=0
        )
    if crear or "version" in data:
        vehiculo.version = optional_str(data, "version", 120)
    if crear or "color" in data:
        vehiculo.color = optional_str(data, "color", 40)
    if crear or "vin" in data:
        vehiculo.vin = optional_str(data, "vin", 32)
        if vehiculo.vin:
            vehiculo.vin = vehiculo.vin.upper()
    if crear or "placa" in data:
        vehiculo.placa = optional_str(data, "placa", 16)
        if vehiculo.placa:
            vehiculo.placa = vehiculo.placa.upper()
    if crear or "descripcion" in data:
        vehiculo.descripcion = optional_str(data, "descripcion")
    if crear or "destacado" in data:
        vehiculo.destacado = parse_bool(data.get("destacado"), False)

    if crear or "estado" in data:
        estado = data.get("estado")
        if crear and estado in (None, ""):
            estado = "disponible"
        if not estado:
            raise ValidationError(
                "Estado es obligatorio", fields={"estado": "Este campo es obligatorio"}
            )
        if estado not in ESTADOS_VEHICULO:
            raise ValidationError(
                "Estado inválido",
                fields={
                    "estado": f"Opciones: {', '.join(sorted(ESTADOS_VEHICULO))}"
                },
            )
        if (
            estado == "disponible"
            and not crear
            and vehiculo.tiene_venta_activa
        ):
            raise ConflictError(
                "No se puede marcar como disponible un vehículo con una venta activa",
                code="VENTA_ACTIVA",
                fields={"estado": "Cancela la venta activa primero"},
            )
        vehiculo.estado = estado

    if crear or "transmision" in data:
        vehiculo.transmision = validate_choice(
            data, "transmision", tuple(TRANSMISIONES), required_field=False
        )
    if crear or "combustible" in data:
        vehiculo.combustible = validate_choice(
            data, "combustible", tuple(COMBUSTIBLES), required_field=False
        )
    if crear or "carroceria" in data:
        vehiculo.carroceria = validate_choice(
            data, "carroceria", tuple(CARROCERIAS), required_field=False
        )

    if current_user.rol == "admin" and ("costo_ves_centavos" in data or crear):
        vehiculo.costo_ves_centavos = parse_money_field(
            data,
            "costo_ves_centavos",
            "Costo en VES",
            required_field=False,
            default=None,
        )
    return vehiculo


@bp.get("")
@login_required
def listar():
    page, per_page = parse_pagination(request.args)
    incluir_archivados = parse_bool(
        request.args.get("incluir_archivados")
    ) and current_user.rol == "admin"

    query = Vehiculo.query
    if not incluir_archivados:
        query = query.filter(Vehiculo.archivado.is_(False))

    q = (request.args.get("q") or "").strip()
    if q:
        like = f"%{q}%"
        query = query.filter(
            or_(
                Vehiculo.marca.ilike(like),
                Vehiculo.modelo.ilike(like),
                Vehiculo.version.ilike(like),
                Vehiculo.vin.ilike(like),
                Vehiculo.placa.ilike(like),
            )
        )

    estado = request.args.get("estado")
    if estado:
        if estado not in ESTADOS_VEHICULO:
            raise ValidationError("Estado inválido", fields={"estado": "Estado inválido"})
        query = query.filter(Vehiculo.estado == estado)

    marca = (request.args.get("marca") or "").strip()
    if marca:
        query = query.filter(Vehiculo.marca.ilike(f"%{marca}%"))

    anio = request.args.get("anio")
    if anio:
        try:
            query = query.filter(Vehiculo.anio == int(anio))
        except ValueError as exc:
            raise ValidationError("Año inválido", fields={"anio": "Año inválido"}) from exc

    for key, comparator in (("precio_min", "min"), ("precio_max", "max")):
        value = request.args.get(key)
        if value:
            try:
                cents = int(value)
            except ValueError as exc:
                raise ValidationError(
                    "Precio inválido", fields={key: "Debe ser un entero en centavos"}
                ) from exc
            if comparator == "min":
                query = query.filter(Vehiculo.precio_ves_centavos >= cents)
            else:
                query = query.filter(Vehiculo.precio_ves_centavos <= cents)

    sort = request.args.get("sort", "reciente")
    ordenamientos = {
        "reciente": Vehiculo.created_at.desc(),
        "precio_asc": Vehiculo.precio_ves_centavos.asc(),
        "precio_desc": Vehiculo.precio_ves_centavos.desc(),
        "anio_asc": Vehiculo.anio.asc(),
        "anio_desc": Vehiculo.anio.desc(),
        "marca": Vehiculo.marca.asc(),
    }
    query = query.order_by(ordenamientos.get(sort, ordenamientos["reciente"]))

    pagination = query.paginate(page=page, per_page=per_page, error_out=False)
    return ok(
        [_series(vehiculo) for vehiculo in pagination.items],
        meta=pagination_meta(pagination),
    )


@bp.get("/<int:vehiculo_id>")
@login_required
def detalle(vehiculo_id):
    vehiculo = _get_or_404(vehiculo_id)
    data = _series(vehiculo)
    venta = venta_activa_de_vehiculo(vehiculo.id)
    data["venta_activa"] = venta.to_dict(resumen=True) if venta else None
    return ok(data)


@bp.post("")
@login_required
def crear():
    data = json_body()
    vehiculo = _apply_fields(Vehiculo(), data, crear=True)
    _check_unique(None, vehiculo.vin, vehiculo.placa)
    db.session.add(vehiculo)
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise
    return created(_series(vehiculo))


@bp.route("/<int:vehiculo_id>", methods=["PUT", "PATCH"])
@login_required
def actualizar(vehiculo_id):
    vehiculo = _get_or_404(vehiculo_id)
    data = json_body()
    _apply_fields(vehiculo, data, crear=False)
    _check_unique(vehiculo.id, vehiculo.vin, vehiculo.placa)
    db.session.commit()
    return ok(_series(vehiculo))


@bp.delete("/<int:vehiculo_id>")
@login_required
def eliminar(vehiculo_id):
    vehiculo = _get_or_404(vehiculo_id)
    if vehiculo.ventas.count():
        raise ConflictError(
            "No se puede eliminar un vehículo con ventas registradas. "
            "Archívalo para ocultarlo del inventario.",
            code="VEHICULO_CON_VENTAS",
        )
    rutas = [imagen.ruta for imagen in vehiculo.imagenes]
    db.session.delete(vehiculo)
    db.session.commit()
    storage = get_storage()
    for ruta in rutas:
        try:
            storage.delete(ruta)
        except (OSError, ValueError):
            pass
    return ok({"id": vehiculo_id, "eliminado": True})


@bp.post("/<int:vehiculo_id>/archivar")
@login_required
def archivar(vehiculo_id):
    if current_user.rol != "admin":
        from ..utils.errors import ForbiddenError

        raise ForbiddenError("Solo un administrador puede archivar vehículos")
    vehiculo = _get_or_404(vehiculo_id)
    if vehiculo.tiene_venta_activa:
        raise ConflictError(
            "No se puede archivar un vehículo con una venta activa"
        )
    vehiculo.archivado = True
    db.session.commit()
    return ok(_series(vehiculo))


@bp.post("/<int:vehiculo_id>/imagenes")
@login_required
def subir_imagenes(vehiculo_id):
    vehiculo = _get_or_404(vehiculo_id)
    files = [f for f in request.files.getlist("archivos") if f and f.filename]
    if not files:
        files = [f for f in request.files.getlist("archivo") if f and f.filename]
    if not files:
        raise ValidationError(
            "Selecciona al menos una imagen", fields={"archivos": "Archivo requerido"}
        )

    maximo = current_app_config_max()
    if len(vehiculo.imagenes) + len(files) > maximo:
        raise ValidationError(
            f"Un vehículo puede tener máximo {maximo} imágenes",
            code="LIMITE_IMAGENES",
        )

    storage = get_storage()
    saved_paths = []
    next_order = max([imagen.orden for imagen in vehiculo.imagenes], default=0) + 1
    has_principal = any(imagen.es_principal for imagen in vehiculo.imagenes)
    try:
        for index, file_storage in enumerate(files):
            extension, _ = validate_image(file_storage)
            ruta, size = storage.save(file_storage, extension)
            saved_paths.append(ruta)
            imagen = VehiculoImagen(
                vehiculo_id=vehiculo.id,
                ruta=ruta,
                orden=next_order + index,
                es_principal=(not has_principal and index == 0),
                bytes=size,
            )
            db.session.add(imagen)
        db.session.commit()
    except Exception:
        db.session.rollback()
        for ruta in saved_paths:
            try:
                storage.delete(ruta)
            except OSError:
                pass
        raise
    return created([imagen.to_dict() for imagen in vehiculo.imagenes])


def current_app_config_max():
    from flask import current_app

    return current_app.config["MAX_IMAGENES_POR_VEHICULO"]


@bp.delete("/<int:vehiculo_id>/imagenes/<int:imagen_id>")
@login_required
def eliminar_imagen(vehiculo_id, imagen_id):
    vehiculo = _get_or_404(vehiculo_id)
    imagen = VehiculoImagen.query.filter_by(
        id=imagen_id, vehiculo_id=vehiculo.id
    ).first()
    if not imagen:
        raise NotFoundError("Imagen no encontrada")
    ruta = imagen.ruta
    era_principal = imagen.es_principal
    db.session.delete(imagen)
    db.session.flush()
    if era_principal:
        siguiente = (
            VehiculoImagen.query.filter_by(vehiculo_id=vehiculo.id)
            .order_by(VehiculoImagen.orden.asc())
            .first()
        )
        if siguiente:
            siguiente.es_principal = True
    db.session.commit()
    try:
        get_storage().delete(ruta)
    except OSError:
        pass
    return ok([imagen.to_dict() for imagen in vehiculo.imagenes])


@bp.patch("/<int:vehiculo_id>/imagenes/<int:imagen_id>/principal")
@login_required
def marcar_principal(vehiculo_id, imagen_id):
    vehiculo = _get_or_404(vehiculo_id)
    imagen = VehiculoImagen.query.filter_by(
        id=imagen_id, vehiculo_id=vehiculo.id
    ).first()
    if not imagen:
        raise NotFoundError("Imagen no encontrada")
    for item in vehiculo.imagenes:
        item.es_principal = item.id == imagen.id
    db.session.commit()
    return ok([item.to_dict() for item in vehiculo.imagenes])

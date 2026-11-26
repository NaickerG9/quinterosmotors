from sqlalchemy.exc import IntegrityError

from ..extensions import db
from ..models import Cliente, TasaCambio, Vehiculo, Venta
from ..models.enums import ESTADOS_VENTA_ACTIVA, FORMAS_PAGO
from ..utils.errors import ConflictError, NotFoundError, ValidationError
from ..utils.money import usd_centavos_from_ves
from ..utils.time import utcnow
from ..utils.validators import (
    parse_datetime_field,
    parse_int_field,
    parse_money_field,
    validate_choice,
)
from .tasas import get_tasa_actual


def venta_activa_de_vehiculo(vehiculo_id, excluir_venta_id=None):
    query = Venta.query.filter(
        Venta.vehiculo_id == vehiculo_id,
        Venta.estado.in_(ESTADOS_VENTA_ACTIVA),
    )
    if excluir_venta_id:
        query = query.filter(Venta.id != excluir_venta_id)
    return query.first()


def crear_venta(data, usuario):
    vehiculo_id = parse_int_field(data, "vehiculo_id", "Vehículo")
    cliente_id = parse_int_field(data, "cliente_id", "Cliente")
    vehiculo = db.session.get(Vehiculo, vehiculo_id)
    if not vehiculo or vehiculo.archivado:
        raise NotFoundError("Vehículo no encontrado")
    if vehiculo.estado != "disponible" or venta_activa_de_vehiculo(vehiculo.id):
        raise ConflictError(
            "El vehículo no está disponible para una nueva venta",
            code="VEHICULO_NO_DISPONIBLE",
        )

    cliente = db.session.get(Cliente, cliente_id)
    if not cliente or not cliente.activo:
        raise NotFoundError("Cliente no encontrado o inactivo")

    tasa = get_tasa_actual()
    if not tasa:
        raise ConflictError(
            "No hay tasa VES/USD configurada. Un administrador debe registrarla.",
            code="TASA_NO_CONFIGURADA",
        )

    estado = validate_choice(
        data, "estado", ("apartado", "completada"), "Estado", default="completada"
    )
    forma_pago = validate_choice(
        data, "forma_pago", tuple(FORMAS_PAGO), "Forma de pago", default="contado"
    )
    precio_final = parse_money_field(
        data,
        "precio_final_ves_centavos",
        "Precio final",
        required_field=False,
        default=vehiculo.precio_ves_centavos,
    )
    if precio_final <= 0:
        raise ValidationError(
            "El precio final debe ser mayor que cero",
            fields={"precio_final_ves_centavos": "Debe ser mayor que cero"},
        )

    precio_usd = usd_centavos_from_ves(precio_final, tasa.ves_por_usd_micros)
    if precio_usd is None:
        raise ConflictError("No se pudo calcular la referencia en USD")

    fecha_venta = parse_datetime_field(data, "fecha_venta", "Fecha de venta")
    notas = data.get("notas")
    if notas is not None and not isinstance(notas, str):
        raise ValidationError(
            "Las notas deben ser texto",
            fields={"notas": "Debe ser texto"},
        )

    venta = Venta(
        vehiculo_id=vehiculo.id,
        cliente_id=cliente.id,
        vendedor_id=usuario.id,
        tasa_id=tasa.id,
        estado=estado,
        precio_lista_ves_centavos=vehiculo.precio_ves_centavos,
        precio_final_ves_centavos=precio_final,
        tasa_ves_por_usd_micros=tasa.ves_por_usd_micros,
        precio_usd_centavos=precio_usd,
        forma_pago=forma_pago,
        notas=(notas.strip() or None) if notas is not None else None,
    )
    if estado == "completada":
        venta.fecha_venta = fecha_venta or utcnow()
        venta.completada_at = venta.fecha_venta
        vehiculo.estado = "vendido"
    else:
        vehiculo.estado = "reservado"

    db.session.add(venta)
    try:
        db.session.commit()
    except IntegrityError as exc:
        db.session.rollback()
        raise ConflictError(
            "El vehículo ya tiene una venta activa",
            code="VEHICULO_NO_DISPONIBLE",
        ) from exc
    return venta


def completar_venta(venta):
    if venta.estado != "apartado":
        raise ConflictError("Solo se pueden completar ventas apartadas")
    venta.marcar_completada()
    db.session.commit()
    return venta


def cancelar_venta(venta):
    if venta.estado not in ESTADOS_VENTA_ACTIVA:
        raise ConflictError("La venta ya está cancelada")
    venta.marcar_cancelada()
    otra = venta_activa_de_vehiculo(venta.vehiculo_id, excluir_venta_id=venta.id)
    if not otra and venta.vehiculo and venta.vehiculo.estado in (
        "reservado",
        "vendido",
    ):
        venta.vehiculo.estado = "disponible"
    db.session.commit()
    return venta


def puede_gestionar_venta(venta, usuario):
    return usuario.rol == "admin" or venta.vendedor_id == usuario.id


def tasa_de_venta(venta):
    return db.session.get(TasaCambio, venta.tasa_id) if venta.tasa_id else None

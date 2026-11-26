from datetime import timedelta

from sqlalchemy import func

from ..extensions import db
from ..models import Prospecto, Vehiculo, Venta
from ..models.enums import ESTADOS_PROSPECTO, ESTADOS_VEHICULO
from ..utils.money import usd_centavos_from_ves
from ..utils.time import start_of_month, utcnow
from .tasas import get_tasa_actual, info_tasa


def _rango(desde, hasta):
    if hasta is None:
        desde = desde or start_of_month()
        inicio = start_of_month(desde)
        # Primer día del mes siguiente: cubre todo el mes solicitado.
        hasta = (inicio + timedelta(days=32)).replace(day=1)
    else:
        desde = desde or start_of_month(hasta)
        hasta = (hasta + timedelta(days=1)).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
    return desde, hasta


def resumen(usuario, desde=None, hasta=None):
    desde, hasta = _rango(desde, hasta)
    tasa = get_tasa_actual()
    micros = tasa.ves_por_usd_micros if tasa else None

    conteo_estados = {
        estado: 0 for estado in ESTADOS_VEHICULO
    }
    for estado, total in (
        db.session.query(Vehiculo.estado, func.count(Vehiculo.id))
        .filter(Vehiculo.archivado.is_(False))
        .group_by(Vehiculo.estado)
        .all()
    ):
        conteo_estados[estado] = total

    valor_inventario = (
        db.session.query(func.coalesce(func.sum(Vehiculo.precio_ves_centavos), 0))
        .filter(
            Vehiculo.archivado.is_(False),
            Vehiculo.estado == "disponible",
        )
        .scalar()
        or 0
    )
    sin_costo = (
        Vehiculo.query.filter(
            Vehiculo.archivado.is_(False),
            Vehiculo.estado == "disponible",
            Vehiculo.costo_ves_centavos.is_(None),
        ).count()
    )
    valor_con_costo = (
        db.session.query(func.coalesce(func.sum(Vehiculo.precio_ves_centavos), 0))
        .filter(
            Vehiculo.archivado.is_(False),
            Vehiculo.estado == "disponible",
            Vehiculo.costo_ves_centavos.isnot(None),
        )
        .scalar()
        or 0
    )
    costo_inventario = (
        db.session.query(func.coalesce(func.sum(Vehiculo.costo_ves_centavos), 0))
        .filter(
            Vehiculo.archivado.is_(False),
            Vehiculo.estado == "disponible",
            Vehiculo.costo_ves_centavos.isnot(None),
        )
        .scalar()
        or 0
    )

    fecha_venta = func.coalesce(
        Venta.fecha_venta, Venta.completada_at, Venta.created_at
    )
    ventas_query = Venta.query.filter(
        Venta.estado == "completada",
        fecha_venta >= desde,
        fecha_venta < hasta,
    )
    ventas_mes = ventas_query.count()
    ingresos_ves = (
        ventas_query.with_entities(
            func.coalesce(func.sum(Venta.precio_final_ves_centavos), 0)
        ).scalar()
        or 0
    )
    ingresos_usd = (
        ventas_query.with_entities(
            func.coalesce(func.sum(Venta.precio_usd_centavos), 0)
        ).scalar()
        or 0
    )

    top_modelos = (
        db.session.query(
            Vehiculo.marca,
            Vehiculo.modelo,
            func.count(Venta.id).label("ventas"),
            func.coalesce(
                func.sum(Venta.precio_final_ves_centavos), 0
            ).label("ingresos"),
        )
        .join(Venta, Venta.vehiculo_id == Vehiculo.id)
        .filter(
            Venta.estado == "completada",
            fecha_venta >= desde,
            fecha_venta < hasta,
        )
        .group_by(Vehiculo.marca, Vehiculo.modelo)
        .order_by(func.count(Venta.id).desc(), func.sum(Venta.precio_final_ves_centavos).desc())
        .limit(5)
        .all()
    )

    prospectos_por_estado = {estado: 0 for estado in ESTADOS_PROSPECTO}
    for estado, total in (
        db.session.query(Prospecto.estado, func.count(Prospecto.id))
        .filter(Prospecto.created_at >= desde, Prospecto.created_at < hasta)
        .group_by(Prospecto.estado)
        .all()
    ):
        prospectos_por_estado[estado] = total

    ultimas_ventas = (
        Venta.query.order_by(Venta.created_at.desc()).limit(5).all()
    )
    ultimos_prospectos = (
        Prospecto.query.order_by(Prospecto.created_at.desc()).limit(5).all()
    )

    data = {
        "rango": {"desde": desde.isoformat(), "hasta": hasta.isoformat()},
        "tasa": info_tasa(tasa),
        "vehiculos": {
            "por_estado": conteo_estados,
            "total": sum(conteo_estados.values()),
            "stock": conteo_estados["disponible"] + conteo_estados["reservado"],
            "sin_costo": int(sin_costo),
            "valor_inventario_ves_centavos": int(valor_inventario),
            "valor_inventario_usd_centavos": usd_centavos_from_ves(
                int(valor_inventario), micros
            )
            if micros
            else None,
        },
        "ventas": {
            "cantidad": ventas_mes,
            "ingresos_ves_centavos": int(ingresos_ves),
            "ingresos_usd_centavos": int(ingresos_usd),
            "promedio_ves_centavos": int(ingresos_ves) // ventas_mes
            if ventas_mes
            else 0,
        },
        "prospectos": {
            "por_estado": prospectos_por_estado,
            "total": sum(prospectos_por_estado.values()),
        },
        "top_modelos": [
            {
                "marca": row.marca,
                "modelo": row.modelo,
                "ventas": row.ventas,
                "ingresos_ves_centavos": int(row.ingresos or 0),
            }
            for row in top_modelos
        ],
        "ultimas_ventas": [venta.to_dict(resumen=True) for venta in ultimas_ventas],
        "ultimos_prospectos": [
            prospecto.to_dict() for prospecto in ultimos_prospectos
        ],
    }
    if usuario.rol == "admin":
        data["vehiculos"]["costo_inventario_ves_centavos"] = int(costo_inventario)
        data["vehiculos"]["margen_inventario_ves_centavos"] = int(
            valor_con_costo - costo_inventario
        )
    return data

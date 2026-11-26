import io
from datetime import datetime

import pytest


def test_health_is_public(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.get_json() == {"status": "ok"}


def test_login_page_is_public(client):
    response = client.get("/login")
    assert response.status_code == 200
    assert b"Iniciar sesi" in response.data


def test_protected_page_redirects_to_login(client):
    response = client.get("/")
    assert response.status_code == 302
    assert "/login" in response.headers["Location"]


def test_protected_api_returns_401(client):
    response = client.get("/api/v1/vehiculos")
    assert response.status_code == 401
    assert response.get_json()["error"]["code"] == "NO_AUTENTICADO"


def test_login_rejects_invalid_credentials(client):
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "admin@test.local", "password": "incorrecta"},
    )
    assert response.status_code == 401
    assert response.get_json()["error"]["code"] == "CREDENCIALES_INVALIDAS"


def test_login_and_me(client):
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "admin@test.local", "password": "Admin123!"},
    )
    assert response.status_code == 200
    assert response.get_json()["data"]["rol"] == "admin"

    me = client.get("/api/v1/auth/me")
    assert me.status_code == 200
    assert me.get_json()["data"]["email"] == "admin@test.local"


def test_logout_requires_session_then_ends_it(admin_client):
    response = admin_client.post("/api/v1/auth/logout")
    assert response.status_code == 200
    assert admin_client.get("/api/v1/auth/me").status_code == 401


def test_security_headers_present(client):
    response = client.get("/health")
    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert response.headers["X-Frame-Options"] == "DENY"
    assert "default-src 'self'" in response.headers["Content-Security-Policy"]


def test_rate_requires_admin(client):
    client.post(
        "/api/v1/auth/login",
        json={"email": "vendedor@test.local", "password": "Vendedor123!"},
    )
    response = client.put("/api/v1/tasa", json={"ves_por_usd": "40,00"})
    assert response.status_code == 403


def test_rate_creation_and_history(admin_client, tasa):
    assert tasa["ves_por_usd"] == 36.5
    assert tasa["ves_por_usd_micros"] == 36_500_000
    assert tasa["usuario"] == "Admin Pruebas"

    actual = admin_client.get("/api/v1/tasa")
    assert actual.status_code == 200
    assert actual.get_json()["data"]["configurada"] is True

    historial = admin_client.get("/api/v1/tasa/historial")
    assert historial.status_code == 200
    assert historial.get_json()["meta"]["total"] == 1


def test_rate_rejects_invalid_value(admin_client):
    response = admin_client.put("/api/v1/tasa", json={"ves_por_usd": "0"})
    assert response.status_code == 400
    assert response.get_json()["error"]["fields"]["ves_por_usd"]


def test_vehicle_crud_as_admin(admin_client, vehiculo):
    assert vehiculo["titulo"] == "Toyota Corolla XEI"
    assert vehiculo["precio_usd_centavos"] == 100_000_00
    assert vehiculo["costo_ves_centavos"] == 3_000_000_00

    listado = admin_client.get("/api/v1/vehiculos?q=corolla")
    assert listado.status_code == 200
    assert listado.get_json()["meta"]["total"] == 1

    detalle = admin_client.get(f"/api/v1/vehiculos/{vehiculo['id']}")
    assert detalle.status_code == 200
    assert detalle.get_json()["data"]["venta_activa"] is None

    update = admin_client.put(
        f"/api/v1/vehiculos/{vehiculo['id']}", json={"color": "Rojo"}
    )
    assert update.status_code == 200
    assert update.get_json()["data"]["color"] == "Rojo"


def test_vehicle_filters_and_editable_state(admin_client, vehiculo):
    otra = admin_client.post(
        "/api/v1/vehiculos",
        json={
            "marca": "Ford",
            "modelo": "Explorer",
            "anio": 2022,
            "precio_ves_centavos": 8_000_000_00,
            "estado": "reservado",
        },
    )
    assert otra.status_code == 201, otra.get_json()
    assert otra.get_json()["data"]["estado"] == "reservado"

    filtrado = admin_client.get(
        "/api/v1/vehiculos",
        query_string={
            "marca": "ford",
            "estado": "reservado",
            "precio_min": 7_000_000_00,
            "precio_max": 9_000_000_00,
        },
    )
    assert filtrado.status_code == 200
    assert filtrado.get_json()["meta"]["total"] == 1
    assert filtrado.get_json()["data"][0]["modelo"] == "Explorer"

    actualizado = admin_client.put(
        f"/api/v1/vehiculos/{otra.get_json()['data']['id']}",
        json={"estado": "disponible"},
    )
    assert actualizado.status_code == 200
    assert actualizado.get_json()["data"]["estado"] == "disponible"

    invalido = admin_client.put(
        f"/api/v1/vehiculos/{vehiculo['id']}", json={"estado": "inexistente"}
    )
    assert invalido.status_code == 400
    assert invalido.get_json()["error"]["fields"]["estado"]


def test_vehicle_delete_and_conflict_with_sales(admin_client, vehiculo):
    response = admin_client.delete(f"/api/v1/vehiculos/{vehiculo['id']}")
    assert response.status_code == 200, response.get_json()
    assert response.get_json()["data"]["eliminado"] is True
    assert admin_client.get(f"/api/v1/vehiculos/{vehiculo['id']}").status_code == 404

    otro = admin_client.post(
        "/api/v1/vehiculos",
        json={
            "marca": "Kia",
            "modelo": "Rio",
            "anio": 2020,
            "precio_ves_centavos": 2_000_000_00,
        },
    )
    assert otro.status_code == 201
    cliente = admin_client.post(
        "/api/v1/clientes",
        json={"nombre": "Cliente Prueba", "documento": "V-999", "email": "c@test.local"},
    )
    assert cliente.status_code == 201
    venta = admin_client.post(
        "/api/v1/ventas",
        json={
            "vehiculo_id": otro.get_json()["data"]["id"],
            "cliente_id": cliente.get_json()["data"]["id"],
        },
    )
    assert venta.status_code == 201
    bloqueado = admin_client.delete(
        f"/api/v1/vehiculos/{otro.get_json()['data']['id']}"
    )
    assert bloqueado.status_code == 409
    assert bloqueado.get_json()["error"]["code"] == "VEHICULO_CON_VENTAS"


def test_vehicle_costs_hidden_from_vendedor(vendedor_client, vehiculo):
    response = vendedor_client.get(f"/api/v1/vehiculos/{vehiculo['id']}")
    assert response.status_code == 200
    data = response.get_json()["data"]
    assert "costo_ves_centavos" not in data
    assert data["precio_usd_centavos"] == 100_000_00


def test_vehicle_duplicate_vin_conflict(admin_client, vehiculo):
    response = admin_client.post(
        "/api/v1/vehiculos",
        json={
            "marca": "Otra",
            "modelo": "Marca",
            "anio": 2020,
            "precio_ves_centavos": 100_000,
            "vin": vehiculo["vin"],
        },
    )
    assert response.status_code == 409
    assert response.get_json()["error"]["fields"]["vin"]


def test_vehicle_archive_requires_admin(vendedor_client, admin_client, vehiculo):
    forbidden = vendedor_client.post(f"/api/v1/vehiculos/{vehiculo['id']}/archivar")
    assert forbidden.status_code == 403

    archived = admin_client.post(f"/api/v1/vehiculos/{vehiculo['id']}/archivar")
    assert archived.status_code == 200
    assert archived.get_json()["data"]["archivado"] is True

    listado = admin_client.get("/api/v1/vehiculos")
    assert listado.get_json()["meta"]["total"] == 0


def test_vehicle_image_upload_and_media_requires_login(client, admin_client, vehiculo):
    png = b"\x89PNG\r\n\x1a\n" + b"0" * 128
    response = admin_client.post(
        f"/api/v1/vehiculos/{vehiculo['id']}/imagenes",
        data={"archivos": (io.BytesIO(png), "foto.png")},
        content_type="multipart/form-data",
    )
    assert response.status_code == 201, response.get_json()
    imagenes = response.get_json()["data"]
    assert len(imagenes) == 1
    assert imagenes[0]["ruta"].startswith("vehiculos/")
    assert imagenes[0]["es_principal"] is True

    url = imagenes[0]["url"]
    assert admin_client.get(url).status_code == 200
    assert client.get(url).status_code == 401


def test_vehicle_image_rejects_invalid_format(admin_client, vehiculo):
    response = admin_client.post(
        f"/api/v1/vehiculos/{vehiculo['id']}/imagenes",
        data={"archivos": (io.BytesIO(b"no soy una imagen"), "nota.txt")},
        content_type="multipart/form-data",
    )
    assert response.status_code == 400
    assert response.get_json()["error"]["code"] == "IMAGEN_INVALIDA"


def test_client_crud_and_duplicate_document(admin_client, cliente):
    assert cliente["total_compras"] == 0

    duplicate = admin_client.post(
        "/api/v1/clientes",
        json={"nombre": "Otra Persona", "documento": cliente["documento"]},
    )
    assert duplicate.status_code == 409

    detail = admin_client.get(f"/api/v1/clientes/{cliente['id']}")
    assert detail.status_code == 200
    assert detail.get_json()["data"]["ventas"] == []

    update = admin_client.put(
        f"/api/v1/clientes/{cliente['id']}",
        json={"telefono": "+58 414-000-0000"},
    )
    assert update.status_code == 200
    assert update.get_json()["data"]["telefono"] == "+58 414-000-0000"


def test_client_with_sales_cannot_be_deleted(
    admin_client, cliente, vehiculo
):
    venta = admin_client.post(
        "/api/v1/ventas",
        json={
            "vehiculo_id": vehiculo["id"],
            "cliente_id": cliente["id"],
            "estado": "completada",
        },
    )
    assert venta.status_code == 201
    response = admin_client.delete(f"/api/v1/clientes/{cliente['id']}")
    assert response.status_code == 409


def test_sale_snapshots_rate_and_prices(admin_client, vehiculo, cliente, tasa):
    response = admin_client.post(
        "/api/v1/ventas",
        json={
            "vehiculo_id": vehiculo["id"],
            "cliente_id": cliente["id"],
            "estado": "completada",
            "forma_pago": "contado",
            "precio_final_ves_centavos": 3_500_000_00,
        },
    )
    assert response.status_code == 201, response.get_json()
    venta = response.get_json()["data"]
    assert venta["precio_lista_ves_centavos"] == 3_650_000_00
    assert venta["precio_final_ves_centavos"] == 3_500_000_00
    assert venta["tasa_ves_por_usd_micros"] == tasa["ves_por_usd_micros"]
    assert venta["precio_usd_centavos"] == 95_890_41

    vehiculo_actualizado = admin_client.get(f"/api/v1/vehiculos/{vehiculo['id']}")
    assert vehiculo_actualizado.get_json()["data"]["estado"] == "vendido"

    segunda = admin_client.post(
        "/api/v1/ventas",
        json={"vehiculo_id": vehiculo["id"], "cliente_id": cliente["id"]},
    )
    assert segunda.status_code == 409
    assert segunda.get_json()["error"]["code"] == "VEHICULO_NO_DISPONIBLE"


def test_sale_accepts_custom_date(admin_client, vehiculo, cliente):
    fecha = datetime(2026, 10, 15, 10, 30)
    response = admin_client.post(
        "/api/v1/ventas",
        json={
            "vehiculo_id": vehiculo["id"],
            "cliente_id": cliente["id"],
            "estado": "completada",
            "fecha_venta": fecha.isoformat(),
        },
    )
    assert response.status_code == 201, response.get_json()
    data = response.get_json()["data"]
    assert data["fecha_venta"] == fecha.isoformat()
    assert data["completada_at"] == fecha.isoformat()


def test_sale_rejects_invalid_date(admin_client, vehiculo, cliente):
    response = admin_client.post(
        "/api/v1/ventas",
        json={
            "vehiculo_id": vehiculo["id"],
            "cliente_id": cliente["id"],
            "fecha_venta": "no-es-fecha",
        },
    )
    assert response.status_code == 400
    assert response.get_json()["error"]["fields"]["fecha_venta"]


def test_sale_requires_rate(admin_client, cliente):
    vehiculo_response = admin_client.post(
        "/api/v1/vehiculos",
        json={
            "marca": "Sin Tasa",
            "modelo": "Prueba",
            "anio": 2020,
            "precio_ves_centavos": 100_000_00,
        },
    )
    vehiculo_id = vehiculo_response.get_json()["data"]["id"]

    response = admin_client.post(
        "/api/v1/ventas",
        json={"vehiculo_id": vehiculo_id, "cliente_id": cliente["id"]},
    )
    assert response.status_code == 409
    assert response.get_json()["error"]["code"] == "TASA_NO_CONFIGURADA"


def test_apartado_can_be_completed_and_cancelled(
    admin_client, vehiculo, cliente, tasa
):
    response = admin_client.post(
        "/api/v1/ventas",
        json={
            "vehiculo_id": vehiculo["id"],
            "cliente_id": cliente["id"],
            "estado": "apartado",
        },
    )
    assert response.status_code == 201
    venta = response.get_json()["data"]
    assert venta["estado"] == "apartado"

    detalle = admin_client.get(f"/api/v1/ventas/{venta['id']}")
    assert detalle.get_json()["data"]["puede_completar"] is True

    completada = admin_client.post(f"/api/v1/ventas/{venta['id']}/completar")
    assert completada.status_code == 200
    assert completada.get_json()["data"]["estado"] == "completada"

    cancelada = admin_client.post(f"/api/v1/ventas/{venta['id']}/cancelar")
    assert cancelada.status_code == 200
    assert cancelada.get_json()["data"]["estado"] == "cancelada"

    vehiculo_actualizado = admin_client.get(f"/api/v1/vehiculos/{vehiculo['id']}")
    assert vehiculo_actualizado.get_json()["data"]["estado"] == "disponible"


def test_vendedor_cannot_manage_other_sellers_sale(
    admin_client, vendedor_client, vehiculo, cliente, tasa
):
    venta = admin_client.post(
        "/api/v1/ventas",
        json={
            "vehiculo_id": vehiculo["id"],
            "cliente_id": cliente["id"],
            "estado": "apartado",
        },
    ).get_json()["data"]

    response = vendedor_client.post(f"/api/v1/ventas/{venta['id']}/completar")
    assert response.status_code == 403


def test_prospect_flow_and_conversion(admin_client, vehiculo):
    created = admin_client.post(
        "/api/v1/prospectos",
        json={
            "nombre": "José Martínez",
            "telefono": "+58 416-555-0404",
            "email": "jose@example.com",
            "vehiculo_id": vehiculo["id"],
            "origen": "web",
        },
    )
    assert created.status_code == 201, created.get_json()
    prospecto = created.get_json()["data"]
    assert prospecto["estado"] == "nuevo"
    assert prospecto["vehiculo"]["titulo"] == "Toyota Corolla XEI"

    estado = admin_client.patch(
        f"/api/v1/prospectos/{prospecto['id']}/estado", json={"estado": "contactado"}
    )
    assert estado.status_code == 200
    assert estado.get_json()["data"]["estado"] == "contactado"

    conversion = admin_client.post(
        f"/api/v1/prospectos/{prospecto['id']}/convertir-cliente"
    )
    assert conversion.status_code == 201
    cliente_id = conversion.get_json()["data"]["id"]

    detalle = admin_client.get(f"/api/v1/prospectos/{prospecto['id']}")
    assert detalle.get_json()["data"]["cliente_id"] == cliente_id
    assert detalle.get_json()["data"]["estado"] == "ganado"


def test_prospect_requires_contact(admin_client):
    response = admin_client.post("/api/v1/prospectos", json={"nombre": "Sin contacto"})
    assert response.status_code == 400


def test_dashboard_summary_admin(admin_client, vehiculo, cliente, tasa):
    admin_client.post(
        "/api/v1/ventas",
        json={"vehiculo_id": vehiculo["id"], "cliente_id": cliente["id"]},
    )
    response = admin_client.get("/api/v1/dashboard/resumen")
    assert response.status_code == 200
    data = response.get_json()["data"]
    assert data["vehiculos"]["por_estado"]["vendido"] == 1
    assert data["vehiculos"]["stock"] == 0
    assert data["vehiculos"]["total"] == 1
    assert data["ventas"]["cantidad"] == 1
    assert data["ventas"]["ingresos_ves_centavos"] == vehiculo["precio_ves_centavos"]
    assert data["top_modelos"][0]["modelo"] == "Corolla"
    assert "costo_inventario_ves_centavos" in data["vehiculos"]


def test_dashboard_month_range_covers_full_month():
    from app.services.dashboard import _rango

    desde, hasta = _rango(None, None)
    assert desde.day == 1
    assert hasta.day == 1
    assert (hasta - desde).days in (28, 29, 30, 31)

    desde, hasta = _rango(None, datetime(2026, 11, 24, 18, 45))
    assert desde.day == 1
    assert hasta == datetime(2026, 11, 25)


def test_dashboard_hides_costs_from_vendedor(vendedor_client):
    response = vendedor_client.get("/api/v1/dashboard/resumen")
    assert response.status_code == 200
    assert "costo_inventario_ves_centavos" not in response.get_json()["data"]["vehiculos"]


def test_pages_render_for_authenticated_admin(admin_client):
    for path in ("/", "/vehiculos", "/vehiculos/nuevo", "/clientes", "/ventas", "/ventas/nueva", "/prospectos", "/configuracion"):
        response = admin_client.get(path)
        assert response.status_code == 200, path


def test_configuracion_forbidden_for_vendedor(vendedor_client):
    assert vendedor_client.get("/configuracion").status_code == 403


def test_openapi_like_catalogs(admin_client):
    response = admin_client.get("/api/v1/catalogos")
    assert response.status_code == 200
    data = response.get_json()["data"]
    assert data["moneda_principal"] == "VES"
    assert data["moneda_referencia"] == "USD"
    assert any(item["value"] == "automatica" for item in data["transmisiones"])
    assert "max_imagenes_por_vehiculo" in data


def test_login_page_uses_business_name_and_hides_demo_credentials(client):
    html = client.get("/login").get_data(as_text=True)
    assert "Quinteros Motor&#39;s" in html
    assert "Admin123!" not in html
    assert "Vendedor123!" not in html
    assert "autosuite" not in html.lower()


def test_inactive_user_cannot_log_in(app, client):
    from app.extensions import db
    from app.models import Usuario

    with app.app_context():
        usuario = db.session.get(Usuario, app.config["ADMIN_ID"])
        usuario.activo = False
        db.session.commit()

    response = client.post(
        "/api/v1/auth/login",
        json={"email": "admin@test.local", "password": "Admin123!"},
    )
    assert response.status_code == 401


def test_production_rejects_insecure_secret_key():
    from app import create_app

    with pytest.raises(RuntimeError, match="SECRET_KEY"):
        create_app(
            "production",
            overrides={"SECRET_KEY": "cambia-esta-clave-en-produccion"},
        )


def test_dashboard_margin_ignores_vehicles_without_cost(admin_client, vehiculo):
    response = admin_client.put(
        f"/api/v1/vehiculos/{vehiculo['id']}",
        json={"costo_ves_centavos": None},
    )
    assert response.status_code == 200

    data = admin_client.get("/api/v1/dashboard/resumen").get_json()["data"]["vehiculos"]
    assert data["sin_costo"] == 1
    assert data["margen_inventario_ves_centavos"] == 0
    assert data["costo_inventario_ves_centavos"] == 0


def test_usuarios_page_is_admin_only(client, vendedor_client, admin_client):
    assert client.get("/usuarios").status_code in (302, 401)
    assert vendedor_client.get("/usuarios").status_code == 403
    response = admin_client.get("/usuarios")
    assert response.status_code == 200
    html = response.get_data(as_text=True)
    assert "Nuevo usuario" in html
    assert "create-user" not in html
    assert "create-admin" not in html


def test_usuarios_api_crud_and_roles(admin_client, vendedor_client):
    response = admin_client.get("/api/v1/usuarios")
    assert response.status_code == 200
    assert len(response.get_json()["data"]) >= 2

    created = admin_client.post(
        "/api/v1/usuarios",
        json={
            "nombre": "Nuevo Vendedor",
            "email": "nuevo@test.local",
            "rol": "vendedor",
            "password": "ClaveSegura123!",
        },
    )
    assert created.status_code == 201
    usuario = created.get_json()["data"]
    assert usuario["rol"] == "vendedor"
    assert usuario["activo"] is True
    assert "password" not in usuario

    duplicado = admin_client.post(
        "/api/v1/usuarios",
        json={
            "nombre": "Otro",
            "email": "NUEVO@test.local",
            "rol": "vendedor",
            "password": "ClaveSegura123!",
        },
    )
    assert duplicado.status_code == 409
    assert duplicado.get_json()["error"]["code"] == "EMAIL_DUPLICADO"

    actualizado = admin_client.put(
        f"/api/v1/usuarios/{usuario['id']}",
        json={"rol": "admin", "activo": False},
    )
    assert actualizado.status_code == 200
    assert actualizado.get_json()["data"]["rol"] == "admin"
    assert actualizado.get_json()["data"]["activo"] is False

    filtrado = admin_client.get("/api/v1/usuarios?rol=admin&activo=false")
    assert filtrado.status_code == 200
    assert any(item["id"] == usuario["id"] for item in filtrado.get_json()["data"])

    eliminado = admin_client.delete(f"/api/v1/usuarios/{usuario['id']}")
    assert eliminado.status_code == 200
    assert admin_client.get(f"/api/v1/usuarios/{usuario['id']}").status_code == 404


def test_usuarios_api_requires_admin(vendedor_client):
    assert vendedor_client.get("/api/v1/usuarios").status_code == 403
    assert vendedor_client.post(
        "/api/v1/usuarios",
        json={"nombre": "X", "email": "x@test.local", "password": "Clave123!"},
    ).status_code == 403

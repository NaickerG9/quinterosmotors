import pytest

from app import create_app
from app.extensions import db
from app.models import Usuario


@pytest.fixture()
def app(tmp_path):
    upload_folder = tmp_path / "uploads"
    app = create_app(
        "testing",
        overrides={
            "UPLOAD_FOLDER": str(upload_folder),
            "SECRET_KEY": "test-secret",
            "SERVER_NAME": None,
        },
    )
    with app.app_context():
        db.create_all()
        admin = Usuario(nombre="Admin Pruebas", email="admin@test.local", rol="admin")
        admin.set_password("Admin123!")
        vendedor = Usuario(
            nombre="Vendedor Pruebas", email="vendedor@test.local", rol="vendedor"
        )
        vendedor.set_password("Vendedor123!")
        db.session.add_all([admin, vendedor])
        db.session.commit()
        app.config["ADMIN_ID"] = admin.id
        app.config["VENDEDOR_ID"] = vendedor.id

    yield app

    with app.app_context():
        db.session.remove()
        db.drop_all()


@pytest.fixture()
def client(app):
    return app.test_client()


@pytest.fixture()
def admin_client(app):
    client = app.test_client()
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "admin@test.local", "password": "Admin123!"},
    )
    assert response.status_code == 200
    return client


@pytest.fixture()
def vendedor_client(app):
    client = app.test_client()
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "vendedor@test.local", "password": "Vendedor123!"},
    )
    assert response.status_code == 200
    return client


@pytest.fixture()
def tasa(admin_client):
    response = admin_client.put("/api/v1/tasa", json={"ves_por_usd": "36,50"})
    assert response.status_code == 201
    return response.get_json()["data"]


@pytest.fixture()
def vehiculo(admin_client, tasa):
    response = admin_client.post(
        "/api/v1/vehiculos",
        json={
            "marca": "Toyota",
            "modelo": "Corolla",
            "version": "XEI",
            "anio": 2022,
            "kilometraje": 10000,
            "precio_ves_centavos": 3_650_000_00,
            "costo_ves_centavos": 3_000_000_00,
            "transmision": "automatica",
            "combustible": "gasolina",
            "carroceria": "sedan",
            "vin": "8AJBA3CD0M0000001",
            "placa": "AA001AA",
        },
    )
    assert response.status_code == 201, response.get_json()
    return response.get_json()["data"]


@pytest.fixture()
def cliente(admin_client):
    response = admin_client.post(
        "/api/v1/clientes",
        json={
            "nombre": "María Pérez",
            "documento": "V-12345678",
            "telefono": "+58 412-555-0101",
            "email": "maria@example.com",
        },
    )
    assert response.status_code == 201, response.get_json()
    return response.get_json()["data"]

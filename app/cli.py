import shutil
from datetime import datetime
from pathlib import Path

import click
from flask import current_app

from .extensions import db
from .models import (
    Cliente,
    Prospecto,
    TasaCambio,
    Usuario,
    Vehiculo,
    VehiculoImagen,
    Venta,
)
from .services.tasas import crear_tasa, get_tasa_actual
from .services.ventas import crear_venta
from .utils.errors import ApiError
from .utils.validators import validate_email

DEMO_ADMIN = ("admin@quinteros.local", "Admin123!")
DEMO_VENDEDOR = ("vendedor@quinteros.local", "Vendedor123!")
DEMO_EMAILS_LEGACY = {
    "admin@autosuite.local": DEMO_ADMIN[0],
    "vendedor@autosuite.local": DEMO_VENDEDOR[0],
}
DEMO_IMAGENES = {
    ("Toyota", "Corolla"): "toyota-corolla.webp",
    ("Ford", "Explorer"): "ford-explorer.webp",
    ("Chevrolet", "Aveo"): "chevrolet-aveo.webp",
    ("Hyundai", "Tucson"): "hyundai-tucson.webp",
    ("Kia", "Rio"): "kia-rio.webp",
}


def _create_user(nombre, email, password, rol):
    if len(password) < 8:
        raise click.ClickException("La contraseña debe tener al menos 8 caracteres")
    try:
        email = validate_email(email)
    except ApiError as exc:
        raise click.ClickException(exc.message) from exc
    if Usuario.query.filter(db.func.lower(Usuario.email) == email.lower()).first():
        raise click.ClickException("Ya existe un usuario con ese correo")
    usuario = Usuario(nombre=nombre, email=email, rol=rol)
    usuario.set_password(password)
    db.session.add(usuario)
    db.session.commit()
    click.echo(f"Usuario creado: {email} ({rol})")
    return usuario


def _ensure_user(nombre, email, password, rol):
    usuario = Usuario.query.filter(db.func.lower(Usuario.email) == email.lower()).first()
    if usuario:
        return usuario
    usuario = Usuario(nombre=nombre, email=email, rol=rol)
    usuario.set_password(password)
    db.session.add(usuario)
    db.session.flush()
    return usuario


def _vehicle(**kwargs):
    vehicle = Vehiculo(**kwargs)
    db.session.add(vehicle)
    return vehicle


def _migrar_emails_demo():
    for anterior, nuevo in DEMO_EMAILS_LEGACY.items():
        anterior_usuario = Usuario.query.filter(
            db.func.lower(Usuario.email) == anterior.lower()
        ).first()
        if not anterior_usuario:
            continue
        ocupado = Usuario.query.filter(
            db.func.lower(Usuario.email) == nuevo.lower()
        ).first()
        if not ocupado:
            anterior_usuario.email = nuevo


def _seed_imagenes_demo():
    origen = Path(current_app.root_path) / "static" / "img" / "demo"
    destino = Path(current_app.config["UPLOAD_FOLDER"]) / "vehiculos" / "demo"
    destino.mkdir(parents=True, exist_ok=True)
    imagenes_nuevas = 0
    for vehiculo in Vehiculo.query.order_by(Vehiculo.id.asc()):
        archivo = DEMO_IMAGENES.get((vehiculo.marca, vehiculo.modelo))
        if not archivo:
            continue
        if VehiculoImagen.query.filter_by(vehiculo_id=vehiculo.id).first():
            continue
        fuente = origen / archivo
        if not fuente.is_file():
            continue
        ruta = f"vehiculos/demo/{archivo}"
        objetivo = destino / archivo
        if not objetivo.exists():
            shutil.copy2(fuente, objetivo)
        db.session.add(
            VehiculoImagen(
                vehiculo_id=vehiculo.id,
                ruta=ruta,
                orden=1,
                es_principal=True,
                bytes=objetivo.stat().st_size,
            )
        )
        imagenes_nuevas += 1
    if imagenes_nuevas:
        db.session.commit()
        click.echo(f"Imágenes demo vinculadas: {imagenes_nuevas}.")


def register_cli(app):
    @app.cli.command("init-db")
    def init_db():
        """Crea las tablas de la base de datos."""
        db.create_all()
        click.echo("Base de datos inicializada.")

    @app.cli.command("create-user")
    @click.option("--email", prompt="Correo")
    @click.option("--nombre", prompt="Nombre")
    @click.option(
        "--rol",
        type=click.Choice(["admin", "vendedor"]),
        default="vendedor",
        show_default=True,
    )
    @click.password_option("--password", prompt="Contraseña")
    def create_user(email, nombre, rol, password):
        """Crea un usuario con rol de administrador o vendedor."""
        _create_user(nombre, email, password, rol)

    @app.cli.command("create-admin")
    @click.option("--email", prompt="Correo")
    @click.option("--nombre", prompt="Nombre")
    @click.password_option("--password", prompt="Contraseña")
    def create_admin(email, nombre, password):
        """Crea un usuario administrador."""
        _create_user(nombre, email, password, "admin")

    @app.cli.command("seed-demo")
    def seed_demo():
        """Carga usuarios, tasa, clientes, vehículos y ventas de demostración."""
        db.create_all()
        _migrar_emails_demo()
        db.session.commit()
        admin_nuevo = (
            Usuario.query.filter(
                db.func.lower(Usuario.email) == DEMO_ADMIN[0].lower()
            ).first()
            is None
        )
        vendedor_nuevo = (
            Usuario.query.filter(
                db.func.lower(Usuario.email) == DEMO_VENDEDOR[0].lower()
            ).first()
            is None
        )
        admin = _ensure_user("Ana Administradora", *DEMO_ADMIN, "admin")
        vendedor = _ensure_user("Víctor Vendedor", *DEMO_VENDEDOR, "vendedor")
        db.session.commit()

        if not get_tasa_actual():
            crear_tasa("36,50", admin.id)
            click.echo("Tasa inicial: 36,50 VES/USD")

        if Cliente.query.count() == 0:
            clientes = [
                Cliente(
                    nombre="María Pérez",
                    documento="V-12345678",
                    email="maria.perez@example.com",
                    telefono="+58 412-555-0101",
                    direccion="Caracas",
                ),
                Cliente(
                    nombre="Carlos Rodríguez",
                    documento="V-87654321",
                    email="carlos.rodriguez@example.com",
                    telefono="+58 414-555-0202",
                    direccion="Valencia",
                ),
                Cliente(
                    nombre="Laura Gómez",
                    documento="V-11223344",
                    email="laura.gomez@example.com",
                    telefono="+58 424-555-0303",
                    direccion="Maracaibo",
                ),
            ]
            db.session.add_all(clientes)
            db.session.commit()
            click.echo("Clientes demo creados.")
        else:
            clientes = Cliente.query.filter_by(activo=True).order_by(
                Cliente.id.asc()
            ).limit(3).all()

        if Vehiculo.query.count() == 0:
            vehiculos = [
                _vehicle(
                    marca="Toyota",
                    modelo="Corolla",
                    version="XEI 2.0",
                    anio=2021,
                    color="Blanco",
                    kilometraje=45000,
                    transmision="automatica",
                    combustible="gasolina",
                    carroceria="sedan",
                    precio_ves_centavos=38_000_000,
                    costo_ves_centavos=33_000_000,
                    vin="8AJBA3CD0M0000001",
                    placa="AA001AA",
                    descripcion="Único dueño, mantenimiento al día y cauchos nuevos.",
                    destacado=True,
                ),
                _vehicle(
                    marca="Ford",
                    modelo="Explorer",
                    version="Limited 4WD",
                    anio=2022,
                    color="Gris",
                    kilometraje=32000,
                    transmision="automatica",
                    combustible="gasolina",
                    carroceria="suv",
                    precio_ves_centavos=85_000_000,
                    costo_ves_centavos=76_000_000,
                    vin="1FM5K8F80NGA00002",
                    placa="BB002BB",
                    descripcion="SUV familiar con techo panorámico y siete puestos.",
                    destacado=True,
                ),
                _vehicle(
                    marca="Chevrolet",
                    modelo="Aveo",
                    version="LT",
                    anio=2019,
                    color="Rojo",
                    kilometraje=78000,
                    transmision="manual",
                    combustible="gasolina",
                    carroceria="sedan",
                    precio_ves_centavos=24_000_000,
                    costo_ves_centavos=20_500_000,
                    vin="8Z1TJ6A00K0000003",
                    placa="CC003CC",
                    descripcion="Económico y ideal para ciudad.",
                ),
                _vehicle(
                    marca="Hyundai",
                    modelo="Tucson",
                    version="GLS",
                    anio=2023,
                    color="Azul",
                    kilometraje=18000,
                    transmision="automatica",
                    combustible="gasolina",
                    carroceria="suv",
                    precio_ves_centavos=98_000_000,
                    costo_ves_centavos=88_000_000,
                    vin="KM8J3CA46PU000004",
                    placa="DD004DD",
                    descripcion="Prácticamente nuevo, aún con garantía de fábrica.",
                ),
                _vehicle(
                    marca="Kia",
                    modelo="Rio",
                    version="EX",
                    anio=2020,
                    color="Plata",
                    kilometraje=55000,
                    transmision="automatica",
                    combustible="gasolina",
                    carroceria="sedan",
                    precio_ves_centavos=31_000_000,
                    costo_ves_centavos=27_000_000,
                    vin="3KPA24AD5LE000005",
                    placa="EE005EE",
                    descripcion="Bajo consumo y excelente estado general.",
                ),
            ]
            db.session.add_all(vehiculos)
            db.session.commit()
            click.echo("Vehículos demo creados.")
        else:
            vehiculos = Vehiculo.query.order_by(Vehiculo.id.asc()).all()

        clientes_activos = [cliente for cliente in clientes if cliente.activo]
        disponibles = [
            vehiculo
            for vehiculo in vehiculos
            if not vehiculo.archivado and vehiculo.estado == "disponible"
        ]
        if (
            Venta.query.count() == 0
            and len(disponibles) >= 2
            and len(clientes_activos) >= 2
        ):
            primera = crear_venta(
                {
                    "vehiculo_id": disponibles[0].id,
                    "cliente_id": clientes_activos[0].id,
                    "estado": "completada",
                    "forma_pago": "contado",
                    "notas": "Venta de demostración",
                },
                admin,
            )
            segunda = crear_venta(
                {
                    "vehiculo_id": disponibles[1].id,
                    "cliente_id": clientes_activos[1].id,
                    "estado": "apartado",
                    "forma_pago": "financiado",
                    "notas": "Apartado de demostración",
                },
                vendedor,
            )
            click.echo(f"Ventas demo: #{primera.id} completada, #{segunda.id} apartada.")
        elif Venta.query.count() == 0:
            click.echo("Se omitieron las ventas demo: se necesitan 2 clientes activos y 2 vehículos disponibles.")

        _seed_imagenes_demo()

        if Prospecto.query.count() == 0:
            disponibles = (
                Vehiculo.query.filter_by(estado="disponible", archivado=False)
                .order_by(Vehiculo.id.asc())
                .limit(3)
                .all()
            )
            prospectos = [
                Prospecto(
                    nombre="José Martínez",
                    telefono="+58 416-555-0404",
                    email="jose.martinez@example.com",
                    vehiculo_id=disponibles[0].id if disponibles else None,
                    vendedor_id=vendedor.id,
                    origen="web",
                    estado="nuevo",
                    mensaje="Estoy interesado en financiamiento.",
                ),
                Prospecto(
                    nombre="Daniela Torres",
                    telefono="+58 426-555-0505",
                    vehiculo_id=disponibles[1].id if len(disponibles) > 1 else None,
                    vendedor_id=vendedor.id,
                    origen="redes",
                    estado="contactado",
                    mensaje="Quiere agendar una prueba de manejo.",
                ),
                Prospecto(
                    nombre="Pedro Salas",
                    telefono="+58 412-555-0606",
                    vendedor_id=admin.id,
                    origen="referido",
                    estado="negociacion",
                    mensaje="Ofrece un carro como parte de pago.",
                ),
            ]
            db.session.add_all(prospectos)
            db.session.commit()
            click.echo("Prospectos demo creados.")

        if admin_nuevo or vendedor_nuevo:
            click.echo("")
            click.echo("Credenciales demo creadas (solo en esta terminal):")
            if admin_nuevo:
                click.echo(f"  Admin:    {DEMO_ADMIN[0]} / {DEMO_ADMIN[1]}")
            if vendedor_nuevo:
                click.echo(f"  Vendedor: {DEMO_VENDEDOR[0]} / {DEMO_VENDEDOR[1]}")
        else:
            click.echo("Los usuarios demo ya existen; no se muestran credenciales.")

    @app.cli.command("cleanup-media")
    @click.option("--delete", is_flag=True, help="Elimina los archivos huérfanos.")
    def cleanup_media(delete):
        """Detecta imágenes huérfanas o rutas rotas."""
        from flask import current_app

        root = Path(current_app.config["UPLOAD_FOLDER"]).resolve()
        rutas_db = {imagen.ruta for imagen in _all_images()}
        archivos = {
            path.relative_to(root).as_posix()
            for path in root.rglob("*")
            if path.is_file()
        }
        huerfanos = sorted(archivos - rutas_db)
        rotas = sorted(rutas_db - archivos)
        click.echo(f"Archivos huérfanos: {len(huerfanos)}")
        for ruta in huerfanos[:50]:
            click.echo(f"  {ruta}")
        click.echo(f"Rutas de DB sin archivo: {len(rotas)}")
        for ruta in rotas[:50]:
            click.echo(f"  {ruta}")
        if delete:
            for ruta in huerfanos:
                (root / ruta).unlink(missing_ok=True)
            click.echo(f"Eliminados {len(huerfanos)} archivos huérfanos.")

    @app.cli.command("backup")
    def backup():
        """Copia la base de datos y las imágenes a backups/."""
        from flask import current_app

        db_path = db.engine.url.database
        if not db_path or db_path == ":memory:":
            raise click.ClickException("No hay una base de datos SQLite en disco")
        db_path = Path(db_path).resolve()
        stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        destination = Path(current_app.root_path).parent / "backups" / stamp
        destination.mkdir(parents=True, exist_ok=True)
        shutil.copy2(db_path, destination / db_path.name)
        upload = Path(current_app.config["UPLOAD_FOLDER"]).resolve()
        if upload.exists():
            shutil.copytree(upload, destination / "uploads", dirs_exist_ok=True)
        click.echo(f"Backup creado en {destination}")


def _all_images():
    from .models import VehiculoImagen

    return VehiculoImagen.query.all()

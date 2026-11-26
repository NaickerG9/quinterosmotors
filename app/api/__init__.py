from .auth import bp as auth_bp
from .catalogos import bp as catalogos_bp
from .clientes import bp as clientes_bp
from .dashboard import bp as dashboard_bp
from .health import bp as health_bp
from .media import bp as media_bp
from .prospectos import bp as prospectos_bp
from .tasas import bp as tasas_bp
from .usuarios import bp as usuarios_bp
from .vehiculos import bp as vehiculos_bp
from .ventas import bp as ventas_bp

BLUEPRINTS = (
    health_bp,
    auth_bp,
    vehiculos_bp,
    clientes_bp,
    ventas_bp,
    prospectos_bp,
    tasas_bp,
    catalogos_bp,
    dashboard_bp,
    media_bp,
    usuarios_bp,
)


def register_api(app):
    for blueprint in BLUEPRINTS:
        app.register_blueprint(blueprint)

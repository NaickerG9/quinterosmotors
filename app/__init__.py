import os
import sqlite3
from pathlib import Path

from dotenv import load_dotenv
from flask import Flask, jsonify, redirect, request, url_for
from sqlalchemy import event
from sqlalchemy.engine import Engine

from .config import CONFIGS, INSECURE_SECRET_KEYS
from .extensions import csrf, db, login_manager

load_dotenv()


@event.listens_for(Engine, "connect")
def _set_sqlite_pragma(dbapi_connection, connection_record):
    if not isinstance(dbapi_connection, sqlite3.Connection):
        return
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.execute("PRAGMA busy_timeout=5000")
    try:
        cursor.execute("PRAGMA journal_mode=WAL")
    except sqlite3.OperationalError:
        pass
    cursor.close()


def create_app(config_name=None, overrides=None):
    app = Flask(__name__, instance_relative_config=True)
    config_name = config_name or os.getenv("FLASK_CONFIG", "development")
    if config_name not in CONFIGS:
        config_name = "development"
    app.config.from_object(CONFIGS[config_name])
    if overrides:
        app.config.update(overrides)

    if config_name == "production":
        secret_key = str(app.config["SECRET_KEY"])
        if secret_key in INSECURE_SECRET_KEYS or len(secret_key) < 32:
            raise RuntimeError(
                "Define un SECRET_KEY seguro y de al menos 32 caracteres antes de ejecutar en producción"
            )

    app.json.ensure_ascii = False
    os.makedirs(app.instance_path, exist_ok=True)
    upload_folder = app.config["UPLOAD_FOLDER"]
    if not os.path.isabs(upload_folder):
        upload_folder = str(Path(app.root_path).parent / upload_folder)
    app.config["UPLOAD_FOLDER"] = upload_folder
    os.makedirs(upload_folder, exist_ok=True)

    db.init_app(app)
    login_manager.init_app(app)
    csrf.init_app(app)

    from . import models  # noqa: F401  (registra las tablas)

    from .api import register_api
    from .cli import register_cli
    from .errors import register_error_handlers
    from .pages import bp as pages_bp

    register_api(app)
    app.register_blueprint(pages_bp)
    register_cli(app)
    register_error_handlers(app)

    login_manager.login_view = "pages.login"
    login_manager.login_message = None
    login_manager.session_protection = "strong"

    @login_manager.user_loader
    def load_user(user_id):
        from .models import Usuario

        return db.session.get(Usuario, int(user_id))

    @login_manager.unauthorized_handler
    def unauthorized():
        if request.path.startswith("/api/") or request.path.startswith("/media/"):
            return (
                jsonify(
                    {
                        "error": {
                            "code": "NO_AUTENTICADO",
                            "message": "Debes iniciar sesión",
                            "fields": {},
                        }
                    }
                ),
                401,
            )
        return redirect(url_for("pages.login", next=request.path))

    @app.context_processor
    def inject_globals():
        return {"app_name": app.config["APP_NAME"]}

    @app.after_request
    def security_headers(response):
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        response.headers.setdefault(
            "Permissions-Policy", "camera=(), microphone=(), geolocation=()"
        )
        response.headers.setdefault(
            "Content-Security-Policy",
            "default-src 'self'; img-src 'self' data: blob:; "
            "style-src 'self' 'unsafe-inline'; script-src 'self'; "
            "font-src 'self' data:; connect-src 'self'; form-action 'self'; "
            "frame-ancestors 'none'; base-uri 'self'",
        )
        if not app.debug and app.config.get("SESSION_COOKIE_SECURE"):
            response.headers.setdefault(
                "Strict-Transport-Security", "max-age=31536000; includeSubDomains"
            )
        return response

    @app.get("/health")
    def health_root():
        return jsonify({"status": "ok"})

    return app

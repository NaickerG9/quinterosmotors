import os
from datetime import timedelta
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DEFAULT_UPLOAD_FOLDER = str(BASE_DIR / "instance" / "uploads")


class BaseConfig:
    APP_NAME = "Quinteros Motor's"
    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-change-me")
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        "DATABASE_URL", "sqlite:///concesionario.db"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    MAX_CONTENT_LENGTH = int(os.environ.get("MAX_CONTENT_LENGTH_MB", "8")) * 1024 * 1024
    UPLOAD_FOLDER = os.environ.get("UPLOAD_FOLDER", DEFAULT_UPLOAD_FOLDER)
    MAX_IMAGE_BYTES = 5 * 1024 * 1024
    MAX_IMAGENES_POR_VEHICULO = 6

    TASA_MAX_AGE_HORAS = int(os.environ.get("TASA_MAX_AGE_HORAS", "24"))

    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = "Lax"
    SESSION_COOKIE_SECURE = False
    PERMANENT_SESSION_LIFETIME = timedelta(hours=8)
    WTF_CSRF_TIME_LIMIT = None

    LOGIN_RATE_LIMIT_ENABLED = True
    LOGIN_MAX_ATTEMPTS = 5
    LOGIN_WINDOW_SECONDS = 900
    LOGIN_MAX_TRACKED_KEYS = 5000

    JSON_AS_ASCII = False


class DevelopmentConfig(BaseConfig):
    DEBUG = True


class TestingConfig(BaseConfig):
    TESTING = True
    DEBUG = False
    WTF_CSRF_ENABLED = False
    LOGIN_RATE_LIMIT_ENABLED = False
    SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"
    SECRET_KEY = "test-secret"


class ProductionConfig(BaseConfig):
    DEBUG = False
    SESSION_COOKIE_SECURE = True


INSECURE_SECRET_KEYS = frozenset(
    {
        "dev-secret-change-me",
        "cambia-esta-clave-en-produccion",
        "change-me",
        "secret",
    }
)


CONFIGS = {
    "development": DevelopmentConfig,
    "testing": TestingConfig,
    "production": ProductionConfig,
}

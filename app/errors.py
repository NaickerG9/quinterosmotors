import logging

from flask import current_app, jsonify, render_template, request
from flask_wtf.csrf import CSRFError
from sqlalchemy.exc import IntegrityError
from werkzeug.exceptions import HTTPException

from .extensions import db
from .utils.errors import ApiError

logger = logging.getLogger(__name__)


def _wants_json():
    return request.path.startswith("/api/") or request.path.startswith("/media/")


def _error_response(message, status, code):
    if _wants_json():
        return (
            jsonify(
                {
                    "error": {
                        "code": code,
                        "message": message,
                        "fields": {},
                    }
                }
            ),
            status,
        )
    return render_template("error.html", code=status, message=message), status


def register_error_handlers(app):
    @app.errorhandler(ApiError)
    def handle_api_error(exc):
        if _wants_json():
            return (
                jsonify(
                    {
                        "error": {
                            "code": exc.code,
                            "message": exc.message,
                            "fields": exc.fields,
                        }
                    }
                ),
                exc.status,
            )
        return (
            render_template("error.html", code=exc.status, message=exc.message),
            exc.status,
        )

    @app.errorhandler(CSRFError)
    def handle_csrf_error(exc):
        return _error_response(
            "El token de seguridad expiró o es inválido. Recarga la página.",
            400,
            "CSRF_INVALIDO",
        )

    @app.errorhandler(IntegrityError)
    def handle_integrity_error(exc):
        db.session.rollback()
        logger.warning("IntegrityError: %s", exc)
        return _error_response(
            "El registro entra en conflicto con datos existentes",
            409,
            "CONFLICTO",
        )

    @app.errorhandler(HTTPException)
    def handle_http_error(exc):
        messages = {
            400: "Solicitud inválida",
            401: "Sesión requerida",
            403: "No tienes permiso para esta acción",
            404: "No encontramos lo que buscas",
            405: "Método no permitido",
            413: "El archivo es demasiado grande",
        }
        return _error_response(
            messages.get(exc.code, exc.description or "Error"),
            exc.code or 500,
            f"HTTP_{exc.code}",
        )

    @app.errorhandler(Exception)
    def handle_unexpected_error(exc):
        if current_app.config.get("TESTING"):
            raise exc
        logger.exception("Error no controlado: %s", exc)
        db.session.rollback()
        return _error_response(
            "Ocurrió un error inesperado. Intenta de nuevo.",
            500,
            "ERROR_INTERNO",
        )

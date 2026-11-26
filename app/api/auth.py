from flask import Blueprint, request, session
from flask_login import current_user, login_required, login_user, logout_user

from ..extensions import db
from ..models import Usuario
from ..utils.errors import ApiError
from ..utils.rate_limit import (
    check_rate_limit,
    clear_failures,
    register_failure,
)
from ..utils.responses import error, ok
from ..utils.validators import json_body, required

bp = Blueprint("api_auth", __name__, url_prefix="/api/v1/auth")


@bp.post("/login")
def login():
    data = json_body()
    email = str(required(data, "email", "Correo")).strip().lower()
    password = required(data, "password", "Contraseña")
    key = f"{request.remote_addr}:{email}"

    retry_after = check_rate_limit(key)
    if retry_after:
        response, status = error(
            "Demasiados intentos. Intenta de nuevo más tarde.",
            429,
            "DEMASIADOS_INTENTOS",
        )
        response.headers["Retry-After"] = str(retry_after)
        return response, status

    usuario = Usuario.query.filter(db.func.lower(Usuario.email) == email).first()
    if not usuario or not usuario.activo or not usuario.check_password(password):
        register_failure(key)
        raise ApiError(
            "Correo o contraseña incorrectos",
            status=401,
            code="CREDENCIALES_INVALIDAS",
        )

    clear_failures(key)
    login_user(usuario, remember=False)
    session.permanent = True
    return ok(usuario.to_dict())


@bp.post("/logout")
@login_required
def logout():
    logout_user()
    return ok({"message": "Sesión cerrada"})


@bp.get("/me")
@login_required
def me():
    return ok(current_user.to_dict())

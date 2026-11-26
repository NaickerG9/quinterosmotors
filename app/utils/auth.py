from functools import wraps

from flask import abort, redirect, request, url_for
from flask_login import current_user

from .responses import error


def role_required(*roles):
    def decorator(view):
        @wraps(view)
        def wrapped(*args, **kwargs):
            if not current_user.is_authenticated:
                if request.path.startswith("/api/"):
                    return error("Sesión requerida", 401, "NO_AUTENTICADO")
                return redirect(url_for("pages.login", next=request.path))
            if current_user.rol not in roles:
                if request.path.startswith("/api/"):
                    return error(
                        "No tienes permiso para esta acción",
                        403,
                        "PROHIBIDO",
                    )
                abort(403)
            return view(*args, **kwargs)

        return wrapped

    return decorator

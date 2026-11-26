from flask import Blueprint

from ..utils.responses import ok

bp = Blueprint("api_health", __name__, url_prefix="/api/v1")


@bp.get("/health")
def health():
    return ok({"status": "ok", "version": "1.0.0"})

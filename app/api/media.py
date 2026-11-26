from flask import Blueprint, current_app, send_from_directory
from flask_login import login_required

bp = Blueprint("media", __name__, url_prefix="/media")


@bp.get("/vehiculos/<path:filename>")
@login_required
def media_file(filename):
    response = send_from_directory(
        current_app.config["UPLOAD_FOLDER"], filename, conditional=True
    )
    response.cache_control.private = True
    response.cache_control.max_age = 3600
    return response

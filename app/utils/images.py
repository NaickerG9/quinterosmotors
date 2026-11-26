import os

from flask import current_app

from .errors import ValidationError


def _size_and_header(file_storage):
    stream = file_storage.stream
    try:
        stream.seek(0, os.SEEK_END)
        size = stream.tell()
        stream.seek(0)
        header = stream.read(16)
        stream.seek(0)
    except (OSError, AttributeError) as exc:
        raise ValidationError("No se pudo leer la imagen") from exc
    return size, header


def detect_extension(header):
    if header.startswith(b"\xff\xd8\xff"):
        return "jpg"
    if header.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if len(header) >= 12 and header[:4] == b"RIFF" and header[8:12] == b"WEBP":
        return "webp"
    return None


def validate_image(file_storage):
    if not file_storage or not file_storage.filename:
        raise ValidationError("Selecciona una imagen", code="IMAGEN_REQUERIDA")
    size, header = _size_and_header(file_storage)
    if size <= 0:
        raise ValidationError("La imagen está vacía", code="IMAGEN_VACIA")
    limit = current_app.config["MAX_IMAGE_BYTES"]
    if size > limit:
        raise ValidationError(
            f"La imagen supera el límite de {limit // (1024 * 1024)} MB",
            code="IMAGEN_MUY_GRANDE",
        )
    extension = detect_extension(header)
    if not extension:
        raise ValidationError(
            "Formato no permitido. Usa JPG, PNG o WebP", code="IMAGEN_INVALIDA"
        )
    return extension, size

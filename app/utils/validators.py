import re
from datetime import datetime, timezone

from flask import request

from .errors import ValidationError
from .money import MoneyError, parse_money_to_centavos, parse_rate_to_micros

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def json_body():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        raise ValidationError(
            "El cuerpo de la solicitud debe ser un objeto JSON",
            code="JSON_INVALIDO",
        )
    return data


def required(data, field, label=None):
    value = data.get(field)
    if value is None or (isinstance(value, str) and not value.strip()):
        raise ValidationError(
            f"{label or field} es obligatorio",
            fields={field: "Este campo es obligatorio"},
        )
    return value.strip() if isinstance(value, str) else value


def optional_str(data, field, max_length=None):
    value = data.get(field)
    if value is None:
        return None
    value = str(value).strip()
    if not value:
        return None
    if max_length and len(value) > max_length:
        raise ValidationError(
            f"{field} no puede superar {max_length} caracteres",
            fields={field: f"Máximo {max_length} caracteres"},
        )
    return value


def parse_int_field(data, field, label=None, default=None, minimum=None):
    if field not in data or data.get(field) in (None, ""):
        if default is not None:
            return default
        raise ValidationError(
            f"{label or field} es obligatorio",
            fields={field: "Este campo es obligatorio"},
        )
    try:
        value = int(data.get(field))
    except (TypeError, ValueError) as exc:
        raise ValidationError(
            f"{label or field} debe ser un número entero",
            fields={field: "Número entero inválido"},
        ) from exc
    if minimum is not None and value < minimum:
        raise ValidationError(
            f"{label or field} debe ser mayor o igual a {minimum}",
            fields={field: f"Valor mínimo: {minimum}"},
        )
    return value


def parse_money_field(data, field, label=None, required_field=True, default=None):
    value = data.get(field)
    if value in (None, "") and default is not None:
        return default
    if value in (None, ""):
        if required_field:
            raise ValidationError(
                f"{label or field} es obligatorio",
                fields={field: "Este campo es obligatorio"},
            )
        return None
    try:
        return parse_money_to_centavos(value)
    except MoneyError as exc:
        raise ValidationError(
            str(exc), fields={field: "Monto inválido"}
        ) from exc


def parse_datetime_field(data, field, label=None):
    """Acepta ISO 8601 (incluido datetime-local) y devuelve naive UTC."""
    value = data.get(field)
    if value in (None, ""):
        return None
    if isinstance(value, datetime):
        parsed = value
    else:
        try:
            parsed = datetime.fromisoformat(str(value).strip().replace("Z", "+00:00"))
        except ValueError as exc:
            raise ValidationError(
                f"{label or field} inválida",
                fields={field: "Formato esperado: YYYY-MM-DDTHH:MM"},
            ) from exc
    if parsed.tzinfo is not None:
        parsed = parsed.astimezone(timezone.utc).replace(tzinfo=None)
    return parsed


def parse_rate_field(data, field="ves_por_usd"):
    value = data.get(field)
    if value in (None, ""):
        raise ValidationError(
            "La tasa es obligatoria", fields={field: "Este campo es obligatorio"}
        )
    try:
        return parse_rate_to_micros(value)
    except MoneyError as exc:
        raise ValidationError(str(exc), fields={field: "Tasa inválida"}) from exc


def parse_bool(value, default=False):
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return bool(value)
    return str(value).strip().lower() in ("1", "true", "si", "sí", "on", "yes")


def validate_choice(data, field, choices, label=None, default=None, required_field=True):
    value = data.get(field, default)
    if value in (None, ""):
        if required_field:
            raise ValidationError(
                f"{label or field} es obligatorio",
                fields={field: "Este campo es obligatorio"},
            )
        return None
    value = str(value).strip()
    if value not in choices:
        raise ValidationError(
            f"{label or field} inválido",
            fields={field: f"Opciones: {', '.join(sorted(choices))}"},
        )
    return value


def validate_email(value, field="email"):
    if not value:
        return None
    value = str(value).strip()
    if not EMAIL_RE.match(value):
        raise ValidationError(
            "Correo electrónico inválido", fields={field: "Correo inválido"}
        )
    return value


def validate_year(value, field="anio"):
    current_year = datetime.utcnow().year + 1
    if value < 1950 or value > current_year:
        raise ValidationError(
            f"El año debe estar entre 1950 y {current_year}",
            fields={field: f"Rango permitido: 1950–{current_year}"},
        )
    return value


def parse_date_arg(args, field):
    value = args.get(field)
    if not value:
        return None
    try:
        return datetime.strptime(value, "%Y-%m-%d")
    except ValueError as exc:
        raise ValidationError(
            f"Fecha inválida en {field}", fields={field: "Formato esperado: YYYY-MM-DD"}
        ) from exc

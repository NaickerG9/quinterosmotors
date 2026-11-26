from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

RATE_SCALE = Decimal("1000000")
CENT_SCALE = Decimal("100")


class MoneyError(ValueError):
    pass


def _clean_number(value):
    if value is None:
        raise MoneyError("El monto es obligatorio")
    text = str(value).strip()
    for token in ("Bs.", "Bs", "VES", "USD", "$", "\u00a0", " "):
        text = text.replace(token, "")
    text = text.strip()
    if not text:
        raise MoneyError("El monto es obligatorio")
    return text


def parse_decimal(value):
    """Acepta 1234.56, 1.234,56, 1,234.56 y 36,50."""
    text = _clean_number(value)
    negative = text.startswith("-")
    text = text.lstrip("+-")

    if "," in text and "." in text:
        if text.rfind(",") > text.rfind("."):
            text = text.replace(".", "").replace(",", ".")
        else:
            text = text.replace(",", "")
    elif "," in text:
        text = text.replace(".", "").replace(",", ".")
    elif text.count(".") > 1:
        text = text.replace(".", "")
    elif "." in text:
        integer, decimals = text.split(".", 1)
        if len(decimals) == 3 and integer and integer.isdigit():
            # "1.234" se interpreta como miles en formato venezolano.
            text = integer + decimals
        else:
            text = integer + "." + decimals

    try:
        number = Decimal(text)
    except (InvalidOperation, ValueError) as exc:
        raise MoneyError("Monto inválido") from exc
    return -number if negative else number


def parse_money_to_centavos(value):
    if isinstance(value, int) and not isinstance(value, bool):
        if value < 0:
            raise MoneyError("El monto no puede ser negativo")
        return value
    amount = parse_decimal(value)
    if amount < 0:
        raise MoneyError("El monto no puede ser negativo")
    return int((amount * CENT_SCALE).quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def parse_rate_to_micros(value):
    rate = parse_decimal(value)
    if rate <= 0:
        raise MoneyError("La tasa debe ser mayor que cero")
    if rate > Decimal("1000000000"):
        raise MoneyError("La tasa está fuera de rango")
    return int((rate * RATE_SCALE).quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def rate_from_micros(micros):
    if not micros:
        return None
    return Decimal(int(micros)) / RATE_SCALE


def usd_centavos_from_ves(ves_centavos, tasa_micros):
    if not tasa_micros:
        return None
    ves = Decimal(int(ves_centavos)) / CENT_SCALE
    rate = rate_from_micros(tasa_micros)
    if not rate:
        return None
    usd = ves / rate
    return int((usd * CENT_SCALE).quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def ves_centavos_from_usd(usd_centavos, tasa_micros):
    if not tasa_micros:
        return None
    usd = Decimal(int(usd_centavos)) / CENT_SCALE
    rate = rate_from_micros(tasa_micros)
    return int((usd * rate * CENT_SCALE).quantize(Decimal("1"), rounding=ROUND_HALF_UP))

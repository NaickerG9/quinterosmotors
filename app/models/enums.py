ROLES = {
    "admin": "Administrador",
    "vendedor": "Vendedor",
}

ESTADOS_VEHICULO = {
    "disponible": "Disponible",
    "reservado": "Reservado",
    "vendido": "Vendido",
}

TRANSMISIONES = {
    "automatica": "Automática",
    "manual": "Manual",
    "cvt": "CVT",
    "dct": "Doble embrague",
}

COMBUSTIBLES = {
    "gasolina": "Gasolina",
    "diesel": "Diésel",
    "hibrido": "Híbrido",
    "electrico": "Eléctrico",
    "gas": "Gas",
}

CARROCERIAS = {
    "sedan": "Sedán",
    "suv": "SUV",
    "camioneta": "Camioneta",
    "hatchback": "Hatchback",
    "coupe": "Coupé",
    "pickup": "Pick-up",
    "van": "Van",
    "otro": "Otro",
}

FORMAS_PAGO = {
    "contado": "Contado",
    "financiado": "Financiado",
}

ESTADOS_VENTA = {
    "apartado": "Apartado",
    "completada": "Completada",
    "cancelada": "Cancelada",
}

ESTADOS_PROSPECTO = {
    "nuevo": "Nuevo",
    "contactado": "Contactado",
    "negociacion": "En negociación",
    "ganado": "Ganado",
    "perdido": "Perdido",
}

ORIGENES_PROSPECTO = {
    "presencial": "Presencial",
    "telefono": "Teléfono",
    "web": "Web",
    "redes": "Redes sociales",
    "referido": "Referido",
    "otro": "Otro",
}

ESTADOS_VENTA_ACTIVA = ("apartado", "completada")


def choices(mapping):
    return [{"value": key, "label": label} for key, label in mapping.items()]

class ApiError(Exception):
    def __init__(self, message, status=400, code="ERROR", fields=None):
        super().__init__(message)
        self.message = message
        self.status = status
        self.code = code
        self.fields = fields or {}


class ValidationError(ApiError):
    def __init__(self, message="Datos inválidos", fields=None, code="VALIDACION"):
        super().__init__(message, status=400, code=code, fields=fields)


class NotFoundError(ApiError):
    def __init__(
        self, message="Recurso no encontrado", code="NO_ENCONTRADO", fields=None
    ):
        super().__init__(message, status=404, code=code, fields=fields)


class ConflictError(ApiError):
    def __init__(
        self, message="Conflicto con el estado actual", code="CONFLICTO", fields=None
    ):
        super().__init__(message, status=409, code=code, fields=fields)


class ForbiddenError(ApiError):
    def __init__(
        self, message="No tienes permiso para esta acción", code="PROHIBIDO", fields=None
    ):
        super().__init__(message, status=403, code=code, fields=fields)

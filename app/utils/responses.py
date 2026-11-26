from flask import jsonify


def ok(data=None, meta=None, status=200):
    payload = {"data": data}
    if meta is not None:
        payload["meta"] = meta
    return jsonify(payload), status


def created(data=None, meta=None):
    return ok(data=data, meta=meta, status=201)


def error(message, status=400, code="ERROR", fields=None):
    return (
        jsonify(
            {
                "error": {
                    "code": code,
                    "message": message,
                    "fields": fields or {},
                }
            }
        ),
        status,
    )


def pagination_meta(pagination):
    return {
        "page": pagination.page,
        "per_page": pagination.per_page,
        "total": pagination.total,
        "pages": pagination.pages,
        "has_prev": pagination.has_prev,
        "has_next": pagination.has_next,
    }


def parse_pagination(args, default_per_page=20, max_per_page=200):
    try:
        page = max(1, int(args.get("page", 1)))
    except (TypeError, ValueError):
        page = 1
    try:
        per_page = int(args.get("per_page", default_per_page))
    except (TypeError, ValueError):
        per_page = default_per_page
    per_page = max(1, min(per_page, max_per_page))
    return page, per_page

from datetime import datetime, timezone


def utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def start_of_month(moment=None):
    moment = moment or utcnow()
    return moment.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


def iso(value):
    return value.isoformat() if value else None

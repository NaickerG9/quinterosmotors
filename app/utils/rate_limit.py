import threading
import time
from collections import defaultdict
from functools import wraps

from flask import current_app

_attempts = defaultdict(list)
_lock = threading.Lock()


def _prune(key, window):
    now = time.time()
    _attempts[key] = [ts for ts in _attempts[key] if now - ts < window]


def _prune_all(window):
    now = time.time()
    for key in list(_attempts):
        _attempts[key] = [ts for ts in _attempts[key] if now - ts < window]
        if not _attempts[key]:
            _attempts.pop(key, None)


def check_rate_limit(key):
    if not current_app.config.get("LOGIN_RATE_LIMIT_ENABLED", True):
        return None
    window = current_app.config["LOGIN_WINDOW_SECONDS"]
    maximum = current_app.config["LOGIN_MAX_ATTEMPTS"]
    with _lock:
        _prune(key, window)
        attempts = _attempts[key]
        if len(attempts) >= maximum:
            retry_after = int(window - (time.time() - attempts[0])) + 1
            return max(retry_after, 1)
    return None


def register_failure(key):
    if not current_app.config.get("LOGIN_RATE_LIMIT_ENABLED", True):
        return
    window = current_app.config["LOGIN_WINDOW_SECONDS"]
    with _lock:
        _prune(key, window)
        _attempts[key].append(time.time())
        _prune_all(window)
        limite = current_app.config.get("LOGIN_MAX_TRACKED_KEYS", 5000)
        if len(_attempts) > limite:
            mas_antiguas = sorted(
                _attempts, key=lambda item: _attempts[item][-1]
            )[: len(_attempts) - limite]
            for antigua in mas_antiguas:
                _attempts.pop(antigua, None)


def clear_failures(key):
    with _lock:
        _attempts.pop(key, None)

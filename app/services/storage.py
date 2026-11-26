from pathlib import Path
from uuid import uuid4

from flask import current_app

from ..utils.time import utcnow


class LocalStorage:
    def __init__(self, root):
        self.root = Path(root).resolve()
        self.root.mkdir(parents=True, exist_ok=True)

    def _resolve(self, relative_path):
        path = (self.root / relative_path).resolve()
        if path != self.root and self.root not in path.parents:
            raise ValueError("Ruta de archivo fuera del almacenamiento")
        return path

    def save(self, file_storage, extension):
        now = utcnow()
        relative = f"vehiculos/{now:%Y}/{now:%m}/{uuid4().hex}.{extension}"
        destination = self._resolve(relative)
        destination.parent.mkdir(parents=True, exist_ok=True)
        file_storage.save(destination)
        return relative, destination.stat().st_size

    def delete(self, relative_path):
        path = self._resolve(relative_path)
        if path.is_file():
            path.unlink()
            return True
        return False

    def exists(self, relative_path):
        return self._resolve(relative_path).is_file()

    def absolute(self, relative_path):
        return self._resolve(relative_path)


def get_storage():
    return LocalStorage(current_app.config["UPLOAD_FOLDER"])

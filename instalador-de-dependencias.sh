#!/usr/bin/env bash
# Instalador de dependencias para Linux — Quinteros Motor's
# Prepara el entorno, compila el CSS, inicializa la BD demo y ejecuta la interfaz.
set -euo pipefail

cd "$(dirname "$0")"

if [ -z "${PYTHON_BIN:-}" ]; then
  for candidate in python3.14 python3 python; do
    if command -v "$candidate" >/dev/null 2>&1; then
      PYTHON_BIN="$candidate"
      break
    fi
  done
fi
if ! command -v "${PYTHON_BIN:-}" >/dev/null 2>&1; then
  echo "ERROR: no se encontró Python 3.11 o superior en el PATH." >&2
  exit 1
fi

if ! "$PYTHON_BIN" -c 'import sys; raise SystemExit(0 if sys.version_info >= (3, 11) else 1)'; then
  echo "ERROR: se necesita Python 3.11 o superior (se recomienda 3.14)." >&2
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "ERROR: no se encontró npm. Instala Node.js antes de continuar." >&2
  exit 1
fi

if [ ! -f Proyecto/pyvenv.cfg ]; then
  echo "[1/7] Creando el entorno virtual en Proyecto/"
  "$PYTHON_BIN" -m venv Proyecto
else
  echo "[1/7] Reparando el entorno virtual para esta ruta/usuario."
fi

# Deja el venv portable entre rutas, usuarios y máquinas (shebangs relativos,
# activate dinámico, intérprete del sistema) sin borrar los paquetes instalados.
bash scripts/venv-fix.sh
VENV_PYTHON="$PWD/Proyecto/bin/python"

if [ ! -f .env ]; then
  cp .env.example .env
  secret="$("$PYTHON_BIN" -c 'import secrets; print(secrets.token_urlsafe(48))')"
  sed -i "s|^SECRET_KEY=.*|SECRET_KEY=$secret|" .env
  echo "[2/7] Creado .env con SECRET_KEY aleatorio."
else
  echo "[2/7] .env ya existe; se conserva."
fi

echo "[3/7] Instalando dependencias Python..."
"$VENV_PYTHON" -m pip install -r requirements.txt
"$VENV_PYTHON" -m pip install -r requirements-dev.txt
# pip acaba de crear bin/flask, bin/pytest... con shebangs absolutos; se
# vuelven a dejar portables.
bash scripts/venv-fix.sh --quiet

echo "[4/7] Instalando dependencias frontend..."
npm install

echo "[5/7] Compilando CSS..."
npm run css:build

echo "[6/7] Inicializando base de datos y datos demo..."
"$VENV_PYTHON" -m flask --app app init-db
"$VENV_PYTHON" -m flask --app app seed-demo

echo ""
echo "Listo. Interfaz: http://127.0.0.1:5000/login"
echo "Las cuentas demo, si se crearon, se indicaron en la salida de seed-demo."
echo "Presiona Ctrl+C para detener el servidor."
echo ""

echo "[7/7] Iniciando servidor..."
exec "$VENV_PYTHON" -m flask --app app run --host 127.0.0.1 --port 5000

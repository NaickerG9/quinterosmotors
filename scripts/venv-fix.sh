#!/usr/bin/env bash
# venv-fix — deja Proyecto/ (el venv del proyecto) utilizable desde cualquier
# ruta, nombre de usuario y máquina (Ubuntu / CachyOS) sin tocar rutas a mano.
#
# Un venv de Python guarda rutas absolutas en tres sitios:
#   1. los shebangs de bin/flask, bin/pip, bin/pytest, ...
#   2. VIRTUAL_ENV en bin/activate, bin/activate.fish, ...
#   3. home/executable en pyvenv.cfg y el symlink bin/python3
#
# Este script neutraliza (1) y (2) para siempre usando un lanzador relativo que
# resuelve su propia ubicación, y refresca (3) con el intérprete de la máquina
# actual. Resultado: si mueves el SSD a otra ruta o lo abres con otro usuario,
# el venv sigue funcionando; solo hay que volver a ejecutar esto si la máquina
# no tiene Python 3.14 en la misma ubicación.
#
# Uso:
#   bash scripts/venv-fix.sh            # repara y verifica
#   bash scripts/venv-fix.sh --quiet    # solo errores (lo usa el instalador)
#   bash scripts/venv-fix.sh --check    # solo comprueba, no modifica nada
set -euo pipefail

quiet=0
check_only=0
for arg in "$@"; do
  case "$arg" in
    -q|--quiet) quiet=1 ;;
    -c|--check) check_only=1 ;;
    -h|--help) sed -n '2,25p' "$0"; exit 0 ;;
    *) printf 'venv-fix: opción desconocida: %s\n' "$arg" >&2; exit 2 ;;
  esac
done

say()  { [ "$quiet" -eq 1 ] || printf '%s\n' "$*"; }
warn() { printf 'venv-fix: %s\n' "$*" >&2; }
die()  { warn "$*"; exit 1; }

root="$(cd -- "$(dirname -- "$(readlink -f -- "${BASH_SOURCE[0]}")")/.." && pwd -P)"
venv="$root/Proyecto"
bin="$venv/bin"

[ -d "$bin" ] || die "no existe $bin; crea el entorno primero con 'python3 -m venv Proyecto'"
[ -f "$venv/pyvenv.cfg" ] || die "falta $venv/pyvenv.cfg; el entorno está corrupto, recréalo"

# --- 1. Intérprete base de la misma versión menor ---------------------------
want="$(sed -n 's/^version *= *\([0-9][0-9]*\.[0-9][0-9]*\).*/\1/p' "$venv/pyvenv.cfg" 2>/dev/null | head -n1)"
[ -n "$want" ] || want="3.14"

pick_python() {
  local cand path
  # Rutas de sistema primero: son las mismas en Ubuntu y CachyOS, así el venv
  # no depende de directorios de usuario (~/.local, pyenv, etc.).
  for cand in "/usr/bin/python$want" "/usr/local/bin/python$want" "python$want" \
              "/usr/bin/python3" "/usr/local/bin/python3" "python3"; do
    path="$(command -v -- "$cand" 2>/dev/null || true)"
    [ -n "$path" ] || continue
    if "$path" -c "import sys; raise SystemExit(0 if '%d.%d' % sys.version_info[:2] == '$want' else 1)" \
         >/dev/null 2>&1; then
      printf '%s\n' "$path"
      return 0
    fi
  done
  return 1
}

base="$(pick_python || true)"
if [ -z "$base" ]; then
  warn "no se encontró Python $want en esta máquina."
  warn "instálalo y vuelve a ejecutar:  sudo pacman -S python   |   sudo apt install python$want"
  exit 1
fi
base="$(readlink -f -- "$base")"
home="$(dirname -- "$base")"
version="$("$base" -c 'import platform; print(platform.python_version())')"
say "Intérprete base: $base (Python $version)"

if [ "$check_only" -eq 1 ]; then
  say "Modo --check: no se modifica nada."
  exit 0
fi

# --- 2. pyvenv.cfg y symlinks del intérprete -------------------------------
# home/executable apuntan al Python del sistema, nunca a un home de usuario.
cat > "$venv/pyvenv.cfg" <<EOF
home = $home
include-system-site-packages = false
version = $version
executable = $base
command = $base -m venv $venv
EOF

ln -sfn "$base"  "$bin/python3"
ln -sfn python3  "$bin/python"
ln -sfn python3  "$bin/python$want"
# Python 3.14 incluye un alias con el nombre "𝜋thon"; si existe, se mantiene.
if [ -e "$bin/𝜋thon" ] || [ -L "$bin/𝜋thon" ]; then
  ln -sfn python3 "$bin/𝜋thon"
fi
say "Enlazado bin/python -> $base"

# --- 3. Lanzador relativo para los scripts de consola ----------------------
# Cabecera que es válida a la vez para sh y para Python: sh la ejecuta y
# relanza el script con el intérprete que está junto a él; Python la ve como
# una cadena y la ignora. Así el shebang deja de llevar rutas absolutas.
launcher() {
  cat <<'SH'
#!/bin/sh
''''true
self=$0
case $self in
  */*) ;;
  *) self=$(command -v -- "$self" 2>/dev/null) || self=$0 ;;
esac
d=$(CDPATH= cd -- "$(dirname -- "$self")" && pwd -P)
exec "$d/python" "$self" "$@"
# '''
SH
}

patched=0
for f in "$bin"/*; do
  [ -f "$f" ] && [ ! -L "$f" ] || continue
  [ "$(head -c 2 -- "$f" 2>/dev/null || true)" = "#!" ] || continue
  # Idempotente: la segunda línea del lanzador ya está puesta.
  if [ "$(sed -n '2p' -- "$f")" = "''''true" ]; then
    continue
  fi
  { launcher; tail -n +2 -- "$f"; } > "$f.tmp"
  chmod --reference="$f" "$f.tmp"
  cat -- "$f.tmp" > "$f"
  rm -f -- "$f.tmp"
  patched=$((patched + 1))
done
say "Scripts con lanzador relativo: $patched actualizado(s)"

# --- 4. activate / activate.fish sin rutas fijas ---------------------------
"$base" - "$venv" <<'PY'
import pathlib
import re
import sys

venv = pathlib.Path(sys.argv[1])
bindir = venv / "bin"


def patch(name, pattern, replacement, marker):
    path = bindir / name
    if not path.is_file():
        return
    text = path.read_text(encoding="utf-8")
    if marker in text:
        return
    new, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count:
        path.write_text(new, encoding="utf-8")
        print(f"  parcheado bin/{name}")


# bash / zsh: sustituye el bloque "case $(uname) ... esac" por una ruta
# calculada al hacer source, de modo que VIRTUAL_ENV nunca queda obsoleto.
patch(
    "activate",
    r'case "\$\(uname\)" in\n.*?\nesac\n',
    'VIRTUAL_ENV=$(CDPATH= cd -- "$(dirname -- "$(readlink -f -- "${BASH_SOURCE[0]:-$0}")")/.." && pwd -P)\n'
    "export VIRTUAL_ENV\n",
    'readlink -f -- "${BASH_SOURCE[0]:-$0}"',
)

# fish: resuelve el directorio del propio activate.fish en tiempo de carga.
patch(
    "activate.fish",
    r"set -gx VIRTUAL_ENV [^\n]*\n",
    "set -gx VIRTUAL_ENV (path resolve (dirname (status --current-filename))/..)\n",
    "status --current-filename",
)
PY

# --- 5. Verificación -------------------------------------------------------
fail=0
run() {
  local label="$1"; shift
  if "$@" >/dev/null 2>&1; then
    say "  ok  $label"
  else
    warn "  FALLO  $label"
    fail=1
  fi
}

say "Verificando:"
run "python ($version)" "$bin/python" -c 'import sys; assert sys.prefix.endswith("Proyecto")'
run "pip" "$bin/pip" --version
# flask/pytest solo existen después de instalar requirements.
if [ -x "$bin/flask" ]; then run "flask" "$bin/flask" --version; fi
if [ -x "$bin/pytest" ]; then run "pytest" "$bin/pytest" --version; fi

[ "$fail" -eq 0 ] || die "el entorno sigue roto; revisa los mensajes anteriores"
say "Listo: el entorno funciona desde cualquier ruta o usuario."

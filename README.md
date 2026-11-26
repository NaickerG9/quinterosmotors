# Quinteros Motor's · Sistema web para concesionarios

Aplicación web para gestionar inventario de vehículos, clientes, ventas/apartados, prospectos y la tasa de cambio VES/USD. Stack: **Flask + SQLAlchemy + SQLite** en el backend y **JavaScript nativo + Tailwind CSS** en el frontend, sin frameworks de UI ni bundlers de JS.

## Requisitos

- Python 3.11 o superior (recomendado 3.14; el entorno del proyecto vive en `Proyecto/`).
- Node.js y npm (solo para compilar Tailwind).

## Puesta en marcha

### Instalador (recomendado)

No hace falta escribir comandos. El instalador crea/repara `Proyecto/`, instala las dependencias Python y npm, compila el CSS, inicializa la base de datos con datos demo y abre la interfaz:

- **Linux:** `chmod +x instalador-de-dependencias.sh && ./instalador-de-dependencias.sh`
- **Windows:** doble clic en `instalador-de-dependencias.bat`

Al terminar abre <http://127.0.0.1:5000/login>. El instalador genera un `SECRET_KEY` aleatorio y siembra datos de prueba; las credenciales demo solo se imprimen en la terminal si el comando `seed-demo` crea esas cuentas. No se muestran en la interfaz. El instalador es idempotente: si vuelves a ejecutarlo conserva el `.env` existente y no duplica los datos demo.

### SSD externo y varias máquinas

El entorno `Proyecto/` es portable: no guarda rutas absolutas ni nombres de usuario, así que puedes abrir el mismo SSD en Ubuntu y en CachyOS desde rutas distintas sin recrearlo ni reinstalar paquetes.

- Los scripts de `Proyecto/bin/` usan un lanzador relativo que resuelve su propia ubicación, y `activate` calcula `VIRTUAL_ENV` al hacer `source`.
- Lo único que depende de la máquina es el intérprete base de Python. `pyvenv.cfg` y `bin/python3` apuntan al Python del sistema (por defecto `/usr/bin/python3.14`), nunca a un directorio de usuario.
- Si una máquina no tiene Python 3.14 donde el venv lo espera, ejecuta una vez:

```bash
bash scripts/venv-fix.sh          # repara y verifica (no borra paquetes)
bash scripts/venv-fix.sh --check  # solo comprueba
```

El instalador llama a este script automáticamente, y también queda accesible como `Proyecto/bin/venv-fix`.

### Pasos manuales

```bash
# 1) Dependencias Python (dentro del venv del proyecto)
Proyecto/bin/pip install -r requirements.txt
Proyecto/bin/pip install -r requirements-dev.txt   # solo para tests

# 2) Dependencias frontend y CSS
npm install
npm run css:build          # generates app/static/css/app.css
# npm run css:dev          # watch mode durante desarrollo

# 3) Base de datos y datos de demostración
Proyecto/bin/flask --app app init-db
Proyecto/bin/flask --app app seed-demo

# 4) Servidor
Proyecto/bin/flask --app app run
# o: FLASK_APP=app Proyecto/bin/flask run
```

Abre <http://127.0.0.1:5000/login>.

### Usuarios

Desde el menú **Usuarios** (solo administradores) puedes crear cuentas, asignar el rol `admin` o `vendedor`, editar datos, activar/desactivar el acceso y eliminar usuarios. `seed-demo` solo crea cuentas de prueba cuando no existen y es idempotente: no duplica datos si ya hay registros.

## Configuración

Copia `.env.example` a `.env` y ajusta lo necesario:

| Variable | Descripción | Valor por defecto |
| --- | --- | --- |
| `FLASK_CONFIG` | `development`, `testing` o `production` | `development` |
| `SECRET_KEY` | Firma de sesiones. En producción debe ser aleatorio y tener ≥32 caracteres | `dev-secret-change-me` |
| `DATABASE_URL` | URI SQLAlchemy | `sqlite:///concesionario.db` |
| `UPLOAD_FOLDER` | Raíz de imágenes (relativa al proyecto) | `instance/uploads` |
| `MAX_CONTENT_LENGTH_MB` | Límite global de petición | `8` |
| `TASA_MAX_AGE_HORAS` | Antigüedad máxima antes de advertir que la tasa está vencida | `24` |

En producción la app se niega a arrancar si `SECRET_KEY` es uno de los valores de ejemplo o tiene menos de 32 caracteres. El instalador genera uno aleatorio automáticamente.

## Estructura

```
app/
  __init__.py           create_app, wiring de extensiones, headers, errores, CLI
  config.py             configuración por entorno
  extensions.py         db, login_manager, csrf
  models/               Usuario, TasaCambio, Vehiculo, Cliente, Venta, Prospecto
  services/             tasas, ventas, dashboard, almacenamiento de imágenes
  api/                  endpoints REST bajo /api/v1 y /media
  utils/                money, validators, errores, imágenes, rate limit
  pages.py              rutas HTML protegidas
  templates/            Jinja (base, login, dashboard, módulos, error)
  static/js/            api.js, ui.js, forms/, pages/
  static/css/app.css    CSS compilado (no editar a mano)
frontend/src/input.css  design system y directivas Tailwind
tests/                  pytest
```

### Decisiones de diseño

- **Moneda:** VES es la principal; cada vista muestra la referencia en USD. Los precios se guardan como enteros en centavos. La tasa se guarda en micros (`ves_por_usd_micros`) para evitar coma flotante.
- **Inventario:** el estado (`disponible`/`reservado`/`vendido`) se puede editar, pero registrar una venta lo fuerza a `vendido`. Un vehículo con ventas no se elimina: se archiva para conservar el historial.
- **Panel:** `stock` = disponibles + reservados; `total` = todos los registros activos (incluye vendidos). Las ventas del mes cubren el mes completo, no "ahora + 24 h".
- **Fecha de venta:** se puede indicar al registrar; si se omite se usa la fecha/hora actual. La cancelación de una venta devuelve el vehículo a `disponible`.
- **Tasa:** la administra un administrador con historial. Cada venta congela la tasa vigente y calcula `precio_usd_centavos`; cambiar la tasa nunca reescribe ventas pasadas.
- **Imágenes:** se comprimen en el navegador (WebP), se validan en el servidor (JPG/PNG/WebP, máx. 5 MB) y se guardan como archivos en `instance/uploads`. La BD guarda solo la ruta relativa. El acceso pasa por `/media/...`, protegido con sesión.
- **Imágenes demo:** las fotos de referencia se descargaron de Unsplash (licencia Unsplash), se comprimieron a WebP (≈250 KB en total) y se guardan en `app/static/img/demo/`. `seed-demo` las copia a `instance/uploads/vehiculos/demo/` y las asocia a cada vehículo; funcionan sin conexión.
- **Autenticación:** sesiones con cookie `HttpOnly` + `SameSite=Lax`, 8 h. Todas las rutas salvo `/login`, `/health` y estáticos requieren sesión. CSRF con token en `meta[name=csrf-token]` y header `X-CSRFToken`.
- **Roles:** `admin` gestiona tasa, costos, márgenes, archivado y configuración; `vendedor` gestiona inventario, clientes, ventas y prospectos. Un vendedor solo puede completar/cancelar sus propias ventas.
- **UI:** sistema Apple-like (SF/-apple-system, superficies translúcidas, cards redondeadas, sheets, segmented controls, modo claro/oscuro persistente). Las clases Tailwind son literales para que el scanner las detecte.

## API REST

Todas bajo `/api/v1`, excepto `/health`:

- `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`
- `GET/PUT /tasa`, `GET /tasa/historial` (historial y escritura: admin)
- `GET/POST /vehiculos`, `GET/PUT /vehiculos/<id>`, `DELETE /vehiculos/<id>`, `POST /vehiculos/<id>/archivar`
- `POST /vehiculos/<id>/imagenes`, `DELETE /vehiculos/<id>/imagenes/<img>`, `PATCH .../principal`
- `GET/POST /clientes`, `GET/PUT/DELETE /clientes/<id>`
- `GET/POST /ventas`, `GET /ventas/<id>`, `POST /ventas/<id>/completar`, `POST /ventas/<id>/cancelar`
- `GET/POST /prospectos`, `GET/PUT/PATCH /prospectos/<id>`, `PATCH /prospectos/<id>/estado`, `POST /prospectos/<id>/convertir-cliente`
- `GET /catalogos`, `GET /dashboard/resumen`, `GET /media/vehiculos/<filename>`
- `GET/POST /usuarios`, `GET/PUT/DELETE /usuarios/<id>` (solo admin)

Respuestas: `{"data": ...}` en éxito, `{"meta": {...}}` en listados paginados, `{"error": {"code", "message", "fields"}}` en fallos.

## Comandos CLI

```bash
Proyecto/bin/flask --app app init-db                       # crear tablas
Proyecto/bin/flask --app app seed-demo                     # datos de demostración
Proyecto/bin/flask --app app cleanup-media                 # detectar huérfanos/rutas rotas
Proyecto/bin/flask --app app cleanup-media --delete        # eliminar huérfanos
Proyecto/bin/flask --app app backup                        # copiar BD + imágenes a backups/
```

## Tests

```bash
Proyecto/bin/pytest -q
```

La suite usa `TestingConfig` (SQLite en memoria, CSRF desactivado, rate limit desactivado) y cubre autenticación, permisos, tasa, inventario, imágenes, clientes, ventas con snapshots, prospectos, dashboard y rutas HTML.

## Notas de despliegue

- Sirve los estáticos con tu proxy inverso o con Flask; la app ya envía cabeceras de seguridad (CSP, `X-Frame-Options`, `Referrer-Policy`, HSTS en producción).
- Haz `npm run css:build` después de cambiar `frontend/src/input.css`, plantillas o archivos JS.
- Configura un `SECRET_KEY` seguro y un `DATABASE_URL` persistente antes de producción.

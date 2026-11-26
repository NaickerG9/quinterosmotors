@echo off
setlocal EnableExtensions
cd /d "%~dp0"

rem Busca Python en el PATH; si no existe, usa el launcher `py -3`.
set "PYTHON="
set "PYARGS="
for /f "delims=" %%P in ('where python 2^>nul') do if not defined PYTHON set "PYTHON=%%P"
if not defined PYTHON (
  for /f "delims=" %%P in ('where py 2^>nul') do if not defined PYTHON (
    set "PYTHON=%%P"
    set "PYARGS=-3"
  )
)
if not defined PYTHON (
  echo ERROR: no se encontro Python 3.11 o superior en el PATH.
  exit /b 1
)

"%PYTHON%" %PYARGS% -c "import sys; raise SystemExit(0 if sys.version_info >= (3, 11) else 1)" >nul 2>nul
if errorlevel 1 (
  echo ERROR: se necesita Python 3.11 o superior ^(se recomienda 3.14^).
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo ERROR: no se encontro npm. Instala Node.js antes de continuar.
  exit /b 1
)

set "VENV_PY=Proyecto\Scripts\python.exe"
if not exist "%VENV_PY%" (
  echo [1/7] Creando el entorno virtual en Proyecto\
  "%PYTHON%" %PYARGS% -m venv Proyecto
) else (
  "%VENV_PY%" -c "import flask" >nul 2>nul
  if errorlevel 1 (
    echo [1/7] Reparando el entorno virtual en Proyecto\
    rmdir /s /q Proyecto
    "%PYTHON%" %PYARGS% -m venv Proyecto
  ) else (
    echo [1/7] El entorno virtual ya existe y funciona.
  )
)
if not exist "%VENV_PY%" (
  echo ERROR: no se pudo crear el entorno virtual.
  exit /b 1
)

if not exist ".env" (
  copy /y ".env.example" ".env" >nul
  for /f "delims=" %%S in ('"%VENV_PY%" -c "import secrets; print(secrets.token_urlsafe(48))"') do set "QM_SECRET=%%S"
  powershell -NoProfile -Command "(Get-Content '.env') -replace '^SECRET_KEY=.*','SECRET_KEY=%QM_SECRET%' | Set-Content '.env'"
  echo [2/7] Creado .env con SECRET_KEY aleatorio.
) else (
  echo [2/7] .env ya existe; se conserva.
)

echo [3/7] Instalando dependencias Python...
"%VENV_PY%" -m pip install -r requirements.txt || goto :error
"%VENV_PY%" -m pip install -r requirements-dev.txt || goto :error

echo [4/7] Instalando dependencias frontend...
call npm install || goto :error

echo [5/7] Compilando CSS...
call npm run css:build || goto :error

echo [6/7] Inicializando base de datos y datos demo...
"%VENV_PY%" -m flask --app app init-db || goto :error
"%VENV_PY%" -m flask --app app seed-demo || goto :error

echo.
echo Listo. Interfaz: http://127.0.0.1:5000/login
echo Las cuentas demo, si se crearon, se indicaron en la salida de seed-demo.
echo Cierra esta ventana para detener el servidor.
echo.

echo [7/7] Iniciando servidor...
start "" http://127.0.0.1:5000/login
"%VENV_PY%" -m flask --app app run --host 127.0.0.1 --port 5000
if errorlevel 1 goto :error
exit /b 0

:error
echo.
echo El instalador no pudo completar. Revisa los mensajes anteriores.
pause
exit /b 1

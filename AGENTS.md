# AGENTS.md

## Workspace layout
- The application source lives at the workspace root, not inside `Proyecto/`.
- `app/` is the Flask application (factory, models, services, REST API, HTML pages, templates, static assets).
- `frontend/src/input.css` is the Tailwind v4 design system; `app/static/css/app.css` is generated output.
- `tests/` contains the pytest suite; `pytest.ini` sets `pythonpath = .` so `app` is importable.
- `instance/` holds SQLite and uploaded images and is gitignored. A `.gitkeep` file keeps the directory.
- `Proyecto/` is the isolated Python 3.14.4 venv with Flask, SQLAlchemy, Flask-Login, Flask-WTF, python-dotenv and pytest. `Proyecto/.gitignore` is `*`, so its contents are intentionally untracked.
- `node_modules/` is npm-only (Tailwind CLI). No JS bundler is used.

## Commands
- Run Python via `Proyecto/bin/python ...` or activate first with `source Proyecto/bin/activate`.
- The venv is portable (no absolute paths or usernames). After moving the SSD or switching machine, run `bash scripts/venv-fix.sh` (also `Proyecto/bin/venv-fix`) to re-point the base interpreter; it never wipes installed packages.
- Install Python packages with `Proyecto/bin/pip install ...`, never system pip.
- Build CSS with `npm run css:build` (or watch with `npm run css:dev`) after touching templates, JS or `frontend/src/input.css`.
- Initialise data: `Proyecto/bin/flask --app app init-db` then `Proyecto/bin/flask --app app seed-demo`.
- Run the app: `Proyecto/bin/flask --app app run`.
- Run tests: `Proyecto/bin/pytest -q`.

## Architecture notes
- `create_app(config_name=None, overrides=None)` wires extensions, API/pages blueprints, error handlers and CLI commands.
- All API responses are JSON `{"data": ...}`, with `{"meta": ...}` for pagination and `{"error": {...}}` for failures.
- All routes except `/login`, `/health`, `/api/v1/auth/login` and static assets require a session; `/configuracion`, rate writes/history and vehicle archiving are admin-only.
- CSRF is enabled outside tests; JS sends `X-CSRFToken` from the `meta[name="csrf-token"]` tag.
- Money: VES prices are integer centavos, exchange rates are integer micros, sales snapshot both rate and USD value. VES is primary, USD is always shown as reference.
- Vehicle images are stored on disk under `instance/uploads`; only relative paths are stored in the database. `/media/...` is session-protected.
- Tests must use separate Flask test clients per role. Keeping an `app.app_context()` open across requests makes Flask-Login cache `current_user` in `g` and leaks identity between clients.

## Gotchas
- `app/static/css/app.css` is generated: do not edit it manually.
- Tailwind scans `app/templates` and `app/static/js`; use complete static class strings, never interpolated class names.
- There is no `sqlite3` CLI installed; inspect the database through Python/SQLAlchemy if needed.
- Demo credentials are printed by `seed-demo` in the terminal only when it creates the accounts: `admin@quinteros.local / Admin123!` and `vendedor@quinteros.local / Vendedor123!`. They are not shown in the UI.
- Production refuses to start with the default `SECRET_KEY`.

# Setup and configuration

## Docker local demo

From the root, copy `.env.example` to `.env`, replace its password with a long random alphanumeric value, then run `docker compose up --build`. Open `http://127.0.0.1:8000`. Use `alice`, `bob` or `admin` / `slotguard-demo`. Compose is a local demonstration configuration, with loopback binding and a persistent database volume.

## Native development

Requirements: Python 3.12, Node 24, pnpm 11.19.0 and PostgreSQL 17 (including `btree_gist`). Create an empty database named `slotguard` using your PostgreSQL tools. The migration role needs permission to create the extension and schema.

From the repository root:

```bash
python -m venv .venv
# macOS/Linux:
source .venv/bin/activate
# Windows PowerShell instead: .\.venv\Scripts\Activate.ps1
python -m pip install -r backend/requirements-dev.lock
cd frontend
pnpm install --frozen-lockfile
pnpm build
cd ../backend
```

Set the environment in that shell. Substitute your own local connection string; URL-encode special password characters.

```bash
# macOS/Linux
export DATABASE_URL='postgresql+psycopg://USER:PASSWORD@127.0.0.1:5432/slotguard'
export DEMO_MODE=true
```

```powershell
# Windows PowerShell
$env:DATABASE_URL = 'postgresql+psycopg://USER:PASSWORD@127.0.0.1:5432/slotguard'
$env:DEMO_MODE = 'true'
```

Still in `backend/`:

```bash
python -m alembic upgrade head
python -m slotguard.cli seed-demo
python -m uvicorn slotguard.app:create_app --factory --host 127.0.0.1 --port 8000
```

If PowerShell blocks activation, invoke the virtual environment executable directly rather than changing execution policy. From `backend/`, it is `../.venv/Scripts/python.exe` when you created `.venv` at the repository root.

For Vite hot reload, add `http://127.0.0.1:5173` to `ALLOWED_ORIGINS` before launching the backend. In another shell run `pnpm dev` inside `frontend/`. Its proxy forwards `/api` and `/health` to the backend. Rebuild before serving the frontend through FastAPI again.

## Configuration

| Variable | Default | Meaning |
|---|---|---|
| `DATABASE_URL` | Required | SQLAlchemy PostgreSQL connection, using `postgresql+psycopg://` |
| `DEMO_MODE` | `false` | Enables scoped demo endpoints; seeding also requires explicit `true` |
| `ALLOWED_ORIGINS` | `http://127.0.0.1:8000` | Comma-separated exact origins for mutations; no spaces |
| `COOKIE_SECURE` | `false` | Use `true` when serving over HTTPS |
| `WORKSPACE_TIMEZONE` | `America/Argentina/Buenos_Aires` | IANA timezone displayed in booking UI |
| `FRONTEND_DIST` | `../frontend/dist` | Built frontend path relative to backend working directory |
| `TEST_DATABASE_URL` | None | Dedicated test database; name must end in `_test` |

`.env` is consumed by Compose, not automatically by the native app. Export variables explicitly when running natively. Never commit `.env`, passwords or database files.

## Own accounts

For an empty non-demo database, run migrations with `DEMO_MODE=false`, then `python -m slotguard.cli create-user --username YOUR_NAME --name 'Your Name' --admin`. Enter a password at the terminal prompt. Omit `--admin` for members. Disabling demo mode does not remove previously seeded accounts: use a separate database for real data.

## Troubleshooting

- 403 origin: use the exact configured host/port, including `127.0.0.1` versus `localhost`.
- 401: session missing/expired; sign in again. 403 CSRF: reload and retry.
- 409: choose a suggested alternative; submit with a new operation key after changing the request.
- Startup reports missing tables: run `alembic upgrade head` against the correct database.
- `btree_gist` permission error: ask the database owner to provision the extension.
- No UI at `/`: build frontend and launch from `backend/`, or set `FRONTEND_DIST`.
- 429 challenge/login: wait one minute. Limits are per process in this prototype.
- Agenda too broad: at most eight days and 500 reservations per query; choose a smaller range.

Stop the native server with Ctrl+C. PostgreSQL retains data. Run migrations before starting new code after an upgrade.

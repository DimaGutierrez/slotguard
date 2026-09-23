# Contributing

Start with [Setup](docs/setup.md). Use synthetic data and an isolated PostgreSQL database.

Bug reports should include commit, OS, timezone, steps, expected/actual outcome and a minimal example. Never paste cookies, passwords, real meeting titles or database connection strings.

In `backend/`, install `requirements-dev.lock`, set `TEST_DATABASE_URL` to a database ending in `_test`, then run:

```bash
python -m ruff check .
python -m ruff format --check .
python -m pytest -q
```

Tests truncate their dedicated tables. **Never point test configuration at a database with data you need.** PostgreSQL is required; SQLite is not a substitute for exclusion-constraint behavior.

In `frontend/`:

```bash
pnpm install --frozen-lockfile
pnpm exec prettier --check src tests
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
```

Start a synthetic demo app at `http://127.0.0.1:8000` before browser tests. They create and cancel fictional bookings. Keep the test instance isolated from everyday use. Set `BASE_URL` for a different local endpoint and match `ALLOWED_ORIGINS` on the server.

Prefer a small change with a clear behavior and the relevant test. Discussions are for design and feature tradeoffs; Issues are for reproducible bugs. English and Spanish are welcome.

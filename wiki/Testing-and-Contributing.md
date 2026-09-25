# Contributing

**[Try the public browser demo →](https://diegogutierrez.pages.dev/slotguard/)** — no installation or account required. Bookings, conflicts and the 201 / 409 race are simulated in this tab; reloading resets the examples. The full backend described below uses real HTTP requests and PostgreSQL when installed locally. [Demo scope](https://github.com/DimaGutierrez/slotguard/blob/main/docs/public-demo.md).

Start with [Setup](https://github.com/DimaGutierrez/slotguard/wiki/Getting-Started). Use synthetic data and an isolated PostgreSQL database.

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


# Verification

Local verification on 2026-09-23: Windows, Python 3.12.14, Node 24.19.0, PostgreSQL 17.11, Chromium via Playwright 1.63.0.

- **12 pytest tests passed** against real PostgreSQL, including eight synchronized two-user HTTP races and a concurrent idempotent retry.
- **2 Playwright journeys passed**, desktop and mobile: booking, overlap conflict, choosing an alternative, cancellation, the two-request challenge, and logout.
- TypeScript and Vite production build passed.
- Ruff check and format check passed. Frontend source/tests formatted with Prettier.
- Manual browser check created a reservation and observed 201 + 409 in the challenge, followed by one confirmed database row.
- Actual local screenshots are stored in `assets/app-planner.png` and `assets/app-race.png`, with synthetic data only.

Docker is not installed in the local development environment. The GitHub workflow includes a separate Compose build/smoke test; consult its actual result. Desktop/mobile browser checks use Chromium, not a claim of all-browser compatibility. Broader timezone/DST, accessibility and load testing remain follow-up work. No production performance or exactly-once guarantee is claimed.

One upstream Starlette warning currently notes future TestClient migration from httpx. It does not prevent the current pinned suite from passing.

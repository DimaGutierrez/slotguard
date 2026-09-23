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

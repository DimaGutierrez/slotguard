# Public browser demo

**[Open SlotGuard online](https://diegogutierrez.pages.dev/slotguard/)** — no installation or account required.

The public demo is hosted on Cloudflare Pages and runs in the visitor's browser. It has no connection to the author's computer. It uses fictional rooms and personas, in-memory reservations, simulated conflicts and artificial race delays. Reload to restore sample data. Each tab has independent state.

Try creating a booking, conflicting with the sample reservation, selecting an alternative, cancelling your own booking, switching to Admin to add a room or read the activity log, and running the simulated two-request challenge. The race demonstrates the interface outcome (201 / 409), not actual HTTP traffic, database correctness or performance. Real PostgreSQL concurrency, sessions, CSRF and persisted idempotency must be tested with the full backend described in the README.

## Build and validate

From `frontend/`, after installing dependencies from the lockfile:

```bash
pnpm exec vite build --config vite.demo.config.ts
node --test demo/engine.test.mjs
```

The separate demo entry point is in `frontend/demo/`; it shares the original CSS and dependencies. The backend application and its API client remain unchanged. Output goes to `frontend/demo-dist/`, with asset paths rooted at `/slotguard/`.

Copy the build output into `slotguard/` in the complete portfolio deployment. Preserve all other portfolio files, including the existing Webhook Lab demo. This route is absent from the portfolio menu and sitemap and uses `noindex`. Anyone with the URL can open it; hidden navigation is not access control.

No Pages Functions, database service, payment service or new subscription is used. The route uses a `connect-src 'none'` Content Security Policy. Reservations and roles are illustrative, not real accounts or access-control boundaries. Do not use the public simulation to make actual bookings.

Limits: 100 simultaneous sample bookings and 12 rooms per tab. Reloading resets all sample changes. To test the production architecture, run the Python/FastAPI/PostgreSQL stack locally with fictional data.

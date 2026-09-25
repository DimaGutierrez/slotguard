# API and permissions

**[Try the public browser demo →](https://diegogutierrez.pages.dev/slotguard/)** — no installation or account required. Bookings, conflicts and the 201 / 409 race are simulated in this tab; reloading resets the examples. The full backend described below uses real HTTP requests and PostgreSQL when installed locally. [Demo scope](https://github.com/DimaGutierrez/slotguard/blob/main/docs/public-demo.md).

Interactive OpenAPI documentation is available at `/docs` on the running local app. This page describes v0.1.

| Route | Access | Purpose |
|---|---|---|
| GET `/health` | Public | Database connectivity and version |
| GET `/api/public-config` | Public | Demo flag and workspace timezone |
| POST `/api/session` | Credentials + allowed Origin | Sign in |
| GET `/api/me` | Session | Current user and CSRF value |
| DELETE `/api/session` | Session + CSRF | Revoke session |
| GET `/api/rooms` | Member/admin | List ordinary rooms |
| POST `/api/rooms` | Admin + CSRF | Create a room |
| GET `/api/bookings?start=...&end=...` | Member/admin | Occupancy within a bounded interval |
| POST `/api/bookings` | Member/admin + CSRF + Idempotency-Key | Create one booking |
| POST `/api/bookings/{id}/cancel` | Owner/admin + CSRF | Cancel and release interval |
| GET `/api/audit?offset=0` | Admin | Audit history, 50 rows per page |
| POST `/api/demo/scenarios` | Signed-in + CSRF, demo enabled | Create an isolated challenge |
| POST `/api/demo/scenarios/{id}/book` | Scoped X-Demo-Token, demo enabled | One contender's booking |
| GET `/api/demo/scenarios/{id}` | Scenario owner | Read confirmed row count |

## Request rules

All mutations require an exact allowed Origin. Session-bound mutations also require X-CSRF-Token. The demo-book route uses its own expiring capability instead. Session cookies are HttpOnly and SameSite=Strict, with an eight-hour expiry. Use COOKIE_SECURE=true over HTTPS.

Booking body: room_id, starts_at, ends_at, title. Dates require offsets; duration is 15 minutes to 8 hours, start must be future and within one year. Title is 1–100 nonblank characters. Include an Idempotency-Key of 8–100 characters. Generate a new key for a new operation, preserve it for an uncertain network retry.

HTTP 201 confirms a committed creation; 409 means overlap or key/body mismatch; 401 means sign-in is needed; 403 means permission, Origin or CSRF failure; 422 identifies invalid input; 429 is a local rate limit. Replaying a matching key returns its stored outcome, even if that booking was later cancelled.

Occupancy reads cover at most eight days and 500 reservations. Other members see “Reserved” instead of the private meeting title. Administrators can cancel any booking; members can only cancel their own. Room editing/deletion and password reset are not implemented.

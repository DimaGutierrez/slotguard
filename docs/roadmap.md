# Roadmap

## v0.1 — implemented

- React room planner, one/seven-day agenda and mobile list.
- Booking/cancellation, refreshed conflict alternatives and role-aware controls.
- PostgreSQL overlap exclusion, idempotency, migrations and audit history.
- Revocable sessions and scoped two-request demo.
- Python integration tests and desktop/mobile browser tests.

## Next — choose a user problem

- Waitlist: ordering, expiry and the user's confirmation window.
- Reminders: preferences, delivery retries and duplicate prevention.
- Recurrence: timezone transitions, exceptions and partial conflicts.
- Room editing/archive, pagination improvements and accessibility review.

These are proposals, not commitments or release dates. [Share your use case](https://github.com/DimaGutierrez/slotguard/discussions/3).

## Before a hosted service

Separate demo tenants, distributed abuse protection, account recovery, database least privilege, TLS/reverse-proxy configuration, backups, retention and operational monitoring need explicit design and testing. The local Compose setup is not a production hosting recipe.

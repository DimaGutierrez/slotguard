# Security scope

SlotGuard v0.1 is a local, single-workspace prototype. The supplied Compose file binds the application to loopback and deliberately enables fictional accounts. Do not expose this demo configuration to the Internet.

- Public demo credentials are only for synthetic local data. Disabling DEMO_MODE does not delete previously seeded users.
- Session cookies are HttpOnly and SameSite=Strict; use COOKIE_SECURE=true over HTTPS. Mutations require allowed Origin and session CSRF, except scoped demo capabilities which are origin-checked and expire.
- Passwords are salted scrypt hashes; raw session tokens are hashed before storage. CSRF values are stored in the session row and exposed only to the authenticated same-origin client.
- API roles and ownership checks enforce permissions. Other members' titles are hidden in occupancy views, but room IDs, intervals and internal owner IDs are shared within the workspace.
- Database contents are not application-encrypted. Audit data includes actor and booking references; use fictional data in screenshots and public reports.
- Login and scenario rate limits are bounded, per-process in-memory safeguards, not distributed abuse protection. Row counts and disk usage have no global quota or retention policy.
- The demo uses scoped bearer capabilities for one room/time; anyone possessing such a token can attempt its assigned booking until expiry. Do not share active tokens.
- A PostgreSQL role able to run migrations and create extensions is used in the local demo. A real deployment needs a separate runtime role with least privilege, backups and operational controls.
- `/docs` uses standard Swagger assets. The workbench itself loads no external fonts, analytics or AI services.

For a suspected vulnerability, avoid public exploit details involving private data. Use the maintainer's public contact path on [their profile](https://github.com/DimaGutierrez) to arrange a private report. No response-time SLA is promised.

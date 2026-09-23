# SlotGuard: one slot, two requests

A working local fullstack room-booking prototype. React makes availability and conflicts understandable; FastAPI and PostgreSQL protect reservations when requests compete.

## Start here

- [Getting Started](Getting-Started): install and run the synthetic demo.
- [Concurrency and Idempotency](Concurrency-and-Idempotency): understand the invariant and the race.
- [API and Permissions](API-and-Permissions): routes, sessions and role rules.
- [Architecture](Architecture): design decisions and boundaries.
- [Testing and Contributing](Testing-and-Contributing): reproduce checks and improve the project.

## Try it and tell us what happens

1. Sign in locally as `alice` / `slotguard-demo`.
2. Run the Concurrency lab challenge.
3. Observe one HTTP 201, one 409, and the confirmed database count.
4. Try an occupied room in the planner and select an alternative.

[Share the conflict experience](https://github.com/DimaGutierrez/slotguard/discussions/1) · [Debate the database guarantee](https://github.com/DimaGutierrez/slotguard/discussions/2) · [Choose the next feature](https://github.com/DimaGutierrez/slotguard/discussions/3).

English and Spanish are welcome. ¿Qué parte te ayudó a entender el problema y cuál mejorarías?

This version is one workspace per installation, with a local demo configuration. It does not include hosted accounts, external calendars, reminders or payments. Promotional illustrations are concept artwork; [real application screenshots](https://github.com/DimaGutierrez/slotguard#see-the-race) are in the README.

[Source](https://github.com/DimaGutierrez/slotguard) · [README en español](https://github.com/DimaGutierrez/slotguard/blob/main/README.es.md) · [Security policy](https://github.com/DimaGutierrez/slotguard/security/policy)

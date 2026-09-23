# Is checking availability before INSERT enough to prevent double booking?

![UI, API and database layers](https://github.com/DimaGutierrez/slotguard/blob/main/assets/discussion-architecture.png?raw=true)

Request A checks a room: free. Request B checks the same interval: also free. Both attempt to insert. Where does your design stop the second confirmed reservation?

SlotGuard uses PostgreSQL ranges and an exclusion constraint for confirmed bookings of the same room. The API maps an overlap violation to HTTP 409, and the interface offers alternatives. The integration tests run synchronized requests against PostgreSQL rather than mocking the conflict.

A disabled button helps one browser. An idempotency key handles retries of one operation. Neither replaces the invariant between two different people reserving the same resource.

**Would you choose an exclusion constraint, explicit locking or serializable transactions? Explain one failure scenario and one tradeoff of your choice.**

Bonus: how would your design change for capacity greater than one or recurring reservations?

```text
My approach:
Invariant it protects:
Concurrent sequence I would test:
Cost or limitation:
```

[Read the implementation decisions](https://github.com/DimaGutierrez/slotguard/blob/main/docs/architecture.md) and [the tests](https://github.com/DimaGutierrez/slotguard/blob/main/backend/tests/test_bookings.py). The graphic is an editorial illustration, not an execution trace.

**Respuestas en español bienvenidas: contá qué carrera evita tu solución y cómo la probarías con conexiones independientes.**

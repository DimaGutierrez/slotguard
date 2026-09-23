# Concurrency and idempotency

For one room, confirmed intervals may not overlap. PostgreSQL enforces the rule using an exclusion constraint on room equality and `tstzrange(starts_at, ends_at, '[)')`. Adjacent bookings can share a boundary.

The UI's availability is a snapshot. Two users can see the same room free. A write commits before the API returns 201; a conflicting write becomes 409. There is no predetermined winner in the demo.

## Two different problems

- Different users, same room and interval: exclusion prevents overlapping confirmations.
- Same user retries the same operation: an actor/key lock and stored response prevent creating another booking. Different input with an old key is rejected.

Booking, audit event and operation outcome are committed transactionally. Cancellation changes status and writes another audit event. A stored creation response remains the response to that old key after cancellation; it does not recreate the booking.

## Reproduce it

Start the local demo, sign in and open Concurrency lab. Each run allocates a hidden room and two scoped tokens. Two browser POST requests use separate actors, then the owner reads the confirmed row count. Displayed request times include local overhead and are not a benchmark.

Challenges expire after 15 minutes. Creating another challenge cleans expired demo rooms and dependent records. Ordinary rooms remain separate; cleanup is not a scheduled background worker.

The pytest suite repeats synchronized HTTP races with independent connections, tests simultaneous idempotent retries, partial overlaps, adjacent intervals and separate rooms. See [Testing and Contributing](Testing-and-Contributing).

[Share the race you would test](https://github.com/DimaGutierrez/slotguard/discussions/2). No exactly-once delivery guarantee is made for future external side effects.

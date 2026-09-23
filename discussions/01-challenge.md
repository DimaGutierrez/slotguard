# Two people book the same room. What should the second person see?

![Two requests, one room](https://github.com/DimaGutierrez/slotguard/blob/main/assets/discussion-challenge.png?raw=true)

You open a calendar, choose a room and click Book. Someone else confirms it a fraction of a second earlier. What makes that moment feel clear rather than broken?

SlotGuard v0.1 now has a runnable local challenge: two actual HTTP requests compete for one isolated room and interval. PostgreSQL arbitrates the writes, and the UI reads back the confirmed count. The expected outcome is one 201, one 409, and one confirmed reservation—not a fixed winner.

**Try it:** follow the [quick start](https://github.com/DimaGutierrez/slotguard#quick-start-local-docker-demo), sign in as `alice`, open Concurrency lab and run the challenge. Then try booking an occupied interval in Room planner and inspect its alternatives.

The illustration above is concept art. [These screenshots](https://github.com/DimaGutierrez/slotguard#see-the-race) show the real application. Timings in the challenge are observations, not benchmark claims.

**What would help you more after losing a slot: the next available time, another room at the same time, or both?** Tell us which constraint matters.

```text
My situation: team meeting / workshop / another use
What I cannot change: time / room / capacity
The response I would want:
One confusing step in the demo:
```

Use fictional data. Reproducible bugs belong in Issues; this thread is for the experience and tradeoffs.

**También podés responder en español: si perdés el horario, ¿preferís cambiar de sala o mover la reunión? ¿Por qué?**

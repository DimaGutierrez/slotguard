import hashlib
import json
from datetime import UTC, datetime

from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from .db import audit, one, uid


def create_booking(engine, actor, room_id, starts_at, ends_at, title, key, demo=False):
    """One transaction per request. PostgreSQL arbitrates overlapping writes."""
    payload = {
        "room_id": room_id,
        "starts_at": starts_at.astimezone(UTC).isoformat(),
        "ends_at": ends_at.astimezone(UTC).isoformat(),
        "title": title,
    }
    fingerprint = hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()
    lock_key = int.from_bytes(
        hashlib.sha256(f"{actor}:{key}".encode()).digest()[:8], "big", signed=True
    )
    with engine.begin() as conn:
        # Serialize retries of the SAME operation, not contenders with different keys.
        conn.execute(text("SELECT pg_advisory_xact_lock(:key)"), {"key": lock_key})
        saved = one(conn, "SELECT * FROM idempotency WHERE actor_id=:a AND key=:k", a=actor, k=key)
        if saved:
            if saved["fingerprint"] != fingerprint:
                return 409, {"detail": "This request key was already used for different input."}
            return saved["http_status"], saved["response"]
        room = one(conn, "SELECT * FROM rooms WHERE id=:id", id=room_id)
        if not room or bool(room["demo"]) != demo:
            return 404, {"detail": "Room not found."}
        if starts_at <= datetime.now(UTC):
            return 422, {"detail": "Choose a start time in the future."}
        booking = {"id": uid(), "owner_id": actor, **payload, "status": "confirmed"}
        try:
            # A savepoint preserves the idempotency transaction on exclusion violation.
            with conn.begin_nested():
                conn.execute(
                    text("""INSERT INTO bookings
                    (id, owner_id, room_id, starts_at, ends_at, title)
                    VALUES (:id, :owner_id, :room_id, :starts_at, :ends_at, :title)"""),
                    {**booking, "starts_at": starts_at, "ends_at": ends_at},
                )
                audit(conn, actor, "booking.created", booking["id"], room_id)
            code, result = 201, booking
        except IntegrityError as error:
            if getattr(error.orig, "sqlstate", None) != "23P01":
                raise
            code, result = (
                409,
                {
                    "detail": "Someone booked this room first. Choose another time or room.",
                    "code": "slot_conflict",
                },
            )
        conn.execute(
            text("""INSERT INTO idempotency
            (actor_id, key, fingerprint, http_status, response, room_id)
            VALUES (:a, :k, :f, :s, CAST(:r AS jsonb), :room)"""),
            {
                "a": actor,
                "k": key,
                "f": fingerprint,
                "s": code,
                "r": json.dumps(result),
                "room": room_id,
            },
        )
        return code, result

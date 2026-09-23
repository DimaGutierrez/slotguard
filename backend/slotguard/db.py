import os
from uuid import uuid4

from sqlalchemy import create_engine, text


def make_engine(url=None):
    url = url or os.environ.get("DATABASE_URL")
    if not url or not url.startswith("postgresql+psycopg://"):
        raise RuntimeError("Set DATABASE_URL to a postgresql+psycopg:// connection string")
    return create_engine(url, pool_pre_ping=True, pool_size=8, max_overflow=4)


def uid():
    return str(uuid4())


def one(conn, sql, **params):
    return conn.execute(text(sql), params).mappings().first()


def many(conn, sql, **params):
    return [dict(row) for row in conn.execute(text(sql), params).mappings()]


def audit(conn, actor, action, booking_id=None, room_id=None):
    conn.execute(
        text("""INSERT INTO audit_events (actor_id, action, booking_id, room_id)
                VALUES (:actor, :action, :booking, :room)"""),
        {"actor": actor, "action": action, "booking": booking_id, "room": room_id},
    )

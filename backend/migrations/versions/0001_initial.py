"""Initial schema; exclusion constraint is the booking invariant."""

from alembic import op

revision = "0001"
down_revision = None

SCHEMA = """
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE TABLE users (
    id text PRIMARY KEY,
    username text NOT NULL UNIQUE,
    display_name text NOT NULL,
    password_hash text NOT NULL,
    role text NOT NULL CHECK (role IN ('admin', 'member'))
);
CREATE TABLE sessions (
    token_hash text PRIMARY KEY,
    user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    csrf text NOT NULL,
    expires_at timestamptz NOT NULL
);
CREATE TABLE rooms (
    id text PRIMARY KEY,
    name text NOT NULL,
    capacity integer NOT NULL CHECK (capacity BETWEEN 1 AND 100),
    description text NOT NULL DEFAULT '',
    color text NOT NULL DEFAULT 'mint',
    demo boolean NOT NULL DEFAULT false
);
CREATE TABLE bookings (
    id text PRIMARY KEY,
    owner_id text NOT NULL REFERENCES users(id),
    room_id text NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    starts_at timestamptz NOT NULL,
    ends_at timestamptz NOT NULL,
    title text NOT NULL,
    status text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled')),
    created_at timestamptz NOT NULL DEFAULT now(),
    CHECK (ends_at > starts_at),
    CONSTRAINT no_overlapping_bookings EXCLUDE USING gist
      (room_id WITH =, tstzrange(starts_at, ends_at, '[)') WITH &&)
      WHERE (status = 'confirmed')
);
CREATE INDEX bookings_owner ON bookings(owner_id);
CREATE TABLE idempotency (
    actor_id text NOT NULL REFERENCES users(id),
    key text NOT NULL,
    fingerprint text NOT NULL,
    http_status integer NOT NULL,
    response jsonb NOT NULL,
    room_id text NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (actor_id, key)
);
CREATE TABLE audit_events (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    actor_id text NOT NULL REFERENCES users(id),
    action text NOT NULL,
    booking_id text REFERENCES bookings(id) ON DELETE CASCADE,
    room_id text REFERENCES rooms(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE demo_scenarios (
    id text PRIMARY KEY,
    owner_id text NOT NULL REFERENCES users(id),
    room_id text NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    token_a text NOT NULL,
    token_b text NOT NULL,
    starts_at timestamptz NOT NULL,
    ends_at timestamptz NOT NULL,
    expires_at timestamptz NOT NULL
);
"""


def upgrade():
    for statement in SCHEMA.split(";"):
        if statement.strip():
            op.execute(statement)


def downgrade():
    for name in (
        "demo_scenarios",
        "audit_events",
        "idempotency",
        "bookings",
        "rooms",
        "sessions",
        "users",
    ):
        op.execute(f"DROP TABLE {name}")

import argparse
import getpass
import os
import secrets

from sqlalchemy import text

from .db import make_engine, uid
from .security import password_hash


def seed_demo(engine):
    if os.getenv("DEMO_MODE", "false").lower() != "true":
        raise RuntimeError("Set DEMO_MODE=true explicitly before seeding fictional accounts")
    with engine.begin() as conn:
        for name, label, role in [
            ("alice", "Alice Rivera", "member"),
            ("bob", "Bob Chen", "member"),
            ("admin", "Demo Admin", "admin"),
            ("demo-a", "Contender A", "member"),
            ("demo-b", "Contender B", "member"),
        ]:
            password = secrets.token_urlsafe(40) if name.startswith("demo-") else "slotguard-demo"
            conn.execute(
                text("""INSERT INTO users VALUES (:id, :name, :label, :hash, :role)
                 ON CONFLICT (username) DO NOTHING"""),
                {
                    "id": name,
                    "name": name,
                    "label": label,
                    "hash": password_hash(password),
                    "role": role,
                },
            )
        for id_, name, capacity, description, color in [
            ("atlas", "Atlas", 8, "Big ideas. A whiteboard and space for the whole team.", "mint"),
            ("orbit", "Orbit", 4, "A quiet room for focused conversations.", "blue"),
            (
                "studio",
                "Studio",
                12,
                "Workshops, prototypes and a different perspective.",
                "orange",
            ),
        ]:
            conn.execute(
                text("""INSERT INTO rooms (id, name, capacity, description, color)
                VALUES (:id, :name, :capacity, :description, :color)
                ON CONFLICT (id) DO NOTHING"""),
                {
                    "id": id_,
                    "name": name,
                    "capacity": capacity,
                    "description": description,
                    "color": color,
                },
            )


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=["seed-demo", "create-user"])
    parser.add_argument("--username")
    parser.add_argument("--name")
    parser.add_argument("--admin", action="store_true")
    args = parser.parse_args()
    engine = make_engine()
    if args.command == "seed-demo":
        seed_demo(engine)
        print("Synthetic demo ready. alice / bob / admin: slotguard-demo (LOCAL USE ONLY)")
    else:
        if not args.username or not args.name:
            parser.error("create-user requires --username and --name")
        password = getpass.getpass("Password (12+ characters): ")
        if len(password) < 12:
            parser.error("Password must contain at least 12 characters")
        with engine.begin() as conn:
            conn.execute(
                text("INSERT INTO users VALUES (:id, :u, :n, :p, :r)"),
                {
                    "id": uid(),
                    "u": args.username,
                    "n": args.name,
                    "p": password_hash(password),
                    "r": "admin" if args.admin else "member",
                },
            )
        print("User created.")
    engine.dispose()


if __name__ == "__main__":
    main()

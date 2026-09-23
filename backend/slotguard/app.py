import os
import secrets
from contextlib import asynccontextmanager
from datetime import UTC, datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

from fastapi import Depends, FastAPI, Header, HTTPException, Query, Request, Response
from fastapi.encoders import jsonable_encoder
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import AwareDatetime, BaseModel, Field, model_validator
from sqlalchemy import text

from . import __version__
from .db import audit, make_engine, many, one, uid
from .security import RateLimit, digest, password_hash, verify_password
from .service import create_booking


class Login(BaseModel):
    username: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=1, max_length=256)


class BookingInput(BaseModel):
    room_id: str = Field(min_length=1, max_length=36)
    starts_at: AwareDatetime
    ends_at: AwareDatetime
    title: str = Field(min_length=1, max_length=100)

    @model_validator(mode="after")
    def interval(self):
        self.title = self.title.strip()
        if not self.title:
            raise ValueError("A title is required")
        duration = self.ends_at - self.starts_at
        if not timedelta(minutes=15) <= duration <= timedelta(hours=8):
            raise ValueError("Bookings must last between 15 minutes and 8 hours")
        if self.starts_at > datetime.now(UTC) + timedelta(days=366):
            raise ValueError("Choose a date within the next year")
        return self


class RoomInput(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    capacity: int = Field(ge=1, le=100)
    description: str = Field(default="", max_length=200)


def create_app(engine=None, demo=None):
    engine = engine or make_engine()
    demo = os.getenv("DEMO_MODE", "false").lower() == "true" if demo is None else demo
    timezone = os.getenv("WORKSPACE_TIMEZONE", "America/Argentina/Buenos_Aires")
    ZoneInfo(timezone)
    secure = os.getenv("COOKIE_SECURE", "false").lower() == "true"
    origins = set(os.getenv("ALLOWED_ORIGINS", "http://127.0.0.1:8000").split(","))
    limiter = RateLimit()
    dummy_hash = password_hash("not-a-real-user")

    @asynccontextmanager
    async def lifespan(app):
        with engine.connect() as conn:
            conn.execute(text("SELECT 1 FROM users LIMIT 1"))
        yield

    app = FastAPI(title="SlotGuard", version=__version__, lifespan=lifespan)
    app.state.engine = engine

    @app.middleware("http")
    async def boundaries(request, call_next):
        if request.method in {"POST", "PUT", "PATCH", "DELETE"}:
            if request.headers.get("origin") not in origins:
                return JSONResponse({"detail": "Untrusted request origin."}, status_code=403)
            size = request.headers.get("content-length")
            if size and (not size.isdigit() or int(size) > 8192):
                return JSONResponse({"detail": "Request too large."}, status_code=413)
            # Read bounded chunks as well, including chunked requests.
            chunks, length = [], 0
            async for chunk in request.stream():
                length += len(chunk)
                if length > 8192:
                    return JSONResponse({"detail": "Request too large."}, status_code=413)
                chunks.append(chunk)
            request._body = b"".join(chunks)
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "same-origin"
        response.headers["X-Frame-Options"] = "DENY"
        if request.url.path.startswith("/api"):
            response.headers["Cache-Control"] = "no-store"
        elif request.url.path == "/":
            response.headers["Content-Security-Policy"] = (
                "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; "
                "img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'"
            )
        return response

    def current(request: Request):
        token = request.cookies.get("sg_session", "")
        with engine.connect() as conn:
            row = one(
                conn,
                """SELECT u.id, u.username, u.display_name, u.role, s.csrf
                FROM sessions s JOIN users u ON u.id=s.user_id
                WHERE s.token_hash=:token AND s.expires_at > now()""",
                token=digest(token),
            )
        if not row:
            raise HTTPException(401, "Sign in to continue.")
        if request.method not in {"GET", "HEAD"} and not secrets.compare_digest(
            request.headers.get("x-csrf-token", ""), row["csrf"]
        ):
            raise HTTPException(403, "Invalid CSRF token. Reload and try again.")
        return dict(row)

    def admin(user=Depends(current)):
        if user["role"] != "admin":
            raise HTTPException(403, "Administrator permission required.")
        return user

    def demo_only():
        if not demo:
            raise HTTPException(404, "Demo mode is disabled.")

    @app.get("/health")
    def health():
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return {"status": "ok", "version": __version__}

    @app.get("/api/public-config")
    def config():
        return {"demo": demo, "timezone": timezone, "version": __version__}

    @app.post("/api/session")
    def login(body: Login, request: Request, response: Response):
        ip = request.client.host if request.client else "unknown"
        if not limiter.allow(f"login:{ip}", 20):
            raise HTTPException(429, "Too many attempts. Try again in a minute.")
        with engine.begin() as conn:
            user = one(conn, "SELECT * FROM users WHERE username=:name", name=body.username)
            valid = verify_password(body.password, user["password_hash"] if user else dummy_hash)
            if not valid or not user:
                raise HTTPException(401, "Incorrect username or password.")
            token, csrf = secrets.token_urlsafe(32), secrets.token_urlsafe(32)
            conn.execute(text("DELETE FROM sessions WHERE expires_at <= now()"))
            conn.execute(
                text("DELETE FROM sessions WHERE token_hash=:t"),
                {"t": digest(request.cookies.get("sg_session", ""))},
            )
            conn.execute(
                text("""INSERT INTO sessions VALUES (:token, :user, :csrf, :expiry)"""),
                {
                    "token": digest(token),
                    "user": user["id"],
                    "csrf": csrf,
                    "expiry": datetime.now(UTC) + timedelta(hours=8),
                },
            )
        response.set_cookie(
            "sg_session",
            token,
            max_age=28800,
            httponly=True,
            secure=secure,
            samesite="strict",
            path="/",
        )
        return {
            "id": user["id"],
            "username": user["username"],
            "display_name": user["display_name"],
            "role": user["role"],
            "csrf": csrf,
        }

    @app.get("/api/me")
    def me(user=Depends(current)):
        return user

    @app.delete("/api/session", status_code=204)
    def logout(request: Request, response: Response, user=Depends(current)):
        with engine.begin() as conn:
            conn.execute(
                text("DELETE FROM sessions WHERE token_hash=:token"),
                {"token": digest(request.cookies.get("sg_session", ""))},
            )
        response.delete_cookie("sg_session", path="/", secure=secure, samesite="strict")

    @app.get("/api/rooms")
    def rooms(user=Depends(current)):
        with engine.connect() as conn:
            return many(conn, "SELECT * FROM rooms WHERE NOT demo ORDER BY name")

    @app.post("/api/rooms", status_code=201)
    def add_room(body: RoomInput, user=Depends(admin)):
        if not body.name.strip():
            raise HTTPException(422, "Room name is required.")
        record = {"id": uid(), **body.model_dump()}
        with engine.begin() as conn:
            conn.execute(
                text("""INSERT INTO rooms (id, name, capacity, description)
                            VALUES (:id, :name, :capacity, :description)"""),
                record,
            )
            audit(conn, user["id"], "room.created", room_id=record["id"])
        return record

    @app.get("/api/bookings")
    def bookings(start: AwareDatetime, end: AwareDatetime, user=Depends(current)):
        if not timedelta(0) < end - start <= timedelta(days=8):
            raise HTTPException(422, "Read a range of at most eight days.")
        with engine.connect() as conn:
            result = many(
                conn,
                """SELECT b.*, r.name AS room_name FROM bookings b
                JOIN rooms r ON r.id=b.room_id WHERE NOT r.demo AND b.status='confirmed'
                AND b.starts_at < :end AND b.ends_at > :start ORDER BY b.starts_at LIMIT 501""",
                start=start,
                end=end,
            )
        if len(result) > 500:
            raise HTTPException(422, "Too many bookings. Choose a shorter date range.")
        # Room occupancy is shared; other members' meeting titles are private.
        for item in result:
            item["can_cancel"] = item["owner_id"] == user["id"] or user["role"] == "admin"
            if not item["can_cancel"]:
                item["title"] = "Reserved"
        return result

    @app.post("/api/bookings")
    def book(
        body: BookingInput,
        idempotency_key: str = Header(min_length=8, max_length=100),
        user=Depends(current),
    ):
        code, result = create_booking(engine, user["id"], **body.model_dump(), key=idempotency_key)
        return JSONResponse(jsonable_encoder(result), status_code=code)

    @app.post("/api/bookings/{booking_id}/cancel")
    def cancel(booking_id: str, user=Depends(current)):
        with engine.begin() as conn:
            booking = one(conn, "SELECT * FROM bookings WHERE id=:id FOR UPDATE", id=booking_id)
            if not booking:
                raise HTTPException(404, "Booking not found.")
            if booking["owner_id"] != user["id"] and user["role"] != "admin":
                raise HTTPException(403, "You can only cancel your own bookings.")
            if booking["status"] != "cancelled":
                conn.execute(
                    text("UPDATE bookings SET status='cancelled' WHERE id=:id"), {"id": booking_id}
                )
                audit(conn, user["id"], "booking.cancelled", booking_id, booking["room_id"])
        return {"id": booking_id, "status": "cancelled"}

    @app.get("/api/audit")
    def history(offset: int = Query(default=0, ge=0, le=100000), user=Depends(admin)):
        with engine.connect() as conn:
            return many(
                conn,
                """SELECT a.id, a.action, a.booking_id, a.created_at,
                u.display_name AS actor, r.name AS room FROM audit_events a
                JOIN users u ON u.id=a.actor_id LEFT JOIN rooms r ON r.id=a.room_id
                WHERE r.demo IS NOT TRUE ORDER BY a.id DESC LIMIT 50 OFFSET :offset""",
                offset=offset,
            )

    @app.post("/api/demo/scenarios", status_code=201, dependencies=[Depends(demo_only)])
    def scenario(user=Depends(current)):
        if not limiter.allow(f"scenario:{user['id']}", 6):
            raise HTTPException(429, "Wait a minute before starting another challenge.")
        scenario_id, room_id = uid(), uid()
        tokens = [secrets.token_urlsafe(32), secrets.token_urlsafe(32)]
        starts = (datetime.now(UTC) + timedelta(days=1)).replace(
            hour=14, minute=0, second=0, microsecond=0
        )
        with engine.begin() as conn:
            # Only expired scenarios are removed; active challenges remain isolated.
            conn.execute(
                text("""DELETE FROM rooms WHERE id IN
                (SELECT room_id FROM demo_scenarios WHERE expires_at < now())""")
            )
            conn.execute(
                text("""INSERT INTO rooms (id, name, capacity, demo)
                VALUES (:id, 'Challenge room', 2, true)"""),
                {"id": room_id},
            )
            conn.execute(
                text("""INSERT INTO demo_scenarios VALUES
                (:id, :owner, :room, :a, :b, :start, :end, :expiry)"""),
                {
                    "id": scenario_id,
                    "owner": user["id"],
                    "room": room_id,
                    "a": digest(tokens[0]),
                    "b": digest(tokens[1]),
                    "start": starts,
                    "end": starts + timedelta(hours=1),
                    "expiry": datetime.now(UTC) + timedelta(minutes=15),
                },
            )
        return {
            "id": scenario_id,
            "tokens": tokens,
            "starts_at": starts,
            "ends_at": starts + timedelta(hours=1),
        }

    @app.post("/api/demo/scenarios/{scenario_id}/book", dependencies=[Depends(demo_only)])
    def demo_book(scenario_id: str, x_demo_token: str = Header(max_length=100)):
        with engine.connect() as conn:
            row = one(
                conn,
                "SELECT * FROM demo_scenarios WHERE id=:id AND expires_at > now()",
                id=scenario_id,
            )
            hashed = digest(x_demo_token)
            if not row or hashed not in {row["token_a"], row["token_b"]}:
                raise HTTPException(404, "Challenge expired or token invalid.")
            actor = "demo-a" if secrets.compare_digest(hashed, row["token_a"]) else "demo-b"
        code, result = create_booking(
            engine,
            actor,
            row["room_id"],
            row["starts_at"],
            row["ends_at"],
            "Race challenge",
            scenario_id,
            demo=True,
        )
        return JSONResponse(jsonable_encoder(result), status_code=code)

    @app.get("/api/demo/scenarios/{scenario_id}", dependencies=[Depends(demo_only)])
    def demo_result(scenario_id: str, user=Depends(current)):
        with engine.connect() as conn:
            row = one(
                conn,
                "SELECT * FROM demo_scenarios WHERE id=:id AND owner_id=:owner",
                id=scenario_id,
                owner=user["id"],
            )
            if not row:
                raise HTTPException(404, "Challenge not found.")
            return {
                "confirmed": many(
                    conn,
                    """SELECT id, owner_id, status FROM bookings
                WHERE room_id=:room AND status='confirmed'""",
                    room=row["room_id"],
                )
            }

    frontend = Path(os.getenv("FRONTEND_DIST", "../frontend/dist"))
    if frontend.is_dir():
        app.mount("/assets", StaticFiles(directory=frontend / "assets"), name="assets")

        @app.get("/", include_in_schema=False)
        def index():
            return FileResponse(frontend / "index.html")

    return app

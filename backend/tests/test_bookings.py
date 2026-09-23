from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta
from threading import Barrier

from fastapi.testclient import TestClient
from sqlalchemy import text

from slotguard.app import create_app
from slotguard.service import create_booking

from .conftest import sign_in


def payload(**updates):
    start = (datetime.now(UTC) + timedelta(days=2)).replace(
        hour=13, minute=0, second=0, microsecond=0
    )
    return {
        "room_id": "atlas",
        "title": "Design session",
        "starts_at": start.isoformat(),
        "ends_at": (start + timedelta(hours=1)).isoformat(),
        **updates,
    }


def post(client, body=None, key="booking-key-01"):
    return client.post("/api/bookings", json=body or payload(), headers={"Idempotency-Key": key})


def test_capture_replay_cancel_and_audit(client, engine):
    sign_in(client)
    result = post(client)
    assert result.status_code == 201
    assert post(client).json() == result.json()
    assert post(client, payload(title="Changed input")).status_code == 409
    id_ = result.json()["id"]
    assert client.post(f"/api/bookings/{id_}/cancel").status_code == 200
    assert client.post(f"/api/bookings/{id_}/cancel").status_code == 200
    assert post(client, key="booking-key-02").status_code == 201
    with engine.connect() as conn:
        assert conn.execute(text("SELECT count(*) FROM audit_events")).scalar_one() == 3


def test_permissions_csrf_origin_and_logout(client):
    assert client.get("/api/rooms").status_code == 401
    assert (
        client.post(
            "/api/session",
            headers={"Origin": "https://evil.example"},
            json={"username": "alice", "password": "slotguard-demo"},
        ).status_code
        == 403
    )
    sign_in(client)
    assert post(client).status_code == 201
    assert client.post("/api/rooms", json={"name": "Nope", "capacity": 2}).status_code == 403
    assert client.get("/api/audit").status_code == 403
    assert (
        client.post(
            "/api/bookings",
            headers={"X-CSRF-Token": "bad", "Idempotency-Key": "another-key"},
            json=payload(),
        ).status_code
        == 403
    )
    assert client.delete("/api/session").status_code == 204
    assert client.get("/api/me").status_code == 401


def test_other_member_cannot_cancel_and_title_private(client):
    sign_in(client)
    result = post(client)
    sign_in(client, "bob")
    assert client.post(f"/api/bookings/{result.json()['id']}/cancel").status_code == 403
    body = payload()
    rows = client.get(
        "/api/bookings", params={"start": body["starts_at"], "end": body["ends_at"]}
    ).json()
    assert rows[0]["title"] == "Reserved"
    assert rows[0]["can_cancel"] is False
    sign_in(client, "admin")
    assert client.post(f"/api/bookings/{result.json()['id']}/cancel").status_code == 200
    assert client.get("/api/audit").json()


def test_overlap_boundaries_and_independent_rooms(client):
    sign_in(client)
    body = payload()
    start = datetime.fromisoformat(body["starts_at"])
    assert post(client, body).status_code == 201
    for i, (a, b) in enumerate([(-30, 30), (30, 90), (-30, 90), (15, 45)]):
        candidate = payload(
            starts_at=(start + timedelta(minutes=a)).isoformat(),
            ends_at=(start + timedelta(minutes=b)).isoformat(),
        )
        assert post(client, candidate, f"overlap-key-{i}").status_code == 409
    adjacent = payload(starts_at=body["ends_at"], ends_at=(start + timedelta(hours=2)).isoformat())
    assert post(client, adjacent, "adjacent-key").status_code == 201
    assert post(client, payload(room_id="orbit"), "other-room-key").status_code == 201


def test_concurrent_http_requests_only_one_commits(app, engine):
    for iteration in range(8):
        barrier = Barrier(2)
        body = payload()
        start = datetime.fromisoformat(body["starts_at"]) + timedelta(days=iteration)
        body.update(starts_at=start.isoformat(), ends_at=(start + timedelta(hours=1)).isoformat())

        def compete(name):
            with TestClient(app, headers={"Origin": "http://testserver"}) as client:
                sign_in(client, name)
                barrier.wait(timeout=10)
                return post(client, body, f"concurrent-{iteration}-{name}").status_code

        with ThreadPoolExecutor(max_workers=2) as pool:
            assert sorted(pool.map(compete, ["alice", "bob"])) == [201, 409]
    with engine.connect() as conn:
        assert (
            conn.execute(
                text("SELECT count(*) FROM bookings WHERE status='confirmed'")
            ).scalar_one()
            == 8
        )


def test_concurrent_idempotent_retry_is_one_booking(engine):
    barrier = Barrier(2)
    data = payload()

    def retry(_):
        barrier.wait(timeout=10)
        return create_booking(
            engine,
            "alice",
            "atlas",
            datetime.fromisoformat(data["starts_at"]),
            datetime.fromisoformat(data["ends_at"]),
            "Same operation",
            "same-key",
        )

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(retry, range(2)))
    assert results[0] == results[1]
    assert results[0][0] == 201
    with engine.connect() as conn:
        assert conn.execute(text("SELECT count(*) FROM bookings")).scalar_one() == 1


def test_invalid_dates_and_bounded_queries(client):
    sign_in(client)
    assert (
        post(
            client, payload(starts_at="2026-01-01T10:00:00", ends_at="2026-01-01T11:00:00")
        ).status_code
        == 422
    )
    assert post(client, payload(ends_at=payload()["starts_at"])).status_code == 422
    assert post(client, payload(title=" ")).status_code == 422
    assert (
        post(
            client, payload(starts_at="2000-01-01T10:00:00Z", ends_at="2000-01-01T11:00:00Z")
        ).status_code
        == 422
    )
    assert (
        client.get(
            "/api/bookings", params={"start": "2026-01-01T00:00:00Z", "end": "2026-02-01T00:00:00Z"}
        ).status_code
        == 422
    )


def test_timezone_equivalent_instants_conflict(client):
    sign_in(client)
    data = payload()
    assert post(client, data).status_code == 201
    offset = timedelta(hours=-3)
    from datetime import timezone

    shifted = payload(
        starts_at=datetime.fromisoformat(data["starts_at"])
        .astimezone(timezone(offset))
        .isoformat(),
        ends_at=datetime.fromisoformat(data["ends_at"]).astimezone(timezone(offset)).isoformat(),
    )
    assert post(client, shifted, "offset-conflict-key").status_code == 409


def test_demo_real_requests_and_isolation(client, app):
    sign_in(client)
    scenario = client.post("/api/demo/scenarios").json()
    barrier = Barrier(2)

    def compete(token):
        with TestClient(app, headers={"Origin": "http://testserver"}) as c:
            barrier.wait(timeout=10)
            return c.post(
                f"/api/demo/scenarios/{scenario['id']}/book", headers={"X-Demo-Token": token}
            ).status_code

    with ThreadPoolExecutor(max_workers=2) as pool:
        assert sorted(pool.map(compete, scenario["tokens"])) == [201, 409]
    assert len(client.get(f"/api/demo/scenarios/{scenario['id']}").json()["confirmed"]) == 1
    assert all(not room["demo"] for room in client.get("/api/rooms").json())
    sign_in(client, "bob")
    assert client.get(f"/api/demo/scenarios/{scenario['id']}").status_code == 404
    assert (
        client.post(
            f"/api/demo/scenarios/{scenario['id']}/book", headers={"X-Demo-Token": "wrong"}
        ).status_code
        == 404
    )


def test_disabled_demo_and_session_expiry(client, engine):
    sign_in(client)
    with engine.begin() as conn:
        conn.execute(text("UPDATE sessions SET expires_at=now()-interval '1 second'"))
    assert client.get("/api/me").status_code == 401
    app = create_app(engine, demo=False)
    with TestClient(app, headers={"Origin": "http://testserver"}) as c:
        assert c.get("/api/public-config").json()["demo"] is False
        assert c.post("/api/demo/scenarios").status_code == 404


def test_invalid_login_and_size_limit(client):
    assert (
        client.post("/api/session", json={"username": "unknown", "password": "bad"}).status_code
        == 401
    )
    assert client.post("/api/session", content="x" * 9000).status_code == 413


def test_admin_room_creation(client):
    sign_in(client, "admin")
    result = client.post("/api/rooms", json={"name": "New room", "capacity": 6})
    assert result.status_code == 201
    assert any(row["id"] == result.json()["id"] for row in client.get("/api/rooms").json())

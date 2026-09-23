import os

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import text

from slotguard.app import create_app
from slotguard.cli import seed_demo
from slotguard.db import make_engine


@pytest.fixture(scope="session")
def engine():
    url = os.environ.get("TEST_DATABASE_URL", "")
    if not url or not url.rsplit("/", 1)[-1].endswith("_test"):
        pytest.fail("Set TEST_DATABASE_URL to a dedicated PostgreSQL database ending in _test")
    os.environ["DATABASE_URL"] = url
    os.environ["DEMO_MODE"] = "true"
    os.environ["ALLOWED_ORIGINS"] = "http://testserver"
    engine = make_engine(url)
    command.upgrade(Config("alembic.ini"), "head")
    seed_demo(engine)
    yield engine
    engine.dispose()


@pytest.fixture(autouse=True)
def clean(engine):
    with engine.begin() as conn:
        conn.execute(text("TRUNCATE demo_scenarios, audit_events, idempotency, bookings, sessions"))
        conn.execute(text("DELETE FROM rooms WHERE demo"))


@pytest.fixture
def app(engine):
    return create_app(engine, demo=True)


@pytest.fixture
def client(app):
    with TestClient(app, headers={"Origin": "http://testserver"}) as client:
        yield client


def sign_in(client, username="alice"):
    response = client.post(
        "/api/session", json={"username": username, "password": "slotguard-demo"}
    )
    assert response.status_code == 200
    client.headers["X-CSRF-Token"] = response.json()["csrf"]
    return response.json()

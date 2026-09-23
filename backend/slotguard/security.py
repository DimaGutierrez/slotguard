import hashlib
import secrets
import threading
import time
from collections import OrderedDict


def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()


def password_hash(password, salt=None):
    salt = salt or secrets.token_hex(16)
    value = hashlib.scrypt(password.encode(), salt=salt.encode(), n=16384, r=8, p=1).hex()
    return f"{salt}${value}"


def verify_password(password, stored):
    salt = stored.split("$", 1)[0]
    return secrets.compare_digest(password_hash(password, salt), stored)


class RateLimit:
    """Bounded, per-process limiter for the local prototype; not a distributed quota."""

    def __init__(self):
        self.entries = OrderedDict()
        self.lock = threading.Lock()

    def allow(self, key, maximum=12, window=60):
        now = time.monotonic()
        with self.lock:
            old = self.entries.pop(key, [])
            recent = [stamp for stamp in old if now - stamp < window]
            allowed = len(recent) < maximum
            if allowed:
                recent.append(now)
            self.entries[key] = recent
            while len(self.entries) > 2000:
                self.entries.popitem(last=False)
            return allowed

import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { DateTime } from "luxon";
import {
  ArrowRight,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FlaskConical,
  Layers3,
  LogOut,
  Plus,
  RefreshCw,
  ShieldCheck,
  Users,
  X,
  Activity,
  DoorOpen,
} from "lucide-react";
import { api, ApiError } from "./api";

type User = { id: string; display_name: string; role: string; csrf: string };
type Config = { demo: boolean; timezone: string; version: string };
type Room = {
  id: string;
  name: string;
  capacity: number;
  description: string;
  color: string;
};
type Booking = {
  id: string;
  room_id: string;
  room_name: string;
  title: string;
  starts_at: string;
  ends_at: string;
  can_cancel: boolean;
};
type Audit = {
  id: number;
  actor: string;
  action: string;
  room: string;
  created_at: string;
};
type Scenario = {
  id: string;
  tokens: string[];
  starts_at: string;
  ends_at: string;
};
type Attempt = { actor: string; code: number; detail: string; ms: number };
type Tab = "agenda" | "lab" | "activity";
const message = (e: unknown) =>
  e instanceof Error ? e.message : "Something went wrong. Try again.";

export default function App() {
  const [config, setConfig] = useState<Config>();
  const [user, setUser] = useState<User>();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    api<Config>("/public-config")
      .then(setConfig)
      .catch((e) => setError(message(e)));
    api<User>("/me")
      .then(setUser)
      .catch((e) => {
        if (!(e instanceof ApiError && e.status === 401)) setError(message(e));
      })
      .finally(() => setReady(true));
  }, []);
  if (!ready || !config)
    return (
      <main className="loading">
        <ShieldCheck size={38} />
        <h1>SlotGuard</h1>
        <p role="status">{error || "Opening your workspace…"}</p>
        {error && <button onClick={() => location.reload()}>Retry</button>}
      </main>
    );
  if (!user) return <Login config={config} onLogin={setUser} />;
  return (
    <Workspace
      user={user}
      config={config}
      onLogout={() => setUser(undefined)}
    />
  );
}

function Login({
  config,
  onLogin,
}: {
  config: Config;
  onLogin: (u: User) => void;
}) {
  const [username, setUsername] = useState(config.demo ? "alice" : "");
  const [password, setPassword] = useState(config.demo ? "slotguard-demo" : "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      onLogin(
        await api<User>("/session", {
          method: "POST",
          body: JSON.stringify({ username, password }),
        }),
      );
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login-layout">
      <section className="login-story">
        <Brand />
        <span className="eyebrow">A LITTLE SPACE. A BIG DIFFERENCE.</span>
        <h1>
          Make room
          <br />
          for good work<span>.</span>
        </h1>
        <p>
          Find your space, book your time, and keep everyone on the same page.
        </p>
        <div className="room-illustration" aria-hidden="true">
          <div className="room-outline">
            <div className="table-shape" />
            <div className="chair c1" />
            <div className="chair c2" />
            <div className="chair c3" />
            <div className="chair c4" />
            <span>
              <Check size={16} /> YOUR SPACE IS READY
            </span>
          </div>
        </div>
        <div className="login-bottom">
          <ShieldCheck size={18} /> One room. One confirmed booking.
        </div>
      </section>
      <section className="login-form">
        <span className="pill">
          {config.demo ? "LOCAL DEMO WORKSPACE" : "YOUR WORKSPACE"}
        </span>
        <h2>Welcome in.</h2>
        <p>Sign in to find a little space for your next big idea.</p>
        <form onSubmit={submit}>
          <label>
            Username
            <input
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              maxLength={64}
            />
          </label>
          <label>
            Password
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              maxLength={256}
            />
          </label>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button className="primary full" disabled={busy}>
            {busy ? "Signing in…" : "Enter workspace"}
            <ArrowRight size={18} />
          </button>
        </form>
        {config.demo && (
          <aside className="demo-note">
            <strong>Take a look around</strong>
            <p>
              Use <code>alice</code>, <code>bob</code> or <code>admin</code>{" "}
              with <code>slotguard-demo</code>. Fictional people, real database
              transactions.
            </p>
          </aside>
        )}
        <small>
          SlotGuard / v{config.version} · Built to make concurrency visible.
        </small>
      </section>
    </main>
  );
}

function Brand() {
  return (
    <div className="brand">
      <span>
        <Layers3 size={21} />
      </span>
      slotguard
    </div>
  );
}

function Workspace({
  user,
  config,
  onLogout,
}: {
  user: User;
  config: Config;
  onLogout: () => void;
}) {
  const zone = config.timezone;
  const [tab, setTab] = useState<Tab>("agenda");
  const [date, setDate] = useState(
    DateTime.now().setZone(zone).plus({ days: 1 }).toISODate()!,
  );
  const [week, setWeek] = useState(false);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [roomFilter, setRoomFilter] = useState("all");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [bookingRoom, setBookingRoom] = useState<string>();
  const [addingRoom, setAddingRoom] = useState(false);
  const [cancelling, setCancelling] = useState<Booking>();
  const [mutating, setMutating] = useState(false);
  const refreshId = useRef(0);
  const refresh = useCallback(async () => {
    const id = ++refreshId.current;
    setLoading(true);
    setError("");
    const start = DateTime.fromISO(date, { zone }).startOf("day");
    const params = new URLSearchParams({
      start: start.toISO()!,
      end: start.plus({ days: week ? 7 : 1 }).toISO()!,
    });
    try {
      const [r, b] = await Promise.all([
        api<Room[]>("/rooms"),
        api<Booking[]>(`/bookings?${params}`),
      ]);
      if (id === refreshId.current) {
        setRooms(r);
        setBookings(b);
      }
    } catch (e) {
      if (id === refreshId.current) setError(message(e));
    } finally {
      if (id === refreshId.current) setLoading(false);
    }
  }, [date, week, zone]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    const focus = () => {
      void refresh();
    };
    window.addEventListener("focus", focus);
    return () => window.removeEventListener("focus", focus);
  }, [refresh]);
  const selected = rooms.filter(
    (r) => roomFilter === "all" || r.id === roomFilter,
  );
  async function logout() {
    try {
      await api("/session", { method: "DELETE" }, user.csrf);
      onLogout();
    } catch (e) {
      setError(message(e));
    }
  }
  async function cancel() {
    if (!cancelling) return;
    setMutating(true);
    try {
      await api(
        `/bookings/${cancelling.id}/cancel`,
        { method: "POST" },
        user.csrf,
      );
      setCancelling(undefined);
      setNotice("Booking cancelled. The room is available again.");
      await refresh();
    } catch (e) {
      setError(message(e));
    } finally {
      setMutating(false);
    }
  }
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Brand />
        <div className="workspace-label">
          <span className="workspace-avatar">S</span>
          <div>
            Studio workspace
            <small>{config.demo ? "Local demo" : "Single workspace"}</small>
          </div>
        </div>
        <span className="nav-label">WORKSPACE</span>
        <nav aria-label="Main navigation">
          <button
            className={tab === "agenda" ? "active" : ""}
            onClick={() => setTab("agenda")}
          >
            <CalendarDays size={19} />
            Room planner
          </button>
          {config.demo && (
            <button
              className={tab === "lab" ? "active" : ""}
              onClick={() => setTab("lab")}
            >
              <FlaskConical size={19} />
              Concurrency lab<span className="new-label">TRY IT</span>
            </button>
          )}
          {user.role === "admin" && (
            <button
              className={tab === "activity" ? "active" : ""}
              onClick={() => setTab("activity")}
            >
              <Activity size={19} />
              Activity log
            </button>
          )}
        </nav>
        <div className="sidebar-note">
          <ShieldCheck size={23} />
          <strong>A promise, backed by data.</strong>
          <p>
            Overlapping reservations are checked by PostgreSQL, even when two
            people click at once.
          </p>
          {config.demo && (
            <button onClick={() => setTab("lab")}>
              See it happen <ArrowRight size={15} />
            </button>
          )}
        </div>
        <div className="profile">
          <span className="avatar">{user.display_name.charAt(0)}</span>
          <div>
            {user.display_name}
            <small>{user.role}</small>
          </div>
          <button aria-label="Sign out" title="Sign out" onClick={logout}>
            <LogOut size={17} />
          </button>
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <span>
            Workspace <ChevronRight size={14} />{" "}
            {tab === "agenda"
              ? "Room planner"
              : tab === "lab"
                ? "Concurrency lab"
                : "Activity log"}
          </span>
          <span className="connection">
            <i />
            {config.demo ? "Demo mode" : "Local workspace"}
          </span>
        </header>
        <div className="page-content">
          {error && (
            <div className="error" role="alert">
              {error}
              <button onClick={refresh}>Try again</button>
            </div>
          )}
          {notice && (
            <div className="success" role="status">
              {notice}
              <button
                aria-label="Dismiss notification"
                onClick={() => setNotice("")}
              >
                <X size={16} />
              </button>
            </div>
          )}
          {tab === "agenda" && (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">
                    YOUR NEXT GREAT IDEA STARTS HERE
                  </span>
                  <h1>
                    A space for every plan<span>.</span>
                  </h1>
                  <p>
                    A quiet conversation or the whole team. Find the room that
                    fits.
                  </p>
                </div>
                <button
                  className="primary"
                  onClick={() => setBookingRoom(rooms[0]?.id)}
                  disabled={!rooms.length}
                >
                  <Plus size={18} />
                  New booking
                </button>
              </div>
              <div className="stats-strip">
                <div>
                  <DoorOpen size={19} />
                  <strong>{rooms.length}</strong>
                  <span>shared spaces</span>
                </div>
                <div>
                  <CalendarDays size={19} />
                  <strong>{bookings.length}</strong>
                  <span>bookings in view</span>
                </div>
                <div>
                  <ShieldCheck size={19} />
                  <span>Conflict-aware booking</span>
                </div>
              </div>
              <section aria-label="Rooms" className="room-grid">
                {rooms.map((room) => (
                  <button
                    key={room.id}
                    className={`room-card ${room.color} ${roomFilter === room.id ? "selected" : ""}`}
                    onClick={() =>
                      setRoomFilter(roomFilter === room.id ? "all" : room.id)
                    }
                    aria-pressed={roomFilter === room.id}
                  >
                    <div className="room-art" aria-hidden="true">
                      <div className="mini-table" />
                      <div className="mini-chair one" />
                      <div className="mini-chair two" />
                      <div className="mini-chair three" />
                      <div className="mini-chair four" />
                      <span>0{rooms.indexOf(room) + 1}</span>
                    </div>
                    <div className="room-details">
                      <div>
                        <h2>{room.name}</h2>
                        <span>
                          <Users size={14} />
                          {room.capacity} people
                        </span>
                      </div>
                      <p>{room.description}</p>
                    </div>
                  </button>
                ))}
              </section>
              <section className="planner">
                <div className="planner-heading">
                  <div>
                    <h2>Your agenda</h2>
                    <p>
                      <Clock3 size={13} />
                      {zone.replaceAll("_", " ")}
                    </p>
                  </div>
                  <div className="planner-controls">
                    <button
                      aria-label="Previous day"
                      onClick={() =>
                        setDate(
                          DateTime.fromISO(date)
                            .minus({ days: week ? 7 : 1 })
                            .toISODate()!,
                        )
                      }
                    >
                      <ChevronLeft size={18} />
                    </button>
                    <label className="sr-only" htmlFor="agenda-date">
                      Agenda date
                    </label>
                    <input
                      id="agenda-date"
                      type="date"
                      value={date}
                      onChange={(e) =>
                        e.target.value && setDate(e.target.value)
                      }
                    />
                    <button
                      aria-label="Next day"
                      onClick={() =>
                        setDate(
                          DateTime.fromISO(date)
                            .plus({ days: week ? 7 : 1 })
                            .toISODate()!,
                        )
                      }
                    >
                      <ChevronRight size={18} />
                    </button>
                    <div className="segmented">
                      <button
                        aria-pressed={!week}
                        onClick={() => setWeek(false)}
                      >
                        Day
                      </button>
                      <button aria-pressed={week} onClick={() => setWeek(true)}>
                        7 days
                      </button>
                    </div>
                    <button
                      aria-label="Refresh agenda"
                      disabled={loading}
                      onClick={refresh}
                    >
                      <RefreshCw size={16} className={loading ? "spin" : ""} />
                    </button>
                  </div>
                </div>
                <div className="filter-line">
                  <button
                    className={roomFilter === "all" ? "chip chosen" : "chip"}
                    onClick={() => setRoomFilter("all")}
                  >
                    All rooms
                  </button>
                  {rooms.map((r) => (
                    <button
                      className={roomFilter === r.id ? "chip chosen" : "chip"}
                      key={r.id}
                      onClick={() => setRoomFilter(r.id)}
                    >
                      {r.name}
                    </button>
                  ))}
                  {user.role === "admin" && (
                    <button
                      className="text-button"
                      onClick={() => setAddingRoom(true)}
                    >
                      <Plus size={14} />
                      Add room
                    </button>
                  )}
                </div>
                {loading ? (
                  <p role="status" className="empty">
                    Refreshing availability…
                  </p>
                ) : (
                  <div className="agenda-list">
                    {selected.map((room) => {
                      const events = bookings.filter(
                        (b) => b.room_id === room.id,
                      );
                      return (
                        <div className="agenda-room" key={room.id}>
                          <div className={`room-label ${room.color}`}>
                            <span className="color-dot" />
                            <strong>{room.name}</strong>
                            <small>{room.capacity} seats</small>
                          </div>
                          <div className="room-events">
                            {events.length ? (
                              events.map((b) => (
                                <article className="booking" key={b.id}>
                                  <div>
                                    <span>
                                      {DateTime.fromISO(b.starts_at)
                                        .setZone(zone)
                                        .toFormat(
                                          week ? "ccc dd · HH:mm" : "HH:mm",
                                        )}{" "}
                                      —{" "}
                                      {DateTime.fromISO(b.ends_at)
                                        .setZone(zone)
                                        .toFormat("HH:mm")}
                                    </span>
                                    <h3>{b.title}</h3>
                                  </div>
                                  {b.can_cancel ? (
                                    <button
                                      className="text-button"
                                      onClick={() => setCancelling(b)}
                                    >
                                      Cancel
                                    </button>
                                  ) : (
                                    <span className="tag">Reserved</span>
                                  )}
                                </article>
                              ))
                            ) : (
                              <div className="open-slot">
                                <span>Room for something good.</span>
                                <button onClick={() => setBookingRoom(room.id)}>
                                  Book {room.name}
                                  <Plus size={15} />
                                </button>
                              </div>
                            )}
                          </div>
                          <button
                            className="add-slot"
                            aria-label={`Book ${room.name}`}
                            onClick={() => setBookingRoom(room.id)}
                          >
                            <Plus size={18} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
              <div className="bottom-caption">
                <span>
                  <ShieldCheck size={14} />
                  Availability can change. Your reservation is confirmed by the
                  server.
                </span>
                <span>SlotGuard / v{config.version}</span>
              </div>
            </>
          )}
          {tab === "lab" && <Lab user={user} zone={zone} />}
          {tab === "activity" && <History zone={zone} />}
        </div>
      </main>
      {bookingRoom && (
        <BookingDialog
          rooms={rooms}
          bookings={bookings}
          initialRoom={bookingRoom}
          date={date}
          zone={zone}
          user={user}
          onClose={() => setBookingRoom(undefined)}
          onRefresh={refresh}
          onDone={() => {
            setBookingRoom(undefined);
            setNotice("You’re booked. Make something good happen.");
            void refresh();
          }}
        />
      )}
      {addingRoom && (
        <RoomDialog
          user={user}
          onClose={() => setAddingRoom(false)}
          onDone={() => {
            setAddingRoom(false);
            void refresh();
          }}
        />
      )}
      {cancelling && (
        <Dialog
          title="Release this room?"
          onClose={() => !mutating && setCancelling(undefined)}
        >
          <p>
            Cancel “{cancelling.title}” and make this time available to someone
            else.
          </p>
          <div className="dialog-actions">
            <button
              disabled={mutating}
              onClick={() => setCancelling(undefined)}
            >
              Keep booking
            </button>
            <button className="primary" disabled={mutating} onClick={cancel}>
              Cancel booking
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
}

function Dialog({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className="dialog-heading">
        <h2>{title}</h2>
        <button aria-label="Close dialog" onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}

function BookingDialog({
  rooms,
  bookings,
  initialRoom,
  date,
  zone,
  user,
  onClose,
  onDone,
  onRefresh,
}: {
  rooms: Room[];
  bookings: Booking[];
  initialRoom: string;
  date: string;
  zone: string;
  user: User;
  onClose: () => void;
  onDone: () => void;
  onRefresh: () => Promise<void>;
}) {
  const [room, setRoom] = useState(initialRoom);
  const [day, setDay] = useState(date);
  const [start, setStart] = useState("10:00");
  const [duration, setDuration] = useState(60);
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  const [busy, setBusy] = useState(false);
  const retry = useRef({ body: "", key: "" });
  function localTime(d: string, t: string) {
    const input = `${d}T${t}`;
    const dt = DateTime.fromISO(input, { zone });
    if (
      !dt.isValid ||
      dt.toFormat("yyyy-MM-dd'T'HH:mm") !== input ||
      dt.getPossibleOffsets().length > 1
    )
      throw new Error(
        "This local time is ambiguous or does not exist. Choose another time.",
      );
    return dt;
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setConflict(false);
    try {
      const dt = localTime(day, start);
      const body = JSON.stringify({
        room_id: room,
        title: title.trim(),
        starts_at: dt.toISO(),
        ends_at: dt.plus({ minutes: duration }).toISO(),
      });
      if (retry.current.body !== body)
        retry.current = { body, key: crypto.randomUUID() };
      await api(
        "/bookings",
        {
          method: "POST",
          body,
          headers: { "Idempotency-Key": retry.current.key },
        },
        user.csrf,
      );
      onDone();
    } catch (e) {
      setError(message(e));
      if (e instanceof ApiError && e.status === 409) {
        setConflict(true);
        retry.current = { body: "", key: "" };
        await onRefresh();
      }
    } finally {
      setBusy(false);
    }
  }
  const suggestions: { room: string; name: string; time: string }[] = [];
  if (conflict && day === date) {
    try {
      const base = localTime(day, start);
      for (const offset of [0, 30, 60, 90, 120])
        for (const r of rooms) {
          const s = base.plus({ minutes: offset });
          const e = s.plus({ minutes: duration });
          if (
            s.toISODate() !== day ||
            e.toISODate() !== day ||
            s <= DateTime.now()
          )
            continue;
          if (r.id === room && offset === 0) continue;
          if (
            !bookings.some(
              (b) =>
                b.room_id === r.id &&
                DateTime.fromISO(b.starts_at) < e &&
                DateTime.fromISO(b.ends_at) > s,
            )
          )
            suggestions.push({
              room: r.id,
              name: r.name,
              time: s.toFormat("HH:mm"),
            });
        }
    } catch {
      /* Form validation displays an explanation when submitted. */
    }
  }
  return (
    <Dialog title="Make a little room." onClose={() => !busy && onClose()}>
      <p className="muted">
        Your reservation is confirmed only when the room is yours.
      </p>
      <form onSubmit={submit}>
        <label>
          Meeting title
          <input
            autoFocus
            required
            maxLength={100}
            placeholder="What are we making space for?"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label>
          Room
          <select value={room} onChange={(e) => setRoom(e.target.value)}>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} · {r.capacity} people
              </option>
            ))}
          </select>
        </label>
        <div className="form-row">
          <label>
            Date
            <input
              required
              type="date"
              value={day}
              onChange={(e) => setDay(e.target.value)}
            />
          </label>
          <label>
            Start time
            <input
              required
              type="time"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </label>
          <label>
            Duration
            <select
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
            >
              {[15, 30, 60, 90, 120].map((n) => (
                <option key={n} value={n}>
                  {n} minutes
                </option>
              ))}
            </select>
          </label>
        </div>
        <small className="zone-note">
          <Clock3 size={13} />
          {zone}
        </small>
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        {conflict && suggestions.length > 0 && (
          <div className="alternatives">
            <strong>A little flexibility goes a long way.</strong>
            <p>Available in the refreshed view; checked again when you book.</p>
            {suggestions.slice(0, 3).map((s, i) => (
              <button
                type="button"
                key={i}
                onClick={() => {
                  setRoom(s.room);
                  setStart(s.time);
                  setConflict(false);
                  setError("");
                }}
              >
                {s.name} at {s.time}
                <ArrowRight size={14} />
              </button>
            ))}
          </div>
        )}
        {conflict && day !== date && (
          <p>
            Close this form and select this date in the planner to see
            alternatives.
          </p>
        )}
        <div className="dialog-actions">
          <button type="button" disabled={busy} onClick={onClose}>
            Not now
          </button>
          <button className="primary" disabled={busy || !title.trim()}>
            {busy ? "Checking your space…" : "Confirm booking"}
            <ArrowRight size={16} />
          </button>
        </div>
      </form>
    </Dialog>
  );
}

function RoomDialog({
  user,
  onClose,
  onDone,
}: {
  user: User;
  onClose: () => void;
  onDone: () => void;
}) {
  const [name, setName] = useState("");
  const [capacity, setCapacity] = useState(4);
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api(
        "/rooms",
        {
          method: "POST",
          body: JSON.stringify({ name, capacity, description }),
        },
        user.csrf,
      );
      onDone();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog title="Add a shared space" onClose={() => !busy && onClose()}>
      <form onSubmit={submit}>
        <label>
          Room name
          <input
            autoFocus
            required
            maxLength={60}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label>
          Seats
          <input
            required
            type="number"
            min={1}
            max={100}
            value={capacity}
            onChange={(e) => setCapacity(Number(e.target.value))}
          />
        </label>
        <label>
          Description
          <input
            maxLength={200}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <button className="primary full" disabled={busy}>
          Create room
        </button>
      </form>
    </Dialog>
  );
}

function Lab({ user, zone }: { user: User; zone: string }) {
  const [busy, setBusy] = useState(false);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [confirmed, setConfirmed] = useState<number>();
  const [scenario, setScenario] = useState<Scenario>();
  const [error, setError] = useState("");
  async function run() {
    setBusy(true);
    setAttempts([]);
    setConfirmed(undefined);
    setError("");
    try {
      const s = await api<Scenario>(
        "/demo/scenarios",
        { method: "POST" },
        user.csrf,
      );
      setScenario(s);
      const results = await Promise.all(
        s.tokens.map(async (token, index) => {
          const began = performance.now();
          const response = await fetch(`/api/demo/scenarios/${s.id}/book`, {
            method: "POST",
            headers: { "X-Demo-Token": token },
          });
          const body = await response.json();
          return {
            actor: index === 0 ? "Contender A" : "Contender B",
            code: response.status,
            detail: response.ok
              ? "Booking confirmed"
              : body.detail || "Request failed",
            ms: Math.round(performance.now() - began),
          };
        }),
      );
      setAttempts(results);
      const result = await api<{ confirmed: unknown[] }>(
        `/demo/scenarios/${s.id}`,
      );
      setConfirmed(result.confirmed.length);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  const passed =
    confirmed === 1 &&
    attempts.some((a) => a.code === 201) &&
    attempts.some((a) => a.code === 409);
  return (
    <section className="lab">
      <div className="page-heading">
        <div>
          <span className="eyebrow">THE DOUBLE-BOOKING CHALLENGE</span>
          <h1>
            Two requests.
            <br />
            One shared space<span>.</span>
          </h1>
          <p>
            Good interfaces handle success. Thoughtful ones handle the race.
          </p>
        </div>
        <span className="lab-emblem">
          <FlaskConical size={48} strokeWidth={1.2} />
        </span>
      </div>
      <div className="lab-intro">
        <span className="pill">REAL HTTP · REAL POSTGRESQL</span>
        <p>
          Send two independent requests for the same interval. The database
          chooses the winner. Then we read back the confirmed reservations.
        </p>
      </div>
      <div className="race-stage">
        {[0, 1].map((i) => {
          const a = attempts[i];
          return (
            <div
              key={i}
              className={`contender ${a?.code === 201 ? "won" : a ? "lost" : ""}`}
            >
              <span className="contender-avatar">{i === 0 ? "A" : "B"}</span>
              <span className="eyebrow">CONTENDER {i === 0 ? "A" : "B"}</span>
              <h2>
                {busy
                  ? "Request in flight…"
                  : a
                    ? a.code === 201
                      ? "The room is yours."
                      : "This slot was taken."
                    : "Ready to book."}
              </h2>
              <p>
                {a?.detail || "Same room. Same interval. A different request."}
              </p>
              {a && (
                <code>
                  HTTP {a.code} · {a.ms} ms
                </code>
              )}
            </div>
          );
        })}
        <div className="race-center">
          <DoorOpen size={24} />
          <strong>Challenge room</strong>
          <small>
            {scenario
              ? DateTime.fromISO(scenario.starts_at)
                  .setZone(zone)
                  .toFormat("ccc, dd LLL · HH:mm")
              : "An isolated, synthetic room"}
          </small>
        </div>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="race-actions">
        <button className="primary" disabled={busy} onClick={run}>
          {busy ? (
            <RefreshCw size={18} className="spin" />
          ) : (
            <FlaskConical size={18} />
          )}
          {busy
            ? "Running challenge…"
            : attempts.length
              ? "Run a new challenge"
              : "Run the challenge"}
        </button>
        <span>
          Each run gets its own room. Your real agenda stays separate.
        </span>
      </div>
      {confirmed !== undefined && (
        <div role="status" className={passed ? "race-result" : "error"}>
          <ShieldCheck size={24} />
          <div>
            <strong>
              {passed
                ? "One confirmed booking. Verified in the database."
                : "Unexpected result — inspect the responses."}
            </strong>
            <p>
              {confirmed} confirmed row{confirmed === 1 ? "" : "s"} ·{" "}
              {attempts.map((a) => a.code).join(" + ")} · No predetermined
              winner.
            </p>
          </div>
        </div>
      )}
      <div className="explain-grid">
        <article>
          <span>01</span>
          <h3>The UI asks.</h3>
          <p>
            Availability is a snapshot. Two people can see the same open slot.
          </p>
        </article>
        <article>
          <span>02</span>
          <h3>The database decides.</h3>
          <p>
            An exclusion constraint prevents overlapping confirmed intervals for
            one room.
          </p>
        </article>
        <article>
          <span>03</span>
          <h3>The product helps.</h3>
          <p>
            A conflict is a chance to offer another time or room, not a dead
            end.
          </p>
        </article>
      </div>
      <p className="footnote">
        Observed request times include local browser and server work. This is a
        correctness demonstration, not a performance benchmark. Challenges
        expire after 15 minutes and are cleaned up when the next one starts.
      </p>
    </section>
  );
}

function History({ zone }: { zone: string }) {
  const [rows, setRows] = useState<Audit[]>([]);
  const [error, setError] = useState("");
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    api<Audit[]>(`/audit?offset=${offset}`)
      .then(setRows)
      .catch((e) => setError(message(e)));
  }, [offset]);
  return (
    <section>
      <div className="page-heading">
        <div>
          <span className="eyebrow">A LITTLE CONTEXT GOES A LONG WAY</span>
          <h1>
            Every change has a story<span>.</span>
          </h1>
          <p>
            Who changed what, and when. Demo races are kept out of this history.
          </p>
        </div>
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <div className="history">
        {rows.length ? (
          rows.map((r) => (
            <article key={r.id}>
              <span className="avatar">
                <Activity size={18} />
              </span>
              <div>
                <strong>{r.actor}</strong>
                <p>
                  {r.action.replaceAll(".", " ")} · {r.room || "Workspace"}
                </p>
              </div>
              <time>
                {DateTime.fromISO(r.created_at)
                  .setZone(zone)
                  .toFormat("dd LLL, HH:mm")}
              </time>
            </article>
          ))
        ) : (
          <p className="empty">
            Your workspace history starts with the first change.
          </p>
        )}
      </div>
      <div className="dialog-actions">
        <button
          disabled={offset === 0}
          onClick={() => setOffset(Math.max(0, offset - 50))}
        >
          Newer
        </button>
        <button
          disabled={rows.length < 50}
          onClick={() => setOffset(offset + 50)}
        >
          Older
        </button>
      </div>
    </section>
  );
}

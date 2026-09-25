// Standalone browser simulation. It never opens a network connection.
export class DemoError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export class DemoStore {
  constructor() { this.reset(); }
  reset() {
    this.actor = 'alice'; this.bookings = []; this.audit = []; this.keys = new Map(); this.scenario = null;
    this.rooms = [
      { id: 'room-1', name: 'The Studio', capacity: 6, description: 'Space for your next big idea.', color: 'sage' },
      { id: 'room-2', name: 'The Nook', capacity: 2, description: 'A quiet corner for focused conversations.', color: 'peach' },
      { id: 'room-3', name: 'The Workshop', capacity: 12, description: 'Bring the whole team together.', color: 'blue' },
    ];
    const tomorrow = new Date(); tomorrow.setUTCDate(tomorrow.getUTCDate() + 1); tomorrow.setUTCHours(13, 0, 0, 0);
    this.bookings.push({ id: crypto.randomUUID(), room_id: 'room-1', room_name: 'The Studio',
      title: 'Team planning · sample', starts_at: tomorrow.toISOString(),
      ends_at: new Date(+tomorrow + 3600000).toISOString(), owner: 'bob' });
  }
  user() {
    if (!this.actor) throw new DemoError(401, 'Choose a demo persona.');
    return { id: this.actor, display_name: this.actor === 'admin' ? 'Demo Admin' : this.actor === 'alice' ? 'Alice Chen' : 'Bob Rivera', role: this.actor === 'admin' ? 'admin' : 'member', csrf: 'browser-demo' };
  }
  log(action, room) { this.audit.unshift({ id: this.audit.length + 1, actor: this.user().display_name, action, room, created_at: new Date().toISOString() }); }
  reserve(body, key = '') {
    const user = this.user(), room = this.rooms.find(r => r.id === body.room_id);
    const start = +new Date(body.starts_at), end = +new Date(body.ends_at);
    if (!room || !body.title?.trim() || body.title.length > 100 || !Number.isFinite(start) || !Number.isFinite(end) || start <= Date.now() || end <= start || end - start > 8 * 3600000) throw new DemoError(422, 'Choose a room, a title and a future interval of up to eight hours.');
    const payload = JSON.stringify({ ...body, starts_at: new Date(start).toISOString(), ends_at: new Date(end).toISOString() });
    const scope = `${user.id}:${key}`;
    if (key && this.keys.has(scope)) {
      const prior = this.keys.get(scope);
      if (prior.payload !== payload) throw new DemoError(409, 'This demo key was already used with different input.');
      return structuredClone(prior.result);
    }
    if (this.bookings.some(b => b.room_id === room.id && +new Date(b.starts_at) < end && +new Date(b.ends_at) > start)) throw new DemoError(409, 'This time is already reserved. Try another room or time.');
    if (this.bookings.length >= 100) throw new DemoError(422, 'Demo limit reached. Reload to reset.');
    const booking = { ...body, id: crypto.randomUUID(), title: body.title.trim(), room_name: room.name, owner: user.id };
    this.bookings.push(booking); this.log('booking.created', room.name);
    const result = structuredClone(booking);
    if (key) this.keys.set(scope, { payload, result });
    return result;
  }
  handle(path, options = {}) {
    const url = new URL(path, 'https://demo.invalid'), route = url.pathname, method = options.method || 'GET';
    const body = options.body ? JSON.parse(options.body) : {};
    if (route === '/public-config') return { demo: true, timezone: 'America/Argentina/Buenos_Aires', version: '0.1 · browser demo' };
    if (route === '/session' && method === 'POST') {
      if (!['alice', 'bob', 'admin'].includes(body.username)) throw new DemoError(422, 'Choose Alice, Bob or Admin.');
      this.actor = body.username; return this.user();
    }
    if (route === '/session' && method === 'DELETE') { this.actor = null; return; }
    if (route === '/me') return this.user();
    const user = this.user();
    if (route === '/rooms' && method === 'GET') return structuredClone(this.rooms);
    if (route === '/rooms' && method === 'POST') {
      if (user.role !== 'admin') throw new DemoError(403, 'Switch to Admin to add a room.');
      if (!body.name?.trim() || body.name.length > 60 || !Number.isInteger(body.capacity) || body.capacity < 1 || body.capacity > 100 || this.rooms.length >= 12) throw new DemoError(422, 'Enter a name and 1–100 seats. Demo limit: 12 rooms.');
      const room = { ...body, name: body.name.trim(), id: crypto.randomUUID(), color: 'sage' };
      this.rooms.push(room); this.log('room.created', room.name); return structuredClone(room);
    }
    if (route === '/bookings' && method === 'GET') {
      const start = +new Date(url.searchParams.get('start')), end = +new Date(url.searchParams.get('end'));
      return this.bookings.filter(b => +new Date(b.starts_at) < end && +new Date(b.ends_at) > start).map(b => ({ ...b, can_cancel: user.role === 'admin' || b.owner === user.id }));
    }
    if (route === '/bookings' && method === 'POST') return this.reserve(body, new Headers(options.headers).get('Idempotency-Key') || '');
    const cancel = route.match(/^\/bookings\/([^/]+)\/cancel$/);
    if (cancel && method === 'POST') {
      const booking = this.bookings.find(b => b.id === cancel[1]);
      if (!booking) throw new DemoError(404, 'Booking not found.');
      if (booking.owner !== user.id && user.role !== 'admin') throw new DemoError(403, 'You can cancel only your own demo bookings.');
      this.bookings = this.bookings.filter(b => b.id !== booking.id); this.log('booking.cancelled', booking.room_name); return;
    }
    if (route === '/audit') {
      if (user.role !== 'admin') throw new DemoError(403, 'Switch to Admin to inspect activity.');
      const offset = Number(url.searchParams.get('offset') || 0); return structuredClone(this.audit.slice(offset, offset + 50));
    }
    if (route === '/demo/scenarios' && method === 'POST') {
      this.scenario = { id: crypto.randomUUID(), tokens: [crypto.randomUUID(), crypto.randomUUID()], confirmed: [], starts_at: new Date(Date.now() + 3600000).toISOString(), ends_at: new Date(Date.now() + 4500000).toISOString() };
      return structuredClone(this.scenario);
    }
    if (route === `/demo/scenarios/${this.scenario?.id}`) return { confirmed: structuredClone(this.scenario.confirmed) };
    throw new DemoError(404, 'This route is not available in the browser demo.');
  }
  challenge(id, token) {
    if (!this.scenario || this.scenario.id !== id || !this.scenario.tokens.includes(token)) throw new DemoError(404, 'Start a new demo challenge.');
    if (this.scenario.confirmed.length) return { status: 409, detail: 'Simulated conflict: slot already taken' };
    this.scenario.confirmed.push({ id: crypto.randomUUID() });
    return { status: 201, detail: 'Simulated booking confirmed' };
  }
}
export const store = new DemoStore();

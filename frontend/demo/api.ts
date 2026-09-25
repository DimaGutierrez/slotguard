import { store, DemoError } from './engine.mjs';
export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export async function api<T>(path: string, options: RequestInit = {}, _csrf = ''): Promise<T> {
  try { return store.handle(path, options) as T; }
  catch (error) {
    if (error instanceof DemoError) throw new ApiError(error.status, error.message);
    throw error;
  }
}
export async function demoFetch(path: string, options: RequestInit): Promise<Response> {
  const match = path.match(/^\/api\/demo\/scenarios\/([^/]+)\/book$/);
  if (!match) throw new Error('No external requests are supported.');
  // Artificial delay varies the winner for illustration, not real database concurrency.
  await new Promise(resolve => setTimeout(resolve, 120 + Math.random() * 350));
  const result = store.challenge(match[1], new Headers(options.headers).get('X-Demo-Token') || '');
  return new Response(JSON.stringify({ detail: result.detail }), { status: result.status, headers: { 'Content-Type': 'application/json' } });
}

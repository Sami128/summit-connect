import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { linkSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { Session as SupabaseAuthSession } from '@supabase/supabase-js';
import { ApiError } from './errors';
import { createSupabase, dataMode } from './supabase';
import { getData } from './store';
import type { Session } from './types';

const DEMO_COOKIE = 'summit_demo';
const ACCESS_COOKIE = 'summit_access';
const REFRESH_COOKIE = 'summit_refresh';
declare global {
  var summitDemoSecret: string | undefined;
  var summitDemoSecretFile: string | undefined;
  var summitRefreshes: Map<string, { expiresAt: number; promise: Promise<SupabaseAuthSession | null> }> | undefined;
}
const pendingCookies = new WeakMap<Request, string[]>();

export function demoEnabled(): boolean {
  if (process.env.DEMO_MODE === 'true') return true;
  if (process.env.DEMO_MODE === 'false') return false;
  // Local role/name entry needs no accounts or external API credentials.
  // Shared production storage keeps verified authentication as its default.
  return process.env.NODE_ENV !== 'production' || dataMode() === 'local';
}

function secret(): string {
  if (process.env.DEMO_SESSION_SECRET) return process.env.DEMO_SESSION_SECRET;
  if (process.env.VERCEL) throw new ApiError(503, 'Session signing is not configured. Ask your administrator to check the server environment.');
  const directory = path.resolve(process.env.LOCAL_DATA_DIR || path.join(process.cwd(), '.data'));
  const file = path.join(directory, '.demo-secret');
  if (globalThis.summitDemoSecret && globalThis.summitDemoSecretFile === file) return globalThis.summitDemoSecret;
  try {
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    try { globalThis.summitDemoSecret = readFileSync(file, 'utf8').trim(); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      const generated = globalThis.summitDemoSecret || randomBytes(32).toString('hex');
      const temporary = `${file}.${randomUUID()}.tmp`;
      writeFileSync(temporary, generated, { mode: 0o600, flag: 'wx' });
      try {
        // Link a fully written file without overwriting another process's winning secret.
        try { linkSync(temporary, file); }
        catch (linkError) { if ((linkError as NodeJS.ErrnoException).code !== 'EEXIST') throw linkError; }
      } finally { unlinkSync(temporary); }
      globalThis.summitDemoSecret = readFileSync(file, 'utf8').trim();
    }
    if (!globalThis.summitDemoSecret || globalThis.summitDemoSecret.length < 32) throw new Error('Invalid local signing secret');
    globalThis.summitDemoSecretFile = file;
    return globalThis.summitDemoSecret;
  } catch { throw new ApiError(503, 'Session storage is unavailable. Please try again or contact your administrator.'); }
}

export function signDemoIdentity(employeeId: string): string {
  const encoded = Buffer.from(employeeId).toString('base64url');
  return `${encoded}.${createHmac('sha256', secret()).update(encoded).digest('base64url')}`;
}

export function verifyDemoIdentity(value: string): string {
  const [encoded, signature, extra] = value.split('.');
  if (!encoded || !signature || extra) throw new ApiError(401, 'Your session has expired. Please select your role and name again.');
  const expected = createHmac('sha256', secret()).update(encoded).digest();
  const actual = Buffer.from(signature, 'base64url');
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) throw new ApiError(401, 'Your session has expired. Please select your role and name again.');
  return Buffer.from(encoded, 'base64url').toString('utf8');
}

function requestCookies(request: Request): Map<string, string> {
  return new Map((request.headers.get('cookie') || '').split(';').map(part => {
    const index = part.indexOf('=');
    return index < 0 ? ['', ''] : [part.slice(0, index).trim(), part.slice(index + 1).trim()];
  }));
}

function cookie(request: Request, name: string, value: string, maxAge: number): string {
  const isSecure = new URL(request.url).protocol === 'https:' || request.headers.get('x-forwarded-proto') === 'https';
  return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${isSecure ? '; Secure' : ''}`;
}

function queueCookie(request: Request, value: string): void {
  pendingCookies.set(request, [...(pendingCookies.get(request) || []), value]);
}

export function withAuthCookies(request: Request, response: Response): Response {
  for (const value of pendingCookies.get(request) || []) response.headers.append('set-cookie', value);
  pendingCookies.delete(request);
  return response;
}

export function verifyMutation(request: Request): void {
  const origin = request.headers.get('origin');
  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite === 'cross-site') throw new ApiError(403, 'This request must originate from the Summit application.');
  if (origin) {
    const expected = new URL(request.url);
    const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || expected.host;
    if (new URL(origin).host !== host) throw new ApiError(403, 'This request must originate from the Summit application.');
  }
}

export async function requireSession(request: Request): Promise<Session> {
  const cookies = requestCookies(request);
  if (demoEnabled()) {
    const identity = cookies.get(DEMO_COOKIE);
    if (!identity) throw new ApiError(401, 'Select your role and name to enter your workspace.');
    const employeeId = verifyDemoIdentity(identity);
    const data = await getData();
    const employee = data.employees.find(e => e.id === employeeId);
    if (!employee) throw new ApiError(401, 'Your name could not be found. Please select your role and name again.');
    return { employeeId, role: employee.accessRole, demo: true };
  }
  if (dataMode() !== 'supabase') throw new ApiError(503, 'Sign-in is not configured. Ask your administrator to check shared storage.');
  const authorization = request.headers.get('authorization');
  let accessToken = authorization?.startsWith('Bearer ') ? authorization.slice(7) : cookies.get(ACCESS_COOKIE);
  if (!accessToken) throw new ApiError(401, 'Sign in to your Summit account to continue.');
  let auth = await createSupabase().auth.getUser(accessToken);
  if (auth.error && !authorization && cookies.get(REFRESH_COOKIE)) {
    const refreshed = await refreshAuthentication(cookies.get(REFRESH_COOKIE)!);
    if (refreshed) {
      accessToken = refreshed.access_token;
      setAuthCookies(request, refreshed);
      auth = await createSupabase().auth.getUser(accessToken);
    }
  }
  if (auth.error || !auth.data.user) throw new ApiError(401, 'Your session expired. Please sign in again.');
  const { data: mapping, error: mappingError } = await createSupabase().from('employee_auth').select('employee_id, employees(access_role)').eq('user_id', auth.data.user.id).maybeSingle();
  if (mappingError) throw new ApiError(503, 'Your employee record is temporarily unavailable.');
  if (!mapping) throw new ApiError(403, 'Your account has not been linked to an employee record. Contact your administrator.');
  const employeeRow = Array.isArray(mapping.employees) ? mapping.employees[0] : mapping.employees;
  const role = (employeeRow as {access_role?: string} | null)?.access_role;
  if (role !== 'manager' && role !== 'employee') throw new ApiError(403, 'Your account does not have an active employee role.');
  return { employeeId: mapping.employee_id, role, demo: false };
}

export const getSession = requireSession;

async function refreshAuthentication(refreshToken: string): Promise<SupabaseAuthSession | null> {
  // Concurrent bootstrap/chat requests can arrive with the same expiring cookie.
  // Reuse a single rotation result briefly so a slower response cannot overwrite newer cookies.
  const refreshes = globalThis.summitRefreshes ??= new Map();
  const now = Date.now();
  const key = createHash('sha256').update(refreshToken).digest('hex');
  const cached = refreshes.get(key);
  if (cached && cached.expiresAt > now) return cached.promise;
  for (const [token, result] of refreshes) if (result.expiresAt <= now) refreshes.delete(token);
  if (refreshes.size >= 1000) throw new ApiError(429, 'Session renewal is busy. Please retry shortly.');
  const promise = createSupabase().auth.refreshSession({ refresh_token: refreshToken }).then(result => result.error ? null : result.data.session).catch(() => null);
  refreshes.set(key, { expiresAt: now + 15_000, promise });
  return promise;
}

export function setDemoCookie(request: Request, employeeId: string): void {
  queueCookie(request, cookie(request, DEMO_COOKIE, signDemoIdentity(employeeId), 60 * 60 * 24 * 7));
}

export function setAuthCookies(request: Request, session: {access_token: string; refresh_token: string; expires_in?: number}): void {
  // Keep expired access cookies long enough for server-side refresh on the next request.
  queueCookie(request, cookie(request, ACCESS_COOKIE, session.access_token, 60 * 60 * 24 * 7));
  queueCookie(request, cookie(request, REFRESH_COOKIE, session.refresh_token, 60 * 60 * 24 * 7));
}

export function clearSessionCookies(request: Request): void {
  for (const name of [DEMO_COOKIE, ACCESS_COOKIE, REFRESH_COOKIE]) queueCookie(request, cookie(request, name, '', 0));
}

const loginAttempts = new Map<string, { count: number; resetAt: number }>();
export function limitLogin(request: Request): void {
  const key = (request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'local').slice(0, 128);
  const now = Date.now();
  for (const [id, item] of loginAttempts) if (item.resetAt <= now) loginAttempts.delete(id);
  const attempt = loginAttempts.get(key);
  if (attempt && attempt.resetAt > now && attempt.count >= 12) throw new ApiError(429, 'Too many sign-in attempts. Try again in a few minutes.');
  if (!attempt && loginAttempts.size >= 1000) throw new ApiError(429, 'Sign-in is busy. Please try again shortly.');
  loginAttempts.set(key, { count: attempt && attempt.resetAt > now ? attempt.count + 1 : 1, resetAt: attempt && attempt.resetAt > now ? attempt.resetAt : now + 300_000 });
}

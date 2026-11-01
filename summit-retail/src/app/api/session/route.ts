import { clearSessionCookies, demoEnabled, limitLogin, requireSession, setAuthCookies, setDemoCookie, verifyMutation, withAuthCookies } from '@/lib/auth';
import { ApiError, toErrorResponse } from '@/lib/errors';
import { getData } from '@/lib/store';
import { createSupabase } from '@/lib/supabase';
import { readJson, text } from '@/lib/validation';
import type { Session } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function existingDemoSession(request: Request): Promise<Session | null> {
  try { return await requireSession(request); }
  catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}

export async function GET(request: Request): Promise<Response> {
  try {
    // Only an explicitly enabled synthetic demo exposes its fictional name picker.
    if (!demoEnabled()) return Response.json({ demo: false, identities: [], stores: [] }, { headers: { 'Cache-Control': 'no-store' } });
    const actor = await existingDemoSession(request);
    const requestedPortal = new URL(request.url).searchParams.get('portal');
    if (requestedPortal && requestedPortal !== 'manager' && requestedPortal !== 'employee') throw new ApiError(400, 'Choose a valid workspace.');
    const portal = actor?.role === 'employee' ? 'employee' : requestedPortal || 'manager';
    const data = await getData();
    const identities = data.employees.filter(employee => employee.accessRole === portal).map(({ id, name, role, storeId, accessRole }) => ({ id, name, role, storeId, accessRole }));
    return Response.json({ demo: true, identities, stores: data.stores }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const response = toErrorResponse(error);
    response.headers.set('Cache-Control', 'no-store');
    return response;
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    verifyMutation(request);
    const input = await readJson(request);
    if (demoEnabled()) {
      const employeeId = text(input.employeeId, 'Employee', 1, 80);
      const data = await getData();
      const employee = data.employees.find(e => e.id === employeeId);
      if (!employee) throw new ApiError(404, 'Your name could not be found. Please choose it from the list.');
      const actor = await existingDemoSession(request);
      if (actor?.role === 'employee' && employee.accessRole === 'manager') throw new ApiError(403, 'Associates cannot open manager workspaces.');
      setDemoCookie(request, employeeId);
    } else {
      limitLogin(request);
      const email = text(input.email, 'Email address', 3, 254);
      if (typeof input.password !== 'string' || input.password.length < 1 || input.password.length > 256) throw new ApiError(400, 'Password must be between 1 and 256 characters.');
      const password = input.password;
      const { data, error } = await createSupabase().auth.signInWithPassword({ email, password });
      if (error || !data.session) throw new ApiError(401, 'Email or password is incorrect. Please try again.');
      setAuthCookies(request, data.session);
    }
    return withAuthCookies(request, Response.json({ ok: true }));
  } catch (error) { return withAuthCookies(request, toErrorResponse(error)); }
}

export async function DELETE(request: Request): Promise<Response> {
  try {
    verifyMutation(request);
    clearSessionCookies(request);
    return withAuthCookies(request, Response.json({ ok: true }));
  } catch (error) { return toErrorResponse(error); }
}

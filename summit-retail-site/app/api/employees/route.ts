import { requireSession, verifyMutation, withAuthCookies } from '@/lib/auth';
import { addEmployee } from '@/lib/store';
import { toErrorResponse } from '@/lib/errors';
import { readJson } from '@/lib/validation';

export const runtime = 'nodejs';
export async function POST(request: Request): Promise<Response> {
  try {
    verifyMutation(request);
    const session = await requireSession(request);
    const employee = await addEmployee(await readJson(request), session);
    return withAuthCookies(request, Response.json(employee, { status: 201 }));
  } catch (error) { return withAuthCookies(request, toErrorResponse(error)); }
}

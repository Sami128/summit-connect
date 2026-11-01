import { requireSession, withAuthCookies } from '@/lib/auth';
import { getBootstrap } from '@/lib/store';
import { toErrorResponse } from '@/lib/errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  try {
    const session = await requireSession(request);
    return withAuthCookies(request, Response.json(await getBootstrap(session), { headers: { 'Cache-Control': 'private, no-store, max-age=0', Vary: 'Cookie, Authorization' } }));
  } catch (error) { return withAuthCookies(request, toErrorResponse(error)); }
}

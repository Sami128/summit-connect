import { requireSession, verifyMutation, withAuthCookies } from '@/lib/auth';
import { toErrorResponse } from '@/lib/errors';
import { addTopic } from '@/lib/store';
import { readJson } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  try {
    verifyMutation(request);
    const session = await requireSession(request);
    const topic = await addTopic(await readJson(request), session);
    return withAuthCookies(request, Response.json(topic, { status: 201, headers: { 'Cache-Control': 'no-store' } }));
  } catch (error) {
    const response = withAuthCookies(request, toErrorResponse(error));
    response.headers.set('Cache-Control', 'no-store');
    return response;
  }
}

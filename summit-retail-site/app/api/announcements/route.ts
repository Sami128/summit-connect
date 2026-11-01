import { requireSession, verifyMutation, withAuthCookies } from '@/lib/auth';
import { addAnnouncement } from '@/lib/store';
import { toErrorResponse } from '@/lib/errors';
import { readJson } from '@/lib/validation';

export const runtime = 'nodejs';
export async function POST(request: Request): Promise<Response> {
  try {
    verifyMutation(request);
    const session = await requireSession(request);
    const announcement = await addAnnouncement(await readJson(request), session);
    return withAuthCookies(request, Response.json(announcement, { status: 201 }));
  } catch (error) { return withAuthCookies(request, toErrorResponse(error)); }
}

import { requireSession, verifyMutation, withAuthCookies } from '@/lib/auth';
import { recordReceipt } from '@/lib/store';
import { ApiError, toErrorResponse } from '@/lib/errors';
import { readJson, text } from '@/lib/validation';

export const runtime = 'nodejs';
export async function POST(request: Request): Promise<Response> {
  try {
    verifyMutation(request);
    const session = await requireSession(request);
    const input = await readJson(request);
    const announcementId = text(input.announcementId, 'Announcement', 1, 100);
    if (input.action !== 'read' && input.action !== 'acknowledge') throw new ApiError(400, 'Choose a valid receipt action.');
    return withAuthCookies(request, Response.json(await recordReceipt(announcementId, input.action, session)));
  } catch (error) { return withAuthCookies(request, toErrorResponse(error)); }
}

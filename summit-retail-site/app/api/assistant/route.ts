import { getSession, verifyMutation, withAuthCookies } from '@/lib/auth';
import { validateConversationHistory } from '@/lib/conversation';
import { toErrorResponse } from '@/lib/errors';
import { answerTopicQuestion, resolveAssistantTopic } from '@/lib/topic-assistant';
import { getBootstrap } from '@/lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Prototype per-instance limiter. A shared limiter is needed for multi-instance production.
const attempts = new Map<string, { count: number; resetAt: number }>();
export async function POST(request: Request): Promise<Response> {
  const respond = (response: Response) => withAuthCookies(request, response);
  try {
    verifyMutation(request);
    const session = await getSession(request);
    const now = Date.now();
    for (const [id, value] of attempts) if (value.resetAt <= now) attempts.delete(id);
    const current = attempts.get(session.employeeId);
    if (!current && attempts.size >= 2000) return respond(Response.json({ error: 'Topic assistance is busy. Please try again shortly.' }, { status: 429, headers: { 'Retry-After': '60', 'Cache-Control': 'no-store' } }));
    const rate = !current || current.resetAt <= now ? { count: 0, resetAt: now + 60000 } : current;
    if (rate.count >= 15) return respond(Response.json({ error: 'Please wait a moment before asking another question.' }, { status: 429, headers: { 'Retry-After': String(Math.max(1, Math.ceil((rate.resetAt - now) / 1000))), 'Cache-Control': 'no-store' } }));
    rate.count += 1;
    attempts.set(session.employeeId, rate);
    const raw = await request.text();
    if (new TextEncoder().encode(raw).length > 131072) return respond(Response.json({ error: 'Please send your message in smaller parts.' }, { status: 413 }));
    let payload: unknown;
    try { payload = JSON.parse(raw); } catch { return respond(Response.json({ error: 'Send a valid JSON question.' }, { status: 400 })); }
    const question = payload && typeof payload === 'object' && 'question' in payload ? payload.question : undefined;
    if (typeof question !== 'string' || question.trim().length < 1 || question.trim().length > 16000) return respond(Response.json({ error: 'Please enter your question. For a very long message, send it in parts.' }, { status: 400 }));
    const topicId = payload && typeof payload === 'object' && 'topicId' in payload ? payload.topicId : undefined;
    const available = await getBootstrap(session);
    const topic = resolveAssistantTopic(available.topics, topicId);
    const announcementId = payload && typeof payload === 'object' && 'announcementId' in payload ? payload.announcementId : undefined;
    if (announcementId !== undefined && (typeof announcementId !== 'string' || !announcementId.trim() || announcementId.length > 120)) return respond(Response.json({ error: 'Choose a valid announcement.' }, { status: 400 }));
    const announcement = announcementId === undefined ? undefined : available.announcements.find(item => item.id === announcementId);
    if (announcementId !== undefined && !announcement) return respond(Response.json({ error: 'This announcement is not available.' }, { status: 404 }));
    if (announcement && announcement.topicId !== topic.id) return respond(Response.json({ error: 'This announcement belongs to a different topic.' }, { status: 400 }));
    const history = validateConversationHistory(payload && typeof payload === 'object' && 'history' in payload ? payload.history : undefined);
    return respond(Response.json(await answerTopicQuestion(topic, question, { history, announcement: announcement ? { id: announcement.id, title: announcement.title, body: announcement.body } : undefined }), { headers: { 'Cache-Control': 'no-store' } }));
  } catch (error) {
    return respond(toErrorResponse(error));
  }
}

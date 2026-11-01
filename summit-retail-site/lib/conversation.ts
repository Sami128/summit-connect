import { ApiError } from './errors';

export type ConversationMessage = { role: 'user' | 'assistant'; content: string };
export const MAX_HISTORY_MESSAGES = 12;
export const MAX_HISTORY_BYTES = 96000;
const bytes = (messages: ConversationMessage[]) => new TextEncoder().encode(JSON.stringify(messages)).byteLength;

/** Accept completed user/assistant exchanges only; never accept privileged roles. */
export function validateConversationHistory(value: unknown): ConversationMessage[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > MAX_HISTORY_MESSAGES || value.length % 2 !== 0) throw new ApiError(400, 'Send a valid conversation history.');
  const messages = value.map((item: unknown, index): ConversationMessage => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new ApiError(400, 'Send a valid conversation history.');
    const message = item as Record<string, unknown>;
    const expected = index % 2 === 0 ? 'user' : 'assistant';
    if (message.role !== expected || typeof message.content !== 'string') throw new ApiError(400, 'Conversation history must contain completed user and assistant exchanges.');
    const content = message.content.trim();
    if (!content || content.length > 16000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(content)) throw new ApiError(400, 'A conversation message is empty or too long.');
    return { role: expected, content };
  });
  while (bytes(messages) > MAX_HISTORY_BYTES) messages.splice(0, 2);
  return messages;
}

/** Keep the most recent complete exchanges within the server's UTF-8 limit. */
export function trimConversationHistory(messages: readonly ConversationMessage[]): ConversationMessage[] {
  const result = messages.map(message => ({ role: message.role, content: message.content.trim().slice(0, 16000) })).filter(message => !!message.content);
  while (result.length && result[0].role !== 'user') result.shift();
  if (result.at(-1)?.role === 'user') result.pop();
  while (result.length > MAX_HISTORY_MESSAGES || bytes(result) > MAX_HISTORY_BYTES) result.splice(0, 2);
  return validateConversationHistory(result);
}

/** Resolve references for retrieval; the actual question is still sent separately. */
export function contextualQuestion(question: string, history: readonly ConversationMessage[] = []): string {
  const clean = question.trim();
  if (!history.length) return clean;
  // Explicitly new subjects must not inherit a prior topic merely because chat exists.
  if (/\b(?:new question|different topic|unrelated|forget that|switch topics?)\b/i.test(clean)) return clean;
  if (/\b(?:weather|sports?|recipes?|vacation|pto|tax(?:es)?|minimum wage)\b/i.test(clean)) return clean;
  const followup = /\b(?:that|it|those|them|same|earlier|previous|above)\b|^(?:and|but|so)\b|^(?:what|how)\s+about\s+(?:this|that|those|it)\b|^(?:can|could)\s+you\s+(?:explain|clarify|expand|repeat|summari[sz]e)\b|^(?:please\s+)?(?:explain|clarify|expand|repeat|continue)\b/i.test(clean);
  if (!followup) return clean;
  // Earlier prose helps locate passages, but is never itself an authoritative source.
  const anchors = [...history].reverse().find(message => message.role === 'user')?.content.slice(0, 1000) ?? '';
  const previousReply = [...history].reverse().find(message => message.role === 'assistant')?.content.slice(0, 1800);
  const recent = [anchors, previousReply ? 'Previous reply (reference only): ' + previousReply : ''].filter(Boolean).join('\n');
  return recent ? recent + '\nFollow-up: ' + clean : clean;
}

import { ApiError } from './errors';
import type { AnnouncementInput, Employee, Topic } from './types';
import { createDefaultTopics, legacyTopicId } from './seed';

export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ApiError(400, 'A JSON object is required.');
  return value as Record<string, unknown>;
}

export function text(value: unknown, label: string, min: number, max: number): string {
  if (typeof value !== 'string') throw new ApiError(400, `${label} is required.`);
  const trimmed = value.trim();
  if (trimmed.length < min || trimmed.length > max) throw new ApiError(400, `${label} must be between ${min} and ${max} characters.`);
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(trimmed)) throw new ApiError(400, `${label} contains unsupported characters.`);
  return trimmed;
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  const declared = Number(request.headers.get('content-length') || 0);
  if (declared > 65_536) throw new ApiError(413, 'Request is too large.');
  let raw: string;
  try { raw = await request.text(); } catch { throw new ApiError(400, 'Unable to read request.'); }
  if (raw.length > 65_536) throw new ApiError(413, 'Request is too large.');
  try { return object(JSON.parse(raw)); } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(400, 'Request must contain valid JSON.');
  }
}

export function validateAnnouncement(input: unknown, employees: Employee[], topics: Topic[] = createDefaultTopics()): AnnouncementInput & { category: string; topicId: string } {
  const data = object(input);
  const title = text(data.title, 'Title', 3, 160);
  const body = text(data.body, 'Message', 10, 10_000);
  const topicId = data.topicId !== undefined && data.topicId !== null
    ? text(data.topicId, 'Topic', 1, 100)
    : legacyTopicId(text(data.category, 'Category', 2, 80));
  const topic = topics.find(candidate => candidate.id === topicId);
  if (!topic) throw new ApiError(400, 'Choose an existing topic. Refresh the topic list and try again.');
  const category = topic.name;
  if (!['critical', 'important', 'routine'].includes(data.priority as string)) throw new ApiError(400, 'Choose a valid priority.');
  if (typeof data.requiresAcknowledgment !== 'boolean') throw new ApiError(400, 'Choose whether acknowledgment is required.');
  if (!Array.isArray(data.recipientIds) || !data.recipientIds.length || data.recipientIds.length > 1000 || data.recipientIds.some(id => typeof id !== 'string')) throw new ApiError(400, 'Select at least one recipient (up to 1,000).');
  const recipientIds = [...new Set(data.recipientIds as string[])];
  const valid = new Set(employees.map(e => e.id));
  if (recipientIds.some(id => !valid.has(id))) throw new ApiError(400, 'One or more selected employees could not be found. Refresh and try again.');
  let dueAt: string | null = null;
  if (data.dueAt !== null && data.dueAt !== undefined && data.dueAt !== '') {
    if (typeof data.dueAt !== 'string' || !Number.isFinite(Date.parse(data.dueAt))) throw new ApiError(400, 'Choose a valid response deadline.');
    if (Date.parse(data.dueAt) <= Date.now()) throw new ApiError(400, 'The response deadline must be in the future.');
    dueAt = new Date(data.dueAt).toISOString();
  }
  if (data.priority !== 'critical' && data.requiresAcknowledgment) throw new ApiError(400, 'Only critical updates require acknowledgment. Choose Critical for a response request.');
  if (!data.requiresAcknowledgment) dueAt = null;
  return { title, body, category, topicId, priority: data.priority as AnnouncementInput['priority'], requiresAcknowledgment: data.requiresAcknowledgment, recipientIds, dueAt };
}

export function normalizeTopicName(name: string): string { return name.normalize('NFKC').toLocaleLowerCase('en-US'); }

export function validateTopic(input: unknown): Pick<Topic, 'name' | 'details'> {
  const data = object(input);
  const name = text(data.name, 'Topic name', 3, 80).normalize('NFKC');
  if (/[\r\n\t]/.test(name)) throw new ApiError(400, 'Topic name must fit on one line.');
  if (name.length > 80) throw new ApiError(400, 'Topic name must be between 3 and 80 characters.');
  return { name, details: text(data.details, 'Topic details', 10, 12000) };
}

export function validateEmployee(input: unknown, employees: Employee[], storeIds: string[]): Omit<Employee, 'id' | 'accessRole'> {
  const data = object(input);
  const storeId = text(data.storeId, 'Store', 1, 80);
  if (!storeIds.includes(storeId)) throw new ApiError(400, 'Choose an existing store.');
  const managerId = data.managerId === null || data.managerId === undefined || data.managerId === ''
    ? employees.find(e => e.storeId === storeId && e.accessRole === 'manager' && e.role === 'Store Manager')?.id ?? null
    : text(data.managerId, 'Manager', 1, 80);
  if (managerId && !employees.some(e => e.id === managerId && e.accessRole === 'manager')) throw new ApiError(400, 'Choose an existing manager.');
  const name = text(data.name, 'Full name', 2, 100);
  const role = text(data.role, 'Role', 2, 100);
  const department = text(data.department, 'Department', 2, 80);
  for (const [label, value] of [['Full name', name], ['Role', role], ['Department', department]]) {
    if (/[\r\n\t]/.test(value)) throw new ApiError(400, `${label} must fit on one line.`);
  }
  return { name, role, department, storeId, managerId };
}

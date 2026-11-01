import { randomUUID } from 'node:crypto';
import { createDefaultTopics, legacyTopicId, regionForStore, upgradeLegacyTopicDetails } from './seed';
import initialData from '../db/initial-data.json';
import { ApiError } from './errors';
import { checkDatabase, createSupabase, dataMode } from './supabase';
import { normalizeTopicName, validateAnnouncement, validateEmployee, validateTopic } from './validation';
import { confirmationRequired } from './announcement-status';
import { createD1Store } from './d1-store';
import type { Announcement, AppData, Bootstrap, Employee, Receipt, Session, Topic } from './types';

function normalizeSharedData(data: AppData): AppData {
  const defaults = createDefaultTopics();
  const topics = data.topics.map(topic => upgradeLegacyTopicDetails(topic, defaults));
  for (const topic of defaults) if (!topics.some(existing => existing.id === topic.id)) topics.push(topic);
  const announcements = data.announcements.map(announcement => announcement.topicId && topics.some(topic => topic.id === announcement.topicId)
    ? announcement
    : { ...announcement, topicId: legacyTopicId(announcement.category, announcement.id) });
  const stores = data.stores.map(store => ({ ...store, region: store.region || regionForStore(store.id) }));
  return { ...data, stores, topics, announcements, mode: 'd1' };
}

async function sharedStore() {
  // Resolve the Worker binding only when D1 is selected. Pure persistence tests
  // inject their database directly and optional Supabase never touches D1.
  try {
    const { env } = await import('cloudflare:workers');
    if (!env.DB) throw new Error('Missing DB binding');
    return createD1Store(env.DB, () => structuredClone({ ...initialData, mode: 'd1' }) as AppData, normalizeSharedData);
  } catch { throw new ApiError(503, 'Shared data is unavailable. Please try again or contact your administrator.'); }
}

// Retained name keeps the original mutation functions intact. In this hosted
// copy all non-Supabase mutations use durable D1 revision checks, never disk.
export async function mutateLocal<T>(mutation: (data: AppData) => T | Promise<T>): Promise<T> {
  return (await sharedStore()).mutate(mutation);
}

export async function getData(): Promise<AppData> {
  if (dataMode() !== 'supabase') return (await sharedStore()).read();
  const db = createSupabase();
  const [storeRows, employeeRows, topicRows, announcementRows, recipientRows, receiptRows] = await Promise.all([
    readAll('stores', 'id'),
    readAll('employees', 'id'),
    readAll('topics', 'id'),
    readAll('announcements', 'id'),
    readAll('announcement_recipients', 'announcement_id,employee_id'),
    readAll('receipts', 'announcement_id,employee_id'),
  ]);
  if (!employeeRows.length) throw new ApiError(503, 'Shared storage is ready but has no employees. Run the documented synthetic seed step.');
  return {
    mode: 'supabase',
    stores: storeRows.map(row => ({ id: row.id, name: row.name, city: row.city, address: row.address, region: row.region || regionForStore(row.id) })),
    employees: employeeRows.map(employeeFromRow),
    topics: topicRows.map(row => ({ id: row.id, name: row.name, details: row.details, kind: row.kind, authorId: row.author_id, createdAt: row.created_at })),
    announcements: announcementRows.map(row => ({ id: row.id, title: row.title, body: row.body, category: row.category, topicId: row.topic_id || legacyTopicId(row.category, row.id), priority: row.priority, requiresAcknowledgment: row.requires_acknowledgment, recipientIds: recipientRows.filter(r => r.announcement_id === row.id).map(r => r.employee_id), authorId: row.author_id, createdAt: row.created_at, dueAt: row.due_at })).sort((a,b) => b.createdAt.localeCompare(a.createdAt)),
    receipts: receiptRows.map(row => ({ announcementId: row.announcement_id, employeeId: row.employee_id, readAt: row.read_at, acknowledgedAt: row.acknowledged_at })),
  };

  async function readAll(table: string, order: string): Promise<Record<string, any>[]> {
    // Supabase's default API row limit is 1,000; fetch every page explicitly.
    const rows: Record<string, any>[] = [];
    const pageSize = 500;
    for (let offset = 0; ; offset += pageSize) {
      let query = db.from(table).select('*');
      for (const column of order.split(',')) query = query.order(column);
      const result = await query.range(offset, offset + pageSize - 1);
      checkDatabase(result.error, `read ${table}`);
      rows.push(...(result.data ?? []));
      if (!result.data || result.data.length < pageSize) break;
    }
    return rows;
  }
}

// Explicit mapping keeps database column names away from the application contract.
function employeeFromRow(row: Record<string, unknown>): Employee {
  return { id: row.id as string, name: row.name as string, role: row.role as string, department: row.department as string, storeId: row.store_id as string, managerId: row.manager_id as string | null, accessRole: row.access_role as Employee['accessRole'] };
}

export async function getBootstrap(session: Session): Promise<Bootstrap> {
  const data = await getData();
  const self = data.employees.find(e => e.id === session.employeeId);
  if (!self) throw new ApiError(401, 'Your employee record could not be found. Please sign in again.');
  const identities = session.demo && session.role === 'manager' ? data.employees.map(({ id, name, role, storeId, accessRole }) => ({ id, name, role, storeId, accessRole })) : [];
  if (session.role === 'manager') return { ...data, session, identities };
  const announcements = data.announcements.filter(a => a.recipientIds.includes(self.id));
  const allowedAuthors = new Set(announcements.map(a => a.authorId));
  return {
    ...data, session, identities,
    employees: data.employees.filter(e => e.id === self.id || e.id === self.managerId || allowedAuthors.has(e.id)),
    topics: data.topics.filter(topic => announcements.some(announcement => announcement.topicId === topic.id)),
    announcements: announcements.map(a => ({ ...a, recipientIds: [self.id] })),
    receipts: data.receipts.filter(r => r.employeeId === self.id),
  };
}

export async function addAnnouncement(input: unknown, session: Session): Promise<Announcement> {
  if (session.role !== 'manager') throw new ApiError(403, 'Only managers can send announcements.');
  if (dataMode() !== 'supabase') return mutateLocal(data => {
    const validated = validateAnnouncement(input, data.employees, data.topics);
    const announcement: Announcement = { ...validated, id: randomUUID(), authorId: session.employeeId, createdAt: new Date().toISOString() };
    data.announcements.unshift(announcement);
    return announcement;
  });
  const data = await getData();
  const validated = validateAnnouncement(input, data.employees, data.topics);
  const announcement: Announcement = { ...validated, id: randomUUID(), authorId: session.employeeId, createdAt: new Date().toISOString() };
  const { error } = await createSupabase().rpc('summit_create_announcement', { p_announcement: announcement, p_author_id: session.employeeId });
  checkDatabase(error, 'create announcement');
  return announcement;
}

export async function addTopic(input: unknown, session: Session): Promise<Topic> {
  if (session.role !== 'manager') throw new ApiError(403, 'Only managers can add topics.');
  const fields = validateTopic(input);
  const create = (data: AppData): Topic => {
    if (data.topics.some(topic => normalizeTopicName(topic.name) === normalizeTopicName(fields.name))) throw new ApiError(409, 'A topic with this name already exists. Choose it from the list or use another name.');
    return { ...fields, id: `topic-${randomUUID()}`, kind: 'general', authorId: session.employeeId, createdAt: new Date().toISOString() };
  };
  if (dataMode() !== 'supabase') return mutateLocal(data => {
    const topic = create(data);
    data.topics.push(topic);
    return topic;
  });
  const topic = create(await getData());
  const { error } = await createSupabase().from('topics').insert({ id: topic.id, name: topic.name, details: topic.details, kind: topic.kind, author_id: topic.authorId, created_at: topic.createdAt });
  if (error?.code === '23505') throw new ApiError(409, 'A topic with this name already exists. Choose it from the list or use another name.');
  checkDatabase(error, 'add topic');
  return topic;
}

export async function addEmployee(input: unknown, session: Session): Promise<Employee> {
  if (session.role !== 'manager') throw new ApiError(403, 'Only managers can add employees.');
  if (dataMode() !== 'supabase') return mutateLocal(data => {
    const validated = validateEmployee(input, data.employees, data.stores.map(s => s.id));
    const employee: Employee = { ...validated, id: `EMP-${randomUUID().slice(0, 8).toUpperCase()}`, accessRole: 'employee' };
    data.employees.push(employee);
    return employee;
  });
  const data = await getData();
  const validated = validateEmployee(input, data.employees, data.stores.map(s => s.id));
  const employee: Employee = { ...validated, id: `EMP-${randomUUID().slice(0, 8).toUpperCase()}`, accessRole: 'employee' };
  const { error } = await createSupabase().from('employees').insert({ id: employee.id, name: employee.name, role: employee.role, department: employee.department, store_id: employee.storeId, manager_id: employee.managerId, access_role: employee.accessRole });
  checkDatabase(error, 'add employee');
  return employee;
}

export function applyReceipt(data: AppData, announcementId: string, employeeId: string, action: 'read' | 'acknowledge', now = new Date().toISOString()): Receipt {
  const announcement = data.announcements.find(a => a.id === announcementId);
  const employee = data.employees.find(candidate => candidate.id === employeeId);
  if (!announcement || (!announcement.recipientIds.includes(employeeId) && !(action === 'read' && employee?.accessRole === 'manager'))) throw new ApiError(404, 'This announcement is not available to you.');
  if (action === 'acknowledge' && !announcement.requiresAcknowledgment) throw new ApiError(400, 'This routine update does not require acknowledgment.');
  if (action === 'acknowledge' && !confirmationRequired(announcement, employee, data.employees)) throw new ApiError(400, 'Confirmation is not required for you on this announcement.');
  let receipt = data.receipts.find(r => r.announcementId === announcementId && r.employeeId === employeeId);
  if (action === 'acknowledge' && !receipt?.readAt) throw new ApiError(409, 'Open and read this announcement before acknowledging.');
  if (!receipt) {
    receipt = { announcementId, employeeId, readAt: null, acknowledgedAt: null };
    data.receipts.push(receipt);
  }
  if (!receipt.readAt) receipt.readAt = now;
  if (action === 'acknowledge' && !receipt.acknowledgedAt) receipt.acknowledgedAt = now;
  return receipt;
}

export async function recordReceipt(announcementId: string, action: 'read' | 'acknowledge', session: Session): Promise<Receipt> {
  if (dataMode() !== 'supabase') return mutateLocal(data => applyReceipt(data, announcementId, session.employeeId, action));
  const { data, error } = await createSupabase().rpc('summit_record_receipt', { p_announcement_id: announcementId, p_employee_id: session.employeeId, p_action: action });
  if (error) {
    if (error.message.includes('not available')) throw new ApiError(404, 'This announcement is not available to you.');
    if (error.message.includes('before acknowledging')) throw new ApiError(409, 'Open and read this announcement before acknowledging.');
    if (error.message.includes('does not require')) throw new ApiError(400, 'This update does not require acknowledgment.');
    if (error.message.includes('not required for you')) throw new ApiError(400, 'Confirmation is not required for you on this announcement.');
    checkDatabase(error, 'record receipt');
  }
  const row = Array.isArray(data) ? data[0] : data;
  return { announcementId: row.announcement_id, employeeId: row.employee_id, readAt: row.read_at, acknowledgedAt: row.acknowledged_at };
}

import assert from 'node:assert/strict';
import type { Announcement, Bootstrap, Employee, Receipt, Topic } from '../lib/types';

const base = process.env.BASE_URL || 'http://localhost:3000';
const label = `QA ${new Date().toISOString()}`;

class Client {
  cookie = '';
  async request<T>(pathname: string, method = 'GET', body?: unknown, expected = 200): Promise<T> {
    const response = await fetch(`${base}${pathname}`, {
      method,
      headers: { 'Content-Type': 'application/json', Origin: new URL(base).origin, ...(this.cookie ? { Cookie: this.cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const cookies = response.headers.getSetCookie();
    if (cookies.length) this.cookie = cookies.map(value => value.split(';')[0]).join('; ');
    const data = await response.json();
    assert.equal(response.status, expected, `${method} ${pathname}: ${JSON.stringify(data)}`);
    return data as T;
  }
}

async function main(): Promise<void> {
  const manager = new Client();
  const alex = new Client();
  const otherAlexDevice = new Client();
  const outsider = new Client();
  const directory = await manager.request<{demo: boolean; identities: Pick<Employee, 'id' | 'name' | 'accessRole'>[]}>('/api/session');
  assert.equal(directory.demo, true, 'Run this synthetic integration workflow only in explicitly labeled demo mode.');
  assert.ok(directory.identities.some(employee => employee.id === 'EMP-0001' && employee.accessRole === 'manager'));
  await manager.request('/api/bootstrap', 'GET', undefined, 401);
  await manager.request('/api/session', 'POST', { employeeId: 'EMP-0001' });
  const initial = await manager.request<Bootstrap>('/api/bootstrap');
  assert.equal(initial.session.employeeId, 'EMP-0001');
  await alex.request('/api/session', 'POST', { employeeId: 'EMP-0003' });
  await otherAlexDevice.request('/api/session', 'POST', { employeeId: 'EMP-0003' });
  await outsider.request('/api/session', 'POST', { employeeId: 'EMP-0043' });
  const topicInput = { name: `${label} Store checklist`, details: 'Review the stockroom checklist before your next shift. Contact your store manager with checklist questions.' };
  const topic = await manager.request<Topic>('/api/topics', 'POST', topicInput, 201);
  await manager.request('/api/topics', 'POST', topicInput, 409);
  await alex.request('/api/topics', 'POST', { ...topicInput, name: `${label} Unauthorized topic` }, 403);
  const deadline = new Date(Date.now() + 3 * 86400000).toISOString();
  const body = { title: `[${label}] Safety checklist`, body: 'QA synthetic notice: please review the stockroom checklist before your next shift.', topicId: topic.id, priority: 'critical', requiresAcknowledgment: true, recipientIds: ['EMP-0003'], dueAt: deadline };
  const announcement = await manager.request<Announcement>('/api/announcements', 'POST', body, 201);
  assert.equal(announcement.recipientIds.length, 1);
  assert.equal(announcement.dueAt, deadline, 'The applied future deadline round-trips without a timezone shift.');
  assert.equal(announcement.topicId, topic.id);
  assert.equal(announcement.category, topic.name);
  await alex.request('/api/announcements', 'POST', body, 403);
  await outsider.request('/api/receipts', 'POST', { announcementId: announcement.id, action: 'read' }, 404);
  await alex.request('/api/receipts', 'POST', { announcementId: announcement.id, action: 'acknowledge' }, 409);
  const employeeView = await alex.request<Bootstrap>('/api/bootstrap');
  assert.ok(employeeView.announcements.some(a => a.id === announcement.id));
  assert.ok(employeeView.topics.some(t => t.id === topic.id));
  assert.ok(employeeView.receipts.every(r => r.employeeId === 'EMP-0003'));
  assert.ok(employeeView.announcements.every(a => a.recipientIds.length === 1));
  assert.ok(!(await outsider.request<Bootstrap>('/api/bootstrap')).announcements.some(a => a.id === announcement.id));
  assert.ok(!(await outsider.request<Bootstrap>('/api/bootstrap')).topics.some(t => t.id === topic.id));
  const read = await alex.request<Receipt>('/api/receipts', 'POST', { announcementId: announcement.id, action: 'read' });
  const acknowledged = await alex.request<Receipt>('/api/receipts', 'POST', { announcementId: announcement.id, action: 'acknowledge' });
  assert.ok(read.readAt);
  assert.ok(acknowledged.acknowledgedAt);
  const retry = await alex.request<Receipt>('/api/receipts', 'POST', { announcementId: announcement.id, action: 'acknowledge' });
  assert.equal(retry.readAt, read.readAt);
  assert.equal(retry.acknowledgedAt, acknowledged.acknowledgedAt);
  const synced = await otherAlexDevice.request<Bootstrap>('/api/bootstrap');
  assert.equal(synced.receipts.find(r => r.announcementId === announcement.id)?.acknowledgedAt, acknowledged.acknowledgedAt);
  const status = await manager.request<Bootstrap>('/api/bootstrap');
  assert.equal(status.receipts.find(r => r.announcementId === announcement.id && r.employeeId === 'EMP-0003')?.acknowledgedAt, acknowledged.acknowledgedAt);
  assert.equal(status.employees.find(e => e.id === 'EMP-0003')?.name, 'Alex Morgan');
  const managerCopy = await manager.request<Announcement>('/api/announcements', 'POST', { ...body, title: `[${label}] Manager read-only copy`, recipientIds: ['EMP-0001', 'EMP-0003'] }, 201);
  const managerRead = await manager.request<Receipt>('/api/receipts', 'POST', { announcementId: managerCopy.id, action: 'read' });
  assert.ok(managerRead.readAt);
  assert.equal(managerRead.acknowledgedAt, null);
  await manager.request('/api/receipts', 'POST', { announcementId: managerCopy.id, action: 'acknowledge' }, 400);
  await alex.request('/api/receipts', 'POST', { announcementId: managerCopy.id, action: 'read' });
  const associateConfirmation = await alex.request<Receipt>('/api/receipts', 'POST', { announcementId: managerCopy.id, action: 'acknowledge' });
  assert.ok(associateConfirmation.acknowledgedAt);
  const generalManager = new Client();
  const rachel = new Client();
  await generalManager.request('/api/session', 'POST', { employeeId: 'EMP-0004' });
  await rachel.request('/api/session', 'POST', { employeeId: 'EMP-0002' });
  const generalManagerRequest = await generalManager.request<Announcement>('/api/announcements', 'POST', { ...body, title: `[${label}] Selected manager confirmation`, recipientIds: ['EMP-0002', 'EMP-0004', 'EMP-0003'] }, 201);
  await rachel.request('/api/receipts', 'POST', { announcementId: generalManagerRequest.id, action: 'read' });
  assert.ok((await rachel.request<Receipt>('/api/receipts', 'POST', { announcementId: generalManagerRequest.id, action: 'acknowledge' })).acknowledgedAt);
  await generalManager.request('/api/receipts', 'POST', { announcementId: generalManagerRequest.id, action: 'read' });
  await generalManager.request('/api/receipts', 'POST', { announcementId: generalManagerRequest.id, action: 'acknowledge' }, 400);
  await manager.request('/api/receipts', 'POST', { announcementId: generalManagerRequest.id, action: 'read' });
  await manager.request('/api/receipts', 'POST', { announcementId: generalManagerRequest.id, action: 'acknowledge' }, 404);
  assert.deepEqual((await generalManager.request<Bootstrap>('/api/bootstrap')).announcements.find(item => item.id === generalManagerRequest.id)?.recipientIds, ['EMP-0002', 'EMP-0004', 'EMP-0003']);
  const routine = await manager.request<Announcement>('/api/announcements', 'POST', { ...body, title: `[${label}] Routine update`, priority: 'routine', requiresAcknowledgment: false }, 201);
  assert.equal(routine.dueAt, null, 'Informational updates have no confirmation deadline.');
  await alex.request('/api/receipts', 'POST', { announcementId: routine.id, action: 'read' });
  await alex.request('/api/receipts', 'POST', { announcementId: routine.id, action: 'acknowledge' }, 400);
  await manager.request('/api/announcements', 'POST', { ...body, recipientIds: [] }, 400);
  await manager.request('/api/announcements', 'POST', { ...body, recipientIds: ['nonexistent'] }, 400);
  await manager.request('/api/announcements', 'POST', { ...body, dueAt: '2000-01-01' }, 400);
  await manager.request('/api/announcements', 'POST', { ...body, dueAt: 'invalid-date' }, 400);
  const concurrent = await Promise.all(Array.from({ length: 3 }, (_, i) => manager.request<Announcement>('/api/announcements', 'POST', { ...body, title: `[${label}] Concurrent update ${i}` }, 201)));
  const manual = { name: `${label} Associate`, role: 'Sales Associate', department: 'Sales', storeId: 'store-1' };
  const firstEmployee = await manager.request<Employee>('/api/employees', 'POST', manual, 201);
  const sameNameEmployee = await manager.request<Employee>('/api/employees', 'POST', manual, 201);
  // People may share a name; the immutable generated employee ID is the unique identity.
  assert.notEqual(firstEmployee.id, sameNameEmployee.id);
  assert.equal(firstEmployee.managerId, 'EMP-0002');
  await alex.request('/api/employees', 'POST', manual, 403);
  const persisted = await manager.request<Bootstrap>('/api/bootstrap');
  assert.ok(concurrent.every(a => persisted.announcements.some(saved => saved.id === a.id)));
  assert.ok(persisted.employees.some(e => e.id === firstEmployee.id));
  assert.ok(persisted.employees.some(e => e.id === sameNameEmployee.id));
  console.log('PASS: topic creation/duplicate validation; targeted critical/routine messaging; future deadline round-trip and invalid-date rejection; selected-manager General Manager confirmations and company-wide manager read access; read/acknowledge timestamps; idempotency; role/audience boundaries; cross-client synchronization; concurrent persistence; same-name distinct employee IDs.');
  console.log('QA creates synthetic records with a QA timestamp label; no original seed records were changed.');
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });

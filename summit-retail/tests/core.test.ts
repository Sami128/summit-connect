import assert from 'node:assert/strict';
import { readFile, rm, stat } from 'node:fs/promises';
import { mkdtempSync } from 'node:fs';
import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import { createSeed } from '../src/lib/seed';
import { applyReceipt, getData, addAnnouncement, addEmployee, getBootstrap, recordReceipt } from '../src/lib/store';
import { validateAnnouncement, validateEmployee } from '../src/lib/validation';
import { demoEnabled, requireSession, signDemoIdentity, verifyDemoIdentity, verifyMutation } from '../src/lib/auth';
import { GET as getSessionDirectory, POST as selectSession, DELETE as deleteSession } from '../src/app/api/session/route';
import { POST as createEmployeeRequest } from '../src/app/api/employees/route';
import { POST as saveReceiptRequest } from '../src/app/api/receipts/route';
import type { AnnouncementInput, Session } from '../src/lib/types';

process.env.DATA_DRIVER = 'local';
process.env.DEMO_MODE = 'true';
const directory = mkdtempSync(path.join(os.tmpdir(), 'summit-core-'));
process.env.LOCAL_DATA_DIR = directory;
after(async () => { await rm(directory, { recursive: true, force: true }); });

const manager: Session = { employeeId: 'EMP-0001', role: 'manager', demo: true };
const alex: Session = { employeeId: 'EMP-0003', role: 'employee', demo: true };
const validInput: AnnouncementInput = { title: 'Test safety notice', body: 'Please read the new stockroom safety checklist.', category: 'Safety', priority: 'critical', requiresAcknowledgment: true, recipientIds: ['EMP-0003'], dueAt: null };

test('seed has 200 synthetic employees, five balanced stores, managers and valid references', () => {
  const seed = createSeed(new Date('2026-10-31T12:00:00Z'));
  assert.equal(seed.employees.length, 200);
  assert.equal(seed.stores.length, 5);
  assert.equal(new Set(seed.employees.map(e => e.id)).size, 200);
  assert.equal(new Set(seed.employees.map(e => e.name)).size, 200);
  for (const store of seed.stores) {
    assert.equal(seed.employees.filter(e => e.storeId === store.id).length, 40);
    assert.ok(seed.employees.some(e => e.storeId === store.id && e.role === 'Store Manager'));
  }
  assert.equal(seed.employees.find(e => e.id === 'EMP-0001')?.role, 'Operations Manager');
  assert.equal(seed.employees.find(e => e.id === 'EMP-0001')?.name, 'Michael Bennett');
  assert.equal(seed.employees.find(e => e.id === 'EMP-0002')?.name, 'Rachel Chen');
  assert.equal(seed.employees.find(e => e.id === 'EMP-0003')?.name, 'Alex Morgan');
  assert.deepEqual(seed.employees.find(e => e.id === 'EMP-0004'), { id: 'EMP-0004', name: 'Sami Ahmady', role: 'General Manager', department: 'Operations', accessRole: 'manager', managerId: null, storeId: 'store-1' });
  for (const employee of seed.employees) if (employee.managerId) assert.ok(seed.employees.some(e => e.id === employee.managerId && e.accessRole === 'manager'));
  assert.equal(seed.announcements.length, 6);
});

test('fictional roster keeps stable unique names and supports natural Unicode spelling', () => {
  const first = createSeed(new Date('2026-10-31T12:00:00Z'));
  const later = createSeed(new Date('2026-11-01T12:00:00Z'));
  assert.deepEqual(first.employees, later.employees, 'Names and record assignments stay stable when the seed date changes.');
  for (const employee of first.employees) {
    assert.equal(employee.name, employee.name.trim());
    assert.ok(employee.name.split(/\s+/).length >= 2);
    assert.equal(/[\r\n\t]/.test(employee.name), false);
  }
  assert.ok(first.employees.some(employee => employee.name === 'Diego Álvarez'));
  assert.ok(first.employees.some(employee => employee.name === 'Tereza Dvořáková'));
  assert.ok(first.employees.some(employee => employee.name === 'Ethan O’Connor'));
  assert.equal(new Set(first.employees.map(employee => employee.name)).size, 200);
  assert.deepEqual(first.employees.filter(employee => employee.accessRole === 'manager').map(employee => employee.id), ['EMP-0001', 'EMP-0002', 'EMP-0004', 'EMP-0041', 'EMP-0081', 'EMP-0121', 'EMP-0161']);
});

test('operational regions group stores without changing the 200 employee assignments', () => {
  const seed = createSeed();
  assert.deepEqual(seed.stores.filter(store => store.region === 'Seattle & Eastside').map(store => store.id), ['store-1', 'store-2', 'store-4']);
  assert.equal(seed.stores.find(store => store.id === 'store-3')?.region, 'South Sound');
  assert.equal(seed.stores.find(store => store.id === 'store-5')?.region, 'North Sound');
  const eastsideIds = new Set(seed.stores.filter(store => store.region === 'Seattle & Eastside').map(store => store.id));
  assert.equal(seed.employees.filter(employee => eastsideIds.has(employee.storeId)).length, 120);
  assert.equal(seed.employees.filter(employee => employee.storeId === 'store-3').length, 40);
  assert.equal(seed.employees.filter(employee => employee.storeId === 'store-5').length, 40);
});

test('scheduling announcement gives clear company rules, coaching and wage protections', () => {
  const policy = createSeed().announcements.find(announcement => announcement.id === 'ann-scheduling')!;
  assert.match(policy.body, /60 working hours/);
  assert.match(policy.body, /Monday–Sunday/);
  assert.match(policy.body, /all five Summit stores/);
  assert.match(policy.body, /prior written approval from the Operations Manager/);
  assert.match(policy.body, /coaching and a written warning \(write-up\)/);
  assert.match(policy.body, /All hours worked must be paid/);
  assert.match(policy.body, /overtime-eligible employees receive at least 1\.5 times their regular rate for hours worked beyond 40/);
  assert.match(policy.body, /Missing approval does not remove payment/);
  assert.equal(/\b(Washington|law|legal|fictional)\b|https?:\/\//i.test(policy.body), false);
  assert.equal(policy.priority, 'critical');
  assert.equal(policy.requiresAcknowledgment, true);
});

test('announcement validation rejects empty/unknown audiences, invalid deadlines, routine acknowledgments and oversize text', () => {
  const employees = createSeed().employees;
  assert.throws(() => validateAnnouncement({ ...validInput, recipientIds: [] }, employees), /Select at least/);
  assert.throws(() => validateAnnouncement({ ...validInput, recipientIds: ['unknown'] }, employees), /could not be found/);
  assert.throws(() => validateAnnouncement({ ...validInput, priority: 'routine' }, employees), /Only critical updates/);
  assert.throws(() => validateAnnouncement({ ...validInput, priority: 'important' }, employees), /Only critical updates/);
  assert.throws(() => validateAnnouncement({ ...validInput, dueAt: 'yesterday' }, employees), /valid response deadline/);
  assert.throws(() => validateAnnouncement({ ...validInput, dueAt: '2000-01-01' }, employees), /future/);
  assert.throws(() => validateAnnouncement({ ...validInput, body: 'a'.repeat(10001) }, employees), /10000/);
  assert.deepEqual(validateAnnouncement({ ...validInput, recipientIds: ['EMP-0003', 'EMP-0003'] }, employees).recipientIds, ['EMP-0003']);
});

test('manual employee validation never accepts an elevated access role', () => {
  const data = createSeed();
  const employee = validateEmployee({ name: 'New Associate', role: 'Sales Associate', department: 'Sales', storeId: 'store-1', accessRole: 'manager' }, data.employees, data.stores.map(s => s.id));
  assert.equal(employee.managerId, 'EMP-0002');
  assert.equal('accessRole' in employee, false);
  assert.throws(() => validateEmployee({ name: 'N', role: 'Sales', department: 'Sales', storeId: 'store-99' }, data.employees, data.stores.map(s => s.id)), /existing store/);
  assert.throws(() => validateEmployee({ name: 'Jordan Parker', role: 'Sales Associate', department: 'Sales', storeId: 'store-1', managerId: 123 }, data.employees, data.stores.map(s => s.id)), /Manager is required/);
  assert.throws(() => validateEmployee({ name: 'Jordan\nParker', role: 'Sales Associate', department: 'Sales', storeId: 'store-1' }, data.employees, data.stores.map(s => s.id)), /Full name must fit on one line/);
  assert.throws(() => validateEmployee({ name: 'Jordan Parker', role: 'Sales\tAssociate', department: 'Sales', storeId: 'store-1' }, data.employees, data.stores.map(s => s.id)), /Role must fit on one line/);
  assert.equal(validateEmployee({ name: 'Élodie O’Connor-James', role: 'Sales Associate', department: 'Sales', storeId: 'store-1', managerId: '' }, data.employees, data.stores.map(s => s.id)).name, 'Élodie O’Connor-James');
});

test('receipts require targeted access and reading before acknowledging; retries preserve timestamps', () => {
  const data = createSeed();
  assert.throws(() => applyReceipt(data, 'ann-safety', alex.employeeId, 'acknowledge'), /before acknowledging/);
  const first = applyReceipt(data, 'ann-safety', alex.employeeId, 'read', '2026-11-01T10:00:00Z');
  assert.equal(first.readAt, '2026-11-01T10:00:00Z');
  const ack = applyReceipt(data, 'ann-safety', alex.employeeId, 'acknowledge', '2026-11-01T10:01:00Z');
  const retry = applyReceipt(data, 'ann-safety', alex.employeeId, 'acknowledge', '2026-11-01T10:05:00Z');
  assert.equal(ack.acknowledgedAt, '2026-11-01T10:01:00Z');
  assert.equal(retry.acknowledgedAt, ack.acknowledgedAt);
  assert.equal(data.receipts.filter(r => r.employeeId === alex.employeeId && r.announcementId === 'ann-safety').length, 1);
  assert.throws(() => applyReceipt(data, 'ann-weekend', alex.employeeId, 'acknowledge'), /does not require/);
  assert.throws(() => applyReceipt(data, 'ann-seattle', 'EMP-0043', 'read'), /not available/);
});

test('ordinary manager requests permit manager reads without confirmation while associates still confirm', async () => {
  const announcement = await addAnnouncement({ ...validInput, recipientIds: ['EMP-0004', 'EMP-0003'] }, manager);
  const request = (employeeId: string, action: string) => new Request('http://localhost/api/receipts', { method: 'POST', headers: { cookie: `summit_demo=${signDemoIdentity(employeeId)}`, 'content-type': 'application/json', origin: 'http://localhost' }, body: JSON.stringify({ announcementId: announcement.id, action }) });
  const read = await saveReceiptRequest(request('EMP-0004', 'read'));
  assert.equal(read.status, 200);
  const savedRead = await read.json();
  assert.ok(savedRead.readAt);
  assert.equal(savedRead.acknowledgedAt, null);
  const rejected = await saveReceiptRequest(request('EMP-0004', 'acknowledge'));
  assert.equal(rejected.status, 400);
  assert.match((await rejected.json()).error, /not required for you/);
  const managerReceipt = (await getData()).receipts.find(receipt => receipt.announcementId === announcement.id && receipt.employeeId === 'EMP-0004');
  assert.equal(managerReceipt?.readAt, savedRead.readAt);
  assert.equal(managerReceipt?.acknowledgedAt, null);
  assert.equal((await saveReceiptRequest(request('EMP-0003', 'read'))).status, 200);
  const confirmed = await saveReceiptRequest(request('EMP-0003', 'acknowledge'));
  assert.equal(confirmed.status, 200);
  assert.ok((await confirmed.json()).acknowledgedAt);
});

test('rejecting a manager confirmation preserves historical receipts without fabricating status', () => {
  const data = createSeed();
  const announcement = data.announcements.find(item => item.id === 'ann-safety')!;
  assert.ok(announcement.recipientIds.includes('EMP-0004'));
  const existing = data.receipts.find(item => item.announcementId === announcement.id && item.employeeId === 'EMP-0004');
  const historical = { announcementId: announcement.id, employeeId: 'EMP-0004', readAt: '2026-10-28T10:00:00Z', acknowledgedAt: '2026-10-28T10:01:00Z' };
  if (existing) Object.assign(existing, historical); else data.receipts.push(historical);
  const before = structuredClone(data.receipts);
  assert.throws(() => applyReceipt(data, announcement.id, 'EMP-0004', 'acknowledge'), /not required for you/);
  assert.deepEqual(data.receipts, before);
});

test('General Manager requests require confirmation only from selected other managers, with all managers able to read', async () => {
  const selected = ['EMP-0002', 'EMP-0004', 'EMP-0003'];
  const announcement = await addAnnouncement({ ...validInput, recipientIds: selected }, { employeeId: 'EMP-0004', role: 'manager', demo: true });
  const request = (employeeId: string, action: string) => new Request('http://localhost/api/receipts', { method: 'POST', headers: { cookie: `summit_demo=${signDemoIdentity(employeeId)}`, 'content-type': 'application/json', origin: 'http://localhost' }, body: JSON.stringify({ announcementId: announcement.id, action }) });
  assert.equal((await saveReceiptRequest(request('EMP-0002', 'read'))).status, 200);
  const confirmed = await saveReceiptRequest(request('EMP-0002', 'acknowledge'));
  assert.equal(confirmed.status, 200);
  const receipt = await confirmed.json();
  assert.ok(receipt.acknowledgedAt);
  const retry = await saveReceiptRequest(request('EMP-0002', 'acknowledge'));
  assert.equal((await retry.json()).acknowledgedAt, receipt.acknowledgedAt);
  assert.equal((await saveReceiptRequest(request('EMP-0004', 'read'))).status, 200);
  assert.equal((await saveReceiptRequest(request('EMP-0004', 'acknowledge'))).status, 400, 'The General Manager does not confirm their own announcement.');
  assert.equal((await saveReceiptRequest(request('EMP-0001', 'read'))).status, 200, 'An untargeted manager can save a read receipt.');
  assert.equal((await saveReceiptRequest(request('EMP-0001', 'acknowledge'))).status, 404, 'Reading does not add that manager to the confirmation audience.');
  assert.equal((await saveReceiptRequest(request('EMP-0043', 'read'))).status, 404, 'Untargeted associates remain excluded.');
  assert.equal((await saveReceiptRequest(request('EMP-0043', 'acknowledge'))).status, 404);
  assert.equal((await saveReceiptRequest(request('EMP-0003', 'read'))).status, 200);
  assert.equal((await saveReceiptRequest(request('EMP-0003', 'acknowledge'))).status, 200);
  const stored = (await getData()).announcements.find(item => item.id === announcement.id);
  assert.deepEqual(stored?.recipientIds, selected, 'Manager visibility does not add audience members.');
  assert.ok((await getBootstrap(manager)).announcements.some(item => item.id === announcement.id));
});

test('demo identity signatures reject tampering and mutations reject cross-site requests', () => {
  const value = signDemoIdentity('EMP-0003');
  assert.equal(verifyDemoIdentity(value), 'EMP-0003');
  assert.throws(() => verifyDemoIdentity(`${value}tampered`), /expired/);
  assert.throws(() => verifyMutation(new Request('http://localhost/api/announcements', { headers: { origin: 'https://attacker.example' } })), /originate/);
  verifyMutation(new Request('http://localhost/api/announcements', { headers: { origin: 'http://localhost' } }));
});

test('demo entry requires a chosen name and attributes manager work to that selected identity', async () => {
  await assert.rejects(() => requireSession(new Request('http://localhost/api/bootstrap')), /Select your role and name/);
  const request = new Request('http://localhost/api/session', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'http://localhost' }, body: JSON.stringify({ employeeId: 'EMP-0002' }) });
  const response = await selectSession(request);
  assert.equal(response.status, 200);
  const identityCookie = response.headers.getSetCookie().find(value => value.startsWith('summit_demo='));
  assert.ok(identityCookie?.includes('HttpOnly'));
  const session = await requireSession(new Request('http://localhost/api/bootstrap', { headers: { cookie: identityCookie!.split(';')[0] } }));
  assert.deepEqual(session, { employeeId: 'EMP-0002', role: 'manager', demo: true });
  const workspace = await getBootstrap(session);
  assert.equal(workspace.employees.find(employee => employee.id === session.employeeId)?.name, 'Rachel Chen');
  const announcement = await addAnnouncement({ ...validInput, title: 'Selected Rachel attribution' }, session);
  assert.equal(announcement.authorId, 'EMP-0002');
  const cleared = await deleteSession(new Request('http://localhost/api/session', { method: 'DELETE', headers: { origin: 'http://localhost' } }));
  assert.equal(cleared.status, 200);
  assert.ok(cleared.headers.getSetCookie().some(value => value.startsWith('summit_demo=;') && value.includes('Max-Age=0')));
});

test('entry directories separate fictional managers and associates and remain private outside demo mode', async () => {
  const response = await getSessionDirectory(new Request('http://localhost/api/session'));
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const directory = await response.json();
  assert.equal(directory.demo, true);
  assert.ok(directory.identities.length >= 5);
  assert.equal(directory.stores.length, 5);
  assert.ok(directory.identities.every((employee: {accessRole: string}) => employee.accessRole === 'manager'));
  const associateDirectory = await (await getSessionDirectory(new Request('http://localhost/api/session?portal=employee'))).json();
  assert.ok(associateDirectory.identities.every((employee: {accessRole: string}) => employee.accessRole === 'employee'));
  assert.equal(associateDirectory.identities.find((employee: {id: string}) => employee.id === 'EMP-0003')?.name, 'Alex Morgan');
  assert.ok(directory.identities.every((employee: object) => !('managerId' in employee)));
  const previous = process.env.DEMO_MODE;
  process.env.DEMO_MODE = 'false';
  try {
    const secureResponse = await getSessionDirectory(new Request('http://localhost/api/session?portal=manager'));
    assert.equal(secureResponse.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await secureResponse.json(), { demo: false, identities: [], stores: [] });
  } finally { process.env.DEMO_MODE = previous; }
});

test('an associate session cannot obtain manager choices or switch to a manager profile', async () => {
  const associateCookie = `summit_demo=${signDemoIdentity('EMP-0003')}`;
  const directoryResponse = await getSessionDirectory(new Request('http://localhost/api/session?portal=manager', { headers: { cookie: associateCookie } }));
  assert.equal(directoryResponse.status, 200);
  const directory = await directoryResponse.json();
  assert.ok(directory.identities.length > 0);
  assert.ok(directory.identities.every((employee: {accessRole: string}) => employee.accessRole === 'employee'));
  assert.equal(directory.identities.some((employee: {id: string}) => employee.id === 'EMP-0001'), false);
  const denied = await selectSession(new Request('http://localhost/api/session', { method: 'POST', headers: { cookie: associateCookie, origin: 'http://localhost', 'content-type': 'application/json' }, body: JSON.stringify({ employeeId: 'EMP-0001', role: 'manager', portal: 'manager' }) }));
  assert.equal(denied.status, 403);
  assert.equal(denied.headers.getSetCookie().length, 0);
  const employeeView = await getBootstrap(alex);
  assert.deepEqual(employeeView.identities, []);
  const managerToEmployee = await selectSession(new Request('http://localhost/api/session', { method: 'POST', headers: { cookie: `summit_demo=${signDemoIdentity('EMP-0002')}`, origin: 'http://localhost', 'content-type': 'application/json' }, body: JSON.stringify({ employeeId: 'EMP-0003' }) }));
  assert.equal(managerToEmployee.status, 200);
});

test('local production supports role/name entry and adding an associate without passwords or external credentials', async () => {
  const names = ['NODE_ENV', 'DATA_DRIVER', 'DEMO_MODE', 'LOCAL_DATA_DIR', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'GEMINI_API_KEY', 'DEMO_SESSION_SECRET', 'VERCEL'];
  const previous = Object.fromEntries(names.map(name => [name, process.env[name]]));
  try {
    for (const name of names) delete process.env[name];
    Object.assign(process.env, { NODE_ENV: 'production', LOCAL_DATA_DIR: path.join(directory, 'credential-free-entry') });
    assert.equal(demoEnabled(), true);
    const choices = await (await getSessionDirectory(new Request('http://localhost/api/session?portal=manager'))).json();
    assert.equal(choices.demo, true);
    assert.equal(choices.identities.find((employee: {id: string}) => employee.id === 'EMP-0004')?.name, 'Sami Ahmady');
    const entered = await selectSession(new Request('http://localhost/api/session', { method: 'POST', headers: { origin: 'http://localhost', 'content-type': 'application/json' }, body: JSON.stringify({ employeeId: 'EMP-0004' }) }));
    assert.equal(entered.status, 200);
    const selectedCookie = entered.headers.getSetCookie().find(value => value.startsWith('summit_demo='))!.split(';')[0];
    assert.equal((await requireSession(new Request('http://localhost/api/bootstrap', { headers: { cookie: selectedCookie } }))).employeeId, 'EMP-0004');
    const created = await createEmployeeRequest(new Request('http://localhost/api/employees', { method: 'POST', headers: { cookie: selectedCookie, origin: 'http://localhost', 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Laila Boulos', role: 'Sales Associate', department: 'Sales', storeId: 'store-1' }) }));
    assert.equal(created.status, 201);
    const employee = await created.json();
    assert.equal(employee.name, 'Laila Boulos');
    assert.equal(employee.accessRole, 'employee');
    const associateAttempt = await createEmployeeRequest(new Request('http://localhost/api/employees', { method: 'POST', headers: { cookie: `summit_demo=${signDemoIdentity('EMP-0003')}`, origin: 'http://localhost', 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Unauthorized Addition', role: 'Sales Associate', department: 'Sales', storeId: 'store-1' }) }));
    assert.equal(associateAttempt.status, 403, 'Credential-free entry preserves manager-only actions.');
  } finally {
    for (const [name, value] of Object.entries(previous)) if (value === undefined) delete process.env[name]; else process.env[name] = value;
  }
});

test('production shared storage stays authenticated by default and explicit secure mode is respected locally', async () => {
  const names = ['NODE_ENV', 'DATA_DRIVER', 'DEMO_MODE', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'VERCEL'];
  const previous = Object.fromEntries(names.map(name => [name, process.env[name]]));
  try {
    delete process.env.VERCEL;
    delete process.env.DEMO_MODE;
    Object.assign(process.env, { NODE_ENV: 'production', DATA_DRIVER: 'supabase', SUPABASE_URL: 'https://synthetic-test.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'synthetic-test-key-not-a-real-credential' });
    assert.equal(demoEnabled(), false);
    const publicDirectory = await (await getSessionDirectory(new Request('http://localhost/api/session?portal=manager'))).json();
    assert.deepEqual(publicDirectory, { demo: false, identities: [], stores: [] });
    Object.assign(process.env, { DATA_DRIVER: 'local', DEMO_MODE: 'false' });
    assert.equal(demoEnabled(), false);
    Object.assign(process.env, { NODE_ENV: 'development' });
    assert.equal(demoEnabled(), false);
  } finally {
    for (const [name, value] of Object.entries(previous)) if (value === undefined) delete process.env[name]; else process.env[name] = value;
  }
});

test('persistent manager-to-employee workflow, access boundaries, and concurrent writes', async () => {
  const original = await getData();
  assert.equal(original.employees.length, 200);
  const announcement = await addAnnouncement(validInput, manager);
  await assert.rejects(() => addAnnouncement(validInput, alex), /Only managers/);
  const employeeView = await getBootstrap(alex);
  assert.ok(employeeView.announcements.some(a => a.id === announcement.id));
  assert.ok(employeeView.announcements.every(a => a.recipientIds.length === 1 && a.recipientIds[0] === alex.employeeId));
  assert.ok(employeeView.receipts.every(r => r.employeeId === alex.employeeId));
  assert.ok(employeeView.employees.length <= 4);
  assert.equal((await requireSession(new Request('http://localhost/api/bootstrap', { headers: { cookie: `summit_demo=${signDemoIdentity(alex.employeeId)}` } }))).role, 'employee');
  await recordReceipt(announcement.id, 'read', alex);
  const acknowledgment = await recordReceipt(announcement.id, 'acknowledge', alex);
  const managerView = await getBootstrap(manager);
  const visible = managerView.receipts.find(r => r.employeeId === alex.employeeId && r.announcementId === announcement.id);
  assert.equal(visible?.acknowledgedAt, acknowledgment.acknowledgedAt);
  assert.ok(managerView.employees.find(e => e.id === visible?.employeeId)?.name === 'Alex Morgan');
  await Promise.all(Array.from({ length: 8 }, (_, i) => addEmployee({ name: `Concurrent Associate ${i}`, role: 'Sales Associate', department: 'Sales', storeId: 'store-2' }, manager)));
  const reread = await getData();
  assert.equal(reread.employees.length, 208);
  assert.equal(new Set(reread.employees.map(e => e.id)).size, 208);
  const persisted = JSON.parse(await readFile(path.join(directory, 'summit.json'), 'utf8'));
  assert.equal(persisted.employees.length, 208);
  assert.ok(persisted.receipts.some((r: {announcementId: string; acknowledgedAt: string | null}) => r.announcementId === announcement.id && r.acknowledgedAt));
  const childResult = execFileSync(process.execPath, ['--import', 'tsx', '-e', "Promise.all([import('./src/lib/store.ts'),import('./src/lib/auth.ts')]).then(async ([loaded,authLoaded]) => { const api = loaded.default || loaded; const auth = authLoaded.default || authLoaded; const data = await api.getData(); process.stdout.write(JSON.stringify({count:data.employees.length, acknowledged:data.receipts.filter(r=>r.acknowledgedAt).length, identity:auth.verifyDemoIdentity(process.env.SUMMIT_TEST_COOKIE)})); }).catch(()=>process.exit(1));"], { cwd: process.cwd(), env: { ...process.env, SUMMIT_TEST_COOKIE: signDemoIdentity(alex.employeeId) }, encoding: 'utf8' });
  const reopened = JSON.parse(childResult);
  assert.equal(reopened.count, 208, 'A fresh process reads the same persisted employees.');
  assert.ok(reopened.acknowledged > 0);
  assert.equal(reopened.identity, alex.employeeId, 'A fresh process preserves the locally signed demo identity.');
  const raceDirectory = path.join(directory, 'signing-race');
  const runChild = promisify(execFile);
  const fingerprints = await Promise.all(Array.from({ length: 4 }, () => runChild(process.execPath, ['--import', 'tsx', '-e', "Promise.all([import('./src/lib/auth.ts'),import('node:crypto')]).then(([loaded,crypto])=>{const auth=loaded.default||loaded;process.stdout.write(crypto.createHash('sha256').update(auth.signDemoIdentity('EMP-0003')).digest('hex'));}).catch(()=>process.exit(1));"], { cwd: process.cwd(), env: { ...process.env, DEMO_SESSION_SECRET: '', LOCAL_DATA_DIR: raceDirectory }, encoding: 'utf8' })));
  assert.equal(new Set(fingerprints.map(result => result.stdout)).size, 1, 'Concurrent fresh processes share one complete local signing secret.');
  assert.equal((await stat(path.join(raceDirectory, '.demo-secret'))).mode & 0o777, 0o600);
});

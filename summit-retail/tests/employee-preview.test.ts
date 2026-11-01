import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import { POST as previewEmployee } from '../src/app/api/employee-preview/route';
import { getData } from '../src/lib/store';
import { requireSession, signDemoIdentity } from '../src/lib/auth';

process.env.DATA_DRIVER = 'local';
process.env.DEMO_MODE = 'true';
const directory = mkdtempSync(path.join(os.tmpdir(), 'summit-preview-'));
process.env.LOCAL_DATA_DIR = directory;
after(async () => { await rm(directory, { recursive: true, force: true }); });

function request(body: unknown, identity = 'EMP-0002', origin = 'http://localhost') {
  return new Request('http://localhost/api/employee-preview', {
    method: 'POST',
    headers: { cookie: `summit_demo=${signDemoIdentity(identity)}`, 'content-type': 'application/json', origin },
    body: JSON.stringify(body),
  });
}

test('manager preview returns the selected associate feed without changing the manager session or receipt history', async () => {
  await getData();
  const before = await readFile(path.join(directory, 'summit.json'), 'utf8');
  const input = request({ employeeId: 'EMP-0003', managerId: 'EMP-0001', role: 'manager' });
  const response = await previewEmployee(input);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.getSetCookie().length, 0, 'Preview never switches the demo identity.');
  const result = await response.json();
  assert.deepEqual(result.manager, { id: 'EMP-0002', name: 'Rachel Chen' });
  assert.deepEqual(result.data.session, { employeeId: 'EMP-0003', role: 'employee', demo: true });
  assert.ok(result.data.announcements.length > 0);
  assert.ok(result.data.announcements.every((announcement: {recipientIds: string[]}) => announcement.recipientIds.length === 1 && announcement.recipientIds[0] === 'EMP-0003'));
  assert.ok(result.data.receipts.every((receipt: {employeeId: string}) => receipt.employeeId === 'EMP-0003'));
  assert.deepEqual(result.data.identities, []);
  assert.equal(await readFile(path.join(directory, 'summit.json'), 'utf8'), before, 'Read-only preview does not change data or receipt timestamps.');
  const caller = await requireSession(input);
  assert.deepEqual(caller, { employeeId: 'EMP-0002', role: 'manager', demo: true });
});

test('associate and unauthenticated requests cannot preview another employee', async () => {
  const denied = await previewEmployee(request({ employeeId: 'EMP-0004', role: 'manager' }, 'EMP-0003'));
  assert.equal(denied.status, 403);
  assert.match((await denied.json()).error, /Only managers/);
  assert.equal(denied.headers.get('cache-control'), 'no-store');
  const unsigned = await previewEmployee(new Request('http://localhost/api/employee-preview', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ employeeId: 'EMP-0003' }) }));
  assert.equal(unsigned.status, 401);
});

test('preview validates the requested employee and rejects cross-site calls', async () => {
  assert.equal((await previewEmployee(request({ employeeId: 'missing' }))).status, 404);
  assert.equal((await previewEmployee(request({ employeeId: 'EMP-0001' }))).status, 400);
  assert.equal((await previewEmployee(request({}))).status, 400);
  assert.equal((await previewEmployee(request({ employeeId: 3 }))).status, 400);
  assert.equal((await previewEmployee(request({ employeeId: 'EMP-0003' }, 'EMP-0002', 'https://unrelated.example'))).status, 403);
  const invalidJson = new Request('http://localhost/api/employee-preview', { method: 'POST', headers: { cookie: `summit_demo=${signDemoIdentity('EMP-0002')}`, 'content-type': 'application/json', origin: 'http://localhost' }, body: '{not-json' });
  assert.equal((await previewEmployee(invalidJson)).status, 400);
});

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { statsFor } from '../src/components/ui';
import type { Announcement, AppData, Employee } from '../src/lib/types';

const people: Employee[] = [
  { id: 'associate', name: 'Alex Morgan', role: 'Sales Associate', accessRole: 'employee', storeId: 'store', managerId: 'manager', department: 'Sales' },
  { id: 'manager', name: 'Rachel Chen', role: 'Store Manager', accessRole: 'manager', storeId: 'store', managerId: 'general', department: 'Operations' },
  { id: 'general', name: 'Sami Ahmady', role: 'General Manager', accessRole: 'manager', storeId: 'store', managerId: null, department: 'Operations' },
  { id: 'operations', name: 'Michael Bennett', role: 'Operations Manager', accessRole: 'manager', storeId: 'store', managerId: 'general', department: 'Operations' },
];
const readAt = '2026-11-01T01:00:00.000Z';
const acknowledgedAt = '2026-11-01T01:01:00.000Z';
const announcement: Announcement = { id: 'notice', title: 'Store update', body: 'Review this update before your next shift.', category: 'Operations', priority: 'critical', requiresAcknowledgment: true, recipientIds: ['associate', 'manager', 'general'], authorId: 'operations', createdAt: readAt, dueAt: null };
function dataFor(a: Announcement): AppData {
  return { employees: people, stores: [], topics: [], announcements: [a], receipts: [
    { announcementId: a.id, employeeId: 'associate', readAt, acknowledgedAt },
    { announcementId: a.id, employeeId: 'manager', readAt, acknowledgedAt: null },
    { announcementId: a.id, employeeId: 'general', readAt, acknowledgedAt },
    // Managers can read every announcement. Observer reads are not delivered-audience reads.
    { announcementId: a.id, employeeId: 'operations', readAt, acknowledgedAt: null },
  ], mode: 'local' };
}

test('response statistics ignore manager confirmations on an Operations Manager announcement and exclude observer reads', () => {
  const status = statsFor(announcement, dataFor(announcement));
  assert.deepEqual(status, { read: 3, acknowledged: 1, acknowledgmentTotal: 1, total: 3, pending: 0, readRate: 100, ackRate: 100 });
});

test('General Manager announcements count selected manager confirmations but never the author’s own confirmation', () => {
  const a = { ...announcement, authorId: 'general' };
  const status = statsFor(a, dataFor(a));
  assert.deepEqual(status, { read: 3, acknowledged: 1, acknowledgmentTotal: 2, total: 3, pending: 1, readRate: 100, ackRate: 50 });
});

test('manager-only audiences have no pending confirmations when the author is not a General Manager', () => {
  const a = { ...announcement, recipientIds: ['manager', 'general'] };
  const status = statsFor(a, dataFor(a));
  assert.equal(status.read, 2);
  assert.equal(status.readRate, 100);
  assert.equal(status.acknowledgmentTotal, 0);
  assert.equal(status.acknowledged, 0);
  assert.equal(status.pending, 0);
  assert.equal(status.ackRate, 0);
});

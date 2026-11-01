import assert from 'node:assert/strict';
import { test } from 'node:test';
import { acknowledgmentRecipientIds, confirmationRequired } from '../src/lib/announcement-status';
import { createSeed } from '../src/lib/seed';

test('associates confirm targeted requests, while ordinary manager authors do not create manager obligations', () => {
  const employees = createSeed().employees;
  const announcement = { authorId: 'EMP-0001', requiresAcknowledgment: true, recipientIds: ['EMP-0004', 'EMP-0003'] };
  assert.equal(confirmationRequired(announcement, employees.find(employee => employee.id === 'EMP-0003'), employees), true);
  assert.equal(confirmationRequired(announcement, employees.find(employee => employee.id === 'EMP-0004'), employees), false);
  assert.equal(confirmationRequired(announcement, employees.find(employee => employee.id === 'EMP-0043'), employees), false);
  assert.equal(confirmationRequired(announcement, undefined, employees), false);
  assert.deepEqual(acknowledgmentRecipientIds(announcement, employees), ['EMP-0003']);
});

test('General Manager requests include only selected other managers and targeted associates', () => {
  const employees = createSeed().employees;
  const announcement = { authorId: 'EMP-0004', requiresAcknowledgment: true, recipientIds: ['EMP-0002', 'EMP-0004', 'EMP-0003'] };
  assert.equal(confirmationRequired(announcement, employees.find(employee => employee.id === 'EMP-0002'), employees), true);
  assert.equal(confirmationRequired(announcement, employees.find(employee => employee.id === 'EMP-0004'), employees), false, 'An author never confirms their own request.');
  assert.equal(confirmationRequired(announcement, employees.find(employee => employee.id === 'EMP-0001'), employees), false, 'Visibility never adds an untargeted manager to the audience.');
  assert.deepEqual(acknowledgmentRecipientIds(announcement, employees), ['EMP-0002', 'EMP-0003']);
});

test('informational updates and ordinary-manager audiences have no manager confirmation recipients', () => {
  const employees = createSeed().employees;
  assert.deepEqual(acknowledgmentRecipientIds({ authorId: 'EMP-0004', requiresAcknowledgment: false, recipientIds: ['EMP-0003', 'EMP-0002'] }, employees), []);
  assert.equal(confirmationRequired({ authorId: 'EMP-0004', requiresAcknowledgment: false, recipientIds: ['EMP-0003'] }, employees.find(employee => employee.id === 'EMP-0003'), employees), false);
  assert.deepEqual(acknowledgmentRecipientIds({ authorId: 'EMP-0001', requiresAcknowledgment: true, recipientIds: ['EMP-0001', 'EMP-0002', 'EMP-0004'] }, employees), []);
});

test('confirmation recipients preserve audience order and exclude missing identities', () => {
  const employees = createSeed().employees;
  assert.deepEqual(acknowledgmentRecipientIds({ authorId: 'EMP-0001', requiresAcknowledgment: true, recipientIds: ['EMP-0043', 'missing', 'EMP-0004', 'EMP-0003'] }, employees), ['EMP-0043', 'EMP-0003']);
});

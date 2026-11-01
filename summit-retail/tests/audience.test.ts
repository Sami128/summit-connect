import assert from 'node:assert/strict';
import test from 'node:test';
import type { Employee, Store } from '../src/lib/types';
import { addToSelection, hasGroupFilter, matchAudience, storeRegion, toggleSelection, validSelection } from '../src/lib/audience';

const stores: (Store & { region?: string })[] = [
  { id: 'seattle', name: 'Seattle', city: 'Seattle', address: 'Synthetic', region: 'Seattle & Eastside' },
  { id: 'bellevue', name: 'Bellevue', city: 'Bellevue', address: 'Synthetic', region: 'Seattle & Eastside' },
  { id: 'everett', name: 'Everett', city: 'Everett', address: 'Synthetic', region: 'North Sound' },
  { id: 'tacoma', name: 'Tacoma', city: 'Tacoma', address: 'Synthetic', region: 'South Sound' },
];
const person = (id: string, name: string, storeId: string, department: string): Employee => ({ id, name, storeId, department, role: department === 'Sales' ? 'Sales Associate' : 'Operations Associate', managerId: null, accessRole: 'employee' });
const employees: Employee[] = [
  person('alex', 'Alex Morgan', 'seattle', 'Sales'),
  person('rachel', 'Rachel Chen', 'seattle', 'Operations'),
  person('mei', 'Mei Lin', 'bellevue', 'Sales'),
  person('omar', 'Omar Farouk', 'bellevue', 'Inventory'),
  person('elodie', 'Élodie Laurent', 'everett', 'Sales'),
  person('sami', 'Sami Ahmady', 'tacoma', 'Operations'),
];
const ids = (people: Employee[]) => people.map(employee => employee.id);

test('region selects its stores and department combines across those stores', () => {
  assert.deepEqual(ids(matchAudience(employees, stores, { region: 'Seattle & Eastside' })), ['alex', 'rachel', 'mei', 'omar']);
  assert.deepEqual(ids(matchAudience(employees, stores, { region: 'Seattle & Eastside', department: 'Sales' })), ['alex', 'mei']);
  assert.deepEqual(ids(matchAudience(employees, stores, { department: 'Sales' })), ['alex', 'mei', 'elodie']);
});

test('store, region, and department use AND matching, including no-match groups', () => {
  assert.deepEqual(ids(matchAudience(employees, stores, { region: 'Seattle & Eastside', storeId: 'bellevue', department: 'Sales' })), ['mei']);
  assert.deepEqual(matchAudience(employees, stores, { region: 'Seattle & Eastside', storeId: 'everett' }), []);
  assert.deepEqual(matchAudience(employees, stores, { region: 'South Sound', department: 'Inventory' }), []);
});

test('manual selection can mix departments and regions while retaining the chosen group', () => {
  const salesGroup = ids(matchAudience(employees, stores, { region: 'Seattle & Eastside', department: 'Sales' }));
  const withInventory = toggleSelection(salesGroup, 'omar', employees);
  const withNorthSound = toggleSelection(withInventory, 'elodie', employees);
  assert.deepEqual(withNorthSound, ['alex', 'mei', 'omar', 'elodie']);
  assert.deepEqual(toggleSelection(withNorthSound, 'mei', employees), ['alex', 'omar', 'elodie']);
  assert.deepEqual(salesGroup, ['alex', 'mei'], 'editing individuals must not mutate the source group snapshot');
});

test('search locates people without silently adding or removing selected IDs', () => {
  const selected = ['alex', 'omar'];
  assert.deepEqual(ids(matchAudience(employees, stores, { query: 'Elodie Laurent' })), ['elodie']);
  assert.deepEqual(ids(matchAudience(employees, stores, { query: 'OMAR' })), ['omar']);
  assert.deepEqual(selected, ['alex', 'omar']);
  assert.deepEqual(addToSelection(selected, matchAudience(employees, stores, { query: 'Elodie' }), employees), ['alex', 'omar', 'elodie']);
});

test('directory group matching stays inside an outer workspace store scope', () => {
  const scoped = employees.filter(employee => employee.storeId === 'bellevue');
  assert.deepEqual(ids(matchAudience(scoped, stores, { region: 'Seattle & Eastside', department: 'Sales' })), ['mei']);
  assert.deepEqual(matchAudience(scoped, stores, { region: 'North Sound' }), []);
});

test('selection helpers reject unknown IDs, remove duplicates, and identify an unchosen group', () => {
  assert.deepEqual(validSelection(['alex', 'unknown', 'alex', 'mei'], employees), ['alex', 'mei']);
  assert.deepEqual(toggleSelection(['alex'], 'unknown', employees), ['alex']);
  assert.deepEqual(addToSelection(['alex'], [employees[0], employees[2]], employees), ['alex', 'mei']);
  assert.equal(hasGroupFilter({ region: 'all', storeId: 'all', department: 'all' }), false);
  assert.equal(hasGroupFilter({ region: 'North Sound' }), true);
  assert.equal(storeRegion({ ...stores[0], region: undefined }), 'Other locations');
});

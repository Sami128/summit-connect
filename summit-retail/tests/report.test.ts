import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildResponseReport } from '../src/lib/report';

test('response CSV includes employee identity, store, saved read/confirmation times, and pending blanks', () => {
  const csv = buildResponseReport([
    { employee: { id: 'EMP-0003', name: 'Alex Morgan', storeId: 'store-1' }, receipt: { readAt: '2026-11-01T01:20:00.000Z', acknowledgedAt: '2026-11-01T01:21:00.000Z' } },
    { employee: { id: 'EMP-0007', name: 'Amara Okafor', storeId: 'store-2' }, receipt: { readAt: '2026-11-01T01:22:00.000Z', acknowledgedAt: null } },
    { employee: { id: 'EMP-0008', name: 'Diego Álvarez', storeId: 'unknown-store' } },
  ], [{ id: 'store-1', name: 'Downtown Seattle' }, { id: 'store-2', name: 'Bellevue' }]);
  assert.equal(csv, '"Employee ID","Name","Store","Read at","Acknowledged at"\n"EMP-0003","Alex Morgan","Downtown Seattle","2026-11-01T01:20:00.000Z","2026-11-01T01:21:00.000Z"\n"EMP-0007","Amara Okafor","Bellevue","2026-11-01T01:22:00.000Z",""\n"EMP-0008","Diego Álvarez","","",""');
});

test('response CSV preserves commas, embedded quotes, newlines, and Unicode inside quoted fields', () => {
  const csv = buildResponseReport([
    { employee: { id: 'EMP-0042', name: 'Élodie "Ellie", Laurent\nSales', storeId: 'store-1' } },
  ], [{ id: 'store-1', name: 'Seattle, "Flagship"' }]);
  assert.equal(csv, '"Employee ID","Name","Store","Read at","Acknowledged at"\n"EMP-0042","Élodie ""Ellie"", Laurent\nSales","Seattle, ""Flagship""","",""');
});

test('response CSV protects spreadsheet formula prefixes in any exported text column', () => {
  const csv = buildResponseReport([
    { employee: { id: '=1+1', name: '+SUM(1,2)', storeId: 'a' } },
    { employee: { id: '-1+2', name: '@SUM(1,2)', storeId: 'b' } },
    { employee: { id: 'EMP-1', name: '\t=1+1', storeId: 'c' } },
    { employee: { id: 'EMP-2', name: '\r=1+1', storeId: 'c' } },
    { employee: { id: 'EMP-3', name: '\n=1+1', storeId: 'c' } },
    { employee: { id: 'EMP-4', name: '  =1+1', storeId: 'c' } },
  ], [{ id: 'a', name: '=1+1' }, { id: 'b', name: '+1+1' }, { id: 'c', name: 'Safe store' }]);
  assert.equal(csv, `"Employee ID","Name","Store","Read at","Acknowledged at"\n"'=1+1","'+SUM(1,2)","'=1+1","",""\n"'-1+2","'@SUM(1,2)","'+1+1","",""\n"EMP-1","'\t=1+1","Safe store","",""\n"EMP-2","'\r=1+1","Safe store","",""\n"EMP-3","'\n=1+1","Safe store","",""\n"EMP-4","'  =1+1","Safe store","",""`);
});

test('response CSV exports only supplied rows and remains a useful header-only file for no matches', () => {
  assert.equal(buildResponseReport([], []), '"Employee ID","Name","Store","Read at","Acknowledged at"');
});

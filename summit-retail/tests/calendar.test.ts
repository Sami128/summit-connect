import assert from 'node:assert/strict';
import { test } from 'node:test';
import { calendarMonthDays, shiftCalendarMonth, validateLocalDeadline } from '../src/lib/calendar';

test('calendar uses six complete Monday-first weeks, including adjacent-month dates', () => {
  const cells = calendarMonthDays('2026-11');
  assert.equal(cells.length, 42);
  assert.equal(cells[0].isoDate, '2026-10-26');
  assert.equal(cells[6].isoDate, '2026-11-01');
  assert.equal(cells.at(-1)?.isoDate, '2026-12-06');
  assert.equal(cells.filter(cell => cell.inMonth).length, 30);
  assert.equal(new Set(cells.map(cell => cell.isoDate)).size, 42);
  for (let index = 1; index < cells.length; index++) assert.equal(Date.parse(cells[index].isoDate) - Date.parse(cells[index - 1].isoDate), 86_400_000);
});

test('calendar includes leap February and starts a Monday month on its first day', () => {
  const leap = calendarMonthDays('2028-02');
  assert.ok(leap.some(cell => cell.isoDate === '2028-02-29' && cell.inMonth));
  assert.equal(leap.filter(cell => cell.inMonth).length, 29);
  assert.equal(calendarMonthDays('2027-02').filter(cell => cell.inMonth).length, 28);
  assert.equal(calendarMonthDays('2026-06')[0].isoDate, '2026-06-01');
});

test('month navigation handles year boundaries and rejects malformed or unsupported months', () => {
  assert.equal(shiftCalendarMonth('2026-12', 1), '2027-01');
  assert.equal(shiftCalendarMonth('2027-01', -1), '2026-12');
  assert.equal(shiftCalendarMonth('2026-01', 25), '2028-02');
  assert.equal(shiftCalendarMonth('0099-12', 1), '0100-01');
  for (const value of ['2026-00', '2026-13', '2026-1', '26-01', '0000-01', 'invalid']) assert.throws(() => calendarMonthDays(value), RangeError);
  assert.throws(() => shiftCalendarMonth('2026-01', 0.5), RangeError);
  assert.throws(() => shiftCalendarMonth('0001-01', -1), RangeError);
  assert.throws(() => shiftCalendarMonth('9999-12', 1), RangeError);
});

test('deadline validation rejects normalized impossible dates and malformed local times', () => {
  const now = new Date(2026, 0, 1, 8, 0).getTime();
  for (const value of ['', '2028-02-30T10:00', '2027-02-29T10:00', '2028-13-01T10:00', '2028-01-01T24:00', '2028-01-01T10:60', '2028-01-01', '2028-01-01T10:00Z', '2028-1-1T10:00']) assert.equal(validateLocalDeadline(value, now), 'Choose a valid date and time.');
  assert.equal(validateLocalDeadline('2028-02-29T10:00', now), null);
});

test('deadline validation compares future local time against a fixed clock', () => {
  const now = new Date(2030, 0, 1, 8, 0).getTime();
  assert.equal(validateLocalDeadline('2030-01-01T09:00', now), null);
  assert.equal(validateLocalDeadline('2030-01-01T08:00', now), 'Choose a future date and time.');
  assert.equal(validateLocalDeadline('2029-12-31T23:59', now), 'Choose a future date and time.');
});

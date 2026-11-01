export type CalendarCell = { isoDate: string; day: number; inMonth: boolean };

function parseMonth(value: string): { year: number; month: number } {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  const year = Number(match?.[1]);
  const month = Number(match?.[2]);
  if (!match || year < 1 || year > 9999 || month < 1 || month > 12) throw new RangeError('Use a month in YYYY-MM format.');
  return { year, month };
}

function utcDate(year: number, month: number, day: number): Date {
  const date = new Date(0);
  date.setUTCFullYear(year, month, day);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

function isoDate(date: Date): string {
  return [String(date.getUTCFullYear()).padStart(4, '0'), String(date.getUTCMonth() + 1).padStart(2, '0'), String(date.getUTCDate()).padStart(2, '0')].join('-');
}

/** Six Monday-first calendar weeks, calculated in UTC so DST never shifts a day. */
export function calendarMonthDays(month: string): CalendarCell[] {
  const parsed = parseMonth(month);
  const first = utcDate(parsed.year, parsed.month - 1, 1);
  const mondayOffset = (first.getUTCDay() + 6) % 7;
  first.setUTCDate(1 - mondayOffset);
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(first.getTime() + index * 86_400_000);
    return { isoDate: isoDate(date), day: date.getUTCDate(), inMonth: date.getUTCFullYear() === parsed.year && date.getUTCMonth() === parsed.month - 1 };
  });
}

export function shiftCalendarMonth(month: string, offset: number): string {
  const parsed = parseMonth(month);
  if (!Number.isSafeInteger(offset)) throw new RangeError('Use a whole number of months.');
  const shifted = parsed.year * 12 + parsed.month - 1 + offset;
  const year = Math.floor(shifted / 12);
  if (!Number.isSafeInteger(shifted) || year < 1 || year > 9999) throw new RangeError('The month is outside the supported range.');
  return String(year).padStart(4, '0') + '-' + String(shifted % 12 + 1).padStart(2, '0');
}

/** Validate the browser's local wall-clock selection before it is committed. */
export function validateLocalDeadline(value: string, now = Date.now()): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match || !Number.isFinite(now)) return 'Choose a valid date and time.';
  const [year, month, day, hour, minute] = match.slice(1).map(Number);
  if (year < 1 || year > 9999 || month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return 'Choose a valid date and time.';
  const calendarDate = utcDate(year, month - 1, day);
  if (calendarDate.getUTCFullYear() !== year || calendarDate.getUTCMonth() !== month - 1 || calendarDate.getUTCDate() !== day) return 'Choose a valid date and time.';
  const deadline = new Date(0);
  deadline.setFullYear(year, month - 1, day);
  deadline.setHours(hour, minute, 0, 0);
  if (deadline.getFullYear() !== year || deadline.getMonth() !== month - 1 || deadline.getDate() !== day || deadline.getHours() !== hour || deadline.getMinutes() !== minute) return 'This local time is unavailable. Choose another time.';
  return deadline.getTime() <= now ? 'Choose a future date and time.' : null;
}

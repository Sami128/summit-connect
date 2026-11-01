import type { Employee, Receipt, Store } from './types';

export type ResponseReportRow = {
  employee: Pick<Employee, 'id' | 'name' | 'storeId'>;
  receipt?: Pick<Receipt, 'readAt' | 'acknowledgedAt'>;
};

function csvCell(value: string): string {
  // Spreadsheet imports must treat employee-supplied text as text, not formulas.
  const protectedValue = /^[=+@\-\t\r\n]/.test(value) || /^\s+[=+@\-]/.test(value) ? "'" + value : value;
  return '"' + protectedValue.replaceAll('"', '""') + '"';
}

/** Export the currently displayed response rows, preserving their order and timestamps. */
export function buildResponseReport(rows: ResponseReportRow[], stores: Pick<Store, 'id' | 'name'>[]): string {
  const storeNames = new Map(stores.map(store => [store.id, store.name]));
  const values = [
    ['Employee ID', 'Name', 'Store', 'Read at', 'Acknowledged at'],
    ...rows.map(({ employee, receipt }) => [employee.id, employee.name, storeNames.get(employee.storeId) || '', receipt?.readAt || '', receipt?.acknowledgedAt || '']),
  ];
  return values.map(row => row.map(csvCell).join(',')).join('\n');
}

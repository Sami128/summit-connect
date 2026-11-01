import type { Employee, Store } from './types';

export type AudienceFilters = {
  region?: string;
  storeId?: string;
  department?: string;
  role?: string;
  query?: string;
};
type RegionalStore = Store & { region?: string };
const isSpecific = (value: string | undefined) => !!value && value !== 'all';
const normalize = (value: string) => value.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('en-US').trim();

export function storeRegion(store: RegionalStore): string {
  return store.region?.trim() || 'Other locations';
}

/** Every supplied group constraint applies; search never changes an existing selection. */
export function matchAudience(employees: Employee[], stores: RegionalStore[], filters: AudienceFilters): Employee[] {
  const storeById = new Map(stores.map(store => [store.id, store]));
  const query = normalize(filters.query || '');
  return employees.filter(employee => {
    const store = storeById.get(employee.storeId);
    return (!isSpecific(filters.region) || (store && storeRegion(store) === filters.region))
      && (!isSpecific(filters.storeId) || employee.storeId === filters.storeId)
      && (!isSpecific(filters.department) || employee.department === filters.department)
      && (!isSpecific(filters.role) || employee.role === filters.role)
      && (!query || normalize(employee.name + ' ' + employee.id + ' ' + employee.role).includes(query));
  });
}

export function validSelection(ids: string[], employees: Employee[]): string[] {
  const validIds = new Set(employees.map(employee => employee.id));
  return [...new Set(ids)].filter(id => validIds.has(id));
}

export function addToSelection(ids: string[], matches: Employee[], employees: Employee[]): string[] {
  return validSelection([...ids, ...matches.map(employee => employee.id)], employees);
}

export function toggleSelection(ids: string[], id: string, employees: Employee[]): string[] {
  return validSelection(ids.includes(id) ? ids.filter(selected => selected !== id) : [...ids, id], employees);
}

export function hasGroupFilter(filters: AudienceFilters): boolean {
  return [filters.region, filters.storeId, filters.department].some(isSpecific);
}

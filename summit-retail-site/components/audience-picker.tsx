'use client';

import { useMemo, useState } from 'react';
import { CircleCheck, Search, UserRoundCheck, Users } from 'lucide-react';
import type { Employee, Store } from '@/lib/types';
import { addToSelection, hasGroupFilter, matchAudience, storeRegion, toggleSelection, type AudienceFilters } from '@/lib/audience';
import { Avatar } from './ui';

type Props = { employees: Employee[]; stores: Store[]; selectedIds: string[]; onChange: (ids: string[]) => void };

export default function AudiencePicker({ employees, stores, selectedIds, onChange }: Props) {
  const [mode, setMode] = useState<'groups' | 'people'>(selectedIds.length ? 'people' : 'groups');
  const [filters, setFilters] = useState<AudienceFilters>({ region: 'all', storeId: 'all', department: 'all' });
  const [query, setQuery] = useState('');
  const [notice, setNotice] = useState(selectedIds.length ? 'Your selected people are ready. Add or remove anyone below.' : 'Choose a region, store, or department to select its employees.');
  const regions = useMemo(() => [...new Set(stores.map(storeRegion))].sort(), [stores]);
  const eligibleStores = stores.filter(store => filters.region === 'all' || storeRegion(store) === filters.region);
  const visible = useMemo(() => matchAudience(employees, stores, { ...(mode === 'groups' ? filters : {}), query }), [employees, stores, filters, query, mode]);
  const allVisible = visible.length > 0 && visible.every(employee => selectedIds.includes(employee.id));
  const selectedElsewhere = selectedIds.filter(id => !visible.some(employee => employee.id === id)).length;

  function groupChanged(key: 'region' | 'storeId' | 'department', value: string) {
    const next = { ...filters, [key]: value };
    if (key === 'region' && next.storeId !== 'all' && !stores.some(store => store.id === next.storeId && (value === 'all' || storeRegion(store) === value))) next.storeId = 'all';
    setFilters(next);
    if (mode === 'groups') {
      const nextMatches = hasGroupFilter(next) ? matchAudience(employees, stores, next) : [];
      onChange(nextMatches.map(employee => employee.id));
      setNotice(hasGroupFilter(next) ? nextMatches.length + ' employees selected from this group. Adjust individuals below if needed.' : 'Group filters cleared. No employees selected. Use Select all below if you want the whole team.');
    } else {
      setNotice('Filters updated. Your individual selections are unchanged.');
    }
  }
  function chooseMode(next: 'groups' | 'people') {
    setMode(next);
    setNotice(next === 'groups' ? 'Choosing a group replaces the current audience. Your existing selection stays until you change a group field.' : 'All employees are available. Add people from any department; your existing selections are kept.');
  }
  function togglePerson(id: string) {
    onChange(toggleSelection(selectedIds, id, employees)); setMode('people');
    setNotice('Individual selection updated. All employees are available so you can mix regions, stores, and departments.');
  }
  function selectVisible() {
    onChange(allVisible ? selectedIds.filter(id => !visible.some(employee => employee.id === id)) : addToSelection(selectedIds, visible, employees));
    setMode('people'); setNotice(allVisible ? 'Matching people removed from the selection.' : 'Matching people added. Existing individual selections are kept.');
  }

  return <div>
    <div className="audience-heading"><h3>Who needs to know?</h3><span className="inline-flex items-center gap-1.5" role="status"><CircleCheck size={15} />{selectedIds.length} selected</span></div>
    <div className="mb-3 grid grid-cols-2 gap-1 rounded-lg border border-[var(--line)] bg-[var(--canvas)] p-1" role="group" aria-label="Audience selection method">
      <button type="button" onClick={() => chooseMode('groups')} aria-pressed={mode === 'groups'} className={'flex min-h-11 items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-semibold ' + (mode === 'groups' ? 'bg-[var(--surface)] text-[var(--ink)] shadow-sm' : 'text-[var(--text-secondary)]')}><Users size={16} />Select by group</button>
      <button type="button" onClick={() => chooseMode('people')} aria-pressed={mode === 'people'} className={'flex min-h-11 items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-semibold ' + (mode === 'people' ? 'bg-[var(--surface)] text-[var(--ink)] shadow-sm' : 'text-[var(--text-secondary)]')}><UserRoundCheck size={16} />Select people</button>
    </div>
    <p className="mb-4 text-xs leading-6 text-[var(--text-secondary)]">{mode === 'groups' ? 'Choose a group to replace the selection, then adjust individuals.' : 'Select individuals across stores and departments.'}</p>
    {mode === 'groups' && <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
      <label className="form-label mb-0">Region<select className="field min-h-11" aria-label="Recipient region" value={filters.region} onChange={event => groupChanged('region', event.target.value)}><option value="all">All regions</option>{regions.map(region => <option key={region}>{region}</option>)}</select></label>
      <label className="form-label mb-0">Store<select className="field min-h-11" aria-label="Recipient store" value={filters.storeId} onChange={event => groupChanged('storeId', event.target.value)}><option value="all">All stores in region</option>{eligibleStores.map(store => <option key={store.id} value={store.id}>{store.name}</option>)}</select></label>
      <label className="form-label col-span-2 mb-0 sm:col-span-1">Department<select className="field min-h-11" aria-label="Recipient department" value={filters.department} onChange={event => groupChanged('department', event.target.value)}><option value="all">All departments</option>{[...new Set(employees.map(employee => employee.department))].sort().map(department => <option key={department}>{department}</option>)}</select></label>
    </div>}
    <div className="relative"><p className="sr-only" role="status" aria-live="polite">{notice}</p></div>
    <label className="search-field mb-3"><Search size={16} /><input type="search" className="min-h-8" aria-label="Search recipients" placeholder="Find a person or employee ID" value={query} onChange={event => setQuery(event.target.value)} /></label>
    <div className="select-all flex flex-wrap items-center justify-between gap-2"><label className="flex min-h-11 cursor-pointer items-center gap-2"><input type="checkbox" aria-label={'Select all ' + visible.length + ' matching employees'} checked={allVisible} disabled={!visible.length} onChange={selectVisible} /><strong>Select all {visible.length} matching employees</strong></label>{selectedIds.length > 0 && <button type="button" className="text-link min-h-11" onClick={() => { onChange([]); setNotice('Selection cleared. Group filters are kept.'); }}>Clear selection</button>}</div>
    {selectedElsewhere > 0 && <p className="mt-2 text-[11px] leading-5 text-[var(--text-secondary)]">{selectedElsewhere} selected {selectedElsewhere === 1 ? 'person is' : 'people are'} outside this list.</p>}
    <div className="recipient-list">{visible.map(person => <label key={person.id} className={'recipient-row min-h-14 ' + (selectedIds.includes(person.id) ? 'chosen' : '')}><input type="checkbox" checked={selectedIds.includes(person.id)} onChange={() => togglePerson(person.id)} aria-label={'Select ' + person.name} /><Avatar name={person.name} small /><div><strong>{person.name}</strong><span>{person.role} · {stores.find(store => store.id === person.storeId)?.name}</span></div><small>{person.id}</small></label>)}{!visible.length && <div className="empty-state"><Search size={24} /><h3>No matching people</h3><p>Try another name or choose a different group.</p>{query && <button type="button" className="text-link min-h-11" onClick={() => setQuery('')}>Clear search</button>}</div>}</div>
  </div>;
}

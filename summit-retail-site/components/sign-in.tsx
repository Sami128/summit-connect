'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, LoaderCircle, Mountain, Search, Smartphone, Users, X } from 'lucide-react';
import type { Employee, Store } from '@/lib/types';
import { Avatar } from './ui';
import ThemeToggle from './theme-toggle';

type Role = 'manager' | 'employee';
type Person = Pick<Employee, 'id' | 'name' | 'role' | 'storeId' | 'accessRole'>;
export type SignInDirectory = { identities: Person[]; stores: Store[] };
type Props = {
  onChooseRole: (role: Role) => Promise<SignInDirectory>;
  onSignIn: (employeeId: string, role: Role) => Promise<void>;
  errorMessage?: string;
};

function normalize(value: string) { return value.trim().replace(/\s+/g, ' ').normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('en-US'); }

export default function SignIn({ onChooseRole, onSignIn, errorMessage }: Props) {
  const nameGroup = useId();
  const inputId = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const requestVersion = useRef(0);
  const [role, setRole] = useState<Role | null>(null);
  const [directory, setDirectory] = useState<SignInDirectory | null>(null);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [dismissedError, setDismissedError] = useState<string | undefined>();
  const people = useMemo(() => directory?.identities.filter(person => person.accessRole === role) ?? [], [directory, role]);
  const search = normalize(query);
  const filtered = useMemo(() => people.filter(person => normalize(person.name + ' ' + person.id + ' ' + person.role).includes(search)), [people, search]);
  const exactMatches = useMemo(() => search ? people.filter(person => normalize(person.name) === search || normalize(person.id) === search) : [], [people, search]);
  const selected = people.find(person => person.id === selectedId) ?? (exactMatches.length === 1 ? exactMatches[0] : undefined);
  const visibleError = error || (errorMessage !== dismissedError ? errorMessage : '');
  const roleName = role === 'manager' ? 'Manager' : 'Associate';

  useEffect(() => () => { requestVersion.current += 1; }, []);
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, [role]);

  async function chooseRole(next: Role) {
    if (submitting) return;
    const version = ++requestVersion.current;
    setRole(next); setDirectory(null); setQuery(''); setSelectedId(null);
    setError(''); setDismissedError(errorMessage); setLoading(true);
    try {
      const result = await onChooseRole(next);
      if (version === requestVersion.current) setDirectory(result);
    } catch (cause) {
      if (version === requestVersion.current) setError(cause instanceof Error ? cause.message : 'We couldn’t load the names. Please try again.');
    } finally { if (version === requestVersion.current) setLoading(false); }
  }

  function back() {
    if (submitting) return;
    requestVersion.current += 1;
    setRole(null); setDirectory(null); setQuery(''); setSelectedId(null);
    setLoading(false); setError(''); setDismissedError(errorMessage);
  }

  function changeQuery(value: string) {
    setQuery(value); setSelectedId(null); setError(''); setDismissedError(errorMessage);
  }

  async function enterWorkspace(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!role || !selected || loading || submitting) return;
    const version = requestVersion.current;
    setSubmitting(true); setError(''); setDismissedError(errorMessage);
    try { await onSignIn(selected.id, role); }
    catch (cause) { if (version === requestVersion.current) setError(cause instanceof Error ? cause.message : 'We couldn’t open your workspace. Please try again.'); }
    finally { if (version === requestVersion.current) setSubmitting(false); }
  }

  return <main className="sign-in flex min-h-dvh flex-col justify-center bg-[var(--canvas)] px-5 py-6 text-[var(--ink)] sm:px-8 sm:py-8">
    <ThemeToggle floating />
    <div className="mx-auto w-full max-w-[440px]">
      <div className="brand mx-auto mb-6 w-fit"><span className="brand-symbol"><Mountain size={30} strokeWidth={1.7} /></span><span>summit<span className="brand-connect">connect</span></span></div>
        <section className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-[0_12px_70px_rgba(21,57,36,0.04)] dark:shadow-[0_12px_70px_rgba(0,0,0,0.15)]" aria-labelledby="sign-in-heading">
          <div className="p-5 sm:p-6">
            {role && <div className="mb-3 flex items-center justify-between"><button type="button" disabled={submitting} onClick={back} className="-ml-2 inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm text-[var(--text-secondary)] transition hover:bg-[var(--surface-raised)]"><ArrowLeft size={16} />Back</button><span className="rounded-full border border-[var(--line)] bg-[var(--canvas)] px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)]">{roleName}</span></div>}
            <h1 id="sign-in-heading" ref={heading} tabIndex={-1} className="mt-2 text-[27px] font-semibold leading-tight tracking-[-0.7px] outline-none">{role ? 'Select your name' : 'Choose your role'}</h1>
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{role ? 'Choose from the list or type your name.' : 'Select your role to continue.'}</p>

            {!role ? <div className="mt-6 space-y-3">
              <RoleCard name="Manager" description="Send updates and track responses." icon={<Users size={22} />} onClick={() => void chooseRole('manager')} />
              <RoleCard name="Associate" description="Read and confirm updates." icon={<Smartphone size={22} />} onClick={() => void chooseRole('employee')} />
            </div> : <form className="mt-4" onSubmit={enterWorkspace} aria-busy={loading || submitting}>
              {loading ? <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 text-sm text-[var(--text-secondary)]" role="status"><LoaderCircle className="animate-spin text-[#087f69] dark:text-[#74cfaa]" size={24} />Loading {role === 'manager' ? 'manager' : 'associate'} names…</div> : directory ? <>
                <label htmlFor={inputId} className="sr-only">Your name</label>
                <div className="flex min-h-12 items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--canvas)] px-3 text-[var(--text-secondary)] focus-within:border-[#6aac8d] focus-within:ring-2 focus-within:ring-[#087f69]/10 dark:focus-within:border-[#74cfaa] dark:focus-within:ring-[#74cfaa]/15"><Search size={17} className="shrink-0" /><input ref={input} id={inputId} type="search" value={query} onChange={event => changeQuery(event.target.value)} disabled={submitting} autoComplete="off" spellCheck={false} placeholder="Type your name or employee ID" aria-describedby={inputId + '-hint'} className="min-h-12 w-full min-w-0 border-0 bg-transparent text-base text-[var(--ink)] outline-none placeholder:text-sm placeholder:text-[var(--text-secondary)] [&::-webkit-search-cancel-button]:hidden" />{query && <button type="button" disabled={submitting} onClick={() => { changeQuery(''); input.current?.focus(); }} aria-label="Clear name search" className="-mr-2 flex size-11 shrink-0 items-center justify-center rounded-lg transition hover:bg-[var(--surface-raised)]"><X size={16} /></button>}</div>
                <span id={inputId + '-hint'} className="sr-only" aria-live="polite">{filtered.length} matching names</span>
                <fieldset className="relative mt-3 max-h-[220px] space-y-2 overflow-y-auto px-0.5 py-0.5 sm:max-h-[280px]" disabled={submitting}>
                  <legend className="sr-only">Choose your name</legend>
                  {filtered.map(person => <label key={person.id} className={'relative flex min-h-[64px] cursor-pointer items-center gap-3 rounded-lg border p-3 transition focus-within:ring-2 focus-within:ring-[#087f69]/30 dark:focus-within:ring-[#74cfaa]/40 ' + (selected?.id === person.id ? 'border-[#7caf8b] bg-[#eef6ed] dark:border-[#74a987] dark:bg-[#243b2d]' : 'border-[var(--line)] bg-[var(--surface)] hover:bg-[var(--surface-raised)]')}>
                    <input type="radio" className="sr-only" name={nameGroup} value={person.id} checked={selected?.id === person.id} onChange={() => { setSelectedId(person.id); setError(''); setDismissedError(errorMessage); }} aria-label={person.name + ' · ' + person.role + ' · ' + (directory.stores.find(store => store.id === person.storeId)?.name || 'Summit Retail Group')} />
                    <Avatar name={person.name} />
                    <span className="min-w-0 flex-1"><strong className="block text-sm font-semibold text-[var(--ink)]">{person.name}</strong><span className="mt-1 block text-xs leading-4 text-[var(--text-secondary)]">{person.role} · {directory.stores.find(store => store.id === person.storeId)?.name || 'Summit Retail Group'}</span></span>
                    <span aria-hidden="true" className={'flex size-5 shrink-0 items-center justify-center rounded-full border ' + (selected?.id === person.id ? 'border-[#087f69] bg-[#087f69] text-white dark:border-[#74cfaa] dark:bg-[#74cfaa] dark:text-[#13251b]' : 'border-[#cbd9ce] dark:border-[#526b5c]')}>{selected?.id === person.id && <Check size={12} strokeWidth={2.5} />}</span>
                  </label>)}
                  {!filtered.length && <div className="rounded-lg border border-dashed border-[var(--line)] px-4 py-5 text-center"><Search size={21} className="mx-auto mb-2 text-[var(--text-secondary)]" /><p className="text-sm font-semibold">No name found</p><p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">Try another spelling or ask your store manager to add you.</p><button type="button" onClick={() => changeQuery('')} className="mt-2 min-h-11 text-sm font-semibold text-[#087f69] dark:text-[#74cfaa]">Show all names</button></div>}
                </fieldset>
                <div className="mt-3 min-h-6" aria-live="polite">{selected && <p className="flex items-center gap-2 text-xs leading-5 text-[var(--text-secondary)]"><Check size={14} className="shrink-0 text-[#087f69] dark:text-[#74cfaa]" /><span>Continue as <strong className="font-semibold text-[var(--ink)]">{selected.name}</strong></span></p>}</div>
              </> : <div className="flex min-h-[175px] flex-col items-center justify-center text-center"><p className="text-sm text-[var(--text-secondary)]">Names aren’t available right now.</p><button type="button" onClick={() => void chooseRole(role)} className="mt-3 min-h-11 rounded-lg border border-[var(--line)] px-4 text-sm font-semibold text-[#087f69] transition hover:bg-[var(--surface-raised)] dark:text-[#74cfaa]">Try again</button></div>}
              {visibleError && <p className="mt-3 rounded-lg border border-[#efd7c9] bg-[#fff5ee] px-3 py-2.5 text-xs leading-5 text-[#ab5c41] dark:border-[#634332] dark:bg-[#3c2a23] dark:text-[#f1b9a0]" role="alert">{visibleError}</p>}
              <button type="submit" disabled={!selected || loading || submitting} className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border border-[#087f69] bg-[#087f69] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#066b59] disabled:cursor-not-allowed disabled:opacity-45">{submitting ? <LoaderCircle className="animate-spin" size={16} /> : <ArrowRight size={17} />}{submitting ? 'Opening your workspace…' : 'Continue'}</button>
            </form>}
            {!role && visibleError && <p className="mt-4 rounded-lg border border-[#efd7c9] bg-[#fff5ee] px-3 py-2.5 text-xs leading-5 text-[#ab5c41] dark:border-[#634332] dark:bg-[#3c2a23] dark:text-[#f1b9a0]" role="alert">{visibleError}</p>}
          </div>
        </section>
    </div>
  </main>;
}

function RoleCard({ name, description, icon, onClick }: { name: 'Manager' | 'Associate'; description: string; icon: React.ReactNode; onClick: () => void }) {
  return <button type="button" onClick={onClick} aria-label={'Continue as ' + name.toLowerCase()} className="group flex min-h-[96px] w-full items-center gap-4 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-4 text-left transition hover:border-[#78aa8b] hover:bg-[#f3f9f2] dark:hover:border-[#679979] dark:hover:bg-[#22372a]">
    <span className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-[#dfe9dc] bg-[#edf5e9] text-[#62885b] dark:border-[#344c3c] dark:bg-[#203528] dark:text-[#a7d0ae]">{icon}</span>
    <span className="min-w-0 flex-1"><strong className="block text-base font-semibold">{name}</strong><span className="mt-1 block text-sm leading-6 text-[var(--text-secondary)]">{description}</span></span>
    <ArrowRight className="shrink-0 text-[#71956b] transition group-hover:translate-x-0.5 dark:text-[#a7d0ae]" size={18} />
  </button>;
}

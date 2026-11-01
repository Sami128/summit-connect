'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownToLine, ArrowRight, ArrowUpRight, BarChart3, Check, CheckCheck, ChevronLeft, ChevronRight, CircleCheck, Clock3, Eye, FileText, LoaderCircle, Megaphone, Plus, Search, Send, ShieldCheck, Store as StoreIcon, TrendingUp, Users } from 'lucide-react';
import type { Announcement, AnnouncementInput, Bootstrap, Employee, Topic } from '@/lib/types';
import { Avatar, dateLabel, Modal, Priority, sendJSON, statsFor, LinkedText, PolicySourceNote } from './ui';
import TopicLibrary from './topic-library';
import AudiencePicker from './audience-picker';
import DateTimePicker from './date-time-picker';
import { addToSelection, matchAudience, storeRegion, toggleSelection } from '@/lib/audience';
import { buildResponseReport } from '@/lib/report';
import { confirmationRequired } from '@/lib/announcement-status';

type Props = { data: Bootstrap; view: string; onNavigate: (view: string) => void; onRefresh: () => Promise<void>; onNotify: (message: string) => void; storeFilter: string; search: string; onViewEmployee: (employeeId: string) => Promise<void> };

export default function ManagerPortal({ data, view, onNavigate, onRefresh, onNotify, storeFilter, search, onViewEmployee }: Props) {
  const [composer, setComposer] = useState(false);
  const [composerTopicId, setComposerTopicId] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [addEmployee, setAddEmployee] = useState(false);
  const [tab, setTab] = useState('All announcements');
  const visibleEmployees = data.employees.filter(e => storeFilter === 'all' || e.storeId === storeFilter);
  const visibleIds = new Set(visibleEmployees.map(e => e.id));
  const announcements = data.announcements.filter(a => (storeFilter === 'all' || a.recipientIds.some(id => visibleEmployees.some(e => e.id === id))) && (a.title + ' ' + a.body + ' ' + a.category).toLowerCase().includes(search.toLowerCase())).map(a => storeFilter === 'all' ? a : { ...a, recipientIds: a.recipientIds.filter(id => visibleIds.has(id)) }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const filteredAnnouncements = announcements.filter(a => tab !== 'Action required' || (a.requiresAcknowledgment && statsFor(a, data).pending > 0));
  const required = announcements.filter(a => statsFor(a, data).acknowledgmentTotal > 0);
  const readTotal = announcements.reduce((sum, a) => sum + statsFor(a, data).read, 0);
  const totalRecipients = announcements.reduce((sum, a) => sum + a.recipientIds.length, 0);
  const ackTotal = required.reduce((sum, a) => sum + statsFor(a, data).acknowledged, 0);
  const requiredRecipients = required.reduce((sum, a) => sum + statsFor(a, data).acknowledgmentTotal, 0);
  const readRate = totalRecipients ? Math.round(readTotal / totalRecipients * 100) : 0;
  const ackRate = requiredRecipients ? Math.round(ackTotal / requiredRecipients * 100) : 0;
  const pending = requiredRecipients - ackTotal;
  const detail = data.announcements.find(a => a.id === detailId);
  const openCompose = () => { setSelected([]); setComposerTopicId(''); setComposer(true); };
  const title = view === 'overview' ? 'Overview' : view === 'announcements' ? 'Announcements' : view === 'employees' ? 'Employees' : view === 'analytics' ? 'Analytics' : 'Topics';
  const subtitle = view === 'overview' ? 'Track announcements and outstanding confirmations.' : view === 'announcements' ? 'Send updates and track responses.' : view === 'employees' ? 'Find employees and select recipients.' : view === 'analytics' ? 'Review reads and confirmations by store.' : data.session.role === 'manager' ? 'Manage topics and their details.' : 'Read topic details.';

  return <>
    <div className="page-heading"><div><h1>{title}</h1><p>{subtitle}</p></div><div className="heading-action">{view === 'employees' ? <button className="btn btn-primary" onClick={() => setAddEmployee(true)}><Plus size={17} /> Add employee</button> : view !== 'topics' && <button className="btn btn-primary" onClick={openCompose}><Plus size={18} /> Create announcement</button>}</div></div>


    {['overview', 'analytics'].includes(view) && <div className="stats-grid"><Metric icon={<Users size={19} />} title="Total employees" value={String(visibleEmployees.length)} detail={<><span className="tiny-dot" /> Across {storeFilter === 'all' ? data.stores.length : 1} {storeFilter === 'all' ? 'stores' : 'store'}</>} tint="green" /><Metric icon={<Megaphone size={19} />} title="Announcements" value={String(announcements.length).padStart(2, '0')} detail="Sent updates" tint="blue" /><Metric icon={<Eye size={19} />} title="Read rate" value={readRate + '%'} detail={<><TrendingUp size={13} /> Of all delivered updates</>} tint="purple" /><Metric icon={<CircleCheck size={19} />} title="Confirmation rate" value={ackRate + '%'} detail={<><span className="amber-dot" /> {pending} responses outstanding</>} tint="orange" /></div>}

    {['overview', 'announcements'].includes(view) && <div className={view === 'overview' ? 'dashboard-grid' : ''}><section className="panel announcements-panel"><div className="panel-heading"><div><h2>{view === 'overview' ? 'Latest announcements' : 'All announcements'}<span className="count-tag">{announcements.length}</span></h2></div>{view === 'overview' && <button className="text-link" onClick={() => onNavigate('announcements')}>View all <ArrowUpRight size={15} /></button>}</div><div className="list-toolbar"><div className="tabs">{['All announcements', 'Action required'].map(t => <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>{t === 'Action required' ? 'Awaiting responses' : t}{t === 'Action required' && <span>{required.filter(a => statsFor(a, data).pending > 0).length}</span>}</button>)}</div><span className="list-sort"><Clock3 size={13} /> Latest first</span></div><div className="announcement-list">{filteredAnnouncements.slice(0, view === 'overview' ? 4 : undefined).map(a => <AnnouncementRow key={a.id} a={a} data={data} onClick={() => setDetailId(a.id)} />)}{!filteredAnnouncements.length && <Empty title="No matching announcements" body="Change your search or create an announcement." />}</div><div className="panel-footer"><span><ShieldCheck size={14} /> Only critical updates request confirmation.</span><span>{Math.min(filteredAnnouncements.length, view === 'overview' ? 4 : filteredAnnouncements.length)} of {filteredAnnouncements.length} updates</span></div></section>{view === 'overview' && <aside className="dashboard-aside"><StoreReach data={data} storeFilter={storeFilter} /></aside>}</div>}

    {view === 'employees' && <EmployeeDirectory data={data} employees={visibleEmployees} globalSearch={search} selected={selected} setSelected={setSelected} onCompose={() => { setComposerTopicId(''); setComposer(true); }} onViewEmployee={onViewEmployee} />}
    {view === 'analytics' && <div className="analytics-grid"><StoreReach data={data} storeFilter={storeFilter} /><section className="panel"><div className="panel-heading"><div><h2>Announcement performance</h2><p>Reads and confirmations across your delivered messages.</p></div><BarChart3 size={20} /></div><div className="performance-list">{announcements.map(a => { const s = statsFor(a, data); return <button className="performance-row" key={a.id} onClick={() => setDetailId(a.id)}><div><strong>{a.title}</strong><span>{s.total} recipients · {dateLabel(a.createdAt)}</span></div><div className="performance-bars"><div className="progress-track"><span style={{ width: s.readRate + '%' }} /></div><small>{s.readRate}% read{s.acknowledgmentTotal > 0 ? ' · ' + s.ackRate + '% confirmed' : ' · No confirmation needed'}</small></div><ChevronRight size={16} /></button>; })}</div></section></div>}
    {view === 'topics' && <TopicLibrary data={data} onRefresh={onRefresh} onNotify={onNotify} canManage={data.session.role === 'manager'} onCreateAnnouncement={data.session.role === 'manager' ? topicId => { setComposerTopicId(topicId); setSelected([]); setComposer(true); } : undefined} />}
    {composer && <ComposeModal data={data} initialSelected={selected} initialTopicId={composerTopicId} onRefresh={onRefresh} onClose={() => setComposer(false)} onSent={async () => { await onRefresh(); setComposer(false); setSelected([]); onNotify('Announcement sent.'); }} />}
    {detail && <ResponseModal a={detail} data={data} onClose={() => setDetailId(null)} onNotify={onNotify} />}
    {addEmployee && <AddEmployeeModal data={data} onClose={() => setAddEmployee(false)} onAdded={async () => { await onRefresh(); setAddEmployee(false); onNotify('Employee added to your team.'); }} />}

  </>;
}

function Metric({ icon, title, value, detail, tint }: { icon: React.ReactNode; title: string; value: string; detail: React.ReactNode; tint: string }) {
  return <div className="metric-card"><div className="metric-top"><span>{title}</span><span className={'metric-icon tint-' + tint}>{icon}</span></div><div className="metric-value">{value}</div><div className="metric-detail">{detail}</div></div>;
}
function AnnouncementRow({ a, data, onClick }: { a: Announcement; data: Bootstrap; onClick: () => void }) {
  const s = statsFor(a, data); const author = data.employees.find(e => e.id === a.authorId);
  return <button className="announcement-row" onClick={onClick}><span className={'announcement-symbol category-' + a.priority}>{a.category.toLowerCase().includes('safety') ? <ShieldCheck size={21} /> : a.category.toLowerCase().includes('policy') ? <FileText size={21} /> : <Megaphone size={21} />}</span><div className="announcement-info"><div className="announcement-meta"><span>{a.category}</span><span>·</span><span>{dateLabel(a.createdAt)}</span>{s.acknowledgmentTotal > 0 && <span className="ack-label"><CheckCheck size={12} /> Confirmation requested</span>}</div><h3>{a.title}</h3><p>{a.body}</p><div className="announcement-bottom"><span><Avatar name={author?.name || 'Summit Team'} small />{author?.name || 'Summit Team'}</span><span><Users size={12} />{s.total} recipients</span></div></div><div className="announcement-status"><Priority value={a.priority} /><span className="row-read"><Eye size={13} />{s.readRate}% read</span>{s.acknowledgmentTotal > 0 && <span className="row-pending">{s.pending} {s.pending === 1 ? 'recipient' : 'recipients'} pending</span>}</div><ChevronRight size={16} className="row-chevron" /></button>;
}
function StoreReach({ data, storeFilter }: { data: Bootstrap; storeFilter: string }) {
  return <section className="panel store-panel"><div className="panel-heading"><div><h2>Store read rates</h2></div><StoreIcon size={18} className="muted-icon" /></div><div className="store-list">{data.stores.filter(s => storeFilter === 'all' || s.id === storeFilter).map((store, i) => { const ids = new Set(data.employees.filter(e => e.storeId === store.id).map(e => e.id)); const total = data.announcements.reduce((n, a) => n + a.recipientIds.filter(id => ids.has(id)).length, 0); const read = data.receipts.filter(r => ids.has(r.employeeId) && r.readAt && data.announcements.some(a => a.id === r.announcementId && a.recipientIds.includes(r.employeeId))).length; const percent = total ? Math.round(read / total * 100) : 0; return <div className="store-reach-row" key={store.id}><span className="store-monogram">0{i + 1}</span><div><div className="store-name"><strong>{store.name}</strong><span>{percent}%</span></div><div className="progress-track"><span style={{ width: percent + '%' }} /></div><small>{ids.size} team members</small></div></div>; })}</div></section>;
}
function Empty({ title, body }: { title: string; body: string }) { return <div className="empty-state"><Search size={27} /><h3>{title}</h3><p>{body}</p></div>; }

function EmployeeDirectory({ data, employees, globalSearch, selected, setSelected, onCompose, onViewEmployee }: { data: Bootstrap; employees: Employee[]; globalSearch: string; selected: string[]; setSelected: (ids: string[]) => void; onCompose: () => void; onViewEmployee: (employeeId: string) => Promise<void> }) {
  const [query, setQuery] = useState('');
  const [region, setRegion] = useState('all');
  const [directoryStore, setDirectoryStore] = useState('all');
  const [department, setDepartment] = useState('all');
  const [role, setRole] = useState('all');
  const [page, setPage] = useState(0);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [navigationError, setNavigationError] = useState('');
  const opening = useRef(false);
  const availableStores = useMemo(() => { const ids = new Set(employees.map(employee => employee.storeId)); return data.stores.filter(store => ids.has(store.id)); }, [employees, data.stores]);
  const regions = useMemo(() => [...new Set(availableStores.map(storeRegion))].sort(), [availableStores]);
  const regionalStores = availableStores.filter(store => region === 'all' || storeRegion(store) === region);
  useEffect(() => {
    if (region !== 'all' && !regions.includes(region)) { setRegion('all'); setDirectoryStore('all'); }
    else if (directoryStore !== 'all' && !regionalStores.some(store => store.id === directoryStore)) setDirectoryStore('all');
  }, [region, regions, directoryStore, regionalStores]);
  const filtered = matchAudience(employees, data.stores, { region, storeId: directoryStore, department, role, query: query || globalSearch });
  const maxPage = Math.max(0, Math.ceil(filtered.length / 12) - 1);
  const safePage = Math.min(page, maxPage);
  const displayed = filtered.slice(safePage * 12, safePage * 12 + 12);
  const toggle = (id: string) => setSelected(toggleSelection(selected, id, data.employees));
  const allChecked = filtered.length > 0 && filtered.every(e => selected.includes(e.id));
  const singleEmployee = selected.length === 1 ? data.employees.find(e => e.id === selected[0] && e.accessRole === 'employee') : undefined;

  async function openEmployee(employee: Employee) {
    // The server checks manager access and returns a read-only employee view.
    if (data.session.role !== 'manager' || employee.accessRole !== 'employee' || opening.current) return;
    opening.current = true;
    setOpeningId(employee.id);
    setNavigationError('');
    try { await onViewEmployee(employee.id); }
    catch (error) { setNavigationError(error instanceof Error ? error.message : 'Could not open this employee portal. Please try again.'); }
    finally { opening.current = false; setOpeningId(null); }
  }

  return <section className="panel directory-panel">
    <div className="directory-toolbar">
      <label className="search-field"><Search size={16} /><input placeholder="Search by name, ID, or role…" value={query} onChange={e => { setQuery(e.target.value); setPage(0); }} aria-label="Search employees" /></label>
      <select className="field filter-select min-h-11" aria-label="Region filter" value={region} onChange={event => { const next = event.target.value; setRegion(next); setPage(0); if (directoryStore !== 'all' && !availableStores.some(store => store.id === directoryStore && (next === 'all' || storeRegion(store) === next))) setDirectoryStore('all'); }}><option value="all">All regions</option>{regions.map(item => <option key={item}>{item}</option>)}</select>
      <select className="field filter-select min-h-11" aria-label="Store filter" value={directoryStore} onChange={event => { setDirectoryStore(event.target.value); setPage(0); }}><option value="all">All stores</option>{regionalStores.map(store => <option key={store.id} value={store.id}>{store.name}</option>)}</select>
      <select className="field filter-select min-h-11" aria-label="Department filter" value={department} onChange={e => { setDepartment(e.target.value); setPage(0); }}><option value="all">All departments</option>{[...new Set(employees.map(e => e.department))].sort().map(d => <option key={d}>{d}</option>)}</select>
      <select className="field filter-select min-h-11" aria-label="Role filter" value={role} onChange={e => { setRole(e.target.value); setPage(0); }}><option value="all">All roles</option>{[...new Set(employees.map(e => e.role))].sort().map(d => <option key={d}>{d}</option>)}</select>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-3 px-5 pb-4"><p className="text-xs leading-5 text-[var(--text-secondary)]" role="status">{filtered.length} matches</p><button type="button" className="btn btn-secondary btn-small min-h-11" disabled={!filtered.length || !!openingId} onClick={() => setSelected(addToSelection(selected, filtered, data.employees))}><Users size={14} />Select matching employees</button></div>
    {data.session.role === 'manager' && <p className="directory-portal-hint">Names open a read-only view. Checkboxes select recipients.</p>}
    {selected.length > 0 && <div className="selection-bar">
      <span><CircleCheck size={17} /> {selected.length} {selected.length === 1 ? 'person' : 'people'} selected</span>
      <button className="text-link" onClick={() => setSelected([])} disabled={!!openingId}>Clear selection</button>
      <div className="employee-portal-actions ml-auto flex flex-wrap items-center gap-2">
        {data.session.role === 'manager' && singleEmployee && <button className="btn btn-secondary btn-small" onClick={() => void openEmployee(singleEmployee)} disabled={!!openingId} aria-busy={openingId === singleEmployee.id}>{openingId === singleEmployee.id ? <LoaderCircle size={14} className="animate-spin" /> : <ArrowUpRight size={14} />} {openingId === singleEmployee.id ? 'Opening portal…' : 'View employee experience'}</button>}
        <button className="btn btn-primary btn-small" onClick={onCompose} disabled={!!openingId}><Send size={14} /> Message selected</button>
      </div>
    </div>}
    {navigationError && <p className="directory-portal-error mx-5 mb-4 rounded-lg border border-[#efd7c9] bg-[#fff5ee] p-3 text-xs text-[#ab5c41] dark:border-[#634332] dark:bg-[#3c2a23] dark:text-[#f1b9a0]" role="alert">{navigationError}</p>}
    <div className="table-scroll"><table className="employee-table">
      <thead><tr><th><input type="checkbox" aria-label="Select all filtered employees" checked={allChecked} onChange={() => setSelected(allChecked ? selected.filter(id => !filtered.some(e => e.id === id)) : addToSelection(selected, filtered, data.employees))} /></th><th>Employee</th><th>Role & department</th><th>Store</th><th>Manager</th>{data.session.role === 'manager' && <th>Employee portal</th>}</tr></thead>
      <tbody>{displayed.map(e => {
        const canView = data.session.role === 'manager' && e.accessRole === 'employee';
        return <tr key={e.id} className={selected.includes(e.id) ? 'selected-row' : ''}>
          <td><input type="checkbox" checked={selected.includes(e.id)} onChange={() => toggle(e.id)} aria-label={'Select ' + e.name} /></td>
          <td><div className="employee-name"><Avatar name={e.name} /><div>{canView ? <button className="employee-portal-name rounded text-left underline decoration-[#a8c7b2] underline-offset-4 hover:decoration-[#087f69] dark:decoration-[#527a66] dark:hover:decoration-[#74cfaa]" onClick={() => void openEmployee(e)} disabled={!!openingId} title={'View ' + e.name + ' updates'}><strong>{e.name}</strong></button> : <strong>{e.name}</strong>}<span>{e.id}</span></div></div></td>
          <td><strong className="table-role">{e.role}</strong><span className="table-subtext">{e.department}</span></td>
          <td><span className="table-store"><StoreIcon size={13} />{data.stores.find(s => s.id === e.storeId)?.name}</span></td>
          <td className="manager-name">{data.employees.find(m => m.id === e.managerId)?.name || '—'}</td>
          {data.session.role === 'manager' && <td>{canView ? <button className="employee-portal-action btn btn-secondary btn-small" aria-label={'View ' + e.name + ' updates'} aria-busy={openingId === e.id} onClick={() => void openEmployee(e)} disabled={!!openingId}>{openingId === e.id ? <LoaderCircle size={13} className="animate-spin" /> : <ArrowUpRight size={13} />}<span>{openingId === e.id ? 'Opening…' : 'View updates'}</span></button> : <span className="text-[#9aa99c] dark:text-[#8da699]">—</span>}</td>}
        </tr>;
      })}</tbody>
    </table></div>
    {!filtered.length && <Empty title="No team members found" body="Try a different name or clear your filters." />}
    <div className="directory-footer"><span>{filtered.length ? safePage * 12 + 1 : 0}–{Math.min((safePage + 1) * 12, filtered.length)} of {filtered.length} employees</span><div><button className="icon-btn" disabled={safePage === 0} onClick={() => setPage(safePage - 1)} aria-label="Previous page"><ChevronLeft size={17} /></button><span>Page {safePage + 1} of {maxPage + 1}</span><button className="icon-btn" disabled={safePage === maxPage} onClick={() => setPage(safePage + 1)} aria-label="Next page"><ChevronRight size={17} /></button></div></div>
  </section>;
}

function ComposeModal({ data, initialSelected, initialTopicId, onRefresh, onClose, onSent }: { data: Bootstrap; initialSelected: string[]; initialTopicId: string; onRefresh: () => Promise<void>; onClose: () => void; onSent: () => Promise<void> }) {
  const [step, setStep] = useState(1);
  const [ids, setIds] = useState(initialSelected);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [topicId, setTopicId] = useState(initialTopicId);
  const [createdTopics, setCreatedTopics] = useState<Topic[]>([]);
  const [creatingTopic, setCreatingTopic] = useState(false);
  const [topicName, setTopicName] = useState('');
  const [topicDetails, setTopicDetails] = useState('');
  const [topicBusy, setTopicBusy] = useState(false);
  const [topicError, setTopicError] = useState('');
  const [priority, setPriority] = useState<Announcement['priority']>('routine');
  const [ack, setAck] = useState(false);
  const [draftDue, setDraftDue] = useState(() => { const deadline = new Date(Date.now() + 3 * 86400000); deadline.setMinutes(deadline.getMinutes() - deadline.getTimezoneOffset()); return deadline.toISOString().slice(0, 16); });
  const [due, setDue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const sending = useRef(false);
  const messageForm = useRef<HTMLFormElement>(null);
  const applyButton = useRef<HTMLButtonElement>(null);
  const topics = useMemo(() => [...new Map([...(data.topics || []), ...createdTopics].map(topic => [topic.id, topic])).values()], [data.topics, createdTopics]);
  const selectedTopic = topics.find(topic => topic.id === topicId);

  function openDeadlinePanel() {
    const trigger = applyButton.current;
    if (trigger?.getAttribute('aria-expanded') !== 'true') trigger?.click();
    trigger?.focus();
  }

  function invalid(message: string, field?: string) {
    setError(message);
    if (field) messageForm.current?.querySelector<HTMLElement>('[name="' + field + '"]')?.focus();
  }

  async function createTopic() {
    if (topicBusy) return;
    setTopicError(''); setError('');
    const name = topicName.trim();
    const details = topicDetails.trim();
    if (name.length < 3 || name.length > 80) { setTopicError('Use a topic name between 3 and 80 characters.'); return; }
    if (details.length < 10 || details.length > 5000) { setTopicError('Add topic details between 10 and 5,000 characters.'); return; }
    setTopicBusy(true);
    try {
      const topic = await sendJSON<Topic>('/api/topics', { name, details });
      setCreatedTopics(previous => [...previous.filter(item => item.id !== topic.id), topic]);
      setTopicId(topic.id); setCreatingTopic(false); setTopicName(''); setTopicDetails('');
      await onRefresh();
    } catch (cause) { setTopicError(cause instanceof Error ? cause.message : 'Could not create the topic. Please try again.'); }
    finally { setTopicBusy(false); }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (sending.current || topicBusy) return;
    setError('');
    if (!ids.length) { invalid('Choose at least one recipient.'); setStep(1); return; }
    if (creatingTopic) { invalid('Create the new topic or cancel topic creation before sending.', 'topicName'); return; }
    if (!selectedTopic) { invalid('Choose a topic for this announcement.', 'topicId'); return; }
    if (title.trim().length < 3 || title.trim().length > 120) { invalid('Use a title between 3 and 120 characters.', 'title'); return; }
    if (body.trim().length < 10 || body.trim().length > 5000) { invalid('Add a message between 10 and 5,000 characters.', 'body'); return; }
    if (ack && (!due || draftDue !== due)) { invalid('Apply the selected date and time before sending.'); openDeadlinePanel(); return; }
    if (ack && (!Number.isFinite(new Date(due).getTime()) || new Date(due).getTime() <= Date.now())) { invalid('Choose and apply a future confirmation deadline.'); openDeadlinePanel(); return; }
    sending.current = true;
    setBusy(true);
    try {
      await sendJSON('/api/announcements', { title: title.trim(), body: body.trim(), topicId: selectedTopic.id, category: selectedTopic.name, priority, requiresAcknowledgment: ack, recipientIds: ids, dueAt: ack && due ? new Date(due).toISOString() : null } satisfies AnnouncementInput);
      await onSent();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not send announcement.'); }
    finally { sending.current = false; setBusy(false); }
  }

  return <Modal title="Create an announcement" subtitle="Choose recipients and a topic." onClose={onClose} wide>
    <div className="compose-steps"><span className={step === 1 ? 'current' : 'completed'}><i>{step > 1 ? <Check size={13} /> : '1'}</i>Choose your audience</span><div /><span className={step === 2 ? 'current' : ''}><i>2</i>Write your message</span></div>
    <div hidden={step !== 1}>
      <div className="compose-body"><AudiencePicker employees={data.employees} stores={data.stores} selectedIds={ids} onChange={setIds} /></div>
      <div className="modal-footer"><span><Users size={15} />{ids.length} recipient{ids.length === 1 ? '' : 's'}</span><button type="button" className="btn btn-primary" disabled={!ids.length} onClick={() => setStep(2)}>Continue <ArrowRight size={16} /></button></div>
    </div>
    {step === 2 && <form ref={messageForm} onSubmit={submit} noValidate>
      <div className="compose-body">
        <div className="audience-summary"><Users size={18} /><div><strong>{ids.length} {ids.length === 1 ? 'person' : 'people'} will receive this announcement</strong><span>Delivered directly to their employee feed</span></div><button type="button" className="text-link" onClick={() => setStep(1)} disabled={busy || topicBusy}>Edit</button></div>
        <div className="mb-4">
          <label htmlFor="announcement-topic" className="form-label mb-2">Topic</label>
          <div className="flex flex-wrap items-stretch gap-2">
            <select id="announcement-topic" name="topicId" aria-label="Topic" className="field min-w-[180px] flex-1" required value={creatingTopic ? '__new_topic__' : topicId} onChange={event => { if (event.target.value === '__new_topic__') setCreatingTopic(true); else { setTopicId(event.target.value); setCreatingTopic(false); } setTopicError(''); setError(''); }} disabled={busy || topicBusy}><option value="">Choose a topic</option><option value="__new_topic__">+ Add new topic…</option>{topics.map(topic => <option key={topic.id} value={topic.id}>{topic.name}</option>)}</select>
            <button type="button" className="btn btn-secondary min-h-11" onClick={() => { setCreatingTopic(true); setTopicError(''); setError(''); }} disabled={busy || topicBusy || creatingTopic}><Plus size={15} />Add new topic</button>
          </div>
          {selectedTopic && !creatingTopic && <div className="mt-3 rounded-lg border border-[var(--line)] bg-[var(--canvas)] p-3"><details open={selectedTopic.details.length <= 280}><summary className="min-h-11 cursor-pointer text-xs font-semibold text-[var(--ink)]">Topic details · {selectedTopic.name}</summary><p className="whitespace-pre-wrap text-xs leading-6 text-[var(--text-secondary)]">{selectedTopic.details}</p></details><button type="button" className="text-link mt-2 min-h-11" onClick={() => setBody(selectedTopic.details)} disabled={busy || topicBusy || selectedTopic.details.length > 5000}><FileText size={13} />Use topic details as message</button>{selectedTopic.details.length > 5000 && <p className="mt-1 text-xs text-[var(--text-secondary)]">Write a shorter announcement message below. The full topic remains available to recipients.</p>}</div>}
          {creatingTopic && <fieldset className="mt-3 rounded-lg border border-[var(--line)] bg-[var(--canvas)] p-4" disabled={topicBusy || busy}>
            <legend className="px-1 text-sm font-semibold text-[var(--ink)]">New topic</legend>
            <p className="mb-3 text-xs leading-5 text-[var(--text-secondary)]">Your announcement draft is kept while you add a topic.</p>
            <label className="form-label">Topic name<input autoFocus name="topicName" aria-label="New topic name" className="field" maxLength={80} value={topicName} onChange={event => setTopicName(event.target.value)} placeholder="e.g. Holiday opening hours" /></label>
            <label className="form-label">Topic details<textarea aria-label="New topic details" className="field min-h-28 resize-y leading-6" rows={4} maxLength={5000} value={topicDetails} onChange={event => setTopicDetails(event.target.value)} placeholder="What should your team know about this topic?" /></label>
            {topicError && <p className="form-error" role="alert">{topicError}</p>}
            <div className="flex flex-wrap justify-end gap-2"><button type="button" className="btn btn-secondary btn-small" onClick={() => { setCreatingTopic(false); setTopicError(''); setError(''); }}>Cancel</button><button type="button" className="btn btn-primary btn-small" onClick={() => void createTopic()}>{topicBusy ? <LoaderCircle size={14} className="animate-spin" /> : <Plus size={14} />}{topicBusy ? 'Creating topic…' : 'Create topic'}</button></div>
          </fieldset>}
        </div>
        <label className="form-label">Title<input name="title" className="field" required minLength={3} maxLength={120} placeholder="Give your update a clear, helpful title" value={title} onChange={event => setTitle(event.target.value)} disabled={busy} /></label>
        <label className="form-label">Message<textarea name="body" aria-label="Message" className="field message-input" required minLength={10} maxLength={5000} rows={6} placeholder="What does your team need to know? Include any next steps." value={body} onChange={event => setBody(event.target.value)} disabled={busy} /><small className="character-count">{body.length}/5,000</small></label>
        <label className="form-label">Priority<select aria-label="Priority" className="field" value={priority} onChange={event => { const next = event.target.value as Announcement['priority']; setPriority(next); setAck(next === 'critical'); setError(''); }} disabled={busy}><option value="routine">Routine · Just keeping you informed</option><option value="important">Important · Please read</option><option value="critical">Critical · Confirmation needed</option></select></label>
        <label className="ack-checkbox"><input type="checkbox" disabled={priority !== 'critical' || busy} checked={ack} onChange={event => { setAck(event.target.checked); setError(''); }} /><span><strong>Require acknowledgment</strong><small>Request confirmations only for critical updates.</small></span><ShieldCheck size={20} /></label>
        {ack && <div className="deadline-field">
          <label className="form-label" htmlFor="confirmation-deadline">Confirm by</label>
          <DateTimePicker value={due} draftValue={draftDue} onDraftChange={value => { setDraftDue(value); setError(''); }} onApply={value => { setDue(value); setError(''); }} triggerRef={applyButton} disabled={busy} />
        </div>}
        {error && <p className="form-error" role="alert">{error}</p>}
      </div><div className="modal-footer"><button className="btn btn-secondary" type="button" disabled={busy || topicBusy} onClick={() => setStep(1)}><ChevronLeft size={15} />Back</button><button className="btn btn-primary" disabled={busy || topicBusy} type="submit"><Send size={16} />{busy ? 'Sending…' : 'Send announcement'}</button></div>
    </form>}
  </Modal>;
}

function ResponseModal({ a, data, onClose, onNotify }: { a: Announcement; data: Bootstrap; onClose: () => void; onNotify: (m: string) => void }) {
  const [filter, setFilter] = useState('all'); const [query, setQuery] = useState(''); const s = statsFor(a, data);
  const topic = (data.topics || []).find(item => item.id === a.topicId);
  const recipients = a.recipientIds.map(id => ({ employee: data.employees.find(e => e.id === id), receipt: data.receipts.find(r => r.announcementId === a.id && r.employeeId === id) })).filter((row): row is typeof row & { employee: Employee } => !!row.employee).map(row => ({ ...row, requiresConfirmation: confirmationRequired(a, row.employee, data.employees) })).filter(({ employee, receipt, requiresConfirmation }) => employee.name.toLowerCase().includes(query.toLowerCase()) && (filter === 'all' || (filter === 'pending' ? requiresConfirmation && !receipt?.acknowledgedAt : filter === 'acknowledged' ? requiresConfirmation && !!receipt?.acknowledgedAt : !!receipt?.readAt)));
  function download() {
    const csv = buildResponseReport(recipients.map(({ employee, receipt, requiresConfirmation }) => ({ employee, receipt: receipt && !requiresConfirmation ? { ...receipt, acknowledgedAt: null } : receipt })), data.stores);
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'summit-announcement-responses.csv';
    link.hidden = true;
    document.body.appendChild(link);
    try { link.click(); onNotify('Response report ready.'); }
    finally {
      link.remove();
      // Give the browser time to start reading the Blob before releasing it.
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  }
  return <Modal title={a.title} subtitle={'Sent ' + dateLabel(a.createdAt, true) + ' · ' + s.total + (s.total === 1 ? ' recipient' : ' recipients')} onClose={onClose} wide><div className="detail-message"><div><Priority value={a.priority} /><span className="detail-category">{topic?.name || a.category}</span></div>{topic && <details className="mt-4 rounded-lg border border-[var(--line)] bg-[var(--canvas)] p-3"><summary className="min-h-11 cursor-pointer text-xs font-semibold text-[var(--ink)]">About this topic</summary><p className="whitespace-pre-wrap text-xs leading-6 text-[var(--text-secondary)]">{topic.details}</p></details>}<p><LinkedText text={a.body} /></p><PolicySourceNote body={a.body} />{a.dueAt && s.acknowledgmentTotal > 0 && <span className="due-text"><Clock3 size={14} /> Recipient confirmations due {dateLabel(a.dueAt, true)}</span>}</div><div className="response-stats"><div><strong>{s.total}</strong><span>Recipients</span></div><div><strong>{s.read}</strong><span>Read</span></div><div><strong>{s.acknowledgmentTotal > 0 ? s.acknowledged : '—'}</strong><span>Confirmed</span></div><div><strong className="amber-text">{s.acknowledgmentTotal > 0 ? s.pending : '—'}</strong><span>Pending confirmation</span></div></div><div className="response-toolbar"><label className="search-field"><Search size={15} /><input placeholder="Find an employee" aria-label="Search responses" value={query} onChange={e => setQuery(e.target.value)} /></label><select className="field" aria-label="Response status" value={filter} onChange={e => setFilter(e.target.value)}><option value="all">All responses</option><option value="read">Has read</option>{s.acknowledgmentTotal > 0 && <><option value="acknowledged">Confirmed</option><option value="pending">Pending confirmation</option></>}</select><button className="icon-btn" aria-label="Download response report" onClick={download}><ArrowDownToLine size={17} /></button></div><div className="responses-list">{recipients.map(({ employee, receipt, requiresConfirmation }) => <div className="response-row" key={employee.id}><Avatar name={employee.name} small /><div className="response-person"><strong>{employee.name}</strong><span>{data.stores.find(s => s.id === employee.storeId)?.name} · {employee.id}</span></div><div className="receipt-time"><span>{receipt?.readAt ? 'Read ' + dateLabel(receipt.readAt, true) : 'Not read yet'}</span><span>{requiresConfirmation && receipt?.acknowledgedAt ? 'Confirmed ' + dateLabel(receipt.acknowledgedAt, true) : requiresConfirmation ? 'Awaiting confirmation' : 'No confirmation needed'}</span></div><span className={'badge ' + (requiresConfirmation && receipt?.acknowledgedAt ? 'green' : receipt?.readAt ? 'blue' : 'neutral')}>{requiresConfirmation && receipt?.acknowledgedAt ? 'Confirmed' : receipt?.readAt ? 'Read' : 'Unread'}</span></div>)}{!recipients.length && <Empty title="No matching responses" body="Try another name or response status." />}</div><div className="modal-footer"><span className="live-caption"><span className="tiny-dot" /> Updates automatically every 4 seconds</span><button className="btn btn-secondary" onClick={onClose}>Done</button></div></Modal>;
}

function AddEmployeeModal({ data, onClose, onAdded }: { data: Bootstrap; onClose: () => void; onAdded: () => Promise<void> }) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function submit(e: React.FormEvent<HTMLFormElement>) { e.preventDefault(); const values = new FormData(e.currentTarget); setBusy(true); setError(''); try { await sendJSON('/api/employees', { name: values.get('name'), role: values.get('role'), department: values.get('department'), storeId: values.get('storeId'), managerId: values.get('managerId') || null }); await onAdded(); } catch (e) { setError(e instanceof Error ? e.message : 'Could not add employee.'); } finally { setBusy(false); } }
  return <Modal title="Add employee" onClose={onClose}><form onSubmit={submit}><div className="compose-body"><label className="form-label">Full name<input className="field" name="name" required minLength={2} maxLength={80} placeholder="e.g. Jordan Parker" /></label><div className="form-grid"><label className="form-label">Role<input className="field" name="role" required maxLength={80} placeholder="e.g. Sales Associate" /></label><label className="form-label">Department<select className="field" name="department">{[...new Set(data.employees.map(e => e.department))].sort().map(d => <option key={d}>{d}</option>)}</select></label></div><label className="form-label">Store<select className="field" name="storeId">{data.stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label className="form-label">Reports to<select className="field" name="managerId"><option value="">Assign store manager automatically</option>{data.employees.filter(e => e.accessRole === 'manager').map(e => <option key={e.id} value={e.id}>{e.name} · {e.role}</option>)}</select></label><p className="inline-note"><ShieldCheck size={16} /> An employee ID is generated automatically. They will be available for future announcements.</p>{error && <p role="alert" className="form-error">{error}</p>}</div><div className="modal-footer"><button className="btn btn-secondary" type="button" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={busy} type="submit"><Plus size={16} />{busy ? 'Adding…' : 'Add employee'}</button></div></form></Modal>;
}

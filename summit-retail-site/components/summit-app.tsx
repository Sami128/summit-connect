'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Bell, BookOpen, ChartNoAxesCombined, Check, ChevronDown, CircleHelp, Eye, Inbox, LayoutDashboard, LoaderCircle, LogOut, Megaphone, Menu, Search, ShieldCheck, Store, Users, WifiOff, X } from 'lucide-react';
import type { Bootstrap } from '@/lib/types';
import ManagerPortal from './manager-portal';
import EmployeePortal from './employee-portal';
import ThemeToggle from './theme-toggle';
import SignIn, { type SignInDirectory } from './sign-in';
import { Avatar, Modal, sendJSON, statsFor } from './ui';
import { confirmationRequired } from '@/lib/announcement-status';

type PreviewResponse = { data: Bootstrap; manager: { id: string; name: string } };
const navigation = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'announcements', label: 'Announcements', icon: Megaphone },
  { id: 'my-updates', label: 'My updates', icon: Inbox },
  { id: 'employees', label: 'Employees', icon: Users },
  { id: 'analytics', label: 'Analytics', icon: ChartNoAxesCombined },
  { id: 'topics', label: 'Topics', icon: BookOpen },
];

export default function SummitApp() {
  const router = useRouter();
  const pathname = usePathname();
  const [data, setData] = useState<Bootstrap | null>(null);
  const [nameEntry, setNameEntry] = useState(false);
  const [unauthorized, setUnauthorized] = useState(false);
  const [view, setView] = useState('overview');
  const [error, setError] = useState('');
  const [storeFilter, setStoreFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState('');
  const [mobileMenu, setMobileMenu] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [preview, setPreview] = useState<Bootstrap | null>(null);
  const [previewError, setPreviewError] = useState('');
  const signedIn = useRef(false);
  const requestSequence = useRef(0);
  const previewId = useRef<string | null>(null);

  const refreshPreview = useCallback(async () => {
    const id = previewId.current;
    if (!id) return;
    try {
      const result = await sendJSON<PreviewResponse>('/api/employee-preview', { employeeId: id });
      if (previewId.current === id) { setPreview(result.data); setPreviewError(''); }
    } catch (cause) {
      if (previewId.current === id) setPreviewError(cause instanceof Error ? cause.message : 'Could not refresh this employee view.');
    }
  }, []);

  const refresh = useCallback(async () => {
    const sequence = ++requestSequence.current;
    try {
      const response = await fetch('/api/bootstrap', { cache: 'no-store' });
      const result = await response.json() as Bootstrap & { error?: string };
      if (sequence !== requestSequence.current) return;
      if (response.status === 401) {
        signedIn.current = false;
        const entryResponse = await fetch('/api/session', { cache: 'no-store' });
        const entry = await entryResponse.json() as { demo?: boolean; error?: string };
        if (sequence !== requestSequence.current) return;
        if (!entryResponse.ok) throw new Error(entry.error || 'Could not load sign-in. Please try again.');
        setNameEntry(entry.demo === true);
        setUnauthorized(true);
        setData(null);
        setPreview(null);
        previewId.current = null;
        setError('');
        return;
      }
      if (!response.ok) throw new Error(result.error || 'Could not connect to your workspace.');
      setData(result);
      setUnauthorized(false);
      setError('');
      signedIn.current = true;
      await refreshPreview();
    } catch (cause) {
      if (sequence === requestSequence.current) setError(cause instanceof Error ? cause.message : 'Could not connect. Please try again.');
    }
  }, [refreshPreview]);

  useEffect(() => {
    void refresh();
    const interval = setInterval(() => { if (signedIn.current && document.visibilityState === 'visible') void refresh(); }, 4000);
    const focus = () => { if (signedIn.current) void refresh(); };
    window.addEventListener('focus', focus);
    document.addEventListener('visibilitychange', focus);
    return () => { clearInterval(interval); window.removeEventListener('focus', focus); document.removeEventListener('visibilitychange', focus); };
  }, [refresh]);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(''), 5500); return () => clearTimeout(timer); }, [notice]);
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        const input = document.querySelector<HTMLInputElement>('input[aria-label="Search workspace"]');
        if (input) { event.preventDefault(); input.focus(); }
      }
    };
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
  }, []);

  function closePreview() { previewId.current = null; setPreview(null); setPreviewError(''); }
  function navigate(next: string) { closePreview(); setView(next); setMobileMenu(false); setSearch(''); }
  function notify(message: string) { setNotice(message); }

  async function chooseRole(role: 'manager' | 'employee'): Promise<SignInDirectory> {
    setError('');
    const response = await fetch('/api/session?portal=' + role, { cache: 'no-store' });
    const result = await response.json() as SignInDirectory & { error?: string };
    if (!response.ok) throw new Error(result.error || 'Could not load names. Please try again.');
    return { identities: result.identities, stores: result.stores };
  }

  async function enterWorkspace(employeeId: string, role: 'manager' | 'employee') {
    setError('');
    await sendJSON('/api/session', { employeeId, role });
    setView('overview'); setSearch(''); setStoreFilter('all'); closePreview();
    const destination = role === 'manager' ? '/manager' : '/employee';
    if (pathname !== destination) {
      setData(null); setUnauthorized(false);
      router.replace(destination);
      return;
    }
    await refresh();
    if (!signedIn.current) throw new Error('Your workspace could not be opened. Please try again.');
  }

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      const response = await fetch('/api/session', { method: 'DELETE' });
      if (!response.ok) throw new Error('Could not sign out. Please try again.');
      ++requestSequence.current;
      signedIn.current = false;
      closePreview(); setAccountOpen(false); setMobileMenu(false); setHelpOpen(false);
      setData(null); setUnauthorized(false); setView('overview'); setSearch(''); setNotice('');
      if (pathname === '/') await refresh();
      else router.replace('/');
    } catch (cause) { notify(cause instanceof Error ? cause.message : 'Could not sign out.'); }
    finally { setSigningOut(false); }
  }

  async function openEmployee(employeeId: string) {
    const result = await sendJSON<PreviewResponse>('/api/employee-preview', { employeeId });
    previewId.current = employeeId;
    setPreview(result.data); setPreviewError(''); setView('employees'); setMobileMenu(false);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  if (!data) {
    if (unauthorized) return nameEntry
      ? <SignIn onChooseRole={chooseRole} onSignIn={enterWorkspace} errorMessage={error} />
      : <Login onSuccess={refresh} errorMessage={error} />;
    return <div className="loading-screen"><ThemeToggle floating /><Brand />{error ? <>
      <WifiOff size={30} /><h1>Let’s get connected.</h1><p role="alert">{error}</p>
      <button className="btn btn-primary" onClick={() => void refresh()}>Try again <ArrowRight size={16} /></button>
    </> : <><LoaderCircle className="animate-spin" size={28} /><p>Opening your workspace…</p></>}</div>;
  }

  const user = data.employees.find(employee => employee.id === data.session.employeeId);
  const manager = data.session.role === 'manager';
  const ownPending = data.announcements.filter(a => confirmationRequired(a, user, data.employees) && !data.receipts.find(r => r.announcementId === a.id && r.employeeId === data.session.employeeId)?.acknowledgedAt).length;
  const ownUnread = data.announcements.filter(a => (manager || a.recipientIds.includes(data.session.employeeId)) && !data.receipts.find(r => r.announcementId === a.id && r.employeeId === data.session.employeeId)?.readAt).length;
  const updateSummary = [ownUnread ? ownUnread + ' unread update' + (ownUnread === 1 ? '' : 's') : '', ownPending ? ownPending + ' awaiting confirmation' : ''].filter(Boolean).join(' · ') || 'You’re up to date.';
  const viewedEmployee = preview?.employees.find(employee => employee.id === preview.session.employeeId);
  const pendingCount = data.announcements.filter(announcement => manager
    ? statsFor(announcement, data).pending > 0
    : confirmationRequired(announcement, user, data.employees) && !data.receipts.find(receipt => receipt.announcementId === announcement.id && receipt.employeeId === data.session.employeeId)?.acknowledgedAt).length;

  return <div className={'app-shell ' + (!manager ? 'employee-shell' : '')}>
    <a className="skip-link" href="#main-content">Skip to content</a>
    {mobileMenu && <div className="sidebar-overlay" onClick={() => setMobileMenu(false)} />}
    <aside className={'sidebar ' + (mobileMenu ? 'sidebar-open' : '')} aria-label="Main navigation">
      <div className="brand-row"><Brand /><button className="icon-btn mobile-close" aria-label="Close navigation" onClick={() => setMobileMenu(false)}><X size={20} /></button></div>
      <div className="workspace-switch"><span className="workspace-icon"><Store size={18} /></span><span><strong>Summit Retail Group</strong><small>{manager ? 'Manager workspace' : 'Associate workspace'}</small></span></div>
      <div className="nav-section-label">WORKSPACE</div>
      <nav>{manager ? navigation.map(({ id, label, icon: Icon }) => <button key={id} className={'nav-item ' + (view === id ? 'active' : '')} onClick={() => navigate(id)} aria-current={view === id ? 'page' : undefined}>
        <Icon size={19} strokeWidth={1.75} /><span>{label}</span>{id === 'announcements' && pendingCount > 0 && <span className="nav-count">{pendingCount}</span>}{id === 'my-updates' && (ownUnread > 0 || ownPending > 0) && <span className={'nav-count ' + (ownUnread ? 'unread-count' : '')} aria-label={updateSummary}>{ownUnread || ownPending}</span>}
      </button>) : <>
        <button className={'nav-item ' + (view === 'overview' ? 'active' : '')} onClick={() => navigate('overview')} aria-current={view === 'overview' ? 'page' : undefined}><Megaphone size={19} />My updates{(ownUnread > 0 || ownPending > 0) && <span className={'nav-count ' + (ownUnread ? 'unread-count' : '')} aria-label={updateSummary}>{ownUnread || ownPending}</span>}</button>
        <button className={'nav-item ' + (view === 'topics' ? 'active' : '')} onClick={() => navigate('topics')} aria-current={view === 'topics' ? 'page' : undefined}><BookOpen size={19} />Topics</button>
      </>}</nav>
      <div className="sidebar-bottom">
        <button className="nav-item help-button" onClick={() => setHelpOpen(true)}><CircleHelp size={18} />Help<ArrowRight size={14} /></button>
        <div className="sidebar-user"><Avatar name={user?.name || 'Summit Team'} /><div><strong>{user?.name || 'Summit Team'}</strong><span>{user?.role || 'Team member'}</span></div><button className="icon-btn" aria-label="Sign out" title="Sign out" disabled={signingOut} onClick={() => void signOut()}><LogOut size={16} /></button></div>
      </div>
    </aside>
    <div className="main-shell">
      <header className="topbar">
        <button className="icon-btn mobile-toggle" aria-label="Open navigation" onClick={() => setMobileMenu(true)}><Menu size={21} /></button>
        <div className="breadcrumb"><span>Workspace</span><ChevronDown className="breadcrumb-chevron" size={12} /><strong>{preview ? 'Employee view' : manager ? navigation.find(item => item.id === view)?.label : view === 'topics' ? 'Topics' : 'My updates'}</strong></div>
        <div className="topbar-actions"><ThemeToggle />{manager && !preview && view !== 'my-updates' && <label className="top-search"><Search size={16} /><input aria-label="Search workspace" placeholder="Search workspace…" value={search} onChange={event => setSearch(event.target.value)} /><kbd>⌘ K</kbd></label>}
          <button className={'notification-button ' + (ownUnread ? 'has-unread' : '')} aria-label={'View your updates. ' + updateSummary} title={updateSummary} onClick={() => { navigate(manager ? 'my-updates' : 'overview'); notify(updateSummary); }}><Bell size={20} strokeWidth={1.7} />{(ownUnread > 0 || ownPending > 0) && <i aria-hidden="true" />}</button>
          <span className="topbar-divider" /><button className="avatar-button" aria-label="Your account" title={user?.name} onClick={() => setAccountOpen(true)}><Avatar name={user?.name || 'Summit Team'} small /></button>
        </div>
      </header>
      <main id="main-content" className="main-content">
        {manager && !preview && view !== 'my-updates' && <div className="context-row"><span className="greeting">Welcome back, {user?.name.split(' ')[0]}</span><div><label className="store-filter"><Store size={14} /><select aria-label="Filter workspace by store" value={storeFilter} onChange={event => setStoreFilter(event.target.value)}><option value="all">All stores</option>{data.stores.map(store => <option key={store.id} value={store.id}>{store.name}</option>)}</select><ChevronDown size={13} /></label><span className="today-date">{new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/Los_Angeles' }).format(new Date())}</span></div></div>}
        {error && <div className="connection-error" role="alert"><WifiOff size={16} /><span>{error} Showing the last received data.</span><button onClick={() => void refresh()}>Retry</button></div>}
        {preview && <div className="employee-view-banner"><div><Eye size={19} /><span><strong>{viewedEmployee?.name}’s employee view</strong><small>Read-only · You’re signed in as {user?.name}</small></span></div><button className="btn btn-secondary" onClick={() => { closePreview(); setView('employees'); }}><ArrowLeft size={15} />Back to employees</button></div>}
        {previewError && <div className="connection-error" role="alert"><span>{previewError}</span><button onClick={() => void refreshPreview()}>Retry</button></div>}
        {((manager && view !== 'my-updates') || view === 'topics') && <div hidden={!!preview}><ManagerPortal data={data} view={view} onNavigate={navigate} onViewEmployee={openEmployee} onRefresh={refresh} onNotify={notify} storeFilter={storeFilter} search={search} /></div>}
        {preview ? <EmployeePortal key={preview.session.employeeId + '-preview'} data={preview} readOnly onRefresh={refreshPreview} onNotify={notify} />
          : ((!manager && view !== 'topics') || (manager && view === 'my-updates')) && <EmployeePortal key={data.session.employeeId + '-associate'} data={data} onRefresh={refresh} onNotify={notify} />}
      </main>
    </div>
    {notice && <div className="toast" role="status"><span><Check size={16} /></span>{notice}<button aria-label="Dismiss notification" onClick={() => setNotice('')}><X size={15} /></button></div>}
    {accountOpen && <Modal title="Your account" onClose={() => setAccountOpen(false)}><div className="account-details"><Avatar name={user?.name || 'Summit Team'} /><h3>{user?.name}</h3><p>{user?.role}</p><span>{data.stores.find(store => store.id === user?.storeId)?.name}</span></div><div className="modal-footer"><button className="btn btn-secondary" onClick={() => setAccountOpen(false)}>Close</button><button className="btn btn-primary" disabled={signingOut} onClick={() => void signOut()}><LogOut size={16} />{signingOut ? 'Signing out…' : 'Sign out'}</button></div></Modal>}
    {helpOpen && <Modal title="Get started with Summit Connect" subtitle={manager ? 'Keep your team informed and follow up with confidence.' : 'Stay informed, ask questions, and confirm important updates.'} onClose={() => setHelpOpen(false)}><div className="help-body">
      {manager ? <ol><li><strong>Choose a topic.</strong> Open Topics to select an existing subject or add a topic name and details.</li><li><strong>Choose your audience.</strong> Search or filter Employees and select the people who need your message.</li><li><strong>Send an update.</strong> Use critical priority and request confirmation when a response matters.</li><li><strong>Follow up.</strong> Open the announcement to see each person’s read and confirmation status.</li><li><strong>Check the employee experience.</strong> Open a person’s employee view from the directory. This read-only view keeps you signed in as yourself.</li></ol> : <ol><li><strong>Read your updates.</strong> Your feed shows announcements sent to you, with outstanding confirmations first.</li><li><strong>Ask a question.</strong> Use the optional topic assistant when you need clarification.</li><li><strong>Confirm when ready.</strong> Open a critical update, read it, and confirm. Your confirmation time is saved automatically.</li></ol>}
      <div className="help-sync"><ShieldCheck size={22} /><p><strong>Always connected</strong><br />Updates refresh automatically while this page is open and when you return to it.</p></div>
    </div></Modal>}
  </div>;
}

function Brand() {
  return <div className="brand"><span className="brand-symbol"><svg width="27" height="25" viewBox="0 0 30 26" fill="none" aria-hidden="true"><path d="M3 21 13 4l10 17H3Z" stroke="currentColor" strokeWidth="2.3" strokeLinejoin="round" /><path d="m18 12 4-6 7 15h-6M9 11l4 3 3-3" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg></span><span>summit<span className="brand-connect">connect</span></span></div>;
}

function Login({ onSuccess, errorMessage }: { onSuccess: () => Promise<void>; errorMessage: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); setBusy(true); setError('');
    try { await sendJSON('/api/session', { email: form.get('email'), password: form.get('password') }); await onSuccess(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not sign in.'); }
    finally { setBusy(false); }
  }
  return <div className="login-page"><ThemeToggle floating /><Brand /><div className="login-card"><span className="login-icon"><Store size={27} /></span><div className="eyebrow">SUMMIT RETAIL GROUP</div><h1>Welcome to<br />Summit Connect</h1><p>Sign in to catch up with your store.</p><form onSubmit={submit}><label className="form-label">Work email<input name="email" type="email" required className="field" autoComplete="username" placeholder="you@summit.example" /></label><label className="form-label">Password<input name="password" type="password" required className="field" autoComplete="current-password" /></label>{(error || errorMessage) && <p className="form-error" role="alert">{error || errorMessage}</p>}<button type="submit" disabled={busy} className="btn btn-primary">{busy ? 'Signing in…' : 'Sign in'}<ArrowRight size={16} /></button></form><span className="login-footnote"><ShieldCheck size={13} /> Secure access for your Summit workspace</span></div></div>;
}

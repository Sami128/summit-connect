'use client';
import { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
import type { Announcement, AppData } from '@/lib/types';
import { acknowledgmentRecipientIds } from '@/lib/announcement-status';

export function initials(name: string) { return name.split(' ').map(n => n[0]).slice(0, 2).join(''); }
export function dateLabel(date: string | null, includeTime = false) {
  if (!date) return '—';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', ...(includeTime ? { hour: 'numeric', minute: '2-digit' } as const : {}), timeZone: 'America/Los_Angeles' }).format(new Date(date));
}
export function statsFor(a: Announcement, data: AppData) {
  const audience = new Set(a.recipientIds);
  const receipts = data.receipts.filter(r => r.announcementId === a.id && audience.has(r.employeeId));
  const read = receipts.filter(r => r.readAt).length;
  const acknowledgmentAudience = new Set(acknowledgmentRecipientIds(a, data.employees));
  const acknowledgmentTotal = acknowledgmentAudience.size;
  const acknowledged = receipts.filter(r => acknowledgmentAudience.has(r.employeeId) && r.acknowledgedAt).length;
  return { read, acknowledged, acknowledgmentTotal, total: a.recipientIds.length, pending: acknowledgmentTotal - acknowledged, readRate: a.recipientIds.length ? Math.round(read / a.recipientIds.length * 100) : 0, ackRate: acknowledgmentTotal ? Math.round(acknowledged / acknowledgmentTotal * 100) : 0 };
}
export function Priority({ value }: { value: Announcement['priority'] }) {
  return <span className={'badge priority-' + value}><span className="badge-dot" />{value === 'critical' ? 'Critical' : value === 'important' ? 'Important' : 'Routine'}</span>;
}
export function Avatar({ name, small = false }: { name: string; small?: boolean }) {
  const hue = name.split('').reduce((n, c) => n + c.charCodeAt(0), 0) % 3;
  return <span className={'avatar avatar-' + hue + (small ? ' avatar-small' : '')}>{initials(name)}</span>;
}
export function LinkedText({ text }: { text: string }) {
  return <>{text.split(/(https?:\/\/[^\s<>]+)/g).map((part, index) => /^https?:\/\//.test(part) ? <a key={index} className="underline underline-offset-4 break-words text-[#087f69] dark:text-[#74cfaa]" href={part.replace(/[.,;)]$/, '')} target="_blank" rel="noreferrer">{part}</a> : <span key={index}>{part}</span>)}</>;
}
export function PolicySourceNote({ body }: { body: string }) {
  if (!/overtime|wages?|pay/i.test(body) || !/washington|L&I|state law|state-law|RCW/i.test(body)) return null;
  return <details className="policy-reference"><summary>Supporting reference</summary><p>For accurate, current overtime information, review <a href="https://www.lni.wa.gov/workers-rights/wages/overtime/" target="_blank" rel="noreferrer">official Washington L&I guidance</a>.</p></details>;
}
export function Modal({ title, subtitle, children, onClose, wide = false }: { title: string; subtitle?: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  const titleId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const close = useRef(onClose); close.current = onClose;
  useEffect(() => {
    const d = dialog.current; const previous = document.body.style.overflow;
    d?.showModal(); document.body.style.overflow = 'hidden';
    const cancel = (e: Event) => { e.preventDefault(); close.current(); };
    d?.addEventListener('cancel', cancel);
    return () => { d?.removeEventListener('cancel', cancel); d?.close(); document.body.style.overflow = previous; };
  }, []);
  return <dialog ref={dialog} className={'modal ' + (wide ? 'modal-wide' : '')} aria-labelledby={titleId} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="modal-header"><div><h2 id={titleId}>{title}</h2>{subtitle && <p>{subtitle}</p>}</div><button className="icon-btn" onClick={onClose} aria-label="Close dialog"><X size={20} /></button></div>
    {children}
  </dialog>;
}
export async function sendJSON<T = unknown>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const result = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(result.error || 'Something went wrong. Please try again.');
  return result as T;
}

'use client';

import { useEffect, useId, useRef, useState, type RefObject } from 'react';
import { CalendarDays, Check, ChevronLeft, ChevronRight, Clock3 } from 'lucide-react';
import { calendarMonthDays, shiftCalendarMonth, validateLocalDeadline } from '@/lib/calendar';

type Props = {
  value: string;
  draftValue: string;
  onDraftChange: (value: string) => void;
  onApply: (value: string) => void;
  triggerRef: RefObject<HTMLButtonElement | null>;
  disabled?: boolean;
};
const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const labelDate = (value: string) => new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(value + 'T12:00:00Z'));
function deadlineLabel(value: string) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(new Date(value));
}

export default function DateTimePicker({ value, draftValue, onDraftChange, onApply, triggerRef, disabled }: Props) {
  const panelId = useId();
  const container = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const openingValue = useRef(draftValue);
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(draftValue.slice(0, 7));
  const [error, setError] = useState('');
  const date = draftValue.slice(0, 10);
  const hour24 = Number(draftValue.slice(11, 13));
  const hour = hour24 % 12 || 12;
  const minute = draftValue.slice(14, 16);
  const period = hour24 >= 12 ? 'PM' : 'AM';
  const cells = calendarMonthDays(month);
  const monthLabel = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(month + '-01T12:00:00Z'));

  useEffect(() => {
    if (!open) return;
    let frame = 0;
    const align = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => panel.current?.scrollIntoView({ block: 'start', behavior: 'auto' }));
    };
    align();
    const focusFrame = requestAnimationFrame(() => {
      grid.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]')?.focus({ preventScroll: true });
    });
    window.addEventListener('resize', align);
    return () => { cancelAnimationFrame(frame); cancelAnimationFrame(focusFrame); window.removeEventListener('resize', align); };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !container.current?.contains(event.target)) {
        setError(''); setOpen(false);
      }
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open, onDraftChange]);

  function cancel() { onDraftChange(openingValue.current); setError(''); setOpen(false); triggerRef.current?.focus(); }
  function toggle() {
    if (open) { cancel(); return; }
    openingValue.current = value || draftValue; setMonth(date.slice(0, 7)); setError(''); setOpen(true);
  }
  function chooseDate(next: string, focus = false) {
    onDraftChange(next + draftValue.slice(10)); setError(''); setMonth(next.slice(0, 7));
    if (focus) requestAnimationFrame(() => grid.current?.querySelector<HTMLButtonElement>('[data-date="' + next + '"]')?.focus());
  }
  function chooseTime(nextHour: number, nextMinute: string, nextPeriod: string) {
    const hour = nextHour % 12 + (nextPeriod === 'PM' ? 12 : 0);
    onDraftChange(date + 'T' + String(hour).padStart(2, '0') + ':' + nextMinute); setError('');
  }
  function moveDate(event: React.KeyboardEvent, current: string) {
    const moves: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    const offset = moves[event.key];
    if (offset === undefined) return;
    event.preventDefault();
    const next = new Date(current + 'T12:00:00Z'); next.setUTCDate(next.getUTCDate() + offset);
    chooseDate(next.toISOString().slice(0, 10), true);
  }
  function apply() {
    const validation = validateLocalDeadline(draftValue);
    if (validation) { setError(validation); return; }
    onApply(draftValue); setError(''); setOpen(false); triggerRef.current?.focus();
  }

  return <div ref={container} className="date-time-picker" onKeyDown={event => { if (open && event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); cancel(); } }}>
    <button ref={triggerRef} id="confirmation-deadline" type="button" className="field date-time-trigger" aria-label="Choose confirmation date and time" aria-expanded={open} aria-controls={panelId} onClick={toggle} disabled={disabled}><CalendarDays size={17} /><span>{value ? deadlineLabel(value) : 'Select date and time'}</span></button>
    {open && <section ref={panel} id={panelId} className="date-time-panel" aria-label="Date and time">
      <div className="date-time-heading"><strong>Date and time</strong><span>Your local time</span></div>
      <div className="calendar-navigation"><button type="button" className="icon-btn" aria-label="Previous month" onClick={() => setMonth(shiftCalendarMonth(month, -1))}><ChevronLeft size={18} /></button><strong aria-live="polite">{monthLabel}</strong><button type="button" className="icon-btn" aria-label="Next month" onClick={() => setMonth(shiftCalendarMonth(month, 1))}><ChevronRight size={18} /></button></div>
      <div ref={grid} className="calendar-grid" role="grid" aria-label={monthLabel}>
        <div className="calendar-week" role="row">{weekdays.map(day => <span key={day} role="columnheader">{day}</span>)}</div>
        {Array.from({ length: 6 }, (_, week) => <div className="calendar-week" role="row" key={week}>{cells.slice(week * 7, week * 7 + 7).map(cell => <button type="button" key={cell.isoDate} role="gridcell" data-date={cell.isoDate} aria-label={labelDate(cell.isoDate)} aria-selected={date === cell.isoDate} tabIndex={date === cell.isoDate || (!cells.some(cell => cell.isoDate === date) && cell.day === 1 && cell.inMonth) ? 0 : -1} className={'calendar-day ' + (!cell.inMonth ? 'outside-month ' : '') + (date === cell.isoDate ? 'selected' : '')} onClick={() => chooseDate(cell.isoDate)} onKeyDown={event => moveDate(event, cell.isoDate)}>{cell.day}</button>)}</div>)}
      </div>
      <div className="time-selection"><span><Clock3 size={15} />Time</span><div className="time-fields"><label>Hour<select aria-label="Hour" className="field" value={hour} onChange={event => chooseTime(Number(event.target.value), minute, period)}>{Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}</select></label><label>Minute<select aria-label="Minute" className="field" value={minute} onChange={event => chooseTime(hour, event.target.value, period)}>{Array.from({ length: 60 }, (_, index) => <option key={index} value={String(index).padStart(2, '0')}>{String(index).padStart(2, '0')}</option>)}</select></label><label>Period<select aria-label="AM or PM" className="field" value={period} onChange={event => chooseTime(hour, minute, event.target.value)}><option>AM</option><option>PM</option></select></label></div></div>
      {error && <p className="deadline-error" role="alert">{error}</p>}
      <div className="date-time-actions"><button type="button" className="btn btn-secondary" onClick={cancel}>Cancel</button><button type="button" className="btn btn-primary" onClick={apply}>Apply</button></div>
    </section>}
    {value && <p className="deadline-status deadline-applied" role="status"><Check size={14} />Applied · {deadlineLabel(value)}</p>}
    {!open && value !== draftValue && <p className="deadline-status" role="status">{value ? 'Changes not applied. Open the date and time panel to apply them.' : 'Choose a date and time, then select Apply.'}</p>}
  </div>;
}

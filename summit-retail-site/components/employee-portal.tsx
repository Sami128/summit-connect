"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Bell, Check, CheckCheck, CircleCheck, Clock3, Inbox, LoaderCircle, MapPin, Search, ShieldCheck, Sparkles, Store, X } from "lucide-react";
import { LinkedText, PolicySourceNote } from './ui';
import type { Announcement, Bootstrap, Receipt } from "@/lib/types";
import PolicyChat from "./policy-chat";
import { confirmationRequired } from '@/lib/announcement-status';

type Props = { data: Bootstrap; onRefresh: () => Promise<void>; onNotify: (message: string) => void; readOnly?: boolean };
type Filter = "all" | "action" | "updates";
const priorityOrder = { critical: 0, important: 1, routine: 2 };
function time(value: string) { return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value)); }
function day(value: string) { return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(value)); }

export default function EmployeePortal({ data, onRefresh, onNotify, readOnly = false }: Props) {
  const employee = data.employees.find((person) => person.id === data.session.employeeId);
  const store = data.stores.find((location) => location.id === employee?.storeId);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [acknowledging, setAcknowledging] = useState(false);
  const [readSuccess, setReadSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const [savedReceipts, setSavedReceipts] = useState<Record<string, Receipt>>({});
  const [assistantOpen, setAssistantOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const viewVersion = useRef(0);
  const policyArea = useRef<HTMLDivElement>(null);
  const ownReceipts = useMemo(() => {
    const receipts = new Map(data.receipts.filter(item => item.employeeId === data.session.employeeId).map(item => [item.announcementId, item]));
    for (const saved of Object.values(savedReceipts)) {
      if (saved.employeeId !== data.session.employeeId) continue;
      const latest = receipts.get(saved.announcementId);
      receipts.set(saved.announcementId, { ...saved, readAt: latest?.readAt || saved.readAt, acknowledgedAt: latest?.acknowledgedAt || saved.acknowledgedAt });
    }
    return receipts;
  }, [data.receipts, data.session.employeeId, savedReceipts]);
  const announcements = useMemo(() => data.announcements.filter(item => data.session.role === "manager" || item.recipientIds.includes(data.session.employeeId)).sort((a, b) => {
    const order = (item: Announcement) => confirmationRequired(item, employee, data.employees) && !ownReceipts.get(item.id)?.acknowledgedAt ? 0 : !ownReceipts.get(item.id)?.readAt ? 1 : 2;
    return order(a) - order(b) || priorityOrder[a.priority] - priorityOrder[b.priority] || b.createdAt.localeCompare(a.createdAt);
  }), [data.announcements, data.session.employeeId, ownReceipts, employee, data.employees, data.session.role]);
  const pending = announcements.filter((item) => confirmationRequired(item, employee, data.employees) && !ownReceipts.get(item.id)?.acknowledgedAt);
  const unread = announcements.filter((item) => !ownReceipts.get(item.id)?.readAt);
  const completed = announcements.filter((item) => confirmationRequired(item, employee, data.employees) && ownReceipts.get(item.id)?.acknowledgedAt);
  const actionTotal = pending.length + completed.length;
  const filtered = announcements.filter((item) => (filter === "all" || (filter === "action" ? confirmationRequired(item, employee, data.employees) && !ownReceipts.get(item.id)?.acknowledgedAt : !confirmationRequired(item, employee, data.employees))) && `${item.title} ${item.body} ${item.category} ${data.topics?.find(topic => topic.id === item.topicId)?.name || ""}`.toLowerCase().includes(search.toLowerCase()));
  const selected = announcements.find((item) => item.id === selectedId);
  const selectedReceipt = selectedId ? ownReceipts.get(selectedId) : null;
  const selectedRequiresConfirmation = selected ? confirmationRequired(selected, employee, data.employees) : false;
  const topics = data.topics ?? [];
  const onlyTopic = topics.length === 1 ? topics[0] : undefined;
  const selectedTopic = selected ? topics.find(topic => topic.id === selected.topicId) || (!selected.topicId && selected.id === "ann-scheduling" ? topics.find(topic => topic.kind === "scheduling") : undefined) : undefined;

  const close = useCallback(() => { viewVersion.current += 1; dialog.current?.close(); setSelectedId(null); setAssistantOpen(false); setActionError(""); setReading(false); setAcknowledging(false); }, []);
  useEffect(() => { if (employee?.accessRole === 'manager' && filter === 'action' && !pending.length) setFilter('all'); }, [employee?.accessRole, filter, pending.length]);
  useEffect(() => { viewVersion.current += 1; setSelectedId(null); setAssistantOpen(false); setReadSuccess(null); setSavedReceipts({}); setActionError(""); setReading(false); setAcknowledging(false); }, [data.session.employeeId, readOnly]);
  useEffect(() => { if (selectedId && !selected) close(); }, [selectedId, selected, close]);
  useEffect(() => {
    if (!selectedId) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.showModal();
    return () => { document.body.style.overflow = previous; };
  }, [selectedId]);

  async function markRead(item: Announcement) {
    if (readOnly) return;
    const version = viewVersion.current;
    setReading(true);
    setActionError("");
    try {
      const response = await fetch("/api/receipts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ announcementId: item.id, action: "read" }) });
      const result = await response.json() as Receipt & { error?: string };
      if (!response.ok) throw new Error(result.error || "We couldn’t record that you viewed this update.");
      if (version !== viewVersion.current) return;
      setReadSuccess(item.id);
      setSavedReceipts(previous => ({ ...previous, [item.id]: result as Receipt }));
      await onRefresh();
    } catch (cause) {
      if (version === viewVersion.current) setActionError(cause instanceof Error ? cause.message : "We couldn’t save your read receipt. Please retry.");
    } finally { if (version === viewVersion.current) setReading(false); }
  }

  function open(item: Announcement) {
    viewVersion.current += 1;
    setActionError(""); setReadSuccess(null); setAssistantOpen(false); setReading(false); setAcknowledging(false); setSelectedId(item.id);
    if (!readOnly && !ownReceipts.get(item.id)?.readAt) void markRead(item);
  }

  async function acknowledge() {
    if (readOnly || !selected || !selectedRequiresConfirmation || acknowledging || (!selectedReceipt?.readAt && readSuccess !== selected.id)) return;
    const version = viewVersion.current;
    setAcknowledging(true); setActionError("");
    try {
      const response = await fetch("/api/receipts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ announcementId: selected.id, action: "acknowledge" }) });
      const result = await response.json() as Receipt & { error?: string };
      if (!response.ok) throw new Error(result.error || "We couldn’t save your acknowledgment. Please try again.");
      if (version !== viewVersion.current) return;
      setSavedReceipts(previous => ({ ...previous, [selected.id]: result as Receipt }));
      await onRefresh();
      if (version === viewVersion.current) onNotify("Acknowledgment saved. Your manager can see your confirmation.");
    } catch (cause) { if (version === viewVersion.current) setActionError(cause instanceof Error ? cause.message : "We couldn’t save your acknowledgment. Please try again."); }
    finally { if (version === viewVersion.current) setAcknowledging(false); }
  }

  return <div className="employee-portal mx-auto max-w-[900px] pb-8">
    <div className="mb-5 flex items-start justify-between gap-3">
      <div>
        <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.8px] text-[#182c29] dark:text-[#e4eee8] sm:text-[34px]">Hi, {employee?.name.split(" ")[0] || "there"}</h1>
        <p className="mt-1.5 text-xs leading-5 text-[#65786a] dark:text-[#a7bcb0]">{store?.name || "Your store"}<span className="mx-1.5" aria-hidden="true">·</span>{employee?.role || "Team member"}</p>
      </div>
    </div>

    <div className="mb-5 grid grid-cols-3 gap-2.5 sm:gap-4"><div className="rounded-xl border border-[#e1e8e3] dark:border-[#30453b] bg-white dark:bg-[#18251f] p-3 sm:p-5"><div className="mb-2 flex items-center justify-between gap-2"><span className="text-[11px] font-medium text-[#76857e] dark:text-[#a7bcb0] sm:text-xs">Your updates</span><Bell size={15} className="text-[#889a8f] dark:text-[#a7bcb0]" /></div><div className="flex items-baseline gap-2"><strong className="text-[25px] font-semibold leading-none text-[#223c2f] dark:text-[#e4eee8]">{announcements.length}</strong></div></div><div className="rounded-xl border border-[#e2e9de] dark:border-[#30453b] bg-[#f4f8ee] dark:bg-[#203129] p-3 sm:p-5"><div className="mb-2 flex items-center justify-between gap-2"><span className="text-[11px] font-medium text-[#738367] dark:text-[#a7bcb0] sm:text-xs">{employee?.accessRole === "manager" && !pending.length ? "Read" : "To confirm"}</span><CheckCheck size={15} className="text-[#80965f] dark:text-[#ddc88e]" /></div><div className="flex items-baseline gap-2"><strong className="text-[25px] font-semibold leading-none text-[#3b5131] dark:text-[#e4eee8]">{employee?.accessRole === "manager" && !pending.length ? announcements.length - unread.length : pending.length}</strong></div></div><div className="rounded-xl border border-[#e1e8e3] dark:border-[#30453b] bg-white dark:bg-[#18251f] p-3 sm:p-5"><div className="mb-2 flex items-center justify-between gap-2"><span className="text-[11px] font-medium text-[#76857e] dark:text-[#a7bcb0] sm:text-xs">Unread</span><Inbox size={15} className="text-[#889a8f] dark:text-[#a7bcb0]" /></div><div className="flex items-baseline gap-2"><strong className="text-[25px] font-semibold leading-none text-[#223c2f] dark:text-[#e4eee8]">{unread.length}</strong></div></div></div>

    <div className="grid items-start gap-6"><div className="min-w-0">
      <div className="mb-4 flex items-center justify-between gap-2"><h2 className="text-lg font-semibold tracking-[-0.4px] text-[#243e31] dark:text-[#e4eee8]">Your updates</h2><span className="text-xs text-[#687c6f] dark:text-[#a7bcb0]" role="status">{filtered.length}{filtered.length !== announcements.length ? " of " + announcements.length : ""} updates</span></div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-1 rounded-lg border border-[#e2e8e3] dark:border-[#30453b] bg-[#edf2ee] dark:bg-[#101a17] p-1" role="group" aria-label="Filter announcements">{([{ id: "all", label: "All updates" }, { id: "action", label: "Action needed" }, { id: "updates", label: "Just for info" }] as const).filter(item => item.id !== "action" || employee?.accessRole === "employee" || pending.length > 0).map((item) => <button key={item.id} type="button" onClick={() => setFilter(item.id)} aria-pressed={filter === item.id} className={`min-h-11 rounded-md px-2.5 py-2 text-xs font-medium transition ${filter === item.id ? "bg-white dark:bg-[#18251f] text-[#284a3a] dark:text-[#e4eee8] shadow-sm" : "text-[#7d8d82] dark:text-[#a7bcb0] hover:text-[#284a3a] dark:hover:text-[#74cfaa]"}`}>{item.label}{item.id === "action" && pending.length > 0 && <span className="ml-1.5 rounded bg-[#eaf0dc] dark:bg-[#3a3822] px-1.5 py-0.5 text-[10px] text-[#6b7b42] dark:text-[#ddc88e]">{pending.length}</span>}</button>)}</div><label className="relative min-w-36 flex-1 sm:max-w-[185px]"><span className="sr-only">Search your announcements</span><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#90a096] dark:text-[#a7bcb0]" size={14} /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find an update…" className="min-h-11 w-full rounded-lg border border-[#e0e7e1] dark:border-[#30453b] bg-white dark:bg-[#18251f] py-2.5 pl-9 pr-3 text-xs text-[#3e5748] dark:text-[#e4eee8] outline-none transition placeholder:text-[#9ba79e] dark:placeholder:text-[#8da699] focus:border-[#81b49d] dark:focus:border-[#74cfaa]" /></label></div>
      <div className="space-y-4">{filtered.length === 0 ? <div className="rounded-2xl border border-dashed border-[#d5e1d8] dark:border-[#30453b] bg-white dark:bg-[#18251f] px-6 py-16 text-center"><span className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-[#f0f6ef] dark:bg-[#203129] text-[#6e937c] dark:text-[#a7bcb0]"><Inbox size={23} /></span><h3 className="font-semibold text-[#34523f] dark:text-[#e4eee8]">{search ? "No matching updates" : filter === "action" ? "You’re all caught up" : "Nothing here just yet"}</h3><p className="mt-2 text-sm text-[#819084] dark:text-[#a7bcb0]">{search ? "Try a different word or clear your search." : filter === "action" ? "All your required confirmations are complete." : "Your relevant updates will appear here."}</p>{(search || filter !== "all") && <button type="button" onClick={() => { setSearch(""); setFilter("all"); }} className="mt-5 min-h-11 text-xs font-semibold text-[#087f69] dark:text-[#74cfaa]">Show all updates <ArrowRight size={12} className="inline" /></button>}</div> : filtered.map((item) => {
        const receipt = ownReceipts.get(item.id); const requiresConfirmation = confirmationRequired(item, employee, data.employees); const acknowledged = requiresConfirmation && !!receipt?.acknowledgedAt; const isUnread = !receipt?.readAt; const critical = item.priority === "critical";
        const author = data.employees.find((person) => person.id === item.authorId);
        return <article key={item.id} data-unread={isUnread} className={`update-card overflow-hidden rounded-xl border bg-white dark:bg-[#18251f] transition hover:border-[#a7c9b4] dark:hover:border-[#527a66] hover:shadow-[0_5px_20px_rgba(25,57,38,0.04)] ${requiresConfirmation && !acknowledged ? "border-[#dce5cf] dark:border-[#30453b]" : "border-[#e1e8e3] dark:border-[#30453b]"}`}>
          {requiresConfirmation && !acknowledged && <div className="flex items-center justify-between gap-2 border-b border-[#e8eddf] dark:border-[#30453b] bg-[#f4f7ea] dark:bg-[#2c3321] px-5 py-2.5"><span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#738044] dark:text-[#ddc88e]"><ShieldCheck size={12} /> Confirmation required</span>{item.dueAt && <span className="text-[10px] text-[#6e774e] dark:text-[#ddc88e]">Confirm by {day(item.dueAt)}</span>}</div>}
          <div className="p-5 sm:p-6"><div className="mb-3 flex flex-wrap items-center gap-2"><span className={`rounded-md px-2 py-1 text-[10px] font-semibold ${critical ? "bg-[#fff1eb] dark:bg-[#3c2a23] text-[#bd7959] dark:text-[#f1b9a0]" : item.priority === "important" ? "bg-[#eff1fb] dark:bg-[#253044] text-[#7882aa] dark:text-[#b3c9ee]" : "bg-[#eef4f0] dark:bg-[#203a2c] text-[#73917d] dark:text-[#90d3ad]"}`}>{critical ? "Critical" : item.priority === "important" ? "Important" : "Routine"}</span><span className="text-[10px] font-medium text-[#687b6b] dark:text-[#a7bcb0]">{topics.find(topic => topic.id === item.topicId)?.name || item.category}</span>{isUnread && <span className="unread-marker ml-auto inline-flex items-center gap-1.5 text-[10px] font-semibold"><span aria-hidden="true" />Unread</span>}</div><button type="button" className="block min-h-11 text-left text-[19px] font-semibold leading-7 tracking-[-0.35px] text-[#253f31] dark:text-[#e4eee8] outline-offset-4 transition hover:text-[#087f69] dark:hover:text-[#74cfaa]" onClick={() => open(item)}>{item.title}</button><p className="mt-2 line-clamp-2 text-[13px] leading-[1.8] text-[#65786a] dark:text-[#a7bcb0]">{item.body}</p><div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#eff2ed] dark:border-[#30453b] pt-4"><div className="flex items-center gap-2"><span className="flex size-6 items-center justify-center rounded-full bg-[#e8eee6] dark:bg-[#294135] text-[9px] font-semibold text-[#5a755e] dark:text-[#a7bcb0]">{(author?.name || "Summit Team").split(" ").map((part) => part[0]).slice(0, 2).join("")}</span><span className="text-[10px] text-[#617567] dark:text-[#a7bcb0]">{author?.name || "Summit team"}<span className="mx-1.5 text-[#b9c3ba] dark:text-[#a7bcb0]">·</span>{day(item.createdAt)}</span></div><button type="button" onClick={() => open(item)} className={`inline-flex min-h-11 items-center gap-1.5 text-[11px] font-semibold ${acknowledged ? "text-[#6f8c77] dark:text-[#90d3ad]" : "text-[#087f69] dark:text-[#74cfaa]"}`}>{readOnly ? <>View update <ArrowRight size={13} /></> : item.authorId === data.session.employeeId ? <>View sent update <ArrowRight size={13} /></> : acknowledged ? <><CircleCheck size={13} /> Confirmed</> : requiresConfirmation ? <>Read & confirm <ArrowRight size={13} /></> : <>{receipt?.readAt ? "Read again" : "Read update"} <ArrowRight size={13} /></>}</button></div></div>
        </article>;
      })}</div>
      <p className="mt-6 flex items-center justify-center gap-2 text-[11px] text-[#6c7d71] dark:text-[#a7bcb0]"><Check size={12} /> You’re seeing updates relevant to your role and store.</p>
    </div></div>

    {selected && <dialog ref={dialog} onCancel={(event) => { event.preventDefault(); close(); }} onClick={(event) => { if (event.target === dialog.current) close(); }} aria-labelledby="announcement-dialog-title" className="fixed inset-0 m-auto max-h-[92dvh] w-[calc(100%_-_24px)] max-w-[720px] overflow-y-auto rounded-2xl border-0 bg-white dark:bg-[#18251f] p-0 text-[#294136] dark:text-[#e4eee8] shadow-2xl backdrop:bg-[#172e24]/45 dark:backdrop:bg-[#060d0a]/75">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#e7eee7] dark:border-[#30453b] bg-white/95 dark:bg-[#18251f]/95 px-6 py-4 backdrop-blur"><span className="flex items-center gap-2 text-xs font-medium text-[#819079] dark:text-[#a7bcb0]"><Bell size={14} /> {selected.authorId === data.session.employeeId ? "Your announcement" : "Announcement"}</span><button type="button" onClick={close} aria-label="Close announcement" className="flex size-11 items-center justify-center rounded-lg text-[#62745b] dark:text-[#a7bcb0] transition hover:bg-[#edf3e9] dark:hover:bg-[#294135]"><X size={19} /></button></div>
      <div className="px-6 py-7 sm:px-9"><div className="mb-4 flex flex-wrap items-center gap-2"><span className={`rounded-md px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${selected.priority === "critical" ? "bg-[#fff0e8] dark:bg-[#3c2a23] text-[#ae6d4f] dark:text-[#f1b9a0]" : "bg-[#eaf2e7] dark:bg-[#203a2c] text-[#6d8b5f] dark:text-[#90d3ad]"}`}>{selected.priority}</span><span className="text-xs text-[#697a62] dark:text-[#a7bcb0]">{selectedTopic?.name || selected.category}</span></div><h2 id="announcement-dialog-title" className="text-2xl font-semibold leading-8 tracking-[-0.5px] text-[#243d2f] dark:text-[#e4eee8]">{selected.title}</h2><p className="mt-3 text-xs text-[#697a62] dark:text-[#a7bcb0]">{data.employees.find((person) => person.id === selected.authorId)?.name || "Summit team"} <span className="mx-1">·</span> {time(selected.createdAt)}</p><div className="my-6 h-px bg-[#e8eee4] dark:bg-[#30453b]" /><div className="whitespace-pre-wrap text-[14px] leading-[1.9] text-[#6c7d63] dark:text-[#a7bcb0]"><LinkedText text={selected.body} /></div>{selectedTopic?.kind === "scheduling" && <PolicySourceNote body={selected.body} />}
        {selected.dueAt && selectedRequiresConfirmation && !selectedReceipt?.acknowledgedAt && <p className="mt-5 flex items-center gap-2 rounded-lg bg-[#faf6e9] dark:bg-[#373021] px-4 py-3 text-xs text-[#9a8a58] dark:text-[#ddc88e]"><Clock3 size={14} /> Please confirm by {time(selected.dueAt)}.</p>}
        {selectedTopic ? <div className="mt-6 rounded-xl border border-[#e3eade] dark:border-[#30453b] bg-[#f8faf5] dark:bg-[#1c2e24] p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex gap-2"><Sparkles className="mt-0.5 shrink-0 text-[#839c75] dark:text-[#a7bcb0]" size={17} /><div><p className="text-sm font-semibold text-[#59704d] dark:text-[#e4eee8]">Questions about this update?</p></div></div><button type="button" onClick={() => setAssistantOpen(!assistantOpen)} aria-expanded={assistantOpen} className="min-h-11 rounded-lg border border-[#dce6d5] dark:border-[#30453b] bg-white dark:bg-[#18251f] px-3 py-2 text-xs font-semibold text-[#6f8c5f] dark:text-[#a7bcb0]">{assistantOpen ? "Hide assistance" : "Ask a question"}</button></div><div hidden={!assistantOpen} className="mt-4"><PolicyChat topic={selectedTopic} announcementId={selected.id} /></div></div> : <p className="mt-6 text-xs leading-6 text-[#697a61] dark:text-[#a7bcb0]">Ask your store manager if you need clarification.</p>}
        {!readOnly && actionError && <div className="mt-4 rounded-lg bg-[#fff1eb] dark:bg-[#3c2a23] p-4 text-xs leading-5 text-[#a6674a] dark:text-[#f1b9a0]" role="alert"><p>{actionError}</p>{!selectedReceipt?.readAt && readSuccess !== selected.id && <button type="button" onClick={() => void markRead(selected)} disabled={reading} className="mt-2 font-semibold underline underline-offset-2">Retry saving read receipt</button>}</div>}
        <div className="mt-7 border-t border-[#e7eee1] dark:border-[#30453b] pt-5">{readOnly ? <div className="rounded-xl border border-[#dfe8df] dark:border-[#30453b] bg-[#f4f8f1] dark:bg-[#203129] p-4"><p className="text-sm font-semibold text-[#405f46] dark:text-[#e4eee8]">Associate response status</p><p className="mt-2 text-xs leading-6 text-[#63775f] dark:text-[#a7bcb0]">{selectedReceipt?.readAt ? "Read " + time(selectedReceipt.readAt) : "Not read yet"}<br />{selectedReceipt?.acknowledgedAt ? "Confirmed " + time(selectedReceipt.acknowledgedAt) : selectedRequiresConfirmation ? "Awaiting confirmation" : "No confirmation required"}</p><p className="mt-3 text-xs leading-5 text-[#63775f] dark:text-[#a7bcb0]">Preview only. Read and confirmation status belongs to this associate.</p><button type="button" onClick={close} className="mt-3 min-h-11 rounded-lg border border-[#d6e4d6] dark:border-[#3a5543] px-4 py-2 text-xs font-semibold text-[#507b56] dark:text-[#a0d8b2]">Close update</button></div> : selectedRequiresConfirmation && selectedReceipt?.acknowledgedAt ? <div className="flex items-start gap-3 rounded-xl bg-[#eaf4e5] dark:bg-[#203a2c] p-4"><CircleCheck size={21} className="mt-0.5 shrink-0 text-[#709465] dark:text-[#90d3ad]" /><div><p className="text-sm font-semibold text-[#507342] dark:text-[#90d3ad]">You’ve confirmed this update</p><p className="mt-1 text-xs leading-5 text-[#869d7b] dark:text-[#a7bcb0]">Saved {time(selectedReceipt.acknowledgedAt)}. Your manager can see your confirmation.</p></div></div> : selectedRequiresConfirmation ? <><button type="button" onClick={() => void acknowledge()} disabled={reading || acknowledging || (!selectedReceipt?.readAt && readSuccess !== selected.id)} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#087f69] dark:bg-[#087f69] px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-[#066b59] dark:hover:bg-[#066b59] disabled:cursor-not-allowed disabled:opacity-45">{acknowledging || reading ? <LoaderCircle size={16} className="animate-spin" /> : <CheckCheck size={17} />}{acknowledging ? "Saving confirmation…" : reading ? "Recording your read receipt…" : "Confirm I’ve read this"}</button><p className="mt-3 text-center text-xs leading-5 text-[#6b7b5f] dark:text-[#a7bcb0]">Your name and confirmation time will be shared with your manager.</p></> : <div className="flex items-center justify-between gap-3"><p className="flex items-center gap-1.5 text-xs text-[#8ca080] dark:text-[#a7bcb0]">{reading ? <LoaderCircle size={14} className="animate-spin" /> : <Check size={14} />}{selected.authorId === data.session.employeeId ? "You sent this update · no confirmation needed" : reading ? "Saving read receipt…" : selectedReceipt?.readAt || readSuccess === selected.id ? "Viewed · no confirmation needed" : "No confirmation needed"}</p><button type="button" onClick={close} className="min-h-11 rounded-lg bg-[#eaf2e5] dark:bg-[#294135] px-4 py-2.5 text-xs font-semibold text-[#658956] dark:text-[#90d3ad]">Done</button></div>}</div>
      </div>
    </dialog>}
  </div>;
}

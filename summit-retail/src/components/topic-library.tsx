'use client';

import { useMemo, useState } from 'react';
import { ArrowRight, BookOpen, Clock3, FolderOpen, LoaderCircle, Megaphone, Plus, Search, Send } from 'lucide-react';
import type { Bootstrap, Topic } from '@/lib/types';
import PolicyChat from './policy-chat';
import { dateLabel, Modal, sendJSON } from './ui';

type Props = {
  data: Bootstrap;
  onRefresh: () => Promise<void>;
  onNotify: (message: string) => void;
  canManage: boolean;
  onCreateAnnouncement?: (topicId: string) => void;
};
const normalize = (value: string) => value.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('en-US');

export default function TopicLibrary({ data, onRefresh, onNotify, canManage, onCreateAnnouncement }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [added, setAdded] = useState<Topic[]>([]);
  const topics = useMemo(() => [...new Map([...(data.topics || []), ...added].map(topic => [topic.id, topic])).values()], [data.topics, added]);
  const filtered = topics.filter(topic => normalize(topic.name + ' ' + topic.details).includes(normalize(search.trim())));
  const selected = filtered.find(topic => topic.id === selectedId) || filtered[0];
  const author = data.employees.find(employee => employee.id === selected?.authorId);

  async function topicAdded(topic: Topic) {
    setAdded(previous => [...previous, topic]); setSelectedId(topic.id); setSearch(''); setCreating(false);
    await onRefresh(); onNotify('Topic added. You can now use it in an announcement.');
  }

  return <>
    <div className="topics-toolbar">{canManage && <button className="btn btn-primary" onClick={() => setCreating(true)}><Plus size={17} />Add topic</button>}</div>
    <div className="topics-layout">
      <section className="panel topic-directory" aria-label="Communication topics">
        <label className="search-field"><Search size={16} /><input aria-label="Search topics" placeholder="Find a topic…" value={search} onChange={event => setSearch(event.target.value)} /></label>
        <div className="topic-list">{filtered.map(topic => <button key={topic.id} className={'topic-list-item ' + (selected?.id === topic.id ? 'active' : '')} onClick={() => setSelectedId(topic.id)} aria-pressed={selected?.id === topic.id}>
          <span className="topic-list-icon">{topic.kind === 'scheduling' ? <Clock3 size={18} /> : <Megaphone size={18} />}</span><span><strong>{topic.name}</strong><small>{topic.details.replace(/\s+/g, ' ').slice(0, 90)}</small></span><ArrowRight size={14} />
        </button>)}{!filtered.length && <div className="empty-state"><FolderOpen size={28} /><h3>{search ? 'No matching topics' : 'Your topics will appear here'}</h3><p>{search ? 'Try another word or clear your search.' : canManage ? 'Add a topic to organize your next announcement.' : 'Topics appear when an update is sent to you.'}</p>{search && <button className="text-link" onClick={() => setSearch('')}>Clear search</button>}</div>}</div>
      </section>
      <div className="topic-detail-column">{selected ? <>
        <article className="panel topic-detail"><span className="topic-resource-icon"><BookOpen size={25} /></span><h2>{selected.name}</h2><p className="topic-detail-meta">{author ? 'Added by ' + author.name : 'Summit Retail Group'} · {dateLabel(selected.createdAt)}</p><div className="topic-detail-body">{selected.details}</div>{canManage && onCreateAnnouncement && <div className="topic-detail-actions"><button className="btn btn-primary" onClick={() => onCreateAnnouncement(selected.id)}><Send size={16} />Create announcement</button></div>}</article>
        <PolicyChat key={selected.id} topic={selected} />
      </> : <section className="panel empty-state"><BookOpen size={28} /><h3>Select a topic</h3><p>Topic details and assistance will appear here.</p></section>}</div>
    </div>
    {creating && <CreateTopicModal onClose={() => setCreating(false)} onCreated={topicAdded} />}
  </>;
}

function CreateTopicModal({ onClose, onCreated }: { onClose: () => void; onCreated: (topic: Topic) => Promise<void> }) {
  const [name, setName] = useState('');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return; setBusy(true); setError('');
    try { const topic = await sendJSON<Topic>('/api/topics', { name: name.trim(), details: details.trim() }); await onCreated(topic); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not add this topic. Please try again.'); }
    finally { setBusy(false); }
  }
  return <Modal title="Add a communication topic" subtitle="Give your team a clear subject and the details they need." onClose={onClose}><form onSubmit={submit}><div className="compose-body"><label className="form-label">Topic name<input className="field" required minLength={3} maxLength={80} value={name} onChange={event => setName(event.target.value)} placeholder="e.g. New product launch" disabled={busy} /></label><label className="form-label">Topic details<textarea className="field message-input" required minLength={10} maxLength={5000} rows={7} value={details} onChange={event => setDetails(event.target.value)} placeholder="Explain the topic, what the team needs to know, and any actions or contacts." disabled={busy} /><small className="character-count">{details.length}/5,000</small></label><p className="inline-note">Employees see this topic after an announcement is sent to them.</p>{error && <p className="form-error" role="alert">{error}</p>}</div><div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>Cancel</button><button type="submit" className="btn btn-primary" disabled={busy}>{busy ? <LoaderCircle size={16} className="animate-spin" /> : <Plus size={16} />}{busy ? 'Adding…' : 'Add topic'}</button></div></form></Modal>;
}

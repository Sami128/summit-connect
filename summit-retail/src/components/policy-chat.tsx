"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ArrowUp, BookOpen, ChevronDown, ChevronUp, ExternalLink, LoaderCircle, RotateCcw, Sparkles } from "lucide-react";
import { trimConversationHistory, type ConversationMessage } from "@/lib/conversation";
import type { AssistantAnswer, Topic } from "@/lib/types";

type Exchange = { question: string; response: AssistantAnswer };
const schedulingSuggestions = ["Can I work more than 60 hours?", "Do extra hours need approval?", "What happens if I exceed the limit?"];

export default function PolicyChat({ compact = false, topic, announcementId }: { compact?: boolean; topic?: Topic; announcementId?: string }) {
  const questionId = useId();
  const scheduling = topic?.kind === "scheduling";
  const suggestions = !topic ? [] : scheduling ? schedulingSuggestions : ["Summarize this topic", "What do I need to do?"];
  const version = useRef(0);
  const request = useRef<AbortController | null>(null);
  const [question, setQuestion] = useState("");
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lastQuestion, setLastQuestion] = useState("");
  const [openSources, setOpenSources] = useState<number | null>(null);
  const latest = useRef<HTMLDivElement>(null);

  useEffect(() => {
    version.current += 1;
    request.current?.abort();
    request.current = null;
    setQuestion(""); setExchanges([]); setLoading(false); setError(""); setOpenSources(null); setLastQuestion("");
    return () => { version.current += 1; request.current?.abort(); };
  }, [topic?.id, topic?.details, announcementId]);

  function startNewConversation() {
    version.current += 1;
    request.current?.abort();
    request.current = null;
    setQuestion(""); setExchanges([]); setLoading(false); setError(""); setOpenSources(null); setLastQuestion("");
  }

  async function ask(value: string) {
    const trimmed = value.trim();
    if (!trimmed || loading || request.current || !topic) return;
    const current = ++version.current;
    const controller = new AbortController();
    request.current = controller;
    setLastQuestion(trimmed);
    setLoading(true);
    setError("");
    setQuestion(trimmed);
    try {
      const history = trimConversationHistory(exchanges.flatMap(({ question: previousQuestion, response }): ConversationMessage[] => [
        { role: "user", content: previousQuestion },
        { role: "assistant", content: response.answer },
      ]));
      const result = await fetch("/api/assistant", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed, topicId: topic.id, history, ...(announcementId ? { announcementId } : {}) }), signal: controller.signal,
      });
      const response = await result.json();
      if (!result.ok) throw new Error(response.error || "Topic assistance is unavailable. Please try again.");
      if (current !== version.current) return;
      setExchanges((previous) => [...previous, { question: trimmed, response }]);
      setQuestion("");
      requestAnimationFrame(() => latest.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
    } catch (cause) {
      if (current === version.current && !controller.signal.aborted) setError(cause instanceof Error ? cause.message : "We couldn’t get an answer. Please try again.");
    } finally {
      if (current === version.current) { request.current = null; setLoading(false); }
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-[#dde7e3] dark:border-[#30453b] bg-white dark:bg-[#18251f]" aria-label={announcementId ? "Announcement assistance" : topic ? topic.name + " assistance" : "Topic assistance"}>
      <div className="flex items-center gap-3 border-b border-[#e7eeeb] dark:border-[#30453b] bg-[#f5faf7] dark:bg-[#1c2e24] px-5 py-4">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#e2efe9] dark:bg-[#244235] text-[#087f69] dark:text-[#74cfaa]"><Sparkles size={18} /></span>
        <div className="min-w-0 flex-1"><h3 className="text-sm font-semibold text-[#182c29] dark:text-[#e4eee8]">{announcementId ? "Announcement assistance" : topic ? topic.name + " assistance" : "Topic assistance"}</h3><p className="mt-0.5 text-xs text-[#70817a] dark:text-[#a7bcb0]">{announcementId ? "Answers from this update · optional" : topic ? "Answers from this topic · optional" : "Choose a topic to ask a question"}</p></div>
        {(exchanges.length > 0 || loading || error) && <button type="button" onClick={startNewConversation} aria-label="Start new conversation" title="Start new conversation" className="flex size-11 shrink-0 items-center justify-center rounded-lg text-[#61776b] dark:text-[#a7bcb0] transition hover:bg-[#e2efe9] dark:hover:bg-[#294135] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#087f69] dark:focus-visible:outline-[#74cfaa]"><RotateCcw size={16} /></button>}
      </div>
      <div className="p-5">
        {!exchanges.length && <><p className="text-sm leading-6 text-[#64736d] dark:text-[#a7bcb0]">{announcementId ? "Ask a question about this update, or ask for a simple summary." : topic ? "Ask a question about " + topic.name + ". Answers use the details shared for this topic." : "Choose a topic to see its details and ask a question."}</p><div className={`mt-4 flex ${compact ? "flex-col items-start" : "flex-wrap"} gap-2`}>{suggestions.map((suggestion) => <button key={suggestion} type="button" onClick={() => void ask(suggestion)} disabled={loading} className="min-h-11 rounded-lg border border-[#e0e8e3] dark:border-[#30453b] bg-white dark:bg-[#18251f] px-3 py-2 text-left text-xs font-medium text-[#476159] dark:text-[#e4eee8] transition hover:border-[#82b8a5] dark:hover:border-[#527a66] hover:bg-[#f0f8f3] dark:hover:bg-[#294135] disabled:opacity-50">{suggestion}</button>)}</div></>}
        {exchanges.length > 0 && <div className="mb-4 max-h-[390px] space-y-5 overflow-y-auto pr-1" aria-live="polite">{exchanges.map(({ question: asked, response }, index) => <div key={index}>
          <p className="ml-5 rounded-xl rounded-br-sm bg-[#edf4ef] dark:bg-[#294135] px-4 py-3 text-sm font-medium leading-6 text-[#29483e] dark:text-[#e4eee8]">{asked}</p>
          <div className="mt-3 flex gap-2.5"><Sparkles className="mt-1 shrink-0 text-[#087f69] dark:text-[#74cfaa]" size={16} /><div className="min-w-0"><p className="whitespace-pre-wrap text-sm leading-6 text-[#4b6057] dark:text-[#e4eee8]">{response.answer}</p>
            {response.notice && <p className="mt-2 rounded-lg bg-[#f7f8f5] dark:bg-[#203129] px-3 py-2 text-xs leading-5 text-[#68776f] dark:text-[#a7bcb0]">{response.notice}</p>}
            {response.sources?.length > 0 && <><button type="button" className="mt-3 flex min-h-11 items-center gap-1.5 text-xs font-semibold text-[#087f69] dark:text-[#74cfaa]" aria-expanded={openSources === index} aria-controls={questionId + "-sources-" + index} onClick={() => setOpenSources(openSources === index ? null : index)}><BookOpen size={13} /> Sources <span className="text-[11px] font-normal">({response.sources.length})</span> {openSources === index ? <ChevronUp size={13} /> : <ChevronDown size={13} />}</button>
              {openSources === index && <div id={questionId + "-sources-" + index} className="mt-3 space-y-2"><p className="text-xs font-semibold text-[#617466] dark:text-[#a7bcb0]">Supporting references</p>{response.sources.map((source) => <div key={source.id} className="rounded-lg border border-[#e1e9e4] dark:border-[#30453b] p-3"><span className={`mb-1.5 inline-flex rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${source.kind === "law" ? "bg-[#eef2f9] dark:bg-[#253044] text-[#516b96] dark:text-[#b3c9ee]" : "bg-[#e9f4ed] dark:bg-[#203a2c] text-[#3e7858] dark:text-[#90d3ad]"}`}>{source.kind === "law" ? "Supporting guidance" : scheduling ? "Company policy" : "Topic details"}</span><p className="text-xs font-semibold text-[#344c41] dark:text-[#e4eee8]">{source.title}</p><p className="mt-1 text-xs leading-5 text-[#78857e] dark:text-[#a7bcb0]">{source.passage}</p>{/^https:\/\//.test(source.url) && <a href={source.url} target="_blank" rel="noreferrer" className="mt-2 inline-flex min-h-11 items-center gap-1 text-xs font-semibold text-[#087f69] dark:text-[#74cfaa]">Open reference <ExternalLink size={11} /></a>}</div>)}{response.sources.some(source => source.kind === "law") && <p className="text-[11px] leading-5 text-[#687a6d] dark:text-[#a7bcb0]">Review the linked official sources for accurate, current guidance.</p>}</div>}</>}
          </div></div>
        </div>)}<div ref={latest} /></div>}
        {loading && <p className="mb-3 flex items-center gap-2 text-xs text-[#087f69] dark:text-[#74cfaa]" role="status"><LoaderCircle size={14} className="animate-spin" /> Looking up the relevant topic details…</p>}
        {error && <div className="mb-3 rounded-lg bg-[#fff2ed] dark:bg-[#3c2a23] p-3 text-xs leading-5 text-[#a44c32] dark:text-[#f1b9a0]" role="alert"><p>{error}</p><button type="button" onClick={() => void ask(lastQuestion || question)} disabled={loading || !(lastQuestion || question).trim()} className="mt-1 min-h-11 font-semibold underline underline-offset-4">Try again</button></div>}
        <form className="mt-4" onSubmit={(event) => { event.preventDefault(); void ask(question); }}><label htmlFor={questionId} className="sr-only">{announcementId ? "Ask about this update" : topic ? "Ask about " + topic.name : "Ask a topic question"}</label><div className="flex items-end gap-2 rounded-xl border border-[#dce5df] dark:border-[#30453b] bg-white dark:bg-[#18251f] p-2 shadow-[0_2px_6px_rgba(30,58,43,0.02)] focus-within:border-[#75af99] dark:focus-within:border-[#74cfaa] focus-within:ring-2 focus-within:ring-[#087f69]/10 dark:focus-within:ring-[#74cfaa]/20"><textarea id={questionId} disabled={loading || !topic} value={question} onChange={(event) => { setQuestion(event.target.value); setError(""); }} rows={2} placeholder={announcementId ? "Ask about this update…" : topic ? "Ask about " + topic.name + "…" : "Choose a topic first…"} className="max-h-32 min-h-12 w-full resize-y bg-transparent p-2 text-sm text-[#29473b] dark:text-[#e4eee8] outline-none placeholder:text-[#8d9b94] dark:placeholder:text-[#8da699]" onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void ask(question); } }} /><button type="submit" disabled={!question.trim() || loading || !topic} aria-label="Send question" className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-[#087f69] dark:bg-[#087f69] text-white transition hover:bg-[#066653] dark:hover:bg-[#066653] disabled:opacity-40">{loading ? <LoaderCircle size={16} className="animate-spin" /> : <ArrowUp size={17} />}</button></div></form>
      </div>
    </section>
  );
}

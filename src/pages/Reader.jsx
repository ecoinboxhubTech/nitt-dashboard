import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Search, Maximize2, Share2, Quote, Pin, Copy, Download, Filter, BookmarkCheck } from "lucide-react";
import { api } from "../api.js";
import { useFetch } from "../useFetch.js";
import { label } from "../data.js";

const paras = [
  "Vessel turnaround time is the interval between a ship's arrival at the port limits and its departure after cargo operations are complete. Researchers divide it into waiting time, which is time spent at anchor before a berth is free, and service time, which is time spent at the berth.",
  "Most studies of Nigerian ports find that waiting time, not service time, explains the largest share of delay. Ships queue not because cranes are slow, but because berths are occupied by vessels whose cargo cannot be cleared from the yard.",
  "Yard congestion is therefore a cause of berth delay. When import containers stay in the stacks beyond their free days, the terminal has fewer slots for new arrivals and must slow discharge. Trucks then queue on the access roads, which delays export cargo as well.",
  "Three interventions appear repeatedly in the literature: appointment systems that tie truck calls to berth windows, extended gate hours, and faster customs release for low-risk cargo. Only the first has been measured at a Nigerian port, and the evidence is limited to a single terminal.",
  "This project tests the appointment idea on a small scale. Using records for 140 vessel calls at Apapa, it compares waiting time before and after a pilot in which trucks were scheduled against berth windows rather than called in on arrival.",
  "The pilot cannot prove that appointments caused the change. Cargo mix, weather and customs staffing varied over the period. The results should be read as an estimate to be tested again, not as a settled finding.",
];

const seedNotes = [
  { id: 1, pinned: true, time: "Today, 09:42", quote: "Waiting time, not service time, explains the largest share of delay.", body: "Key claim for the literature review. Check the sample sizes in the cited studies before relying on it.", tags: ["waiting-time", "chapter-2"] },
];
const thread = [
  { who: "Aisha Lawal", when: "1d ago", text: "The 140-call sample is small. Worth saying so in the limitations section." },
  { who: "Engr. Bello", when: "4h ago", text: "Good point. Add the turnaround figures from the port authority report as a second source." },
];

export default function Reader() {
  const { id } = useParams();
  const t = useFetch(() => api(`/catalogue/titles/${id}`), [id]);
  if (t.loading) return <div className="dash"><p className="muted" role="status">Loading…</p></div>;
  if (t.error) return <div className="dash"><h1 className="h-lg">Title not found</h1><p className="muted">{t.error.message}</p><Link to="/catalogue" className="btn btn-outline">Back to catalogue</Link></div>;
  return <ReaderView book={t.data} />;
}

function ReaderView({ book }) {
  const [theme, setTheme] = useState("parchment");
  const [size, setSize] = useState(17);
  const [sel, setSel] = useState(2);
  const [notes, setNotes] = useState(seedNotes);
  const [draft, setDraft] = useState("");
  const [tab, setTab] = useState("all");
  const [copied, setCopied] = useState(false);

  const cite = `${book.authors}, ${book.title} (${book.publisher || "n.p."}, ${book.year || "n.d."}), p. ${40 + sel}.`;
  const addNote = (quote, body) => { if (!body.trim()) return; setNotes([{ id: Date.now(), pinned: false, time: "Just now", quote, body, tags: [] }, ...notes]); setDraft(""); };
  const copyCite = async () => { try { await navigator.clipboard.writeText(cite); } catch { /* clipboard may be blocked */ } setCopied(true); setTimeout(() => setCopied(false), 1600); };
  const shown = notes.filter((n) => (tab === "highlights" ? n.quote : tab === "mine" ? !n.pinned : true));

  return (
    <div className={`reader theme-${theme}`}>
      <div className="card reader-bar">
        <div className="row gap-sm wrap-row">
          <Link to={`/book/${book.id}`} className="muted small row"><ArrowLeft size={14} /> Library</Link>
          <span className="muted">/</span><span className="muted small">{label(book.subject_area)}</span>
          <h1 className="h-sm inline">{book.title}</h1>
        </div>
        <div className="progress-pill" role="status"><span className="ring" /> Chapter 2 · 64% read · about 18 mins left</div>
      </div>
      <div className="card reader-tools">
        <div className="search compact"><Search size={14} /><input placeholder="Find in this chapter…" aria-label="Find in chapter" /></div>
        <div className="seg" aria-label="Text size"><button onClick={() => setSize((s) => Math.max(14, s - 1))} aria-label="Smaller text">A−</button><button onClick={() => setSize((s) => Math.min(22, s + 1))} aria-label="Larger text">A+</button></div>
        <div className="seg" role="radiogroup" aria-label="Reading theme">{[["parchment", "Parchment"], ["sepia", "Sepia"], ["night", "Pine night"]].map(([k, l]) => <button key={k} role="radio" aria-checked={theme === k} className={theme === k ? "on" : ""} onClick={() => setTheme(k)}>{l}</button>)}</div>
        <button className="btn-icon" onClick={() => document.documentElement.requestFullscreen?.()} aria-label="Full screen"><Maximize2 size={15} /></button>
      </div>

      <div className="reader-grid">
        <article className="card page">
          <header className="page-head">
            <p className="kicker">Chapter 2 · Section 2.3</p>
            <h2 className="h-lg">Why ships wait: a review of the evidence</h2>
            <p className="muted small">{book.authors} · {book.department || "NITT"} · {book.year}</p>
          </header>
          <div className="prose" style={{ fontSize: size }}>
            {paras.map((p, i) => {
              const active = sel === i;
              return (
                <div key={i}>
                  <p className={`para ${active ? "selected" : ""} ${i === 1 ? "annot" : ""}`} tabIndex={0} onClick={() => setSel(i)} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setSel(i)} aria-pressed={active}>
                    {i === 0 ? <><span className="dropcap">{p[0]}</span>{p.slice(1)}</> : p}
                  </p>
                  {i === 1 && <p className="annot-foot small">Annotated by 12 readers · <button onClick={() => setTab("highlights")}>View 4 reflections</button></p>}
                  {active && (
                    <div className="sel-bar" role="group" aria-label="Selected paragraph actions">
                      <span className="small">Paragraph {i + 1} selected</span>
                      <button onClick={() => addNote(p.slice(0, 90) + "…", "Needs a source.")}><Pin size={13} /> Note</button>
                      <button onClick={copyCite}><Quote size={13} /> {copied ? "Copied" : "Cite"}</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="page-nav">
            <button className="btn btn-outline"><ArrowLeft size={14} /> Section 2.2</button>
            <span className="muted small">Page {40 + sel}</span>
            <button className="btn btn-primary">Section 2.4 <ArrowRight size={14} /></button>
          </div>
        </article>

        <aside className="reader-side">
          <section className="card side-card">
            <div className="row between"><h2 className="h-sm">Margin notes</h2><span className="chip chip-learn">{notes.length} notes</span></div>
            <div className="seg full" role="tablist">{[["all", "All notes"], ["highlights", "Highlights"], ["mine", "My thoughts"]].map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{l}</button>)}</div>
            <div className="search compact"><Filter size={13} /><input placeholder="Filter tags, quotes or remarks" aria-label="Filter notes" /></div>
            {shown.map((n) => (
              <div className="note" key={n.id}>
                <span className="note-meta">{n.pinned && <Pin size={11} />} {n.pinned ? "Pinned" : "Note"} · {n.time}</span>
                <blockquote>“{n.quote}”</blockquote>
                <p className="small">{n.body}</p>
                {n.tags.length > 0 && <div className="chips">{n.tags.map((t) => <span key={t} className="chip chip-learn">#{t}</span>)}</div>}
                <div className="note-actions"><button aria-label="Download note"><Download size={14} /></button><button aria-label="Copy note"><Copy size={14} /></button><button aria-label="Share note"><Share2 size={14} /></button></div>
              </div>
            ))}
          </section>

          <section className="card side-card">
            <div className="row between"><h3 className="title-md">Cohort thread</h3><span className="muted small">{thread.length} replies</span></div>
            {thread.map((t) => <div className="reply" key={t.who}><span className="avatar sm">{t.who[0]}</span><div><div className="row between"><strong className="small">{t.who}</strong><span className="muted small">{t.when}</span></div><p className="small">{t.text}</p></div></div>)}
          </section>

          <section className="card side-card">
            <label htmlFor="qn" className="title-md">Quick margin note</label>
            <textarea id="qn" rows={3} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Write a thought, a question or a reference to check." />
            <button className="btn btn-primary" onClick={() => addNote(paras[sel].slice(0, 90) + "…", draft)} disabled={!draft.trim()}><BookmarkCheck size={15} /> Save note</button>
          </section>
        </aside>
      </div>
      <div className="card curated"><span className="curated-mark"><BookmarkCheck size={20} /></span><div><strong>Held in the NITT Institutional Repository</strong><p className="muted small">Final-year projects are view-only. Downloads and printing follow the access level set by the supervisor.</p></div></div>
    </div>
  );
}

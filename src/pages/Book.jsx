import { useParams, Link } from "react-router-dom";
import { useState } from "react";
import { Bookmark, Check, MapPin, BookOpen, Bell, ChevronRight } from "lucide-react";
import Cover from "../components/Cover.jsx";
import BookCard from "../components/BookCard.jsx";
import { api } from "../api.js";
import { useFetch } from "../useFetch.js";
import { availability, label, fmtDate, naira } from "../data.js";
import { useStore } from "../store.jsx";

const statusClass = (s) => (s === "available" ? "ok" : ["damaged", "lost", "withdrawn"].includes(s) ? "bad" : "warn");

export default function Book() {
  const { id } = useParams();
  return <BookView key={id} id={id} />; // reset local state when moving between titles
}

function BookView({ id }) {
  const { state, dispatch } = useStore();
  const user = state.user;
  const t = useFetch(() => api(`/catalogue/titles/${id}`), [id, user?.id]);
  const similar = useFetch(() => (t.data ? api("/catalogue/search", { query: { subject_area: t.data.subject_area, page_size: 5 } }) : null), [t.data?.subject_area]);
  const [tab, setTab] = useState("about");
  const [hold, setHold] = useState(null);

  if (t.loading && !t.data) return <div className="wrap section"><p className="muted" role="status">Loading…</p></div>;
  if (t.error) return (
    <div className="wrap section">
      <h1 className="h-lg">{t.error.status === 404 ? "Title not found" : "Could not load this title"}</h1>
      <p className="muted">{t.error.message}</p>
      <Link to="/catalogue" className="btn btn-outline mt">Back to catalogue</Link>
    </div>
  );

  const book = t.data;
  const av = availability(book);
  const saved = state.saved.includes(book.id);
  const digital = book.format === "digital";
  const others = (similar.data?.results || []).filter((b) => b.id !== book.id).slice(0, 4);
  const tabs = [["about", "About this title"], ...(book.copies ? [["copies", "Copies and locations"]] : [])];

  const placeHold = async () => {
    try { const h = await api(`/holds/${book.id}`, { method: "POST" }); setHold({ ok: true, text: `Hold placed. You are number ${h.position} in the queue. We will notify you when a copy is ready.` }); t.reload(); }
    catch (e) { setHold({ ok: false, text: e.message }); }
  };

  return (
    <div className="wrap">
      <nav className="crumbs" aria-label="Breadcrumb"><Link to="/">Home</Link><ChevronRight size={12} /><Link to="/catalogue">Catalogue</Link><ChevronRight size={12} /><Link to={`/catalogue?s=${book.subject_area}`}>{label(book.subject_area)}</Link><ChevronRight size={12} /><span>{book.title}</span></nav>
      <section className="book-top">
        <div className="card book-gallery">
          <div className="book-hero-cover"><Cover book={book} size="xl" /></div>
          <div className="row gap-sm wrap-row center">
            <span className="chip chip-learn">{label(book.format)}</span>
            <button className={`btn-icon ${saved ? "on" : ""}`} onClick={() => dispatch({ type: "toggleSaved", id: book.id })} aria-pressed={saved} aria-label="Save to list"><Bookmark size={16} /></button>
          </div>
          {!digital && book.locations?.length > 0 && <div className="shelf-note"><MapPin size={15} /> <span>Shelf: {book.locations.join(", ")}<br /><span className="muted small">Call number {book.call_number || "—"}</span></span></div>}
        </div>

        <div className="book-info">
          <p className="kicker">{label(book.subject_area)}{book.department ? ` · ${book.department}` : ""}</p>
          <h1 className="h-hero sm">{book.title}</h1>
          {book.subtitle && <p className="muted">{book.subtitle}</p>}
          <p className="by">By {book.authors}</p>
          <div className="meta-grid">
            {[["Edition", book.edition], ["Publisher", book.publisher && `${book.publisher}${book.year ? ` (${book.year})` : ""}`], ["Language", book.language], ["ISBN", book.isbn]].filter(([, v]) => v).map(([k, v]) => <div key={k} className="card meta"><span className="label">{k}</span><span>{v}</span></div>)}
          </div>

          <div className="buy-row">
            {digital ? (
              <Link to={`/reader/${book.id}`} className="btn btn-primary grow"><BookOpen size={16} /> Open in reader</Link>
            ) : !user ? (
              <Link to="/login" state={{ from: `/book/${book.id}` }} className="btn btn-primary grow">Sign in to place a hold</Link>
            ) : av.available ? (
              <p className="notice ok grow" role="status"><Check size={14} /> A copy is on the shelf. Collect it and borrow at the circulation desk with your ID.</p>
            ) : book.total_copies > 0 ? (
              <button className="btn btn-primary grow" onClick={placeHold} disabled={hold?.ok}><Bell size={16} /> {hold?.ok ? "Hold placed" : "Place hold"}</button>
            ) : (
              <p className="notice" role="status">This title has no copies on the shelf.</p>
            )}
          </div>
          {hold && <p className={`notice ${hold.ok ? "ok" : "warn"}`} role="status">{hold.ok && <Check size={14} />} {hold.text}</p>}
          {!digital && !av.available && book.total_copies > 0 && <p className="notice" role="status">Every copy is on loan{book.holds ? ` and ${book.holds} ${book.holds === 1 ? "person is" : "people are"} waiting` : ""}. Place a hold to join the queue.</p>}
          <p className="stock"><span className={`pip ${av.available ? "ok" : "none"}`} />{av.text}</p>
        </div>
      </section>

      <section className="card tabs-card">
        <div className="tabs" role="tablist">
          {tabs.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{l}</button>)}
        </div>
        {tab === "about" && (
          <div className="about">
            <h2 className="h-md">What it covers</h2>
            <p>{book.description || "No description has been added for this title yet."}</p>
            <p className="muted">Subject area: {label(book.subject_area)}.{book.subjects ? ` Subjects: ${book.subjects}.` : ""} Format: {label(book.format)}.</p>
          </div>
        )}
        {tab === "copies" && book.copies && (
          <div className="table-wrap"><table className="table"><thead><tr><th>Barcode</th><th>Status</th><th>Location</th><th>Collection</th><th>Cost</th></tr></thead><tbody>
            {book.copies.length ? book.copies.map((c) => <tr key={c.id}><td>{c.barcode}</td><td><span className={`status ${statusClass(c.status)}`}>{label(c.status)}</span></td><td>{c.shelf_location}</td><td>{label(c.collection)}</td><td>{naira(c.cost)}</td></tr>) : <tr><td colSpan={5}>No physical copies.</td></tr>}
          </tbody></table></div>
        )}
      </section>

      {others.length > 0 && (
        <section className="section"><p className="kicker">Keep exploring</p><h2 className="h-lg">More in {label(book.subject_area)}</h2>
          <div className="grid-books mt">{others.map((b) => <BookCard key={b.id} book={b} />)}</div></section>
      )}
    </div>
  );
}

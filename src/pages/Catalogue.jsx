import { useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import BookCard from "../components/BookCard.jsx";
import { api } from "../api.js";
import { useFetch } from "../useFetch.js";
import { label } from "../data.js";

export default function Catalogue() {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") || "";
  const subject = params.get("s") || "";
  const onlyFree = params.get("a") === "1";
  const format = params.get("f") || "";
  const page = Math.max(1, Number(params.get("page")) || 1);
  const set = (k, v) => { const p = new URLSearchParams(params); v ? p.set(k, v) : p.delete(k); if (k !== "page") p.delete("page"); setParams(p, { replace: true }); };

  // Keep typing snappy: update the URL (and so the search) shortly after the user stops.
  const [text, setText] = useState(q);
  useEffect(() => setText(q), [q]);
  useEffect(() => {
    if (text === q) return;
    const t = setTimeout(() => set("q", text), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  const facets = useFetch(() => api("/catalogue/facets"), []);
  const res = useFetch(() => api("/catalogue/search", { query: { q, subject_area: subject, format, available_only: onlyFree ? "true" : "", page, page_size: 20 } }), [q, subject, format, onlyFree, page]);

  const total = res.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / 20));
  return (
    <div className="wrap section">
      <p className="kicker">Catalogue</p>
      <h1 className="h-lg">Find a title</h1>
      <div className="search search-lg mt"><Search size={18} aria-hidden /><input value={text} onChange={(e) => setText(e.target.value)} placeholder="Title, author, subject, ISBN or call number" aria-label="Search catalogue" /></div>
      <div className="filters">
        <div className="chips">
          <button className={`chip ${!subject ? "chip-on" : "chip-genre"}`} onClick={() => set("s", "")}>All subjects</button>
          {(facets.data?.subject_areas || []).map((s) => <button key={s} className={`chip ${subject === s ? "chip-on" : "chip-genre"}`} onClick={() => set("s", s)}>{label(s)}</button>)}
        </div>
        <div className="row gap-sm wrap-row">
          <select value={format} onChange={(e) => set("f", e.target.value)} aria-label="Format">
            <option value="">All formats</option>{(facets.data?.formats || []).map((f) => <option key={f} value={f}>{label(f)}</option>)}
          </select>
          <label className="check"><input type="checkbox" checked={onlyFree} onChange={(e) => set("a", e.target.checked ? "1" : "")} /> Available now</label>
        </div>
      </div>
      {res.error && <p className="err mt" role="alert">{res.error.message}</p>}
      {!res.error && <p className="muted small mt" role="status">{res.loading ? "Searching…" : `${total} ${total === 1 ? "result" : "results"}`}</p>}
      {res.data && (res.data.results.length ? (
        <div className="grid-books mt">{res.data.results.map((b) => <BookCard key={b.id} book={b} />)}</div>
      ) : (
        <div className="card empty mt"><h2 className="h-sm">No titles match your search</h2><p className="muted">Check the spelling or clear a filter. Searches with no results are shared with the librarians so they can consider buying the title.</p></div>
      ))}
      {pages > 1 && (
        <div className="row gap-sm center mt">
          <button className="btn btn-outline sm" disabled={page <= 1} onClick={() => set("page", String(page - 1))}>Previous</button>
          <span className="muted small">Page {page} of {pages}</span>
          <button className="btn btn-outline sm" disabled={page >= pages} onClick={() => set("page", String(page + 1))}>Next</button>
        </div>
      )}
    </div>
  );
}

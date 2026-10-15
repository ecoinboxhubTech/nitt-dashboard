import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { Search, ArrowRight } from "lucide-react";
import BookCard from "../components/BookCard.jsx";
import Cover from "../components/Cover.jsx";
import { api } from "../api.js";
import { useFetch } from "../useFetch.js";
import { label } from "../data.js";

export default function Home() {
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const arrivals = useFetch(() => api("/catalogue/new-arrivals", { query: { limit: 4 } }), []);
  const facets = useFetch(() => api("/catalogue/facets"), []);
  const feature = arrivals.data?.[0];
  return (
    <>
      <section className="wrap hero">
        <div className="hero-copy">
          <p className="kicker">Discover. Borrow. Graduate.</p>
          <h1 className="h-hero">Know the book is on the shelf before you walk over.</h1>
          <p className="lead">Search every title, journal and project report held at NITT. See live availability and shelf location, reserve what is out, and track your due dates from your phone.</p>
          <form className="hero-search" onSubmit={(e) => { e.preventDefault(); nav(`/catalogue?q=${encodeURIComponent(q)}`); }}>
            <Search size={18} aria-hidden />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Try “port operations” or an ISBN" aria-label="Search the catalogue" />
            <button className="btn btn-accent" type="submit">Search</button>
          </form>
          <div className="chips">{(facets.data?.subject_areas || []).map((s) => <Link key={s} className="chip chip-genre" to={`/catalogue?s=${s}`}>{label(s)}</Link>)}</div>
        </div>
        {feature && (
          <Link to={`/book/${feature.id}`} className="card hero-feature">
            <Cover book={feature} size="lg" />
            <div>
              <span className="chip chip-learn">Newly catalogued</span>
              <h2 className="h-sm mt">{feature.title}</h2>
              <p className="muted small">{feature.description || feature.authors}</p>
              <span className="link-arrow">View title <ArrowRight size={14} /></span>
            </div>
          </Link>
        )}
      </section>

      <section className="wrap section" id="new">
        <div className="section-head"><div><p className="kicker">Recently catalogued</p><h2 className="h-lg">New arrivals</h2></div><Link className="btn btn-outline" to="/catalogue">Browse all</Link></div>
        {arrivals.error && <p className="err" role="alert">{arrivals.error.message}</p>}
        {arrivals.loading ? <p className="muted" role="status">Loading…</p> : <div className="grid-books">{arrivals.data?.map((b) => <BookCard key={b.id} book={b} />)}</div>}
      </section>

      <section className="wrap section">
        <div className="band">
          <div><p className="kicker">For lecturers</p><h2 className="h-md">Find course texts and see what the library holds.</h2></div>
          <p className="muted">Check copy counts and holds for any title, and place a hold when every copy is out.</p>
          <Link className="btn btn-primary" to="/dashboard">Open my workspace</Link>
        </div>
      </section>
    </>
  );
}

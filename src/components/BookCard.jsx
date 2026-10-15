import { Link } from "react-router-dom";
import { BookOpen, Bookmark } from "lucide-react";
import Cover from "./Cover.jsx";
import { availability, label } from "../data.js";
import { useStore } from "../store.jsx";

export default function BookCard({ book }) {
  const { state, dispatch } = useStore();
  const av = availability(book);
  const saved = state.saved.includes(book.id);
  return (
    <article className="card book-card">
      <Link to={`/book/${book.id}`} className="book-card-cover" aria-label={`View ${book.title}`}>
        <Cover book={book} />
      </Link>
      <div className="book-card-body">
        <span className="chip chip-genre">{label(book.subject_area)}</span>
        <h3 className="book-card-title"><Link to={`/book/${book.id}`}>{book.title}</Link></h3>
        <p className="muted small">{book.authors}</p>
        <div className="book-card-foot">
          <span className={`avail ${av.available ? "ok" : "none"}`}>{av.text}</span>
          {book.format === "digital" ? (
            <Link className="btn-icon" to={`/reader/${book.id}`} aria-label="Open in reader"><BookOpen size={16} /></Link>
          ) : (
            <button className={`btn-icon ${saved ? "on" : ""}`} onClick={() => dispatch({ type: "toggleSaved", id: book.id })} aria-pressed={saved} aria-label="Save to list"><Bookmark size={16} /></button>
          )}
        </div>
      </div>
    </article>
  );
}

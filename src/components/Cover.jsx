import { label } from "../data.js";

const palette = [["#1e3a2b", "#2f5a43"], ["#4a2c0f", "#7a4a1d"], ["#1b2a49", "#324b7c"], ["#5b1f1f", "#8a3434"], ["#3d4a1c", "#5f7230"], ["#2d3b55", "#52668f"], ["#27313f", "#475569"]];

export default function Cover({ book, size = "md" }) {
  const [a, b] = palette[(book.id || 0) % palette.length];
  return (
    <div className={`cover cover-${size}`} style={{ background: `linear-gradient(145deg, ${b}, ${a})` }} role="img" aria-label={`Cover of ${book.title}`}>
      <span className="cover-kicker">{label(book.subject_area)}</span>
      <span className="cover-title">{book.title}</span>
      <span className="cover-author">{book.authors}</span>
    </div>
  );
}

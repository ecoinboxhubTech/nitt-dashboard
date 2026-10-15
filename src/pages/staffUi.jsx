import { Check } from "lucide-react";

export const Head = ({ kicker = "Staff", title, children }) => (
  <header className="dash-head card"><div><p className="kicker">{kicker}</p><h1 className="h-lg">{title}</h1></div>{children}</header>
);
export const Msg = ({ m }) => (m ? <p className={`notice ${m.ok ? "ok" : "warn"}`} role="status">{m.ok && <Check size={14} />} {m.text}</p> : null);
export const Err = ({ e }) => (e ? <p className="err" role="alert">{e.message}</p> : null);
export const Field = ({ id, label: l, children, ...rest }) => <div className="field"><label htmlFor={id}>{l}</label>{children || <input id={id} {...rest} />}</div>;
export const Loading = ({ f }) => (f.loading && !f.data ? <p className="muted" role="status">Loading…</p> : null);

export function DataTable({ columns, rows }) {
  return (
    <div className="table-wrap"><table className="table"><thead><tr>{columns.map((c) => <th key={c}>{c}</th>)}</tr></thead><tbody>
      {rows.length ? rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c ?? "—"}</td>)}</tr>) : <tr><td colSpan={columns.length} className="muted">Nothing to show.</td></tr>}
    </tbody></table></div>
  );
}

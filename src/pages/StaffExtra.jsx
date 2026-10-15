import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Printer, Sparkles, Upload, Download } from "lucide-react";
import { api } from "../api.js";
import { useFetch } from "../useFetch.js";
import { useStore } from "../store.jsx";
import Barcode from "../components/Barcode.jsx";
import { Head, Msg, Err, Field, Loading, DataTable } from "./staffUi.jsx";
import { fmtDateTime, label } from "../data.js";

export const subjectAreas = ["maritime", "aviation", "rail", "road", "logistics", "policy", "other"];
export const formats = ["print_book", "journal", "report", "past_question", "standard", "digital"];
export const collections = ["general", "reserve", "short_loan", "reference_only", "journals"];
const copyStatuses = ["available", "reserved", "in_transit", "lost", "damaged", "in_repair", "withdrawn"];

/* ---------- bulk import: always a dry run first, then commit ---------- */
export function ImportPanel({ title, path, template, templateName, columns, onDone }) {
  const [file, setFile] = useState(null);
  const [res, setRes] = useState(null);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  const send = async (dry) => {
    setBusy(true); setErr(null);
    const form = new FormData();
    form.append("file", file);
    try { setRes(await api(path, { method: "POST", query: { dry_run: dry ? "true" : "false" }, form })); if (!dry) onDone?.(); }
    catch (x) { setRes(null); setErr(x); } finally { setBusy(false); }
  };
  const getTemplate = async () => {
    try {
      const r = await api(template, { raw: true });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(await r.blob()); a.download = templateName; a.click(); URL.revokeObjectURL(a.href);
    } catch (x) { setErr(x); }
  };

  const counts = res ? Object.entries(res).filter(([, v]) => typeof v === "number") : [];
  const lists = res ? Object.entries(res).filter(([, v]) => Array.isArray(v) && v.length && typeof v[0] === "object") : [];
  return (
    <section className="card pad">
      <div className="row between wrap-row"><h2 className="h-md">{title}</h2>{template && <button className="btn btn-outline sm" onClick={getTemplate}><Download size={13} /> Template</button>}</div>
      <p className="muted small">CSV or Excel (.xlsx), up to 10 MB.{columns ? ` Columns: ${columns}.` : ""} Run the preview first; nothing is saved until you confirm.</p>
      <div className="row gap-sm wrap-row mt">
        <input type="file" accept=".csv,.xlsx" aria-label={`${title} file`} onChange={(e) => { setFile(e.target.files[0] || null); setRes(null); setErr(null); }} />
        <button className="btn btn-outline" disabled={!file || busy} onClick={() => send(true)}><Upload size={14} /> Preview</button>
        {res?.dry_run && <button className="btn btn-primary" disabled={busy} onClick={() => send(false)}>Confirm import</button>}
      </div>
      <Err e={err} />
      {res && (
        <div className="mt">
          <p className={`notice ${res.dry_run ? "" : "ok"}`} role="status">{res.dry_run ? "Preview only, nothing saved yet." : "Import complete."}</p>
          <div className="chips">{counts.map(([k, v]) => <span key={k} className="chip chip-genre">{label(k)}: {v}</span>)}</div>
          {lists.map(([k, rows]) => {
            const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
            return <div key={k} className="mt"><h3 className="title-md">{label(k)}</h3><DataTable columns={cols.map(label)} rows={rows.map((r) => cols.map((c) => (typeof r[c] === "object" ? JSON.stringify(r[c]) : r[c])))} /></div>;
          })}
        </div>
      )}
    </section>
  );
}

/* ---------- AI cataloguing suggestion (cataloguer reviews before saving) ---------- */
export function AiSuggest({ form, onApply }) {
  const status = useFetch(() => api("/ai/status"), []);
  const [s, setS] = useState(null);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  if (!status.data?.enabled) return null;

  const run = async () => {
    setBusy(true); setErr(null);
    try { setS(await api("/ai/catalogue-suggest", { method: "POST", body: { title: form.title, authors: form.authors || null, isbn: form.isbn || null } })); }
    catch (x) { setS(null); setErr(x); } finally { setBusy(false); }
  };
  const apply = () => {
    const patch = {};
    ["subjects", "department", "call_number", "description"].forEach((k) => { if (s[k]) patch[k] = s[k]; });
    if (subjectAreas.includes(s.subject_area)) patch.subject_area = s.subject_area;
    onApply(patch); setS(null);
  };
  return (
    <div className="mt">
      <button type="button" className="btn btn-outline sm" disabled={!form.title?.trim() || busy} onClick={run}><Sparkles size={13} /> {busy ? "Thinking…" : "Suggest with AI"}</button>
      <Err e={err} />
      {s && (
        <div className="notice" role="status" style={{ display: "block" }}>
          <p><strong>{label(s.subject_area)}</strong> · {s.department} · call number {s.call_number} · confidence {s.confidence}</p>
          {s.subjects && <p className="small">Subjects: {s.subjects}</p>}
          {s.description && <p className="small">{s.description}</p>}
          <p className="muted small">{s.notice}</p>
          <button type="button" className="btn btn-primary sm mt" onClick={apply}>Use these suggestions</button>
        </div>
      )}
    </div>
  );
}

/* ---------- printable barcode labels ---------- */
export function LabelSheet({ labels, onClose }) {
  return (
    <section className="card pad" id="labels">
      <div className="row between wrap-row no-print"><h2 className="h-md">Barcode labels ({labels.length})</h2>
        <div className="row gap-sm"><button className="btn btn-primary sm" onClick={() => window.print()}><Printer size={14} /> Print</button><button className="btn btn-outline sm" onClick={onClose}>Close</button></div></div>
      <div className="label-grid print-area">
        {labels.map((l) => (
          <div className="label-card" key={l.barcode}>
            <strong className="small">{l.title}</strong>
            <Barcode value={l.barcode} />
            <span className="mono small">{l.barcode}</span>
            <span className="small">{[l.call_number, l.shelf_location].filter(Boolean).join(" · ")}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------- one title: edit, copies, labels, history ---------- */
const editable = ["title", "subtitle", "authors", "edition", "publisher", "year", "isbn", "subjects", "call_number", "language", "department", "description"];

export function TitleDetail() {
  const { id } = useParams();
  const t = useFetch(() => api(`/catalogue/titles/${id}`), [id]);
  const hist = useFetch(() => api(`/catalogue/titles/${id}/history`), [id]);
  return (
    <div className="dash">
      <Head title={t.data?.title || "Title"}><Link to="/staff/titles" className="btn btn-outline">Back to titles</Link></Head>
      <Err e={t.error} /><Loading f={t} />
      {t.data && <TitleEditor key={t.data.id} title={t.data} reload={() => { t.reload(); hist.reload(); }} />}
      <section className="card pad">
        <h2 className="h-md">Change history</h2>
        <Err e={hist.error} /><Loading f={hist} />
        {hist.data && <DataTable columns={["When", "By", "Action", "Changes"]} rows={hist.data.map((h) => [fmtDateTime(h.at), h.by, h.action, summarise(h.before, h.after)])} />}
      </section>
    </div>
  );
}

const summarise = (b = {}, a = {}) => {
  const keys = [...new Set([...Object.keys(b || {}), ...Object.keys(a || {})])].filter((k) => JSON.stringify(b?.[k]) !== JSON.stringify(a?.[k]));
  return keys.length ? keys.map((k) => `${label(k)}: ${b?.[k] ?? "—"} → ${a?.[k] ?? "—"}`).join("; ") : "—";
};

function TitleEditor({ title, reload }) {
  const { state } = useStore();
  const [f, setF] = useState({ ...Object.fromEntries(editable.map((k) => [k, title[k] ?? ""])), subject_area: title.subject_area, format: title.format });
  const [msg, setMsg] = useState(null);
  const [labels, setLabels] = useState(null);
  const [copyEdit, setCopyEdit] = useState({});
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const save = async (e) => {
    e.preventDefault();
    const body = {};
    Object.entries(f).forEach(([k, v]) => {
      const cur = title[k] ?? "";
      if (String(v) !== String(cur)) body[k] = k === "year" ? (v === "" ? null : Number(v)) : v;
    });
    if (!Object.keys(body).length) return setMsg({ ok: false, text: "Nothing has changed." });
    try { await api(`/catalogue/titles/${title.id}`, { method: "PATCH", body }); setMsg({ ok: true, text: "Title saved." }); reload(); }
    catch (x) { setMsg({ ok: false, text: x.message }); }
  };
  const saveCopy = async (c) => {
    const body = copyEdit[c.id]; if (!body) return;
    try { await api(`/catalogue/copies/${c.id}`, { method: "PATCH", body }); setCopyEdit(({ [c.id]: _, ...rest }) => rest); setMsg({ ok: true, text: `Copy ${c.barcode} updated.` }); reload(); }
    catch (x) { setMsg({ ok: false, text: x.message }); }
  };
  const editCopy = (c, k, v) => setCopyEdit({ ...copyEdit, [c.id]: { ...copyEdit[c.id], [k]: v } });
  const showLabels = async () => {
    try { setLabels(await api("/catalogue/labels", { query: { title_id: title.id } })); } catch (x) { setMsg({ ok: false, text: x.message }); }
  };

  return (
    <>
      <Msg m={msg} />
      <form className="card pad" onSubmit={save} noValidate>
        <h2 className="h-md">Details</h2>
        <div className="form-grid">
          {editable.filter((k) => k !== "description").map((k) => <Field key={k} id={`e-${k}`} label={label(k)} type={k === "year" ? "number" : "text"} value={f[k]} onChange={set(k)} />)}
          <Field id="e-sa" label="Subject area"><select id="e-sa" value={f.subject_area} onChange={set("subject_area")}>{subjectAreas.map((s) => <option key={s} value={s}>{label(s)}</option>)}</select></Field>
          <Field id="e-fmt" label="Format"><select id="e-fmt" value={f.format} onChange={set("format")}>{formats.map((s) => <option key={s} value={s}>{label(s)}</option>)}</select></Field>
        </div>
        <Field id="e-desc" label="Description"><textarea id="e-desc" rows={4} value={f.description} onChange={set("description")} /></Field>
        <AiSuggest form={f} onApply={(p) => setF({ ...f, ...p })} />
        <button className="btn btn-primary mt" type="submit">Save changes</button>
      </form>

      <section className="card pad">
        <div className="row between wrap-row"><h2 className="h-md">Copies</h2><button className="btn btn-outline sm" onClick={showLabels} disabled={!title.copies?.length}><Printer size={13} /> Print labels</button></div>
        <div className="table-wrap"><table className="table"><thead><tr><th>Barcode</th><th>Status</th><th>Shelf</th><th>Collection</th><th /></tr></thead><tbody>
          {(title.copies || []).map((c) => {
            const e = copyEdit[c.id] || {};
            const locked = c.status === "on_loan";
            return (
              <tr key={c.id}>
                <td className="mono">{c.barcode}</td>
                <td>{locked ? <span className="status warn">On loan</span> : <select value={e.status ?? c.status} onChange={(ev) => editCopy(c, "status", ev.target.value)} aria-label={`Status of ${c.barcode}`}>{[...new Set([c.status, ...copyStatuses])].map((s) => <option key={s} value={s}>{label(s)}</option>)}</select>}</td>
                <td><input value={e.shelf_location ?? c.shelf_location ?? ""} onChange={(ev) => editCopy(c, "shelf_location", ev.target.value)} aria-label={`Shelf of ${c.barcode}`} /></td>
                <td><select value={e.collection ?? c.collection} onChange={(ev) => editCopy(c, "collection", ev.target.value)} aria-label={`Collection of ${c.barcode}`}>{collections.map((s) => <option key={s} value={s}>{label(s)}</option>)}</select></td>
                <td><button className="btn btn-outline sm" disabled={!copyEdit[c.id]} onClick={() => saveCopy(c)}>Save</button></td>
              </tr>
            );
          })}
          {!title.copies?.length && <tr><td colSpan={5} className="muted">No physical copies.</td></tr>}
        </tbody></table></div>
        {state.user.role !== "head_librarian" && <p className="muted small mt">Marking a copy lost or withdrawn needs the head librarian.</p>}
      </section>
      {labels && <LabelSheet labels={labels} onClose={() => setLabels(null)} />}
    </>
  );
}

/* ---------- AI purchasing brief (head librarian) ---------- */
export function DemandBrief() {
  const [d, setD] = useState(null);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true); setErr(null);
    try { setD(await api("/ai/demand-insights")); } catch (x) { setD(null); setErr(x); } finally { setBusy(false); }
  };
  return (
    <section className="card pad">
      <div className="row between wrap-row"><h2 className="h-sm">AI purchasing brief</h2><button className="btn btn-outline sm" onClick={run} disabled={busy}><Sparkles size={13} /> {busy ? "Thinking…" : "Generate brief"}</button></div>
      <Err e={err} />
      {d && (
        <>
          <p className="mt">{d.summary}</p>
          <DataTable columns={["Item", "Action", "Why"]} rows={(d.priorities || []).map((p) => [p.item, p.action, p.why])} />
        </>
      )}
    </section>
  );
}

import { useState } from "react";
import { api } from "../api.js";
import { useFetch } from "../useFetch.js";
import { Head, Msg, Err, Loading } from "./staffUi.jsx";
import { label } from "../data.js";

const memberTypes = ["student", "academic_staff", "non_academic_staff", "visitor"];
const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]; // closure_weekdays: Mon = 0
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Keys grouped into cards; anything the server sends that is not listed falls into "Other".
const groups = [
  ["General", ["library_name", "closing_time", "closure_weekdays", "closure_dates", "short_loan_hours_before_close"]],
  ["Loan rules by member type", ["loan_days", "max_items", "max_renewals"]],
  ["Fines", ["fine_per_day", "fine_cap_default", "fine_block_threshold", "overdue_block_days", "replacement_fee"]],
  ["Holds", ["hold_pickup_hours", "max_holds"]],
  ["Reminders", ["reminder_days_after_due"]],
];
const hints = {
  closing_time: "Loans fall due at this time (WAT), 24-hour HH:MM.",
  short_loan_hours_before_close: "Short-loan items are due this many hours before closing.",
  fine_per_day: "Naira per overdue day.",
  fine_cap_default: "Cap per item when a copy has no replacement cost (₦).",
  fine_block_threshold: "Unpaid fines above this block borrowing (₦). The desk can override.",
  overdue_block_days: "An item overdue by more than this many days blocks borrowing.",
  replacement_fee: "Placeholder replacement fee (₦).",
  hold_pickup_hours: "Hours a member has to collect a ready hold.",
  max_holds: "Holds allowed per member.",
  reminder_days_after_due: "Days relative to the due date, comma separated. Negative is before (−2 = two days before).",
  closure_dates: "One date per line (YYYY-MM-DD) for holidays when the library is closed.",
};
const loanLabels = { loan_days: "Loan period (days)", max_items: "Max items on loan", max_renewals: "Max renewals" };

export function Settings() {
  const s = useFetch(() => api("/admin/settings"), []);
  return (
    <div className="dash">
      <Head title="Library settings" />
      <Err e={s.error} /><Loading f={s} />
      {s.data && <SettingsForm key={JSON.stringify(s.data)} data={s.data} reload={s.reload} />}
    </div>
  );
}

function SettingsForm({ data, reload }) {
  const [v, setV] = useState(data);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k, val) => setV((p) => ({ ...p, [k]: val }));
  const changed = Object.keys(v).filter((k) => !same(v[k], data[k]));

  const save = async (e) => {
    e.preventDefault();
    const values = Object.fromEntries(changed.map((k) => [k, v[k]]));
    if (values.closing_time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(values.closing_time)) return setMsg({ ok: false, text: "Closing time must look like 17:00." });
    setBusy(true);
    try { await api("/admin/settings", { method: "PUT", body: { values } }); setMsg({ ok: true, text: "Settings saved." }); reload(); }
    catch (x) { setMsg({ ok: false, text: x.message }); setBusy(false); }
  };

  const known = new Set(groups.flatMap(([, ks]) => ks).concat("templates"));
  const other = Object.keys(v).filter((k) => !known.has(k));

  return (
    <form onSubmit={save} noValidate className="settings">
      <Msg m={msg} />
      {groups.map(([title, keys]) => {
        const present = keys.filter((k) => k in v);
        if (!present.length) return null;
        const perType = present.filter((k) => typeof v[k] === "object" && !Array.isArray(v[k]));
        const rest = present.filter((k) => !perType.includes(k));
        return (
          <section className="card pad" key={title}>
            <h2 className="h-md">{title}</h2>
            {perType.length > 0 && <PerTypeTable keys={perType} v={v} set={set} />}
            <div className="form-grid">{rest.map((k) => <Control key={k} k={k} v={v[k]} set={set} />)}</div>
          </section>
        );
      })}
      {v.templates && <Templates value={v.templates} onChange={(t) => set("templates", t)} />}
      {other.length > 0 && (
        <section className="card pad"><h2 className="h-md">Other</h2><div className="form-grid">{other.map((k) => <Control key={k} k={k} v={v[k]} set={set} />)}</div></section>
      )}
      <div className="settings-bar card">
        <span className="muted small">{changed.length ? `${changed.length} unsaved ${changed.length === 1 ? "change" : "changes"}` : "No changes"}</span>
        <div className="row gap-sm"><button type="button" className="btn btn-outline" disabled={!changed.length} onClick={() => { setV(data); setMsg(null); }}>Discard</button><button className="btn btn-primary" type="submit" disabled={!changed.length || busy}>{busy ? "Saving…" : "Save changes"}</button></div>
      </div>
    </form>
  );
}

function PerTypeTable({ keys, v, set }) {
  return (
    <div className="table-wrap"><table className="table"><thead><tr><th>Rule</th>{memberTypes.map((t) => <th key={t}>{label(t)}</th>)}</tr></thead><tbody>
      {keys.map((k) => (
        <tr key={k}><td>{loanLabels[k] || label(k)}</td>
          {memberTypes.map((t) => (
            <td key={t}><input type="number" min="0" className="num" value={v[k][t] ?? ""} aria-label={`${loanLabels[k] || label(k)} for ${label(t)}`}
              onChange={(e) => set(k, { ...v[k], [t]: e.target.value === "" ? 0 : Number(e.target.value) })} /></td>
          ))}</tr>
      ))}
    </tbody></table></div>
  );
}

function Control({ k, v, set }) {
  const id = `s-${k}`;
  const hint = hints[k] && <span className="muted small">{hints[k]}</span>;
  if (k === "closure_weekdays") {
    const on = new Set(v);
    return (
      <div className="field"><label>Closed on</label>
        <div className="chips" style={{ marginTop: 0 }}>{days.map((d, i) => (
          <button type="button" key={d} className={`chip ${on.has(i) ? "chip-on" : "chip-genre"}`} aria-pressed={on.has(i)}
            onClick={() => { const n = new Set(on); n.has(i) ? n.delete(i) : n.add(i); set(k, [...n].sort()); }}>{d}</button>
        ))}</div>
        <span className="muted small">Due dates roll forward past closed days.</span>
      </div>
    );
  }
  if (k === "closure_dates") {
    return <div className="field"><label htmlFor={id}>Closure dates</label><textarea id={id} rows={3} value={v.join("\n")} onChange={(e) => set(k, e.target.value.split("\n").map((x) => x.trim()).filter(Boolean))} />{hint}</div>;
  }
  if (k === "reminder_days_after_due") {
    return <TextList id={id} k={k} v={v} set={set} hint={hint} />;
  }
  if (typeof v === "number") return <div className="field"><label htmlFor={id}>{label(k)}</label><input id={id} type="number" min="0" value={v} onChange={(e) => set(k, e.target.value === "" ? 0 : Number(e.target.value))} />{hint}</div>;
  if (typeof v === "boolean") return <label className="check"><input type="checkbox" checked={v} onChange={(e) => set(k, e.target.checked)} /> {label(k)}</label>;
  if (typeof v === "string") return <div className="field"><label htmlFor={id}>{label(k)}</label><input id={id} value={v} onChange={(e) => set(k, e.target.value)} />{hint}</div>;
  // Unknown structure: edit as JSON so nothing is lost.
  return <JsonField id={id} k={k} v={v} set={set} />;
}

// Keeps what the user is typing while the parsed list updates.
function TextList({ id, k, v, set, hint }) {
  const [text, setText] = useState(v.join(", "));
  return (
    <div className="field"><label htmlFor={id}>{label(k)}</label>
      <input id={id} value={text} onChange={(e) => { setText(e.target.value); const n = e.target.value.split(",").map((x) => x.trim()).filter(Boolean).map(Number); if (n.every(Number.isFinite)) set(k, n); }} />{hint}
    </div>
  );
}

function JsonField({ id, k, v, set }) {
  const [text, setText] = useState(JSON.stringify(v, null, 2));
  const [bad, setBad] = useState(false);
  return (
    <div className="field"><label htmlFor={id}>{label(k)} (JSON)</label>
      <textarea id={id} rows={5} value={text} aria-invalid={bad} onChange={(e) => { setText(e.target.value); try { set(k, JSON.parse(e.target.value)); setBad(false); } catch { setBad(true); } }} />
      {bad && <span className="err">Not valid JSON yet, so this change will not be saved.</span>}
    </div>
  );
}

function Templates({ value, onChange }) {
  const events = Object.keys(value);
  const [open, setOpen] = useState(events[0]);
  const upd = (ev, field, text) => onChange({ ...value, [ev]: { ...value[ev], [field]: text } });
  const t = value[open];
  return (
    <section className="card pad">
      <h2 className="h-md">Email and notification templates</h2>
      <p className="muted small">Placeholders such as {"{title}"} or {"{name}"} are filled in when the message is sent. Keep the ones already in the text.</p>
      <div className="tabs mt" role="tablist">{events.map((ev) => <button type="button" key={ev} role="tab" aria-selected={open === ev} className={open === ev ? "on" : ""} onClick={() => setOpen(ev)}>{label(ev)}</button>)}</div>
      {t && typeof t === "object" ? (
        <>
          <div className="field"><label htmlFor="tpl-s">Subject</label><input id="tpl-s" value={t.subject ?? ""} onChange={(e) => upd(open, "subject", e.target.value)} /></div>
          <div className="field"><label htmlFor="tpl-b">Message</label><textarea id="tpl-b" rows={6} value={t.body ?? ""} onChange={(e) => upd(open, "body", e.target.value)} /></div>
        </>
      ) : <div className="field"><label htmlFor="tpl-x">Message</label><textarea id="tpl-x" rows={6} value={t ?? ""} onChange={(e) => onChange({ ...value, [open]: e.target.value })} /></div>}
    </section>
  );
}

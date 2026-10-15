import { Link } from "react-router-dom";
import { useState } from "react";
import { RefreshCw, Check, X } from "lucide-react";
import { api } from "../api.js";
import { useFetch } from "../useFetch.js";
import { useStore } from "../store.jsx";
import Assistant from "../components/Assistant.jsx";
import { fmtDate, fmtDateTime, naira, label } from "../data.js";

const daysLeft = (iso) => Math.ceil((new Date(iso) - new Date()) / 86400000);

export default function Dashboard() {
  const { state, setUser } = useStore();
  const me = state.user;
  const loans = useFetch(() => api("/circulation/loans"), []);
  const holds = useFetch(() => api("/holds/mine"), []);
  const fines = useFetch(() => api("/fines/me"), []);
  const notes = useFetch(() => api("/auth/notifications"), []);
  const recs = useFetch(async () => ((await api("/ai/status")).enabled ? api("/ai/recommendations") : null), []);
  const [msg, setMsg] = useState(null);
  const [profile, setProfile] = useState({ phone: me.phone || "", email: me.email || "" });
  const say = (ok, text) => { setMsg({ ok, text }); setTimeout(() => setMsg(null), 4000); };

  const act = async (fn, okText, reload) => {
    try { await fn(); say(true, okText); reload(); } catch (e) { say(false, e.message); }
  };
  const renew = (l) => act(() => api("/circulation/renew", { method: "POST", body: { loan_id: l.id } }), "Renewed. The new due date is shown in your list.", loans.reload);
  const cancelHold = (h) => act(() => api(`/holds/${h.id}`, { method: "DELETE" }), "Hold cancelled.", holds.reload);
  const readAll = () => act(() => api("/auth/notifications/read-all", { method: "POST" }), "All notifications marked as read.", notes.reload);
  const saveProfile = async (e) => {
    e.preventDefault();
    try { setUser(await api("/members/me", { method: "PATCH", body: profile })); say(true, "Contact details saved."); } catch (x) { say(false, x.message); }
  };

  const loanList = loans.data || [];
  const holdList = holds.data || [];
  const overdue = loanList.filter((l) => l.is_overdue);
  const dueSoon = loanList.filter((l) => !l.is_overdue && daysLeft(l.due_at) <= 3).length;
  const owed = fines.data?.owed ?? 0;
  const stats = [["On loan", loanList.length, "items borrowed"], ["Due in 3 days", dueSoon, "renew early to avoid fines"], ["Holds", holdList.length, `${holdList.filter((h) => h.position === 0).length} ready to collect`], ["Fines owed", naira(owed), "pay at the circulation desk"]];
  const hr = new Date().getHours();
  const greeting = hr < 12 ? "Good morning" : hr < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="dash">
      <header className="dash-head card">
        <div><p className="kicker">Reader workspace</p><h1 className="h-lg">{greeting}, {me.name.split(" ")[0]}.</h1><p className="muted">{[me.programme, me.department].filter(Boolean).join(" · ")}{me.programme || me.department ? " · " : ""}{me.id_number}</p></div>
        <Link to="/catalogue" className="btn btn-accent">Find a book</Link>
      </header>
      <div className="stats">{stats.map(([k, v, s]) => <div className="card stat" key={k}><span className="label">{k}</span><strong className="stat-n">{v}</strong><span className="muted small">{s}</span></div>)}</div>
      {msg && <p className={`notice ${msg.ok ? "ok" : "warn"}`} role="status">{msg.ok && <Check size={14} />} {msg.text}</p>}
      {overdue.length > 0 && <div className="notice warn" role="alert">You have {overdue.length} overdue {overdue.length === 1 ? "item" : "items"}. Unpaid fines can block new loans. <a href="#fines">See fines</a></div>}
      <div className="dash-grid">
        <section className="card pad" id="loans">
          <h2 className="h-md">My loans</h2>
          {loans.error && <p className="err" role="alert">{loans.error.message}</p>}
          <div className="list">
            {loans.loading && !loans.data && <p className="muted">Loading…</p>}
            {loans.data && !loanList.length && <p className="muted">You have nothing on loan.</p>}
            {loanList.map((l) => { const d = daysLeft(l.due_at); return (
              <div className="list-row" key={l.id}>
                <div className="grow"><Link to={`/book/${l.title_id}`}><strong>{l.title}</strong></Link><p className="muted small">{l.barcode} · Due {fmtDateTime(l.due_at)}{l.renewals ? ` · renewed ${l.renewals}×` : ""}</p></div>
                <span className={`status ${l.is_overdue ? "bad" : d <= 3 ? "warn" : "ok"}`}>{l.is_overdue ? `Overdue ${l.days_overdue} ${l.days_overdue === 1 ? "day" : "days"}` : d <= 0 ? "Due today" : `${d} days left`}</span>
                <button className="btn btn-outline sm" onClick={() => renew(l)} disabled={l.is_overdue}><RefreshCw size={13} /> Renew</button>
              </div>); })}
          </div>
        </section>
        <aside className="stack">
          <section className="card pad"><h2 className="h-md">My holds</h2>
            {holds.data && !holdList.length && <p className="muted">No active holds.</p>}
            {holdList.map((h) => (
              <div className="list-row" key={h.id}>
                <div className="grow"><Link to={`/book/${h.title_id}`}><strong className="small">{h.title}</strong></Link><p className="muted small">{h.position === 0 ? `Ready. Collect by ${fmtDateTime(h.expires_at)}` : `Queue position ${h.position}`}</p></div>
                <span className={`status ${h.position === 0 ? "ok" : "warn"}`}>{h.position === 0 ? "Ready" : "Waiting"}</span>
                <button className="btn-icon sm" onClick={() => cancelHold(h)} aria-label={`Cancel hold on ${h.title}`}><X size={14} /></button>
              </div>))}
          </section>
          <section className="card pad" id="fines"><h2 className="h-md">Fines ledger</h2>
            {fines.error && <p className="err" role="alert">{fines.error.message}</p>}
            <table className="table compact"><tbody>
              {(fines.data?.entries || []).slice(0, 8).map((e) => <tr key={e.id}><td>{label(e.kind)}<span className="muted small block">{e.note || fmtDate(e.created_at)}</span></td><td className="right">{["payment", "waiver"].includes(e.kind) ? "−" : ""}{naira(e.amount)}</td></tr>)}
              <tr><td><strong>Total owed</strong></td><td className="right"><strong>{naira(owed)}</strong></td></tr>
            </tbody></table>
            <p className="muted small mt">Fines are paid at the circulation desk. Ask for a receipt.</p>
          </section>
        </aside>
      </div>

      <Assistant />
      <div className="dash-grid">
        <section className="card pad" id="notifications">
          <div className="row between"><h2 className="h-md">Notifications</h2>{(notes.data || []).some((n) => !n.read) && <button className="btn btn-outline sm" onClick={readAll}>Mark all read</button>}</div>
          <div className="list">
            {notes.data && !notes.data.length && <p className="muted">Nothing new.</p>}
            {(notes.data || []).slice(0, 8).map((n) => <div className="list-row" key={n.id}><div className="grow"><strong className="small">{n.subject}</strong>{!n.read && <span className="chip chip-learn" style={{ marginLeft: 8 }}>New</span>}<p className="muted small">{n.body}</p></div><span className="muted small">{fmtDate(n.created_at)}</span></div>)}
          </div>
          {recs.data?.recommendations?.length > 0 && (
            <>
              <h2 className="h-sm mt">Recommended for you</h2>
              <div className="list">{recs.data.recommendations.map((t) => <div className="list-row" key={t.id}><div className="grow"><Link to={`/book/${t.id}`}><strong className="small">{t.title}</strong></Link><p className="muted small">{t.reason || t.authors}</p></div></div>)}</div>
            </>
          )}
        </section>
        <aside className="stack">
          <form className="card pad" id="settings" onSubmit={saveProfile}>
            <h2 className="h-sm">Contact details</h2>
            <div className="field"><label htmlFor="ph">Phone</label><input id="ph" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} /></div>
            <div className="field"><label htmlFor="em">Email</label><input id="em" type="email" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} /></div>
            <button className="btn btn-primary" type="submit">Save</button>
            <p className="muted small mt"><Link to="/change-password" className="link-arrow">Change password</Link></p>
          </form>
        </aside>
      </div>
    </div>
  );
}

import { useState, useEffect } from "react";
import { NavLink, Link, Outlet, Navigate } from "react-router-dom";
import { LayoutGrid, ScanLine, ListChecks, FileBarChart, BookPlus, Users as UsersIcon, SlidersHorizontal, ScrollText, LogOut, Menu, Check } from "lucide-react";
import { Logo, Avatar, RequireAuth } from "../components/Layout.jsx";
import { useStore } from "../store.jsx";
import { useFetch } from "../useFetch.js";
import { api, downloadCsv } from "../api.js";
import { naira, fmtDateTime, label, actionLabel } from "../data.js";
import { Head, Msg, Err, Field, Loading, DataTable } from "./staffUi.jsx";
import { ImportPanel, AiSuggest, TitleDetail, DemandBrief, subjectAreas, formats, collections } from "./StaffExtra.jsx";
import { Settings } from "./SettingsPage.jsx";
import { readQueue, writeQueue, queueTx, newId } from "../offline.js";

// Role groups from the API guide (section 3).
const DESK = ["circulation", "head_librarian"];
const CATALOGUER = ["cataloguer", "head_librarian"];
const HEAD = ["head_librarian"];
const HEAD_ADMIN = ["head_librarian", "admin"];
const ANY = ["circulation", "cataloguer", "head_librarian", "admin"];

const nav = [
  ["/staff", "Overview", LayoutGrid, ANY, true],
  ["/staff/desk", "Circulation desk", ScanLine, DESK],
  ["/staff/holds", "Holds", ListChecks, DESK],
  ["/staff/reports", "Reports", FileBarChart, DESK],
  ["/staff/titles", "Titles & copies", BookPlus, CATALOGUER],
  ["/staff/members", "Members", UsersIcon, ANY],
  ["/staff/settings", "Settings", SlidersHorizontal, HEAD_ADMIN],
  ["/staff/audit", "Audit log", ScrollText, HEAD_ADMIN],
];

export const staffRoutes = [
  { index: true, element: <Overview />, roles: ANY },
  { path: "desk", element: <Desk />, roles: DESK },
  { path: "holds", element: <Holds />, roles: DESK },
  { path: "reports", element: <Reports />, roles: DESK },
  { path: "titles", element: <Titles />, roles: CATALOGUER },
  { path: "titles/:id", element: <TitleDetail />, roles: CATALOGUER },
  { path: "members", element: <Members />, roles: ANY },
  { path: "settings", element: <Settings />, roles: HEAD_ADMIN },
  { path: "audit", element: <Audit />, roles: HEAD_ADMIN },
];

export function StaffLayout() {
  const { state, logout } = useStore();
  const [open, setOpen] = useState(false);
  const u = state.user;
  return (
    <div className="shell">
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <Logo />
        <div className="side-group">
          <p className="kicker">{label(u.role)}</p>
          {nav.filter(([, , , roles]) => roles.includes(u.role)).map(([to, name, Icon, , end]) => (
            <NavLink key={to} to={to} end={!!end} className="side-link" onClick={() => setOpen(false)}><Icon size={17} /><span>{name}</span></NavLink>
          ))}
        </div>
        <div className="side-user">
          <Avatar />
          <div><strong>{u.name}</strong><span className="muted small block">{label(u.role)} · {u.id_number}</span></div>
          <Link to="/" onClick={logout} aria-label="Sign out"><LogOut size={16} /></Link>
        </div>
      </aside>
      <div className="shell-main">
        <div className="shell-top card">
          <button className="btn-icon menu-btn" onClick={() => setOpen(!open)} aria-label="Menu" aria-expanded={open}><Menu size={18} /></button>
          <span className="muted small">Library administration</span>
          <div className="row gap-sm"><Link to="/catalogue" className="muted small">Catalogue</Link><Avatar /></div>
        </div>
        <Outlet />
      </div>
    </div>
  );
}

// Wraps a page so only the listed roles can open it.
export const Only = ({ roles, children }) => {
  const { state } = useStore();
  return roles.includes(state.user.role) ? children : <Navigate to="/staff" replace />;
};

/* ---------- overview ---------- */
export function Overview() {
  const k = useFetch(() => api("/reports/dashboard"), []);
  const d = k.data;
  const tiles = d && [
    ["Loans today", d.loans_today], ["Active loans", d.active_loans], ["Overdue", d.overdue], ["Active holds", d.holds],
    ["Active members", d.active_members], ["Titles", d.titles], ["Copies", d.copies],
    ["Fines collected today", naira(d.fines_collected_today)], ["Fines outstanding", naira(d.fines_outstanding)],
  ];
  return (
    <div className="dash">
      <Head title="Library overview" />
      <Err e={k.error} /><Loading f={k} />
      {d && <div className="stats stats-3">{tiles.map(([n, v]) => <div className="card stat" key={n}><span className="label">{n}</span><strong className="stat-n">{v}</strong></div>)}</div>}
      {d && <section className="card pad"><h2 className="h-sm">Most borrowed titles</h2><DataTable columns={["Title", "Loans"]} rows={d.top_titles.map((t) => [t.title, t.loans])} /></section>}
    </div>
  );
}

/* ---------- circulation desk ---------- */
export function Desk() {
  const { state } = useStore();
  const isHead = state.user.role === "head_librarian";
  const [idn, setIdn] = useState("");
  const [sum, setSum] = useState(null);
  const [msg, setMsg] = useState(null);
  const [barcode, setBarcode] = useState("");
  const [override, setOverride] = useState("");
  const [needOverride, setNeed] = useState(false);
  const [ret, setRet] = useState({ barcode: "", condition: "ok" });
  const [pay, setPay] = useState({ amount: "", method: "cash", receipt_no: "" });
  const [waive, setWaive] = useState({ amount: "", reason: "" });
  const say = (ok, text) => setMsg({ ok, text });
  const memberId = sum?.member.id_number;
  const [offline, setOffline] = useState(false);
  const [queue, setQueue] = useState(readQueue);
  const [conflicts, setConflicts] = useState([]);

  const enqueue = (tx) => {
    setQueue(queueTx({ ...tx, client_id: newId(), occurred_at: new Date().toISOString() }));
    say(true, "No connection. Saved on this device and it will sync when you are back online.");
  };
  const sync = async () => {
    const q = readQueue();
    if (!q.length) return;
    try {
      const r = await api("/circulation/sync", { method: "POST", body: { transactions: q.slice(0, 500) } });
      const byId = Object.fromEntries(q.map((t) => [t.client_id, t]));
      const done = new Set(r.results.map((x) => x.client_id));
      const rest = q.filter((t) => !done.has(t.client_id));
      writeQueue(rest); setQueue(rest);
      const bad = r.results.filter((x) => x.status === "conflict").map((x) => ({ ...x, tx: byId[x.client_id] }));
      setConflicts(bad);
      say(!bad.length, `Synced ${r.results.length - bad.length} of ${r.results.length} saved transactions.${bad.length ? " Review the conflicts below." : ""}`);
    } catch (x) { say(false, x.message); }
  };
  useEffect(() => {
    const h = () => sync();
    window.addEventListener("online", h);
    return () => window.removeEventListener("online", h);
  }, []);

  const lookup = async (e, id = idn) => {
    e?.preventDefault();
    try { setSum(await api(`/members/lookup/${encodeURI(id.trim().toUpperCase())}`)); setMsg(null); setNeed(false); setOffline(false); }
    catch (x) { setSum(null); setOffline(x.status === 0); say(false, x.message); }
  };
  const issue = async (e) => {
    e.preventDefault();
    try {
      const r = await api("/circulation/issue", { method: "POST", body: { member_id_number: memberId, barcode: barcode.trim().toUpperCase(), override_reason: override.trim() || null } });
      setSum(r.summary); say(true, `Issued “${r.loan.title}”. Due ${fmtDateTime(r.loan.due_at)}.`);
      setBarcode(""); setOverride(""); setNeed(false);
    } catch (x) {
      if (x.status === 0) return enqueue({ type: "issue", barcode: barcode.trim().toUpperCase(), member_id_number: memberId, override_reason: override.trim() || null });
      const blocks = x.blocks || [];
      setNeed(x.code === "blocked" && blocks.length > 0 && blocks.every((b) => b.overridable));
      say(false, [x.message, ...blocks.map((b) => b.message)].filter(Boolean).join(" "));
    }
  };
  const giveBack = async (e) => {
    e.preventDefault();
    try {
      const r = await api("/circulation/return", { method: "POST", body: { barcode: ret.barcode.trim().toUpperCase(), condition: ret.condition } });
      say(true, `${r.instruction}${r.fine ? ` Fine charged: ${naira(r.fine)}.` : ""}`);
      setRet({ ...ret, barcode: "" });
      if (sum) lookup(null, memberId);
    } catch (x) {
      if (x.status === 0) { enqueue({ type: "return", barcode: ret.barcode.trim().toUpperCase(), condition: ret.condition }); setRet({ ...ret, barcode: "" }); }
      else say(false, x.message);
    }
  };
  const ledger = async (e, path, body, okText, reset) => {
    e.preventDefault();
    try { await api(path, { method: "POST", body: { member_id_number: memberId, ...body } }); say(true, okText); reset(); lookup(null, memberId); }
    catch (x) { say(false, x.message); }
  };

  return (
    <div className="dash">
      <Head title="Circulation desk" />
      <form className="card pad row gap-sm wrap-row" onSubmit={lookup}>
        <div className="field grow" style={{ margin: 0 }}><label htmlFor="mid">Scan or type a member ID</label><input id="mid" value={idn} onChange={(e) => setIdn(e.target.value)} placeholder="NITT/2022/001" /></div>
        <button className="btn btn-primary" type="submit">Look up</button>
      </form>
      <Msg m={msg} />
      {offline && !sum && (
        <form className="card pad" onSubmit={(e) => { e.preventDefault(); enqueue({ type: "issue", barcode: barcode.trim().toUpperCase(), member_id_number: idn.trim().toUpperCase(), override_reason: null }); setBarcode(""); }}>
          <h2 className="h-sm">Offline: queue an issue</h2>
          <p className="muted small">The server cannot be reached. Member rules are checked when this syncs, so a conflict may need follow-up.</p>
          <Field id="ob" label={`Book barcode for ${idn.trim().toUpperCase() || "the member above"}`} value={barcode} onChange={(e) => setBarcode(e.target.value)} />
          <button className="btn btn-primary" type="submit" disabled={!barcode.trim() || !idn.trim()}>Save offline</button>
        </form>
      )}
      {(queue.length > 0 || conflicts.length > 0) && (
        <section className="card pad">
          <div className="row between wrap-row"><h2 className="h-sm">Offline queue ({queue.length})</h2>{queue.length > 0 && <button className="btn btn-primary sm" onClick={sync}>Sync now</button>}</div>
          {queue.length > 0 && <DataTable columns={["Type", "Barcode", "Member", "Saved"]} rows={queue.map((t) => [label(t.type), t.barcode, t.member_id_number || "—", fmtDateTime(t.occurred_at)])} />}
          {conflicts.length > 0 && <><h3 className="title-md mt">Conflicts to review</h3><DataTable columns={["Type", "Barcode", "Member", "Problem"]} rows={conflicts.map((c) => [label(c.tx?.type), c.tx?.barcode, c.tx?.member_id_number || "—", c.message])} /></>}
        </section>
      )}
      {sum && (
        <>
          <section className="card pad">
            <div className="row between wrap-row"><div><h2 className="h-md">{sum.member.name}</h2><p className="muted small">{sum.member.id_number} · {label(sum.member.member_type)} · {label(sum.member.status)}</p></div>
              <div className="row gap-sm"><span className="chip chip-genre">{sum.loans.length} of {sum.loan_limit} loans</span><span className={`chip ${sum.fines_owed ? "chip-learn" : "chip-genre"}`}>{naira(sum.fines_owed)} owed</span></div></div>
            {sum.blocks.map((b) => <p key={b.code} className="notice warn">{b.message}{b.overridable ? " (can be overridden with a reason)" : ""}</p>)}
            <h3 className="title-md mt">On loan</h3>
            <DataTable columns={["Title", "Barcode", "Due", "Status"]} rows={sum.loans.map((l) => [l.title, l.barcode, fmtDateTime(l.due_at), l.is_overdue ? `Overdue ${l.days_overdue}d · ${naira(l.fine_estimate)}` : "OK"])} />
            {sum.holds.length > 0 && <><h3 className="title-md mt">Holds</h3><DataTable columns={["Title", "Position"]} rows={sum.holds.map((h) => [h.title, h.position === 0 ? "Ready for pickup" : h.position])} /></>}
          </section>
          <div className="admin-grid">
            <form className="card pad" onSubmit={issue}>
              <h2 className="h-sm">Issue a copy</h2>
              <Field id="bc" label="Book barcode" value={barcode} onChange={(e) => setBarcode(e.target.value)} placeholder="NITT0000009" />
              {needOverride && <Field id="ov" label="Override reason (required)" value={override} onChange={(e) => setOverride(e.target.value)} maxLength={300} />}
              <button className="btn btn-primary" type="submit" disabled={!barcode.trim()}>{needOverride ? "Issue with override" : "Issue"}</button>
            </form>
            <form className="card pad" onSubmit={(e) => ledger(e, "/fines/payments", { amount: Number(pay.amount), method: pay.method, receipt_no: pay.receipt_no.trim() }, "Payment recorded.", () => setPay({ amount: "", method: "cash", receipt_no: "" }))}>
              <h2 className="h-sm">Record a payment</h2>
              <Field id="pa" label="Amount (₦)" type="number" min="1" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} />
              <Field id="pm" label="Method"><select id="pm" value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value })}><option value="cash">Cash</option><option value="bank_transfer">Bank transfer</option><option value="pos">POS</option></select></Field>
              <Field id="pr" label="Receipt number" value={pay.receipt_no} onChange={(e) => setPay({ ...pay, receipt_no: e.target.value })} />
              <button className="btn btn-primary" type="submit" disabled={!pay.amount || !pay.receipt_no.trim()}>Record payment</button>
            </form>
          </div>
          {isHead && (
            <form className="card pad" onSubmit={(e) => ledger(e, "/fines/waivers", { amount: Number(waive.amount), reason: waive.reason.trim() }, "Waiver recorded.", () => setWaive({ amount: "", reason: "" }))}>
              <h2 className="h-sm">Waive fines</h2>
              <Field id="wa" label="Amount (₦)" type="number" min="1" value={waive.amount} onChange={(e) => setWaive({ ...waive, amount: e.target.value })} />
              <Field id="wr" label="Reason (min 5 characters)" value={waive.reason} onChange={(e) => setWaive({ ...waive, reason: e.target.value })} />
              <button className="btn btn-outline" type="submit" disabled={!waive.amount || waive.reason.trim().length < 5}>Waive</button>
            </form>
          )}
        </>
      )}
      <form className="card pad" onSubmit={giveBack}>
        <h2 className="h-sm">Return a copy</h2>
        <div className="row gap-sm wrap-row">
          <div className="field grow" style={{ margin: 0 }}><label htmlFor="rb">Book barcode</label><input id="rb" value={ret.barcode} onChange={(e) => setRet({ ...ret, barcode: e.target.value })} placeholder="NITT0000009" /></div>
          <div className="field" style={{ margin: 0 }}><label htmlFor="rc">Condition</label><select id="rc" value={ret.condition} onChange={(e) => setRet({ ...ret, condition: e.target.value })}><option value="ok">OK</option><option value="damaged">Damaged</option></select></div>
          <button className="btn btn-primary" type="submit" disabled={!ret.barcode.trim()}>Return</button>
        </div>
      </form>
    </div>
  );
}

/* ---------- holds ---------- */
export function Holds() {
  const [status, setStatus] = useState("active");
  const h = useFetch(() => api("/holds", { query: { status } }), [status]);
  const [msg, setMsg] = useState(null);
  const cancel = async (x) => { try { await api(`/holds/${x.id}`, { method: "DELETE" }); setMsg({ ok: true, text: "Hold cancelled." }); h.reload(); } catch (e) { setMsg({ ok: false, text: e.message }); } };
  return (
    <div className="dash">
      <Head title="Holds"><select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">{["active", "queued", "ready", "fulfilled", "cancelled", "expired"].map((s) => <option key={s} value={s}>{label(s)}</option>)}</select></Head>
      <Msg m={msg} /><Err e={h.error} /><Loading f={h} />
      {h.data && (
        <section className="card pad"><div className="table-wrap"><table className="table"><thead><tr><th>Title</th><th>Member</th><th>Status</th><th>Position</th><th>Expires</th><th /></tr></thead><tbody>
          {h.data.map((x) => <tr key={x.id}><td>{x.title}</td><td>{x.member?.name}<span className="muted small block">{x.member?.id_number}</span></td><td>{label(x.status)}</td><td>{x.position === 0 ? "Ready" : x.position > 0 ? x.position : "—"}</td><td>{fmtDateTime(x.expires_at)}</td>
            <td>{["queued", "ready"].includes(x.status) && <button className="btn btn-outline sm" onClick={() => cancel(x)}>Cancel</button>}</td></tr>)}
          {!h.data.length && <tr><td colSpan={6} className="muted">No holds.</td></tr>}
        </tbody></table></div></section>
      )}
    </div>
  );
}

/* ---------- reports ---------- */
const reportDefs = [
  ["overdue", "Overdue items", DESK], ["circulation", "Circulation", HEAD], ["top-titles", "Top titles", HEAD], ["lost", "Lost items", HEAD],
  ["fines", "Fines", HEAD], ["member-activity", "Member activity", HEAD], ["demand", "Purchasing demand", HEAD],
];

export function Reports() {
  const { state } = useStore();
  const allowed = reportDefs.filter(([, , roles]) => roles.includes(state.user.role));
  const [key, setKey] = useState(allowed[0][0]);
  const [f, setF] = useState({ from: "", to: "", group_by: "department", unused: false });
  const [res, setRes] = useState(null);
  const [err, setErr] = useState(null);
  const query = { from: f.from, to: f.to, ...(key === "circulation" ? { group_by: f.group_by } : {}), ...(key === "top-titles" && f.unused ? { unused: "true" } : {}) };

  const run = async (e) => { e?.preventDefault(); setErr(null); try { setRes(await api(`/reports/${key}`, { query })); } catch (x) { setRes(null); setErr(x); } };
  const csv = async () => { try { await downloadCsv(`/reports/${key}`, query, `${key}.csv`); } catch (x) { setErr(x); } };
  const dated = !["overdue", "lost", "demand"].includes(key);

  return (
    <div className="dash">
      <Head title="Reports" />
      <form className="card pad row gap-sm wrap-row" onSubmit={run}>
        <Field id="rk" label="Report"><select id="rk" value={key} onChange={(e) => { setKey(e.target.value); setRes(null); }}>{allowed.map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select></Field>
        {dated && <><Field id="rf" label="From" type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /><Field id="rt" label="To" type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></>}
        {key === "circulation" && <Field id="rg" label="Group by"><select id="rg" value={f.group_by} onChange={(e) => setF({ ...f, group_by: e.target.value })}><option value="department">Department</option><option value="programme">Programme</option><option value="day">Day</option></select></Field>}
        {key === "top-titles" && <label className="check"><input type="checkbox" checked={f.unused} onChange={(e) => setF({ ...f, unused: e.target.checked })} /> Unused titles only</label>}
        <button className="btn btn-primary" type="submit">Run</button>
        {key !== "demand" && <button className="btn btn-outline" type="button" onClick={csv}>Download CSV</button>}
      </form>
      <Err e={err} />
      {res && key === "demand" && (
        <>
          <section className="card pad"><h2 className="h-sm">Waitlists</h2><DataTable columns={["Title", "Waiting", "Copies"]} rows={res.waitlists.map((w) => [w.title, w.waiting, w.copies])} /></section>
          <section className="card pad"><h2 className="h-sm">Failed searches</h2><DataTable columns={["Search", "Times"]} rows={res.failed_searches.map((s) => [s.query, s.times])} /></section>
          <section className="card pad"><h2 className="h-sm">Heavily used</h2><DataTable columns={["Title", "Loans (90d)", "Copies", "Loans per copy"]} rows={res.heavily_used.map((s) => [s.title, s.loans_90d, s.copies, s.loans_per_copy])} /></section>
          <DemandBrief />
        </>
      )}
      {res && key !== "demand" && <section className="card pad"><h2 className="h-sm">{res.title}</h2>{res.from && <p className="muted small">{res.from} to {res.to}</p>}<DataTable columns={res.columns} rows={res.rows} /></section>}
    </div>
  );
}

/* ---------- titles & copies (cataloguer) ---------- */
const blankTitle = { title: "", authors: "", isbn: "", publisher: "", year: "", edition: "", subject_area: "other", format: "print_book", call_number: "", department: "", language: "English", copies: "1", shelf_location: "", collection: "general", cost: "" };

export function Titles() {
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const list = useFetch(() => api("/catalogue/search", { query: { q: query, page_size: 20 } }), [query]);
  const [f, setF] = useState(blankTitle);
  const [msg, setMsg] = useState(null);
  const [add, setAdd] = useState({});
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const create = async (e) => {
    e.preventDefault();
    const body = {};
    Object.entries(f).forEach(([k, v]) => { if (v !== "") body[k] = ["year", "copies", "cost"].includes(k) ? Number(v) : v; });
    try { const t = await api("/catalogue/titles", { method: "POST", body }); setMsg({ ok: true, text: `Created “${t.title}” with ${t.copies?.length ?? 0} copies (${t.copies?.map((c) => c.barcode).join(", ")}).` }); setF(blankTitle); list.reload(); }
    catch (x) { setMsg({ ok: false, text: x.message }); }
  };
  const addCopies = async (t) => {
    try { const c = await api(`/catalogue/titles/${t.id}/copies`, { method: "POST", body: { count: Number(add[t.id] || 1) } }); setMsg({ ok: true, text: `Added ${c.length} ${c.length === 1 ? "copy" : "copies"} to “${t.title}”.` }); list.reload(); }
    catch (x) { setMsg({ ok: false, text: x.message }); }
  };
  const retire = async (t) => {
    if (!window.confirm(`Retire “${t.title}”? It will be hidden from the catalogue.`)) return;
    try { await api(`/catalogue/titles/${t.id}/retire`, { method: "POST" }); setMsg({ ok: true, text: `Retired “${t.title}”.` }); list.reload(); }
    catch (x) { setMsg({ ok: false, text: x.message }); }
  };

  return (
    <div className="dash">
      <Head title="Titles and copies" />
      <Msg m={msg} />
      <form className="card pad" onSubmit={create} noValidate>
        <h2 className="h-md">Add a title</h2>
        <div className="form-grid">
          <Field id="t-title" label="Title *" value={f.title} onChange={set("title")} />
          <Field id="t-auth" label="Authors (separate with ;)" value={f.authors} onChange={set("authors")} />
          <Field id="t-isbn" label="ISBN" value={f.isbn} onChange={set("isbn")} />
          <Field id="t-pub" label="Publisher" value={f.publisher} onChange={set("publisher")} />
          <Field id="t-year" label="Year" type="number" value={f.year} onChange={set("year")} />
          <Field id="t-ed" label="Edition" value={f.edition} onChange={set("edition")} />
          <Field id="t-sa" label="Subject area"><select id="t-sa" value={f.subject_area} onChange={set("subject_area")}>{subjectAreas.map((s) => <option key={s} value={s}>{label(s)}</option>)}</select></Field>
          <Field id="t-fmt" label="Format"><select id="t-fmt" value={f.format} onChange={set("format")}>{formats.map((s) => <option key={s} value={s}>{label(s)}</option>)}</select></Field>
          <Field id="t-call" label="Call number" value={f.call_number} onChange={set("call_number")} />
          <Field id="t-dep" label="Department" value={f.department} onChange={set("department")} />
          <Field id="t-copies" label="Copies (0–50)" type="number" min="0" max="50" value={f.copies} onChange={set("copies")} />
          <Field id="t-shelf" label="Shelf location" value={f.shelf_location} onChange={set("shelf_location")} />
          <Field id="t-col" label="Collection"><select id="t-col" value={f.collection} onChange={set("collection")}>{collections.map((s) => <option key={s} value={s}>{label(s)}</option>)}</select></Field>
          <Field id="t-cost" label="Cost per copy (₦)" type="number" min="0" value={f.cost} onChange={set("cost")} />
        </div>
        <AiSuggest form={f} onApply={(p) => setF({ ...f, ...p })} />
        <button className="btn btn-primary mt" type="submit" disabled={!f.title.trim()}>Create title</button>
      </form>
      <section className="card pad">
        <form className="search search-lg" onSubmit={(e) => { e.preventDefault(); setQuery(q); }}><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search titles to manage" aria-label="Search titles" /></form>
        <Err e={list.error} /><Loading f={list} />
        {list.data && (
          <div className="table-wrap"><table className="table"><thead><tr><th>Title</th><th>Copies</th><th>Add copies</th><th /></tr></thead><tbody>
            {list.data.results.map((t) => (
              <tr key={t.id}><td><Link to={`/staff/titles/${t.id}`}><strong>{t.title}</strong></Link><span className="muted small block">{t.authors} · {t.call_number}</span></td><td>{t.available_copies}/{t.total_copies}</td>
                <td><div className="row gap-sm"><input type="number" min="1" max="50" value={add[t.id] || 1} onChange={(e) => setAdd({ ...add, [t.id]: e.target.value })} style={{ width: 70 }} aria-label="Number of copies" /><button className="btn btn-outline sm" onClick={() => addCopies(t)}>Add</button></div></td>
                <td><button className="btn btn-outline sm" onClick={() => retire(t)}>Retire</button></td></tr>
            ))}
          </tbody></table></div>
        )}
      </section>
      <ImportPanel title="Import titles" path="/catalogue/import" template="/catalogue/import-template" templateName="titles_template.csv" columns="title, authors, isbn, subjects, subject_area, call_number, format, copies, shelf_location, collection, cost" onDone={list.reload} />
    </div>
  );
}

/* ---------- members ---------- */
const staffRoleOptions = ["circulation", "cataloguer", "head_librarian", "admin"];
const blankMember = { id_number: "", name: "", member_type: "student", role: "", email: "", phone: "", temporary_password: "" };

export function Members() {
  const { state } = useStore();
  const role = state.user.role;
  const canEdit = HEAD_ADMIN.includes(role);
  const canCreate = ["circulation", "head_librarian", "admin"].includes(role);
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const list = useFetch(() => api("/members", { query: { q: query, page_size: 50 } }), [query]);
  const [f, setF] = useState(blankMember);
  const [msg, setMsg] = useState(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const create = async (e) => {
    e.preventDefault();
    const body = {};
    Object.entries(f).forEach(([k, v]) => { if (v !== "") body[k] = k === "id_number" ? v.trim().toUpperCase() : v; });
    try { const m = await api("/members", { method: "POST", body }); setMsg({ ok: true, text: `Registered ${m.name} (${m.id_number}).${m.must_change_password ? " They must change their password at first sign-in." : ""}` }); setF(blankMember); list.reload(); }
    catch (x) { setMsg({ ok: false, text: x.message }); }
  };
  const toggle = async (m) => {
    try { await api(`/members/${m.id}`, { method: "PATCH", body: { status: m.status === "active" ? "suspended" : "active" } }); list.reload(); }
    catch (x) { setMsg({ ok: false, text: x.message }); }
  };

  return (
    <div className="dash">
      <Head title="Members" />
      <Msg m={msg} />
      <div className="dash-grid">
        <section className="card pad">
          <form className="search search-lg" onSubmit={(e) => { e.preventDefault(); setQuery(q); }}><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or ID" aria-label="Search members" /></form>
          <Err e={list.error} /><Loading f={list} />
          {list.data && (
            <div className="table-wrap"><table className="table"><thead><tr><th>Name</th><th>Role</th><th>Status</th>{canEdit && <th />}</tr></thead><tbody>
              {list.data.results.map((m) => (
                <tr key={m.id}><td><strong>{m.name}</strong><span className="muted small block">{m.id_number}</span></td><td>{label(m.role)}</td>
                  <td><span className={`status ${m.status === "active" ? "ok" : "bad"}`}>{label(m.status)}</span>{!m.activated && <span className="chip chip-learn" style={{ marginLeft: 6 }}>Not activated</span>}</td>
                  {canEdit && <td><button className="btn btn-outline sm" onClick={() => toggle(m)}>{m.status === "active" ? "Suspend" : "Reactivate"}</button></td>}</tr>
              ))}
              {!list.data.results.length && <tr><td colSpan={4} className="muted">No members found.</td></tr>}
            </tbody></table></div>
          )}
        </section>
        {canCreate && (
          <form className="card pad" onSubmit={create} noValidate>
            <h2 className="h-md">Register a member</h2>
            <Field id="m-id" label="ID number" value={f.id_number} onChange={set("id_number")} />
            <Field id="m-name" label="Full name" value={f.name} onChange={set("name")} />
            <Field id="m-type" label="Member type"><select id="m-type" value={f.member_type} onChange={set("member_type")}>{["student", "academic_staff", "non_academic_staff", "visitor"].map((s) => <option key={s} value={s}>{label(s)}</option>)}</select></Field>
            {role === "admin" && <Field id="m-role" label="Staff role (optional)"><select id="m-role" value={f.role} onChange={set("role")}><option value="">None</option>{staffRoleOptions.map((s) => <option key={s} value={s}>{label(s)}</option>)}</select></Field>}
            <Field id="m-email" label="Email" type="email" value={f.email} onChange={set("email")} />
            <Field id="m-phone" label="Phone" value={f.phone} onChange={set("phone")} />
            <Field id="m-pw" label="Temporary password (min 8, optional)" type="password" value={f.temporary_password} onChange={set("temporary_password")} autoComplete="new-password" />
            <button className="btn btn-primary full" type="submit" disabled={!f.id_number.trim() || !f.name.trim()}>Register</button>
            <p className="muted small mt">Without a password, the member activates through “Forgot password” (needs an email).</p>
          </form>
        )}
      </div>
      {canEdit && <ImportPanel title="Import members" path="/members/import" columns="id_number, name, member_type, programme, level, department, phone, email" onDone={list.reload} />}
    </div>
  );
}

/* ---------- audit log ---------- */
export function Audit() {
  const [f, setF] = useState({ actor: "", action: "", from: "", to: "" });
  const [applied, setApplied] = useState(f);
  const [page, setPage] = useState(1);
  const a = useFetch(() => api("/admin/audit", { query: { ...applied, page, page_size: 50 } }), [applied, page]);
  return (
    <div className="dash">
      <Head title="Audit log" />
      <form className="card pad row gap-sm wrap-row" onSubmit={(e) => { e.preventDefault(); setPage(1); setApplied(f); }}>
        <Field id="au-a" label="Actor" value={f.actor} onChange={(e) => setF({ ...f, actor: e.target.value })} />
        <Field id="au-x" label="Action (e.g. loan.issue)" value={f.action} onChange={(e) => setF({ ...f, action: e.target.value })} />
        <Field id="au-f" label="From" type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} />
        <Field id="au-t" label="To" type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} />
        <button className="btn btn-primary" type="submit">Filter</button>
      </form>
      <Err e={a.error} /><Loading f={a} />
      {a.data && (
        <section className="card pad">
          <DataTable columns={["When", "Actor", "Action", "Entity", "IP"]} rows={a.data.map((r) => [fmtDateTime(r.at), r.actor, <>{actionLabel(r.action)}<span className="muted small block mono">{r.action}</span></>, `${r.entity} ${r.entity_id ?? ""}`, r.ip ?? r.ip_address])} />
          <div className="row gap-sm center mt"><button className="btn btn-outline sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button><span className="muted small">Page {page}</span><button className="btn btn-outline sm" disabled={a.data.length < 50} onClick={() => setPage(page + 1)}>Next</button></div>
        </section>
      )}
    </div>
  );
}

import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { GraduationCap, Briefcase, Eye, EyeOff } from "lucide-react";
import { useStore } from "../store.jsx";
import { roleHome } from "../data.js";

const tabs = {
  student: { label: "Student", icon: GraduationCap, field: "Matric number or NITT ID", placeholder: "NITT/2022/001" },
  staff: { label: "Staff", icon: Briefcase, field: "Staff ID", placeholder: "ADMIN001" },
};

export default function Login() {
  const { state, login } = useStore();
  const nav = useNavigate();
  const from = useLocation().state?.from;
  const [tab, setTab] = useState("student");
  const [ident, setIdent] = useState("");
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (state.user) return <Navigate to={from || roleHome(state.user.role)} replace />;

  const submit = async (e) => {
    e.preventDefault();
    if (!ident.trim() || !pw) return setError("Enter your ID and password.");
    setBusy(true); setError("");
    try {
      const member = await login(ident.trim().toUpperCase(), pw);
      nav(from || roleHome(member.role), { replace: true });
    } catch (err) {
      setError(err.message);
    } finally { setBusy(false); }
  };

  const t = tabs[tab];
  return (
    <div className="wrap narrow section">
      <div className="card pad login">
        <p className="kicker">Welcome back</p>
        <h1 className="h-lg">Sign in to NITT Library</h1>
        <div className="tabs mt" role="tablist" aria-label="Account type">
          {Object.entries(tabs).map(([k, v]) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => { setTab(k); setError(""); }}>
              <v.icon size={14} /> {v.label}
            </button>
          ))}
        </div>
        <form onSubmit={submit} noValidate>
          <div className="field">
            <label htmlFor="ident">{t.field}</label>
            <input id="ident" value={ident} onChange={(e) => setIdent(e.target.value)} placeholder={t.placeholder} autoComplete="username" />
          </div>
          <div className="field">
            <label htmlFor="pw">Password</label>
            <div className="pw-wrap">
              <input id="pw" type={show ? "text" : "password"} value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" />
              <button type="button" className="btn-icon sm" onClick={() => setShow(!show)} aria-label={show ? "Hide password" : "Show password"}>{show ? <EyeOff size={14} /> : <Eye size={14} />}</button>
            </div>
          </div>
          {error && <p className="err" role="alert">{error}</p>}
          <button className="btn btn-primary full" type="submit" disabled={busy}>{busy ? "Signing in…" : `Sign in as ${t.label.toLowerCase()}`}</button>
        </form>
        <p className="muted small mt"><Link to="/forgot" className="link-arrow">Forgot your password, or first time signing in?</Link></p>
      </div>
    </div>
  );
}

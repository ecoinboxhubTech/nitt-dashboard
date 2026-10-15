import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api.js";
import { useStore } from "../store.jsx";
import { roleHome } from "../data.js";

const Shell = ({ kicker, title, children }) => (
  <div className="wrap narrow section"><div className="card pad login"><p className="kicker">{kicker}</p><h1 className="h-lg">{title}</h1>{children}</div></div>
);

const Field = ({ id, label, ...rest }) => (
  <div className="field"><label htmlFor={id}>{label}</label><input id={id} {...rest} /></div>
);

// Two steps: ask for an e-mailed code, then set a new password. Also activates imported accounts.
export function Forgot() {
  const nav = useNavigate();
  const [step, setStep] = useState(1);
  const [f, setF] = useState({ id_number: "", code: "", new_password: "" });
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const send = async (e) => {
    e.preventDefault(); setErr("");
    try { const r = await api("/auth/forgot-password", { method: "POST", body: { id_number: f.id_number.trim().toUpperCase() } }); setMsg(r.message); setStep(2); }
    catch (x) { setErr(x.message); }
  };
  const reset = async (e) => {
    e.preventDefault(); setErr("");
    try { await api("/auth/reset-password", { method: "POST", body: { id_number: f.id_number.trim().toUpperCase(), code: f.code.trim(), new_password: f.new_password } }); nav("/login", { replace: true }); }
    catch (x) { setErr(x.message); }
  };

  return (
    <Shell kicker="Account help" title={step === 1 ? "Reset your password" : "Enter your code"}>
      {step === 1 ? (
        <form onSubmit={send} noValidate>
          <p className="muted">Enter your ID number and we will e-mail you a 6-digit code. Use this too if your account was imported and has no password yet.</p>
          <Field id="rid" label="ID number" value={f.id_number} onChange={set("id_number")} className="mt" />
          {err && <p className="err" role="alert">{err}</p>}
          <button className="btn btn-primary full" type="submit">Send code</button>
        </form>
      ) : (
        <form onSubmit={reset} noValidate>
          <p className="notice ok" role="status">{msg}</p>
          <Field id="code" label="6-digit code" value={f.code} onChange={set("code")} inputMode="numeric" />
          <Field id="np" label="New password (min 8 characters)" type="password" value={f.new_password} onChange={set("new_password")} autoComplete="new-password" />
          {err && <p className="err" role="alert">{err}</p>}
          <button className="btn btn-primary full" type="submit">Set password</button>
        </form>
      )}
      <p className="muted small mt"><Link to="/login" className="link-arrow">Back to sign in</Link></p>
    </Shell>
  );
}

export function ChangePassword() {
  const nav = useNavigate();
  const { state, acceptSession } = useStore();
  const [f, setF] = useState({ current_password: "", new_password: "", confirm: "" });
  const [err, setErr] = useState("");
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault(); setErr("");
    if (f.new_password.length < 8) return setErr("The new password must be at least 8 characters.");
    if (f.new_password !== f.confirm) return setErr("The two new passwords do not match.");
    if (f.new_password === f.current_password) return setErr("The new password must be different from the current one.");
    try {
      const member = acceptSession(await api("/auth/change-password", { method: "POST", body: { current_password: f.current_password, new_password: f.new_password } }));
      nav(roleHome(member.role), { replace: true });
    } catch (x) { setErr(x.message); }
  };

  return (
    <Shell kicker="Security" title="Choose a new password">
      <p className="muted">{state.user?.must_change_password ? "You must change your temporary password before continuing." : "Update your password."}</p>
      <form onSubmit={submit} noValidate className="mt">
        <Field id="cp" label="Current password" type="password" value={f.current_password} onChange={set("current_password")} autoComplete="current-password" />
        <Field id="np" label="New password" type="password" value={f.new_password} onChange={set("new_password")} autoComplete="new-password" />
        <Field id="cf" label="Confirm new password" type="password" value={f.confirm} onChange={set("confirm")} autoComplete="new-password" />
        {err && <p className="err" role="alert">{err}</p>}
        <button className="btn btn-primary full" type="submit">Change password</button>
      </form>
    </Shell>
  );
}

export function Consent() {
  const nav = useNavigate();
  const { state, setUser, logout } = useStore();
  const [err, setErr] = useState("");
  const agree = async () => {
    try { const m = await api("/auth/consent", { method: "POST" }); setUser(m); nav(roleHome(m.role), { replace: true }); }
    catch (x) { setErr(x.message); }
  };
  return (
    <Shell kicker="Your data" title="Data processing consent">
      <p>Welcome, {state.user?.name}. The library stores your name, ID, contact details, loans and fines to run your account. Your data is handled under the Nigeria Data Protection Act 2023.</p>
      {err && <p className="err" role="alert">{err}</p>}
      <div className="row gap-sm mt"><button className="btn btn-primary" onClick={agree}>I agree</button><button className="btn btn-outline" onClick={logout}>Sign out</button></div>
    </Shell>
  );
}

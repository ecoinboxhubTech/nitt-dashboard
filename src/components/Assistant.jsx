import { useState } from "react";
import { Link } from "react-router-dom";
import { Send } from "lucide-react";
import { api } from "../api.js";
import { useFetch } from "../useFetch.js";

// Chat helper backed by POST /ai/assistant. Hidden when the AI provider is not configured.
export default function Assistant() {
  const status = useFetch(() => api("/ai/status"), []);
  const [turns, setTurns] = useState([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  if (!status.data?.enabled) return null;

  const send = async (e) => {
    e.preventDefault();
    const message = text.trim();
    if (message.length < 2) return;
    const history = turns.slice(-6).map(({ role, content }) => ({ role, content }));
    setTurns((t) => [...t, { role: "user", content: message }]);
    setText(""); setBusy(true); setErr(null);
    try {
      const r = await api("/ai/assistant", { method: "POST", body: { message, history } });
      setTurns((t) => [...t, { role: "assistant", content: r.reply, titles: r.titles }]);
    } catch (x) { setErr(x); } finally { setBusy(false); }
  };

  return (
    <section className="card pad" id="assistant">
      <h2 className="h-md">Library assistant</h2>
      <p className="muted small">Ask for reading suggestions or about your loans. It only recommends titles the library holds.</p>
      <div className="chat" aria-live="polite">
        {turns.map((t, i) => (
          <div key={i} className={`bubble-msg ${t.role}`}>
            <p>{t.content}</p>
            {t.titles?.length > 0 && <div className="chips">{t.titles.map((b) => <Link key={b.id} className="chip chip-genre" to={`/book/${b.id}`}>{b.title}</Link>)}</div>}
          </div>
        ))}
        {busy && <p className="muted small" role="status">Thinking…</p>}
      </div>
      {err && <p className="err" role="alert">{err.status === 429 ? "You have reached the hourly limit for the assistant. Try again later." : err.message}</p>}
      <form className="row gap-sm mt" onSubmit={send}>
        <input className="grow" value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. Which books cover port congestion?" aria-label="Message the assistant" maxLength={500} />
        <button className="btn btn-primary" type="submit" disabled={busy || text.trim().length < 2}><Send size={14} /> Ask</button>
      </form>
    </section>
  );
}

import { NavLink, Link, Outlet, Navigate, useNavigate, useLocation } from "react-router-dom";
import { useState } from "react";
import { Search, Bell, LayoutGrid, Library, Target, Compass, Star, Settings, LogOut, Menu, Lock, HelpCircle } from "lucide-react";
import { useStore } from "../store.jsx";
import { useFetch } from "../useFetch.js";
import { api } from "../api.js";
import { isMember, roleHome } from "../data.js";

export const Logo = () => (
  <Link to="/" className="logo" aria-label="NITT Library home">
    <span className="logo-mark"><Library size={16} /></span>
    <span><span className="logo-name">NITT Library</span></span>
  </Link>
);

export const initials = (n = "") => n.replace(/^(Engr|Dr|Mr|Mrs|Prof|Capt)\.?\s+/i, "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");

export const Avatar = () => {
  const { state } = useStore();
  return <span className="avatar" aria-label={state.user?.name}>{initials(state.user?.name)}</span>;
};

// Guards a group of routes. `roles` limits who may enter; `gate` enforces the
// forced password change and the data-processing consent screens.
export function RequireAuth({ roles, gate = true }) {
  const { state } = useStore();
  const loc = useLocation();
  const u = state.user;
  if (!state.ready) return <div className="wrap section"><p className="muted" role="status">Loading…</p></div>;
  if (!u) return <Navigate to="/login" state={{ from: loc.pathname + loc.search }} replace />;
  if (gate && u.must_change_password) return <Navigate to="/change-password" replace />;
  if (gate && !u.consented) return <Navigate to="/consent" replace />;
  if (roles && !roles.includes(u.role)) return <Navigate to={roleHome(u.role)} replace />;
  return <Outlet />;
}

function SearchBox({ placeholder = "Search titles, authors, call numbers…" }) {
  const nav = useNavigate();
  const [q, setQ] = useState("");
  return (
    <form className="search" role="search" onSubmit={(e) => { e.preventDefault(); nav(`/catalogue?q=${encodeURIComponent(q)}`); }}>
      <Search size={16} aria-hidden />
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} aria-label="Search the catalogue" />
    </form>
  );
}

function AccountArea() {
  const { state, logout } = useStore();
  const u = state.user;
  const unread = useFetch(() => (u && isMember(u.role) ? api("/auth/notifications") : null), [u?.id]);
  if (!u) return <Link to="/login" className="btn btn-primary sm">Sign in</Link>;
  const hasNew = (unread.data || []).some((n) => !n.read);
  return (
    <div className="row gap-sm">
      {isMember(u.role) && <Link to="/dashboard#notifications" className="btn-icon bubble" aria-label="Notifications"><Bell size={17} />{hasNew && <span className="dot" />}</Link>}
      <Link to={roleHome(u.role)} aria-label="My account"><Avatar /></Link>
      <button className="btn-icon bubble" onClick={logout} aria-label="Sign out"><LogOut size={16} /></button>
    </div>
  );
}

export function PublicLayout({ minimal = false }) {
  const [open, setOpen] = useState(false);
  const { state } = useStore();
  const u = state.user;
  return (
    <>
      <header className="topnav">
        <div className="topnav-inner">
          <Logo />
          {minimal ? (
            <div className="secure-row">
              <span className="chip chip-genre"><Lock size={13} /> Secure session</span>
              <a className="muted small row" href="mailto:library@nitt.edu.ng"><HelpCircle size={14} /> Library help</a>
            </div>
          ) : (
            <>
              <button className="btn-icon menu-btn" onClick={() => setOpen(!open)} aria-label="Menu" aria-expanded={open}><Menu size={18} /></button>
              <nav className={`pill-nav ${open ? "open" : ""}`} onClick={() => setOpen(false)}>
                <NavLink to="/" end>Home</NavLink>
                <NavLink to="/catalogue">Catalogue</NavLink>
                {u && <NavLink to={roleHome(u.role)}>{isMember(u.role) ? "My Library" : "Staff"}</NavLink>}
              </nav>
              <SearchBox />
              <AccountArea />
            </>
          )}
        </div>
      </header>
      <main><Outlet /></main>
      {!minimal && <Footer />}
    </>
  );
}

const side = [
  ["Reader workspace", [["/dashboard", "Overview", LayoutGrid], ["/dashboard#loans", "My Library", Library], ["/dashboard#fines", "Fines", Target], ["/dashboard#notifications", "Notifications", Bell]]],
  ["Library", [["/catalogue", "Browse Catalogue", Compass], ["/#new", "New Arrivals", Star]]],
  ["Preferences", [["/dashboard#settings", "Settings", Settings]]],
];

// NavLink compares paths only, so work out the active item from the hash too.
export const useIsActive = () => {
  const loc = useLocation();
  return (to) => {
    const [path, hash = ""] = to.split("#");
    return loc.pathname === path && loc.hash.slice(1) === hash;
  };
};

export function AppLayout() {
  const [open, setOpen] = useState(false);
  const { state, logout } = useStore();
  const member = state.user;
  const isActive = useIsActive();
  return (
    <div className="shell">
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <Logo />
        {side.map(([h, items]) => (
          <div key={h} className="side-group">
            <p className="kicker">{h}</p>
            {items.map(([to, label, Icon]) => (
              <NavLink key={label} to={to} end className={() => `side-link ${isActive(to) ? "active" : ""}`} onClick={() => setOpen(false)}><Icon size={17} /><span>{label}</span></NavLink>
            ))}
          </div>
        ))}
        <div className="side-user">
          <Avatar />
          <div><strong>{member.name}</strong><span className="muted small block">{member.role === "lecturer" ? "Lecturer" : "Student"} · {member.id_number}</span></div>
          <Link to="/" onClick={logout} aria-label="Sign out"><LogOut size={16} /></Link>
        </div>
      </aside>
      <div className="shell-main">
        <div className="shell-top card">
          <button className="btn-icon menu-btn" onClick={() => setOpen(!open)} aria-label="Menu" aria-expanded={open}><Menu size={18} /></button>
          <SearchBox placeholder="Search library titles…" />
          <div className="row gap-sm"><Link to="/" className="muted small">Library site</Link><Avatar /></div>
        </div>
        <Outlet />
      </div>
    </div>
  );
}

export function Footer() {
  return (
    <footer className="footer">
      <div className="wrap footer-grid">
        <div><Logo /><p className="muted small mt">Library of the Nigeria Institute of Transport Technology, Zaria. Find it, reserve it, borrow it.</p></div>
        <div><p className="kicker">Collections</p><Link to="/#new">New arrivals</Link><Link to="/catalogue?s=maritime">Maritime</Link><Link to="/catalogue?s=aviation">Aviation</Link><Link to="/catalogue?f=report">Project reports</Link></div>
        <div><p className="kicker">My account</p><Link to="/dashboard">Loans and holds</Link><Link to="/dashboard#fines">Fines</Link><Link to="/login">Sign in</Link></div>
        <div><p className="kicker">Library desk</p><p className="muted small">Mon–Fri 8:00–17:00 · Sat 9:00–13:00</p><p className="muted small">library@nitt.edu.ng</p></div>
      </div>
      <div className="wrap footer-base muted small"><span>© 2026 NITT Library</span><span>Your data is handled under the Nigeria Data Protection Act 2023.</span></div>
    </footer>
  );
}

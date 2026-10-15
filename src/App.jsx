import { Routes, Route, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { PublicLayout, AppLayout, RequireAuth } from "./components/Layout.jsx";
import Home from "./pages/Home.jsx";
import Catalogue from "./pages/Catalogue.jsx";
import Book from "./pages/Book.jsx";
import Reader from "./pages/Reader.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Login from "./pages/Login.jsx";
import { Forgot, ChangePassword, Consent } from "./pages/AuthPages.jsx";
import { StaffLayout, Only, staffRoutes } from "./pages/Staff.jsx";

function ScrollTop() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    const el = hash && document.getElementById(hash.slice(1));
    if (el) el.scrollIntoView();
    else window.scrollTo(0, 0);
  }, [pathname, hash]);
  return null;
}

export default function App() {
  return (
    <>
      <ScrollTop />
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/catalogue" element={<Catalogue />} />
          <Route path="/book/:id" element={<Book />} />
        </Route>
        <Route element={<PublicLayout minimal />}>
          <Route path="/login" element={<Login />} />
          <Route path="/forgot" element={<Forgot />} />
        </Route>
        <Route element={<RequireAuth gate={false} />}>
          <Route element={<PublicLayout minimal />}>
            <Route path="/change-password" element={<ChangePassword />} />
            <Route path="/consent" element={<Consent />} />
          </Route>
        </Route>
        <Route element={<RequireAuth roles={["student", "lecturer"]} />}>
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/reader/:id" element={<Reader />} />
          </Route>
        </Route>
        <Route element={<RequireAuth roles={["circulation", "cataloguer", "head_librarian", "admin"]} />}>
          <Route path="/staff" element={<StaffLayout />}>
            {staffRoutes.map(({ roles, element, ...r }) => <Route key={r.path || "index"} {...r} element={<Only roles={roles}>{element}</Only>} />)}
          </Route>
        </Route>
        <Route path="*" element={<PublicLayout />}>
          <Route path="*" element={<div className="wrap section"><h1 className="h-lg">Page not found</h1><p>Check the address or go back to the catalogue.</p></div>} />
        </Route>
      </Routes>
    </>
  );
}

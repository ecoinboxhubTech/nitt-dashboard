import { createContext, useContext, useEffect, useReducer } from "react";
import { api, getToken, setToken } from "./api.js";

const Ctx = createContext(null);

function reducer(state, a) {
  switch (a.type) {
    case "user":
      return { ...state, user: a.user, ready: true };
    case "toggleSaved":
      return { ...state, saved: state.saved.includes(a.id) ? state.saved.filter((s) => s !== a.id) : [...state.saved, a.id] };
    default:
      return state;
  }
}

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, { user: null, ready: !getToken(), saved: [] });

  // Restore the session on page load.
  useEffect(() => {
    if (!getToken()) return;
    api("/auth/me").then((user) => dispatch({ type: "user", user }), () => { setToken(null); dispatch({ type: "user", user: null }); });
  }, []);

  // A 401 anywhere clears the session.
  useEffect(() => {
    const h = () => dispatch({ type: "user", user: null });
    window.addEventListener("nitt:logout", h);
    return () => window.removeEventListener("nitt:logout", h);
  }, []);

  const acceptSession = ({ access_token, member }) => { setToken(access_token); dispatch({ type: "user", user: member }); return member; };
  const value = {
    state,
    dispatch,
    login: async (id_number, password) => acceptSession(await api("/auth/login", { method: "POST", body: { id_number, password } })),
    acceptSession,
    setUser: (user) => dispatch({ type: "user", user }),
    logout: () => { setToken(null); dispatch({ type: "user", user: null }); },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export const useStore = () => useContext(Ctx);

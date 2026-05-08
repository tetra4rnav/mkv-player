import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect, createContext, useContext } from 'react';
import Login   from './pages/Login.jsx';
import Browser from './pages/Browser.jsx';
import Player  from './pages/Player.jsx';

// ── Auth context ──────────────────────────────────────────────
const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

function RequireAuth({ children }) {
  const { authed, loading } = useAuth();
  if (loading) return <div className="full-loading"><span className="spinner" />認証確認中...</div>;
  return authed ? children : <Navigate to="/login" replace />;
}

// ── App ───────────────────────────────────────────────────────
export default function App() {
  const [authed,  setAuthed]  = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Probe a protected endpoint to check cookie validity
    fetch('/api/files?prefix=')
      .then(r => { setAuthed(r.ok); })
      .catch(() => { setAuthed(false); })
      .finally(() => setLoading(false));
  }, []);

  return (
    <AuthContext.Provider value={{ authed, setAuthed, loading }}>
      <BrowserRouter>
        <Routes>
          <Route path="/login"  element={<Login />} />
          <Route path="/"       element={<RequireAuth><Browser /></RequireAuth>} />
          <Route path="/player" element={<RequireAuth><Player /></RequireAuth>} />
          <Route path="*"       element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthContext.Provider>
  );
}

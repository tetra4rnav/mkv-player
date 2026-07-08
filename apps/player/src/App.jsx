import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Browser from './pages/Browser.jsx';
import Player  from './pages/Player.jsx';
import Library from './pages/Library.jsx';

// ── App ───────────────────────────────────────────────────────
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Browser />} />
        <Route path="/player" element={<Player />} />
        <Route path="/library" element={<Library />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

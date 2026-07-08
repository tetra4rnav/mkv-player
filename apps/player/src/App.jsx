import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Browser from './pages/Browser.jsx';
import Player from './pages/Player.jsx';
import Library from './pages/Library.jsx';
import TopShell from './components/layout/TopShell.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<TopShell />}>
          <Route path="/" element={<Browser />} />
          <Route path="/player" element={<Player />} />
          <Route path="/library" element={<Library />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

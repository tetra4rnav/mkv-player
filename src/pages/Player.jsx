import { useSearchParams, useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import VideoPlayer from '../components/VideoPlayer.jsx';
import styles from './Player.module.css';

const RESUME_KEY = (key) => 'mkv_pos_' + key;

export default function Player() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const key   = searchParams.get('key') || '';
  const title = searchParams.get('title') || decodeURIComponent(key).split('/').pop() || 'Video';

  const [subtitles,   setSubtitles]   = useState([]);
  const [activeSub,   setActiveSub]   = useState('');
  const [resumePos,   setResumePos]   = useState(0);
  const [showResume,  setShowResume]  = useState(false);
  const [playerReady, setPlayerReady] = useState(false);

  // Detect if this is an HLS stream
  const isHLS = key.endsWith('.m3u8');
  const streamUrl  = '/api/stream/' + key;
  const sourceType = isHLS ? 'application/x-mpegURL' : 'video/mp4';

  useEffect(() => {
    document.title = title + ' – MKV Player';

    // Check resume position
    const saved = parseFloat(localStorage.getItem(RESUME_KEY(key)) || '0');
    if (saved > 15) { setResumePos(saved); setShowResume(true); }

    // Find subtitle files in same directory
    if (!isHLS) findSubtitles();
  }, [key]);

  async function findSubtitles() {
    const decoded  = decodeURIComponent(key);
    const slashIdx = decoded.lastIndexOf('/');
    const dir      = slashIdx >= 0 ? decoded.substring(0, slashIdx + 1) : '';
    const stem     = decoded.split('/').pop().replace(/\.[^.]+$/, '').slice(0, 20).toLowerCase();

    const res  = await fetch('/api/files?prefix=' + encodeURIComponent(dir));
    const data = await res.json();
    const subs = data.files.filter(f =>
      f.type === 'subtitle' &&
      f.name.replace(/\.[^.]+$/, '').toLowerCase().startsWith(stem.slice(0, 8))
    );
    setSubtitles(subs);
    if (subs.length > 0) setActiveSub(subs[0].key);
  }

  function handleTimeUpdate(t) {
    if (t > 5) localStorage.setItem(RESUME_KEY(key), t.toFixed(1));
  }

  function handleEnded() { localStorage.removeItem(RESUME_KEY(key)); }

  return (
    <>
      <header className="app-header">
        <button className="btn btn-ghost" onClick={() => navigate(-1)}>← 戻る</button>
        <span className={styles.titleText}>{title}</span>
        <div style={{ width: 80 }} />
      </header>

      <div className={styles.wrap}>
        <VideoPlayer
          src={streamUrl}
          type={sourceType}
          subtitleKey={activeSub}
          seekTo={showResume ? null : undefined}
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleEnded}
          onReady={() => setPlayerReady(true)}
        />

        {/* Controls panel */}
        {(subtitles.length > 0) && (
          <div className={styles.panel}>
            {subtitles.length > 0 && (
              <div className={styles.ctrl}>
                <span className={styles.ctrlLabel}>💬 字幕</span>
                <select
                  className={styles.select}
                  value={activeSub}
                  onChange={e => setActiveSub(e.target.value)}
                >
                  <option value="">なし</option>
                  {subtitles.map(s => (
                    <option key={s.key} value={s.key}>{s.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Resume toast */}
      {showResume && playerReady && (
        <div className={styles.toast}>
          <span>⏱ {Math.floor(resumePos / 60)}:{String(Math.floor(resumePos % 60)).padStart(2,'0')} から再開しますか？</span>
          <button
            className={`btn btn-primary ${styles.toastBtn}`}
            onClick={() => { setShowResume(false); setResumePos(resumePos); }}
          >
            再開
          </button>
          <button
            className={`btn btn-ghost ${styles.toastBtn}`}
            onClick={() => setShowResume(false)}
          >
            最初から
          </button>
        </div>
      )}
    </>
  );
}

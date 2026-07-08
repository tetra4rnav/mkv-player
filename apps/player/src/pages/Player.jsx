import { useSearchParams, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import VideoPlayer from '../components/VideoPlayer.jsx';
import { Button } from '@/components/ui/button';
import styles from './Player.module.css';

const RESUME_KEY = (key) => 'mkv_pos_' + key;

export default function Player() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const key   = searchParams.get('key') || '';
  const subtitleKey = searchParams.get('subtitle') || '';
  const title = searchParams.get('title') || decodeURIComponent(key).split('/').pop() || 'Video';

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

  }, [key]);

  function handleTimeUpdate(t) {
    if (t > 5) localStorage.setItem(RESUME_KEY(key), t.toFixed(1));
  }

  function handleEnded() { localStorage.removeItem(RESUME_KEY(key)); }

  return (
    <>
      <header className="app-header">
        <Button variant="outline" size="sm" onClick={() => navigate(-1)}>← 戻る</Button>
        <span className={styles.titleText}>{title}</span>
        <div style={{ width: 80 }} />
      </header>

      <div className={styles.wrap}>
        <VideoPlayer
          src={streamUrl}
          type={sourceType}
          subtitleKey={subtitleKey}
          seekTo={showResume ? null : undefined}
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleEnded}
          onReady={() => setPlayerReady(true)}
        />

        {!subtitleKey && <div className={styles.panel}>字幕はプレーヤーメニューまたはライブラリ編集で設定できます。</div>}
      </div>

      {/* Resume toast */}
      {showResume && playerReady && (
        <div className={styles.toast}>
          <span>⏱ {Math.floor(resumePos / 60)}:{String(Math.floor(resumePos % 60)).padStart(2,'0')} から再開しますか？</span>
          <Button
            size="sm"
            onClick={() => { setShowResume(false); setResumePos(resumePos); }}
          >
            再開
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowResume(false)}
          >
            最初から
          </Button>
        </div>
      )}
    </>
  );
}

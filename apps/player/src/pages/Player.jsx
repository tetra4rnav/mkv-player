import { useSearchParams, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import VideoPlayer from '../components/VideoPlayer.jsx';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

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
  const [accessDenied, setAccessDenied] = useState(false);
  const [checkedAccess, setCheckedAccess] = useState(false);

  // Detect if this is an HLS stream
  const isHLS = key.endsWith('.m3u8');
  const streamUrl  = '/api/stream/' + key;
  const sourceType = isHLS ? 'application/x-mpegURL' : 'video/mp4';

  useEffect(() => {
    document.title = title + ' – MKV Player';

    // Check resume position
    const saved = parseFloat(localStorage.getItem(RESUME_KEY(key)) || '0');
    if (saved > 15) { setResumePos(saved); setShowResume(true); }

    // Access check (Cloudflare Access may return 401 for API endpoints)
    let cancelled = false;
    fetch('/api/library?sort=added_at&order=desc')
      .then(async (r) => {
        if (cancelled) return;
        if (r.status === 401) {
          setAccessDenied(true);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setCheckedAccess(true);
      });

    return () => { cancelled = true; };

  }, [key]);

  function handleTimeUpdate(t) {
    if (t > 5) localStorage.setItem(RESUME_KEY(key), t.toFixed(1));
  }

  function handleEnded() { localStorage.removeItem(RESUME_KEY(key)); }

  return (
    <>
      <header className="app-header">
        <Button variant="outline" size="sm" onClick={() => navigate(-1)}>← 戻る</Button>
        <span className="flex-1 truncate px-3 text-center text-sm text-muted-foreground">{title}</span>
        <div style={{ width: 80 }} />
      </header>

      {!checkedAccess ? (
        <div className="mx-auto max-w-[1160px] px-4 py-10 text-sm text-muted-foreground">読み込み中...</div>
      ) : accessDenied ? (
        <div className="mx-auto max-w-[1160px] px-4 py-10">
          <Alert variant="destructive">
            <AlertTitle>Access denied</AlertTitle>
            <AlertDescription>
              Cloudflare Access で許可されたメールアドレスでログインしてください。
            </AlertDescription>
          </Alert>
        </div>
      ) : (
        <div className="mx-auto max-w-[1160px] px-4 py-5">
          <VideoPlayer
            src={streamUrl}
            type={sourceType}
            subtitleKey={subtitleKey}
            seekTo={showResume ? null : undefined}
            onTimeUpdate={handleTimeUpdate}
            onEnded={handleEnded}
            onReady={() => setPlayerReady(true)}
          />

          {!subtitleKey && (
            <div className="mt-4 flex flex-wrap items-center gap-4 rounded-xl border bg-card p-4 text-sm text-muted-foreground">
              字幕はプレーヤーメニューまたはライブラリ編集で設定できます。
            </div>
          )}
        </div>
      )}

      {/* Resume toast */}
      {checkedAccess && !accessDenied && showResume && playerReady && (
        <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-xl border bg-card px-5 py-3 text-sm shadow-lg">
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

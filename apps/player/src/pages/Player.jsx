import { useSearchParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import VideoPlayer from '../components/VideoPlayer.jsx';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import AccessDeniedCard from '@/components/shared/AccessDeniedCard.jsx';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';

const RESUME_KEY = (key) => 'mkv_pos_' + key;

export default function Player() {
  const [searchParams] = useSearchParams();

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
    // Reset UI state when navigating to a different video.
    setAccessDenied(false);
    setCheckedAccess(false);
    setShowResume(false);
    setPlayerReady(false);
    setResumePos(0);

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

  const hasKey = Boolean(key);

  return (
    <>
      <main className="mx-auto w-full max-w-7xl px-4 py-6">
        {!checkedAccess ? (
          <div className="grid gap-4 md:grid-cols-[1fr_340px]">
            <Card>
              <CardContent className="p-0">
                <Skeleton className="aspect-video w-full rounded-xl" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="space-y-3 p-4">
                <Skeleton className="h-6 w-3/5" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-4/5" />
              </CardContent>
            </Card>
          </div>
        ) : accessDenied ? (
          <Card>
            <CardContent className="p-4">
              <AccessDeniedCard />
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-[1fr_340px] items-start">
            <Card>
              <CardContent className="p-0">
                {hasKey ? (
                  <VideoPlayer
                    src={streamUrl}
                    type={sourceType}
                    subtitleKey={subtitleKey}
                    seekTo={showResume ? null : undefined}
                    onTimeUpdate={handleTimeUpdate}
                    onEnded={handleEnded}
                    onReady={() => setPlayerReady(true)}
                  />
                ) : (
                  <div className="p-6 text-sm text-muted-foreground">
                    動画が指定されていません。ライブラリから動画を選択してください。
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-4 p-4">
                <div>
                  <div className="text-lg font-semibold truncate">{title}</div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {hasKey ? (isHLS ? 'HLS' : 'MP4') : 'No video'}
                  </div>
                </div>

                {hasKey && !subtitleKey && (
                  <Alert>
                    <AlertTitle>字幕</AlertTitle>
                    <AlertDescription>
                      字幕はプレーヤーメニューまたはライブラリ編集で設定できます。
                    </AlertDescription>
                  </Alert>
                )}

                {!hasKey && (
                  <Alert variant="destructive">
                    <AlertTitle>動画未指定</AlertTitle>
                    <AlertDescription>
                      `key` パラメータがありません。ライブラリから選択してください。
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </main>

      {/* Resume toast */}
      {checkedAccess && !accessDenied && showResume && playerReady && (
        <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-xl border bg-card px-5 py-3 text-sm shadow-lg">
          <span>⏱ {Math.floor(resumePos / 60)}:{String(Math.floor(resumePos % 60)).padStart(2, '0')} から再開しますか？</span>
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

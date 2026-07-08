import { useSearchParams, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import VideoPlayer from '../components/VideoPlayer.jsx';
import { Button } from '@/components/ui/button';
import AccessDeniedCard from '@/components/shared/AccessDeniedCard.jsx';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';

const RESUME_KEY = (key) => 'mkv_pos_' + key;

function formatClock(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function Player() {
  const [searchParams] = useSearchParams();

  const key = searchParams.get('key') || '';
  const subtitleKey = searchParams.get('subtitle') || '';
  const title =
    searchParams.get('title') ||
    decodeURIComponent(key).split('/').pop() ||
    'Video';

  const [resumePos, setResumePos] = useState(0);
  const [showResume, setShowResume] = useState(false);
  const [playerReady, setPlayerReady] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [checkedAccess, setCheckedAccess] = useState(false);
  const [seekTo, setSeekTo] = useState(null);

  const isHLS = key.endsWith('.m3u8');
  const streamUrl = '/api/stream/' + key;
  const sourceType = isHLS ? 'application/x-mpegURL' : 'video/mp4';
  const hasKey = Boolean(key);

  useEffect(() => {
    setAccessDenied(false);
    setCheckedAccess(false);
    setShowResume(false);
    setPlayerReady(false);
    setResumePos(0);
    setSeekTo(null);

    document.title = title + ' – MKV Player';

    const saved = parseFloat(localStorage.getItem(RESUME_KEY(key)) || '0');
    if (saved > 15) {
      setResumePos(saved);
      setShowResume(true);
    }

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

    return () => {
      cancelled = true;
    };
  }, [key, title]);

  function handleTimeUpdate(t) {
    if (t > 5) localStorage.setItem(RESUME_KEY(key), t.toFixed(1));
  }

  function handleEnded() {
    localStorage.removeItem(RESUME_KEY(key));
  }

  function resumePlayback() {
    setSeekTo(resumePos);
    setShowResume(false);
  }

  function startFromBeginning() {
    setSeekTo(0);
    setShowResume(false);
  }

  return (
    <>
      <main className="mx-auto w-full max-w-6xl px-4 pb-20 pt-6 md:px-6 md:pt-8">
        <div className="cinema-fade-up mb-5 flex flex-wrap items-center gap-3">
          <Button asChild variant="ghost" size="sm" className="gap-2 text-muted-foreground">
            <Link to="/">
              <ArrowLeft data-icon="inline-start" />
              ライブラリ
            </Link>
          </Button>
        </div>

        {!checkedAccess ? (
          <div className="space-y-4">
            <Skeleton className="aspect-video w-full rounded-2xl" />
            <Skeleton className="h-7 w-2/5" />
          </div>
        ) : accessDenied ? (
          <AccessDeniedCard />
        ) : (
          <div className="cinema-fade-in space-y-5">
            <div className="overflow-hidden rounded-2xl bg-black">
              {hasKey ? (
                <VideoPlayer
                  key={`${key}:${seekTo ?? 'none'}`}
                  src={streamUrl}
                  type={sourceType}
                  subtitleKey={subtitleKey}
                  seekTo={seekTo ?? undefined}
                  onTimeUpdate={handleTimeUpdate}
                  onEnded={handleEnded}
                  onReady={() => setPlayerReady(true)}
                />
              ) : (
                <div className="flex aspect-video items-center justify-center px-6 text-sm text-muted-foreground">
                  動画が指定されていません。ライブラリから動画を選択してください。
                </div>
              )}
            </div>

            <div className="space-y-2 px-0.5">
              <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
                {title}
              </h1>
              <p className="text-sm text-muted-foreground">
                {hasKey ? (isHLS ? 'HLS ストリーム' : 'MP4') : '動画未指定'}
              </p>
            </div>

            {!hasKey && (
              <Alert variant="destructive">
                <AlertTitle>動画未指定</AlertTitle>
                <AlertDescription>
                  `key` パラメータがありません。ライブラリから選択してください。
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}
      </main>

      {checkedAccess && !accessDenied && showResume && playerReady && (
        <div className="cinema-fade-up fixed bottom-6 left-1/2 z-50 flex w-[min(100%-2rem,28rem)] -translate-x-1/2 items-center gap-3 rounded-2xl border border-border/80 bg-card/95 px-4 py-3 text-sm shadow-2xl backdrop-blur-md">
          <span className="min-w-0 flex-1 text-muted-foreground">
            <span className="font-medium text-foreground">{formatClock(resumePos)}</span>
            {' '}から再開しますか？
          </span>
          <Button size="sm" onClick={resumePlayback}>
            再開
          </Button>
          <Button variant="outline" size="sm" onClick={startFromBeginning}>
            最初から
          </Button>
        </div>
      )}
    </>
  );
}

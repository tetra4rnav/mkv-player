import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import AccessDeniedCard from '@/components/shared/AccessDeniedCard.jsx';
import VideoTile from '@/components/library/VideoTile.jsx';

export default function Browser() {
  const [libraryVideos, setLibraryVideos] = useState([]);
  const [libraryLoading, setLibraryLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('added_at');
  const [order, setOrder] = useState('desc');
  const [selectedTags, setSelectedTags] = useState([]);

  const navigate = useNavigate();

  const loadLibrary = useCallback(async () => {
    setLibraryLoading(true);
    setAccessDenied(false);
    setError('');
    const params = new URLSearchParams();
    if (query.trim()) params.set('q', query.trim());
    if (sort) params.set('sort', sort);
    if (order) params.set('order', order);

    const response = await fetch('/api/library?' + params.toString());
    if (!response.ok) {
      if (response.status === 401) {
        setAccessDenied(true);
        setLibraryVideos([]);
        setLibraryLoading(false);
        return;
      }
      setLibraryVideos([]);
      setLibraryLoading(false);
      setError('ライブラリの読み込みに失敗しました');
      return;
    }
    const payload = await response.json().catch(() => ({}));
    setLibraryVideos(Array.isArray(payload.videos) ? payload.videos : []);
    setLibraryLoading(false);
  }, [query, sort, order]);

  useEffect(() => {
    loadLibrary();
  }, [loadLibrary]);

  function openPlayer(video) {
    navigate(
      '/player?key=' +
        encodeURIComponent(video.key) +
        '&title=' +
        encodeURIComponent(video.title)
    );
  }

  function toggleTag(tag) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((v) => v !== tag) : [...prev, tag]
    );
  }

  const allTags = useMemo(() => {
    const set = new Set();
    for (const video of libraryVideos) {
      for (const tag of video.tags || []) set.add(tag);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ja'));
  }, [libraryVideos]);

  const filteredLibrary = useMemo(() => {
    if (!selectedTags.length) return libraryVideos;
    return libraryVideos.filter((video) =>
      selectedTags.every((tag) => (video.tags || []).includes(tag))
    );
  }, [libraryVideos, selectedTags]);

  return (
    <main className="mx-auto w-full max-w-7xl px-4 pb-16 pt-8 md:px-6 md:pt-12">
      <section className="cinema-fade-up mb-10 max-w-3xl space-y-3">
        <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
          MKV Player
        </h1>
        <p className="text-base text-muted-foreground md:text-lg">
          コレクションから選んで、シアターで再生。
        </p>
      </section>

      {accessDenied && (
        <div className="mb-8 cinema-fade-in">
          <AccessDeniedCard />
        </div>
      )}

      {!!error && (
        <Alert variant="destructive" className="mb-8">
          <AlertTitle>エラー</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!accessDenied && (
        <>
          <div className="cinema-fade-up mb-6 flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-10 pl-9"
                placeholder="タイトル・説明を検索"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3 md:w-[320px]">
              <Select value={sort} onValueChange={setSort}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="並び順" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="added_at">追加日</SelectItem>
                  <SelectItem value="title">タイトル</SelectItem>
                  <SelectItem value="duration">再生時間</SelectItem>
                </SelectContent>
              </Select>
              <Select value={order} onValueChange={setOrder}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="昇順/降順" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="desc">降順</SelectItem>
                  <SelectItem value="asc">昇順</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {allTags.length > 0 && (
            <div className="cinema-fade-up mb-8 flex flex-wrap gap-2">
              {allTags.map((tag) => (
                <Button
                  key={tag}
                  variant={selectedTags.includes(tag) ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => toggleTag(tag)}
                >
                  {tag}
                </Button>
              ))}
              {selectedTags.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                  onClick={() => setSelectedTags([])}
                >
                  クリア
                </Button>
              )}
            </div>
          )}

          {libraryLoading && (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, idx) => (
                <div key={idx} className="space-y-3">
                  <Skeleton className="aspect-video w-full rounded-2xl" />
                  <Skeleton className="h-4 w-4/5" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              ))}
            </div>
          )}

          {!libraryLoading && (
            <div className="grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredLibrary.map((video, index) => (
                <VideoTile
                  key={video.id}
                  video={video}
                  onSelect={openPlayer}
                  style={{ animationDelay: `${Math.min(index, 12) * 40}ms` }}
                />
              ))}
            </div>
          )}

          {!libraryLoading && filteredLibrary.length === 0 && (
            <div className="cinema-fade-in rounded-2xl border border-dashed border-border/80 px-6 py-16 text-center text-sm text-muted-foreground">
              対象の動画が見つかりません
            </div>
          )}
        </>
      )}
    </main>
  );
}

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

export default function Browser() {
  const [libraryVideos, setLibraryVideos] = useState([]);
  const [libraryLoading, setLibraryLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('added_at');
  const [order, setOrder] = useState('desc');
  const [selectedTags, setSelectedTags] = useState([]);

  const navigate = useNavigate();

  const loadLibrary = useCallback(async () => {
    setLibraryLoading(true);
    const params = new URLSearchParams();
    if (query.trim()) params.set('q', query.trim());
    if (sort) params.set('sort', sort);
    if (order) params.set('order', order);

    const response = await fetch('/api/library?' + params.toString());
    if (!response.ok) {
      setLibraryVideos([]);
      setLibraryLoading(false);
      return;
    }
    const payload = await response.json();
    setLibraryVideos(Array.isArray(payload.videos) ? payload.videos : []);
    setLibraryLoading(false);
  }, [query, sort, order]);

  useEffect(() => { loadLibrary(); }, [loadLibrary]);

  function openPlayer(key, title) {
    navigate('/player?key=' + encodeURIComponent(key) + '&title=' + encodeURIComponent(title));
  }

  function toggleTag(tag) {
    setSelectedTags(prev => (
      prev.includes(tag) ? prev.filter(v => v !== tag) : [...prev, tag]
    ));
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
    return libraryVideos.filter(video => selectedTags.every(tag => (video.tags || []).includes(tag)));
  }, [libraryVideos, selectedTags]);

  function formatDuration(seconds) {
    if (!seconds) return '--';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="text-lg font-semibold">MKV Player</div>
          <Button asChild variant="outline" size="sm">
            <Link to="/library">ライブラリ管理</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-6">
        <Card>
          <CardHeader>
            <CardTitle>ライブラリ</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <Input
                placeholder="タイトル・説明を検索"
                value={query}
                onChange={e => setQuery(e.target.value)}
              />
              <Select value={sort} onValueChange={setSort}>
                <SelectTrigger>
                  <SelectValue placeholder="並び順" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="added_at">追加日</SelectItem>
                  <SelectItem value="title">タイトル</SelectItem>
                  <SelectItem value="duration">再生時間</SelectItem>
                </SelectContent>
              </Select>
              <Select value={order} onValueChange={setOrder}>
                <SelectTrigger>
                  <SelectValue placeholder="昇順/降順" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="desc">降順</SelectItem>
                  <SelectItem value="asc">昇順</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {allTags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {allTags.map(tag => (
                  <Button
                    key={tag}
                    variant={selectedTags.includes(tag) ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => toggleTag(tag)}
                  >
                    {tag}
                  </Button>
                ))}
              </div>
            )}

            {libraryLoading && (
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, idx) => (
                  <Skeleton key={idx} className="h-40 rounded-xl" />
                ))}
              </div>
            )}

            {!libraryLoading && (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredLibrary.map(video => (
                  <Card
                    key={video.id}
                    className="cursor-pointer transition-colors hover:border-primary/50"
                    onClick={() => openPlayer(video.key, video.title)}
                  >
                    <CardContent className="space-y-3 p-4">
                      <div className="aspect-video overflow-hidden rounded-md bg-muted">
                        {video.thumbnail ? (
                          <img
                            src={`/api/stream/${video.thumbnail}`}
                            alt={video.title}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-3xl">🎬</div>
                        )}
                      </div>
                      <div className="space-y-1">
                        <div className="line-clamp-1 font-semibold">{video.title}</div>
                        <div className="text-sm text-muted-foreground">
                          再生時間: {formatDuration(video.duration)}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {(video.tags || []).map(tag => <Badge key={tag} variant="secondary">{tag}</Badge>)}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {!libraryLoading && filteredLibrary.length === 0 && (
              <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                対象の動画が見つかりません
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

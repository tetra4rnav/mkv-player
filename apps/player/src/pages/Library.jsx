import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import AccessDeniedCard from '@/components/shared/AccessDeniedCard.jsx';

const emptyForm = {
  title: '',
  description: '',
  tagsText: '',
  thumbnail: '',
  duration: '',
};

function toTagInput(tags) {
  return (tags || []).join(', ');
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value + 'Z');
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('ja-JP');
}

export default function Library() {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [error, setError] = useState('');

  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    setAccessDenied(false);
    const response = await fetch('/api/library?sort=added_at&order=desc');
    if (!response.ok) {
      if (response.status === 401) {
        setAccessDenied(true);
        setVideos([]);
        setLoading(false);
        return;
      }
      const payload = await response.json().catch(() => ({}));
      setError(payload.error || 'ライブラリの読み込みに失敗しました');
      setVideos([]);
      setLoading(false);
      return;
    }
    const payload = await response.json();
    setVideos(Array.isArray(payload.videos) ? payload.videos : []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function syncFromGcs() {
    setBusy(true);
    setError('');
    setAccessDenied(false);
    const response = await fetch('/api/library/sync', { method: 'POST' });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401) {
        setAccessDenied(true);
      } else {
        setError(payload.error || 'GCS同期に失敗しました');
      }
    }
    await load();
    setBusy(false);
  }

  function openEditor(video) {
    setEditing(video);
    setForm({
      title: video.title || '',
      description: video.description || '',
      tagsText: toTagInput(video.tags),
      thumbnail: video.thumbnail || '',
      duration: video.duration == null ? '' : String(video.duration),
    });
  }

  async function saveEdit(event) {
    event.preventDefault();
    if (!editing) return;
    setSaving(true);
    setError('');

    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      tags: form.tagsText
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean),
      thumbnail: form.thumbnail.trim(),
      duration: form.duration === '' ? null : Number(form.duration),
    };

    const response = await fetch(`/api/library/${editing.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(body.error || '更新に失敗しました');
      setSaving(false);
      return;
    }

    setEditing(null);
    setForm(emptyForm);
    setSaving(false);
    await load();
  }

  async function deleteVideo(video) {
    const ok = window.confirm(`"${video.title}" を削除しますか？`);
    if (!ok) return;
    setBusy(true);
    setError('');

    const response = await fetch(`/api/library/${video.id}`, { method: 'DELETE' });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) setError(payload.error || '削除に失敗しました');
    await load();
    setBusy(false);
  }

  const rows = useMemo(
    () =>
      videos.map((video) => (
        <TableRow key={video.id} className="border-border/50">
          <TableCell className="max-w-[280px] truncate font-medium">
            {video.title}
          </TableCell>
          <TableCell>
            <div className="flex flex-wrap gap-1.5">
              {(video.tags || []).map((tag) => (
                <Badge key={tag} variant="secondary" className="font-normal">
                  {tag}
                </Badge>
              ))}
            </div>
          </TableCell>
          <TableCell className="whitespace-nowrap text-muted-foreground">
            {formatDate(video.added_at)}
          </TableCell>
          <TableCell>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => openEditor(video)}>
                編集
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => deleteVideo(video)}
                disabled={busy}
              >
                削除
              </Button>
            </div>
          </TableCell>
        </TableRow>
      )),
    [videos, busy]
  );

  return (
    <>
      <main className="mx-auto w-full max-w-7xl px-4 pb-16 pt-8 md:px-6 md:pt-12">
        <section className="cinema-fade-up mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
              ライブラリ管理
            </h1>
            <p className="text-sm text-muted-foreground md:text-base">
              メタデータの編集と GCS からの同期。
            </p>
          </div>
          <Button onClick={syncFromGcs} disabled={busy || accessDenied} className="gap-2">
            <RefreshCw
              data-icon="inline-start"
              className={busy ? 'animate-spin' : undefined}
            />
            {busy ? '同期中...' : 'GCS同期'}
          </Button>
        </section>

        {accessDenied && (
          <div className="mb-8 cinema-fade-in">
            <AccessDeniedCard />
          </div>
        )}

        {!!error && (
          <Alert variant="destructive" className="mb-6">
            <AlertTitle>エラー</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {!accessDenied &&
          (loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, idx) => (
                <Skeleton key={idx} className="h-12 w-full rounded-xl" />
              ))}
            </div>
          ) : (
            <div className="cinema-fade-in overflow-hidden rounded-2xl border border-border/60 bg-card/40">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/50 hover:bg-transparent">
                    <TableHead>タイトル</TableHead>
                    <TableHead>タグ</TableHead>
                    <TableHead>追加日</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows}
                  {!rows.length && (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="h-28 text-center text-muted-foreground"
                      >
                        動画がありません
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          ))}
      </main>

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="rounded-2xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>動画を編集</DialogTitle>
            <DialogDescription className="break-all">{editing?.key}</DialogDescription>
          </DialogHeader>
          <form onSubmit={saveEdit} className="space-y-4">
            <div className="space-y-2">
              <Label>タイトル</Label>
              <Input
                value={form.title}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, title: e.target.value }))
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label>説明</Label>
              <Textarea
                rows={3}
                value={form.description}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, description: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>タグ (カンマ区切り)</Label>
              <Input
                value={form.tagsText}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, tagsText: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>サムネキー</Label>
              <Input
                value={form.thumbnail}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, thumbnail: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>再生時間(秒)</Label>
              <Input
                type="number"
                min="0"
                value={form.duration}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, duration: e.target.value }))
                }
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                キャンセル
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? '保存中...' : '保存'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

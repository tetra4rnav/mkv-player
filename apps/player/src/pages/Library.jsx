import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

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

  useEffect(() => { load(); }, [load]);

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
      tags: form.tagsText.split(',').map(v => v.trim()).filter(Boolean),
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

  const rows = useMemo(() => videos.map(video => (
    <TableRow key={video.id}>
      <TableCell>{video.title}</TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-2">
          {(video.tags || []).map(tag => <Badge key={tag} variant="secondary">{tag}</Badge>)}
        </div>
      </TableCell>
      <TableCell>{formatDate(video.added_at)}</TableCell>
      <TableCell>
        <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={() => openEditor(video)}>編集</Button>
        <Button variant="destructive" size="sm" onClick={() => deleteVideo(video)}>削除</Button>
        </div>
      </TableCell>
    </TableRow>
  )), [videos]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="text-lg font-semibold">ライブラリ管理</div>
          <Button asChild variant="outline" size="sm">
            <Link to="/">ブラウザへ戻る</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl space-y-4 px-4 py-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">動画一覧</h1>
          <Button onClick={syncFromGcs} disabled={busy}>
            {busy ? '同期中...' : 'GCS同期'}
          </Button>
        </div>

        {accessDenied && (
          <Alert variant="destructive">
            <AlertTitle>Access denied</AlertTitle>
            <AlertDescription>
              Cloudflare Access で許可されたメールアドレスでログインしてください。
            </AlertDescription>
          </Alert>
        )}

        {!!error && (
          <Alert variant="destructive">
            <AlertTitle>エラー</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {loading ? (
          <div className="text-sm text-muted-foreground">読み込み中...</div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
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
                    <TableCell colSpan={4} className="text-center text-muted-foreground">動画がありません</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </main>

      <Dialog open={Boolean(editing)} onOpenChange={open => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>動画を編集</DialogTitle>
            <DialogDescription>{editing?.key}</DialogDescription>
          </DialogHeader>
          <form onSubmit={saveEdit} className="space-y-4">
            <div className="space-y-2">
              <Label>タイトル</Label>
              <Input
                  value={form.title}
                  onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
                  required
              />
            </div>
            <div className="space-y-2">
              <Label>説明</Label>
              <Textarea
                rows={3}
                value={form.description}
                onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>タグ (カンマ区切り)</Label>
              <Input
                  value={form.tagsText}
                  onChange={e => setForm(prev => ({ ...prev, tagsText: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>サムネキー</Label>
              <Input
                  value={form.thumbnail}
                  onChange={e => setForm(prev => ({ ...prev, thumbnail: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>再生時間(秒)</Label>
              <Input
                type="number"
                min="0"
                value={form.duration}
                onChange={e => setForm(prev => ({ ...prev, duration: e.target.value }))}
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
    </div>
  );
}

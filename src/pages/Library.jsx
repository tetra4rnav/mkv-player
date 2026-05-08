import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import styles from './Library.module.css';

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
  const [error, setError] = useState('');

  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const response = await fetch('/api/library?sort=added_at&order=desc');
    if (!response.ok) {
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

  async function syncFromR2() {
    setBusy(true);
    setError('');
    const response = await fetch('/api/library/sync', { method: 'POST' });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) setError(payload.error || 'R2同期に失敗しました');
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
    <tr key={video.id}>
      <td>{video.title}</td>
      <td>
        <div className={styles.tagsCell}>
          {(video.tags || []).map(tag => <span key={tag} className={styles.tag}>{tag}</span>)}
        </div>
      </td>
      <td>{formatDate(video.added_at)}</td>
      <td className={styles.actionsCell}>
        <button className="btn btn-ghost" onClick={() => openEditor(video)}>編集</button>
        <button className="btn btn-ghost" onClick={() => deleteVideo(video)}>削除</button>
      </td>
    </tr>
  )), [videos]);

  return (
    <>
      <header className="app-header">
        <div className="app-logo">
          <span>🎬</span>
          <span>MKV Player</span>
        </div>
        <div className={styles.headerActions}>
          <Link to="/" className="btn btn-ghost">ブラウザへ戻る</Link>
        </div>
      </header>

      <div className={styles.container}>
        <div className={styles.toolbar}>
          <h1 className={styles.title}>ライブラリ管理</h1>
          <button className="btn btn-primary" onClick={syncFromR2} disabled={busy}>
            {busy ? '同期中...' : 'R2同期'}
          </button>
        </div>

        {error && <div className={styles.error}>{error}</div>}

        {loading ? (
          <div className={styles.loading}><span className="spinner" />読み込み中...</div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>タイトル</th>
                  <th>タグ</th>
                  <th>追加日</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {rows}
                {!rows.length && (
                  <tr>
                    <td colSpan={4} className={styles.emptyCell}>動画がありません</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h2 className={styles.modalTitle}>動画を編集</h2>
            <p className={styles.modalSub}>{editing.r2_key}</p>
            <form onSubmit={saveEdit} className={styles.form}>
              <label className={styles.field}>
                <span>タイトル</span>
                <input
                  value={form.title}
                  onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
                  required
                />
              </label>
              <label className={styles.field}>
                <span>説明</span>
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
                />
              </label>
              <label className={styles.field}>
                <span>タグ (カンマ区切り)</span>
                <input
                  value={form.tagsText}
                  onChange={e => setForm(prev => ({ ...prev, tagsText: e.target.value }))}
                />
              </label>
              <label className={styles.field}>
                <span>サムネキー</span>
                <input
                  value={form.thumbnail}
                  onChange={e => setForm(prev => ({ ...prev, thumbnail: e.target.value }))}
                />
              </label>
              <label className={styles.field}>
                <span>再生時間(秒)</span>
                <input
                  type="number"
                  min="0"
                  value={form.duration}
                  onChange={e => setForm(prev => ({ ...prev, duration: e.target.value }))}
                />
              </label>
              <div className={styles.modalActions}>
                <button type="button" className="btn btn-ghost" onClick={() => setEditing(null)}>
                  キャンセル
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? '保存中...' : '保存'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

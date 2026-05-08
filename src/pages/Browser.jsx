import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App.jsx';
import styles from './Browser.module.css';

function formatSize(b) {
  if (b < 1024)        return b + ' B';
  if (b < 1048576)     return (b / 1024).toFixed(1) + ' KB';
  if (b < 1073741824)  return (b / 1048576).toFixed(1) + ' MB';
  return (b / 1073741824).toFixed(1) + ' GB';
}

export default function Browser() {
  const [prefix,  setPrefix]  = useState('');
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const { setAuthed } = useAuth();
  const navigate = useNavigate();

  const load = useCallback(async (p) => {
    setLoading(true);
    const res = await fetch('/api/files?prefix=' + encodeURIComponent(p));
    if (!res.ok) { setLoading(false); return; }
    setData(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(prefix); }, [prefix, load]);

  async function logout() {
    await fetch('/api/logout');
    setAuthed(false);
    navigate('/login', { replace: true });
  }

  function navTo(p) { setPrefix(p); setData(null); }

  function openPlayer(key, title) {
    navigate('/player?key=' + encodeURIComponent(key) + '&title=' + encodeURIComponent(title));
  }

  // Breadcrumb parts
  const crumbs = prefix ? prefix.split('/').filter(Boolean) : [];

  return (
    <>
      <header className="app-header">
        <div className="app-logo">
          <span>🎬</span>
          <span>MKV Player</span>
        </div>
        <button className="btn btn-ghost" onClick={logout}>ログアウト</button>
      </header>

      <div className={styles.container}>
        {/* Breadcrumb */}
        <div className={styles.breadcrumb}>
          <span className={styles.crumb} onClick={() => navTo('')}>🏠 Home</span>
          {crumbs.map((c, i) => {
            const path = crumbs.slice(0, i + 1).join('/') + '/';
            return (
              <span key={path}>
                <span className={styles.sep}>/</span>
                <span className={styles.crumb} onClick={() => navTo(path)}>{c}</span>
              </span>
            );
          })}
        </div>

        {/* Content */}
        {loading && (
          <div className={styles.loading}><span className="spinner" />読み込み中...</div>
        )}

        {!loading && data && (
          <>
            {/* Folders */}
            {data.folders.length > 0 && (
              <section>
                <div className={styles.sectionLabel}>📁 フォルダ</div>
                {data.folders.map(f => (
                  <div key={f.key} className={styles.item} onClick={() => navTo(f.key)}>
                    <span className={styles.itemIcon}>📁</span>
                    <div className={styles.itemInfo}>
                      <div className={styles.itemName}>{f.name}</div>
                    </div>
                  </div>
                ))}
              </section>
            )}

            {/* Videos */}
            {data.files.filter(f => f.type === 'video').length > 0 && (
              <section>
                <div className={styles.sectionLabel}>🎥 動画</div>
                {data.files.filter(f => f.type === 'video').map(f => (
                  <div key={f.key} className={styles.item}
                       onClick={() => openPlayer(f.key, f.name)}>
                    <span className={styles.itemIcon}>🎬</span>
                    <div className={styles.itemInfo}>
                      <div className={styles.itemName}>{f.name}</div>
                      <div className={styles.itemMeta}>{formatSize(f.size)}</div>
                    </div>
                    <span className={`${styles.badge} ${styles.badgeVideo}`}>
                      {f.name.endsWith('.m3u8') ? 'HLS' : f.name.split('.').pop().toUpperCase()}
                    </span>
                  </div>
                ))}
              </section>
            )}

            {/* Subtitles */}
            {data.files.filter(f => f.type === 'subtitle').length > 0 && (
              <section>
                <div className={styles.sectionLabel}>💬 字幕</div>
                {data.files.filter(f => f.type === 'subtitle').map(f => (
                  <div key={f.key} className={styles.item}>
                    <span className={styles.itemIcon}>💬</span>
                    <div className={styles.itemInfo}>
                      <div className={styles.itemName}>{f.name}</div>
                      <div className={styles.itemMeta}>{formatSize(f.size)}</div>
                    </div>
                    <span className={`${styles.badge} ${styles.badgeSub}`}>SUB</span>
                  </div>
                ))}
              </section>
            )}

            {!data.folders.length && !data.files.length && (
              <div className={styles.empty}>ファイルが見つかりません</div>
            )}
          </>
        )}
      </div>
    </>
  );
}

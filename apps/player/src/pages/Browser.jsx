import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import styles from './Browser.module.css';

function formatSize(b) {
  if (b < 1024)        return b + ' B';
  if (b < 1048576)     return (b / 1024).toFixed(1) + ' KB';
  if (b < 1073741824)  return (b / 1048576).toFixed(1) + ' MB';
  return (b / 1073741824).toFixed(1) + ' GB';
}

export default function Browser() {
  const [mode, setMode] = useState('library');
  const [prefix, setPrefix] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const [libraryVideos, setLibraryVideos] = useState([]);
  const [libraryLoading, setLibraryLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('added_at');
  const [order, setOrder] = useState('desc');
  const [selectedTags, setSelectedTags] = useState([]);

  const navigate = useNavigate();

  const load = useCallback(async (p) => {
    setLoading(true);
    const res = await fetch('/api/files?prefix=' + encodeURIComponent(p));
    if (!res.ok) { setLoading(false); return; }
    setData(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(prefix); }, [prefix, load]);

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

  function navTo(p) { setPrefix(p); setData(null); }

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

  // Breadcrumb parts
  const crumbs = prefix ? prefix.split('/').filter(Boolean) : [];

  return (
    <>
      <header className="app-header">
        <div className="app-logo">
          <span>🎬</span>
          <span>MKV Player</span>
        </div>
        <div className={styles.headerActions}>
          <Link className={`btn btn-ghost ${styles.headerLink}`} to="/library">ライブラリ管理</Link>
        </div>
      </header>

      <div className={styles.container}>
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${mode === 'library' ? styles.tabActive : ''}`}
            onClick={() => setMode('library')}
          >
            D1 ライブラリ
          </button>
          <button
            className={`${styles.tab} ${mode === 'r2' ? styles.tabActive : ''}`}
            onClick={() => setMode('r2')}
          >
            R2 ブラウザ
          </button>
        </div>

        {mode === 'library' && (
          <>
            <div className={styles.libraryControls}>
              <input
                className={styles.searchInput}
                placeholder="タイトル・説明を検索"
                value={query}
                onChange={e => setQuery(e.target.value)}
              />
              <select className={styles.select} value={sort} onChange={e => setSort(e.target.value)}>
                <option value="added_at">追加日</option>
                <option value="title">タイトル</option>
                <option value="duration">再生時間</option>
              </select>
              <select className={styles.select} value={order} onChange={e => setOrder(e.target.value)}>
                <option value="desc">降順</option>
                <option value="asc">昇順</option>
              </select>
            </div>

            {allTags.length > 0 && (
              <div className={styles.tagRow}>
                {allTags.map(tag => (
                  <button
                    key={tag}
                    className={`${styles.tag} ${selectedTags.includes(tag) ? styles.tagActive : ''}`}
                    onClick={() => toggleTag(tag)}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            )}

            {libraryLoading && (
              <div className={styles.loading}><span className="spinner" />読み込み中...</div>
            )}

            {!libraryLoading && (
              <div className={styles.cardGrid}>
                {filteredLibrary.map(video => (
                  <button
                    key={video.id}
                    className={styles.videoCard}
                    onClick={() => openPlayer(video.r2_key, video.title)}
                  >
                    <div className={styles.thumbWrap}>
                      {video.thumbnail
                        ? <img src={`/api/stream/${video.thumbnail}`} alt={video.title} className={styles.thumbImg} />
                        : <div className={styles.thumbPlaceholder}>🎬</div>}
                    </div>
                    <div className={styles.cardBody}>
                      <div className={styles.cardTitle}>{video.title}</div>
                      <div className={styles.cardMeta}>再生時間: {formatDuration(video.duration)}</div>
                      <div className={styles.cardTags}>
                        {(video.tags || []).map(tag => (
                          <span key={tag} className={styles.cardTag}>{tag}</span>
                        ))}
                      </div>
                    </div>
                  </button>
                ))}
                {!filteredLibrary.length && (
                  <div className={styles.empty}>対象の動画が見つかりません</div>
                )}
              </div>
            )}
          </>
        )}

        {mode === 'r2' && (
          <>
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

            {loading && (
              <div className={styles.loading}><span className="spinner" />読み込み中...</div>
            )}

            {!loading && data && (
              <>
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

                {data.files.filter(f => f.type === 'video').length > 0 && (
                  <section>
                    <div className={styles.sectionLabel}>🎥 動画</div>
                    {data.files.filter(f => f.type === 'video').map(f => (
                      <div
                        key={f.key}
                        className={styles.item}
                        onClick={() => openPlayer(f.key, f.name)}
                      >
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
          </>
        )}
      </div>
    </>
  );
}

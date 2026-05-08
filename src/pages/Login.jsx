import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App.jsx';
import styles from './Login.module.css';

export default function Login() {
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const { setAuthed } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const res = await fetch('/api/login', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ password }),
    });

    if (res.ok) {
      setAuthed(true);
      navigate('/', { replace: true });
    } else {
      setError('パスワードが正しくありません');
      setLoading(false);
    }
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <div className={styles.icon}>🎬</div>
        <h1 className={styles.title}>MKV Player</h1>
        <p className={styles.sub}>プライベート動画ライブラリ</p>

        {error && <div className={styles.error}>⚠️ {error}</div>}

        <form onSubmit={handleSubmit}>
          <label className={styles.label}>パスワード</label>
          <input
            className={styles.input}
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            autoFocus
            autoComplete="current-password"
          />
          <button className={`btn btn-primary ${styles.submitBtn}`} disabled={loading}>
            {loading ? <><span className="spinner" />確認中...</> : 'ログイン →'}
          </button>
        </form>
      </div>
    </div>
  );
}

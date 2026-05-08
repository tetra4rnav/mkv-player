# 🎬 MKV Player — Cloudflare Worker + R2

プライベートな動画ライブラリをCloudflare Worker + R2だけで完結させるWebアプリ。

## 機能

- 🔐 パスワード認証 (JWT cookie、HttpOnly + Secure)
- 📁 フォルダ階層ブラウザ
- 🎬 MKV / MP4 / WebM ストリーミング (Range request 対応)
- ⏱ シーク・レジューム再生 (localStorage)
- 💬 字幕対応 (.srt / .ass / .ssa → WebVTT 自動変換)
- ⌨️ キーボードショートカット (Space / ← → / F / M)
- 📱 モバイル対応
- 🌐 Cloudflare Workerのみ (Pages不要)

---

## セットアップ手順

### 1. 前提

```bash
npm install -g wrangler
wrangler login
```

### 2. R2バケットを作成

```bash
# バケット作成
wrangler r2 bucket create my-mkv-files

# wrangler.toml の bucket_name を合わせる
```

### 3. Secretsを設定

```bash
# ログインパスワード (任意の文字列)
wrangler secret put AUTH_PASSWORD

# JWT署名用ランダム文字列 (openssl推奨)
wrangler secret put JWT_SECRET
# → openssl rand -hex 32  の出力をそのままペースト
```

### 4. デプロイ

```bash
wrangler deploy
```

デプロイ後、`https://mkv-player.<your-subdomain>.workers.dev` でアクセス可能。

---

## 動画ファイルのアップロード

### CLIでアップロード (wrangler)

```bash
# 単体ファイル
wrangler r2 object put my-mkv-files/movie.mkv --file ./movie.mkv

# ディレクトリごと (rcloneが便利)
rclone copy ./movies r2:my-mkv-files --progress
```

### rclone設定例

```ini
[r2]
type = s3
provider = Cloudflare
access_key_id = <R2_ACCESS_KEY>
secret_access_key = <R2_SECRET_KEY>
endpoint = https://<ACCOUNT_ID>.r2.cloudflarestorage.com
```

### 字幕の配置

動画ファイルと同じディレクトリに、同じファイル名（拡張子違い）で置くと自動検出されます。

```
movies/
  episode01.mkv
  episode01.srt     ← 自動マッチ
  episode01.ass     ← 複数も可
```

---

## キーボードショートカット

| キー      | 動作             |
|-----------|-----------------|
| `Space`   | 再生/一時停止    |
| `←` `→`  | ±10秒シーク     |
| `F`       | フルスクリーン   |
| `M`       | ミュート切替     |

---

## ローカル開発

```bash
wrangler dev --remote
# --remote でR2への実際のアクセスが可能
```

---

## ブラウザ互換性

| ブラウザ  | MKV再生  | 備考                          |
|-----------|---------|-------------------------------|
| Chrome    | ✅      | H.264/H.265/VP9対応           |
| Edge      | ✅      | Chromeと同等                   |
| Firefox   | ⚠️      | H.264は要コーデック or MP4推奨  |
| Safari    | ⚠️      | MKVは非対応 → MP4推奨          |
| iOS       | ⚠️      | MP4 + H.264が最も安定          |

> MKVの中身がH.264+AACならChrome/Edgeでほぼ問題なく再生できます。
> 互換性を最大化したい場合は `ffmpeg -i input.mkv -c:v copy -c:a aac output.mp4`。

---

## セキュリティ

- パスワードはWorker Secret (暗号化保存、コードに含まれない)
- JWT: HMAC-SHA256署名、7日有効、HttpOnly + Secure Cookie
- R2バケットはPublicアクセス無効のまま運用 (Worker経由のみ)
- 全エンドポイントに認証チェック

---

## 費用目安 (Cloudflare無料枠)

| 項目        | 無料枠            |
|-------------|-----------------|
| Workers     | 10万req/日       |
| R2ストレージ | 10GB/月         |
| R2 Egress   | **無料** (Workers経由) |

個人利用であれば実質無料で運用可能。

# MKV Player MVP

Cloudflare Pages + GCS + shadcn/ui で構成した、プライベート動画ライブラリです。

## 構成

- `apps/player`: React + Video.js + Pages Functions
- `apps/transcoder`: ローカル `mkv -> hls` 変換 CLI
- `apps/gcsuploader`: GCS へ HLS アップロード + `_library/index.json` 更新 CLI

## 技術スタック

| レイヤー | 技術 |
|---|---|
| UI | React 18, shadcn/ui, Tailwind |
| Player | Video.js (HLS/VHS) |
| API | Cloudflare Pages Functions |
| Storage | Google Cloud Storage (`mkv-player`) |
| 認証 | Cloudflare Access（Email Allowlist） |

## GCS 設計

```text
gs://mkv-player/
├── _library/index.json
└── media/{uuid}/
    ├── master.m3u8
    ├── 1080p/playlist.m3u8
    ├── 720p/playlist.m3u8
    ├── 480p/playlist.m3u8
    └── audio/a1/playlist.m3u8 ...
```

- メタデータは `_library/index.json` が唯一の正
- 動画実体は `media/{uuid}` に不変キーで保存

## 前提環境

- GCP Project ID: `uplifted-block-254615`
- GCS bucket: `mkv-player`（作成済み）
- Service Account（`storage.objects.get/list/create/update`）
- Cloudflare Pages プロジェクト
- Cloudflare Zero Trust（Access 有効化）

## 環境変数（Pages）

`GCS_BUCKET` と `GCS_SERVICE_ACCOUNT_JSON` を Cloudflare Pages の環境変数に設定してください。詳細は下記「Cloudflare Pages」を参照。

## セットアップ

```bash
npm install
```

### Cloudflare Pages

- Root directory: `apps/player`
- Build command: `npm run build`
- Output directory: `dist`

#### Bindings

GCS 移行済みのため **R2 / D1 バインディングは不要** です。ダッシュボードに残っている場合は削除してください。

- 削除: R2 `MEDIA_BUCKET` → `mkv-player-files`
- 削除: D1 `DB` → `mkv-player-library`（メタデータは GCS の `_library/index.json` を使用）

[`apps/player/wrangler.toml`](apps/player/wrangler.toml) にバインディングを定義していないため、デプロイ後はリポジトリ設定が正となります。

#### 環境変数（Pages）

- `GCS_BUCKET=mkv-player`
- `GCS_SERVICE_ACCOUNT_JSON=<service account json string>`

### Cloudflare Access（メール認証）

1. Zero Trust で Access Application を作成
2. 対象: `*.pages.dev`（必要ならカスタムドメインも追加）
3. Policy: `Allow` + `Emails`
4. 許可メールアドレスを登録

> API は `cf-access-authenticated-user-email` ヘッダがない場合 `401` を返します。

## ローカル開発

```bash
npm run dev:player
```

Cloudflare Pages 側 API を使う場合:

```powershell
$env:VITE_API_PROXY_TARGET="https://<your-pages-domain>.pages.dev"; npm run dev:player
```

## 変換とアップロード

### 1) MKV -> HLS 変換

```powershell
npm run dev --workspace @mkv/transcoder -- `
  --input .\movie.mkv `
  --output .\output\movie `
  --resolutions 1080,720,480 `
  --segment-seconds 6
```

### 2) GCS へアップロード + index 登録

```powershell
npm run upload:gcs -- `
  --source .\output\movie `
  --title "Movie Title" `
  --type movie `
  --bucket mkv-player `
  --key-file C:\path\service-account.json
```

シリーズ話数例:

```powershell
npm run upload:gcs -- `
  --source .\output\bb-s01e03 `
  --title "Breaking Bad S01E03" `
  --type episode `
  --series-id breaking-bad `
  --series-title "Breaking Bad" `
  --season 1 `
  --episode 3 `
  --bucket mkv-player `
  --key-file C:\path\service-account.json
```

## 注意点

- 既存の `login/logout` API は MVP では未使用（Access が認証を担当）
- HLS 化で MKV の一部機能（PGS 字幕、ロスレス音声など）は失われる

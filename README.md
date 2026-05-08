# 🎬 MKV Player v2 — React + Video.js + HLS

クロスプラットフォーム対応のプライベート動画ライブラリ。
**Chrome / Firefox / Safari / iPad / Android** すべてで再生可能。

## リポジトリ構成 (Monorepo風)

- `apps/player`: 再生アプリ本体（React + Pages Functions + D1/R2連携）
- `apps/transcoder`: `mkv -> hls` ローカル変換基盤（スケルトン）
- `apps/r2uploader`: R2アップロード専用CLI

## 技術スタック

| レイヤー | 技術 |
|----------|------|
| フロントエンド | React 18 + React Router v6 |
| 動画プレーヤー | Video.js 8 (VHS/HLS内蔵) |
| バックエンド | Cloudflare Pages Functions |
| ストレージ | Cloudflare R2 |
| ビルド | Vite |

## 機能

- 📁 フォルダ階層ブラウザ
- 🎬 HLS ストリーミング再生 (クロスプラットフォーム)
- 🎵 **音声トラック切替** (日本語/英語など)
- 💬 字幕対応 (.srt / .ass / .ssa → WebVTT 自動変換)
- ⏱ シーク・レジューム再生
- ⌨️ キーボードショートカット
- 📱 モバイル・iPad 対応

---

## データ管理方針

- **R2**: 動画の実体ファイル（HLS: `master.m3u8` / `.ts` セグメント / 字幕ファイル）を保存
- **D1**: タイトル、説明、タグ、サムネキー、再生時間などのメタデータを保存
- **非方針**: R2 オブジェクトメタデータにアプリ用 metadata は保存しない
- **登録フロー（方針）**: `apps/r2uploader` 実行時に D1 metadata を同時登録する
- **暫定運用（現状）**: R2 上の `master.m3u8` を基準に `/api/library/sync` で D1 へ取り込み

---

## セットアップ

### 1. インストール

```bash
npm install
```

### 2. Cloudflare 側の準備（ダッシュボード）

- R2 バケット作成（任意の名前）
- D1 データベース作成（任意の名前）
- D1 コンソールで `apps/player/migrations/0001_init.sql` を実行
- Pages プロジェクトを Git 連携で作成し、Functions バインディングを設定（ダッシュボードで設定）
  - R2: 変数名 `MEDIA_BUCKET`
  - D1: 変数名 `DB`
- `wrangler.toml` は使用しません（設定はすべて Cloudflare ダッシュボードで管理）

### 3. ビルド & デプロイ

- `main` へ push すると Pages が自動ビルド/デプロイ
- `wrangler` は不要
- Pages の Build 設定は以下を使用:
  - Root directory: `apps/player`
  - Build command: `npm run build:player`
  - Build output directory: `dist`

### 4. GitHub Actions Secrets

リポジトリ `Settings -> Secrets and variables -> Actions` で以下を追加:

- `CLOUDFLARE_API_TOKEN`  
  Cloudflare の API トークン（Pages を編集できる権限）
- `CLOUDFLARE_ACCOUNT_ID`  
  Cloudflare ダッシュボード右サイドバーのアカウント ID

### 5. Cloudflare 認証情報の整理

このリポジトリでは `wrangler` を使わず、用途別に認証情報を分けます。

- **Cloudflare ダッシュボード操作**  
  通常の Cloudflare ログイン（メール/SSO）で設定作業を実施
- **Pages デプロイ（GitHub Actions）**  
  `CLOUDFLARE_API_TOKEN` と `CLOUDFLARE_ACCOUNT_ID` を GitHub Secrets に設定  
  API トークンは Pages の編集権限を含むものを使用
- **R2 アップロード（ローカル実行）**  
  R2 API トークン管理画面で Access Key / Secret Key を発行し、  
  `npm run upload:r2` 実行時に CLI 引数として渡す（`.env` ファイルは使用しない）

### 6. Cloudflare Access 認証（実装予定 / Issue管理）

現時点では未実装です。Cloudflare Access によるアプリ保護は Issue で管理し、後続で実装します。

- Issue タイトル案: `feat: protect player app with Cloudflare Access`
- 予定スコープ:
  - Cloudflare Access で `apps/player` へのアクセス制御を有効化
  - 許可ユーザー/グループのポリシー定義
  - ローカル開発・運用手順（Access有効時）のREADME反映

---

## 動画の変換とアップロード

### 変換ポリシー

- このリポジトリは **再生アプリ + メタデータ管理** を主目的とします。
- `mkv -> HLS` の変換処理は `apps/transcoder`（ローカル変換基盤）に実装していく想定です。
- 現時点では「**生成済み HLS を R2 に配置する**」手順のみを扱います。

### 連携前提（transcoderアプリ）

- 変換基盤はローカル環境で `mkv -> HLS` を実行
- 出力は `movie-title/master.m3u8` を含む HLS ディレクトリ
- `apps/r2uploader` 側はその出力ディレクトリを R2 にアップロードし、D1 metadata を同時登録する（設計方針）
- R2 には HLS 実体のみを保存し、metadata は D1 のみで管理する

### r2uploader の連携管理方針（動的・リアルタイム）

- `apps/r2uploader` は R2/D1 連携のオーケストレーション責務を持つ
- アップロード完了時に D1 を即時 upsert して、`/api/library/sync` 依存を段階的に下げる
- 差分検出（reconcile）で R2 と D1 の不整合を修復できる状態を目指す
- 変更イベントの通知（例: SSE/WebSocket/Queue）で player 側へ反映を高速化する

### R2にアップロード

アップロード:

```powershell
# output/movie の中身を r2://<your-r2-bucket-name>/movie/ へアップロード
npm run upload:r2 -- --source output/movie --prefix movie --account-id <cloudflare-account-id> --bucket <your-r2-bucket-name> --access-key-id <r2-access-key-id> --secret-access-key <r2-secret-access-key>
```

### R2のディレクトリ構造例

```
<your-r2-bucket-name>/
└── movie-title/
    ├── master.m3u8          ← ブラウザで開くファイル
    ├── stream_0/            ← 映像 + 音声トラック1
    │   ├── playlist.m3u8
    │   └── seg000.ts ...
    └── stream_1/            ← 音声トラック2 (英語など)
        ├── playlist.m3u8
        └── seg000.ts ...
```

---

## ローカル開発

```bash
# player アプリを起動（APIは相対パス）
npm run dev:player

# ローカルからデプロイ済みPages APIへ透過プロキシしたい場合
# (CORS回避、wrangler不要)
# PowerShell で実行:
$env:VITE_API_PROXY_TARGET="https://your-pages-url.pages.dev"; npm run dev:player
```

---

## キーボードショートカット

| キー      | 動作           |
|-----------|---------------|
| `Space`   | 再生/一時停止   |
| `←` `→`  | ±10秒シーク   |
| `F`       | フルスクリーン  |
| `M`       | ミュート切替    |

---

## ブラウザ互換性

| ブラウザ         | HLS再生 |
|-----------------|--------|
| Chrome / Edge   | ✅     |
| Firefox         | ✅     |
| Safari (Mac)    | ✅     |
| Safari (iOS)    | ✅     |
| Chrome (iPad)   | ✅     |
| Android Chrome  | ✅     |

Video.js の VHS (Video.js HTTP Streaming) がすべてのブラウザでHLSを処理します。
Safariはネイティブ HLS を使用。

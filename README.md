# 🎬 MKV Player v2 — React + Video.js + HLS

クロスプラットフォーム対応のプライベート動画ライブラリ。
**Chrome / Firefox / Safari / iPad / Android** すべてで再生可能。

## 技術スタック

| レイヤー | 技術 |
|----------|------|
| フロントエンド | React 18 + React Router v6 |
| 動画プレーヤー | Video.js 8 (VHS/HLS内蔵) |
| バックエンド | Cloudflare Pages Functions |
| ストレージ | Cloudflare R2 |
| ビルド | Vite |

## 機能

- 🔐 パスワード認証 (JWT cookie)
- 📁 フォルダ階層ブラウザ
- 🎬 HLS ストリーミング再生 (クロスプラットフォーム)
- 🎵 **音声トラック切替** (日本語/英語など)
- 💬 字幕対応 (.srt / .ass / .ssa → WebVTT 自動変換)
- ⏱ シーク・レジューム再生
- ⌨️ キーボードショートカット
- 📱 モバイル・iPad 対応

---

## セットアップ

### 1. インストール

```bash
npm install
```

### 2. R2バケット作成

```bash
wrangler r2 bucket create my-mkv-files
# wrangler.toml の bucket_name を合わせる
```

### 3. Secrets設定

```bash
wrangler pages secret put AUTH_PASSWORD   # ログインパスワード
wrangler pages secret put JWT_SECRET      # openssl rand -hex 32
```

### 4. ビルド & デプロイ

```bash
npm run deploy
# = npm run build && wrangler pages deploy dist
```

---

## 動画の変換とアップロード

### MKV → HLS変換 (ローカルで実行)

```bash
chmod +x scripts/convert.sh
./scripts/convert.sh movie.mkv output/
```

音声トラックを自動検出してHLSに変換します。

### R2にアップロード

```bash
# 変換後のディレクトリをまるごとアップロード
wrangler r2 object put my-mkv-files --recursive --local-path output/movie/

# または rclone を使う場合
rclone copy output/ r2:my-mkv-files --progress
```

### R2のディレクトリ構造例

```
my-mkv-files/
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
wrangler pages dev --remote
# --remote でR2への実際のアクセスが可能
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

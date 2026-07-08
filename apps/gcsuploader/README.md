# @mkv/gcsuploader

GCS アップロード + ライブラリ index 更新用 CLI です。

## 設計方針

- GCS には HLS 実体ファイルのみを保存する
- アプリ用 metadata（タイトル、タグ、説明、再生時間など）は `_library/index.json` に保存する
- オブジェクトメタデータはアプリの正データとして利用しない

## 現状

- HLS ファイルを `gs://mkv-player/media/{uuid}/` へアップロード
- `_library/index.json` へ動画エントリを同時追加

## 使い方

```powershell
npm run upload:gcs --workspace @mkv/gcsuploader -- `
  --source output/inception `
  --title "Inception" `
  --type movie `
  --bucket mkv-player `
  --key-file C:\path\to\service-account.json
```

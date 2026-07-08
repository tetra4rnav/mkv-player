# @mkv/transcoder

`mkv -> hls` のローカル変換 CLI です。

## 使い方

```powershell
npm run dev --workspace @mkv/transcoder -- `
  --input .\movie.mkv `
  --output .\output\movie `
  --resolutions 1080,720,480 `
  --segment-seconds 6
```

## 出力

- `master.m3u8`
- `1080p/playlist.m3u8`, `720p/playlist.m3u8`, `480p/playlist.m3u8`
- `audio/a1/playlist.m3u8` など（入力音声トラック数に応じる）

生成後は `@mkv/gcsuploader` で GCS へアップロードする。

# @mkv/transcoder

`mkv -> hls` のローカル変換基盤を配置するためのスケルトンです。

このディレクトリはまだ実装前で、将来以下を提供する想定です。

- ローカル動画入力 (`.mkv`) を受け取る CLI
- HLS 出力 (`master.m3u8`, `stream_*`, `seg*.ts`)
- 変換完了後の出力を `@mkv/r2uploader` 側の R2 アップロードに連携

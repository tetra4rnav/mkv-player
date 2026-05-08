#!/usr/bin/env bash
# ============================================================
# convert.sh — MKV → HLS 変換スクリプト
# 音声トラック複数対応 (日本語/英語など)
#
# 使い方:
#   ./scripts/convert.sh input.mkv output/
#   ./scripts/convert.sh input.mkv            # output/ に出力
#
# 依存: ffmpeg, ffprobe
# ============================================================

set -euo pipefail

INPUT="${1:?Usage: $0 input.mkv [output_dir]}"
OUTPUT_BASE="${2:-output}"
BASENAME=$(basename "$INPUT" .mkv)
OUT_DIR="$OUTPUT_BASE/$BASENAME"

if ! command -v ffmpeg &>/dev/null; then
  echo "Error: ffmpeg が見つかりません。インストールしてください。"
  exit 1
fi

mkdir -p "$OUT_DIR"

# ── 音声トラック情報を取得 ─────────────────────────────────
echo "🔍 メディア情報を解析中: $INPUT"

AUDIO_INFO=$(ffprobe -v quiet -print_format json -show_streams \
  -select_streams a "$INPUT" 2>/dev/null)

AUDIO_COUNT=$(echo "$AUDIO_INFO" | python3 -c "
import json,sys
data=json.load(sys.stdin)
print(len(data.get('streams',[])))
")

echo "🎵 音声トラック数: $AUDIO_COUNT"

# 音声ラベルとlanguageを取得
AUDIO_LABELS=()
for i in $(seq 0 $((AUDIO_COUNT - 1))); do
  LANG=$(echo "$AUDIO_INFO" | python3 -c "
import json,sys
data=json.load(sys.stdin)
s=data['streams'][$i]
print(s.get('tags',{}).get('language','und'))
" 2>/dev/null || echo "und")
  TITLE=$(echo "$AUDIO_INFO" | python3 -c "
import json,sys
data=json.load(sys.stdin)
s=data['streams'][$i]
print(s.get('tags',{}).get('title','Audio $i'))
" 2>/dev/null || echo "Audio $i")
  AUDIO_LABELS+=("$LANG:$TITLE")
  echo "  Track $i: [$LANG] $TITLE"
done

# ── ffmpeg コマンド構築 ────────────────────────────────────
echo ""
echo "🎬 HLS変換開始..."

# Map引数
MAPS="-map 0:v:0"
for i in $(seq 0 $((AUDIO_COUNT - 1))); do
  MAPS="$MAPS -map 0:a:$i"
done

# var_stream_map 構築
# ストリーム0 = 映像+音声0 (デフォルト)
STREAM_MAP="v:0,a:0,agroup:audio"

# ストリーム1以降 = 追加音声トラック
for i in $(seq 1 $((AUDIO_COUNT - 1))); do
  LANG=$(echo "${AUDIO_LABELS[$i]}" | cut -d: -f1)
  STREAM_MAP="$STREAM_MAP a:$i,agroup:audio,language:$LANG"
done

# ffmpeg 実行
ffmpeg -i "$INPUT" \
  $MAPS \
  -c:v libx264 -preset fast -crf 22 -profile:v high \
  -c:a aac -b:a 192k -ar 48000 \
  -var_stream_map "$STREAM_MAP" \
  -hls_time 6 \
  -hls_list_size 0 \
  -hls_segment_filename "$OUT_DIR/stream_%v/seg%03d.ts" \
  -hls_flags independent_segments \
  -master_pl_name master.m3u8 \
  "$OUT_DIR/stream_%v/playlist.m3u8"

echo ""
echo "✅ 変換完了: $OUT_DIR/"
echo ""
echo "出力ファイル:"
find "$OUT_DIR" -type f | sort | sed 's/^/  /'
echo ""
echo "📤 R2にアップロード (Node.js uploader):"
echo "  npm run upload:r2 -- --source $OUT_DIR --prefix $BASENAME"
echo ""
echo "📺 プレーヤーで開くURL:"
echo "  /player?key=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$BASENAME/master.m3u8'))")&title=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$BASENAME'))")"

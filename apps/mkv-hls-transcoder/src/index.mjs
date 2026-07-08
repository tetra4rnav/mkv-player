import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { spawn } from 'node:child_process';

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--input') out.input = argv[i + 1];
    if (arg === '--output') out.output = argv[i + 1];
    if (arg === '--resolutions') out.resolutions = argv[i + 1];
    if (arg === '--segment-seconds') out.segmentSeconds = argv[i + 1];
  }
  return out;
}

function parseResolutionList(raw) {
  const fallback = [1080];
  if (!raw) return fallback;
  const list = raw
    .split(',')
    .map(v => Number(v.trim()))
    .filter(v => Number.isFinite(v) && v > 0);
  return list.length > 0 ? Array.from(new Set(list)) : fallback;
}

function ffmpegPath() {
  return process.env.FFMPEG_PATH || 'ffmpeg';
}

function ffprobePath() {
  return process.env.FFPROBE_PATH || 'ffprobe';
}

function runCommand(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: 'inherit' });
    child.on('error', reject);
    child.on('close', code => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} exited with code ${code}`));
    });
  });
}

async function detectAudioStreamCount(inputFile) {
  const args = [
    '-v', 'error',
    '-select_streams', 'a',
    '-show_entries', 'stream=index',
    '-of', 'csv=p=0',
    inputFile,
  ];
  const chunks = [];
  await new Promise((resolve, reject) => {
    const child = spawn(ffprobePath(), args, { stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.on('data', data => chunks.push(data));
    child.on('error', reject);
    child.on('close', code => (code === 0 ? resolve() : reject(new Error('ffprobe failed'))));
  });
  const lines = Buffer.concat(chunks).toString('utf-8').trim().split('\n').filter(Boolean);
  return Math.max(1, lines.length);
}

function buildMasterPlaylist(resolutions, audioCount) {
  const lines = ['#EXTM3U', '#EXT-X-VERSION:3'];
  for (let i = 0; i < audioCount; i += 1) {
    const lang = i === 0 ? 'ja' : `a${i + 1}`;
    lines.push(
      `#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio",NAME="Track ${i + 1}",LANGUAGE="${lang}",DEFAULT=${i === 0 ? 'YES' : 'NO'},AUTOSELECT=${i === 0 ? 'YES' : 'NO'},URI="audio/a${i + 1}/playlist.m3u8"`
    );
  }
  for (const resolution of resolutions) {
    const width = Math.round((resolution * 16) / 9);
    const bandwidth = Math.max(700000, resolution * 2500);
    lines.push(
      `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},RESOLUTION=${width}x${resolution},CODECS="avc1.64001F,mp4a.40.2",AUDIO="audio"`
    );
    lines.push(`${resolution}p/playlist.m3u8`);
  }
  return lines.join('\n') + '\n';
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const input = args.input;
  if (!input) {
    throw new Error('Usage: npm run dev --workspace @mkv/transcoder -- --input <file.mkv> [--output output/movie] [--resolutions 1080,720,480] [--segment-seconds 6]');
  }
  const outputDir = path.resolve(args.output || path.join('output', path.parse(input).name));
  const resolutions = parseResolutionList(args.resolutions);
  const segmentSeconds = Number(args.segmentSeconds || 6);
  const audioCount = await detectAudioStreamCount(input);

  await mkdir(outputDir, { recursive: true });

  for (const resolution of resolutions) {
    const videoDir = path.join(outputDir, `${resolution}p`);
    await mkdir(videoDir, { recursive: true });
    const ffArgs = [
      '-y',
      '-i', input,
      '-map', '0:v:0',
      '-vf', `scale=-2:${resolution}`,
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-crf', '22',
      '-g', String(segmentSeconds * 2),
      '-sc_threshold', '0',
      '-f', 'hls',
      '-hls_time', String(segmentSeconds),
      '-hls_playlist_type', 'vod',
      '-hls_segment_filename', path.join(videoDir, 'seg%05d.ts'),
      path.join(videoDir, 'playlist.m3u8'),
    ];
    await runCommand(ffmpegPath(), ffArgs);
  }

  for (let i = 0; i < audioCount; i += 1) {
    const audioDir = path.join(outputDir, 'audio', `a${i + 1}`);
    await mkdir(audioDir, { recursive: true });
    const ffArgs = [
      '-y',
      '-i', input,
      '-map', `0:a:${i}`,
      '-c:a', 'aac',
      '-b:a', '160k',
      '-f', 'hls',
      '-hls_time', String(segmentSeconds),
      '-hls_playlist_type', 'vod',
      '-hls_segment_filename', path.join(audioDir, 'seg%05d.ts'),
      path.join(audioDir, 'playlist.m3u8'),
    ];
    await runCommand(ffmpegPath(), ffArgs);
  }

  const master = buildMasterPlaylist(resolutions, audioCount);
  await writeFile(path.join(outputDir, 'master.m3u8'), master, 'utf-8');
  console.log(`HLS output generated at: ${outputDir}`);
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});

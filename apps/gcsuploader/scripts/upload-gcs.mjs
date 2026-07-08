import { readdir, readFile } from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';
import process from 'node:process';
import { Storage } from '@google-cloud/storage';

const INDEX_KEY = '_library/index.json';

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--source') out.source = argv[i + 1];
    if (a === '--bucket') out.bucket = argv[i + 1];
    if (a === '--key-file') out.keyFile = argv[i + 1];
    if (a === '--title') out.title = argv[i + 1];
    if (a === '--type') out.type = argv[i + 1];
    if (a === '--series-id') out.seriesId = argv[i + 1];
    if (a === '--series-title') out.seriesTitle = argv[i + 1];
    if (a === '--season') out.season = argv[i + 1];
    if (a === '--episode') out.episode = argv[i + 1];
    if (a === '--tags') out.tags = argv[i + 1];
    if (a === '--description') out.description = argv[i + 1];
    if (a === '--thumbnail') out.thumbnail = argv[i + 1];
    if (a === '--duration') out.duration = argv[i + 1];
  }
  return out;
}

function toPosix(p) {
  return p.split(path.sep).join('/');
}

function readArgOrEnv(argValue, envName, fallback = '') {
  return argValue || process.env[envName] || fallback;
}

function contentTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.m3u8') return 'application/vnd.apple.mpegurl';
  if (ext === '.ts') return 'video/mp2t';
  if (ext === '.mp4') return 'video/mp4';
  if (ext === '.vtt') return 'text/vtt; charset=utf-8';
  if (ext === '.srt') return 'application/x-subrip; charset=utf-8';
  if (ext === '.ass' || ext === '.ssa') return 'text/plain; charset=utf-8';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  return 'application/octet-stream';
}

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walk(abs));
      continue;
    }
    if (entry.isFile()) files.push(abs);
  }
  return files;
}

function normalizeTags(tagsRaw) {
  if (!tagsRaw) return [];
  return tagsRaw.split(',').map(v => v.trim()).filter(Boolean);
}

function normalizeInt(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : null;
}

async function loadIndex(bucket) {
  const file = bucket.file(INDEX_KEY);
  const [exists] = await file.exists();
  if (!exists) return { version: 1, updated_at: new Date().toISOString(), videos: [] };
  const [raw] = await file.download();
  const parsed = JSON.parse(raw.toString('utf-8'));
  return {
    version: Number(parsed.version) || 1,
    updated_at: parsed.updated_at || new Date().toISOString(),
    videos: Array.isArray(parsed.videos) ? parsed.videos : [],
  };
}

async function saveIndex(bucket, index) {
  const payload = JSON.stringify({
    version: Number(index.version) || 1,
    updated_at: new Date().toISOString(),
    videos: index.videos,
  }, null, 2);
  await bucket.file(INDEX_KEY).save(payload, {
    contentType: 'application/json; charset=utf-8',
    resumable: false,
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const sourceDir = args.source;
  if (!sourceDir) {
    throw new Error('Usage: npm run upload:gcs -- --source <directory> [--title <name>] [--type movie|episode] [--bucket mkv-player] [--key-file <service-account.json>]');
  }

  const bucketName = readArgOrEnv(args.bucket, 'GCS_BUCKET', 'mkv-player');
  const keyFile = readArgOrEnv(args.keyFile, 'GOOGLE_APPLICATION_CREDENTIALS');
  const projectId = readArgOrEnv(process.env.GCP_PROJECT_ID, 'GOOGLE_CLOUD_PROJECT', 'uplifted-block-254615');
  const title = (args.title || '').trim();
  const type = args.type === 'episode' ? 'episode' : 'movie';

  const storage = keyFile
    ? new Storage({ projectId, keyFilename: keyFile })
    : new Storage({ projectId });
  const bucket = storage.bucket(bucketName);

  const absSource = path.resolve(sourceDir);
  const files = await walk(absSource);
  if (files.length === 0) {
    console.log(`No files found under: ${absSource}`);
    return;
  }

  const hasMaster = files.some(file => path.basename(file) === 'master.m3u8');
  if (!hasMaster) throw new Error('Source directory must include master.m3u8');

  const uuid = crypto.randomUUID();
  const prefix = `media/${uuid}`;

  console.log(`Uploading ${files.length} files to gs://${bucketName}/${prefix}`);
  for (const filePath of files) {
    const rel = toPosix(path.relative(absSource, filePath));
    const key = `${prefix}/${rel}`;
    const body = await readFile(filePath);
    await bucket.file(key).save(body, {
      contentType: contentTypeFor(filePath),
      resumable: false,
    });
    console.log(`Uploaded: ${key}`);
  }

  const now = new Date().toISOString();
  const tags = normalizeTags(args.tags);
  const duration = normalizeInt(args.duration);
  const season = normalizeInt(args.season);
  const episode = normalizeInt(args.episode);
  const thumbnail = args.thumbnail
    ? `${prefix}/${args.thumbnail.replace(/^\/+/, '')}`
    : '';
  const defaultTitle = type === 'episode' ? `Episode ${episode ?? ''}`.trim() : `Movie ${uuid.slice(0, 8)}`;

  const index = await loadIndex(bucket);
  index.videos.push({
    id: uuid,
    key: `${prefix}/master.m3u8`,
    type,
    series_id: type === 'episode' ? String(args.seriesId || '').trim() : '',
    series_title: type === 'episode' ? String(args.seriesTitle || '').trim() : '',
    season: type === 'episode' ? season : null,
    episode: type === 'episode' ? episode : null,
    title: title || defaultTitle,
    description: String(args.description || '').trim(),
    tags,
    thumbnail,
    duration,
    added_at: now,
    updated_at: now,
  });
  await saveIndex(bucket, index);
  console.log(`Updated: gs://${bucketName}/${INDEX_KEY}`);

  console.log('Upload completed.');
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});

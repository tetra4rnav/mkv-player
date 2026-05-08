import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--source') out.source = argv[i + 1];
    if (a === '--prefix') out.prefix = argv[i + 1];
    if (a === '--account-id') out.accountId = argv[i + 1];
    if (a === '--bucket') out.bucket = argv[i + 1];
    if (a === '--access-key-id') out.accessKeyId = argv[i + 1];
    if (a === '--secret-access-key') out.secretAccessKey = argv[i + 1];
  }
  return out;
}

function toPosix(p) {
  return p.split(path.sep).join('/');
}

function contentTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.m3u8') return 'application/vnd.apple.mpegurl';
  if (ext === '.ts') return 'video/mp2t';
  if (ext === '.mp4') return 'video/mp4';
  if (ext === '.vtt') return 'text/vtt';
  if (ext === '.srt') return 'application/x-subrip';
  if (ext === '.ass' || ext === '.ssa') return 'text/plain';
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

function readArgOrEnv(argValue, envName) {
  return argValue || process.env[envName] || '';
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const sourceDir = args.source;
  const prefix = (args.prefix || '').replace(/^\/+|\/+$/g, '');

  if (!sourceDir) {
    throw new Error('Usage: npm run upload:r2 -- --source <directory> [--prefix <r2-prefix>] --account-id <id> --bucket <name> --access-key-id <key> --secret-access-key <secret>');
  }

  const accountId = readArgOrEnv(args.accountId, 'R2_ACCOUNT_ID');
  const bucket = readArgOrEnv(args.bucket, 'R2_BUCKET');
  const accessKeyId = readArgOrEnv(args.accessKeyId, 'R2_ACCESS_KEY_ID');
  const secretAccessKey = readArgOrEnv(args.secretAccessKey, 'R2_SECRET_ACCESS_KEY');
  if (!accountId) throw new Error('Missing --account-id (or R2_ACCOUNT_ID)');
  if (!bucket) throw new Error('Missing --bucket (or R2_BUCKET)');
  if (!accessKeyId) throw new Error('Missing --access-key-id (or R2_ACCESS_KEY_ID)');
  if (!secretAccessKey) throw new Error('Missing --secret-access-key (or R2_SECRET_ACCESS_KEY)');

  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });

  const absSource = path.resolve(sourceDir);
  const files = await walk(absSource);
  if (files.length === 0) {
    console.log(`No files found under: ${absSource}`);
    return;
  }

  console.log(`Uploading ${files.length} files to r2://${bucket}/${prefix}`);
  for (const filePath of files) {
    const rel = toPosix(path.relative(absSource, filePath));
    const key = prefix ? `${prefix}/${rel}` : rel;
    const body = await readFile(filePath);
    await client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentTypeFor(filePath),
    }));
    console.log(`Uploaded: ${key}`);
  }
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});

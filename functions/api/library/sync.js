import { json } from '../../_shared/library.js';

function titleFromKey(key) {
  const parts = key.split('/').filter(Boolean);
  if (parts.length < 2) return key;
  return parts[parts.length - 2];
}

export async function onRequestPost({ env }) {
  try {
    let cursor;
    let added = 0;
    let skipped = 0;

    do {
      const listed = await env.MEDIA_BUCKET.list({ cursor, limit: 1000 });
      cursor = listed.truncated ? listed.cursor : undefined;

      const targets = listed.objects
        .map(o => o.key)
        .filter(key => key.endsWith('/master.m3u8') || key === 'master.m3u8');

      for (const key of targets) {
        const info = await env.DB.prepare(
          `INSERT INTO videos (r2_key, title, tags, updated_at)
           VALUES (?, ?, '[]', datetime('now'))
           ON CONFLICT(r2_key) DO NOTHING`
        )
          .bind(key, titleFromKey(key))
          .run();

        if ((info.meta?.changes || 0) > 0) added += 1;
        else skipped += 1;
      }
    } while (cursor);

    return json({ added, skipped });
  } catch (error) {
    return json({ error: error.message || 'Failed to sync library' }, 500);
  }
}

import { json, normalizeEntry, readLibraryIndex, writeLibraryIndex } from '../../_shared/library.js';
import { listObjects } from '../../_shared/gcs.js';

export async function onRequestPost({ env }) {
  try {
    const index = await readLibraryIndex(env);
    const existingKeys = new Set(index.videos.map(video => video.key));

    let pageToken;
    let added = 0;
    let skipped = 0;
    let scanned = 0;

    do {
      const listed = await listObjects(env, { maxResults: 1000, pageToken, prefix: 'media/' });
      pageToken = listed.nextPageToken;
      const targets = listed.items
        .map(item => item.name)
        .filter(key => key.endsWith('/master.m3u8'));

      scanned += targets.length;
      for (const key of targets) {
        if (existingKeys.has(key)) {
          skipped += 1;
          continue;
        }
        const id = key.split('/')[1] || crypto.randomUUID();
        index.videos.push(normalizeEntry({
          id,
          key,
          type: 'movie',
          title: `未登録 ${id.slice(0, 8)}`,
          tags: [],
        }));
        existingKeys.add(key);
        added += 1;
      }
    } while (pageToken);

    if (added > 0) {
      await writeLibraryIndex(env, index);
    }

    return json({ added, skipped, scanned });
  } catch (error) {
    return json({ error: error.message || 'Failed to sync library' }, 500);
  }
}

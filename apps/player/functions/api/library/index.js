import {
  ALLOWED_SORT_FIELDS,
  entryToVideo,
  json,
  normalizeEntry,
  parseTagsInput,
  readLibraryIndex,
  writeLibraryIndex,
} from '../../_shared/library.js';

function sortVideos(videos, sort, order) {
  const factor = order === 'asc' ? 1 : -1;
  return [...videos].sort((a, b) => {
    if (sort === 'duration') {
      const av = a.duration ?? -1;
      const bv = b.duration ?? -1;
      return (av - bv) * factor;
    }
    if (sort === 'title') {
      return a.title.localeCompare(b.title, 'ja') * factor;
    }
    const av = Date.parse(a.added_at || 0);
    const bv = Date.parse(b.added_at || 0);
    return (av - bv) * factor;
  });
}

export async function onRequestGet({ request, env }) {
  try {
    const url = new URL(request.url);
    const q = (url.searchParams.get('q') || '').trim();
    const tag = (url.searchParams.get('tag') || '').trim();
    const sortParam = (url.searchParams.get('sort') || 'added_at').trim();
    const orderParam = (url.searchParams.get('order') || 'desc').trim().toLowerCase();
    const sort = ALLOWED_SORT_FIELDS.has(sortParam) ? sortParam : 'added_at';
    const order = orderParam === 'asc' ? 'asc' : 'desc';

    const index = await readLibraryIndex(env);
    const filtered = index.videos.filter(video => {
      if (q) {
        const hay = `${video.title || ''}\n${video.description || ''}`.toLowerCase();
        if (!hay.includes(q.toLowerCase())) return false;
      }
      if (tag && !(video.tags || []).includes(tag)) return false;
      return true;
    });
    const sorted = sortVideos(filtered, sort, order);
    return json({ videos: sorted.map(entryToVideo), total: sorted.length });
  } catch (error) {
    return json({ error: error.message || 'Failed to fetch library' }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    const key = (body.key || body.r2_key || '').trim();
    const type = body.type === 'episode' ? 'episode' : 'movie';
    const title = (body.title || '').trim();
    const description = (body.description || '').trim();
    const tags = parseTagsInput(body.tags);
    const thumbnail = (body.thumbnail || '').trim();
    const duration = body.duration == null || body.duration === '' ? null : Number(body.duration);

    if (!key || !title) {
      return json({ error: 'key and title are required' }, 400);
    }
    if (duration != null && !Number.isFinite(duration)) {
      return json({ error: 'duration must be a number' }, 400);
    }

    const index = await readLibraryIndex(env);
    if (index.videos.some(v => v.key === key)) {
      return json({ error: 'key already exists' }, 409);
    }

    const now = new Date().toISOString();
    const entry = normalizeEntry({
      id: body.id,
      key,
      type,
      series_id: body.series_id,
      series_title: body.series_title,
      season: body.season,
      episode: body.episode,
      title,
      description,
      tags,
      thumbnail,
      duration: duration == null ? null : Math.round(duration),
      added_at: now,
      updated_at: now,
    });
    index.videos.push(entry);
    await writeLibraryIndex(env, index);
    return json({ video: entryToVideo(entry) }, 201);
  } catch (error) {
    return json({ error: error.message || 'Failed to create video' }, 500);
  }
}

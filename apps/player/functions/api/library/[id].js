import { entryToVideo, json, parseTagsInput, readLibraryIndex, writeLibraryIndex } from '../../_shared/library.js';

function parseId(params) {
  const n = String(params.id || '').trim();
  return n || null;
}

export async function onRequestGet({ env, params }) {
  try {
    const id = parseId(params);
    if (!id) return json({ error: 'Invalid id' }, 400);

    const index = await readLibraryIndex(env);
    const row = index.videos.find(video => video.id === id);

    if (!row) return json({ error: 'Not found' }, 404);
    return json({ video: entryToVideo(row) });
  } catch (error) {
    return json({ error: error.message || 'Failed to fetch video' }, 500);
  }
}

export async function onRequestPatch({ request, env, params }) {
  try {
    const id = parseId(params);
    if (!id) return json({ error: 'Invalid id' }, 400);

    const body = await request.json();
    const index = await readLibraryIndex(env);
    const targetIndex = index.videos.findIndex(video => video.id === id);
    if (targetIndex < 0) return json({ error: 'Not found' }, 404);
    const current = index.videos[targetIndex];

    if (Object.prototype.hasOwnProperty.call(body, 'title')) {
      const title = String(body.title || '').trim();
      if (!title) return json({ error: 'title cannot be empty' }, 400);
      current.title = title;
    }
    if (Object.prototype.hasOwnProperty.call(body, 'description')) {
      current.description = String(body.description || '').trim();
    }
    if (Object.prototype.hasOwnProperty.call(body, 'tags')) {
      current.tags = parseTagsInput(body.tags);
    }
    if (Object.prototype.hasOwnProperty.call(body, 'thumbnail')) {
      current.thumbnail = String(body.thumbnail || '').trim();
    }
    if (Object.prototype.hasOwnProperty.call(body, 'duration')) {
      const duration = body.duration == null || body.duration === '' ? null : Number(body.duration);
      if (duration != null && !Number.isFinite(duration)) {
        return json({ error: 'duration must be a number' }, 400);
      }
      current.duration = duration == null ? null : Math.round(duration);
    }
    if (Object.prototype.hasOwnProperty.call(body, 'type')) {
      current.type = body.type === 'episode' ? 'episode' : 'movie';
    }
    if (Object.prototype.hasOwnProperty.call(body, 'series_id')) {
      current.series_id = String(body.series_id || '').trim();
    }
    if (Object.prototype.hasOwnProperty.call(body, 'series_title')) {
      current.series_title = String(body.series_title || '').trim();
    }
    if (Object.prototype.hasOwnProperty.call(body, 'season')) {
      const season = body.season == null || body.season === '' ? null : Number(body.season);
      if (season != null && !Number.isFinite(season)) return json({ error: 'season must be a number' }, 400);
      current.season = season == null ? null : Math.round(season);
    }
    if (Object.prototype.hasOwnProperty.call(body, 'episode')) {
      const episode = body.episode == null || body.episode === '' ? null : Number(body.episode);
      if (episode != null && !Number.isFinite(episode)) return json({ error: 'episode must be a number' }, 400);
      current.episode = episode == null ? null : Math.round(episode);
    }

    current.updated_at = new Date().toISOString();
    index.videos[targetIndex] = current;
    const saved = await writeLibraryIndex(env, index);
    const row = saved.videos.find(video => video.id === id);
    return json({ video: entryToVideo(row) });
  } catch (error) {
    return json({ error: error.message || 'Failed to update video' }, 500);
  }
}

export async function onRequestDelete({ env, params }) {
  try {
    const id = parseId(params);
    if (!id) return json({ error: 'Invalid id' }, 400);

    const index = await readLibraryIndex(env);
    const target = index.videos.find(video => video.id === id);
    if (!target) return json({ error: 'Not found' }, 404);
    index.videos = index.videos.filter(video => video.id !== id);
    await writeLibraryIndex(env, index);
    return json({ deleted: entryToVideo(target) });
  } catch (error) {
    return json({ error: error.message || 'Failed to delete video' }, 500);
  }
}

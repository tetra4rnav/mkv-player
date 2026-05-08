import { json, parseTagsInput, rowToVideo } from '../../_shared/library.js';

function parseId(params) {
  const n = Number(params.id);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export async function onRequestGet({ env, params }) {
  try {
    const id = parseId(params);
    if (!id) return json({ error: 'Invalid id' }, 400);

    const row = await env.DB.prepare(
      `SELECT id, r2_key, title, description, tags, thumbnail, duration, added_at, updated_at
       FROM videos WHERE id = ?`
    )
      .bind(id)
      .first();

    if (!row) return json({ error: 'Not found' }, 404);
    return json({ video: rowToVideo(row) });
  } catch (error) {
    return json({ error: error.message || 'Failed to fetch video' }, 500);
  }
}

export async function onRequestPatch({ request, env, params }) {
  try {
    const id = parseId(params);
    if (!id) return json({ error: 'Invalid id' }, 400);

    const body = await request.json();
    const patchable = ['title', 'description', 'tags', 'thumbnail', 'duration'];
    const updates = [];
    const values = [];

    if (Object.prototype.hasOwnProperty.call(body, 'title')) {
      const title = String(body.title || '').trim();
      if (!title) return json({ error: 'title cannot be empty' }, 400);
      updates.push('title = ?');
      values.push(title);
    }
    if (Object.prototype.hasOwnProperty.call(body, 'description')) {
      updates.push('description = ?');
      values.push(String(body.description || '').trim() || null);
    }
    if (Object.prototype.hasOwnProperty.call(body, 'tags')) {
      updates.push('tags = ?');
      values.push(JSON.stringify(parseTagsInput(body.tags)));
    }
    if (Object.prototype.hasOwnProperty.call(body, 'thumbnail')) {
      updates.push('thumbnail = ?');
      values.push(String(body.thumbnail || '').trim() || null);
    }
    if (Object.prototype.hasOwnProperty.call(body, 'duration')) {
      const duration = body.duration == null || body.duration === '' ? null : Number(body.duration);
      if (duration != null && !Number.isFinite(duration)) {
        return json({ error: 'duration must be a number' }, 400);
      }
      updates.push('duration = ?');
      values.push(duration == null ? null : Math.round(duration));
    }

    if (!updates.length) return json({ error: 'No updatable fields provided' }, 400);

    updates.push("updated_at = datetime('now')");
    const row = await env.DB.prepare(
      `UPDATE videos
       SET ${updates.join(', ')}
       WHERE id = ?
       RETURNING id, r2_key, title, description, tags, thumbnail, duration, added_at, updated_at`
    )
      .bind(...values, id)
      .first();

    if (!row) return json({ error: 'Not found' }, 404);
    return json({ video: rowToVideo(row) });
  } catch (error) {
    return json({ error: error.message || 'Failed to update video' }, 500);
  }
}

export async function onRequestDelete({ env, params }) {
  try {
    const id = parseId(params);
    if (!id) return json({ error: 'Invalid id' }, 400);

    const row = await env.DB.prepare(
      `DELETE FROM videos
       WHERE id = ?
       RETURNING id, r2_key, title, description, tags, thumbnail, duration, added_at, updated_at`
    )
      .bind(id)
      .first();

    if (!row) return json({ error: 'Not found' }, 404);
    return json({ deleted: rowToVideo(row) });
  } catch (error) {
    return json({ error: error.message || 'Failed to delete video' }, 500);
  }
}

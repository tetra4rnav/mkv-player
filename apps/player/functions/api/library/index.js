import { ALLOWED_SORT_FIELDS, json, parseTagsInput, rowToVideo } from '../../_shared/library.js';

export async function onRequestGet({ request, env }) {
  try {
    const url = new URL(request.url);
    const q = (url.searchParams.get('q') || '').trim();
    const tag = (url.searchParams.get('tag') || '').trim();
    const sortParam = (url.searchParams.get('sort') || 'added_at').trim();
    const orderParam = (url.searchParams.get('order') || 'desc').trim().toLowerCase();
    const sort = ALLOWED_SORT_FIELDS.has(sortParam) ? sortParam : 'added_at';
    const order = orderParam === 'asc' ? 'ASC' : 'DESC';

    const where = [];
    const params = [];

    if (q) {
      where.push('(title LIKE ? OR description LIKE ?)');
      const like = `%${q}%`;
      params.push(like, like);
    }
    if (tag) {
      where.push('tags LIKE ?');
      params.push(`%"${tag}"%`);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const stmt = env.DB.prepare(
      `SELECT id, r2_key, title, description, tags, thumbnail, duration, added_at, updated_at
       FROM videos
       ${whereSql}
       ORDER BY ${sort} ${order}`
    ).bind(...params);
    const result = await stmt.all();
    const rows = result.results || [];

    return json({ videos: rows.map(rowToVideo), total: rows.length });
  } catch (error) {
    return json({ error: error.message || 'Failed to fetch library' }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    const r2Key = (body.r2_key || '').trim();
    const title = (body.title || '').trim();
    const description = (body.description || '').trim();
    const tags = parseTagsInput(body.tags);
    const thumbnail = (body.thumbnail || '').trim();
    const duration = body.duration == null || body.duration === '' ? null : Number(body.duration);

    if (!r2Key || !title) {
      return json({ error: 'r2_key and title are required' }, 400);
    }
    if (duration != null && !Number.isFinite(duration)) {
      return json({ error: 'duration must be a number' }, 400);
    }

    const insert = await env.DB.prepare(
      `INSERT INTO videos (r2_key, title, description, tags, thumbnail, duration, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
       RETURNING id, r2_key, title, description, tags, thumbnail, duration, added_at, updated_at`
    )
      .bind(
        r2Key,
        title,
        description || null,
        JSON.stringify(tags),
        thumbnail || null,
        duration == null ? null : Math.round(duration)
      )
      .first();

    return json({ video: rowToVideo(insert) }, 201);
  } catch (error) {
    if ((error.message || '').includes('UNIQUE constraint failed')) {
      return json({ error: 'r2_key already exists' }, 409);
    }
    return json({ error: error.message || 'Failed to create video' }, 500);
  }
}

import { getObject, putObject } from './gcs.js';

export const ALLOWED_SORT_FIELDS = new Set(['added_at', 'title', 'duration']);
const LIBRARY_INDEX_KEY = '_library/index.json';

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function parseTagsInput(input) {
  if (Array.isArray(input)) {
    return input.map(v => String(v).trim()).filter(Boolean);
  }
  if (typeof input === 'string') {
    const s = input.trim();
    if (!s) return [];
    try {
      if (s.startsWith('[')) {
        const parsed = JSON.parse(s);
        if (Array.isArray(parsed)) {
          return parsed.map(v => String(v).trim()).filter(Boolean);
        }
      }
    } catch {}
    return s.split(',').map(v => v.trim()).filter(Boolean);
  }
  return [];
}

export function parseTagsFromDb(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function entryToVideo(row) {
  return {
    id: row.id,
    key: row.key || row.r2_key || '',
    type: row.type || 'movie',
    series_id: row.series_id || '',
    series_title: row.series_title || '',
    season: row.season ?? null,
    episode: row.episode ?? null,
    title: row.title,
    description: row.description || '',
    tags: Array.isArray(row.tags) ? row.tags : parseTagsFromDb(row.tags),
    thumbnail: row.thumbnail || '',
    duration: row.duration,
    added_at: row.added_at,
    updated_at: row.updated_at,
  };
}

function nowIso() {
  return new Date().toISOString();
}

function shortId() {
  if (typeof crypto?.randomUUID === 'function') return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function buildPlaceholderTitle(id) {
  return `未登録 ${id.slice(0, 8)}`;
}

export function normalizeEntry(input = {}) {
  const id = String(input.id || shortId()).trim();
  const key = String(input.key || '').trim();
  const type = input.type === 'episode' ? 'episode' : 'movie';
  const seriesId = String(input.series_id || '').trim();
  const seriesTitle = String(input.series_title || '').trim();
  const season = input.season == null || input.season === '' ? null : Number(input.season);
  const episode = input.episode == null || input.episode === '' ? null : Number(input.episode);
  const createdAt = String(input.added_at || nowIso());
  const updatedAt = String(input.updated_at || createdAt);
  return {
    id,
    key,
    type,
    series_id: seriesId,
    series_title: seriesTitle,
    season: Number.isFinite(season) ? Math.round(season) : null,
    episode: Number.isFinite(episode) ? Math.round(episode) : null,
    title: String(input.title || buildPlaceholderTitle(id)).trim() || buildPlaceholderTitle(id),
    description: String(input.description || '').trim(),
    tags: parseTagsInput(input.tags),
    thumbnail: String(input.thumbnail || '').trim(),
    duration: input.duration == null || input.duration === '' ? null : Math.round(Number(input.duration)),
    added_at: createdAt,
    updated_at: updatedAt,
  };
}

export async function readLibraryIndex(env) {
  const res = await getObject(env, LIBRARY_INDEX_KEY);
  if (!res) {
    return { version: 1, updated_at: nowIso(), videos: [] };
  }
  const payload = await res.json();
  const videos = Array.isArray(payload.videos) ? payload.videos.map(normalizeEntry) : [];
  return {
    version: Number(payload.version) || 1,
    updated_at: String(payload.updated_at || nowIso()),
    videos,
  };
}

export async function writeLibraryIndex(env, index) {
  const output = {
    version: Number(index.version) || 1,
    updated_at: nowIso(),
    videos: (index.videos || []).map(normalizeEntry),
  };
  await putObject(env, LIBRARY_INDEX_KEY, JSON.stringify(output, null, 2), 'application/json; charset=utf-8');
  return output;
}

export const ALLOWED_SORT_FIELDS = new Set(['added_at', 'title', 'duration']);

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

export function rowToVideo(row) {
  return {
    id: row.id,
    r2_key: row.r2_key,
    title: row.title,
    description: row.description || '',
    tags: parseTagsFromDb(row.tags),
    thumbnail: row.thumbnail || '',
    duration: row.duration,
    added_at: row.added_at,
    updated_at: row.updated_at,
  };
}

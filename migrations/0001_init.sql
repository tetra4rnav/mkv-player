CREATE TABLE videos (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  r2_key      TEXT NOT NULL UNIQUE,
  title       TEXT NOT NULL,
  description TEXT,
  tags        TEXT DEFAULT '[]',
  thumbnail   TEXT,
  duration    INTEGER,
  added_at    TEXT DEFAULT (datetime('now')),
  updated_at  TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_videos_tags ON videos(tags);
CREATE INDEX idx_videos_added ON videos(added_at DESC);

PRAGMA foreign_keys = ON;
CREATE TABLE sites (
  id INTEGER PRIMARY KEY, slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
  hostname TEXT UNIQUE, theme_json TEXT NOT NULL DEFAULT '{}',
  about TEXT NOT NULL DEFAULT '', links_json TEXT NOT NULL DEFAULT '[]',
  content_version INTEGER NOT NULL DEFAULT 1);
CREATE TABLE users (email TEXT PRIMARY KEY COLLATE NOCASE,
  site_id INTEGER NOT NULL REFERENCES sites(id));
CREATE TABLE field_defs (
  id INTEGER PRIMARY KEY, site_id INTEGER NOT NULL REFERENCES sites(id),
  key TEXT NOT NULL, label TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('text','longtext','url')),
  required INTEGER NOT NULL DEFAULT 0, sort REAL NOT NULL DEFAULT 0,
  archived INTEGER NOT NULL DEFAULT 0, UNIQUE (site_id, key));
CREATE TABLE works (
  id INTEGER PRIMARY KEY, site_id INTEGER NOT NULL REFERENCES sites(id),
  slug TEXT NOT NULL, title TEXT NOT NULL DEFAULT '',
  visible INTEGER NOT NULL DEFAULT 0, sort REAL NOT NULL DEFAULT 0,
  fields_json TEXT NOT NULL DEFAULT '{}', cover_media_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  deleted_at TEXT, UNIQUE (site_id, slug));
CREATE INDEX works_site_sort ON works(site_id, deleted_at, sort);
CREATE TABLE media (
  id INTEGER PRIMARY KEY, site_id INTEGER NOT NULL REFERENCES sites(id),
  work_id INTEGER REFERENCES works(id),
  kind TEXT NOT NULL CHECK (kind IN ('image','video')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','ready')),
  mime TEXT NOT NULL, width INTEGER NOT NULL, height INTEGER NOT NULL,
  duration REAL, color TEXT, alt TEXT NOT NULL DEFAULT '',
  variants_json TEXT NOT NULL DEFAULT '[]', bytes INTEGER NOT NULL DEFAULT 0,
  sort REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')));
CREATE INDEX media_work ON media(work_id, sort);
CREATE TABLE tags (
  id INTEGER PRIMARY KEY, site_id INTEGER NOT NULL REFERENCES sites(id),
  name TEXT NOT NULL, slug TEXT NOT NULL, UNIQUE (site_id, slug));
CREATE TABLE work_tags (
  work_id INTEGER NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (work_id, tag_id));

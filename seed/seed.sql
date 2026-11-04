-- Initial data for a fresh database: the two sites, who may edit each, and the details every work can have.
-- Safe to run twice. BEFORE running it for real, replace the two REPLACE_ME emails below with the real ones
-- (the email each person signs in with through Cloudflare Access). See docs/deploy.md.

INSERT OR IGNORE INTO sites (id, slug, name, theme_json) VALUES
  (1, 'site-a', 'Site A', '{"preset":"grotesk"}'),
  (2, 'site-b', 'Site B', '{"preset":"serif-title","accent":"#7A3E2E"}');

INSERT OR IGNORE INTO users (email, site_id) VALUES
  ('REPLACE_ME_A@example.com', 1),
  ('REPLACE_ME_B@example.com', 2);

INSERT OR IGNORE INTO field_defs (site_id, key, label, type, required, sort) VALUES
  (1, 'medium',       'Medium',       'text',     0, 1),
  (1, 'dimensions',   'Dimensions',   'text',     0, 2),
  (1, 'year',         'Year',         'text',     0, 3),
  (1, 'description',  'Description',  'longtext', 0, 4),
  (1, 'availability', 'Availability', 'text',     0, 5),
  (2, 'medium',       'Medium',       'text',     0, 1),
  (2, 'dimensions',   'Dimensions',   'text',     0, 2),
  (2, 'year',         'Year',         'text',     0, 3),
  (2, 'description',  'Description',  'longtext', 0, 4),
  (2, 'availability', 'Availability', 'text',     0, 5);

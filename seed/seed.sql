-- Initial data for a fresh database: the two sites and the details every work can have. Safe to run twice.
-- Who may sign in is NOT here, so no email addresses end up in the repository; docs/deploy.md adds them with a
-- one-off command. (`pnpm seed:demo` adds sign-in users for local development only.)

INSERT OR IGNORE INTO sites (id, slug, name, theme_json) VALUES
  (1, 'site-a', 'Site A', '{"preset":"grotesk","accent":"#E4452D"}'),
  (2, 'site-b', 'Site B', '{"preset":"serif-title","accent":"#C2693F"}');

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

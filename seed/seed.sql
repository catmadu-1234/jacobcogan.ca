-- Initial data for a fresh database: the two sites and the details every work can have. (Medium, Project, Content and
-- Exhibition are not details: they are facets, stored in facet_values.) Safe to run twice.
-- Who may sign in is NOT here, so no email addresses end up in the repository; docs/deploy.md adds them with a
-- one-off command. (`pnpm seed:demo` adds sign-in users for local development only.)

INSERT OR IGNORE INTO sites (id, slug, name, theme_json) VALUES
  (1, 'site-a', 'Site A', '{"preset":"grotesk","accent":"#E4452D"}'),
  (2, 'site-b', 'Site B', '{"preset":"serif-title","accent":"#C2693F"}');

INSERT OR IGNORE INTO field_defs (site_id, key, label, type, required, sort) VALUES
  (1, 'dimensions',   'Dimensions',   'text',     0, 3),
  (1, 'year',         'Year',         'text',     0, 4),
  (1, 'description',  'Description',  'longtext', 0, 5),
  (1, 'availability', 'Availability', 'text',     0, 6),
  (2, 'dimensions',   'Dimensions',   'text',     0, 3),
  (2, 'year',         'Year',         'text',     0, 4),
  (2, 'description',  'Description',  'longtext', 0, 5),
  (2, 'availability', 'Availability', 'text',     0, 6);

-- Studio posts are stored as works of a second kind, so they reuse uploads, undo, visibility and clean-up.
-- A post's text lives in `body`; a post may have no pictures at all (a "thought").
ALTER TABLE works ADD COLUMN kind TEXT NOT NULL DEFAULT 'work' CHECK (kind IN ('work', 'post'));
ALTER TABLE works ADD COLUMN body TEXT NOT NULL DEFAULT '';
CREATE INDEX works_site_kind ON works(site_id, kind, deleted_at, created_at);

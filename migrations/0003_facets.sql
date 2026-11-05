-- Cataloguing facets: Medium, Project, Content and Exhibition become per-site vocabularies that a work links to
-- (many per work). The old tags and work_tags tables are left in place, untouched, as a record.
CREATE TABLE facet_values (
  id INTEGER PRIMARY KEY, site_id INTEGER NOT NULL REFERENCES sites(id),
  facet TEXT NOT NULL CHECK (facet IN ('medium','project','content','exhibition')),
  name TEXT NOT NULL, slug TEXT NOT NULL, UNIQUE (site_id, facet, slug));
CREATE TABLE work_facet_values (
  work_id INTEGER NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  value_id INTEGER NOT NULL REFERENCES facet_values(id) ON DELETE CASCADE,
  PRIMARY KEY (work_id, value_id));
CREATE INDEX work_facet_values_value ON work_facet_values(value_id);

-- Existing general tags become Mediums (there are only a handful, and they name materials).
INSERT INTO facet_values (site_id, facet, name, slug) SELECT site_id, 'medium', name, slug FROM tags;
INSERT INTO work_facet_values (work_id, value_id)
  SELECT wt.work_id, fv.id FROM work_tags wt
  JOIN tags t ON t.id = wt.tag_id
  JOIN facet_values fv ON fv.site_id = t.site_id AND fv.facet = 'medium' AND fv.slug = t.slug;

-- Medium and Project are no longer free-text details. Their old text stays in each work's details record.
UPDATE field_defs SET archived = 1 WHERE key IN ('medium', 'project');

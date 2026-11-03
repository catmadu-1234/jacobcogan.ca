export async function seedTwoSites(db: D1Database): Promise<{ a: number; b: number }> {
  const insertSite = db.prepare("INSERT INTO sites (slug, name) VALUES (?, ?)");
  const [ra, rb] = await db.batch([insertSite.bind("site-a", "Site A"), insertSite.bind("site-b", "Site B")]);
  const a = ra.meta.last_row_id as number;
  const b = rb.meta.last_row_id as number;
  const insertUser = db.prepare("INSERT INTO users (email, site_id) VALUES (?, ?)");
  await db.batch([insertUser.bind("a@test.dev", a), insertUser.bind("b@test.dev", b)]);
  return { a, b };
}

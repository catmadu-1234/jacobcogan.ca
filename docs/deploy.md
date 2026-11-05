# Putting ArtMS online

Everything runs on Cloudflare's free plan. When you're done there are two live addresses:

| What | Address (until you add your own domains) | Who sees it |
|---|---|---|
| The admin where you both add and edit work | `https://senka-admin.<your-subdomain>.workers.dev` | Only the two of you, after an email code |
| Both portfolios | `https://senka-sites.<your-subdomain>.workers.dev/site-a` and `/site-b` | Everyone |

Allow about 30 minutes the first time. Anything marked **(check)** is a screen in Cloudflare's dashboard whose exact wording changes now and then; the idea stays the same.

## Before you start

- A free Cloudflare account, and a GitHub account.
- This project on your computer, with `pnpm install` already run.
- Both of your email addresses (the ones you'll sign in with).

All commands below run from the project folder.

## 1. One-time setup

**1. Log in to Cloudflare.**

```bash
pnpm --filter admin exec wrangler login
```

**2. Create the database.**

```bash
pnpm --filter admin exec wrangler d1 create senka-db
```

It prints a `database_id`. Paste it into **both** `apps/admin/wrangler.jsonc` and `apps/sites/wrangler.jsonc`, replacing `"local"`. It is an identifier, not a secret, and **you must commit these two files**: the automatic publishing in section 2 deploys exactly what is in the repository.

**3. Create the file storage for images and videos.**

```bash
pnpm --filter admin exec wrangler r2 bucket create senka-media
```

**4. Create the tables and the starting data** (the two sites and the default details):

```bash
pnpm --filter admin exec wrangler d1 migrations apply senka-db --remote
pnpm --filter admin exec wrangler d1 execute senka-db --remote --file ../../seed/seed.sql
```

**5. Say who is allowed in.** Replace the two emails with the real ones (the address each of you signs in with). Site A belongs to the first, Site B to the second. This is a one-off command, so your addresses never go into the project's files or GitHub:

```bash
pnpm --filter admin exec wrangler d1 execute senka-db --remote --command "INSERT INTO users (email, site_id) VALUES ('first@example.com', 1), ('second@example.com', 2)"
```

You can rename the sites and choose their look later in the admin.

**6. Publish the portfolios first**, so you learn your `workers.dev` address.

```bash
pnpm --filter sites run deploy:worker
```

The first time, Cloudflare asks you to pick a `workers.dev` subdomain. Note the address it prints (`https://senka-sites.<subdomain>.workers.dev`).

> The first deploy also creates a small, empty storage space called `SESSION` for the website framework. We don't use it and it costs nothing, but your login token needs permission to create it (see step 8).

**7. Publish the admin**, telling it where the portfolios live so its "Open my site" link works:

```bash
VITE_SITES_ORIGIN=https://senka-sites.<subdomain>.workers.dev pnpm --filter admin run deploy:worker
```

At this point the admin refuses everyone (it is not yet connected to a login), which is the safe way round.

**8. Put a login in front of the admin (Cloudflare Access).**

1. In the Cloudflare dashboard open **Zero Trust**. If asked, pick a team name; this becomes `<team>.cloudflareaccess.com`. The free plan is fine. **(check)**
2. Under **Settings → Authentication** make sure **One-time PIN** is switched on. People will sign in by typing a code emailed to them.
3. Protect the admin:
   - **Easiest:** **Workers & Pages → senka-admin → Settings → Domains & Routes**, find the `workers.dev` row and choose **Enable Cloudflare Access**. **(check)** Edit the policy it creates: action **Allow**, rule **Emails**, then add both of your emails.
   - **If you don't see that option:** put the admin on a domain of yours instead (step 3 of "Your own domains" below, using `admin.yourdomain.com`), then in Zero Trust create a **Self-hosted application** for that address with the same Allow policy.
4. Open the application's settings and copy its **Application Audience (AUD) tag**.
5. Put two values into `apps/admin/wrangler.jsonc`, in `vars`:

   ```jsonc
   "vars": { "ACCESS_TEAM_DOMAIN": "<team>.cloudflareaccess.com", "ACCESS_AUD": "<the AUD tag>" }
   ```

   These are not secrets. Commit this file too, then publish the admin again (same command as step 7).

**9. Check that it works.**

- Open the admin address in a private window. Cloudflare asks for your email, then a code. After signing in you land on an empty **Works** screen.
- Add a work with a photo, switch it to **Visible on site**, and open `…/site-a`. It's there.
- Open the admin address from your phone and add a photo from the camera roll.
- From a terminal, run `curl -i https://senka-admin.<subdomain>.workers.dev/api/me`. You should get a redirect to Cloudflare's login page (or a `401`), never your data.

If the admin shows "This account isn't connected to a site yet", the email you signed in with isn't in the database. Fix it with:

```bash
pnpm --filter admin exec wrangler d1 execute senka-db --remote --command "INSERT INTO users (email, site_id) VALUES ('you@example.com', 1)"
```

## 2. Automatic publishing from GitHub

After this, every change that lands on `main` is checked, tested and published on its own.

1. Create a GitHub repository and push this project to it.
2. In Cloudflare, **My Profile → API Tokens → Create Token**. Start from the **Edit Cloudflare Workers** template and make sure it can edit **D1**, **R2 storage** and **Workers KV storage**. **(check)** Copy the token.
3. In GitHub, **Settings → Secrets and variables → Actions**:
   - Secrets: `CLOUDFLARE_API_TOKEN` (the token) and `CLOUDFLARE_ACCOUNT_ID` (shown in the Cloudflare dashboard sidebar).
   - Variable: `VITE_SITES_ORIGIN` = `https://senka-sites.<subdomain>.workers.dev` (or your domain once you have one).

Pull requests run the checks only. Merging to `main` also applies database changes, then publishes the admin and the sites.

## Catalogue facets (one-off data move)

Migration `0003_facets.sql` adds the Medium, Project, Content and Exhibition vocabularies. After it is applied to a
database that already has works, copy their old Medium/Project text into the new facets (safe to run again, never
removes anything):

```bash
node scripts/backfill-facets.mjs --remote
```

## 3. Your own domains (later)

Your domain's DNS needs to be on Cloudflare (free; the dashboard walks you through it).

1. **Workers & Pages → senka-sites → Settings → Domains & Routes → Add → Custom domain**, and enter the portfolio's address, for example `herdomain.com`.
2. Tell the database which site that address belongs to:

   ```bash
   pnpm --filter admin exec wrangler d1 execute senka-db --remote --command "UPDATE sites SET hostname='herdomain.com' WHERE slug='site-b'"
   ```

   From then on `herdomain.com/` shows Site B directly (no `/site-b` in the address). The old `workers.dev/site-b` address keeps working too.
3. The same goes for yours with `site-a`. Only the exact address you store works, so if you also want `www.herdomain.com`, add a redirect to the main one in Cloudflare (**Rules → Redirect Rules**).
4. To move the admin to something like `admin.yourdomain.com`, add it as a custom domain on `senka-admin` in the same place, then update the Access application to that address.

Custom-domain routing can only be tried for real once a domain is attached, so check the home page, one work and `/sitemap.xml` on the new address.

## 4. Things worth knowing

**Hidden work stays private only if media goes through the site.** Images and videos are served by the portfolio itself, which checks that the work is visible. Cloudflare can also give the storage bucket its own public address (a faster option on busy sites) but then every file, including files of hidden works, is reachable by anyone who guesses the number in the URL. Leave the default unless you accept that. To switch anyway, set `MEDIA_BASE` in `apps/sites/wrangler.jsonc` to the bucket's address and publish again.

**Free limits to keep an eye on** (Cloudflare can change these): the portfolios and the admin share about 100,000 requests a day, each page or image counts as one; the database allows about 5 million reads and 100,000 writes a day; storage is 10 GB. The admin's **Settings → Storage** bar shows the storage you have used. Video fills it fastest.

**Backups.** The database keeps 30 days of history you can rewind to:

```bash
pnpm --filter admin exec wrangler d1 time-travel info senka-db
pnpm --filter admin exec wrangler d1 time-travel restore senka-db --timestamp=<time from the info above>
```

Files in storage are not backed up. Keep your originals.

**Housekeeping runs by itself** every night: unfinished uploads older than a day are removed, and works deleted more than 30 days ago are erased for good.

**Previewing before you publish.** Anything you merge to `main` goes live. To try something first, run it on your own computer (see the README).

## 5. If something goes wrong

| What you see | Likely cause |
|---|---|
| Admin keeps asking you to sign in | The AUD tag or team domain in `apps/admin/wrangler.jsonc` doesn't match the Access application. Re-copy both. |
| "This account isn't connected to a site yet" | Your email isn't in the `users` table (command in step 9). |
| Portfolio shows "Nothing here yet" | No work is switched to **Visible on site**, or its images haven't finished uploading. |
| Changes don't show on the portfolio | Hard-refresh. Pages are cached per version of the content; every save in the admin makes a new version. |
| A video won't play for visitors | It's probably an iPhone video in HEVC format. Re-export as "Most Compatible" (Settings → Camera → Formats). The admin warns you when it spots this. |
| The GitHub deploy step fails with a permissions error | The API token is missing D1, R2 or Workers KV edit permission (step 8 above, point 2). |

## Open sides mode (no login yet)

While Cloudflare Access is not set up, `apps/admin/wrangler.jsonc` has `"OPEN_SIDES": "1"`. The admin then opens on a "Whose side?" screen; picking a site is remembered in a cookie, and there is a "Switch side" link at the bottom of every screen. **Anyone who knows the admin address can edit either site**, so keep the address private. To turn the login on, follow section 1 step 8, then remove `OPEN_SIDES` from `vars` and deploy the admin again.

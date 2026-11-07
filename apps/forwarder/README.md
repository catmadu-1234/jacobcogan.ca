# Senka's domain forwarder

A tiny Worker that puts Senka's portfolio on **senkas.studio**. It runs in the Cloudflare account that owns that
domain (Senka's), so the domain's renewal stays on her bill. All it does is pass each visit through to the portfolio
Worker and tell it which address the visitor used; the portfolio does everything else.

## Deploy it (about five minutes, once)

You need [Node.js](https://nodejs.org) installed. In a terminal, from this folder (`apps/forwarder`):

```bash
npm install
npx wrangler login      # opens a browser: sign in to the Cloudflare account that has senkas.studio
npx wrangler deploy
```

`wrangler deploy` creates the DNS records and the certificate for `senkas.studio` and `www.senkas.studio` itself.
Don't add any records by hand. Then open https://senkas.studio.

## Notes

- `www.senkas.studio` redirects to `senkas.studio`.
- If the portfolio's own address ever changes, edit `ORIGIN` in `wrangler.jsonc` and run `npx wrangler deploy` again.
- It uses almost nothing: this Worker stays within Cloudflare's free tier for a portfolio.
- If `wrangler deploy` says the hostname already has DNS records, delete the existing `A`/`AAAA`/`CNAME` records for
  `senkas.studio` and `www` in that account's DNS page and run it again.

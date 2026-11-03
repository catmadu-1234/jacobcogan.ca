# Design Spec: Senka CMS + White-Wall Gallery

Personal project. Not Habitat Learn branded.

**Principle:** the artwork is the only loud thing. Every UI element should look like a museum wall label: small, precise and quiet.

---

## 0. Shared Foundations

### Fonts
Fonts are self-hosted with `@fontsource-variable/*`, which serves them from the Worker's static assets. There's no Google Fonts request, and each `font-display: swap` file is `<link rel=preload>`'d.

| Use | Family | Package |
|---|---|---|
| Admin UI | Instrument Sans (variable) | `@fontsource-variable/instrument-sans` |
| Gallery preset `grotesk` | Geist (body + titles), Geist Mono (metadata) | `@fontsource-variable/geist`, `@fontsource-variable/geist-mono` |
| Gallery preset `serif-title` | Instrument Serif italic (titles), Instrument Sans (body) | `@fontsource/instrument-serif`, `@fontsource-variable/instrument-sans` |

Each site picks a preset in `sites.theme_json`, so the two white-wall sites can look different without separate code.

### Base tokens (both apps)
```css
:root {
  --wall:   #FAFAF8;  /* warm off-white, a gallery wall rather than screen white */
  --paper:  #FFFFFF;  /* raised surfaces (admin cards, inputs) */
  --ink:    #141414;  /* 17.4:1 on --wall */
  --muted:  #6B6B66;  /* 5.3:1 on --wall, AA for small text */
  --hair:   #E6E6E1;  /* 1px dividers */
  --accent: #141414;  /* overridden per site; used ONLY for focus/hover/active */
  --danger: #B3261E;  /* 6.3:1 */
  --ok:     #2E6B47;  /* 6.0:1 */

  --space-1: 4px;  --space-2: 8px;  --space-3: 12px; --space-4: 16px;
  --space-5: 24px; --space-6: 32px; --space-7: 48px; --space-8: 80px; --space-9: 128px;

  --text-xs: 0.75rem;   /* 12, gallery metadata */
  --text-sm: 0.8125rem; /* 13, gallery body, admin secondary */
  --text-md: 1rem;      /* 16, admin body and ALL inputs (stops iOS zoom) */
  --text-lg: 1.25rem;
  --text-xl: clamp(1.5rem, 1.1rem + 1.5vw, 2.25rem);

  --radius: 6px;     /* admin only; gallery uses 0 */
  --ease: cubic-bezier(.2,.7,.2,1);
  --dur: 180ms;
  --focus: 0 0 0 2px var(--wall), 0 0 0 4px var(--accent);
}
@media (prefers-reduced-motion: reduce) { :root { --dur: 0ms; } }
```

**Dark mode:** the gallery stays light, because a white wall is part of the concept. The admin gets a dark mode by redefining tokens (`--wall:#121211; --paper:#1B1B1A; --ink:#EDEDEA; --muted:#A3A39D; --hair:#2A2A28`) under `@media (prefers-color-scheme: dark)`.

### Breakpoints
360 (minimum) · 640 (`sm`) · 960 (`md`) · 1280 (`lg`) · 1600+ (`xl`, cap content at 1760px). Mobile-first `min-width` queries only.

---

## 1. Gallery Theme (Astro, `apps/sites`)

### Layout
- **Page gutter:** `clamp(16px, 4vw, 64px)`. Header and footer are text-only with no borders.
- **Header:** the artist name on the left (`--text-sm`, weight 500) and `Work · About` links on the right (`--text-sm`, `--muted`, which turns `--ink` on hover). The header is not sticky.
- **Index: justified rows in pure CSS, with no JavaScript and no cropping.** Every work keeps its true proportions.
  ```css
  .rows { display:flex; flex-wrap:wrap; gap: var(--row-gap); }
  .rows > a { flex: calc(var(--ar) * 100) 1 calc(var(--ar) * var(--row-h)); aspect-ratio: var(--ar); }
  .rows::after { content:""; flex-grow: 1e4; }   /* keeps last row from stretching */
  ```
  - `--ar` = width/height comes from the media record and is set inline per item.
  - `--row-h`: 240px mobile → 320px `md` → 400px `xl`.
  - `--row-gap`: `clamp(12px, 2vw, 32px)`.
  - Below 640px, use one column at full width with `--space-7` between works.
- **Captions on the index:** none by default, because the work speaks for itself. Hovering (on devices that support it) shows the title in `--text-xs` below the image with an opacity fade.
- **Tag filter:** a single text row above the grid: `All  Painting  Drawing  Video`. These are plain links to `/<site>/tag/<slug>`, not chips. The active tag is `--ink` and underlined 1px with an offset of 4px; the rest are `--muted`. On mobile the row scrolls horizontally with snapping and no visible scrollbar.
- **Work detail** (`/<site>/work/<slug>`):
  - The media stack is centred, and each item is `max-height: 85svh; max-width: 100%`. Media is spaced by `--space-8`, and the first item is above the fold.
  - The caption block goes below the first media item, left-aligned, in two columns at `md`+ (title | details):
    - The title uses the preset title font at `--text-lg`.
    - The custom fields form a `<dl>` with labels in `--muted` `--text-xs` uppercase with letter-spacing .06em, and values in `--text-sm`.
    - Tags are linked, in `--muted`.
  - Previous and next works sit at the bottom as `← Title` / `Title →` text links. The ← and → keys also navigate (a tiny inline script, the only JS on the page).
- **Lightbox:** clicking an image opens the original in a `<dialog>`, fitted contain on `--wall`, and pinch-zoom works natively. Esc or a click closes it. It is built on a native `<dialog>` element and needs no library.
- **Video:**
  - Clips up to 30s use `autoplay muted loop playsinline` with the poster. With `prefers-reduced-motion`, they don't autoplay and show a play button instead.
  - Clips over 30s get `controls`, the poster and `preload="metadata"`.
- **About** (`/<site>/about`): the bio, rendered from the site's long-text field, at max width 60ch in `--text-sm` with line-height 1.7, plus contact links.
- **Transitions:** cross-document view transitions with `@view-transition { navigation: auto; }`, which needs zero JS. The thumbnail morphs into the detail hero via `view-transition-name: work-<id>`.

### Images
- Use `<img srcset>` with the 480w, 1200w and 2400w WebP variants. Always set `width`/`height`, and use `decoding="async"`.
- The first 6 images on the index load eagerly with `fetchpriority="high"` on the first. All others use `loading="lazy"`.
- **Placeholder:** the dominant colour is captured at upload and used as `background-color` on the frame, which avoids a blurhash JS decoder.

### Per-site tokens (`sites.theme_json`)
```json
{ "preset": "grotesk" | "serif-title", "accent": "#141414", "rowHeight": 320, "showIndexCaptions": false }
```
The defaults are: site-a uses `grotesk`, and site-b uses `serif-title` with accent `#7A3E2E`. Both stay editable in admin under Settings → Look.

---

## 2. Admin (React 19 SPA, `apps/admin`)

### Shell
- **Mobile (<960px):** the bottom tab bar is fixed with 64px height plus `env(safe-area-inset-bottom)`. It has 4 tabs: **Works**, **Add** (a centred, filled circular button 52px across), **Tags** and **Settings**. Icons are Lucide (`lucide-react`) at 22px, with labels in `--text-xs`.
- **Desktop (≥960px):** a left sidebar 232px wide shows the site name at top, the same 4 items as rows and the "Add work" button at top as a primary button. Content is capped at max-width 1200px.
- **Copy:** plain words everywhere. Use "Details" (not fields), "Visible on site / Hidden" (not published/draft), "Add work" (not create entry).

### Components
| Component | Spec | States |
|---|---|---|
| Button | 44px min height, radius `--radius`, 0 16px padding, `--text-md` weight 500. Primary: `--ink` background with `--wall` text. Secondary: `--paper` background with 1px `--hair` border. Ghost: text only. | hover (5% darker), focus `--focus`, disabled (40% opacity), busy (inline spinner, label kept) |
| Text input / Textarea | `--paper` background, 1px `--hair` border, `--radius`, 12px padding, `--text-md`. The label sits above in `--text-sm` weight 500, and help text below in `--muted`. Textareas grow automatically. | focus (border `--ink` + `--focus`), error (border `--danger` + message below with icon) |
| Switch (Visible on site) | 52×32 track, 44px hit area. Off is `--hair`, on is `--ok`. The label is to the left. | on/off/busy/disabled |
| Tag input | Chips are 32px tall in `--paper` with a 1px border and an × button. The typing field sits inline with the chips. Matches show as a dropdown below, and the last option is "Create ‘xyz’". Enter or comma adds a tag. | empty, typing, matches, no-match→create, max 20 |
| Media tile | Square thumbnail (object-fit cover in admin only), radius `--radius`, with a cover badge at top-left. The ⋯ menu is at top-right (Set as cover · Edit description · Remove). | uploading (progress ring + %), processing, ready, error (red tint + "Retry"), dragging (raised shadow, 0.9 scale) |
| Upload zone | A dashed 1.5px `--hair` box with an icon and "Add images or videos". It is 120px tall on mobile and 160px on desktop. The whole tile is a `<label>` for `<input type=file multiple accept="image/*,video/mp4,video/quicktime,video/webm">`. On desktop it also accepts dropped files. | idle, drag-over (border `--ink`, `--wall` tint), disabled |
| Save indicator | Text in the top bar: "Saved", "Saving…", "Couldn't save · Retry" or "Offline · will retry". | — |
| Toast | Bottom-centre, above the tab bar, with `--ink` background and `--wall` text. It lasts 5s and can carry an action ("Undo"). | info / error |
| Empty state | A centred icon, a single-sentence explanation and a primary button. Example: "No works yet. Add your first piece — a photo from your phone is fine." | — |

### Screens
1. **Works (home)**
   - The grid has 2 columns on mobile, 3 at 640, 4 at 960 and 5 at 1280.
   - Each card shows the thumbnail (aspect 1:1 in admin for scannability), the title in one line with ellipsis, and a small "Hidden" pill if the work isn't visible.
   - A filter row at the top has a search input and a tag dropdown.
   - **Reorder:** a "Reorder" button switches to reorder mode. Cards show drag handles, and pointer-event drag works for both touch and mouse. The bar changes to "Done" when finished. There is no drag in normal mode, so scrolling on a phone never triggers a drag by accident.
2. **Work editor** (`#/works/:id`), a single scrolling column with max width 720px.
   - **Top bar:** sticky, with ← Back, the save indicator and the "Visible on site" switch.
   - **Order of sections:**
     1. Media tray: a horizontal row of tiles on mobile, a wrapping grid on desktop, then the upload zone. Tiles reorder by drag.
     2. Title
     3. Details: the custom fields in site order. Long text fields use textareas.
     4. Tags
     5. A "Danger zone" with "Delete work". Deleting soft-deletes the work, shows a toast with Undo, and is purged after 30 days.
   - **Autosave:** text saves 800ms after typing stops, and media saves immediately. There is no Save button. `beforeunload` shows a warning only while a save is pending.
   - **Codec guard:** when a video can't play in Chrome (HEVC), the tile shows an error: "This video uses a format some browsers can't play. On iPhone: Settings → Camera → Formats → Most Compatible, or export again." The video can still be kept on request.
3. **Tags**: a list showing each tag's name and number of works. Tapping opens an inline rename. Merge works by renaming one tag to an existing tag's name, after a confirmation. Deleting a tag shows an Undo toast.
4. **Settings**
   - **Details:** the field definitions, drag-sortable. Each has a label, a type (Short text / Long text / Link) and a "Required" toggle. "Add a detail" opens an inline row.
   - **Look:** pick the preset and accent with a live preview thumbnail.
   - **About:** the bio and contact links.
   - **Storage meter:** for example "2.1 GB of 10 GB used", as a bar. It turns amber at 80%.
   - **Open my site ↗**: a link to the live portfolio.

### Interaction rules
- Touch targets are at least 44×44. Every action is reachable by keyboard, with a visible focus ring.
- Never use `alert`/`confirm` dialogs. Destructive actions use Undo toasts. The only confirmation is for merging tags, and it is an inline confirm row rather than a browser dialog.
- Optimistic UI everywhere. If the server rejects a change, roll it back and show a toast.
- If a save conflicts (409 because another tab changed the work), show a banner: "This work changed in another tab. Reload to see the latest."

---

## 3. Design Critique (self-review applied)
| Risk | Fix applied |
|---|---|
| Tiny gallery type fails contrast | `--muted` set to 5.3:1. Tiny type is never under 12px. |
| Justified rows look broken with one very wide panorama | The flex-basis caps it naturally. Add `max-width: 100%`, and the last-row filler stops it stretching. |
| Drag-to-reorder fights scrolling on phones | Reordering only happens in a dedicated Reorder mode. |
| Autoplay video is distracting or uses mobile data | Autoplay only short muted clips, respect reduced-motion and use `preload` metadata for long clips. |
| Off-white wall shifts how artwork colours look | #FAFAF8 is near-neutral (ΔE about 1 from white), and the lightbox uses the same wall colour. |
| The research search suggested film grain and pixel art, which fit poorly | Rejected. The white-wall concept is the user's explicit choice. |

// Filters the gallery in place. Everything works without this script (every choice is a link to a page rendered
// with that filter); with it, choosing a value rearranges the tiles on the same page, inside a view transition,
// so nothing reloads or flashes. It reads the same rules as the server through ../lib/filters.
import { matches, pageHref, parseFilters, toggleFilter, type FacetKey, type Filters, type View, type WorkFacets } from "../lib/filters";

const gallery = document.querySelector<HTMLElement>("[data-gallery]");
const rail = document.querySelector<HTMLElement>("[data-filter-rail]");

if (gallery && rail) {
  const base = rail.dataset.base ?? "";
  const view: View = gallery.dataset.viewMode === "index" ? "index" : "grid";
  const items = [...gallery.querySelectorAll<HTMLElement>("[data-work]")];
  const facets = items.map((el): WorkFacets => ({
    medium: el.dataset.medium,
    project: el.dataset.project,
    year: el.dataset.year,
    tags: el.dataset.tags ? el.dataset.tags.split(" ") : [],
  }));
  const options = [...rail.querySelectorAll<HTMLAnchorElement>("a[data-facet]")];
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const tag = document.querySelector<HTMLElement>("[data-filter-rail] [data-tag-chip]");

  // Tiles are tagged once, so the transition can move each one and fade the ones that come and go.
  for (const el of items) el.style.setProperty("view-transition-class", "tile");

  const count = (key: FacetKey, value: string, filters: Filters) => {
    const others = { ...filters };
    delete others[key];
    return facets.filter((f) => f[key] === value && matches(f, others)).length;
  };

  function apply(filters: Filters) {
    let showing = 0;
    items.forEach((el, i) => {
      const show = matches(facets[i]!, filters);
      el.hidden = !show;
      if (show) showing++;
    });

    for (const a of options) {
      const key = a.dataset.facet as FacetKey;
      const value = a.dataset.value!;
      const active = filters[key] === value;
      const n = count(key, value, filters);
      a.href = pageHref(base, toggleFilter(filters, key, value), view);
      if (active) a.setAttribute("aria-current", "true");
      else a.removeAttribute("aria-current");
      a.toggleAttribute("data-empty", n === 0 && !active);
      const badge = a.querySelector("[data-count]");
      if (badge) badge.textContent = String(n);
    }

    const any = Object.keys(filters).length > 0;
    for (const clear of document.querySelectorAll<HTMLAnchorElement>("a[data-clear]")) {
      clear.href = pageHref(base, {}, view);
      if (clear.closest("[data-empty-state]") === null) clear.hidden = !any;
    }
    if (tag) tag.hidden = !filters.tag;
    for (const toggle of document.querySelectorAll<HTMLAnchorElement>("a[data-view]")) {
      toggle.href = pageHref(base, filters, toggle.dataset.view === "index" ? "index" : "grid");
    }
    const empty = gallery!.querySelector<HTMLElement>("[data-empty-state]");
    if (empty) empty.hidden = showing > 0;
    const result = document.querySelector("[data-result-count]");
    if (result) {
      const noun = items.length === 1 ? "work" : "works";
      result.textContent = showing === items.length ? `${showing} ${noun}` : `${showing} of ${items.length} ${noun}`;
    }
  }

  // Tiles that were filtered out may never have loaded their (lazy) picture; a tile that arrives blank flashes.
  // Load and decode the ones about to appear before the transition takes its "after" snapshot.
  async function warm(filters: Filters) {
    const pending: Promise<unknown>[] = [];
    items.forEach((el, i) => {
      if (!el.hidden || !matches(facets[i]!, filters)) return;
      for (const img of el.querySelectorAll("img")) {
        img.loading = "eager";
        pending.push(img.decode().catch(() => {}));
      }
    });
    await Promise.race([Promise.all(pending), new Promise((done) => setTimeout(done, 600))]);
  }

  async function go(filters: Filters, push: boolean) {
    gallery!.dataset.filtered = "";
    const run = () => {
      apply(filters);
      if (push) history.pushState(null, "", pageHref(base, filters, view));
    };
    if (!document.startViewTransition || reduceMotion.matches) return run();
    await warm(filters);
    document.documentElement.classList.add("filtering");
    const transition = document.startViewTransition(run);
    transition.finished.finally(() => document.documentElement.classList.remove("filtering"));
  }

  document.addEventListener("click", (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = (event.target as Element).closest<HTMLAnchorElement>("a[data-facet], a[data-clear], [data-tag-chip] a");
    if (!link || !gallery.contains(link) && !rail.contains(link)) return;
    event.preventDefault();
    const current = parseFilters(location.search);
    if (link.dataset.facet) go(toggleFilter(current, link.dataset.facet as FacetKey, link.dataset.value!), true);
    else if (link.hasAttribute("data-clear")) go({}, true);
    else {
      const { tag: _tag, ...rest } = current;
      go(rest, true);
    }
  });

  window.addEventListener("popstate", () => go(parseFilters(location.search), false));
}

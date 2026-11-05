import type { ReactNode } from "react";
import { Images, Plus, Settings, Sparkles, Tag } from "lucide-react";
import type { Route } from "../lib/router";
import { Button } from "./Button";
import styles from "./Shell.module.css";

interface Props {
  siteName: string;
  /** True while the admin has no login: show a way back to the side picker. */
  openSides?: boolean;
  route: Route;
  onAdd: () => void;
  children: ReactNode;
}

export function Shell({ siteName, openSides, route, onAdd, children }: Props) {
  const onWorks = route.name === "works" || route.name === "editor";
  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <a className={styles.brand} href="#/works">
          senka
          <span>{siteName}</span>
        </a>
        <Button onClick={onAdd}>
          <Plus size={18} aria-hidden="true" /> Add work
        </Button>
        <nav className={styles.nav} aria-label="Main">
          <a href="#/works" aria-current={onWorks ? "page" : undefined}>
            <Images size={18} aria-hidden="true" /> Works
          </a>
          <a href="#/studio" aria-current={route.name === "studio" ? "page" : undefined}>
            <Sparkles size={18} aria-hidden="true" /> Studio
          </a>
          <a href="#/tags" aria-current={route.name === "tags" ? "page" : undefined}>
            <Tag size={18} aria-hidden="true" /> Tags
          </a>
          <a href="#/settings" aria-current={route.name === "settings" ? "page" : undefined}>
            <Settings size={18} aria-hidden="true" /> Settings
          </a>
        </nav>
      </aside>

      <main className={styles.content}>
        {children}
        {openSides ? (
          <p className={styles.side}>
            Working on {siteName}. <a href="/api/side/none">Switch side</a>
          </p>
        ) : null}
      </main>

      <nav className={styles.tabbar} aria-label="Main">
        <a href="#/works" aria-current={onWorks ? "page" : undefined}>
          <Images size={22} aria-hidden="true" />
          Works
        </a>
        <a href="#/studio" aria-current={route.name === "studio" ? "page" : undefined}>
          <Sparkles size={22} aria-hidden="true" />
          Studio
        </a>
        <button type="button" className={styles.add} onClick={onAdd} aria-label="Add work">
          <span>
            <Plus size={24} aria-hidden="true" />
          </span>
        </button>
        <a href="#/tags" aria-current={route.name === "tags" ? "page" : undefined}>
          <Tag size={22} aria-hidden="true" />
          Tags
        </a>
        <a href="#/settings" aria-current={route.name === "settings" ? "page" : undefined}>
          <Settings size={22} aria-hidden="true" />
          Settings
        </a>
      </nav>
    </div>
  );
}

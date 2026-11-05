import { ExternalLink } from "lucide-react";
import { api } from "../lib/api";
import { useAutosave } from "../lib/autosave";
import { meStore, updateMeSite } from "../lib/me";
import { mergeSitePatch, type SitePatch } from "../lib/sitePatch";
import { useStore } from "../lib/store";
import type { Site } from "@senka/core/types";
import { SaveIndicator } from "../components/SaveIndicator";
import { AboutSection } from "./settings/AboutSection";
import { DetailsSection } from "./settings/DetailsSection";
import { LookSection } from "./settings/LookSection";
import { StorageSection } from "./settings/StorageSection";
import styles from "./Settings.module.css";

const SITES_ORIGIN = ((import.meta.env.VITE_SITES_ORIGIN as string | undefined) ?? "").replace(/\/$/, "");

export function Settings() {
  const me = useStore(meStore);
  const { autosave, state, reason } = useAutosave<SitePatch>(
    async (patch) => updateMeSite(await api<Site>("PATCH", "/api/site", patch)),
    undefined,
    mergeSitePatch,
  );
  if (me.status !== "ready") return null;
  const { site } = me;

  return (
    <div className={styles.page}>
      <header className={styles.heading}>
        <h1 className={styles.title}>Settings</h1>
        <SaveIndicator state={state} reason={reason} onRetry={() => autosave.retry()} />
      </header>
      <a className={styles.visit} href={`${SITES_ORIGIN}/${site.slug}`} target="_blank" rel="noopener noreferrer">
        Open my site <ExternalLink size={16} aria-hidden="true" />
      </a>

      <DetailsSection />
      <LookSection theme={site.theme} onPatch={(p) => autosave.queue(p)} />
      <AboutSection name={site.name} about={site.about} links={site.links} onPatch={(p) => autosave.queue(p)} />
      <StorageSection usedBytes={me.storageBytes} />
    </div>
  );
}

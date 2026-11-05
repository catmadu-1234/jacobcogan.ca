import { FACET_LABELS } from "@senka/core/types";
import { useFacetValues } from "../../lib/useFacetValues";
import { FacetValueRow } from "../../components/FacetValueRow";
import styles from "./CatalogueSection.module.css";

/** Every Medium, Project, Content and Exhibition in use, so a typo or a better name can be fixed everywhere at once. */
export function CatalogueSection() {
  const facets = useFacetValues();
  const groups = (["medium", "project", "content", "exhibition"] as const).filter((f) => facets.values[f].length > 0);

  return (
    <section className={styles.section} aria-labelledby="catalogue-values-heading">
      <h2 id="catalogue-values-heading" className={styles.heading}>
        Catalogue values
      </h2>
      <p className={styles.lede}>Tap a name to rename it on every work. Renaming to one you already have merges the two.</p>
      {facets.status === "error" ? (
        <p className={styles.lede}>
          We couldn't load these.{" "}
          <button type="button" className={styles.link} onClick={() => void facets.reload()}>
            Try again
          </button>
        </p>
      ) : null}
      {facets.status === "ready" && groups.length === 0 ? <p className={styles.lede}>Nothing yet. Values you add to a work show up here.</p> : null}
      {groups.map((facet) => (
        <div key={facet} className={styles.group}>
          <h3 className={styles.groupTitle}>{FACET_LABELS[facet]}</h3>
          <ul className={styles.list}>
            {facets.values[facet].map((v) => (
              <FacetValueRow key={v.id} value={v} findMergeTarget={facets.mergeTarget} onRename={(value, name) => void facets.rename(value, name)} />
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

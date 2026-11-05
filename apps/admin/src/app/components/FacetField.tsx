import type { Facet } from "@senka/core/types";
import { FACET_HELP } from "../lib/facetHelp";
import { InfoTip } from "./InfoTip";
import { TagInput } from "./TagInput";
import styles from "./FacetField.module.css";

interface Props {
  facet: Facet;
  label: string;
  /** What to type as an example, e.g. "Oil on linen". */
  example: string;
  values: string[];
  suggestions: string[];
  onChange: (values: string[]) => void;
}

/** One catalogue facet: its name, an "i" that explains it, and a tag box that takes several values. */
export function FacetField({ facet, label, example, values, suggestions, onChange }: Props) {
  return (
    <div className={styles.field}>
      <div className={styles.head}>
        <span className={styles.label}>{label}</span>
        <InfoTip label={label} text={FACET_HELP[facet]} />
      </div>
      <TagInput noun={label.toLowerCase()} example={example} tags={values} suggestions={suggestions} onChange={onChange} />
    </div>
  );
}

import styles from "./Hero.module.css";

interface Props {
  name: string;
  tagline: string;
  /** Works showing now. */
  count: number;
  /** Works in all; when more than `count`, a filter is on. */
  total?: number;
  years: string;
}

export function Hero({ name, tagline, count, total = count, years }: Props) {
  const noun = total === 1 ? "work" : "works";
  const amount = count === total ? `${count} ${noun}` : `${count} of ${total} ${noun}`;
  return (
    <section className={styles.hero}>
      <h1 className={styles.name}>{name}</h1>
      <div className={styles.foot}>
        {tagline ? <p className={styles.tagline}>{tagline}</p> : null}
        <p className={styles.facts}>
          <span data-result-count>{amount}</span>
          {years ? <span>{years}</span> : null}
        </p>
      </div>
    </section>
  );
}

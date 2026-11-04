import styles from "./RootPage.module.css";

interface Props {
  sites: Array<{ name: string; slug: string }>;
}

/** Shown at the bare shared address, which belongs to no single site. */
export function RootPage({ sites }: Props) {
  return (
    <div className="page">
      <main id="main" className={styles.main}>
        <h1 className={styles.title}>Portfolios</h1>
        <ul className={styles.list}>
          {sites.map((s) => (
            <li key={s.slug}>
              <a href={`/${s.slug}`}>{s.name}</a>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}

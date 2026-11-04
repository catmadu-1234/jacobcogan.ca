import styles from "./NotFoundPage.module.css";

interface Props {
  homeHref: string;
}

export function NotFoundPage({ homeHref }: Props) {
  return (
    <div className="page">
      <main id="main" className={styles.main}>
        <h1 className={styles.title}>This page doesn't exist.</h1>
        <a href={homeHref}>Back to the work</a>
      </main>
    </div>
  );
}

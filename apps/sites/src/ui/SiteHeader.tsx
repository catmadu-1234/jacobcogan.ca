import styles from "./SiteHeader.module.css";

interface Props {
  siteName: string;
  basePath: string;
  current: "work" | "about" | null;
}

export function SiteHeader({ siteName, basePath, current }: Props) {
  const home = basePath === "" ? "/" : basePath;
  return (
    <header className={styles.header}>
      <a className={styles.skip} href="#main">
        Skip to content
      </a>
      <a className={styles.name} href={home}>
        {siteName}
      </a>
      <nav className={styles.nav} aria-label="Main">
        <a href={home} aria-current={current === "work" ? "page" : undefined}>
          Work
        </a>
        <a href={`${basePath}/about`} aria-current={current === "about" ? "page" : undefined}>
          About
        </a>
      </nav>
    </header>
  );
}

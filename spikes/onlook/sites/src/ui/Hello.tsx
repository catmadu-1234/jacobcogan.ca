import styles from "./Hello.module.css";
export function Hello({ name }: { name: string }) {
  return (
    <header className={styles.header}>
      <a className={styles.name} href="/">{name}</a>
      <nav className={styles.nav}><a href="/work">Work</a><a href="/about">About</a></nav>
    </header>
  );
}

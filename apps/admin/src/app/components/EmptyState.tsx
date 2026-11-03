import type { ReactNode } from "react";
import { Button } from "./Button";
import styles from "./EmptyState.module.css";

interface Props {
  icon: ReactNode;
  title?: string;
  text: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon, title, text, actionLabel, onAction }: Props) {
  return (
    <section className={styles.empty}>
      <div className={styles.icon} aria-hidden="true">
        {icon}
      </div>
      {title ? <h2 className={styles.title}>{title}</h2> : null}
      <p className={styles.text}>{text}</p>
      {actionLabel && onAction ? <Button onClick={onAction}>{actionLabel}</Button> : null}
    </section>
  );
}

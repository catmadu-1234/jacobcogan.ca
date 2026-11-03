import type { ButtonHTMLAttributes } from "react";
import styles from "./Button.module.css";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
  busy?: boolean;
}

export function Button({ variant = "primary", busy = false, disabled, children, className, type = "button", ...rest }: Props) {
  const classes = [styles.button, styles[variant], busy ? styles.busy : "", className ?? ""].join(" ").trim();
  return (
    <button {...rest} type={type} className={classes} disabled={disabled || busy} aria-busy={busy || undefined}>
      {busy ? <span className={styles.spinner} aria-hidden="true" /> : null}
      {children}
    </button>
  );
}

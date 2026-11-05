import { useEffect, useId, useRef } from "react";
import { InfoTip } from "./InfoTip";
import styles from "./TextField.module.css";

interface Props {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  type?: "text" | "url";
  help?: string;
  /** Plain-language explanation shown behind a small "i" next to the label. */
  info?: string;
  inputMode?: "text" | "numeric";
  error?: string;
  required?: boolean;
  placeholder?: string;
  maxLength?: number;
}

export function TextField({ label, value, onChange, multiline, type = "text", help, info, inputMode, error, required, placeholder, maxLength }: Props) {
  const id = useId();
  const area = useRef<HTMLTextAreaElement>(null);

  // Textareas grow with their content instead of scrolling.
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value, multiline]);

  const describedBy = error ? `${id}-error` : help ? `${id}-help` : undefined;
  const common = {
    id,
    value,
    placeholder,
    maxLength,
    required,
    inputMode,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy,
    className: `${styles.input} ${error ? styles.invalid : ""}`,
  };

  return (
    <div className={styles.field}>
      <div className={styles.head}>
        <label htmlFor={id} className={styles.label}>
          {label}
          {required ? <span className={styles.required}> (required)</span> : null}
        </label>
        {info ? <InfoTip label={label} text={info} /> : null}
      </div>
      {multiline ? (
        <textarea {...common} ref={area} rows={3} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input {...common} type={type} onChange={(e) => onChange(e.target.value)} />
      )}
      {error ? (
        <p id={`${id}-error`} className={styles.error}>
          {error}
        </p>
      ) : help ? (
        <p id={`${id}-help`} className={styles.help}>
          {help}
        </p>
      ) : null}
    </div>
  );
}

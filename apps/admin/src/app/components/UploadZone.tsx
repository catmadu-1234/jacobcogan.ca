import { useRef, useState, type DragEvent } from "react";
import { ImagePlus } from "lucide-react";
import styles from "./UploadZone.module.css";

export const ACCEPT = "image/jpeg,image/png,image/webp,image/gif,image/avif,video/mp4,video/quicktime,video/webm";

interface Props {
  onFiles: (files: File[]) => void;
}

export function UploadZone({ onFiles }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  function onDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setOver(false);
    onFiles(Array.from(e.dataTransfer.files));
  }

  return (
    <label
      className={`${styles.zone} ${over ? styles.over : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
    >
      <ImagePlus size={24} aria-hidden="true" />
      <span>Add images or videos</span>
      <input
        ref={input}
        className={styles.file}
        type="file"
        multiple
        accept={ACCEPT}
        onChange={(e) => {
          onFiles(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />
    </label>
  );
}

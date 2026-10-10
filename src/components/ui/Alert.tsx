import type { ReactNode } from "react";
import styles from "./Alert.module.css";

type Tone = "info" | "warning" | "error" | "success";

export function Alert({ tone = "info", title, children }: { tone?: Tone; title?: string; children: ReactNode }) {
  return (
    <div className={`${styles.alert} ${styles[tone]}`} role={tone === "error" ? "alert" : "note"}>
      {title && <p className={styles.title}>{title}</p>}
      <div>{children}</div>
    </div>
  );
}

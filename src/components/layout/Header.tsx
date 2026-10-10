import { Link } from "react-router-dom";
import logoMontaigneFix from "../../assets/brand/logo-montaigne-fix.webp";
import logoMundana from "../../assets/brand/mundana-studio-header.webp";
import styles from "./Header.module.css";

export function Header() {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link to="/" className={styles.brand} aria-label="Montaigne Fix, ir al inicio">
          <img
            src={logoMontaigneFix}
            alt="Montaigne Fix — Reparaciones y mantenimiento integral"
            className={styles.logo}
            width={1000}
            height={300}
          />
        </Link>

        <a
          href="https://www.mundana.us/"
          target="_blank"
          rel="noopener noreferrer"
          className={styles.powered}
          aria-label="Powered by Mundana Studio (se abre en una pestaña nueva)"
        >
          <span className={styles.poweredText}>powered by</span>
          <img src={logoMundana} alt="" className={styles.mundana} width={480} height={68} />
        </a>
      </div>
    </header>
  );
}

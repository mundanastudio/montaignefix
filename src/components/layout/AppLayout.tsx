import { Outlet } from "react-router-dom";
import { Header } from "./Header";
import styles from "./AppLayout.module.css";

export function AppLayout() {
  return (
    <div className={styles.shell}>
      <a href="#contenido" className={styles.skip}>
        Saltar al contenido
      </a>
      <Header />
      <main id="contenido" className={styles.main} tabIndex={-1}>
        <Outlet />
      </main>
      <footer className={styles.footer}>
        <p>Colegio Montaigne · Grupo Montaigne</p>
      </footer>
    </div>
  );
}

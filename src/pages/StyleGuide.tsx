import { useState } from "react";
import { Alert } from "../components/ui/Alert";
import { PriorityBadge, StatusBadge, STATUSES } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input, Textarea } from "../components/ui/Field";
import { Modal } from "../components/ui/Modal";
import { Spinner } from "../components/ui/Spinner";
import styles from "./StyleGuide.module.css";

const SWATCHES = [
  { name: "Azul Mundana", token: "--mf-navy-700", hex: "#0c216e", dark: true },
  { name: "Dorado Mundana", token: "--mf-gold-500", hex: "#f0a21d" },
  { name: "Naranja hover", token: "--mf-gold-600", hex: "#ff8000" },
  { name: "Azul suave", token: "--mf-navy-300", hex: "#6e7aa8", dark: true },
  { name: "Texto", token: "--mf-gray-800", hex: "#333333", dark: true },
  { name: "Fondo", token: "--mf-gray-50", hex: "#fafaf9" },
];

function CheckIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function StyleGuide() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const fakeSubmit = () => {
    setLoading(true);
    window.setTimeout(() => {
      setLoading(false);
      setOpen(true);
    }, 900);
  };

  return (
    <div className={styles.page}>
      <header className={styles.intro}>
        <p className={styles.eyebrow}>Fase 0 · Guía visual</p>
        <h1>Componentes básicos</h1>
        <p className={styles.lead}>
          Página de muestra para validar la estética de Montaigne Fix con la identidad de Mundana Studio.
        </p>
      </header>

      <Card title="Colores" eyebrow="Tokens">
        <ul className={styles.swatches}>
          {SWATCHES.map((s) => (
            <li key={s.token} className={styles.swatch}>
              <span className={styles.chip} style={{ background: `var(${s.token})` }} />
              <span className={styles.swatchName}>{s.name}</span>
              <code className={styles.code}>
                {s.hex} · {s.token}
              </code>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Tipografía" eyebrow="Inter (web) · Helvetica Neue LT Std (informes)">
        <div className={styles.typeStack}>
          <h1>Título principal</h1>
          <h2>Título de sección</h2>
          <h3>Subtítulo</h3>
          <p>
            Texto normal a 16 px. Abre un parte en menos de un minuto: dinos qué hay que reparar y dónde, y el
            equipo de mantenimiento se encarga.
          </p>
          <p className={styles.muted}>Texto secundario para ayudas y metadatos.</p>
          <p className={styles.tagline}>Reparaciones &amp; mantenimiento integral</p>
        </div>
      </Card>

      <Card title="Botones" eyebrow="Mínimo 48 px de alto">
        <div className={styles.row}>
          <Button>Principal</Button>
          <Button variant="accent">Acento</Button>
          <Button variant="secondary">Secundario</Button>
          <Button variant="ghost">Discreto</Button>
          <Button variant="danger">Rechazar</Button>
        </div>
        <div className={styles.row}>
          <Button loading>Enviando…</Button>
          <Button disabled>Desactivado</Button>
        </div>
        <Button size="lg" fullWidth variant="accent">
          Botón grande a ancho completo (móvil)
        </Button>
      </Card>

      <Card title="Formulario" eyebrow="Campos e inputs">
        <form
          className={styles.form}
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            fakeSubmit();
          }}
        >
          <Input label="Nombre" required autoComplete="name" placeholder="Tu nombre y apellidos" />
          <Input
            label="Email"
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            defaultValue="profesor@grupomontaigne"
            error="Revisa el email: parece que falta algo (ej. nombre@grupomontaigne.com)."
          />
          <Input label="Lugar" required placeholder="Aula, planta, patio, auditorio, baños…" hint="Cuanto más concreto, antes lo encontramos." />
          <Textarea label="Observaciones adicionales" placeholder="Cualquier detalle que nos ayude" />
          <Alert tone="warning" title="Antes de hacer la foto">
            No fotografíes a alumnos ni a otras personas. Fotografía solo el desperfecto.
          </Alert>
          <Button type="submit" size="lg" fullWidth loading={loading}>
            {loading ? "Enviando…" : "Enviar parte (abre el popup)"}
          </Button>
        </form>
      </Card>

      <Card
        eyebrow="MF-0001 · hace 2 horas"
        title="Persiana rota que no baja"
        footer={
          <>
            <Button variant="secondary">Ver ficha</Button>
            <Button>Asignarme</Button>
          </>
        }
      >
        <div className={styles.row}>
          <PriorityBadge priority="P1" showLabel />
          <StatusBadge status="Nuevo" />
        </div>
        <dl className={styles.meta}>
          <div>
            <dt>Lugar</dt>
            <dd>Aula 2.º B, planta 1</dd>
          </div>
          <div>
            <dt>Solicitante</dt>
            <dd>María López</dd>
          </div>
        </dl>
      </Card>

      <Card title="Estados y prioridades" eyebrow="Etiquetas">
        <div className={styles.row}>
          {STATUSES.map((s) => (
            <StatusBadge key={s} status={s} />
          ))}
        </div>
        <div className={styles.row}>
          <PriorityBadge priority="P1" showLabel />
          <PriorityBadge priority="P2" showLabel />
          <PriorityBadge priority="P3" showLabel />
        </div>
      </Card>

      <Card title="Avisos y carga" eyebrow="Feedback">
        <Alert tone="error" title="No se ha podido enviar">
          Comprueba tu conexión e inténtalo de nuevo. Tus datos siguen en el formulario.
        </Alert>
        <Alert tone="success">Incidencia MF-0001 marcada como resuelta.</Alert>
        <Alert tone="info">Las fotos se comprimen antes de subirse.</Alert>
        <div className={styles.loadingRow}>
          <Spinner size={24} label="Cargando incidencias" />
          <span className={styles.muted}>Cargando incidencias…</span>
        </div>
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        icon={<CheckIcon />}
        title="¡Solicitud enviada!"
        actions={
          <Button size="lg" fullWidth onClick={() => setOpen(false)}>
            Entendido
          </Button>
        }
      >
        <p>
          Gracias, atenderemos tu solicitud lo antes posible. Recibirás un correo en tu email cuando esté
          solucionado.
        </p>
      </Modal>
    </div>
  );
}

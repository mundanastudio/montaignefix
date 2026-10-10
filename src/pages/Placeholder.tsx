import { Link } from "react-router-dom";
import { Card } from "../components/ui/Card";

export function Placeholder({ title, phase }: { title: string; phase?: string }) {
  return (
    <div style={{ maxWidth: "var(--content-max)", margin: "0 auto" }}>
      <Card eyebrow={phase ?? "Montaigne Fix"} title={title}>
        <p>{phase ? `Esta página se construirá en la ${phase}.` : "La dirección no existe."}</p>
        <p>
          <Link to="/muestra">Ver la guía visual de componentes</Link>
        </p>
      </Card>
    </div>
  );
}

# Plantillas de correo (Montaigne Fix)

Fuente de diseño: esta carpeta. Copia idéntica para las Edge Functions: `supabase/functions/_shared/email-templates/`. El empaquetado es `scripts/bundle-email-templates.mjs` → `email-bodies.ts`. No editar el diseño ni los textos de las plantillas.

| Archivo | Cuándo | Destinatario |
|---|---|---|
| `recibido` | Se abre un parte | Solicitante |
| `fran-nuevo` | Se abre un parte | Fran |
| `fran-resuelto` | Un técnico marca Resuelto | Fran |
| `cerrado` | Gestión cierra | Solicitante |
| `rechazado` | Gestión rechaza (con motivo) | Solicitante |

Duplicado no envía correo.

**Rechazado.** Asunto: `Sobre tu solicitud {{codigo}}: {{reparacion}}` (reparación a 60 caracteres). No uses la palabra «rechazada» en el asunto. `{{nombre}}` es solo el nombre de pila. `{{motivo}}` se escapa en HTML y los saltos de línea pasan a `<br>`; en el `.txt` va tal cual.

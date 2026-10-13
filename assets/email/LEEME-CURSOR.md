# Plantillas de correo (Montaigne Fix)

Fuente de diseño: esta carpeta. Copia idéntica para las Edge Functions: `supabase/functions/_shared/email-templates/`. El empaquetado es `scripts/bundle-email-templates.mjs` → `email-bodies.ts`. No editar el diseño ni los textos de las plantillas.

| Archivo | Cuándo | Destinatario |
|---|---|---|
| `recibido` | Se abre un parte | Solicitante |
| `fran-nuevo` | Se abre un parte | Fran |
| `fran-resuelto` | Un técnico marca Resuelto | Fran |
| `cerrado` | Gestión cierra | Solicitante (y cada email distinto de los avisos unidos, con los datos de su parte) |
| `rechazado` | Gestión rechaza (con motivo) | Solicitante |
| `duplicado` | Gestión une el aviso a un parte abierto | Solicitante del aviso unido. Si el email es el mismo que el del original, no se envía. |

**Duplicado.** Asunto: `Tu aviso {{codigo}} ya estaba registrado`. `{{nombre}}` es solo el nombre de pila. `{{codigo_original}}` es el parte abierto al que se une. No edites el HTML ni el texto.

**Fran-nuevo.** Hasta 3 fotos. Variables: `{{foto}}` (nº; vacío si no hay), `{{foto1}}` `{{foto2}}` `{{foto3}}` (`cid:foto-1` …), `{{foto_titulo}}` `{{foto_pie}}` `{{foto_txt}}`. Añadir fotos después al parte no reenvía este correo.

**Rechazado.** Asunto: `Sobre tu solicitud {{codigo}}: {{reparacion}}` (reparación a 60 caracteres). No uses la palabra «rechazada» en el asunto. `{{nombre}}` es solo el nombre de pila. `{{motivo}}` se escapa en HTML y los saltos de línea pasan a `<br>`; en el `.txt` va tal cual.

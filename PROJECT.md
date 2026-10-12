# Montaigne Fix — powered by Mundana Studio

> Documento maestro del proyecto. **Léelo entero al empezar cada fase** y no te saltes ninguna decisión de aquí. Si algo no está definido, pregunta antes de inventarlo. Al terminar cada fase, actualiza el checklist del final.

## 1. Qué es

Herramienta web para abrir y gestionar **partes de reparación física** en el Colegio Montaigne de Sevilla (Grupo Montaigne). Es la segunda herramienta de **Mundana Studio**, la rama tecnológica del grupo, y debe compartir su estética.

- Idioma de toda la interfaz, emails e informes: **español**.
- **Responsive / mobile-first**: el equipo de mantenimiento lo usará desde el móvil.
- UX muy sencilla: pocos campos, botones grandes, cero jerga.

## 2. Personas y roles

| Rol | Quién | Acceso |
|---|---|---|
| Solicitante | Profesores y trabajadores del colegio | Formulario abierto, sin login |
| Gerente / Admin | **Fran** (Francisco Flores, `Francisco.flores@grupomontaigne.com`) y **Curro** (`curromena89@gmail.com`) | Panel de gestión con **contraseña** (una por persona, para saber quién hizo cada cambio) |
| Equipo de mantenimiento | **Fran, Agustín, Andrés** | Panel del equipo con **PIN compartido** (4 dígitos; se puede pasar a 6) + selector "¿Quién eres?" |

- Fran es a la vez gerente y miembro del equipo (se le pueden asignar tareas).
- El PIN se introduce una vez por dispositivo y el nombre elegido se recuerda en ese dispositivo (con opción "Cambiar de persona").
- PIN y contraseñas **nunca** en el código ni en el repositorio: se guardan como hash en secretos del servidor y deben poder cambiarse sin tocar el código.

## 3. Páginas

### 3.1 Formulario público — `/`
Campos:
- Nombre (obligatorio)
- Email (obligatorio, validado; para avisarle cuando esté hecho)
- Reparación necesaria (obligatorio, texto)
- Lugar (obligatorio, **texto libre**: aula, planta, patio, auditorio, baños…)
- Foto (opcional, una; se puede hacer directamente con la cámara del móvil)
- Observaciones adicionales (opcional)
- Casilla RGPD obligatoria (ver sección 8)

Junto al campo de la foto, aviso visible: **"No fotografíes a alumnos ni a otras personas. Fotografía solo el desperfecto."**

Al enviar → popup: **"Gracias, atenderemos tu solicitud lo antes posible. Recibirás un correo en tu email cuando esté solucionado."**, y se le envía el email de acuse de recibo (sección 6) y el formulario se limpia.

El solicitante **no ve el estado** de su parte: solo recibe el email final.

### 3.2 Panel del gerente — `/gestion`
- Listado de todas las incidencias con filtros (estado, prioridad, asignado, fechas) y búsqueda por texto.
- Ficha de cada incidencia con todos los datos, la foto y el historial completo.
- Puede: asignar prioridad (P1/P2/P3), cambiar estado, asignar o reasignar a Fran/Agustín/Andrés, añadir **observaciones de gestión**, cerrar (Resuelto → Cerrado), reabrir, rechazar o marcar como duplicado.
- Al asignar se guarda la fecha de asignación (vía historial, sección 5).
- Sección **"Lista de la compra"** (ver 3.4), con un contador de artículos pendientes visible en la navegación del panel.

### 3.3 Panel del equipo — `/equipo`
- Pestañas: **"Mis tareas"**, **"Sin asignar"**, **"Todas"** (pendientes y cerradas).
- Ven todas las incidencias; **solo pueden modificar las que tienen asignadas**, y solo:
  - el estado (En curso, En espera, Resuelto),
  - sus **observaciones internas**.
- Pueden **asignarse** una incidencia sin asignar, **quitarse** una que tengan y **reasignarla** a otro compañero.
- Al marcar **Resuelto** se guarda la fecha de resolución y se avisa a Fran.
- En cada tarea asignada: caja **"Materiales que hay que comprar"** con botón **Enviar** (ver 3.4).

### 3.4 Lista de la compra

**Desde el panel del equipo** (solo en tareas asignadas a la persona seleccionada):
- Caja de texto "Materiales que hay que comprar" + botón **Enviar**.
- **Cada línea del texto se convierte en un artículo** independiente (p. ej. "silicona blanca" y "2 bisagras 35 mm" en líneas separadas = 2 artículos). Se ignoran líneas vacías y se recortan espacios. Límite razonable de longitud por línea (p. ej. 200 caracteres).
- Tras enviar, la caja se vacía y debajo aparece la lista de materiales pedidos para esa tarea con su estado: **Pendiente** o **Comprado (fecha)**.
- El técnico puede **borrar un artículo suyo mientras esté Pendiente** (para corregir errores). Una vez comprado no se puede tocar.
- Es independiente del estado de la tarea: no la cambia automáticamente. Se sugiere (sin obligar) pasar la tarea a **En espera** si no puede avanzar sin el material.

**Desde el panel del gerente — sección "Lista de la compra":**
- Muestra todos los artículos **pendientes**, agrupados por incidencia: código MF-XXXX, reparación y lugar, y para cada artículo quién lo pidió y cuándo. Enlace a la ficha de la incidencia.
- Fran puede añadir artículos también desde la ficha de cualquier incidencia.
- Fran selecciona uno o varios artículos (casillas, con "seleccionar todos" por incidencia) y pulsa **Marcar como comprado**.
- **Popup de confirmación** (modal propio de la app, no `confirm()` del navegador): *"Vas a marcar N artículo(s) como comprados. Al aceptar, desaparecerán de la lista de la compra."* Botones **Cancelar** / **Aceptar**.
- Al aceptar, los artículos **desaparecen de la lista** pero **no se borran** de la base de datos: se marcan como comprados con fecha y autor (borrado lógico). Así el técnico ve que ya está comprado y queda en el historial e informes.
- Vista secundaria **"Comprado recientemente"** (últimos 30 días) para deshacer un error: "Volver a pendiente".

**Sin emails nuevos**: la lista de la compra no envía avisos (se mantienen solo los emails de la sección 6). Aparece en el informe semanal (sección 7).

## 4. Estados y prioridades

**Estados:** `Nuevo` → `Asignado` → `En curso` → `En espera` (material/proveedor) → `Resuelto` → `Cerrado`. Además: `Rechazado` y `Duplicado`.

| Acción | Gerente | Técnico (solo sus tareas) |
|---|---|---|
| Asignar / reasignar | ✅ | ✅ (asignarse, quitarse, pasarla a otro) |
| Prioridad | ✅ | ❌ |
| En curso / En espera / Resuelto | ✅ | ✅ |
| Cerrar / Reabrir / Rechazar / Duplicado | ✅ | ❌ |
| Añadir materiales a la lista de la compra | ✅ (cualquier incidencia) | ✅ (solo sus tareas) |
| Borrar un material pendiente | ✅ | ✅ (solo los que pidió él) |
| Marcar materiales como comprados / volver a pendiente | ✅ | ❌ |

Reabrir una incidencia cerrada la devuelve a `Asignado` (si tiene técnico) o `Nuevo`.

**Prioridades:**
- **P1** — Urgente o de seguridad: hoy.
- **P2** — Importante: esta semana.
- **P3** — Cuando se pueda.

Cada incidencia tiene un código legible: **MF-0001, MF-0002…**

## 5. Datos (Supabase)

Proyecto Supabase existente del usuario. Si ya aloja otra herramienta, crear todo en un **schema propio `montaigne_fix`**.

Tablas mínimas (ajusta nombres si lo ves mejor, pero justifícalo):
- `tickets`: id, código MF-XXXX, nombre y email del solicitante, reparación, lugar, observaciones del solicitante, ruta de la foto, estado, prioridad, técnico asignado, fechas (`created_at`, `assigned_at`, `resolved_at`, `closed_at`, `updated_at`).
- `ticket_events`: **historial** de todo cambio (quién, qué, valor anterior, valor nuevo, cuándo). Fuente de verdad para fechas y para los informes.
- `ticket_notes`: observaciones con tipo (`gestion` | `interna`), autor y fecha. Las observaciones del solicitante van en `tickets`.
- `staff`: Fran, Agustín, Andrés (y Curro como admin), con nombre, email y rol.
- `shopping_items` (lista de la compra), un registro por artículo:
  - `id`
  - `ticket_id` → `tickets.id` (obligatorio, `on delete cascade` para que el borrado a 12 meses se lleve sus materiales)
  - `description` (texto, no vacío, ≤ 200 caracteres)
  - `status`: enum `pendiente` | `comprado`
  - `requested_by` → `staff.id`, `created_at`
  - `purchased_by` → `staff.id` (nullable), `purchased_at` (nullable)
  - Restricción: si `status = 'comprado'` entonces `purchased_at` y `purchased_by` no son nulos; si `pendiente`, ambos nulos.
  - Índices: `(status, created_at)` para la lista de Fran y `(ticket_id)` para la ficha.
  - Cada alta, compra, vuelta a pendiente o borrado se registra en `ticket_events` (tipo `material_solicitado`, `material_comprado`, `material_repuesto`, `material_borrado`).
  - El borrado de un artículo pendiente sí es físico (era un error); el resto es borrado lógico.

**Fotos:** Supabase Storage, bucket **privado**. Comprimir en el navegador antes de subir (máx. ~1600 px de lado, JPEG ~0,7, objetivo < 500 KB). En la base de datos solo se guarda la ruta. Se muestran en los paneles con URLs firmadas temporales. **Nunca base64 en la base de datos.**

**Seguridad (obligatorio):**
- RLS activado en **todas** las tablas y en el bucket.
- El navegador **no puede leer ni escribir directamente** ninguna tabla. Todo pasa por **Supabase Edge Functions** que usan la service role key (que nunca llega al navegador):
  - `create-ticket` (público): valida, sube la foto, crea el parte y avisa a Fran.
  - `staff-*` (requiere token de sesión del PIN + persona seleccionada). Incluye `staff-add-materials` (comprueba que la tarea está asignada a quien envía; divide por líneas e inserta todo en una transacción) y `staff-delete-material` (solo pendientes y pedidos por él).
  - `admin-*` (requiere token de sesión de la contraseña). Incluye `admin-shopping-list`, `admin-add-materials`, `admin-mark-purchased` (recibe una lista de ids; solo actualiza los que siguen pendientes, en una transacción, y devuelve cuántos cambió) y `admin-unmark-purchased`.
- PIN y contraseñas validados en el servidor con hash; sesión con token firmado y caducidad (p. ej. 30 días equipo, 7 días gerente).
- Límite básico de intentos de PIN/contraseña.
- Todas las migraciones como **archivos SQL versionados** en `supabase/migrations/`. El usuario las ejecuta (o se aplican con la CLI de Supabase). Nada creado "a mano" sin migración.

## 6. Emails

Remitente: **`soportemundanastudio@mundana.us`** por SMTP. Si no es viable, alternativa: **`soportestudiozero@gmail.com`** (Gmail + contraseña de aplicación). El remitente y las credenciales SMTP van en secretos/variables de entorno, para poder cambiar de uno a otro sin tocar código.

Solo se envían estos emails:

| Momento | Destinatario | Contenido |
|---|---|---|
| Se abre un parte | Solicitante | Acuse de recibo: "ya estamos en ello", con el código MF-XXXX |
| Se abre un parte | Fran | Todos los datos + la foto (incrustada y adjunta) |
| Un técnico marca **Resuelto** | Fran | Aviso para que lo revise y lo cierre |
| Fran marca **Cerrado** | Solicitante | "Tu solicitud MF-XXXX (reparación, lugar) ya está solucionada. Gracias." |
| Miércoles 8:00 | Fran | Informe semanal |
| Anual (ver 8) | Fran y Curro | Informe anual |

Las plantillas HTML y de texto ya están diseñadas en la carpeta `emails/` (recibido, fran-nuevo, fran-resuelto, cerrado). Usarlas tal cual; ver `emails/LEEME-CURSOR.md`.

## 7. Informes

**Semanal — todos los miércoles a las 8:00 (hora de Madrid, respetando el cambio de hora):**
- Email a Fran con una **tabla** de lo esencial: resueltas/cerradas en la semana y pendientes (código, reparación, lugar, prioridad, estado, asignado, fechas).
- Bloque **"Pendiente de comprar"** en el email: artículos pendientes con incidencia, quién lo pidió y desde cuándo.
- **PDF adjunto** con el detalle completo de cada incidencia: fechas, estado, prioridad, asignado, todas las observaciones, materiales (pendientes y comprados) e historial.
- Programado con `pg_cron` en Supabase llamando a una Edge Function (o GitHub Actions si es más fiable). Todo en plan gratuito.

**Anual — 1 de julio (fin de curso):**
- Email + PDF a Fran y Curro con **todas las incidencias Resueltas/Cerradas** de los 12 meses anteriores.

**Estética de informes y PDF:** el arte del portfolio adjunto (imagen corporativa de Mundana / Grupo Montaigne) + logo de Montaigne Fix.

## 8. RGPD y conservación

- Casilla obligatoria en el formulario con texto breve: responsable (Grupo Montaigne), finalidad (gestionar la reparación y avisar al solicitante), conservación (12 meses) y contacto para ejercer derechos. Dejar el texto en un archivo fácil de editar: **el texto legal definitivo lo dará el colegio**.
- Aviso de no fotografiar personas (ver 3.1).
- **Borrado automático**: solo las incidencias **resueltas** o **cerradas** hace más de 12 meses. Se borran con sus fotos, notas, materiales, historial y el registro de correos de ese parte (destinatario y asunto). No se borran las abiertas, sin asignar, en curso, en espera, rechazadas ni duplicadas, aunque haya pasado un año. El borrado se ejecuta **después** de un informe anual enviado bien, así ninguna se borra sin haber salido en un informe. Si el informe anual falla, se avisa a Curro y no se borra nada nuevo hasta que el informe salga.
- Las IPs de intentos de acceso y de los topes del formulario se guardan como mucho 2 días.
- `noindex` y `robots.txt` para que no aparezca en buscadores.

## 9. Diseño

- Identidad visual de **Mundana Studio**: extraer colores, tipografía y estilo de https://www.mundana.us/ y de los archivos adjuntos (logo y arte de Mundana, fuente).
- Logo propio de la herramienta: **Montaigne Fix** (adjunto), con la coletilla **"powered by Mundana Studio"**.
- Definir los colores y tipografías como tokens (variables CSS) en un único sitio.
- Mobile-first, accesible (contraste, tamaños de toque ≥ 44 px), estados de carga y error claros.

## 10. Stack y despliegue

- Código en **GitHub**.
- Frontend **estático** (React + Vite + TypeScript o similar). Toda la lógica de servidor en **Supabase Edge Functions**. Así el frontend no guarda ningún secreto y puede publicarse en cualquier hosting estático.
- Hosting: **Cloudflare Pages** (`https://montaignefix.pages.dev`) y **Vercel** (`https://montaignefix.vercel.app`), ambos desde el mismo repo. El build es `npm run build`, salida `dist`. En Cloudflare la SPA la resuelve Pages. En Vercel, `vercel.json` reescribe a `index.html` cualquier ruta que no sea un archivo, excepto `/assets/` y `/email/` (ahí un archivo que no exista da 404). El plan gratuito de Vercel es solo para uso personal no comercial. Los pasos de Cloudflare están en `README.md`.
- Carpeta local: `C:\Users\rs07313\Desktop\LLM Projects\Montaigne Fix`, añadida al workspace "LLM Projects".
- `.env.example` documentado; ningún secreto en el repo.
- El usuario ya tiene un GitHub Action que evita que Supabase pause el proyecto por inactividad.

## 11. Pendiente (no hacer ahora)

Siguen abiertos después de la Fase 8:

- Captcha en el formulario (se confía en que la URL sea interna).
- Texto legal RGPD definitivo del colegio.

## 12. Checklist de fases

- [ ] Fase 0 — Setup, diseño y tokens
- [ ] Fase 1 — Base de datos, seguridad y storage
- [ ] Fase 2 — Formulario público
- [ ] Fase 3 — Accesos (PIN equipo y contraseña gerente)
- [ ] Fase 4 — Panel del gerente (incluye lista de la compra)
- [ ] Fase 5 — Panel del equipo (incluye pedir materiales)
- [ ] Fase 6 — Emails
- [x] Fase 7 — Informes semanal y anual + borrado a 12 meses
- [x] Fase 8 — Pruebas, revisión de seguridad y despliegue

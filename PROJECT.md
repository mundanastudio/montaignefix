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
| Equipo de mantenimiento | **Fran, Agustín, Andrés** | Panel del equipo con **PIN de 4 dígitos** compartido + selector "¿Quién eres?" |

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

Al enviar → popup: **"Gracias, atenderemos tu solicitud lo antes posible. Recibirás un correo en tu email cuando esté solucionado."** y el formulario se limpia.

El solicitante **no ve el estado** de su parte: solo recibe el email final.

### 3.2 Panel del gerente — `/gestion`
- Listado de todas las incidencias con filtros (estado, prioridad, asignado, fechas) y búsqueda por texto.
- Ficha de cada incidencia con todos los datos, la foto y el historial completo.
- Puede: asignar prioridad (P1/P2/P3), cambiar estado, asignar o reasignar a Fran/Agustín/Andrés, añadir **observaciones de gestión**, cerrar (Resuelto → Cerrado), reabrir, rechazar o marcar como duplicado.
- Al asignar se guarda la fecha de asignación (vía historial, sección 5).

### 3.3 Panel del equipo — `/equipo`
- Pestañas: **"Mis tareas"**, **"Sin asignar"**, **"Todas"** (pendientes y cerradas).
- Ven todas las incidencias; **solo pueden modificar las que tienen asignadas**, y solo:
  - el estado (En curso, En espera, Resuelto),
  - sus **observaciones internas**.
- Pueden **asignarse** una incidencia sin asignar, **quitarse** una que tengan y **reasignarla** a otro compañero.
- Al marcar **Resuelto** se guarda la fecha de resolución y se avisa a Fran.

## 4. Estados y prioridades

**Estados:** `Nuevo` → `Asignado` → `En curso` → `En espera` (material/proveedor) → `Resuelto` → `Cerrado`. Además: `Rechazado` y `Duplicado`.

| Acción | Gerente | Técnico (solo sus tareas) |
|---|---|---|
| Asignar / reasignar | ✅ | ✅ (asignarse, quitarse, pasarla a otro) |
| Prioridad | ✅ | ❌ |
| En curso / En espera / Resuelto | ✅ | ✅ |
| Cerrar / Reabrir / Rechazar / Duplicado | ✅ | ❌ |

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

**Decisiones de la Fase 1:**
- Columnas en inglés; valores de los enums en español (`nuevo`, `en_curso`…).
- `priority` vacía significa "sin priorizar" hasta que el gerente la pone.
- `staff` usa las marcas `is_manager` / `is_technician` (Fran tiene las dos). Agustín y Andrés no tienen email: Fran les avisa por teléfono.
- Los triggers fijan el estado al asignar, quitar o reabrir (`nuevo` ↔ `asignado`). `closed_at` también se rellena en `rechazado` y `duplicado`.
- El actor de cada cambio se indica con `montaigne_fix.set_actor()` dentro de la misma transacción.
- El historial y las notas no se pueden editar.
- Bucket: `montaigne-fix-fotos`.

**Fotos:** Supabase Storage, bucket **privado**. Comprimir en el navegador antes de subir (máx. ~1600 px de lado, JPEG ~0,7, objetivo < 500 KB). En la base de datos solo se guarda la ruta. Se muestran en los paneles con URLs firmadas temporales. **Nunca base64 en la base de datos.**

**Seguridad (obligatorio):**
- RLS activado en **todas** las tablas y en el bucket.
- El navegador **no puede leer ni escribir directamente** ninguna tabla. Todo pasa por **Supabase Edge Functions** que usan la service role key (que nunca llega al navegador):
  - `create-ticket` (público): valida, sube la foto, crea el parte y avisa a Fran.
  - `staff-*` (requiere token de sesión del PIN + persona seleccionada).
  - `admin-*` (requiere token de sesión de la contraseña).
- PIN y contraseñas validados en el servidor con hash; sesión con token firmado y caducidad (p. ej. 30 días equipo, 7 días gerente).
- Límite básico de intentos de PIN/contraseña.
- Todas las migraciones como **archivos SQL versionados** en `supabase/migrations/`. El usuario las ejecuta (o se aplican con la CLI de Supabase). Nada creado "a mano" sin migración.

## 6. Emails

Remitente: **`soportemundanastudio@mundana.us`** por SMTP. Si no es viable, alternativa: **`soportestudiozero@gmail.com`** (Gmail + contraseña de aplicación). El remitente y las credenciales SMTP van en secretos/variables de entorno, para poder cambiar de uno a otro sin tocar código.

Solo se envían estos emails:

| Momento | Destinatario | Contenido |
|---|---|---|
| Se abre un parte | Fran | Todos los datos + la foto adjunta |
| Un técnico marca **Resuelto** | Fran | Aviso para que lo revise y lo cierre |
| Fran marca **Cerrado** | Solicitante | "Tu solicitud MF-XXXX (reparación, lugar) ya está solucionada. Gracias." |
| Miércoles 8:00 | Fran | Informe semanal |
| Anual (ver 8) | Fran y Curro | Informe anual |

Plantillas HTML sencillas con la imagen de marca, legibles en móvil.

## 7. Informes

**Semanal — todos los miércoles a las 8:00 (hora de Madrid, respetando el cambio de hora):**
- Email a Fran con una **tabla** de lo esencial: resueltas/cerradas en la semana y pendientes (código, reparación, lugar, prioridad, estado, asignado, fechas).
- **PDF adjunto** con el detalle completo de cada incidencia: fechas, estado, prioridad, asignado, todas las observaciones e historial.
- Programado con `pg_cron` en Supabase llamando a una Edge Function (o GitHub Actions si es más fiable). Todo en plan gratuito.

**Anual — 1 de julio (fin de curso):**
- Email + PDF a Fran y Curro con **todas las incidencias Resueltas/Cerradas** de los 12 meses anteriores.

**Estética de informes y PDF:** el arte del portfolio adjunto (imagen corporativa de Mundana / Grupo Montaigne) + logo de Montaigne Fix.

## 8. RGPD y conservación

- Casilla obligatoria en el formulario con texto breve: responsable (Grupo Montaigne), finalidad (gestionar la reparación y avisar al solicitante), conservación (12 meses) y contacto para ejercer derechos. Dejar el texto en un archivo fácil de editar: **el texto legal definitivo lo dará el colegio**.
- Aviso de no fotografiar personas (ver 3.1).
- **Borrado automático**: incidencias cerradas, resueltas, rechazadas o duplicadas hace más de 12 meses → se borran con sus fotos, notas e historial. Se ejecuta **después** del informe anual, así ninguna se borra sin haber salido en un informe.
- `noindex` y `robots.txt` para que no aparezca en buscadores.

## 9. Diseño

- Identidad visual de **Mundana Studio**: extraer colores, tipografía y estilo de https://www.mundana.us/ y de los archivos adjuntos (logo y arte de Mundana, fuente).
- Logo propio de la herramienta: **Montaigne Fix** (adjunto), con la coletilla **"powered by Mundana Studio"**.
- Definir los colores y tipografías como tokens (variables CSS) en un único sitio.
- Mobile-first, accesible (contraste, tamaños de toque ≥ 44 px), estados de carga y error claros.
- **Decisiones de la Fase 0:**
  - Los tokens viven en `src/styles/tokens.css`. Colores corporativos: azul `#0c216e` (Pantone 662 C) y dorado `#f0a21d` (Pantone 137 C).
  - Helvetica Neue LT Std es comercial: la web usa **Inter** autoalojada y Helvetica queda solo para los informes PDF. Está fuera de git, en `assets/fonts/helvetica-neue/`.
  - El logo de Mundana va en la cabecera, discreto: "powered by" y el logo en grises, que recupera el color al pasar el ratón.
  - Arte de emails e informes: logo de Grupo Montaigne + colores de Mundana.
  - La guía visual está en `/muestra`.

## 10. Stack y despliegue

- Código en **GitHub**.
- Frontend **estático** (React + Vite + TypeScript o similar). Toda la lógica de servidor en **Supabase Edge Functions**. Así el frontend no guarda ningún secreto y puede publicarse en cualquier hosting estático.
- Hosting: **Cloudflare Pages** conectado al repo de GitHub (gratis, permite uso por organizaciones, no se "duerme"). Alternativa: Vercel (su plan gratuito es solo para uso personal no comercial).
- Carpeta local: `C:\Users\rs07313\Desktop\LLM Projects\Montaigne Fix`, añadida al workspace "LLM Projects".
- `.env.example` documentado; ningún secreto en el repo.
- El usuario ya tiene un GitHub Action que evita que Supabase pause el proyecto por inactividad.

## 11. Pendiente (no hacer ahora)

- Captcha en el formulario (se confía en que la URL sea interna).
- Texto legal RGPD definitivo del colegio.

## 12. Checklist de fases

- [x] Fase 0 — Setup, diseño y tokens
- [x] Fase 1 — Base de datos, seguridad y storage
- [ ] Fase 2 — Formulario público
- [ ] Fase 3 — Accesos (PIN equipo y contraseña gerente)
- [ ] Fase 4 — Panel del gerente
- [ ] Fase 5 — Panel del equipo
- [ ] Fase 6 — Emails
- [ ] Fase 7 — Informes semanal y anual + borrado a 12 meses
- [ ] Fase 8 — Pruebas, revisión de seguridad y despliegue

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
| Gerente / Admin | **Fran** (Francisco Flores, `Francisco.flores@grupomontaigne.com`), **Curro** (`curromena89@gmail.com`) y **Carlos** (`carlosjperezfernandez@gmail.com`) | Panel de gestión con **contraseña** (una por persona, para saber quién hizo cada cambio) |
| Equipo de mantenimiento | **Fran, Agustín, Andrés** | Panel del equipo con **PIN compartido** (4 dígitos; se puede pasar a 6) + selector "¿Quién eres?" |

- Fran es a la vez gerente y miembro del equipo (se le pueden asignar tareas).
- El PIN se introduce una vez por dispositivo y el nombre elegido se recuerda en ese dispositivo (con opción "Cambiar de persona").
- PIN y contraseñas **nunca** en el código ni en el repositorio: se guardan como hash en secretos del servidor y deben poder cambiarse sin tocar el código.

## 3. Páginas

### 3.1 Formulario público — `/`
Campos:
- Nombre (obligatorio)
- Email corporativo (obligatorio). Dominios exactos: `grupomontaigne.com`, `grupomontaignesevilla.com`, `colegiomontaignesevilla.com` y `mundana.us` (sin distinguir mayúsculas; se recortan espacios). Excepciones de Gmail (solo estas, no cualquier Gmail): `curromena89@gmail.com`, `andrescanorodriguez@gmail.com`, `agumasero@gmail.com`, `patriciacastilloorozco33@gmail.com`, `susanacrespomarquez@gmail.com`, `remelucia78@gmail.com`, `16.11.96.maria@gmail.com` y `scmary97@gmail.com`. Si no vale: «Debes utilizar un correo corporativo del Grupo Montaigne». Se guarda y se cuenta el tope de 3 partes / 24 h con el email ya normalizado, salvo `andrescanorodriguez@gmail.com` y `agumasero@gmail.com` (sin tope) y esos cinco Gmail de Patricia, Susana, Reme, María y Mary (10 / 24 h; no cuentan para el tope de red). Al llegar al tope: «Debes esperar 24h para poder abrir un parte nuevo».
- Reparación necesaria (obligatorio, texto)
- Lugar (obligatorio, **texto libre**: aula, planta, patio, auditorio, baños…)
- Fotos (opcional, hasta 3). Dos botones: **Hacer foto** (cámara trasera) y **Elegir de la galería** (varias a la vez). Miniaturas con **Quitar**. Si elige más de las que caben, aviso y se quedan las primeras.
- Observaciones adicionales (opcional)
- Casilla RGPD obligatoria (ver sección 8)

Junto al campo de las fotos, aviso visible: **"No fotografíes a alumnos ni a otras personas. Fotografía solo el desperfecto."**

Al enviar → popup: **"Gracias, atenderemos tu solicitud lo antes posible. Recibirás un correo en tu email cuando esté solucionado."**, y se le envía el email de acuse de recibo (sección 6) y el formulario se limpia.

El solicitante **no ve el estado** de su parte: solo recibe el email final.

### 3.2 Panel del gerente — `/gestion`
- Listado con tres pestañas, como en Equipo: **Abiertas**, **Resueltas** y **Cerradas** (con el recuento). Al entrar se ven las **Abiertas**: cualquier estado salvo Resuelto, Duplicado, Cerrado y Rechazado. Un duplicado no aparece en el listado mientras sigue en Duplicado; cuando el original se cierra y el unido pasa a Cerrado, sale en **Cerradas**. **Resueltas** solo las resueltas. **Cerradas** incluye Cerrado y Rechazado. Filtros de prioridad y asignado. En Abiertas el orden es prioridad (P1 → P3), luego estado (Nuevo primero); sin prioridad, código ascendente. Resueltas y Cerradas, código descendente. Si está en Asignado, el chip muestra el nombre del técnico con fondo morado, no el texto «Asignado».
- Ficha de cada incidencia con todos los datos, la galería de fotos (miniaturas, visor a pantalla, deslizar / flechas) y el historial completo.
- Puede añadir fotos (hasta 10 por parte, también si está cerrado) y borrar cualquiera, incluidas las del solicitante y las de un técnico.
- Puede: asignar prioridad (P1/P2/P3) o quitarla pulsando otra vez la P activa, cambiar estado (En curso, En espera, Resuelto; pulsar otra vez la marcada vuelve a Asignado), asignar o reasignar a Fran, Agustín, Andrés o a un **equipo** (Fran+Agustín, Fran+Andrés, Agustín+Andrés, Fran+Agustín+Andrés), añadir **observaciones de gestión**, cerrar (desde cualquier estado abierto, sin pasar por Resuelto), reabrir, rechazar (con motivo obligatorio de 10–500 caracteres, que recibe el solicitante por email) o marcar como duplicado. Si hay técnico, el chip de estado va primero y el morado con el nombre (o combo) no se pierde al cambiar de estado.
- **Duplicado**: hay que elegir un parte **abierto** (buscador: código, reparación, lugar). No se une a sí mismo ni a uno cerrado, rechazado o ya duplicado. En la ficha unida: «Unido al parte MF-XXXX». En la original: «Avisos unidos». Al **cerrar** el original, los avisos unidos también pasan a Cerrado. Al **rechazar** el original, el motivo llega también a quienes abrieron los avisos unidos.
- **Quitar duplicado** (no Reabrir): vuelve al estado que tenía, con el mismo técnico y prioridad. Se borra la relación; el historial se queda. Si ya salió el email, no se retira. Reabrir un duplicado no vale.
- Al asignar se guarda la fecha de asignación (vía historial, sección 5).
- Sección **"Lista de la compra"** (ver 3.4), con un contador de artículos pendientes visible en la navegación del panel.

### 3.3 Panel del equipo — `/equipo`
- Pestañas: **"Mis tareas"**, **"Sin asignar"**, **"Todas"**. **Mis tareas** no incluye Cerrado. **Todas** son partes abiertos (de cualquiera) más las **cerradas que tenía asignadas ese técnico** (o un combo suyo); esas cerradas van al final. No salen Resuelto, Rechazado ni Duplicado. Los **duplicados no salen** en ninguna pestaña ni en los contadores. En las tarjetas, chip morado con la persona o el equipo asignado. La ficha por URL sigue abierta, solo lectura si no es suya.
- Ven todas las incidencias (salvo duplicados en el listado); **solo pueden modificar las que tienen asignadas**, y solo:
  - el estado (En curso, En espera, Resuelto; pulsar otra vez la marcada vuelve a Asignado),
  - sus **observaciones internas**.
- Pueden **asignarse** una incidencia sin asignar, **quitarse** una suya (también un combo del que forman parte) y **asignarla o pasarla** a Fran, Agustín, Andrés o un equipo. Los combos no aparecen en el PIN. Si Gestión o un compañero asignó un combo, sale en **Mis tareas** de cada miembro.
- Al marcar **Resuelto** se guarda la fecha de resolución y se avisa a Fran.
- **Fotos**: pueden añadir (hasta 10 por parte, también si está cerrado). Solo pueden borrar las que han subido ellos. Las del solicitante las borra Gestión. Desde `/equipo`, Fran tampoco borra las de otro.
- **Materiales** (ver 3.4): cualquier técnico puede añadir, editar y borrar artículos pendientes en **cualquier** parte abierto. En **Cerrado**, **Rechazado** o **Duplicado** el equipo solo los ve; no hay botones y el servidor rechaza cambios. Marcar comprado / volver a pendiente es solo de Gestión.

### 3.4 Lista de la compra

**Desde la ficha** (Gestión y Equipo), debajo de los datos del parte, una sola columna:
- Lista con descripción, quién lo pidió, fecha y estado **Pendiente** o **Comprado** (con fecha). Vacío: «Sin materiales. Pulsa + para añadir uno.»
- Botones de icono (lápiz / papelera, ≥ 44 px, con `aria-label`) para editar y borrar un artículo **pendiente**. Edición en la misma línea (Guardar / Cancelar, Enter / Escape). Borrar pide confirmación: *¿Borrar «silicona blanca»?*
- **+ Añadir material**: una línea = un artículo; al pegar varias líneas se crean varios (vacías se ignoran, máximo 200 caracteres por línea, 40 de una vez).
- **Gestión** puede marcar como comprado (el mismo modal que la lista de la compra) y **Volver a pendiente**.
- En **Cerrado / Rechazado / Duplicado** el equipo no ve esos botones; Gestión sí puede seguir añadiendo, editando y borrando.
- Si se edita o borra un artículo que entretanto se ha comprado o ya no existe, el servidor responde *«Este material ya se ha comprado o se ha borrado. Recarga la ficha.»* y la pantalla se actualiza.
- Es independiente del estado de la tarea: no la cambia automáticamente. Se sugiere (sin obligar) pasar la tarea a **En espera** si no puede avanzar sin el material.

**Desde el panel del gerente — sección "Lista de la compra":**
- Muestra todos los artículos **pendientes**, agrupados por incidencia: código MF-XXXX, reparación y lugar, y para cada artículo quién lo pidió y cuándo. Enlace a la ficha de la incidencia.
- Fran puede añadir, editar, borrar y marcar comprados también desde la ficha de cualquier incidencia.
- Fran selecciona uno o varios artículos (casillas, con "seleccionar todos" por incidencia) y pulsa **Marcar como comprado**.
- **Popup de confirmación** (modal propio de la app, no `confirm()` del navegador): *"Vas a marcar N artículo(s) como comprados. Al aceptar, desaparecerán de la lista de la compra."* Botones **Cancelar** / **Aceptar**.
- Al aceptar, los artículos **desaparecen de la lista** pero **no se borran** de la base de datos: se marcan como comprados con fecha y autor (borrado lógico). Así el técnico ve que ya está comprado y queda en el historial e informes.
- Vista secundaria **"Comprado recientemente"** (últimos 30 días) para deshacer un error: "Volver a pendiente".

**Sin emails nuevos**: la lista de la compra no envía avisos (se mantienen solo los emails de la sección 6). Aparece en el informe semanal (sección 7).

## 4. Estados y prioridades

**Estados:** `Nuevo` → `Asignado` → `En curso` → `En espera` (material/proveedor) → `Resuelto` → `Cerrado`. Además: `Rechazado` y `Duplicado`.

| Acción | Gerente | Técnico |
|---|---|---|
| Asignar / reasignar | ✅ | ✅ (asignarse, quitarse, pasarla a otro; solo sus tareas) |
| Prioridad | ✅ | ❌ |
| En curso / En espera / Resuelto | ✅ | ✅ (solo sus tareas) |
| Cerrar / Reabrir / Rechazar / Duplicado | ✅ | ❌ |
| Añadir / editar / borrar materiales | ✅ (cualquier incidencia, también cerrada) | ✅ (cualquier incidencia abierta; en Cerrado / Rechazado / Duplicado solo lectura) |
| Marcar materiales como comprados / volver a pendiente | ✅ | ❌ |

Reabrir una incidencia cerrada o rechazada la devuelve a `Asignado` (si tiene técnico) o `Nuevo`. Quitar duplicado la deja como estaba (no usa Reabrir).

**Prioridades:**
- **P1** — Urgente o de seguridad: hoy.
- **P2** — Importante: esta semana.
- **P3** — Cuando se pueda.

Cada incidencia tiene un código legible: **MF-0001, MF-0002…**

## 5. Datos (Supabase)

Proyecto Supabase existente del usuario. Si ya aloja otra herramienta, crear todo en un **schema propio `montaigne_fix`**.

Tablas mínimas (ajusta nombres si lo ves mejor, pero justifícalo):
- `tickets`: id, código MF-XXXX, nombre y email del solicitante, reparación, lugar, observaciones del solicitante, `photo_path` (antigua, deprecada; no se borra hasta confirmación), estado, prioridad, técnico asignado, `duplicate_of` (el parte original si está duplicado; se vacía al quitar duplicado o al cambiar de estado), fechas (`created_at`, `assigned_at`, `resolved_at`, `closed_at`, `updated_at`), `rejection_reason` (motivo actual si está rechazado; se vacía al reabrir y se borra con el parte).
- `ticket_photos`: hasta 10 fotos por parte (`path`, `sort_order`, `uploaded_by` nulo = solicitante). Rutas nuevas `{ticket_id}/{uuid}.jpg`; las antiguas `{ticket_id}.jpg` se copian tal cual en la migración.
- `storage_orphans`: rutas cuya fila se borró pero Storage no las quitó (para limpiar a mano).
- `ticket_events`: **historial** de todo cambio (quién, qué, valor anterior, valor nuevo, cuándo). Fuente de verdad para fechas y para los informes. Incluye `foto_anadida` / `foto_borrada` cuando un técnico o Gestión añade o borra después (las del formulario no generan evento) y `duplicado` al unir un aviso («Unió el aviso al parte MF-XXXX»).
- `ticket_notes`: observaciones con tipo (`gestion` | `interna`), autor y fecha. Las observaciones del solicitante van en `tickets`.
- `staff`: Fran, Agustín, Andrés (y Curro y Carlos como admin), con nombre, email y rol.
- `shopping_items` (lista de la compra), un registro por artículo:
  - `id`
  - `ticket_id` → `tickets.id` (obligatorio, `on delete cascade` para que el borrado a 12 meses se lleve sus materiales)
  - `description` (texto, no vacío, ≤ 200 caracteres)
  - `status`: enum `pendiente` | `comprado`
  - `requested_by` → `staff.id`, `created_at`
  - `purchased_by` → `staff.id` (nullable), `purchased_at` (nullable)
  - Restricción: si `status = 'comprado'` entonces `purchased_at` y `purchased_by` no son nulos; si `pendiente`, ambos nulos.
  - Índices: `(status, created_at)` para la lista de Fran y `(ticket_id)` para la ficha.
  - Cada alta, edición, compra, vuelta a pendiente o borrado se registra en `ticket_events` (tipo `material_solicitado`, `material_editado`, `material_comprado`, `material_repuesto`, `material_borrado`). El rechazo de un parte también queda en `ticket_events` (tipo `rechazo`, con el motivo; se conserva al reabrir).
  - El borrado de un artículo pendiente sí es físico (era un error); el resto es borrado lógico.

**Fotos:** Supabase Storage, bucket **privado**. Comprimir en el navegador antes de subir (máx. ~1600 px de lado, JPEG ~0,7, objetivo < 500 KB). En la base de datos solo se guarda la ruta. Se muestran en los paneles con URLs firmadas temporales. **Nunca base64 en la base de datos.** `add_ticket_photos` / `insert_requester_photos` solo aceptan rutas que empiecen por `{ticket_id}/` de ese parte.

**Seguridad (obligatorio):**
- RLS activado en **todas** las tablas y en el bucket.
- El navegador **no puede leer ni escribir directamente** ninguna tabla. Todo pasa por **Supabase Edge Functions** que usan la service role key (que nunca llega al navegador):
  - `create-ticket` (público): valida, sube hasta 3 fotos, crea el parte y avisa a Fran.
  - `staff-*` (requiere token de sesión del PIN + persona seleccionada). Incluye `staff-add-photos` / `staff-delete-photo` (`p_as_manager = false`: nadie, tampoco Fran, borra fotos que no haya subido él), `staff-add-materials` (cualquier parte que no esté cerrado, rechazado o duplicado; divide por líneas e inserta todo en una transacción) y `staff-edit-material` / `staff-delete-material` (artículos pendientes de cualquier parte abierto; si ya está comprado o no existe: «Este material ya se ha comprado o se ha borrado. Recarga la ficha.»).
  - `admin-*` (requiere token de sesión de la contraseña). Incluye `admin-add-photos` / `admin-delete-photo` (`p_as_manager = true`, puede borrar cualquiera), `admin-shopping-list`, `admin-add-materials`, `admin-mark-purchased` (recibe una lista de ids; solo actualiza los que siguen pendientes, en una transacción, y devuelve cuántos cambió) y `admin-unmark-purchased`. Al borrar un parte: primero Storage; solo si eso va bien se borra la fila. Si Storage falla: «No se han podido borrar las fotos. El parte no se ha eliminado.»
- PIN y contraseñas validados en el servidor con hash; sesión con token firmado y caducidad (p. ej. 30 días equipo, 7 días gerente).
- Límite básico de intentos de PIN/contraseña.
- Todas las migraciones como **archivos SQL versionados** en `supabase/migrations/`. El usuario las ejecuta (o se aplican con la CLI de Supabase). Nada creado "a mano" sin migración.

## 6. Emails

Remitente: **`soportemundanastudio@mundana.us`** por SMTP. Si no es viable, alternativa: **`soportestudiozero@gmail.com`** (Gmail + contraseña de aplicación). El remitente y las credenciales SMTP van en secretos/variables de entorno, para poder cambiar de uno a otro sin tocar código.

Solo se envían estos emails:

| Momento | Destinatario | Contenido |
|---|---|---|
| Se abre un parte | Solicitante | Acuse de recibo: "ya estamos en ello", con el código MF-XXXX |
| Se abre un parte | Fran | Todos los datos + las fotos (hasta 3: incrustadas `cid:foto-1`… y adjuntas). Añadir fotos después no envía correo. |
| Un técnico marca **Resuelto** | Fran | Aviso para que lo revise y lo cierre |
| Fran marca **Cerrado** | Solicitante | "Tu solicitud MF-XXXX (reparación, lugar) ya está solucionada. Gracias." Los avisos unidos también quedan **cerrados**. También se avisa a cada solicitante distinto de los avisos unidos, con el código, la reparación y el lugar **de su** parte. |
| Fran marca **Rechazado** | Solicitante | Explica el motivo (el texto que escribió Gestión). Asunto: `Sobre tu solicitud MF-XXXX: …`. El mismo motivo llega a quienes abrieron los avisos unidos, con los datos de su parte. Los unidos siguen en estado duplicado. |
| Fran marca **Duplicado** | Solicitante del aviso unido | Asunto: `Tu aviso MF-XXXX ya estaba registrado`. Variables: nombre de pila, código, código original, reparación, lugar, fecha de apertura. Se envía también si el email es el mismo que el del original. Un fallo de SMTP no deshace el marcado; queda en el log y Gestión ve aviso. Quitar duplicado no retira un correo ya enviado. |
| Miércoles 8:00 | Fran y Curro | Informe semanal |
| Anual (ver 8) | Fran y Curro | Informe anual |
| Gestión, botón «Enviar informe» | Fran y Curro | Informe semanal en el momento |

Las plantillas HTML y de texto están en `assets/email/` y se copian a `supabase/functions/_shared/email-templates/` (recibido, fran-nuevo, fran-resuelto, cerrado, rechazado, duplicado). Usarlas tal cual; ver `assets/email/LEEME-CURSOR.md`.

## 7. Informes

**Semanal — todos los miércoles a las 8:00 (hora de Madrid, respetando el cambio de hora):**
- Email a Fran y Curro (`curromena89@gmail.com`) con tablas: **Resueltas y cerradas**, **Abiertas**, **Materiales comprados** y **Pendiente de comprar**. Columnas de partes: código, reparación, lugar, prioridad, estado, asignado, **Fechas/Tiempo**. En resueltas: Abierta / Resuelta (fecha) y Tiempo `XdYh` (horas hacia abajo). En abiertas: solo `Abierta: dd/mm/aa · hh:mm`. Materiales comprados en la ventana: Solicitado y Comprado. Pendiente: columna **Solicitado desde**.
- **PDF adjunto** con las mismas tablas y, después, **Información de las incidencias**: título con enlace a `/gestion/{código}` y ficha (Solicitante, Asignado, Lugar, Reparación, Observaciones si hay, Abierta, Resuelta). Sin historial, fotos, materiales ni notas internas por ticket.
- El botón «Enviar informe» de Gestión manda el mismo semanal a Fran y Curro.
- Programado con `pg_cron` en Supabase llamando a una Edge Function (o GitHub Actions si es más fiable). Todo en plan gratuito.

**Anual — 1 de julio (fin de curso):**
- Email + PDF a Fran y Curro con **todas las incidencias Resueltas/Cerradas** de los 12 meses anteriores (misma columna Fechas/Tiempo y mismas fichas resumidas).

**Estética de informes y PDF:** el arte del portfolio adjunto (imagen corporativa de Mundana / Grupo Montaigne) + logo de Montaigne Fix.

## 8. RGPD y conservación

- Casilla obligatoria en el formulario. El texto está en `src/content/rgpd.ts`: «He leído y acepto que Grupo Montaigne (responsable) trate mi nombre y mi email para gestionar la reparación y avisarme cuando esté solucionada. Los datos se conservan 12 meses. Para ejercer tus derechos de acceso, rectificación o supresión escribe a soportemundanastudio@mundana.us». El texto legal definitivo del colegio sigue pendiente (sección 11).
- Aviso de no fotografiar personas (ver 3.1).
- **Borrado automático**: solo las incidencias **resueltas** o **cerradas** hace más de 12 meses. Se borran con sus fotos, notas, materiales, historial y el registro de correos de ese parte (destinatario y asunto). Primero Storage; si falla, ese parte no se borra. No se borran las abiertas, sin asignar, en curso, en espera, rechazadas ni duplicadas, aunque haya pasado un año. El borrado se ejecuta **después** de un informe anual enviado bien, así ninguna se borra sin haber salido en un informe. Si el informe anual falla, se avisa a Curro y no se borra nada nuevo hasta que el informe salga. Al borrar una sola foto: primero la fila; si Storage falla, se anota en `storage_orphans`.
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

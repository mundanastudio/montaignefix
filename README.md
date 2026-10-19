# Montaigne Fix

Partes de reparación del Colegio Montaigne (Sevilla). El profesor abre un parte, Gestión lo asigna y le pone prioridad, el técnico lo trabaja y, si hace falta, pide material. Gestión marca ese material como comprado y cierra el parte. El profesor recibe un correo cuando queda solucionado.

La web es un sitio estático (React, Vite, TypeScript). La base de datos, las fotos y el correo viven en Supabase (proyecto `montaigne-fix`, ref `rnghppmuqbdpbkkljnsr`, región `eu-west-1`). El navegador solo llama a Edge Functions con la clave pública. No lee ni escribe tablas.

Sitios públicos: [montaignefix.pages.dev](https://montaignefix.pages.dev) (Cloudflare Pages) y [montaignefix.vercel.app](https://montaignefix.vercel.app) (Vercel, mismo repo). El detalle de producto está en `PROJECT.md`.

## Cómo se usa

| Quién | Dónde | Qué hace |
|---|---|---|
| Profesor | `/` | Abre el parte. Sin contraseña. Como máximo 3 partes cada 24 horas con el mismo email, 10 por hora y 30 por día desde la misma red. Si en un día se pasan de 100, se paran los envíos nuevos. Fran, Curro, `andrescanorodriguez@gmail.com` y `agumasero@gmail.com` no tienen ese tope. `patriciacastilloorozco33@gmail.com`, `susanacrespomarquez@gmail.com`, `remelucia78@gmail.com`, `16.11.96.maria@gmail.com` y `scmary97@gmail.com` pueden abrir 10 cada 24 h y no cuentan para el tope de red. Solo esos Gmail (y el de Curro) entran fuera del dominio corporativo; el resto de Gmail no. |
| Fran, Curro y Carlos | `/gestion` | Tres pestañas: Abiertas, Resueltas y Cerradas. Asignan a una persona o a un **equipo** (Fran+Agustín, Fran+Andrés, Agustín+Andrés, Fran+Agustín+Andrés), priorizan (o quitan la P pulsando otra vez), compran materiales, cierran, reabren, rechazan o marcan duplicado. Cada uno entra con su contraseña. |
| Fran, Agustín y Andrés | `/equipo` | PIN compartido (4 cifras; se puede pasar a 6), el mismo para los tres, y luego eligen su nombre. Los combos no se eligen en el PIN: si Gestión o un compañero asignó un equipo, sale en **Mis tareas** de cada miembro. |

**Gestión.** Abiertas = todo salvo Resuelto, Duplicado, Cerrado y Rechazado. Resueltas = solo resueltas. Cerradas = Cerrado y Rechazado. Un duplicado no sale en el listado mientras sigue duplicado; al cerrar el original, los unidos pasan a Cerrado y salen ahí. Si hay asignado, el chip morado muestra el nombre (o el equipo), no la palabra «Asignado». Pulsar otra vez En curso / En espera / Resuelto vuelve a Asignado.

**Equipo.** Pestañas Mis tareas, Sin asignar y Todas. Mis tareas no incluye Cerrado. Todas = abiertas de cualquiera más las **cerradas que tenía asignadas esa persona** (o un combo suyo), esas cerradas al final. No salen Resuelto, Rechazado ni Duplicado. El técnico puede cambiar el estado de **sus** tareas, dejar notas internas, asignarse, quitarse y pasar el parte a Fran, Agustín, Andrés o un equipo. Puede añadir, editar y borrar materiales pendientes en **cualquier parte abierto**. No marca comprado, no pone prioridad y no cierra, reabre, rechaza ni marca duplicado. Si se equivoca de persona en el dispositivo, usa «Cambiar de persona».

En las tarjetas del listado (Gestión y Equipo) se ve Reparación, observaciones solo si hay, lugar y materiales.

## Correos

Al abrir un parte: acuse al profesor y aviso a Fran (con fotos). Al resolver: aviso a Fran. Al cerrar: correo de solucionado al profesor; si había avisos unidos, también a cada solicitante distinto, con los datos **de su** parte. Al rechazar: motivo al solicitante (y a los unidos). Al marcar duplicado: correo al solicitante del aviso unido, también si el email es el mismo que el del original. Quitar duplicado no retira un correo ya enviado. Añadir fotos después no manda correo. Los logos salen de `APP_PUBLIC_URL/email/`.

Los informes (semanal, anual y el botón de Gestión) llegan a Fran y a Curro. Carlos entra en Gestión pero no recibe esos informes.

## Informes

Cada miércoles a las 08:00 (hora de Madrid) Fran y Curro reciben el informe de los últimos 7 días, con PDF. El 1 de julio a las 08:00, ambos reciben el de los 12 meses anteriores. El botón «Enviar informe» de Gestión manda el semanal en el momento y no sustituye al del miércoles. No hay informe mensual.

El PDF y el correo del semanal llevan: **Resueltas y cerradas**, **Abiertas**, **Materiales comprados** (en esa semana) y **Pendiente de comprar**. Columna **Fechas/Tiempo**: en resueltas, Abierta / Resuelta (fecha) y Tiempo `XdYh` (horas hacia abajo); en abiertas, solo `Abierta: dd/mm/aa · hh:mm`. Pendiente usa **Solicitado desde**. Luego **Información de las incidencias**: título con enlace a `/gestion/{código}` y ficha (Solicitante, Asignado, Lugar, Reparación, Observaciones si hay, Abierta, Resuelta). Sin historial, fotos, materiales ni notas internas por ticket.

Después de un informe anual correcto, se borran solo los partes resueltos o cerrados que tengan más de 12 meses y que ya hayan salido en un informe. Los abiertos, en espera, rechazados y duplicados no se borran. Si el informe anual falla, Curro recibe un aviso y el borrado no avanza.

El número `MF-0001`, `MF-0002`… no se reutiliza, tampoco si se borra el parte.

## Cambiar el PIN o una contraseña

El PIN y las contraseñas no están en el repositorio. En el servidor solo hay un hash. Cinco fallos seguidos del PIN desde la misma IP, o cinco de la contraseña de esa persona, bloquean ese acceso 15 minutos. Diez fallos del PIN en 15 minutos, vengan de donde vengan, bloquean solo el PIN. Diez fallos de contraseña bloquean solo la gestión. Al cambiar el hash, las sesiones de esa credencial dejan de valer. En Gestión, «Cerrar sesiones del equipo» hace lo mismo con el PIN sin cambiarlo.

En PowerShell, desde la carpeta del proyecto. La comilla simple evita que PowerShell interprete `$` y otros signos:

```powershell
$env:NODE_EXTRA_CA_CERTS = "$env:USERPROFILE\.certs\zscaler-root-ca.pem"
$env:MF_SECRET = 'el pin o la contrasena nueva'
node scripts/hash-secret.mjs pin
```

Para una contraseña, el último argumento es `password` en lugar de `pin`. El PIN son 4 dígitos, o 6 si `MF_PIN_LENGTH` y `VITE_PIN_LENGTH` valen `6`. La contraseña, al menos 8 caracteres. El comando imprime una sola línea que empieza por `pbkdf2_sha256$`. Esa línea es el hash. No la pegues en el chat ni en el repo.

```powershell
npx supabase@latest secrets set MF_TEAM_PIN_HASH='pega-aqui-el-hash' --project-ref rnghppmuqbdpbkkljnsr
Remove-Item Env:MF_SECRET
```

Contraseña de Fran: `MF_ADMIN_PASSWORD_HASH_FRAN`. Contraseña de Curro: `MF_ADMIN_PASSWORD_HASH_CURRO`. Contraseña de Carlos: `MF_ADMIN_PASSWORD_HASH_CARLOS`. Cada una se genera con `password` y se guarda en su secreto. Al guardar el hash nuevo, las sesiones de esa persona dejan de valer. No hace falta volver a desplegar la web.

Para un PIN de 6 dígitos, el hash tiene que ser de 6 cifras y además:

```powershell
npx supabase@latest secrets set MF_PIN_LENGTH=6 --project-ref rnghppmuqbdpbkkljnsr
```

En Cloudflare y en Vercel, la variable de build `VITE_PIN_LENGTH` también tiene que valer `6`, y hay que volver a publicar la web. Sin eso, el teclado sigue pidiendo 4 cifras.

## Cambiar el remitente

El correo sale por `mail.mundana.us`, puerto 465. Supabase no deja salir por los puertos 25 ni 587. El certificado de ese servidor es de `correoseguro.dinaserver.com`; el código ya lo comprueba así. No cambies el servidor salvo que el buzón se mude de verdad.

Para otro buzón del mismo servidor:

```powershell
npx supabase@latest secrets set --project-ref rnghppmuqbdpbkkljnsr SMTP_USER='buzon@mundana.us' SMTP_PASSWORD='la clave del buzon' MAIL_FROM='Montaigne Fix <buzon@mundana.us>'
```

`MAIL_FROM` tiene que ser el mismo buzón que `SMTP_USER`. Usa comillas simples en PowerShell.

## Añadir un técnico

El PIN no es por persona. Un técnico nuevo entra con el mismo PIN y elige su nombre. En el SQL Editor de Supabase:

```sql
insert into montaigne_fix.staff (slug, name, full_name, email, is_manager, is_technician)
values ('lucia', 'Lucía', null, null, false, true);
```

`slug` en minúsculas, sin espacios, y que no exista ya. `active` queda en verdadero. Con `is_technician` en verdadero aparece en Equipo y se le pueden asignar partes (Gestión o un compañero). Sin email no recibe correos: le avisa Fran, igual que a Agustín y Andrés.

El orden de los nombres en Equipo es Fran, Agustín, Andrés y Curro. Un slug nuevo de técnico sale el primero hasta que se añada a la lista `ORDER` de `supabase/functions/_shared/auth.ts` y se redespliegue `team-login`.

Para que alguien sea gerente hace falta: `is_manager` en verdadero, un email, una línea en `PASSWORD_HASH` de `auth.ts` apuntando a un secreto `MF_ADMIN_PASSWORD_HASH_…`, una fila en `session_versions` con el mismo slug, el hash en ese secreto, y el nombre en `MANAGERS` de `src/pages/admin/AdminShell.tsx`. Hay que desplegar las funciones que usan `auth.ts` (como mínimo `admin-login` y `session`) y volver a publicar la web. Hoy Fran, Curro y Carlos son gerentes. Un gerente que no sea técnico (Curro, Carlos) no aparece en Equipo.

Para dar de baja a alguien sin borrar su historial: `update montaigne_fix.staff set active = false where slug = 'lucia';`

## Si Supabase se pausa

El plan gratuito pausa el proyecto tras unos 7 días sin actividad. Mientras está pausado no entra el formulario, no entran los paneles, no salen correos y no corren los informes.

El workflow `.github/workflows/keep-supabase-alive.yml` corre **todos los días a las 06:00 UTC** (y se puede lanzar a mano). Hace tres cosas:

1. Si existe `SUPABASE_ACCESS_TOKEN`, pide a Supabase que reanude el proyecto y espera hasta 5 minutos.
2. Llama a la Edge Function `keepalive` con el secreto `KEEPALIVE_TOKEN`. Esa función hace una consulta mínima a la base (contar partes) y responde `{"ok": true}`. No crea partes, no manda correos y no cuenta para los topes del formulario. Si no responde 200, el job falla y GitHub avisa por email.
3. Comprueba que `https://montaignefix.pages.dev/`, `https://montaignefix.vercel.app` y `https://montaignefix.vercel.app/equipo` responden 200.

Secretos de GitHub (Settings → Secrets and variables → Actions):

- `SUPABASE_ACCESS_TOKEN` — token personal de tu cuenta de Supabase (empieza por `sbp_`). Es el que puede reactivar un proyecto pausado. Cómo crearlo: [supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens) → **Generate new token** → copia el valor (solo se ve una vez) → en el repo, `gh secret set SUPABASE_ACCESS_TOKEN` y pégalo. Si un día el restore falla con 401, el token caducó o se borró: genera otro y vuelve a guardar ese secreto.
- `SUPABASE_PROJECT_REF` = `rnghppmuqbdpbkkljnsr`
- `SUPABASE_KEEPALIVE_URL` = `https://rnghppmuqbdpbkkljnsr.supabase.co/functions/v1/keepalive`
- `KEEPALIVE_TOKEN` — el mismo valor que el secreto `KEEPALIVE_TOKEN` de las Edge Functions de Supabase. No va en el código.

Si el Action falla un día: mira [Actions → Keep Supabase alive](https://github.com/mundanastudio/montaignefix/actions/workflows/keep-supabase-alive.yml). Entra en [el proyecto](https://supabase.com/dashboard/project/rnghppmuqbdpbkkljnsr) y pulsa **Restore** si está pausado. Cuando vuelva, los datos siguen donde estaban. El informe pendiente se intenta en la siguiente hora en punto, a partir de las 08:00 de Madrid, si ese día tocaba. Luego lanza el workflow a mano para comprobar.

## Publicar la web

**Vercel** (`https://montaignefix.vercel.app`) despliega solo al hacer push a GitHub (`mundanastudio/montaignefix`). `vercel.json` reescribe las rutas de la SPA excepto `/assets/` y `/email/`.

**Cloudflare Pages** es el proyecto `montaignefix` (`https://montaignefix.pages.dev`). No está conectado a GitHub: hay que subir `dist` a mano. No pongas `_redirects` en `public/` (entra en bucle). Tras el build, escribe ese archivo solo en `dist` y despliega:

```powershell
$env:NODE_EXTRA_CA_CERTS = "$env:USERPROFILE\.certs\zscaler-root-ca.pem"
npm run build
Set-Content -Path dist/_redirects -Value '/* /index.html 200' -NoNewline
npx wrangler pages deploy dist --project-name montaignefix --commit-dirty=true
```

Variables de build en Cloudflare y Vercel, solo estas dos:

- `VITE_SUPABASE_URL` = `https://rnghppmuqbdpbkkljnsr.supabase.co`
- `VITE_SUPABASE_ANON_KEY` = la clave anon / publishable

No pongas ahí la service role, el PIN, las contraseñas, SMTP ni `REPORT_CRON_SECRET`. Esos viven solo en los secretos de Supabase. `public/_headers` manda `noindex`.

`APP_PUBLIC_URL` en Supabase tiene que ser la dirección pública, sin barra al final (hoy `https://montaignefix.pages.dev`). Sin eso los correos salen, pero los logos no se ven. Si el colegio usa un dominio propio, actualiza ese secreto.

Las Edge Functions no salen con el push de la web. Tras cambiar `supabase/functions`:

```powershell
npx supabase@latest functions deploy --project-ref rnghppmuqbdpbkkljnsr --use-api --yes
```

## Revisión de seguridad (11 de octubre de 2026)

Hecho contra el proyecto real, con la clave anon de `.env.local`. No se imprimen claves ni fotos.

| Prueba | Resultado |
|---|---|
| Leer o insertar en `montaigne_fix.tickets` con la clave pública | 401, `permission denied for schema montaigne_fix` |
| Llamar a `admin_assign` por la API REST | 404, la función no está expuesta |
| `admin-tickets`, `admin-mark-purchased` y `staff-ticket` sin token, y `admin-tickets` con la clave anon | 401, sesión caducada |
| `staff-set-status` con un token inventado | 401, sesión caducada |
| Foto real del cubo `montaigne-fix-fotos` por la URL pública y por la URL directa, sin firma | 400, el cubo o el archivo no se entregan. Cero bytes |
| Listar el cubo con la clave pública | 200 y lista vacía |

Un técnico puede pedir, editar y borrar material en la tarea de un compañero, pero no marcar comprado ni cambiar materiales en un parte cerrado: lo comprueba `supabase/tests/comprobar_fase8.sql` actuando como Fran, Andrés, Agustín y Curro (asignar, priorizar, trabajar, pedir material, editar, comprar, recargar si ya está comprado, cerrar, reabrir, reasignar y rechazar). El parte de prueba `MF-FASE8` se borra al terminar y no gasta la secuencia. Esa pasada no reenvía correos. Para repetirla: `npx supabase@latest db query --linked -f supabase/tests/comprobar_fase8.sql` (termina con `FASE8 OK`). Las fotos (tope 10, rutas de otro parte, Fran desde el equipo no borra las de Andrés ni las del solicitante, Gestión sí) las cubre `supabase/tests/comprobar_fotos.sql` (`FOTOS_OK`). Unir un aviso duplicado (original obligatorio y abierto, Equipo no lo ve, quitar duplicado lo deja como estaba, cerrar el original cierra los unidos) lo cubre `supabase/tests/comprobar_duplicado.sql` (`DUPLICADO_OK`). Las pestañas de Gestión (abiertas / resueltas / cerradas y el orden) las cubre `supabase/tests/comprobar_gestion_tabs.sql` (`GESTION_TABS_OK`). Los equipos de asignación (Gestión elige el combo, Equipo lo trabaja si sale en el grupo) las cubre `supabase/tests/comprobar_combos.sql` (`COMBOS_OK`). La prueba HTTP es `node scripts/comprobar-acceso-publico.mjs`.

Las pantallas ya logueadas (lista, ficha, compra) no se abrieron en el navegador: haría falta el PIN o la contraseña, y no se prueban a ciegas. El formulario, el PIN y el acceso de Gestión sí se vieron en 320 px, 390 px, 768 px y 1280 px, sin scroll horizontal. Los campos de texto van a 16 px y los botones pasan de 48 px.

## Pendiente

- Captcha en el formulario. Hoy se confía en que la URL sea interna.
- Texto legal RGPD definitivo del colegio. La casilla actual es la provisional.

## Desarrollo en local

Hace falta Node y la CLI de Supabase. En la red del colegio, antes de `npx`:

```powershell
$env:NODE_EXTRA_CA_CERTS = "$env:USERPROFILE\.certs\zscaler-root-ca.pem"
npm install
npm run dev
```

El sitio queda en `http://localhost:5173`. `.env.local` solo lleva `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`. El resto son secretos de Supabase, listados sin valores en `.env.example`.

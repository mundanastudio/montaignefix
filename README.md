# Montaigne Fix

Partes de reparación del Colegio Montaigne (Sevilla). El profesor abre un parte, Fran lo asigna y le pone prioridad, el técnico lo trabaja y, si hace falta, pide material. Fran marca ese material como comprado y cierra el parte. El profesor recibe un correo cuando queda solucionado.

La web es un sitio estático (React, Vite, TypeScript). La base de datos, las fotos y el correo viven en Supabase (proyecto `montaigne-fix`, ref `rnghppmuqbdpbkkljnsr`, región `eu-west-1`). El navegador solo llama a Edge Functions con la clave pública. No lee ni escribe tablas.

## Cómo se usa

| Quién | Dónde | Qué hace |
|---|---|---|
| Profesor | `/` | Abre el parte. Sin contraseña. Como máximo 3 partes cada 24 horas con el mismo email, 10 por hora y 30 por día desde la misma red. Si en un día se pasan de 100, se paran los envíos nuevos. Fran, Curro, `andrescanorodriguez@gmail.com` y `agumasero@gmail.com` no tienen ese tope. `patriciacastilloorozco33@gmail.com`, `susanacrespomarquez@gmail.com`, `remelucia78@gmail.com`, `16.11.96.maria@gmail.com` y `scmary97@gmail.com` pueden abrir 10 cada 24 h y no cuentan para el tope de red. Solo esos Gmail (y el de Curro) entran fuera del dominio corporativo; el resto de Gmail no. |
| Fran y Curro | `/gestion` | Tres pestañas: Abiertas, Resueltas y Cerradas. Asignan, priorizan, compran materiales, cierran, reabren, rechazan o marcan duplicado. Cada uno entra con su contraseña. |
| Fran, Agustín y Andrés | `/equipo` | PIN compartido (4 cifras; se puede pasar a 6), el mismo para los tres, y luego eligen su nombre. Trabajan solo las tareas que tienen asignadas. |

Un técnico puede pasar a En curso, En espera o Resuelto, dejar una nota y pedir materiales. No puede marcar nada como comprado ni tocar una tarea de otro. Si se equivoca de persona en el dispositivo, usa «Cambiar de persona».

Al abrir un parte salen dos correos: el acuse al profesor y el aviso a Fran. Al resolver, Fran recibe otro. Al cerrar, el profesor recibe el de solucionado. Los logos de esos correos salen de la dirección pública del sitio (`APP_PUBLIC_URL/email/`).

Cada miércoles a las 08:00 (hora de Madrid) Fran recibe el informe de los últimos 7 días, con PDF. El 1 de julio a las 08:00, Fran y Curro reciben el informe de los 12 meses anteriores. Después de un informe anual correcto, se borran solo los partes resueltos o cerrados que tengan más de 12 meses y que ya hayan salido en un informe. Los abiertos, en espera, rechazados y duplicados no se borran. Si el informe anual falla, Curro recibe un aviso y el borrado no avanza. El botón «Enviar informe» de Gestión manda el semanal en el momento y no sustituye al del miércoles.

El número `MF-0001`, `MF-0002`… no se reutiliza, tampoco si se borra el parte.

Los correos van solo al solicitante, a Fran y, en el informe anual, también a Curro.

## Cambiar el PIN o una contraseña

El PIN y las contraseñas no están en el repositorio. En el servidor solo hay un hash. Cinco fallos seguidos desde la misma IP bloquean ese acceso 15 minutos. Diez fallos del PIN en 15 minutos, vengan de donde vengan, bloquean solo el PIN. Diez fallos de contraseña bloquean solo la gestión. Al cambiar el hash, las sesiones de esa credencial dejan de valer. En Gestión, «Cerrar sesiones del equipo» hace lo mismo con el PIN sin cambiarlo.

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

Contraseña de Fran: `MF_ADMIN_PASSWORD_HASH_FRAN`. Contraseña de Curro: `MF_ADMIN_PASSWORD_HASH_CURRO`. Cada una se genera con `password` y se guarda en su secreto. Al guardar el hash nuevo, las sesiones de esa persona dejan de valer. No hace falta volver a desplegar la web.

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

`slug` en minúsculas, sin espacios, y que no exista ya. `active` queda en verdadero. Con `is_technician` en verdadero aparece en Equipo y Fran puede asignarle partes. Sin email no recibe correos: le avisa Fran, igual que a Agustín y Andrés.

El orden de los nombres en la pantalla es Fran, Agustín, Andrés y Curro. Un slug nuevo sale el primero hasta que se añada a la lista `ORDER` de `supabase/functions/_shared/auth.ts` y se redespliegue `team-login`.

Para que alguien sea gerente hace falta, además, `is_manager` en verdadero, un email, y una línea nueva en `PASSWORD_HASH` de ese mismo archivo apuntando a un secreto `MF_ADMIN_PASSWORD_HASH_…`. Hoy solo Fran y Curro son gerentes.

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

## Cloudflare Pages

La web se publica desde GitHub (`mundanastudio/montaignefix`). Cloudflare compila; no subas la carpeta `dist`.

1. Crea la cuenta en [dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up). El plan gratuito sirve.
2. Workers y Pages → Create → Pages → Connect to Git.
3. Autoriza GitHub y elige el repositorio `mundanastudio/montaignefix`. Puede ser privado.
4. Nombre del proyecto: `montaigne-fix`.
5. Framework: Vite. Comando de build: `npm run build`. Carpeta de salida: `dist`.
6. Variables de entorno, en Production y en Preview. Solo estas dos, copiadas de `.env.local` o de Supabase → Project Settings → API:

   - `VITE_SUPABASE_URL` = `https://rnghppmuqbdpbkkljnsr.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = la clave anon / publishable

   No pongas ahí la service role, el PIN, las contraseñas, SMTP ni `REPORT_CRON_SECRET`. Esos viven solo en los secretos de Supabase.
7. Save and Deploy. La primera dirección será `https://montaigne-fix.pages.dev` (o la que te asigne Cloudflare).
8. Cuando esa dirección responda, dile a Supabase cuál es, sin barra al final:

```powershell
npx supabase@latest secrets set --project-ref rnghppmuqbdpbkkljnsr APP_PUBLIC_URL='https://montaigne-fix.pages.dev'
```

Sin ese paso los correos salen, pero los logos no se ven. Si más adelante el colegio usa un dominio propio, repite el comando con la dirección nueva.

El despliegue usa `npx wrangler deploy`, que ya trata la web como aplicación de una sola página: `/gestion` y `/equipo` funcionan al recargar. No hace falta un `_redirects` hacia `index.html` (esa regla entra en bucle y Cloudflare rechaza el despliegue). `public/_headers` manda `noindex`.

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

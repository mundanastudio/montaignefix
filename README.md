# Montaigne Fix

Partes de reparación del Colegio Montaigne (Sevilla). El profesor abre un parte, Fran lo asigna y le pone prioridad, el técnico lo trabaja y, si hace falta, pide material. Fran marca ese material como comprado y cierra el parte. El profesor recibe un correo cuando queda solucionado.

La web es un sitio estático (React, Vite, TypeScript). La base de datos, las fotos y el correo viven en Supabase (proyecto `montaigne-fix`, ref `rnghppmuqbdpbkkljnsr`, región `eu-west-1`). El navegador solo llama a Edge Functions con la clave pública. No lee ni escribe tablas.

## Cómo se usa

| Quién | Dónde | Qué hace |
|---|---|---|
| Profesor | `/` | Abre el parte. Sin contraseña. Como máximo 3 partes cada 24 horas con el mismo email. |
| Fran y Curro | `/gestion` | Asignan, priorizan, compran materiales, cierran, reabren, rechazan o marcan duplicado. Cada uno entra con su contraseña. |
| Fran, Agustín y Andrés | `/equipo` | PIN de 4 cifras, el mismo para los tres, y luego eligen su nombre. Trabajan solo las tareas que tienen asignadas. |

Un técnico puede pasar a En curso, En espera o Resuelto, dejar una nota y pedir materiales. No puede marcar nada como comprado ni tocar una tarea de otro. Si se equivoca de persona en el dispositivo, usa «Cambiar de persona».

Al abrir un parte salen dos correos: el acuse al profesor y el aviso a Fran. Al resolver, Fran recibe otro. Al cerrar, el profesor recibe el de solucionado. Los logos de esos correos salen de la dirección pública del sitio (`APP_PUBLIC_URL/email/`).

Cada miércoles a las 08:00 (hora de Madrid) Fran recibe el informe de los últimos 7 días, con PDF. El 1 de julio a las 08:00, Fran y Curro reciben el informe de los 12 meses anteriores. Después de un informe anual correcto, se borran los partes ya terminados (cerrado, resuelto, rechazado o duplicado) que tengan más de 12 meses y que ya hayan salido en un informe. El botón «Enviar informe» de Gestión manda el semanal en el momento y no sustituye al del miércoles.

El número `MF-0001`, `MF-0002`… no se reutiliza, tampoco si se borra el parte.

Mientras dure la prueba, los correos dirigidos a Fran también llegan a `soportemundanastudio@mundana.us`. El acuse y el de solucionado siguen yendo solo al profesor. Para quitar la copia, vacía `COPIA_DE_FRAN` en `supabase/functions/_shared/email.ts` y vuelve a desplegar las funciones de correo.

## Cambiar el PIN o una contraseña

El PIN y las contraseñas no están en el repositorio. En el servidor solo hay un hash. Cinco fallos seguidos bloquean ese acceso 15 minutos.

En PowerShell, desde la carpeta del proyecto. La comilla simple evita que PowerShell interprete `$` y otros signos:

```powershell
$env:NODE_EXTRA_CA_CERTS = "$env:USERPROFILE\.certs\zscaler-root-ca.pem"
$env:MF_SECRET = 'el pin o la contrasena nueva'
node scripts/hash-secret.mjs pin
```

Para una contraseña, el último argumento es `password` en lugar de `pin`. El PIN son exactamente 4 dígitos. La contraseña, al menos 8 caracteres. El comando imprime una sola línea que empieza por `pbkdf2_sha256$`. Esa línea es el hash. No la pegues en el chat ni en el repo.

```powershell
npx supabase@latest secrets set MF_TEAM_PIN_HASH='pega-aqui-el-hash' --project-ref rnghppmuqbdpbkkljnsr
Remove-Item Env:MF_SECRET
```

Contraseña de Fran: `MF_ADMIN_PASSWORD_HASH_FRAN`. Contraseña de Curro: `MF_ADMIN_PASSWORD_HASH_CURRO`. Cada una se genera con `password` y se guarda en su secreto. El cambio vale en el siguiente intento de entrada; no hace falta volver a desplegar la web.

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

El workflow `.github/workflows/keep-supabase-alive.yml` se ejecuta cada dos días y, si el proyecto está pausado, pide reactivarlo. En GitHub → Settings → Secrets and variables → Actions tienen que existir:

- `SUPABASE_ACCESS_TOKEN` (token personal de Supabase, el que empieza por `sbp_`)
- `SUPABASE_PROJECT_REF` = `rnghppmuqbdpbkkljnsr`
- `SUPABASE_URL` = `https://rnghppmuqbdpbkkljnsr.supabase.co`
- `SUPABASE_ANON_KEY` (la clave pública, la misma del frontend)

Si aun así se pausa: entra en [el proyecto](https://supabase.com/dashboard/project/rnghppmuqbdpbkkljnsr) y pulsa Restore. Cuando vuelva, los datos siguen donde estaban. El informe pendiente se intenta en la siguiente hora en punto, a partir de las 08:00 de Madrid, si ese día tocaba.

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

Un técnico no puede pedir material en una tarea de otro ni marcar comprado: lo comprueba `supabase/tests/comprobar_fase8.sql` actuando como Fran, Andrés, Agustín y Curro (asignar, priorizar, trabajar, pedir material, resolver, comprar, cerrar, reabrir, reasignar y rechazar). El parte de prueba `MF-FASE8` se borra al terminar y no gasta la secuencia. Esa pasada no reenvía correos. Para repetirla: `npx supabase@latest db query --linked -f supabase/tests/comprobar_fase8.sql` (termina con `FASE8 OK`). La prueba HTTP es `node scripts/comprobar-acceso-publico.mjs`.

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

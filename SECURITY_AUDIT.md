# Auditoría de seguridad — Montaigne Fix

Fecha de la auditoría: 12 de octubre de 2026. Correcciones aplicadas el mismo día.

## Estado después de las correcciones

| ID | Estado | Qué quedó |
|---|---|---|
| SEC-01 | Corregido | La IP sale de `cf-connecting-ip`. Si no llega, se usa el último valor de `X-Forwarded-For`, nunca el primero. Sigue el candado de 5 fallos por IP. Hay otro candado, aparte, de 10 fallos en 15 minutos: uno solo para el PIN y otro solo para la contraseña. Un ataque al PIN no cierra Gestión. Fran recibe un correo, como mucho uno por bloqueo. Las sesiones ya abiertas siguen. El PIN puede ser de 4 o de 6 cifras. |
| SEC-02 | Corregido | Cada token lleva la versión de su credencial. Se guarda una huella HMAC, no el hash. Al cambiar el PIN o una contraseña, o al pulsar «Cerrar sesiones del equipo», los tokens viejos dejan de valer. El mensaje pide volver a introducir el PIN o la contraseña. |
| SEC-02b | Riesgo aceptado | Con el PIN compartido se puede elegir cualquier técnico. Es la decisión de diseño del panel del equipo. No se ha cambiado. |
| SEC-03 | Corregido | Además de 3 partes por email y día: 10 por hora y 30 por día por IP, y un tope de 100 partes al día. Fran y Curro no tienen tope y no cuentan para el de 100. El aviso a Fran es como mucho uno por bloqueo. La foto se comprueba por tamaño y por bytes JPEG. Un HEIC (`ftypheic`) se convierte a JPEG en el navegador antes de enviarse. |
| SEC-04 | Corregido | `https://montaignefix.pages.dev` y `https://montaignefix.vercel.app` responden con Content-Security-Policy, `nosniff`, `strict-origin-when-cross-origin`, `X-Frame-Options: DENY` y cámara solo en el propio sitio. La política deja `worker-src blob:` porque la conversión HEIC abre un worker. Los logos son archivos webp del propio sitio. `data:` queda permitido por si alguna imagen lo usa; el JavaScript publicado no lleva ninguna. |
| SEC-05 | Corregido | El borrado a 12 meses, y solo después de un informe anual correcto, afecta a partes resueltos o cerrados, con foto, notas, materiales, historial y correos de ese parte. No borra abiertos, en espera, rechazados ni duplicados. Si el anual falla, Curro recibe un aviso. Las IPs se tiran a los 2 días. |
| SEC-06 | Corregido | Ya no hay copia a `soportemundanastudio@mundana.us`. |
| SEC-07 | Pendiente | CORS sigue en `*`. Mejora futura: `ALLOWED_ORIGINS` con `https://montaignefix.pages.dev`, `https://montaignefix.curromena89.workers.dev`, `https://montaignefix.vercel.app` y `http://localhost:5173`. |
| SEC-08 | Puede esperar | Listar el bucket con la clave pública sigue respondiendo 200 y una lista vacía. |
| SEC-09 | Puede esperar | `create-ticket` sigue sin el `try/catch` común. Los errores previstos responden en español. |
| SEC-10 | Puede esperar | Cinco fallos de la contraseña de una persona la bloquean 15 minutos. Es el candado por persona, distinto del global. |
| Advisor `extension_in_public` | Corregido | `pg_net` está en el schema `extensions`. El cron `montaigne-fix-report-tick` sigue, y llama a `net.http_post`. Aplicado el 12 de octubre de 2026, a las 20:08 (Madrid), lejos del miércoles a las 8:00. |

## Cómo pasar el PIN a 6 cifras

1. Genera el hash con un PIN de 6 dígitos (`scripts/hash-secret.mjs pin`).
2. Guárdalo en `MF_TEAM_PIN_HASH`.
3. Pon `MF_PIN_LENGTH=6` en los secretos de Supabase.
4. Pon `VITE_PIN_LENGTH=6` en el build de Cloudflare y de Vercel, y vuelve a publicar la web.

Al cambiar el hash, las sesiones del equipo dejan de valer solas.

## Pruebas

No hace falta adivinar el PIN ni la contraseña. Cinco fallos seguidos desde la misma red bloquean 15 minutos.

1. PIN. En `/equipo`, falla el PIN varias veces. A la quinta desde el mismo móvil debe decir que hay que esperar. Las sesiones que ya estaban abiertas en otro móvil siguen. Diez fallos en total (aunque cambies de red) bloquean solo el PIN y Fran recibe un correo. Gestión, con la contraseña, tiene que seguir dejando entrar.
2. Sesión expulsada. Entra en el equipo. En Gestión pulsa «Cerrar sesiones del equipo» y confirma en el cuadro de la app. Al volver al equipo debe decir: «Tu sesión ha caducado, vuelve a introducir el PIN.» Tu sesión de gestión sigue. Lo mismo pasa si cambias el hash del PIN.
3. Formulario. Con un email que no sea el de Fran ni el de Curro, el cuarto parte en 24 horas explica cuándo se puede volver a enviar. Una ráfaga desde la misma red, pasados 10 en una hora o 30 en un día, responde: «Has enviado muchos partes seguidos. Inténtalo de nuevo en un rato.» Fran y Curro pueden seguir abriendo partes.
4. Foto del iPhone. Elige una foto HEIC de la cámara. La vista previa tiene que verse y el parte enviarse. En esta sesión se probó un HEIC real (`ftypheic`): Chrome no lo abre solo, la web lo pasa a JPEG (`image/jpeg`, bytes `FF D8 FF`) y ese JPEG es el que el servidor acepta.
5. Cabeceras. En `https://montaignefix.pages.dev` y `https://montaignefix.vercel.app`, la respuesta debe llevar Content-Security-Policy, `nosniff`, `strict-origin-when-cross-origin`, `X-Frame-Options: DENY` y cámara solo en el propio sitio. El formulario, la vista previa de la foto y, dentro de un parte, la foto firmada tienen que verse. Los logos de la cabecera son archivos de la propia web, no `data:`.
6. Uso normal en el móvil. Abrir un parte con foto, entrar en Gestión y en Equipo, y ver una incidencia con foto. En Gestión, en el móvil, no deben salir los filtros Desde y Hasta.
7. Informe. En Gestión, «Enviar informe» sigue mandando el semanal a Fran, sin copia al buzón de soporte. En Supabase, `cron.job` sigue teniendo `montaigne-fix-report-tick`. `cron.job_run_details` no debe quedarse con un error de `pg_net`, y `net._http_response` debe registrar la llamada de esa hora.

El detalle de la auditoría original sigue debajo.

---

Fecha: 12 de octubre de 2026. Solo lectura: no se ha cambiado código, ni secretos, ni datos. No se ha probado el PIN ni las contraseñas (cinco fallos bloquean 15 minutos).

Alcance: lo que piden las secciones 2, 4, 5 y 8 de `PROJECT.md`, más las diez áreas pedidas. La prueba en vivo usa el proyecto `rnghppmuqbdpbkkljnsr`.

No hay hallazgo **Crítico**. Lo más urgente está en el PIN, en las sesiones y en el formulario público.

## Cómo ver los avisos de Supabase

En esta sesión no hay acceso al panel, así que el Security Advisor y el Performance Advisor no se han podido leer. Ábrelos con la cuenta del proyecto:

1. [https://supabase.com/dashboard/project/rnghppmuqbdpbkkljnsr/advisors/security](https://supabase.com/dashboard/project/rnghppmuqbdpbkkljnsr/advisors/security)
2. [https://supabase.com/dashboard/project/rnghppmuqbdpbkkljnsr/advisors/performance](https://supabase.com/dashboard/project/rnghppmuqbdpbkkljnsr/advisors/performance)

Si el enlace no abre, en el menú izquierdo: **Advisors → Security Advisor** y **Advisors → Performance Advisor**.

Lo que el Security Advisor suele marcar ya está comprobado por SQL el 12 de octubre de 2026:

- Las 8 tablas de `montaigne_fix` tienen RLS activo: `tickets`, `ticket_events`, `ticket_notes`, `staff`, `shopping_items`, `login_attempts`, `email_log`, `report_runs`.
- Ese schema no tiene ninguna política.
- `anon`, `authenticated` y `public` no tienen permisos de tabla ni de función.
- Ninguna función de `montaigne_fix` es `SECURITY DEFINER`. Todas tienen `search_path` vacío.
- La única función `SECURITY DEFINER` propia es `public.rls_auto_enable`, con `search_path = pg_catalog` y sin permiso de ejecución para `anon`. No lee datos de la app.
- El bucket `montaigne-fix-fotos` es privado, límite 2 MB, MIME jpeg/webp/png. Dos políticas restrictivas niegan el bucket a `anon` y `authenticated`.

`supabase_migrations.schema_migrations` aparece sin RLS. Es la tabla interna de Supabase, no de la app. Si el advisor la nombra, se puede ignorar.

## Prueba con la clave pública

La web publicada solo lleva la URL del proyecto y una clave `sb_publishable` (la clave anónima nueva). No lleva service role, SMTP, PIN ni hash.

Desde la carpeta del proyecto, con la clave que ya está en `.env.local` (no la pegues en el chat):

```powershell
$env:NODE_EXTRA_CA_CERTS = "$env:USERPROFILE\.certs\zscaler-root-ca.pem"
node scripts/comprobar-acceso-publico.mjs
```

Resultado del 12 de octubre de 2026, repetido a mano sobre las ocho tablas:

| Prueba | Resultado |
|---|---|
| GET y POST de `tickets`, `shopping_items`, `email_log`, `staff`, `ticket_notes`, `ticket_events`, `report_runs`, `login_attempts` | 401 `permission denied for schema montaigne_fix` |
| RPC `admin_assign` con la clave pública | 404, la función no está expuesta |
| Foto por la ruta pública y por la ruta privada sin firma | 400, bucket u objeto no encontrados |
| `admin-tickets`, `admin-mark-purchased` y `staff-set-status` sin token, con la clave pública o con un token falso | 401 «La sesión ha caducado» |
| Listar el bucket | 200 y lista vacía `[]` (ver SEC-08) |

La misma clave, en bruto, contra una tabla:

```http
GET https://rnghppmuqbdpbkkljnsr.supabase.co/rest/v1/shopping_items?select=id&limit=1
apikey: <clave de .env.local>
Authorization: Bearer <la misma clave>
Accept-Profile: montaigne_fix
```

Tiene que responder 401 y un cuerpo sin filas. Sirve igual para POST con `Content-Profile: montaigne_fix` y cuerpo `{}`.

## Hallazgos

Ordenados por severidad. La reproducción describe la prueba; no incluye un bucle de PIN ni de altas de partes.

| ID | Área | Hallazgo | Severidad | Cómo reproducirlo | Corrección propuesta |
|---|---|---|---|---|---|
| SEC-01 | Accesos | El PIN tiene 4 dígitos (10.000 combinaciones). El servidor sí corta a 5 fallos y 15 minutos, pero el contador es por IP y la IP es el primer valor de `X-Forwarded-For` (`clientIp` en `supabase/functions/_shared/http.ts`, usado en `team-login`). Quien pueda poner esa cabecera tiene un contador distinto en cada intento. Un atacante con muchas IPs no choca con el candado. El hash en sí es robusto: PBKDF2-SHA256, 600.000 vueltas, sal aleatoria (`scripts/hash-secret.mjs`). | Alta | En `team-login`, el bloqueo llama a `assertNotLocked("pin", ip)` y la IP sale de la primera entrada de `X-Forwarded-For`. Dos peticiones con PIN incorrecto y distinta cabecera `X-Forwarded-For` no comparten contador. No lances ráfagas desde la red del colegio: si la cabecera no se puede falsear, cinco fallos bloquean esa IP 15 minutos. | Contar también los fallos globales (por ejemplo 30 en 15 minutos, todas las IPs) y tomar la IP que pone la plataforma, no la primera que envía el cliente. Valorar un PIN de 6 dígitos en otro paso: cambia el hábito del equipo. |
| SEC-02 | Accesos | El token es un HMAC-SHA256 de `{typ, sub, exp}` con `MF_SESSION_SECRET`. Caduca a los 30 días (equipo y también el token de puerta `gate`) o a los 7 (gerencia). Cambiar el PIN o la contraseña no lo invalida: la firma no depende del hash. El navegador lo guarda en `localStorage` (`mf.gate`, `mf.team`, `mf.admin` en `src/lib/authApi.ts`). Cualquier script que corra en la página puede leerlo. Además, `team-select` acepta un token `gate` o `team` y emite un token de cualquier técnico, sin volver a pedir el PIN. Un token robado de Agustín sirve para actuar como Andrés o como Fran técnico hasta que caduque. | Alta | El payload firmado en `signToken` solo lleva tipo, persona y caducidad. Tras rotar `MF_TEAM_PIN_HASH`, un token ya guardado en el navegador sigue pasando `verifyToken` hasta `exp`. `team-select` no distingue «acabo de acertar el PIN» de «tengo un token de otro compañero». | Meter en el token una versión del secreto (o los primeros bytes del hash vigente) y rechazar el token si el hash cambió. Al cambiar PIN o contraseña, subir esa versión. Bajar la vida del token de equipo (horas, no 30 días) si el dispositivo compartido lo permite. El robo por XSS se recorta con SEC-04; en un sitio estático no hay cookie `HttpOnly`. |
| SEC-03 | Formulario público | Cada email puede abrir 3 partes cada 24 horas. No hay tope por IP. Fran y Curro, por ser gerentes activos, no tienen tope: es lo pedido. Quien rote emails manda miles de partes, fotos de hasta 1,5 MB y correos a Fran. El captcha sigue fuera de alcance. La foto sí se valida en el servidor: máximo 1.500.000 bytes y cabecera JPEG real, además del tope de 2 MB del bucket. | Alta | `RATE_LIMIT = 3` en `create-ticket` filtra por `requester_email`. No consulta la IP. Con emails distintos, el 429 no llega. Los gerentes salen antes de ese filtro. | Mantener los 3 por email y la exención de Fran y Curro. Añadir un tope por IP para el resto, holgado para el wifi del colegio: 40 partes por IP y día. Así una clase puede escribir y un script desde una sola IP no llena Storage ni el buzón. Sin captcha, muchas IPs siguen pudiendo; este tope corta el abuso fácil. |
| SEC-04 | Frontend | No hay `Content-Security-Policy`. En Cloudflare Pages, hoy, la respuesta de `https://montaignefix.pages.dev/` sí trae `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`, `Permissions-Policy` y `X-Robots-Tag: noindex`. Salen de `public/_headers`. Vercel no lee ese archivo. Un despliegue en Vercel se quedaría sin esas cabeceras mientras no exista `vercel.json`. El texto de usuario se pinta con React; en `src/` no hay `innerHTML` ni `dangerouslySetInnerHTML`. | Media | `curl -I https://montaignefix.pages.dev/` muestra las cabeceras de arriba y no muestra `content-security-policy`. No hay `vercel.json` en el repo. | Al crear el proyecto en Vercel, copiar las cabeceras actuales a `vercel.json` y añadir una CSP corta: scripts y estilos del propio origen, imágenes de `self` y del dominio de Supabase (las fotos van por URL firmada), sin `unsafe-inline` en scripts si el build lo permite. Incluir `frame-ancestors 'none'`. |
| SEC-05 | RGPD | El borrado a 12 meses sí borra la fila del parte y, por `ON DELETE CASCADE`, notas, historial y materiales. Antes intenta borrar la foto. `email_log.ticket_id` es `ON DELETE SET NULL`: la fila del correo se queda, con destinatario y asunto (el asunto lleva un trozo de la reparación). Si el borrado de la foto falla, el código no mira el error y sigue; el archivo puede quedar en el bucket. La purga solo corre si ya hubo un informe anual correcto, una vez al día después de las 08:00. Hasta el primer 1 de julio con informe enviado, no se borra nada. Eso cumple la regla de no borrar sin informe; si el informe anual falla siempre, la retención no tiene fin. | Media | En `20261011160000_email_log.sql`, el parte se desvincula en vez de borrar el registro. `purge` en `report.ts` llama a `storage.remove` y a continuación borra el parte sin comprobar el error. `runScheduledReports` solo entra en la purga si `lastAnnualEnd()` tiene valor. | Al borrar el parte, borrar también las filas de `email_log` de ese `ticket_id` (o no guardar el email del solicitante en el asunto una vez borrado el parte). Comprobar el resultado de `remove` y dejar el parte si la foto no se pudo borrar, para reintentar. Avisar en el informe si un año no se ha purgado porque el anual falló. |
| SEC-06 | Emails | Todo correo cuyo destinatario es Fran se copia a `soportemundanastudio@mundana.us` (`COPIA_DE_FRAN`). Entra el parte nuevo (con foto), el aviso de resuelto y el informe semanal o anual en PDF. El acuse al solicitante y el cierre al solicitante no se copian. Curro solo recibe el anual, sin esa copia. El HTML de las plantillas escapa nombre, email, reparación, lugar, observaciones y notas. El asunto pasa por `plain()` (los saltos de línea desaparecen) y, si hace falta, por codificación de cabecera. El destinatario del formulario tiene que cumplir el patrón de email, que rechaza espacios y saltos de línea. | Media | `rendered` y `sendReport` en `email.ts` envían una segunda copia cuando `to` es el email de Fran. | Quitar la constante cuando ya no haga falta la copia de pruebas. Mientras exista, el buzón de soporte recibe datos del solicitante, fotos e informes. |
| SEC-07 | Edge Functions | CORS está abierto a cualquier origen: `Access-Control-Allow-Origin: *` en `supabase/functions/_shared/http.ts` y otra vez en `create-ticket`. `MF_ALLOWED_ORIGIN`, documentado en `.env.example`, no lo lee ningún archivo. Un sitio ajeno no puede leer `localStorage` de Montaigne Fix, así que no roba el token solo con este comodín. Sí puede llamar a `create-ticket` desde el navegador de otra persona; esa función ya es pública. | Baja | Buscar `Access-Control-Allow-Origin` en `supabase/functions`. Las dos copias valen `*`. | Para Vercel no hay que tocar CORS: el comodín ya deja pasar `https://….vercel.app`. Si más adelante se cierra la lista, los orígenes concretos serían `https://montaignefix.pages.dev`, `https://montaignefix.curromena89.workers.dev`, `http://localhost:5173` y el host exacto de Vercel (evitar `*.vercel.app`, que cubre proyectos de otras personas). |
| SEC-08 | Storage | Listar el bucket con la clave pública responde 200 y `[]`. No devuelve nombres de foto. La descarga sin firma y la ruta pública responden que el bucket o el objeto no existen. Las URLs firmadas duran 1 hora (`createSignedUrl` con `60 * 60` en `signPhoto`). | Baja | La fila «listar cubo» de `scripts/comprobar-acceso-publico.mjs`. | Opcional: responder 403 al listado. La hora de la firma es un plazo razonable; al refrescar la ficha se pide otra. |
| SEC-09 | Edge Functions | `create-ticket` no usa el `try/catch` de `handle`. Los errores previstos devuelven una frase en español y en el log solo un código. Una excepción no prevista puede salir con el texto que genere la plataforma. El resto de funciones pasan por `handle`, que al cliente le dice «No se ha podido completar» y en el log deja solo el nombre del error. Las funciones SQL devuelven al usuario únicamente la frase que empieza por `MF:`. | Baja | Comparar `create-ticket/index.ts` (sin `handle`) con `staff-set-status` (entra por `serveTeam` → `handle`). | Envolver `create-ticket` en el mismo `handle`, o un `try/catch` que responda la frase genérica. |
| SEC-10 | Accesos | La contraseña de gerencia sí tiene candado global: 5 fallos y 15 minutos por persona (`assertNotLocked("password", slug)`), no por IP. El efecto secundario es que cinco intentos ajenos dejan a Fran o a Curro fuera un cuarto de hora. El mínimo es 8 caracteres. | Baja | `admin-login`: el `subject` del intento es el slug, no la IP. | Dejarlo. Si molesta el bloqueo ajeno, avisar por correo al quinto fallo en vez de alargar el candado. |

## Lo que está en orden

**Base de datos.** RLS en las ocho tablas, cero políticas, cero permisos para `anon` y `authenticated`. Funciones con `search_path` vacío y sin `SECURITY DEFINER`. El técnico no cambia la prioridad, no cierra, no reabre y no marca materiales comprados: el estado de equipo solo admite `en_curso`, `en_espera` y `resuelto`, y `admin_mark_purchased` exige gerente. `lock_own_ticket` impide tocar un parte de otro. Un token `team` no pasa `requirePerson(..., "admin", ...)`. Esto ya se ejerció en `supabase/tests/comprobar_fase8.sql` (mensaje `FASE8 OK`).

**Edge Functions.** Las ocho `staff-*` entran por `serveTeam` (token `team` y persona con `is_technician`). Las diecisiete `admin-*` entran por `serveAdmin` (token `admin` y `is_manager`). `report-tick` exige la cabecera `x-report-secret`. `verify_jwt` está apagado a propósito: la puerta de Supabase no valida estos token; lo hace cada función.

**create-ticket.** Límites de servidor, iguales a las restricciones de la tabla: nombre 120, email 254, reparación 2000, lugar 200, observaciones 2000. Foto JPEG y como mucho 1,5 MB.

**Secretos.** `gitleaks` no está instalado. Se ha recorrido el historial (10 commits) con `git grep` de JWT, `sbp_`, `postgresql://` y `SMTP_PASSWORD=`. Las coincidencias son el ejemplo de `.env.example`, el comentario del workflow y el README. No hay un `.env` versionado ni un hash PBKDF2 real. `dist/` local y el JavaScript de `https://montaignefix.pages.dev/assets/index-Bp7aqwQ7.js` llevan la URL del proyecto y una clave `sb_publishable`. No llevan service role, SMTP, PIN ni hash. `npm audit` (12 de octubre de 2026): 0 vulnerabilidades. Las funciones usan `npm:@supabase/supabase-js@2` (sin versión fija) y `npm:pdf-lib@1.17.1`.

**Frontend.** Sin `innerHTML`. `noindex` en `index.html`, en `X-Robots-Tag` y en `public/robots.txt` (`Disallow: /`).

**Emails.** Escape HTML de los campos de usuario. Asunto y destinatario sin inyección de cabeceras por saltos de línea. Contraseña SMTP recortada si un error de envío se guarda en `email_log`.

**Navegador.** En `src/` no hay `console.log`. Los logs de las funciones escriben códigos (`error.code`, nombre del error), salvo el mensaje de un fallo de subida de foto, que se queda en el log de Supabase y no en la respuesta.

**RGPD en el navegador.** La casilla y el aviso de no fotografiar personas siguen como en el proyecto. El texto legal definitivo sigue pendiente, igual que el captcha (sección 11 de `PROJECT.md`).

## Qué corregiría ya y qué puede esperar

**Ya**, en este orden:

1. SEC-01 y SEC-02 juntos. Un PIN corto con sesiones de 30 días que sobreviven al cambio de PIN es el agujero más claro. La versión del token y un contador global de fallos son cambios pequeños en las funciones de acceso.
2. SEC-03. El tope por IP, sin quitar la exención de Fran y Curro ni los 3 partes por email.
3. SEC-05. Borrar `email_log` con el parte y no dar por borrada la foto si Storage devuelve error.
4. SEC-06. Quitar `COPIA_DE_FRAN` cuando confirmes que ya no quieres esa copia. Es una línea; mientras esté, el buzón de soporte recibe fotos e informes.
5. SEC-04 en el mismo momento en que se cree el proyecto de Vercel, para no publicar sin cabeceras. La CSP puede ir en ese mismo cambio.

**Puede esperar:**

- SEC-07. El CORS `*` no impide añadir Vercel. Cerrarlo es higiene, no el arreglo del PIN.
- SEC-08, SEC-09 y SEC-10. No exponen datos. El listado vacío, el `try/catch` de `create-ticket` y el bloqueo de la contraseña se pueden hacer cuando se toque esa zona.
- Abrir el Security Advisor y el Performance Advisor y anotar aquí lo que salga. Con el SQL de arriba, no espero un aviso grave de RLS; sí puede salir la tabla interna `schema_migrations` o un aviso de índices.

No hace falta rotar la service role ni la clave anónima por esta revisión: no aparecen en el repositorio ni en el JavaScript publicado.

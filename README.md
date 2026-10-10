# Montaigne Fix — powered by Mundana Studio

Partes de reparación del Colegio Montaigne. El documento maestro es [`PROJECT.md`](PROJECT.md).

## Desarrollo

```bash
npm install
copy .env.example .env.local   # rellena VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY
npm run dev                    # http://localhost:5173  (formulario en /, guía en /muestra)
npx vite --host --port 5173    # también desde el móvil, en la misma Wi-Fi
npm run build
```

La función `create-ticket` ya está desplegada. Para volver a desplegarla:

```bash
npx supabase functions deploy create-ticket --project-ref rnghppmuqbdpbkkljnsr --no-verify-jwt
```

## Base de datos (Supabase)

Montaigne Fix usa un **proyecto de Supabase propio**, separado de cualquier otro. Nunca ejecutes estas migraciones en el proyecto de otra empresa.

### Paso 0 — Crear el proyecto (solo la primera vez)

1. En <https://supabase.com/dashboard>, pulsa **New project**.
2. Elige tu organización (la cuenta gratuita), escribe como nombre `montaigne-fix` y elige la región **West EU (Ireland)** o **Central EU (Frankfurt)**, que están dentro de la UE (RGPD).
3. Genera una contraseña de base de datos y **guárdala en tu gestor de contraseñas**: la CLI te la pedirá.
4. Espera 1–2 minutos a que el proyecto esté listo. **Comprueba arriba a la izquierda que estás dentro de `montaigne-fix`** antes de ejecutar cualquier SQL.

El plan gratuito permite 2 proyectos activos.

### Migraciones

Todo vive en el schema propio **`montaigne_fix`**. Las migraciones están en `supabase/migrations/` y hay que aplicarlas **en orden**:

| Orden | Archivo | Qué hace |
|---|---|---|
| 1 | `20261010190000_montaigne_fix_schema.sql` | Crea el schema, los tipos, las tablas, los índices, los permisos y el RLS |
| 2 | `20261010190100_montaigne_fix_triggers.sql` | Crea los triggers que rellenan las fechas y el historial |
| 3 | `20261010190200_montaigne_fix_storage.sql` | Crea el bucket privado `montaigne-fix-fotos` |
| 4 | `20261010190300_montaigne_fix_seed_staff.sql` | Carga a Fran, Agustín, Andrés y Curro |
| 5 | `20261010194500_harden_rls_auto_enable.sql` | Quita a `anon` el permiso de ejecutar la función de RLS automático de Supabase (limpia el aviso del Security Advisor) |
| 6 | `20261011001000_login_attempts.sql` | Intentos de PIN y contraseña (5 fallos, 15 minutos) |

**Estado:** aplicadas en el proyecto `montaigne-fix` (`rnghppmuqbdpbkkljnsr`, eu-west-1) el 10/10/2026 con la CLI. `montaigne_fix` está en Exposed schemas y el Security Advisor no da ningún aviso.

> **Red corporativa (Zscaler):** si la CLI da *Transport error* o `UNABLE_TO_GET_ISSUER_CERT_LOCALLY`, Node necesita confiar en el certificado de Zscaler. Configura la variable de usuario `NODE_EXTRA_CA_CERTS=%USERPROFILE%\.certs\zscaler-root-ca.pem`. Si el inicio de sesión por navegador falla, entra con un token: `npx supabase@latest login --token sbp_…`.

> Elige **una** de las dos opciones y úsala siempre. Si mezclas las dos, la CLI no sabrá qué migraciones están aplicadas (al final hay una solución).

### Opción A — Panel SQL de Supabase (recomendada para empezar)

1. Entra en <https://supabase.com/dashboard> y abre tu proyecto.
2. En el menú de la izquierda, pulsa **SQL Editor** y después **+ New query**.
3. En el editor (Cursor), abre `supabase/migrations/20261010190000_montaigne_fix_schema.sql`, selecciona todo (Ctrl+A), cópialo (Ctrl+C) y pégalo en el panel SQL.
4. Pulsa **Run** (o Ctrl+Enter). Debe aparecer *Success. No rows returned*.
5. Repite los pasos 2 a 4 con los archivos 2, 3 y 4, **en ese orden**, cada uno en una consulta nueva.
6. **Expón el schema para las Edge Functions:** ve a **Project Settings → Data API** (en algunas versiones del panel está en *Integrations → Data API*). En **Exposed schemas**, añade `montaigne_fix` y guarda.
   Esto **no** abre nada al público: `anon` no tiene permisos sobre el schema. Sin este paso, las Edge Functions de las siguientes fases no podrán leer las tablas.
7. Comprueba la seguridad: pega todo `supabase/tests/comprobar_seguridad.sql` en una consulta nueva y pulsa **Run**. Las 18 filas deben decir **OK**.

Si un archivo da error, no sigas con el siguiente: copia el mensaje y revísalo antes. Los archivos 1 a 3 no se pueden ejecutar dos veces (dirían *already exists*). El 4 sí se puede repetir sin duplicar a nadie.

### Opción B — CLI de Supabase (sin instalar nada: con `npx`)

Abre una terminal en la carpeta del proyecto (en Cursor: **Terminal → New Terminal**):

```powershell
# 1. Inicia sesión: se abre el navegador para autorizar
npx supabase@latest login

# 2. Vincula la carpeta a tu proyecto. El "project ref" es el código de la URL
#    del panel: https://supabase.com/dashboard/project/<ESTE_CODIGO>
#    Te pedirá la contraseña de la base de datos (Project Settings → Database).
npx supabase@latest link --project-ref TU_PROJECT_REF

# 3. Muestra qué migraciones faltan por aplicar (no cambia nada)
npx supabase@latest migration list

# 4. Aplica las pendientes. Pide confirmación (escribe Y)
npx supabase@latest db push
```

Después haz los pasos **6** (Exposed schemas) y **7** (comprobación) de la opción A.

En las fases siguientes, para aplicar migraciones nuevas solo hay que repetir el paso 4.

**Si ya aplicaste las migraciones con el panel y quieres pasarte a la CLI**, márcalas como aplicadas para que no intente repetirlas:

```powershell
npx supabase@latest migration repair --status applied 20261010190000 20261010190100 20261010190200 20261010190300
```

### Cómo escriben las Edge Functions (fases siguientes)

- Solo `service_role` tiene acceso. El navegador nunca habla con las tablas.
- Para que el historial sepa **quién** hizo un cambio, cada escritura se hace dentro de una transacción que primero llama a `montaigne_fix.set_actor(<id del staff>)`. Si no se llama, el cambio queda como "Sistema", o como "Solicitante" al crear el parte.
- Los triggers ajustan solos:
  - Al asignar un técnico a un parte en `nuevo`, pasa a `asignado`. Al quitarlo, vuelve a `nuevo`.
  - Al reabrir, vuelve a `asignado` si tiene técnico, o a `nuevo` si no.
  - Rellenan `assigned_at`, `resolved_at` y `closed_at`. `closed_at` también se pone al rechazar o marcar como duplicado, y es la fecha que usará el borrado a 12 meses.
- `ticket_events` y `ticket_notes` no se pueden modificar. Solo se borran junto con su incidencia.
- Los números `MF-XXXX` vienen de una secuencia. Si un alta falla a mitad, ese número se salta. Es normal.

## PIN y contraseñas

No van en el código. Son secretos del proyecto `montaigne-fix`. Hasta que no los crees, `/equipo` y `/gestion` responden que el acceso no está configurado.

Abre una terminal en la carpeta del proyecto y pega esto. El PIN y las contraseñas se piden ocultos: no aparecen en pantalla ni en el historial.

```powershell
cd "C:\Users\rs07313\Desktop\LLM Projects\Montaigne Fix"

"MF_SESSION_SECRET=$(node scripts/hash-secret.mjs session)" | Set-Content .secrets.local

$s = Read-Host "PIN del equipo (4 dígitos)" -AsSecureString
$env:MF_SECRET = [Net.NetworkCredential]::new("", $s).Password
"MF_TEAM_PIN_HASH=$(node scripts/hash-secret.mjs pin)" | Add-Content .secrets.local
Remove-Item Env:MF_SECRET

$s = Read-Host "Contraseña de Fran (mínimo 8 caracteres)" -AsSecureString
$env:MF_SECRET = [Net.NetworkCredential]::new("", $s).Password
"MF_ADMIN_PASSWORD_HASH_FRAN=$(node scripts/hash-secret.mjs password)" | Add-Content .secrets.local
Remove-Item Env:MF_SECRET

$s = Read-Host "Contraseña de Curro (mínimo 8 caracteres)" -AsSecureString
$env:MF_SECRET = [Net.NetworkCredential]::new("", $s).Password
"MF_ADMIN_PASSWORD_HASH_CURRO=$(node scripts/hash-secret.mjs password)" | Add-Content .secrets.local
Remove-Item Env:MF_SECRET

npx supabase secrets set --env-file .secrets.local --project-ref rnghppmuqbdpbkkljnsr
Remove-Item .secrets.local
```

`.secrets.local` no se sube a git. Bórralo con la última línea aunque el comando anterior falle, y no lo abras para copiarlo al chat.

**Cambiar solo el PIN o una contraseña.** Repite únicamente el bloque de esa persona (el `Read-Host` y las dos líneas de debajo) y el `secrets set`. Quien ya había entrado sigue dentro hasta que caduque su sesión: 30 días en el equipo y 7 en gestión.

**Cerrar todas las sesiones.** Genera otra firma y súbela sola:

```powershell
"MF_SESSION_SECRET=$(node scripts/hash-secret.mjs session)" | Set-Content .secrets.local
npx supabase secrets set --env-file .secrets.local --project-ref rnghppmuqbdpbkkljnsr
Remove-Item .secrets.local
```

**Si alguien se equivoca.** A la quinta vez seguida hay que esperar 15 minutos. El PIN se cuenta por conexión (la misma red cuenta junta) y cada contraseña por persona: probar la de Fran no bloquea a Curro. En el equipo, "Cambiar de persona" no vuelve a pedir el PIN. "Salir" borra la sesión de ese dispositivo.

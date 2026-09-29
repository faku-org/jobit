# Base de datos

SQLite con `bun:sqlite`. El archivo va en `data/jobit.db` (`DB_FILE` para
moverlo). WAL activado para que una lectura no bloquee una escritura, y claves
foráneas en cascada.

## Tablas

| Tabla | Qué guarda |
|---|---|
| `companies` | Empresas: nombre, slug, contacto, perfil, privacidad y estado del dominio. |
| `company_accounts` | La contraseña (argon2id), el secreto TOTP (el activo y el pendiente de un cambio), y si la cuenta está desactivada. |
| `company_sessions` | Sesiones de empresa (solo el sha256 del token). |
| `company_emails` | Correos de facturación, contacto, soporte y recuperación, con su token de verificación. |
| `company_members` | Usuarios de JobIt designados como parte de una empresa. |
| `company_recovery_codes` | Códigos de respaldo del 2FA de empresa (hasheados). |
| `company_resets` | El enlace de recuperación por correo (token hasheado). |
| `company_password_codes` | El código de correo del cambio de contraseña. |
| `offers` | Ofertas propias de las empresas. |
| `offer_daily` | Vistas y postulaciones por oferta y por día. |
| `users` | Cuentas de usuario (quien publica servicios). |
| `user_sessions`, `user_recovery_codes`, `user_sync` | Sesiones, códigos y sync de esas cuentas. |
| `admin_sessions` | Sesiones del panel de administración. |

El JSON del scraper **no** está acá: se reescribe entero en cada corrida y no
tiene transacciones, así que vive aparte.

## Migraciones

El esquema se crea con `CREATE TABLE IF NOT EXISTS` en `api/src/db.ts`. Para
columnas **agregadas después** de que una tabla existe, hay un `migrate()` que
mira `PRAGMA table_info` y hace `ALTER TABLE ADD COLUMN` una sola vez, sin
perder filas. Agregar un campo es:

1. Sumarlo al `CREATE TABLE` (para bases nuevas).
2. Sumarlo a `migrate()` (para bases que ya existen).

Los tests usan `:memory:` y no tocan el archivo real.

## Inspeccionar

```bash
sqlite3 data/jobit.db ".tables"
sqlite3 data/jobit.db "SELECT name, status FROM companies;"
sqlite3 data/jobit.db "PRAGMA table_info(companies);"
```

## Respaldo

El archivo y sus `-wal`/`-shm`. Con la API corriendo, lo correcto es el comando
de SQLite y no copiar el archivo a mano:

```bash
sqlite3 data/jobit.db ".backup 'respaldo.db'"
```

Guardá también `data/secret.key`: sin esa clave no se pueden descifrar los
secretos TOTP ni los emails.

## Empezar de cero (desarrollo)

```bash
rm -f data/jobit.db data/jobit.db-wal data/jobit.db-shm
```

Se vuelve a crear sola en el próximo arranque.

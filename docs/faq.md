# Preguntas frecuentes

## Uso

**¿Necesito cuenta para buscar trabajo?**
No. Buscar, filtrar, guardar y descartar vive en tu navegador. Solo se pide
cuenta para publicar (o para administrar una empresa).

**¿Dónde queda lo que guardé?**
En este navegador (`localStorage`). Si prendés la sincronización en la pestaña
Cuenta, además viaja cifrado a tu cuenta para tenerlo en otros navegadores.

**¿Qué se guarda de mí en el servidor?**
Nada, salvo que crees una cuenta. Lo anónimo que sale del navegador va sin
identificador y con el día y nunca la hora. El detalle está en `/privacidad`.

## Levantar el proyecto

**¿Qué necesito?**
[Bun](https://bun.sh). Nada más.

**¿Cómo arranco todo?**
```bash
bun install
bun run scrape   # o poné un worker/output/jobs.json
bun run dev      # API :3000 y web :5173
```

**¿Por qué el panel de admin me da 404?**
Sin `ADMIN_PASSWORD_HASH_FILE` (o `ADMIN_PASSWORD_HASH`) el panel queda apagado
entero, a propósito. Generá el hash, apuntá la variable en `api/.env`, y en
desarrollo agregá `ADMIN_INSECURE_COOKIES=true`.

**¿Cómo pruebo los correos sin mandarlos?**
Sin `RESEND_API_KEY` no se manda nada: el contenido queda en la consola de la
API, con el enlace adentro.

**¿Cómo empiezo de cero?**
Borrá `data/jobit.db` (y `-wal`/`-shm`). Se recrea sola.

## Empresas

**¿Por qué el 2FA es obligatorio para empresas?**
Porque publican en nombre de un tercero. Las cuentas de usuario lo tienen
opcional.

**¿Cómo entro, con correo o con usuario?**
Con el correo o con el slug (la parte de la URL de la empresa). Los dos sirven.

**¿Por qué no me deja crear la cuenta?**
Sin `JOBIT_SECRET_KEY` el alta de empresa falla cerrado: el secreto del segundo
paso no tiene dónde guardarse cifrado.

**Cargué mi red social y quedó una URL rara.**
Poné el usuario (`acme`, `@acme`) o el enlace completo; da igual. El sistema lo
normaliza. En LinkedIn, un usuario suelto es la página de empresa; una ruta
(`in/alguien`) se respeta.

**¿Cómo verifico mi sitio?**
Cargá un TXT en tu DNS: nombre `_jobit.<tu-dominio>`, valor el que muestra el
panel. Después tocá "Verificar ahora". Se re-chequea cada 24 h: si borrás el
registro, la verificación se cae.

**El correo de verificación no llega.**
Sin `RESEND_API_KEY` queda en el log de la API. Con proveedor configurado,
revisá el spam y que el dominio del remitente esté verificado en Resend
(SPF/DKIM).

**¿Cómo cambio la contraseña de la empresa?**
En Seguridad: contraseña actual, código de la app (2FA) y un código de 6 dígitos
que se manda al primer correo verificado.

**Perdí el teléfono (o el autenticador).**
Entrá con un código de respaldo, o pedí el enlace al correo de recuperación. Con
ese enlace cambiás la contraseña y volvés a activar el segundo paso.

**¿Qué hace un miembro designado?**
Figura como parte de la empresa. No entra al panel ni publica por estar ahí.

## Desarrollo

**¿Dónde va la configuración?**
`api/.env` para la API y `worker/.env` para el scraper (Bun carga el `.env` del
directorio donde corre cada cosa).

**¿Cómo corro los tests?**
```bash
bun run --cwd api test
cd web && bun test
cd worker && bun test
```

**¿Cómo agrego una columna a una tabla?**
Sumala al `CREATE TABLE` y a `migrate()` en `api/src/db.ts`. Ver
[`database.md`](database.md#migraciones).

**¿Dónde está el diseño y la arquitectura?**
En [`../DESIGN.md`](../DESIGN.md) y [`../Architecture.md`](../Architecture.md).

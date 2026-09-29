# Deploy

El detalle paso a paso está en [`../deploy/README.md`](../deploy/README.md):
usuario y carpetas, el servicio systemd, nginx, la agenda del scraper, la ingesta
y el egress. Acá va el resumen y lo específico del panel de empresa.

## Resumen

- El workflow `.github/workflows/deploy.yml` corre en un runner self-hosted
  cuando entra algo a `main` (o a mano), sube el estático a
  `/var/www/jobs.wefaber.net/`, sincroniza el repo a `/srv/jobit/`, reinstala
  dependencias y reinicia la API.
- La API corre como servicio `jobit-api` bajo `/srv/jobit`, escucha en
  `127.0.0.1:3200` y escribe en `/srv/jobit/data`.
- nginx es el único que ve internet. `/admin` y `/api/admin` están limitados a
  la VPN interna (Tailscale); `/empresas` es público porque es autoservicio.

## Configuración que hay que tener en el servidor

| Qué | Dónde | Sin eso |
|---|---|---|
| Hash del panel | `/srv/jobit/data/admin.hash` | `/api/admin` da 404. |
| Token de ingesta | `/srv/jobit/data/ingest.token` | `/api/ingest` da 404. |
| Clave de cifrado | `/srv/jobit/data/secret.key` | No hay alta de empresa (2FA obligatorio). |
| Correo | `/srv/jobit/api/.env` (`RESEND_API_KEY`, `MAIL_FROM`) | Los correos quedan en el log. |

La unidad `deploy/jobit-api.service` ya apunta a los tres archivos y carga
`/srv/jobit/api/.env` como `EnvironmentFile` opcional.

## nginx y los archivos

`/api/empresas/media/` tiene su propio `location` con `client_max_body_size 5m`:
el bloque general de `/api/` corta en 16k y no dejaría subir el banner.

`/empresas` se sirve desde `empresas.html` con su propio `location =`, igual que
`/admin` y las legales: el catch-all devolvería la app del tablero.

## Respaldos

La base (`/srv/jobit/data/jobit.db`) y **`secret.key`**. Perder la clave deja
ilegibles los secretos TOTP y los correos cifrados. Ver
[`database.md`](database.md#respaldo).

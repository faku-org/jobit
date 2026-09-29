# Arquitectura

Este documento describe cómo está armado JobIt y por qué. Es el mapa para
entender el sistema completo antes de tocar una parte. Para el detalle de cada
pieza, ver [`docs/`](docs/) y el [`README.md`](README.md).

## Qué es

Un buscador de ofertas de trabajo de Uruguay. Se puede usar sin cuenta: buscar,
filtrar, guardar y descartar vive en el navegador. Lo único que se guarda en el
servidor son las cuentas que publican (usuarios) y las empresas.

## Las piezas

```
worker/   Scrapers de portales. Escribe worker/output/jobs.json.
api/      Bun + Elysia. Sirve el tablero, las cuentas, las empresas y las páginas indexables.
web/      React 19 + Vite + Tailwind v4. Tres entradas: la app, el panel de empresa y el panel de admin.
data/     Lo que el servidor posee: SQLite, .jsonl de uso y las imágenes subidas.
deploy/   nginx, systemd y las notas de puesta en producción.
docs/     Documentación por sección, con pasos y FAQ.
```

## Flujo de una petición

```
navegador ──▶ nginx ──▶ API (127.0.0.1:3200)
                │            │
                │            ├─ jobs.json       (ofertas scrapeadas, solo lectura)
                │            ├─ jobit.db        (empresas, ofertas propias, cuentas, sesiones)
                │            ├─ data/uploads/   (logo y banner de empresas)
                │            └─ stats/events    (.jsonl anónimos)
                │
                └──▶ estático (index.html, /empresas, /admin, legales)
```

nginx es el único que ve internet. La API escucha en loopback y por eso el
`x-forwarded-for` con el que se cuentan los intentos es confiable.

## Almacenamiento

| Dónde | Qué guarda | Lo escribe |
|---|---|---|
| `worker/output/jobs.json` | Las ofertas scrapeadas. Se reescribe entero en cada corrida. | El worker, o la API por ingesta. |
| `data/jobit.db` (SQLite) | Empresas, ofertas propias, cuentas, sesiones, correos, miembros. | La API. |
| `data/uploads/` | Logo y banner de cada empresa. | La API. |
| `data/stats.jsonl`, `data/events.jsonl` | Uso anónimo, sin identificador. | La API. |
| `localStorage` | Guardadas, descartes, perfil, preferencias, seguimiento. | El navegador. |

El JSON del scraper no es lugar para algo que la app edita: se reescribe entero
y no tiene transacciones. Por eso las empresas y las ofertas propias viven en
SQLite, aparte.

## Identidad y sesiones

Hay **tres identidades que no se cruzan**, cada una con su cookie y su tabla:

| Quién | Cookie | Alcance | Cómo entra |
|---|---|---|---|
| Panel de administración | `jobit_admin` | `/api/admin` | Una clave argon2id en un archivo del entorno. |
| Quien publica un servicio | `jobit_session` | `/api` | Handle + contraseña; 2FA opcional. |
| Una empresa | `jobit_company` | `/api/empresas` | Correo o slug + contraseña; **2FA obligatorio**. |

Reglas comunes:

- El token nunca se guarda: solo su sha256. Una copia de la base no alcanza
  para hacerse pasar por una sesión abierta.
- Las cookies son `HttpOnly`, `SameSite` (Lax para cuentas, Strict para paneles)
  y `Secure` salvo en desarrollo (`ADMIN_INSECURE_COOKIES=true`).
- Los intentos de login están limitados por dirección.
- Nada de IP, user agent ni historial de inicios: las filas se estampan con el
  día, y solo cuando hace falta.

El segundo paso es TOTP (RFC 6238) con HMAC-SHA1, armado sobre `crypto.subtle`.
El secreto se cifra en reposo con AES-256-GCM y una clave que vive en
`JOBIT_SECRET_KEY_FILE`. Sin esa clave, el 2FA de empresa falla cerrado: no hay
alta.

## Privacidad (Zero Data Policy)

- Buscar trabajo no pide cuenta ni deja nada en el servidor.
- El uso que sale del navegador va sin identificador, en lote y con el día y
  nunca la hora. La API lo recorta contra vocabularios antes de escribirlo, así
  que un archivo no puede terminar guardando texto libre.
- El email y el secreto TOTP se cifran en reposo. El sync entre navegadores es
  un JSON opaco que el servidor no interpreta.
- Las métricas de una empresa son contadores por oferta y por día: dicen
  cuántas veces, nunca quién.

## Correo

Los enlaces de verificación de correo, de recuperación y los códigos de cambio
de contraseña salen por **Resend** (API HTTP con `fetch`, sin dependencia). Sin
`RESEND_API_KEY` no se manda: el contenido queda en el log de la API, que
alcanza para probar el recorrido en local.

## Verificación de dominio

El sitio de una empresa se verifica con un registro DNS TXT
(`_jobit.<dominio>` con valor `jobit-verify=<token>`). La API consulta el TXT al
guardar, a pedido y cada 24 horas: si el registro desaparece, la verificación se
cae. Es un estado vivo, no una marca que se saca una vez.

## Decisiones que conviene no revertir sin pensar

- **Better Auth quedó descartado**: exige email para todo usuario, guarda el
  token sin hashear y no cifra el secreto TOTP, las tres cosas que la política
  de datos evita.
- **El email es opcional** en las cuentas de usuario (se entra por handle), para
  que quien no quiera dar un correo pueda igual publicar.
- **El 2FA es obligatorio solo para empresas**, porque publican en nombre de un
  tercero.
- **Las redes sociales aceptan usuario o URL**: el servidor decide y normaliza,
  así nadie tiene que adivinar el formato.
- **La verificación de dominio es DNS TXT y no un correo**: no hace falta que el
  dominio tenga casilla, y se re-chequea sola.
- **El panel de empresa es su propio bundle**: quien busca trabajo no se baja el
  código de administrar empresas.

## Dónde mirar primero

| Querés tocar… | Andá a |
|---|---|
| El tablero, filtros o ranking | `api/src/filter.ts`, `api/src/rank.ts`, `web/src/App.tsx` |
| Las cuentas | `api/src/users.ts`, `api/src/account.ts`, `web/src/components/account/` |
| El panel de empresa | `api/src/empresas.ts`, `api/src/company-*.ts`, `web/src/empresas/` |
| El scraper | `worker/src/` |
| El diseño | [`DESIGN.md`](DESIGN.md) |
| El despliegue | [`deploy/README.md`](deploy/README.md) |

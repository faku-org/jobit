# Panel de empresa

En `/empresas`, con su propio bundle: quien busca trabajo no se baja el código
de administrar una empresa. La empresa entra con su cuenta, ve cómo rinden sus
publicaciones y administra su perfil. El alta es autogestionada y **nace
pendiente**: el admin la aprueba desde `/admin` y recién ahí puede publicar.

## Cuenta y sesión

- La cuenta vive en `company_accounts` (más `company_sessions` para las
  sesiones) y es otra cookie: `jobit_company`, `HttpOnly`, `SameSite=Strict`,
  alcance `/api/empresas` y 30 días con renovación. No se cruza con la del panel
  ni con la de usuario.
- Se entra con el correo o con el slug. El correo es obligatorio.
- Todo lo de la API está acotado a la empresa de la sesión: una oferta ajena
  responde 404 igual que una que no existe.

## Segundo paso obligatorio

El alta y el ingreso **no abren sesión**: devuelven un desafío firmado de diez
minutos y piden el código TOTP.

```
POST /api/empresas/auth/register  -> { status: "totp_setup_required" }
POST /api/empresas/auth/totp/setup            (sin code) -> { secret, otpauth }
POST /api/empresas/auth/totp/setup  { code }  -> sesión + recovery_codes
```

En el ingreso, si la cuenta ya tiene TOTP, el estado es `totp_required` y se
cierra con `POST /api/empresas/auth/totp`. Sin `JOBIT_SECRET_KEY` no hay alta:
el secreto no tiene dónde guardarse cifrado y falla cerrado.

Los códigos de respaldo se muestran una sola vez y en la base queda su sha256.
Si se pierde el teléfono:

- `POST /api/empresas/auth/recover` con un código de respaldo, o
- `POST /api/empresas/auth/recover/email` manda un enlace al correo de
  recuperación **verificado**; `POST /api/empresas/auth/recover/reset` cambia la
  contraseña con ese token y vuelve a pedir el segundo paso.

## Contraseña

Mínimo de seguridad compartido con las cuentas de usuario: 10 caracteres y al
menos dos tipos entre mayúsculas, minúsculas, números y símbolos. El alta pide
repetirla.

**Cambiarla pide 2FA y un código por correo** (además de la actual):

```
POST /api/empresas/me/password/email   -> manda un código de 6 dígitos al primer correo verificado
PATCH /api/empresas/me  { current_password, new_password, totp_code, email_code }
```

## Las áreas del panel

El panel de la empresa se divide en áreas separadas, una por vez, cada una con
su propio guardado. Nunca es un scroll largo.

| Área | Qué tiene | Endpoint |
|---|---|---|
| Imagen | Logo y banner (se guardan al subir). | `POST`/`DELETE /api/empresas/media/:kind` |
| Identidad | Nombre, teléfono con país y sitio + verificación. | `PATCH /api/empresas/me` |
| Redes | LinkedIn, Instagram, Facebook, X, YouTube, TikTok, WhatsApp. | `PATCH /api/empresas/me` |
| Correos | Facturación, contacto, soporte y recuperación, con verificación. | `/api/empresas/emails/:kind` |
| Privacidad | Qué se muestra en la ficha pública. | `PATCH /api/empresas/me` |
| Miembros | Usuarios de JobIt designados. | `/api/empresas/members` |
| Seguridad | Cambio de contraseña con 2FA + correo. | `/api/empresas/me` |

### Redes: usuario o URL

Se puede cargar el usuario (`acme`, `@acme`) o el enlace completo, con o sin
`https://`. El servidor decide y normaliza:

| Entrada | Resultado |
|---|---|
| `acme` en Instagram | `https://www.instagram.com/acme` |
| `acme` en LinkedIn | `https://www.linkedin.com/company/acme` |
| `in/alguien` en LinkedIn | `https://www.linkedin.com/in/alguien` |
| `facebook.com/acme` | `https://facebook.com/acme` |
| `+598 99 123 456` en WhatsApp | `https://wa.me/59899123456` |

Un esquema que no sea http(s) (`javascript:`, `mailto:`) se rechaza.

### Teléfono

Se elige el país de un menú con banderas; el prefijo lo pone el sistema y el
teléfono se guarda completo (`+598 99 123 456`) con el país en
`phone_country`.

### Verificación del sitio (DNS TXT)

El sitio queda verificado mientras exista un registro TXT:

- **Nombre**: `_jobit.<dominio>` (por ejemplo `_jobit.acme.com`).
- **Valor**: `jobit-verify=<token>` (lo muestra el panel, con botón de copiar).

`POST /api/empresas/me/website/verify` consulta el DNS. Se re-verifica al
guardar, a pedido y cada 24 horas; si el registro se borra, la verificación se
cae. Cambiar el dominio pide un token nuevo.

### Correos

Cada correo (facturación, contacto, soporte, recuperación) se confirma con un
enlace de un solo uso que vence a las 24 horas. El de recuperación es el alterno
al de contacto y es la salida para recuperar la cuenta. Los enlaces salen por
Resend; sin `RESEND_API_KEY` quedan en el log.

### Miembros

`POST /api/empresas/members { handle }` designa a un usuario de JobIt como parte
de la empresa. Es solo la designación: no entra al panel ni publica por estar
ahí.

## Métricas

`offer_daily` suma vistas y postulaciones por oferta y por día: dice cuántas
veces, nunca quién. Suben por el canal anónimo de `/api/events` y solo para las
publicadas acá.

## Probar en local

```bash
cp api/.env.example api/.env   # descomentá ADMIN_PASSWORD_HASH_FILE, ADMIN_INSECURE_COOKIES y JOBIT_SECRET_KEY_FILE
bun -e 'await Bun.write("data/secret.key", Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url"))'
bun run dev
```

Creá la empresa en `/empresas` (con su segundo paso), aprobala en `/admin` y
recién ahí publica. Los correos de verificación, sin `RESEND_API_KEY`, quedan en
la consola de la API con el enlace para abrirlos a mano.

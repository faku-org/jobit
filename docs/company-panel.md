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

## Seguridad

La sección de Seguridad son cuatro acciones sueltas, cada una con su tarjeta y
su propio pedido. Ninguna comparte formulario con las demás.

- **Cambiar el segundo paso.** `POST /api/empresas/me/totp/setup { password }`
  genera un secreto nuevo y lo deja *pendiente*; con
  `{ password, code }` lo confirma. El secreto viejo sigue activo hasta ese
  momento, así que abandonar el cambio no deja la cuenta sin 2FA. Al confirmar
  se cierran las demás sesiones y se renuevan los códigos de respaldo.
- **Lockdown** (emergencia). `POST /api/empresas/me/lockdown { password, totp_code }`
  cierra la sesión en todos los dispositivos —esta incluida— y renueva los
  códigos de respaldo. Los códigos viajan en la respuesta para mostrarlos una
  sola vez antes de que la cookie desaparezca.
- **Desactivar la cuenta.** `POST /api/empresas/me/deactivate { password, totp_code }`
  apaga la cuenta hasta que se recupere. Pide que el correo de recuperación esté
  **verificado** y manda el enlace en el momento: sin esa puerta, nadie podría
  volver. Recuperar el acceso es el mismo `recover/reset` de siempre, que además
  la vuelve a encender.
- **Cambiar la contraseña.** La de arriba, con 2FA y código por correo.

Las cuentas desactivadas no entran ni con la contraseña ni con el código de
respaldo: la única salida es el enlace del correo de recuperación.

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
| Seguridad | Cambiar 2FA, cambiar contraseña, lockdown y desactivar cuenta. | `/api/empresas/me/totp/setup`, `/me/lockdown`, `/me/deactivate`, `/me` |

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

`GET /api/empresas/metrics?days=7|30|90` arma el Resumen:

- **Visitas a la empresa**, **publicaciones** y **postulaciones** en la ventana.
- **Serie diaria completa** (vistas y postulaciones), con los días en cero
  incluidos, que es lo que alimenta la gráfica.
- **Palabras clave**: las habilidades que nombran las publicaciones de la
  empresa, contadas con el catálogo de `worker/src/skills.ts` — la misma
  extracción que ya usa el informe de mercado. Es lo que después alimenta el
  recomendador.
- **Puestos más buscados**: los roles que la gente buscó en JobIt en la ventana,
  leídos de los eventos anónimos (`usage.ts`). Es un corte agregado: dice qué
  se busca, nunca quién.
- Los rankings de **más vistas** y **más postuladas**.

Ninguna de estas lecturas agrega una fila por persona: las visitas y las
postulaciones son contadores por oferta y por día, y lo buscado viene de las
búsquedas anónimas que ya se reciben.

## Probar en local

```bash
cp api/.env.example api/.env   # descomentá ADMIN_PASSWORD_HASH_FILE, ADMIN_INSECURE_COOKIES y JOBIT_SECRET_KEY_FILE
bun -e 'await Bun.write("data/secret.key", Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url"))'
bun run dev
```

Creá la empresa en `/empresas` (con su segundo paso), aprobala en `/admin` y
recién ahí publica. Los correos de verificación, sin `RESEND_API_KEY`, quedan en
la consola de la API con el enlace para abrirlos a mano.

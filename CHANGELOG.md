# Registro de cambios

Lo que cambia en JobIt, versión por versión. Cada entrada separa lo que toca a
tus datos ("Datos y privacidad") del resto, para que no haya que leer todo
para encontrar eso. La política vigente está en
[/privacidad](https://jobs.wefaber.net/privacidad) y qué commit se sirve, en
[/verificar](https://jobs.wefaber.net/verificar).

Las fechas son las del commit que llega a producción. Lo que está en
"Sin publicar" existe en el repositorio pero todavía no en el sitio.

## Sin publicar

### Datos y privacidad

- **Publicar un servicio pide un correo confirmado.** Buscar trabajo sigue sin
  pedir nada. El correo se confirma con un enlace que vence a las 24 horas; de
  la confirmación queda el sha256 del correo y la fecha.
- **El correo lo manda Resend**, el primer proveedor que procesa un dato de
  una persona por nosotros: recibe la dirección y un texto corto sin contenido
  (enlaces de confirmar y restablecer, avisos de cuenta). Texto plano, sin
  píxel de apertura ni enlaces reescritos. Por qué Resend y no otro:
  [docs/correo.md](docs/correo.md).
- **Recuperar la contraseña por correo**, con un enlace de un solo uso que vence
  a los 30 minutos. De cada enlace se guarda solo su sha256. La respuesta es la
  misma exista o no la cuenta.
- **Llaves de acceso (WebAuthn) en lugar del código de seis dígitos.** De cada
  llave se guarda la clave pública, un nombre y el día. Las cuentas con código
  lo siguen usando hasta agregar una llave; ahí el secreto se borra.
- **La política dice cómo va cifrado el sync de verdad:** con una clave del
  servidor, que protege de una copia robada de la base pero no de nosotros.
  Antes decía "el servidor no lo lee", que era cierto como conducta y no como
  garantía técnica.
- **Se puede verificar qué código se sirve.** `/version.json` publica el commit
  y el sha256 de cada archivo; `bun run verificar` buildea ese commit y compara
  byte a byte; una tarea pública lo corre a diario. La política agrega la
  sección "El código que te servimos" con el límite honesto de todo esto.

### Seguridad

- nginx servía `/`, `/index.html`, `/empresas` y `/assets/` **sin CSP, sin HSTS
  y sin nosniff**: un `add_header` dentro de un `location` anula los del
  server. La caché ahora se pone con `expires`, que no rompe la herencia.
- `/admin.html` se podía pedir por su nombre desde fuera de la VPN: el
  catch-all lo servía. La API del admin siempre estuvo cerrada; ahora la
  página también.
- Los límites de pedidos cuentan solo por `X-Real-IP`, que pone nuestro
  nginx. `X-Forwarded-For` se ignora: se podía inventar para esquivarlos.
- Límite propio para lo que se escribe con sesión (servicios, cuenta) y para
  el login de empresas, que antes compartía el de lectura.

### Agregado

- Servicios de emprendedores: publicar, editar y retirar, con moderación
  (#28).
- Página [/verificar](https://jobs.wefaber.net/verificar).

## 2026-09-28

### Datos y privacidad

- Cuentas de empresa con panel propio en `/empresas`. El correo de la empresa
  es obligatorio: es por donde se le escribe por soporte y referencias.
- Métricas por oferta para la empresa que la publicó: vistas y clicks en "Postularme" por día,
  sin nada que identifique a quien miró.

## 2026-09-24

### Datos y privacidad

- Sync opcional de perfil, preferencias, guardadas, postulaciones y fuentes
  entre navegadores. Viene apagado y apagarlo lo borra.

## 2026-09-22

### Datos y privacidad

- Cuentas de personas: handle, nombre visible, hash argon2id de la contraseña y
  correo opcional cifrado en reposo. Borrar la cuenta la borra de verdad.

## 2026-09-05

### Datos y privacidad

- Primera versión publicada de los términos y la política de privacidad.

## 2026-09-03

### Datos y privacidad

- Telemetría anónima de búsquedas y postulaciones: sin identificador, con día
  y sin hora, con el JSON exacto visible en Perfil y un interruptor para
  apagarla.
- El CV se lee en el navegador y no se sube a ningún lado.

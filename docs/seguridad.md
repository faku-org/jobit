# Revisión de seguridad de la API

Estado al agregar las cuentas (#27) y los servicios (#28). Lo que sigue es lo
que se miró, lo que se arregló y lo que queda abierto a sabiendas.

La superficie es chica y conviene decirla entera: una API Elysia sobre Bun,
detrás de nginx, escuchando en `127.0.0.1`. Una base SQLite. Dos sesiones por
cookie, la del panel y la de las cuentas. Un archivo JSON que escribe el worker
y que la API solo lee. Nada de esto habla con servicios de terceros.

## Lo que se arregló acá

### 1. El límite de peticiones no limitaba nada

`clientKey` contaba por el **primer** elemento de `x-forwarded-for`. nginx arma
esa cabecera con `$proxy_add_x_forwarded_for`, que **agrega** el peer a lo que
el cliente haya mandado: todo menos el último salto es texto que escribió quien
llama.

O sea que bastaba con mandar `X-Forwarded-For: <número al azar>` en cada
petición para tener un balde nuevo cada vez. El límite de escritura, el de
lectura y el de intentos de clave del panel: los tres, evadibles con una línea
de curl. No es teórico, está en el test.

Ahora se cuenta por `x-real-ip`, que nginx escribe con `$remote_addr` y pisa
venga como venga de afuera. `x-forwarded-for` no se mira, y no es un olvido:
como `x-real-ip` dice lo mismo sin la parte que puso el cliente, la otra sobra.
Si no hay `x-real-ip` es porque no hay proxy adelante, y entonces la dirección
del socket es la verdad.

**Si alguien saca la línea `proxy_set_header X-Real-IP` de nginx, el límite
pasa a contar a todo el mundo en un solo balde.** Está anotado en el `.conf`.

### 2. Solo se contaba POST

El presupuesto de escritura se aplicaba con `request.method === "POST"`. Un
`PATCH` o un `DELETE` caían en el de lectura: 120 por minuto en vez de 20 por
hora. Con el panel importaba poco, porque atrás había una sesión. Con
`/api/services` y `/api/me` habría sido la puerta principal.

Ahora cuenta cualquier método que cambie algo, y hay un presupuesto separado
para lo que guarda alguien con sesión (60 por hora), que no es el mismo que el
de la fila de estadística que el navegador manda una vez al día.

### 3. Probar contraseñas no tenía su propio presupuesto

`/api/auth` entraba en el balde de escritura, que cuenta por hora. Ahora tiene
el suyo: diez intentos cada quince minutos, el mismo que ya tenía el login del
panel. `/api/auth/logout` queda afuera porque no es una credencial a probar y
no tiene por qué gastarle el presupuesto a quien está entrando.

### 4. nginx cortaba el cuerpo antes de que llegara

`client_max_body_size 16k` quedó de cuando lo único que se mandaba por POST era
una fila de estadística. Una oferta del panel admite 20.000 caracteres de
descripción y otros tantos de requisitos: eso ya volvía `413` desde nginx sin
llegar nunca a la API. Es disponibilidad, no confidencialidad, pero rompía una
función que el código creía tener. Subido a 64k.

### 5. Un `*` en CORS_ORIGIN habría abierto las sesiones

El cors de Elysia manda `access-control-allow-credentials: true` siempre, así
que lo único que separa la cookie de cualquier página de internet es la lista
de orígenes. Un `*` ahí no abre "una API pública": abre la sesión de quien
tenga la pestaña abierta. Ahora se descarta con un error en el arranque en vez
de aceptarse.

Verificado: con la lista puesta, un origen que no está en ella no recibe
`access-control-allow-origin`.

### 6. Clickjacking sobre la app, que antes no tenía dónde morder

El CSP deja `frame-ancestors *` a propósito: el `?embed=` existe para que otra
página muestre una oferta adentro suyo. Mientras lo enmarcado era un tablero de
solo lectura, enmarcarlo no servía de nada.

Con sesiones sí sirve: una página ajena mete la app en un iframe, la tapa con
una capa invisible y se cobra un clic donde nadie lo ve. `SameSite=Lax` no
protege de esto, porque adentro del iframe la petición es del mismo sitio.

La oferta se sigue pudiendo enmarcar. La app, no: sin `?embed=` y adentro de un
frame, no se dibuja.

## Lo que se miró y está bien

- **SQL.** Todas las consultas van con parámetros. Lo único que se interpola es
  una lista de columnas declarada como constante en el módulo.
- **XSS.** No hay un solo `dangerouslySetInnerHTML`, `innerHTML` ni `eval` en
  `web/`. React escapa lo que pinta. Las URLs que entran por formulario
  (`companies`, `offers`, `services`) se validan a `http(s)`: un `javascript:`
  se rechaza, con test.
- **Tokens de sesión.** 256 bits del CSPRNG, y en la base solo el sha256. Una
  copia de la base no alcanza para hacerse pasar por una sesión abierta. Cada
  login emite un token nuevo.
- **Cookies.** `HttpOnly` las dos. El panel `SameSite=Strict` con camino
  `/api/admin`; las cuentas `Lax` con camino `/api`, que igual no viaja en un
  POST de otro origen. `Secure` salvo la variable de escape de desarrollo.
- **Contraseñas.** argon2id por `Bun.password`. Un login a un handle que no
  existe verifica igual contra un hash de descarte, así que no se puede saber
  quién está registrado midiendo lo que tarda.
- **Secretos en reposo.** Correo y secreto TOTP con AES-256-GCM. Autenticado: un
  byte cambiado no descifra, no descifra cualquier cosa.
- **Falla cerrado.** Sin `ADMIN_PASSWORD_HASH` el panel contesta 404 entero. Sin
  `ACCOUNT_KEY`, las cuentas y los servicios también.
- **Autorización.** Un servicio ajeno contesta 404, no 403: el id no sirve para
  saber si hay algo del otro lado.

## Lo que queda abierto

Por orden de lo que más molesta.

1. **El `access_log` de nginx guarda la IP al lado de la query.** Ya estaba
   admitido en la política y con cuentas empeora: ahora al lado hay un
   `POST /api/auth/login`. Es #34 y es la contradicción más grande que tiene
   hoy la Zero Data Policy escrita.

2. **El secreto TOTP lo puede leer JobIt, y no hay forma de que no.** Verificar
   un código exige tener el secreto con el que se generó. Está cifrado en
   reposo, pero con una clave nuestra. Es la única excepción que queda a la
   regla de cero acceso, y la salida es WebAuthn: ver
   [`cero-acceso.md`](cero-acceso.md).

   De ahí sale la regla operativa: **`data/jobit.db` y `data/account.key` no
   pueden viajar juntos a un respaldo.** Si van juntos, el cifrado no protege de
   nada. Va en el runbook de despliegue.

3. **`stats.jsonl` y `events.jsonl` crecen sin techo.** No hay rotación ni tope.
   El límite de peticiones lo hace lento, no imposible. Un `logrotate` o un tope
   por archivo alcanza.

4. **El limitador vive en memoria y en un solo proceso.** Reiniciar la API borra
   todos los baldes. Y como la tabla tiene tope, alguien con muchas direcciones
   puede empujar afuera los baldes de otros. Es #12 (Redis) el día que haya más
   de un proceso.

5. **El alta dice si un handle está tomado.** Es enumeración de usuarios y no
   tiene vuelta: sin eso no se puede elegir un nombre. El login no filtra nada,
   que es donde importa.

6. **No hay recuperación más que los códigos de respaldo.** No es que falte
   implementar el reset por correo: no se guarda correo, a propósito, porque
   sería un dato de una persona que JobIt puede leer. Quien pierda los códigos
   pierde la cuenta, está avisado en el alta con todas las letras, y es lo que
   más soporte va a generar. Con las postulaciones cifradas va a ser peor:
   perderlos pasa a ser perder el contenido, no solo el acceso.

7. **El panel tiene una sola contraseña y no tiene segundo factor.** La
   contramedida disponible hoy es la lista de direcciones que ya está comentada
   en el `nginx.conf`. Si el panel se administra siempre desde los mismos
   lugares, conviene descomentarla.

8. **`/api/stats` y `/api/events` los puede llenar cualquiera.** No hay identidad
   por diseño, así que las métricas son "lo que llegó", no "lo que pasó". No es
   un agujero de seguridad, es un límite de lo que #32 puede prometer, y
   conviene que #32 lo diga en vez de dar los números como si fueran censo.

9. **No hay token de CSRF: se depende de `SameSite`.** Contra los navegadores de
   hoy alcanza. Vale tenerlo escrito para cuando alguien lo pregunte.

## Cómo verificar

```
bun run typecheck
bunx oxlint .
bun test
```

Los baldes de límite, el saneo de URLs, el cifrado en reposo, los vectores TOTP
del RFC 6238 y que ni el token ni los códigos de respaldo queden en claro en la
base tienen cada uno su test.

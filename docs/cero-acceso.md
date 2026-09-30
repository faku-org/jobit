# Cero acceso: que JobIt no pueda leer lo que se manda

La regla, dicha corta: **a los datos de una persona llegan esa persona y la
empresa a la que le escribió. JobIt no.** Telemetría anónima sí, nada más.

Eso no se implementa con una promesa en la política. Se implementa haciendo que
el servidor guarde algo que no puede abrir, y aceptando lo que eso cuesta.

## Dos clases de datos

La regla necesita una distinción que al principio no estaba y que resolvió la
contradicción con el correo:

- **Datos de cuenta**: lo que hace falta para operar la cuenta. Handle, hash de
  la contraseña, correo, llaves de acceso, datos de facturación el día que
  haya. JobIt los tiene porque sin ellos no puede cumplir su parte: escribirte
  para confirmar, dejarte recuperar el acceso, contestarle a una empresa por
  soporte. Se guardan los mínimos y se dice cuáles.
- **Datos de contenido**: lo que la persona produce para otro. Postulaciones,
  CV, respuestas a preguntas del reclutador, y lo que se sincroniza entre
  navegadores. Esto es lo que JobIt no debe poder leer. Se cifra en el
  navegador.

El correo es dato de cuenta. En las cuentas de empresa siempre fue
obligatorio y en claro (es su contacto); en las de personas es opcional para
buscar, obligatorio y confirmado para publicar, y va cifrado en reposo con
clave del servidor. Lo manda Resend, y por qué ese y no otro está en
[correo.md](correo.md).

## Dónde estamos

| Qué                               | Estado                                                                        |
| --------------------------------- | ----------------------------------------------------------------------------- |
| Segundo paso                      | **Hecho.** WebAuthn: el servidor guarda claves públicas, nada más.            |
| Secreto TOTP                      | Solo cuentas viejas; se borra al agregar una llave.                           |
| Correo                            | Dato de cuenta, cifrado con clave del servidor. Decidido.                     |
| Verificar el código servido       | **Hecho.** Build reproducible, `/version.json`, `bun run verificar`.          |
| Núcleo de cifrado en el navegador | **Hecho y probado.** `web/src/lib/e2e.ts`. Sin cablear todavía.               |
| Sync                              | Cifrado con clave del servidor: **JobIt podría leerlo.** La política lo dice. |
| Postulaciones                     | No existen todavía. Nacen cifradas, con cabecera de cribado.                  |

## El esquema, como quedó implementado

Todo con WebCrypto nativo. El código es `web/src/lib/e2e.ts`; los tests
(`e2e.test.ts`) prueban además los ataques: casillero robado, contexto
cruzado, un bit cambiado, un casillero trasplantado de otro sobre. Se probó en
Chromium que interopera con Bun en los dos sentidos.

### 1. Un secreto, dos claves

```
master = PBKDF2-SHA256(secreto, sal, 600.000)     <- lo caro, una vez
auth   = HKDF(master, "jobit/v1/<tipo>/auth")      -> va al servidor
wrap   = HKDF(master, "jobit/v1/<tipo>/wrap")      -> no sale del navegador
```

El servidor recibe `auth` en lugar de la contraseña y le aplica argon2id
encima, como hoy. De `auth` no se llega a `wrap` sin volver a pasar por el
secreto.

**El KDF es PBKDF2, y la razón es el CSP.** Argon2id aguanta mucho mejor una
GPU, pero en el navegador solo existe como WASM, y cargar WASM pide
`'wasm-unsafe-eval'` en `script-src`. Aflojar el CSP para endurecer el KDF es
cambiar un riesgo por otro. Los parámetros (`kdf`, `iterations`, `salt`)
viajan con cada cuenta, así que pasar a Argon2id el día que convenga es
reenvolver una clave, no recifrar nada.

Costo medido: ~110 ms por derivación en un servidor x64 con Chromium. En un
teléfono de gama media, estimo entre 0,3 y 0,6 s. Se paga al entrar, no en
cada acción.

**Lo que esto deja expuesto, dicho claro:** quien robe la base tiene la clave
privada envuelta y su sal. Probar una contraseña le cuesta un PBKDF2 de
600.000 vueltas, sin pasar por el argon2id del servidor. Contra contraseñas
débiles eso no alcanza, y hoy el mínimo es de 8 caracteres
(`MIN_PASSWORD` en `api/src/users.ts`). Con el cifrado activo ese mínimo tiene
que subir a 12 para las cuentas que migren: es lo que separa "robaron la base"
de "leyeron el contenido".

### 2. Cada cuenta tiene un par de claves

ECDH P-256, generado en el navegador en el alta. La pública se guarda tal cual.
La privada se guarda envuelta con `wrap` (AES-256-GCM, con la etiqueta
"password" como dato asociado). Al entrar, el navegador baja el blob y lo abre.

La privada que sale de abrir el blob **no es exportable**: ni un script
inyectado la puede sacar del navegador. La puede usar mientras la página esté
abierta, que es el límite de cualquier cifrado en una página web.

### 3. Cada contenido es un sobre

```
clave        = AES-256-GCM al azar, una por sobre
datos        = cifrar(contenido, clave, AAD = contexto)
casillero_i  = envolver(clave, ECDH(efímera_i, pública_i) -> HKDF)
```

Un sobre de postulación lleva dos casilleros, la empresa y quien postula (así
puede releer lo que mandó). El sync lleva uno, el propio.

El **contexto** ("sync", "application:<id>") va como dato asociado en el
contenido y en cada casillero. Un sobre cerrado para una postulación no abre
como otra, y el servidor no puede cambiar blobs de lugar.

### 4. Los códigos de respaldo, y un agujero que había

Con cifrado de punta a punta, cambiar la contraseña ya no alcanza para
recuperar: la privada está envuelta con la vieja. Así que **cada código envuelve
su propia copia de la privada**.

Al diseñarlo apareció un problema en lo que hay hoy: el servidor guarda
`sha256(código)`. Para autenticar alcanza, pero el día que un código abra una
copia de la privada, ese hash es un atajo offline: ~49 bits por código a
velocidad de GPU son horas. **Los códigos pasan por el mismo `derive()` que la
contraseña** y el servidor guarda argon2id del `auth` del código, no el sha256.

Una sal para los ocho códigos de la cuenta, no una por código: quien recupera
no sabe cuál tiene en la mano, y con una sal por código habría que correr ocho
PBKDF2. Así corre uno y prueba el desenvolver (barato) contra cada copia. Quien
ataque prueba cada intento contra los ocho a la vez; con ~49 bits y 600.000
vueltas por intento, sigue siendo inviable.

**Perder contraseña y códigos es perder el contenido.** No hay reset posible,
por diseño. El correo recupera la cuenta, no lo cifrado.

### 5. Cambiar la contraseña es barato

Se reenvuelve la privada con el `wrap` nuevo. Ningún sobre se toca.

## La migración, en orden

Nada de esto rompe a nadie si se hace así:

1. **Parámetros públicos por handle.** `GET /api/auth/params?handle=` devuelve
   `{kdf, iterations, salt}`. Para un handle que no existe devuelve una sal
   falsa pero estable (`HMAC(clave del servidor, handle)`), para no confirmar
   qué cuentas existen.
2. **Migración perezosa al entrar.** Una cuenta vieja entra con la contraseña
   en claro, como hoy. En ese momento el navegador la tiene, así que crea la
   bóveda (`createVault`), manda `auth`, la bóveda y códigos nuevos. El
   servidor reemplaza argon2id(contraseña) por argon2id(auth), guarda la
   bóveda y marca la cuenta como `auth_v = 2`. Desde ahí la contraseña no
   vuelve a viajar.
3. **Códigos nuevos al migrar.** Los viejos están como sha256: se descartan y
   se muestran ocho nuevos, una vez. Es un paso más en el primer ingreso, y es
   el precio de cerrar el atajo del punto 4.
4. **El sync se recifra en el navegador.** Primer ingreso migrado: el navegador
   baja el sync viejo (el servidor lo descifra una última vez), lo cierra para
   la propia pública con contexto `sync`, lo sube, y el servidor borra el
   formato viejo. `PUT /api/me/sync` pasa a aceptar solo sobres. El servidor
   ya no puede validar la forma de lo que guarda, solo el tamaño.
5. **La clave en la sesión.** Para no pedir la contraseña en cada recarga, la
   privada (no exportable) se guarda en IndexedDB mientras la sesión viva; un
   `CryptoKey` no exportable sigue sin serlo ahí. Salir la borra.
6. **Reset por correo.** Recupera la cuenta y deja la bóveda cerrada: con un
   código se reabre; sin código, se crea una nueva y el sync arranca de lo que
   haya en ese navegador. Hay que decirlo en la pantalla de reset, no
   descubrirlo después.
7. **Apagar el camino viejo.** Cuando no quede ninguna cuenta en `auth_v = 1`
   con sync, o a los 90 días, se saca el descifrado del sync con clave del
   servidor. Ahí la política puede cambiar la frase del sync.

Las llaves de acceso no cambian: siguen siendo el segundo paso. Cuando la
extensión PRF de WebAuthn esté en todos lados, cada llave puede envolver su
propia copia de la privada y entrar sin contraseña. Hoy no está en todos lados,
y por eso no se usa.

## Lo que rompe, y lo que se decidió

### El cribado: cabecera afuera del sobre (decidido)

La API no puede puntuar lo que no puede leer. Se eligió la **cabecera de
cribado**: ids de catálogo (nivel, años, rubro, departamento, respuestas de
opción múltiple a las preguntas del reclutador), sin nombre, sin contacto, sin
texto libre, **y sin vínculo con la cuenta**. El servidor ordena y filtra por
eso sin saber de quién es cada fila. El resto va en el sobre.

`{senior, 5 años, tecnología, Montevideo}` suelto no es un dato directo de una
persona. Pegado a un `user_id` sí, y por eso la fila no lo tiene.

### El vínculo postulación ↔ persona

`applications` **no tiene `user_id`**. Quien postula guarda la lista de lo
suyo en su navegador y, cifrada para sí, en el servidor. El servidor ve un blob
por persona y su tamaño.

## ¿Esto le cierra la puerta a la IA o a lo pago?

La pregunta vino con una propuesta: generar un `user_id` al suscribirse, a
cambio de funciones más completas. Dos cosas por separado, porque mezcladas
esconden la tensión.

**El `user_id` ya existe.** Toda cuenta tiene uno. Lo que el esquema evita no
es identificar a la persona sino **guardar el vínculo** entre la persona y su
contenido. Identificar para cobrar, para limitar o para escribirle es dato de
cuenta y es compatible.

**El rate limit no necesita el vínculo.** Postular pide sesión, y al momento
del pedido el servidor sabe quién es: puede contar en memoria, como el
limitador de hoy, y no escribirlo. Lo que se promete es que **no queda
guardado**, no que el servidor no lo sepa nunca. La política lo tiene que decir
con esas palabras. Un contador persistente por día (`user_id, día, cantidad`)
también es aceptable: dice cuánto, no a qué.

**Lo pago tampoco.** Una suscripción es facturación: dato de cuenta, y el que
lo ve de verdad es el procesador de pagos.

**La IA sí tiene un costo, y es este:** no hay IA de fondo sobre lo guardado.
"Analizamos tus postulaciones todas las noches" no existe, porque el servidor
no las puede leer. Lo que sí existe:

1. **IA en el navegador.** Modelos chicos locales (la Prompt API de Chrome,
   transformers.js). Cero acceso intacto. Hoy limitada; mejora rápido.
2. **IA por acción, con consentimiento en esa acción.** El navegador descifra
   y manda ese contenido puntual a un endpoint que lo procesa y no lo guarda.
   En ese pedido JobIt (y el proveedor del modelo, que es otro encargado) ve el
   contenido. Es una excepción a la regla, y solo vale si la persona la elige
   ahí, sabiendo eso, cada vez o por función.
3. **IA del lado de la empresa.** La empresa abre sus sobres en su navegador y
   decide qué hace. Lo gobierna el EULA de empresas, no nosotros.

**Lo que no haría:** atar más funciones a entregar más datos. Si lo pago
compra "funciones más completas" a cambio de privacidad, los que pagan tienen
menos privacidad que los que no, y la regla deja de ser un valor y pasa a ser
un precio. Mejor: cada función que necesite un vínculo lo pide ella, opt-in y
con fecha de vencimiento, pague o no pague la persona.

### El caso que sí necesita vínculo: avisarle al candidato

"La empresa te pasó a entrevista" por correo exige que el servidor sepa qué
cuenta avisar. Sin vínculo, el candidato se entera cuando abre JobIt (su
navegador conoce sus postulaciones y pregunta por ellas). Con aviso, hace falta
un vínculo, y la propuesta es **acotado al propósito**: al postular, casilla
"avisarme por correo"; si se marca, se guarda `(postulación, cuenta)` en una
tabla aparte, solo mientras la postulación esté abierta, y se borra al
cerrarse. El correo no dice qué empresa ni qué puesto: "tenés novedades".

## El límite honesto (ya está en la política)

Esto protege contra: que roben la base, que se filtre un backup, que alguien
pida los datos por vía legal, que un administrador curiosee, que se pierda el
disco del VPS.

**No protege contra JobIt sirviendo otro JavaScript.** Eso no lo arregla
ningún cifrado. Lo que se hizo: el build es reproducible, `/version.json`
publica el commit y el hash de cada archivo, `bun run verificar` compara, y una
tarea diaria en GitHub lo corre desde afuera (ver [verificar.md](verificar.md)).
La política lo dice en la sección 13, "El código que te servimos".

## Ley 18.331 y las empresas

Si la empresa lee y JobIt no, la empresa se parece más a la responsable del
tratamiento y JobIt a un intermediario. **No lo afirmo**: lo tiene que
confirmar alguien que sepa. Lo que sí está decidido es la palanca: el EULA de
empresas exige cumplir, como mínimo, nuestra política con los datos que
reciben, y la que no cumple pierde el servicio. El borrador está en
[eula-empresas.md](eula-empresas.md).

## Lo que cuesta, junto

- Perder contraseña y códigos es perder el contenido, no solo el acceso.
- No hay búsqueda ni orden del lado del servidor sobre lo cifrado; la cabecera
  cubre el cribado y nada más.
- No hay IA de fondo sobre lo guardado.
- El frontend pasa a ser crítico para la seguridad, no solo para la
  experiencia. De ahí la verificación del build.
- El primer ingreso después de migrar pide guardar códigos nuevos.
- Soporte no puede ayudar a nadie a recuperar contenido, nunca.

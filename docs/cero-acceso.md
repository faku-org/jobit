# Cero acceso: que JobIt no pueda leer lo que se manda

La regla, dicha corta: **a los datos de una persona llegan esa persona y la
empresa a la que le escribió. JobIt no.** Telemetría anónima sí, nada más.

Eso no se implementa con una promesa en la política. Se implementa haciendo que
el servidor guarde algo que no puede abrir, y aceptando lo que eso cuesta.

## Lo que ya cambió

**Se sacó el correo de las cuentas.** Estaba cifrado, pero con `ACCOUNT_KEY`,
que la tiene JobIt: o sea que JobIt lo podía leer. Además no lo usaba nadie para
nada, porque la recuperación por correo nunca existió. Era un dato legible sin
una función que lo justificara, que es exactamente lo que la política dice que
no se guarda.

Sin correo, los códigos de respaldo pasan de ser "la salida si no dejaste mail"
a ser **la única salida, para todos**. El texto del alta ya lo dice así.

Esto se revierte en diez minutos si preferís lo contrario. Lo que no se puede
es tenerlo guardado y decir que JobIt no accede a los datos.

## La excepción que no se puede cerrar hoy

**El secreto TOTP.** Verificar un código de seis dígitos exige tener el secreto
con el que se generó: no hay forma de que el servidor valide un TOTP sin poder
generarlo él. Hoy está cifrado en reposo, y la clave la tiene JobIt.

La salida real es **WebAuthn**: el servidor guarda una clave pública y verifica
una firma, y no hay ningún secreto del lado nuestro. Además es mejor de usar,
porque es la huella o el PIN del dispositivo en vez de copiar dígitos.

Mientras tanto queda como excepción escrita, no como cosa que nadie notó.

## El esquema

### 1. La contraseña se parte en dos

```
salt        <- del servidor, por cuenta, público
H_auth      = KDF(contraseña, salt, "auth")   -> va al servidor
H_wrap      = KDF(contraseña, salt, "wrap")   -> nunca sale del navegador
```

El servidor recibe `H_auth` como si fuera la contraseña y le aplica argon2id
encima, como ya hace hoy. Nunca ve `H_wrap`, y de `H_auth` no se puede derivar.

Sobre el KDF del navegador: WebCrypto trae PBKDF2 nativo y no trae Argon2id. Se
puede cargar argon2 en WASM (unos 40 kB) o usar PBKDF2-SHA512 con muchas
iteraciones. PBKDF2 aguanta peor una GPU que Argon2id, y es lo que hay sin
dependencia. **Es una decisión a tomar, no un detalle.**

### 2. Cada cuenta tiene un par de claves

Generado en el navegador al darse de alta. ECDH P-256, que es lo que soportan
todos los navegadores.

- La pública se guarda tal cual: es pública.
- La privada se guarda **envuelta con `H_wrap`**. Para el servidor es un blob
  opaco que no significa nada.

Al entrar, el navegador baja el blob y lo abre con la contraseña. Funciona desde
cualquier dispositivo sin sincronizar nada.

### 3. Cada postulación es un sobre cerrado

```
clave_contenido   = AES-256-GCM aleatoria, una por postulación
sobre             = cifrar(datos, clave_contenido)
para_la_empresa   = envolver(clave_contenido, pública de la empresa)
para_quien_postula= envolver(clave_contenido, pública de la persona)
```

El servidor guarda el sobre y las dos llaves envueltas. Puede borrarlo, contarlo
y hacerlo vencer. No puede abrirlo.

Que la llave vaya envuelta también para quien postula es lo que le deja releer
lo que mandó. Sin eso, la persona pierde acceso a su propia postulación, que
sería un chiste malo.

### 4. Los códigos de respaldo cambian de significado

Hoy un código cambia la contraseña. **Con cifrado de punta a punta eso no
alcanza:** cambiar la contraseña cambia `H_wrap`, y la clave privada queda
envuelta con la anterior. La cuenta se recupera y el contenido se pierde.

Así que cada código de respaldo tiene que llevar **su propia copia envuelta de
la clave privada**. Ocho códigos, ocho copias. Usar uno abre la clave, la
reenvuelve con la contraseña nueva y quema el código.

Consecuencia, y hay que decirla fuerte: **perder los ocho códigos y la
contraseña ya no es perder la cuenta, es perder el contenido.** No hay reset
posible, por diseño y no por falta de ganas.

### 5. Cambiar la contraseña es barato

Se reenvuelve la clave privada con el `H_wrap` nuevo. No se vuelve a cifrar
ninguna postulación, porque ninguna está cifrada con la contraseña.

## Lo que esto rompe

### El cribado del lado del servidor

En `docs/empresas.md` propuse que la API calculara el puntaje contra los
requisitos y ordenara la bandeja. **Con el sobre cerrado eso no se puede.** El
servidor no sabe qué dice adentro.

Dos salidas:

**A. Todo adentro del sobre.** La empresa baja los sobres, los abre en su
navegador y filtra ahí. Honesto y simple. Con 30 postulaciones va bárbaro; con
500 son 500 blobs a bajar y descifrar cada vez que abre la bandeja. Se arregla
con un índice cacheado en IndexedDB, que es más código.

**B. Cabecera de cribado afuera del sobre.** Solo ids de catálogo (nivel, años,
rubro, departamento), sin nombre, sin contacto, sin texto libre, y **sin vínculo
con la cuenta**. El servidor puede ordenar por eso y no sabe de quién es cada
fila.

B escala y es menos puro. La pregunta honesta es si `{senior, 5 años,
tecnología, Montevideo}` es "un dato directo de la persona". Suelto no lo es;
pegado a un `user_id` sí. Por eso B exige que esa fila **no** tenga `user_id`.

### El vínculo postulación ↔ persona

Aunque todo esté cifrado, una columna `applications.user_id` le dice a JobIt
quién postuló a qué. Eso es un dato directo, y de los más sensibles: es saber
que alguien con trabajo está buscando otro.

La salida: **la tabla no guarda `user_id`.** Quien postula guarda en su navegador
la lista de lo suyo, igual que hoy guarda las ofertas marcadas, y además una
copia envuelta con su propia clave en el servidor para no perderla al cambiar de
dispositivo. El servidor ve un blob por persona; su tamaño insinúa cuántas
postulaciones hay y nada más.

## El límite honesto, y va en la política

Esto protege contra: que roben la base, que se filtre un backup, que alguien
pida los datos por vía legal, que un administrador curiosee, que se pierda el
disco del VPS.

**No protege contra JobIt sirviendo otro JavaScript.** El navegador cifra con el
código que le mandamos nosotros. Un despliegue modificado, o uno comprometido,
puede quedarse con el texto antes de cerrar el sobre.

Decir "JobIt no puede leer tus datos" a secas sería mentir un poco. Lo que se
puede decir con todas las letras es: **no podemos leerlos desde la base, y si
quisiéramos leerlos tendríamos que cambiarte el código que te servimos.** Y
después dar con qué chequearlo: hash del build publicado, `integrity` en el
bundle, y build reproducible el día que se pueda.

Esa frase, dicha así, vale más que la promesa grande, porque es verificable.

## Ley 18.331

Si la empresa puede leer y JobIt no, lo más probable es que la empresa sea la
responsable del tratamiento y JobIt algo más parecido a un intermediario. Eso
cambia quién contesta un reclamo y qué tiene que decir cada término.

**No lo afirmo.** Hay que confirmarlo con alguien que sepa antes de escribirlo
en los términos, porque escribirlo mal es peor que no escribirlo.

Lo que sí es seguro: una vez que la empresa abre el sobre, los datos están en su
máquina y JobIt no puede hacer nada al respecto. Eso la política lo tiene que
decir, no insinuar.

## Avisos sin correo

Primero una corrección: **no es un certificado lo que falta.** DKIM sí es un par
de claves publicado en DNS, y SPF y DMARC son dos registros más, y todo eso se
configura en una tarde. El problema es otro y es peor.

Desde noviembre de 2025 Gmail rechaza directamente lo que no autentica bien
(5.7.26) y Microsoft hace lo mismo (550 5.7.515). Y los rangos de IP de casi
todos los VPS ya están en listas tipo la PBL de Spamhaus, que existe justamente
para marcar direcciones que no deberían mandar correo. Con SPF, DKIM y DMARC
perfectos, un VPS nuevo igual arranca sospechoso, y el calentamiento es mandar
50 a 100 por día subiendo de a poco durante un mes y medio.

O sea: **configurarlo bien es necesario y no alcanza.** No te faltaba un papel,
te falta reputación, y esa no se configura.

Las alternativas, con lo que cuesta cada una:

**1. Relé transaccional.** Brevo da 300 por día gratis, Resend 3.000 por mes,
Amazon SES cobra unos 0,10 dólares cada mil. Ellos ponen la reputación y vos
ponés los registros DNS de `wefaber.net`. Resuelve el spam de verdad.

El costo choca de frente con la regla de arriba: el relé ve la dirección de
quien recibe. Se puede achicar mandando un correo que no diga nada ("tenés
novedades, entrá"), pero el relé igual aprende que esa dirección tiene cuenta.
Bajo la regla nueva, esto solo entra si la persona lo elige sabiendo eso.

**2. Web Push (VAPID), y es la que recomiendo.** El navegador se suscribe, el
servidor le manda el aviso firmado con su propia clave. Sin terceros más allá
del servicio de push del navegador, y el protocolo ya cifra el contenido para
que ese servicio no lo lea. Gratis, self-hosted, sin reputación que construir.

El límite: en iPhone solo anda si la persona agrega el sitio a la pantalla de
inicio, porque desde una pestaña de Safari el Push API no existe. En Android y
escritorio anda desde una pestaña común.

**3. Telegram.** La persona conecta su Telegram una vez. Gratis, instantáneo, no
tiene problema de spam y acá lo usa todo el mundo. Telegram aprende la
asociación, igual que el relé aprende la dirección.

**4. Bandeja adentro de JobIt.** Gratis, no filtra nada, y depende de que la
persona vuelva a mirar.

**Lo que armaría:** la bandeja como fuente de verdad, siempre, porque no le
cuenta nada a nadie. Web Push arriba como capa de aviso gratis. Telegram como
opción para quien lo quiera. Y correo: ninguno.

Sin correo, la frase "JobIt no guarda tu correo" es literalmente verdadera y no
hay que matizarla, que es el tipo de frase que sostiene la marca entera.

## Lo que cuesta, junto

- Perder contraseña y códigos es perder el contenido, no solo el acceso.
- No hay búsqueda ni orden del lado del servidor sobre lo cifrado.
- La bandeja de la empresa se pone pesada con volumen.
- El frontend pasa a ser crítico para la seguridad, no solo para la experiencia.
- Los payloads crecen y el alta gana un paso, generar las claves.
- Soporte no puede ayudar a nadie a recuperar nada, nunca.

## Lo que necesito que decidas

1. **¿Cabecera de cribado en claro (B) o todo adentro del sobre (A)?** Es lo que
   decide si la bandeja de la empresa escala.
2. **¿KDF del navegador: PBKDF2 nativo o argon2 en WASM?**
3. **¿Web Push, Telegram, las dos, o solo bandeja?**
4. **¿Confirmo que el correo se va, o lo vuelvo a poner?** Ya está sacado en la
   rama.
5. **¿WebAuthn entra en el alcance de #27 o queda para después?** Es la única
   forma de cerrar la excepción del TOTP.

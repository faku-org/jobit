# Empresas publicando directo, y qué pasa con los CV

Propuesta. No hay nada de esto implementado y no lo va a haber hasta que las
decisiones del final estén tomadas, porque la mitad no son técnicas.

Responde a tres pedidos que vienen juntos: conseguir ofertas de forma más
automática que scrapeando, que las empresas publiquen acá directamente (#15), y
que puedan recibir postulaciones, descartarlas contra sus requisitos, hacer
preguntas y agendar entrevistas.

## Lo primero, que no es un detalle de implementación

Hoy la política de privacidad dice esto, con estas palabras:

> Tu perfil, tus guardadas y tus postulaciones viven en tu navegador y no tienen
> copia en ningún servidor.
>
> El CV se lee en tu máquina. El archivo no se sube a ningún lado ni pasa por
> ninguna IA.

Y no es marketing: `web/src/lib/cv.ts` lee el PDF en el navegador y lo convierte
a ids de catálogo. La API nunca ve un CV porque no hay endpoint que lo reciba.
"Postular" es hoy un clic hacia afuera.

Un panel donde un reclutador ve CV y los descarta necesita, sí o sí, que el CV
salga de la máquina de quien lo escribió y quede guardado donde un tercero lo
lee. **Las dos frases de arriba dejan de ser verdad el día que se mergea la
primera tabla `applications`.**

Eso no quiere decir que no se haga. Quiere decir que es una decisión de qué es
JobIt, no una feature más, y que se paga con lo que hoy lo diferencia de
cualquier otro portal. Las tres salidas posibles:

**A. No se hace.** La postulación sigue saliendo hacia afuera: la empresa
publica acá y recibe en su correo o en su propio formulario. JobIt sigue sin
tener un solo dato de nadie. Se pierde el producto del lado empresa y se pierde
la palanca comercial para pedirles que publiquen.

**B. Postulación estructurada, sin banco de CV.** Lo que viaja no es el PDF: es
lo que `cv.ts` ya sabe leer, en ids de catálogo, más lo que la persona conteste.
La persona ve exactamente qué se manda antes de mandarlo. Vive colgado de una
oferta, no de un perfil, y se borra solo. No hay base de candidatos, no hay
búsqueda de gente, no hay CV descargable salvo que quien postula lo adjunte a
propósito para esa oferta.

**C. ATS clásico.** Banco de CV, búsqueda de candidatos, filtros sobre el
archivo. Es lo que piden las empresas y es lo que hace todo el mundo. También es
tirar la Zero Data Policy entera y competir de frente con BuscoJobs en el
terreno de BuscoJobs, sin su base y sin su plata.

**Recomiendo B**, y el resto del documento asume B. Es lo único que deja decir
"lo mínimo para que esto funcione y ni un campo más" sin mentir, y sigue dándole
a la empresa lo que de verdad usa para descartar, que no es leer 300 PDF: es
saber quién cumple los requisitos.

### Lo que B igual rompe, y hay que reescribir

- La frase "tus postulaciones viven en tu navegador" pasa a valer solo para las
  ofertas scrapeadas. Para las propias hay una fila en el servidor.
- **Postularse deja de ser anónimo.** Hace falta cuenta (#27), porque si no no
  hay a quién contestarle. Buscar sigue sin cuenta; postularse no.
- #34 pasa de ser un issue de redacción a ser bloqueante: hay que decir qué se
  guarda, cuánto dura y quién lo ve.
- Aparece un tercer rol en #32: hoy las métricas no tienen usuario. Las de
  postulación sí lo tienen por definición, y ese corte hay que dejarlo afuera
  del agregado o se filtra por ahí.

## Conseguir ofertas sin scrapear

Ordenadas por lo que rinde contra lo que cuesta. Ninguna excluye a las otras.

### 1. Importar por URL, pegando el aviso propio

La empresa pega la URL de su propio aviso (su web, su LinkedIn, su Gallito) y
JobIt lo lee y llena el formulario. Confirma y publica.

Es la de mejor relación esfuerzo/resultado y ya está medio construida: el worker
sabe pedir y parsear, y `offers.ts` sabe recibir. Lo que cambia es de dónde sale
el pedido y quién lo confirma. Como lo pide la empresa para su propio aviso, no
hay uso no autorizado de nadie.

Primero JSON-LD `JobPosting`, que es lo que casi todos ya publican para Google,
y recién si no hay, heurística sobre el HTML. Con una pantalla de confirmación
siempre, porque un parser que se equivoca en silencio publica cualquier cosa.

**Cuidado:** esto es un fetch a una URL que manda un tercero. Es SSRF de manual.
Hay que bloquear todo lo que no sea http(s) público, resolver el DNS y rechazar
rangos privados (127/8, 10/8, 172.16/12, 192.168/16, 169.254/16, ::1), no seguir
redirecciones fuera de esa regla, y poner tope de tamaño y de tiempo. Corriendo
en el mismo VPS que la API, un fetch a `169.254.169.254` o a `127.0.0.1:3000` no
es una hipótesis.

### 2. El formulario, con la empresa entrando por su cuenta

Lo que falta de #15: hoy la empresa la carga el admin a mano. Con las cuentas de
#27 ya hechas, lo que falta es colgar una empresa de una cuenta y que el panel
muestre lo suyo. Es la mitad del trabajo que era antes.

### 3. Leer la página de empleos de la empresa, con permiso

La empresa da la URL de su sección de empleos una vez, y el worker la revisa una
vez por día y trae lo que tenga JSON-LD. Es scraping, pero de quien pidió que lo
scrapeen y de su propio contenido: es lo que hace Google.

Cubre a las que publican seguido sin que nadie cargue nada. No cubre a la
panadería del barrio, que no tiene sección de empleos.

### 4. API con clave (#9)

Para las pocas que tienen un ATS de verdad. Poca cobertura acá, pero es el
formato en el que una cadena grande dice que sí.

### 5. Ofertas por correo

`ofertas@` recibe un mail, se arma un borrador pendiente de moderar. Es la vía
más baja de fricción para una empresa chica en Uruguay, y necesita correo
entrante configurado, que hoy no hay. Dejarla anotada, no construirla ahora.

## El flujo completo, si se elige B

### Publicar

La empresa entra con su cuenta (#27), crea la oferta y declara los requisitos
**en campos, no en prosa**. Esa es la pieza que hace funcionar todo lo demás.

Los requisitos van en el vocabulario que ya existe en `worker/src/roles.ts` y
`categories.ts`, más nivel, años, educación, departamento y disponibilidad. Cada
uno con una marca: **excluyente** o **deseable**. Sin esa marca no hay descarte
posible que no sea leer todo a mano, que es lo que se está tratando de evitar.

### Preguntas del reclutador

Por oferta, pocas y cerradas: sí/no, una opción de una lista, un número. El
texto libre queda para una sola pregunta y con tope de caracteres.

No es para ahorrar espacio. Una respuesta cerrada se puede ordenar y contar sin
que nadie la lea, y una abierta obliga a que alguien lea, que es justo el cuello
de botella. Además el texto libre es el lugar por donde vuelve a entrar todo el
dato personal que el diseño sacó por la puerta.

### Postular

La persona ve los requisitos y **su propio match, calculado en su navegador,
antes de mandar nada**. `fit.ts` y `match.ts` ya hacen esa cuenta para ordenar
el tablero; acá se muestra.

Lo que se manda:

- Lo que `cv.ts` leyó, en ids de catálogo, editable y a la vista. El PDF no.
- Las respuestas a las preguntas.
- Un canal de contacto que elige quien postula, igual que en los servicios.
- El PDF, **solo si lo adjunta a propósito**, para esa oferta y con fecha de
  vencimiento. No queda en un perfil ni se reusa en otra postulación.

Pantalla de confirmación mostrando exactamente lo que va a viajar. Si la persona
edita lo que leyó el CV, viaja lo editado: es su declaración, no un dictamen del
parser.

### Descartar

**Ordenar, no borrar.** El mismo criterio que la moderación de #29: el puntaje
pone arriba lo que cumple y abajo lo que no, y quien decide es una persona. Un
descarte automático sobre un puntaje que nadie auditó es la forma más rápida de
que el sistema discrimine sin que nadie pueda decir por qué.

La única excepción razonable es el excluyente declarado: si la oferta pide
libreta de conducir y la persona contestó que no tiene, va a "no cumple", no a
la papelera, y la empresa puede abrir esa lista igual.

Estados: `nueva`, `vista`, `preseleccionada`, `entrevista`, `descartada`,
`contratada`. Sin motivo obligatorio de descarte: pedirlo genera un campo de
texto libre sobre una persona, que es exactamente lo que no queremos guardar.

### Entrevistas

La empresa publica tramos disponibles. Quien está preseleccionado elige uno.

"Verificar" acá quiere decir dos cosas distintas y conviene no mezclarlas:

- **Que la entrevista existe.** Un código por entrevista que ven los dos lados.
  Sirve contra el "yo nunca agendé eso" y contra quien se presenta sin cita.
- **Que la empresa es quien dice ser.** Eso no lo da el código: lo da la
  aprobación manual de la empresa, que ya existe en `companies.status`. La
  entrevista de una empresa no aprobada no se agenda.

Un `.ics` para bajar y nada de integrarse con el calendario de nadie: meter
Google Calendar acá es mandarle a Google quién entrevista a quién.

### Cuánto dura

Se borra solo pasados N días del cierre de la oferta (60 por defecto). Quien
postuló puede revocar cuando quiera y eso borra la fila, no la tacha. La empresa
puede exportar lo suyo antes, y el aviso de que va a vencer tiene que estar en
el panel, no en la letra chica.

### Tablas, en borrador

```
offer_requirements(offer_id, kind, value, excluyente)
offer_questions(offer_id, position, kind, prompt, options, required)
applications(id, offer_id, user_id, status, score, created_at, expires_at)
application_facts(application_id, kind, value)        -- ids de catálogo
application_answers(application_id, question_id, value)
application_files(application_id, path, expires_at)   -- solo si adjuntó
interview_slots(id, offer_id, starts_at, minutes, mode, place)
interviews(application_id, slot_id, code, status)
```

`applications` cuelga de `offers`, que cuelga de `companies`. Borrar la empresa
se lleva todo, como ya pasa hoy.

### Esfuerzo, grueso

| Pedazo                                     | Tamaño                      |
| ------------------------------------------ | --------------------------- |
| Empresa con cuenta propia (cierra #15)     | chico, las cuentas ya están |
| Importar por URL (con el blindaje de SSRF) | mediano                     |
| Requisitos estructurados y preguntas       | mediano                     |
| Postulación y confirmación de lo que viaja | mediano                     |
| Bandeja del reclutador, orden y estados    | mediano                     |
| Entrevistas y `.ics`                       | chico                       |
| Reescribir política y términos (#34)       | chico, y bloqueante         |
| Avisos sin correo saliente                 | **sin resolver, ver abajo** |

## Lo que no está resuelto

**Cómo se entera la persona de que la citaron.** No hay correo saliente
configurado y el diseño de #27 evitó esa dependencia a propósito. Sin eso, la
única vía es que la persona vuelva a entrar a mirar, y un proceso de selección
así no funciona.

Las salidas son: configurar SMTP y aceptar la dependencia; exigir correo para
postular (no para tener cuenta); o mandar al canal que la persona eligió, que
para WhatsApp implica una API de terceros y contarle a un tercero quién postuló
a qué. **Ninguna es gratis y hay que elegir una antes de empezar.**

## Lo que no se hace

- Ranking automático que descarte solo.
- Puntaje de "afinidad" con nombre de IA sobre el texto del CV. El texto no está
  y no va a estar.
- Banco de candidatos buscable. Una postulación es a una oferta.
- Mandar nada de nadie a una API de terceros.

## Lo que necesito que decidas

1. **¿A, B o C?** Todo el resto cuelga de esto.
2. Si es B: **¿el PDF adjunto existe o no?** Sin adjunto es más limpio y hay
   empresas que no van a aceptarlo.
3. **¿Cómo se avisa?** SMTP propio, correo obligatorio para postular, o que la
   persona vuelva a mirar.
4. **¿La empresa entra por su cuenta o la sigue aprobando vos a mano?**
   Autoservicio escala y trae basura; aprobación manual no escala pero es lo que
   hoy sostiene la promesa de que las empresas del tablero son reales.
5. **¿Importar por URL entra ahora o después?** Es lo que más ayuda a conseguir
   ofertas, y es lo único de esta lista que agrega un riesgo nuevo de seguridad
   al servidor.

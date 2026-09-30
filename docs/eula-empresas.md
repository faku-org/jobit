# Términos para empresas: borrador

> **Borrador de trabajo, no es asesoramiento legal.** Esto ordena qué se le
> quiere exigir a una empresa y por qué. Antes de publicarlo lo tiene que
> revisar un abogado que conozca la ley 18.331, su decreto reglamentario y las
> leyes laborales citadas. Lo marcado con **[confirmar]** es lo que más
> necesita esa revisión.

## La idea, en una línea

Cuando una persona le manda sus datos a una empresa por JobIt, la empresa se
compromete a tratarlos **por lo menos** como JobIt promete tratarlos en su
[política de privacidad](https://jobs.wefaber.net/privacidad). La que no
cumple deja de tener el servicio.

## Por qué hace falta

Con las postulaciones cifradas de punta a punta ([cero-acceso.md](cero-acceso.md)),
JobIt no puede leer lo que una persona le manda a una empresa. Eso es lo que se
quiere, y tiene una consecuencia: **una vez que la empresa abre el sobre, los
datos están en su máquina y JobIt no puede hacer nada técnico al respecto.** La
única herramienta que queda es el contrato.

También cambia el papel de cada uno. Si la empresa lee y JobIt no, la empresa se
parece más a la **responsable del tratamiento** de esos datos y JobIt a un
intermediario que transporta sobres cerrados. **[confirmar]** Si es así, el
reclamo de una persona sobre qué hizo una empresa con su CV es contra la
empresa, y estos términos tienen que dejarlo claro para las dos partes.

## Lo que la empresa acepta

### 1. Para qué usa los datos

- Solo para el proceso de selección de la oferta a la que la persona se
  postuló.
- Para otra oferta, solo si la persona lo acepta de forma expresa en ese
  momento. "Guardamos tu CV para futuras búsquedas" no vale como casilla
  premarcada ni como letra chica.
- No los vende, no los cede y no los cruza con bases de terceros ni con
  servicios que arman perfiles de personas.
- Contacta a la persona solo por ese proceso. Nada de publicidad.

### 2. Qué pregunta

- Nada sobre sexo, raza, religión, orientación sexual, estado civil,
  embarazo, salud, afiliación sindical, opiniones políticas ni ninguna otra
  condición ajena a la idoneidad para el cargo (leyes 16.045 y 17.677, que los
  términos generales ya citan).
- Las preguntas del reclutador pasan por el mismo criterio. JobIt puede
  rechazar una pregunta al publicarla, que es el único momento en que la ve.

### 3. Cuánto tiempo los guarda

- Lo mismo que JobIt: hasta **60 días después del cierre de la oferta**. Eso
  incluye las copias que haya bajado o exportado a su propio sistema.
- Si la persona retira su postulación, la empresa borra lo que tenga de ella,
  también fuera de JobIt.
- Si la empresa necesita guardar algo por una obligación legal (la
  contratación misma, por ejemplo), lo guarda por esa obligación y no por
  estos términos.

### 4. Quién los ve

- Solo las personas de la empresa que participan en esa selección.
- Si usa un proveedor para gestionar candidatos (otro ATS, un servicio en la
  nube), ese proveedor tiene que cumplir lo mismo, y la empresa responde por
  él.

### 5. Decisiones automatizadas

- Si usa software o IA para ordenar o descartar, **la decisión final la toma
  una persona**, y la persona postulante puede pedir que la revise alguien. La
  ley 18.331 da derecho a impugnar valoraciones basadas solo en tratamiento
  automatizado. **[confirmar alcance, art. 16]**
- JobIt no hace descarte automático: ordena, y la cabecera de cribado es lo
  único que ve. Una empresa que descarta en automático lo hace por su cuenta.

### 6. Derechos de las personas

- Contesta los pedidos de acceso, rectificación y supresión sobre lo que tiene,
  en el plazo que marca la ley. **[confirmar plazos]**
- JobIt le pasa esos pedidos cuando le llegan a JobIt, porque JobIt no tiene
  los datos para contestarlos.

### 7. Seguridad y filtraciones

- Medidas razonables para su tamaño: acceso con contraseña, no dejar CVs en
  carpetas compartidas públicas, no mandarlos por canales abiertos.
- Si se filtran datos que recibió por JobIt, avisa a JobIt y a las personas
  afectadas sin demora. **[confirmar: la reglamentación uruguaya fija un plazo
  para notificar a la URCDP]**

### 8. Entrevistas

- No cobra nada a quien postula, en ninguna etapa, por ningún concepto.
- No pide datos bancarios, contraseñas ni copias de documentos antes de una
  oferta firme, salvo lo que exija la ley para ese puesto.
- La entrevista se agenda por JobIt, con su código, o fuera; si es fuera, estos
  términos siguen aplicando a lo que recibió.

Este punto es sobre todo contra estafas que se hacen pasar por empresas. Es
barato de cumplir para una empresa real y deja afuera a la falsa.

## Lo que pasa si no cumple

Proporcional y en escalones, salvo lo grave:

1. **Aviso**, con qué no cumple y un plazo para corregirlo.
2. **Suspensión de publicación**: las ofertas se ocultan y no entran
   postulaciones nuevas. Las que ya tiene siguen accesibles para que pueda
   cerrar los procesos (y borrar).
3. **Baja de la cuenta.**

Van **directo a la baja**: vender o ceder datos, discriminar de forma
explícita, cobrarle a quien postula, o hacerse pasar por otra empresa.

Al terminar, por baja o porque la empresa se va, borra los datos que recibió
por JobIt y lo confirma por escrito.

## Cómo se hace cumplir, siendo honestos

**JobIt no puede vigilar lo que no puede leer.** Con los sobres cerrados, el
cumplimiento es **reactivo**: se entera por reclamos de las personas, por lo
que se ve al publicar (la oferta y sus preguntas) y por lo que la empresa
declara. Eso tiene que estar escrito así en los términos y en la política, en
vez de insinuar un control que no existe.

Lo que ayuda:

- **Un canal de reclamo** visible en cada postulación: "¿Esta empresa hizo algo
  raro con tus datos?". Llega a JobIt, no a la empresa.
- **La aprobación manual** de la empresa, que ya existe (`companies.status`):
  el primer filtro contra la empresa falsa.
- **Suspender es barato** para JobIt y caro para la empresa. Esa asimetría es
  toda la palanca.

## Para emprendedores

Quien publica un servicio no recibe postulaciones: recibe contactos de
clientes por el canal que eligió. Aplica una versión corta: usar el contacto
solo para contestar esa consulta, no pasarlo a nadie y no usarlo para
publicidad sin permiso. Mismos escalones si no cumple.

## Para implementarlo

- Aceptación al registrarse, con casilla sin marcar y enlace al texto.
- Guardar **qué versión** aceptó y cuándo (`terms_version`, `terms_accepted_on`
  en `company_accounts`). Cuando cambie, pedir aceptarla de nuevo al entrar.
- Publicarlo en `/empresas/terminos` y enlazarlo desde la sección 9 de los
  términos generales, que hoy solo habla de los avisos.
- Anotar cada versión en el [registro de cambios](../CHANGELOG.md).

## Lo que queda por decidir

1. **¿60 días es el plazo?** Es el de la plataforma. Una empresa con procesos
   largos va a pedir más; subirlo para todos es peor que dar extensión por
   oferta con aviso a quien postuló.
2. **¿Quién revisa las preguntas del reclutador?** Hoy nadie. Revisarlas a mano
   escala mal; un filtro de palabras deja pasar lo que importa. Propuesta:
   preguntas cerradas desde un catálogo y una sola abierta con revisión.
3. **¿La baja se publica?** Decir "esta empresa fue dada de baja por mal uso de
   datos" protege a otras personas y expone a JobIt a un reclamo. Es una
   decisión de abogado.

# Correo: por qué Resend, y qué otras opciones hay

JobIt necesita mandar correo para tres cosas: **confirmar** que una dirección
es de quien la cargó, **recuperar** una cuenta, y **avisar** (que cambió algo
en tu cuenta, que un servicio fue aprobado, y el día de mañana que una empresa
contestó una postulación). Como es un servicio web y no una app instalada, no
hay notificaciones push nativas en todos lados: el correo es el único canal que
llega a cualquiera.

La implementación está en `api/src/mail.ts`: una sola función `send()` que
hace un `fetch` a la API de Resend. Cambiar de proveedor es reescribir esa
función.

## Qué se necesitaba

1. **Llegar a la bandeja de entrada**, no a spam, en Gmail y Outlook.
2. **Costo cero** a la escala de hoy (decenas de correos por día).
3. **Una API HTTP**, sin SDK ni SMTP: Bun hace `fetch` y listo, y muchos VPS
   bloquean la salida por el puerto 25.
4. **Exponer lo mínimo** de las personas: sin píxel de apertura, sin enlaces
   reescritos, poco tiempo de retención, y un acuerdo de tratamiento de datos.
5. **Poder irse** sin reescribir nada más que el transporte.

## Por qué no un servidor propio

No es un certificado lo que falta. SPF, DKIM y DMARC son registros DNS y se
configuran en una tarde. Lo que falta es **reputación**, y esa no se configura:

- Desde noviembre de 2025 Gmail rechaza lo que no autentica bien (5.7.26) y
  Microsoft hace lo mismo (550 5.7.515).
- Los rangos de IP de casi todos los VPS están en listas como la PBL de
  Spamhaus, que existe para marcar direcciones que no deberían mandar correo
  directo.
- Calentar una IP nueva son semanas mandando de a poco y subiendo, con
  volumen constante. JobIt no tiene volumen constante.

Con todo bien configurado, un VPS nuevo igual arranca sospechoso. Un relé
transaccional pone su reputación y nosotros los registros DNS de nuestro
dominio.

## Las opciones, con números de setiembre de 2026

| Proveedor  | Gratis                                | Primer pago                  | Notas                                                                  |
| ---------- | ------------------------------------- | ---------------------------- | ---------------------------------------------------------------------- |
| **Resend** | 3.000/mes, tope de 100/día, 1 dominio | Pro, 20 USD/mes              | API mínima. Envía desde São Paulo (`sa-east-1`), guarda todo en EE.UU. |
| Brevo      | 300/día                               | Starter, 9 USD/mes           | Empresa europea. Es una plataforma de marketing con transaccional.     |
| Postmark   | 100/mes (solo para probar)            | 15 USD/mes por 10.000        | La mejor reputación del rubro. El gratis no alcanza para producción.   |
| Amazon SES | 3.000/mes los primeros 12 meses       | 0,10 USD cada 1.000          | Lo más barato a escala. Cuenta de AWS, IAM y salir del sandbox.        |
| Mailgun    | 100/día                               | Basic, 15 USD/mes por 10.000 | Parecido a Resend en gratis; API más vieja.                            |
| Propio     | Gratis                                | Tiempo                       | Descartado arriba.                                                     |

La retención de registros de Resend aparece como 1 o 30 días según la fuente y
el plan. La política dice "hasta 30 días", que es la cota que se puede
sostener; conviene confirmarlo en el panel al activar la cuenta.

## Por qué Resend

- **La API es un POST con JSON.** Sin SDK: `mail.ts` no agrega dependencias.
- **Región de envío en São Paulo**, la más cercana a Uruguay, lo que acorta el
  camino hasta la bandeja.
- **Texto plano y sin seguimiento** se consiguen sin pelear con la
  herramienta: el seguimiento de aperturas y clicks es por dominio y se deja
  apagado (lo dice `api/.env.example`).
- **El tope de 100 por día es suficiente** con cómo está hecho el envío: cada
  enlace tiene un enfriamiento de 10 minutos por cuenta y propósito, así que
  nadie puede quemar el cupo pidiendo resets en loop.
- **El acuerdo de tratamiento de datos** viene firmado de antemano.

## Lo que Resend no resuelve, dicho claro

- **Guarda todo en Estados Unidos**, elijas la región de envío que elijas.
  La ley 18.331 restringe las transferencias a países sin nivel adecuado de
  protección, y Estados Unidos en general no lo tiene para Uruguay. Hay
  excepciones (consentimiento informado, garantías contractuales), y la
  política ya avisa el destino antes de que la persona cargue su correo.
  **Si un abogado dice que eso no alcanza, la alternativa directa es Brevo**:
  empresa europea, y la Unión Europea sí tiene nivel adecuado reconocido para
  Uruguay y viceversa. Cambiar es reescribir `send()`.
- **Aprende qué direcciones tienen cuenta en JobIt.** Cualquier relé lo
  aprende. Se achica mandando correos que no dicen nada del contenido ("tenés
  novedades, entrá"), que es como están escritos.
- **El tope diario** se vuelve un problema a partir de unas 60 altas por día.
  Ahí se pasa a Pro, o a SES si el costo pesa.

## Lo que el correo no reemplaza

- **Web Push (VAPID)**: gratis y sin terceros más allá del servicio de push
  del navegador, que no lee el contenido. En iPhone solo funciona si el sitio
  se agregó a la pantalla de inicio. Sirve para avisar, no para confirmar una
  dirección ni recuperar una cuenta. Es la capa que sigue.
- **Bandeja dentro de JobIt**: la fuente de verdad de los avisos, siempre. El
  correo y el push avisan que hay algo; lo que hay se lee adentro.
- **Telegram**: opcional para quien lo quiera. Telegram aprende la asociación,
  igual que el relé aprende la dirección.

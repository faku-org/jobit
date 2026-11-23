# Este documento

Este documento lo escribe Faku para plantear posibles integraciones al sistema de forma interactiva

## Integracion AhiVoy

[AhiVoy](https://ahivoy.uy) es un sistema que permite ver las opciones de transporte publico para todo el sistema STM. Asi mismo y este es el punto importante permite calcular el tiempo de llegada a los lugares en base al transporte.

### Como se Integra con JobIt

Si una persona tiene integracion con su calendario y tiene pendiente una reunion/entrevista o algun evento relacionado a la plataforma se podria mostrar la ruta mas eficiente al lugar mediante el transporte publico y calculando si le da el salario en la tarjeta STM. Asi mismo podria ver el camino a los locales de la marca o ubicaciones de interes.

### Viabilidad

Por la informacion existente no se sabe si expone una API, pero se podria contactar al developer hola@ahivoy.uy para mas informacion y la cohesion de las aplicaciones.

### Rentabilidad

Desconozco si habria alguna remuneracion necesaria para hacer el sistema funcionar en conjunto, calls a la supuesta API de ahi voy o que costos tendria de integracion.

## Integracion con Cabacua y PreciosPc

[Cabacua](https://www.cabacua.com/) permite mirar precios de locales, podria integrarse para materiales/compras necesarias para los trabajadores en ciertos rubros o para emprendedores. Asi mismo tambien podria integrarse con [PreciosPc](https://preciospc.uy/) para los trabajadores tech o que las marcas/emprendedores muestren sus requerimientos y JobIt permita buscarlos.

### Viabilidad

Por determinar, se desconoce API o uso de datos.

### Rentabilidad

Se podria proveer datos de productos mas buscados por empresas/emprendedores.

## Integración treg.to

[treg.to/jobs-api](https://treg.to/jobs-api) es un gateway que hace de proxy de varios proveedores de empleo detrás de una sola base (`https://treg.to/call/<endpoint-id>`). Está implementado como la fuente `treg` del worker (`worker/src/sources/treg.ts`) y **viene apagada**: solo se registra en `SOURCES` si hay variables `JOBIT_TREG_*` en el entorno del worker.

### Cómo se integra

Dos caminos, independientes:

- **Boards gratis (sin token).** Se listan los boards de empresas concretas: `greenhouse.companies.jobs` (`board_token`, `content=true` trae la descripción), `lever.postings.list` (`site`, `mode=json`) y `ashby.companies.jobs` (`board`). Estos proveedores publican ofertas de una empresa por board, no de un país: el worker se queda solo con las filas cuya ubicación (texto libre) nombra Uruguay, Montevideo, `UY` o un departamento (los ambiguos como Florida, San José o Colonia piden además "Uruguay" o "UY").
- **Búsqueda paga (con token).** `POST treg.companies.jobs.search` con `country: 'UY'`, paginando con `cursor = next_cursor`. Devuelve filas nativas del proveedor sin esquema único, así que el mapeo es defensivo (varias claves posibles por campo; lo que no tiene título o URL http(s) se descarta). Cada llamada manda `X-Treg-Route-Max-Cost` para topear el costo, no se reintenta si falla (cada intento cuesta) y se corta a 3 páginas por corrida.

La fila del listado ya trae la descripción, así que no hay segundo pedido de detalle: el crudo va al cache de detalle del worker y `parseDetail` lo lee de ahí. Todo entra con rubro `otros`, `source: 'treg'` y `source_id` estable (`greenhouse:<board>:<id>`, `search:<id|url>`); el dedupe existente cruza contra BuscoJobs y Uruguay Concursa.

### Viabilidad

Técnicamente resuelta y cubierta con tests de parseo (sin red). Lo que **no se sabe**: cuánto cubre de Uruguay. Los boards gratis son de empresas puntuales (hay que saber qué empresas con presencia en Uruguay usan Greenhouse, Lever o Ashby) y la búsqueda por país depende de qué proveedores tenga detrás el gateway. Hay que medir antes de depender de esto: una corrida con `JOBIT_TREG_BOARDS` chico y mirar cuántas ofertas únicas aporta contra las dos fuentes actuales.

### Rentabilidad / costos

- Boards gratis: sin costo, solo cortesía de rate (0,8 s entre pedidos).
- Búsqueda paga: se cobra por llamada y el precio exacto no está relevado. El tope por llamada (`JOBIT_TREG_MAX_COST`, default `0.05`) y las 3 páginas máximas acotan el gasto por corrida a unas pocas llamadas. No se hicieron llamadas pagas al armar la integración.
- Sin token la búsqueda paga se apaga sola, aunque `JOBIT_TREG_SEARCH=1` esté puesto.

### Variables de entorno

| Variable              | Qué hace                                                                                   |
| --------------------- | ------------------------------------------------------------------------------------------ |
| `JOBIT_TREG_BOARDS`   | `greenhouse:slug,lever:site,ashby:board`. Enciende la fuente con boards gratis.            |
| `JOBIT_TREG_TOKEN`    | Token del gateway (`X-Treg-Token`). Solo la búsqueda paga. Va en el `.env` fuera del repo. |
| `JOBIT_TREG_SEARCH`   | `1` enciende la búsqueda paga por país (requiere token).                                   |
| `JOBIT_TREG_MAX_COST` | Tope por llamada (`X-Treg-Route-Max-Cost`). Default `0.05`.                                |

### Qué falta

- Cobertura de Uruguay desconocida (ver Viabilidad): relevar qué boards conviene listar y cuántas ofertas únicas suma la búsqueda paga.
- Términos por proveedor sobre redistribución: Greenhouse, Lever y Ashby publican sus boards para que cada empresa reciba postulantes; falta confirmar si JobIt puede listar esas ofertas y enviar al `apply_url` original, o si hace falta permiso de la empresa o del gateway. Hasta aclararlo, no se enciende en producción.
- Unidad y precio del costo del gateway, para fijar un `JOBIT_TREG_MAX_COST` con sentido.
- Rubro: todo entra como `otros`; falta clasificar por título si la fuente se enciende.
- Los boards de Lever y Ashby no traen nombre de empresa en la fila: `company` queda `null`.

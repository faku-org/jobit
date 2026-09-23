/**
 * Las capacidades de motion, en su propio chunk.
 *
 * `LazyMotion` recibe esto como una función que importa, así que el paquete
 * grande (gestos, layout, animación de valores) baja después del primer pintado
 * en vez de antes. Lo que queda en el bundle de entrada es `m`, que es el
 * componente sin ninguna feature adentro.
 *
 * Va `domMax` y no `domAnimation` porque la pastilla de la pestaña activa usa
 * `layoutId`, que es una animación de layout compartida y vive solo en el
 * paquete grande.
 */
export { domMax as default } from "motion/react";

import { sendEvents } from "./api.ts";
import type { UsageEvent } from "./events.ts";

/**
 * La cola de eventos de uso. Vive en el módulo y no en un contexto porque el
 * botón de postularse está enterrado en el árbol y no tiene por qué saber que
 * esto existe: con la casilla apagada, `track` no hace nada.
 *
 * Nada se manda en el momento. Se junta y se manda al salir de la pestaña, de
 * modo que ni el orden ni el reloj del servidor alcanzan para reconstruir qué
 * hizo una persona.
 */
const MAX_QUEUE = 20;

let enabled = false;
let queue: UsageEvent[] = [];

export function setTracking(on: boolean): void {
  if (!on) queue = [];
  enabled = on;
}

export function track(event: UsageEvent): void {
  if (!enabled) return;
  queue.push(event);
  if (queue.length >= MAX_QUEUE) flushEvents();
}

/** Lo que está esperando ser mandado, para poder mostrarlo tal cual. */
export const pendingEvents = (): UsageEvent[] => [...queue];

export function flushEvents(): void {
  if (queue.length === 0) return;
  const batch = queue;
  queue = [];
  /* Si falla se pierde, y está bien: ninguna estadística vale un error
     delante de alguien que está buscando trabajo. */
  sendEvents(batch);
}

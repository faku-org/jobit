import { runAlerts } from './alerts.ts'

/**
 * El disparador diario de las alertas: `bun run --cwd api alerts`.
 *
 * Lo corre `deploy/jobit-alerts.timer` una vez por día. Es idempotente: correrlo
 * de nuevo el mismo día no manda nada de más (ver `alerts.ts`).
 */
const run = await runAlerts()
console.log(
  `[jobit] alertas ${run.day}: ${run.companies} empresas, ${run.detected} detectadas, ${run.mails} correos, ${run.skipped} omitidas`,
)

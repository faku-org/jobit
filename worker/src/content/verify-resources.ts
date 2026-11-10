import { RESOURCE_ITEMS } from './resources.ts'

/**
 * Vuelve a pedir cada URL del catálogo de recursos y dice cuáles ya no
 * responden. Es de uso manual (`bun run --cwd worker content:verify`), no corre
 * en los tests ni en el build: son peticiones a terceros y hay que hacerlas con
 * moderación, de a una, con un User-Agent propio y sin reintentos.
 *
 * Un 401/403/429 casi siempre es una protección contra bots (LeetCode, Khan
 * Academy): el sitio existe pero no contesta a un script. Se lista aparte para
 * revisarlo a mano; no cuenta como falla. 404/410, un 5xx o un error de red sí.
 */
const USER_AGENT = 'JobIt-link-check/1.0 (+https://jobs.wefaber.net)'
const TIMEOUT_MS = 15_000
const BLOCKED = new Set([401, 403, 429])

type Verdict = 'ok' | 'bloqueado' | 'roto'

async function check(
  url: string,
): Promise<{ verdict: Verdict; detail: string }> {
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'user-agent': USER_AGENT },
    })
    if (response.ok) return { verdict: 'ok', detail: String(response.status) }
    if (BLOCKED.has(response.status)) {
      return { verdict: 'bloqueado', detail: String(response.status) }
    }
    return { verdict: 'roto', detail: String(response.status) }
  } catch (cause) {
    return {
      verdict: 'roto',
      detail: cause instanceof Error ? cause.message : String(cause),
    }
  }
}

const urls = [
  ...new Set(RESOURCE_ITEMS.flatMap((item) => (item.url ? [item.url] : []))),
]
const broken: string[] = []

for (const url of urls) {
  const { verdict, detail } = await check(url)
  console.log(`${verdict.padEnd(9)} ${detail.padEnd(6)} ${url}`)
  if (verdict === 'roto') broken.push(url)
}

console.log(`\n${urls.length} URLs, ${broken.length} rotas.`)
if (broken.length > 0) process.exit(1)

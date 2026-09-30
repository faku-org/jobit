/**
 * Lo que hace /verificar en el navegador: muestra qué commit se sirve y, si se
 * lo piden, hashea cada archivo que declara version.json y lo compara. Sin
 * javascript la página sigue diciendo cómo verificar desde afuera, que es lo
 * que importa; esto es la versión rápida y, como dice la página, la que no
 * alcanza sola.
 */

interface Manifest {
  commit: string;
  commit_date: string;
  dirty: boolean;
  repository: string;
  build_hash: string;
  files: Record<string, string>;
}

/** Lo único que desde afuera puede responder 403 (ver deploy/nginx.conf). */
const RESTRICTED = new Set(["admin.html"]);

const field = (name: string): HTMLElement | null =>
  document.querySelector<HTMLElement>(`[data-field="${name}"]`);

const hex = (buffer: ArrayBuffer): string =>
  [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");

const sha256 = async (bytes: ArrayBuffer): Promise<string> =>
  hex(await crypto.subtle.digest("SHA-256", bytes));

/** El mismo cálculo que web/scripts/manifest.ts: sha256 de "ruta hash" por
 * línea, en orden. */
function buildHash(files: Record<string, string>): Promise<string> {
  const lines = Object.keys(files)
    .sort()
    .map((path) => `${path} ${files[path]}`)
    .join("\n");
  return sha256(new TextEncoder().encode(lines).buffer as ArrayBuffer);
}

function say(text: string): void {
  const result = document.querySelector<HTMLElement>("[data-result]");
  if (result) result.textContent = text;
}

async function load(): Promise<Manifest | null> {
  try {
    const response = await fetch("/version.json", { cache: "no-store" });
    if (!response.ok) throw new Error(String(response.status));
    return (await response.json()) as Manifest;
  } catch {
    const commit = field("commit");
    if (commit) commit.textContent = "no se pudo leer /version.json";
    return null;
  }
}

function show(manifest: Manifest): void {
  const commit = field("commit");
  if (commit) {
    const link = document.createElement("a");
    link.href = `${manifest.repository}/commit/${manifest.commit}`;
    link.textContent = manifest.commit.slice(0, 12);
    commit.replaceChildren(link);
  }
  const date = field("date");
  if (date) {
    const when = new Date(manifest.commit_date);
    date.textContent = Number.isNaN(when.getTime())
      ? manifest.commit_date
      : when.toLocaleString("es-UY", { dateStyle: "long", timeStyle: "short" });
  }
  const build = field("build");
  if (build) build.textContent = manifest.build_hash.slice(0, 16);
  const count = field("count");
  if (count) count.textContent = String(Object.keys(manifest.files).length);
  if (manifest.dirty) {
    say("Este build se hizo con cambios sin commitear: no corresponde a ningún commit público.");
  }
}

async function check(manifest: Manifest): Promise<void> {
  say("Comprobando…");
  const problems: string[] = [];
  if ((await buildHash(manifest.files)) !== manifest.build_hash) {
    problems.push("el hash del build no es el de la lista de archivos");
  }
  let checked = 0;
  for (const [path, expected] of Object.entries(manifest.files)) {
    const response = await fetch(`/${path}`, { cache: "no-store" });
    if (response.status === 403 && RESTRICTED.has(path)) continue;
    if (!response.ok) {
      problems.push(`${path} respondió ${response.status}`);
      continue;
    }
    if ((await sha256(await response.arrayBuffer())) !== expected) {
      problems.push(`${path} no es el archivo declarado`);
    }
    checked++;
    say(`Comprobando… ${checked} archivos`);
  }
  say(
    problems.length === 0
      ? `Los ${checked} archivos coinciden con lo declarado. Para saber si lo declarado es el código público, falta lo de abajo.`
      : `No coincide: ${problems.join("; ")}. Escribinos a hola@wefaber.net.`,
  );
}

const manifest = await load();
if (manifest) {
  show(manifest);
  const button = document.querySelector<HTMLButtonElement>("[data-check]");
  button?.addEventListener("click", () => {
    button.disabled = true;
    void check(manifest).finally(() => {
      button.disabled = false;
    });
  });
}

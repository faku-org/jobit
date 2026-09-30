/**
 * Verificar que lo que sirve jobs.wefaber.net es exactamente el código público
 * de un commit. Lo puede correr cualquiera, en su máquina, sin confiar en
 * nada que diga el sitio más que en los bytes que manda.
 *
 *   git clone https://github.com/faku-org/jobit && cd jobit && bun install
 *   bun run verificar
 *
 * Tres pruebas, y las tres tienen que pasar:
 *
 *  1. Lo que el sitio sirve coincide con lo que su version.json dice que sirve.
 *  2. El commit de version.json es público y este clon está parado en él.
 *  3. Buildear ese commit acá da los mismos bytes que el sitio.
 *
 * La tercera es la que importa: si pasa, el JavaScript que corre en tu
 * navegador es el que cualquiera puede leer en el repositorio.
 */
import { resolve } from "node:path";
import {
  type Manifest,
  buildHash,
  compareManifests,
  hashDist,
  identical,
  sha256,
} from "../web/scripts/manifest.ts";

const args = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};

const SITE = (flag("--url") ?? "https://jobs.wefaber.net").replace(/\/+$/, "");
const SKIP_BUILD = args.includes("--no-build");
const ROOT = resolve(import.meta.dir, "..");
/** Lo único que desde afuera puede responder 403 (ver deploy/nginx.conf). */
const RESTRICTED = new Set(["admin.html"]);

let failed = false;
const ok = (message: string) => console.log(`  ✓ ${message}`);
const bad = (message: string) => {
  failed = true;
  console.log(`  ✗ ${message}`);
};
const note = (message: string) => console.log(`  · ${message}`);

const git = (...parts: string[]): string => {
  const run = Bun.spawnSync(["git", ...parts], { cwd: ROOT });
  return run.exitCode === 0 ? run.stdout.toString().trim() : "";
};

console.log(`\nVerificando ${SITE}\n`);

/* --- 1. El sitio contra su propio manifiesto -------------------------------- */
console.log("1. Lo que se sirve contra lo que se declara");

const response = await fetch(`${SITE}/version.json`, { cache: "no-store" });
if (!response.ok) {
  console.log(`  ✗ ${SITE}/version.json respondió ${response.status}`);
  process.exit(1);
}
const live = (await response.json()) as Manifest;

note(`commit ${live.commit} (${live.commit_date})`);
note(`build ${live.build_hash}`);

if (live.dirty) {
  bad("se buildeó con cambios sin commitear: no corresponde a ningún commit público");
}
if (buildHash(live.files) !== live.build_hash) {
  bad("el build_hash no es el de la lista de archivos que declara");
}

let restricted = 0;
for (const [path, expected] of Object.entries(live.files)) {
  const file = await fetch(`${SITE}/${path}`, { cache: "no-store" });
  /** El panel de admin se sirve solo por la VPN: desde afuera da 403, y eso
   * no es una diferencia sino una puerta cerrada. Se cuenta y se sigue. Solo
   * ese archivo: si cualquier 403 valiera, un sitio que sirve algo alterado
   * podría esconderlo detrás de un 403 y la verificación pasaría igual. */
  if (file.status === 403 && RESTRICTED.has(path)) {
    restricted++;
    continue;
  }
  if (!file.ok) {
    bad(`${path}: respondió ${file.status}`);
    continue;
  }
  const actual = sha256(new Uint8Array(await file.arrayBuffer()));
  if (actual !== expected) bad(`${path}: el sitio sirve otra cosa que la que declara`);
}
if (!failed)
  ok(`los ${Object.keys(live.files).length - restricted} archivos públicos son los declarados`);
if (restricted > 0) note(`${restricted} con acceso restringido desde afuera (admin por VPN)`);

/* --- 2. Este clon, parado en ese commit --------------------------------------- */
console.log("\n2. El commit");

const head = git("rev-parse", "HEAD");
if (!head) {
  console.log("  ✗ esto no es un clon de git del repositorio");
  process.exit(1);
}
if (head !== live.commit) {
  console.log(
    `  ✗ este clon está en ${head.slice(0, 12)} y el sitio en ${live.commit.slice(0, 12)}`,
  );
  console.log(
    `\n    git fetch origin && git checkout ${live.commit} && bun install --frozen-lockfile`,
  );
  console.log("    y volvé a correr esto.\n");
  process.exit(2);
}
if (git("status", "--porcelain")) {
  bad("este clon tiene cambios sin commitear: el build no sería el del commit");
} else {
  ok(`el clon está en ${head.slice(0, 12)}, sin cambios`);
}

/* --- 3. Buildear y comparar --------------------------------------------------- */
console.log("\n3. El mismo commit, buildeado acá");

if (!SKIP_BUILD) {
  const build = Bun.spawnSync(["bun", "run", "build"], {
    cwd: ROOT,
    stdout: "ignore",
    stderr: "pipe",
    /* Sin GITHUB_SHA de más: el manifiesto local lo calcula git. */
    env: { ...process.env, GITHUB_SHA: "" },
  });
  if (build.exitCode !== 0) {
    console.log(`  ✗ el build falló:\n${build.stderr.toString()}`);
    process.exit(1);
  }
}

const local = hashDist(resolve(ROOT, "web/dist"));
const comparison = compareManifests(live.files, local);

if (identical(comparison)) {
  ok(
    `mismos ${Object.keys(local).length} archivos, byte a byte (build ${buildHash(local).slice(0, 16)})`,
  );
} else {
  for (const path of comparison.different) bad(`${path}: distinto`);
  for (const path of comparison.onlyLive)
    bad(`${path}: lo sirve el sitio y el commit no lo produce`);
  for (const path of comparison.onlyLocal)
    bad(`${path}: lo produce el commit y el sitio no lo declara`);
  note(
    "si las versiones de Bun o de las dependencias no son las de CI, el build puede diferir sin que el sitio mienta: ver docs/verificar.md",
  );
}

console.log(
  failed
    ? "\nNo coincide. Si no sabés por qué, escribinos a hola@wefaber.net: es exactamente lo que queremos saber.\n"
    : "\nCoincide: lo que corre en tu navegador es el código público de ese commit.\n",
);
process.exit(failed ? 1 : 0);

/**
 * El manifiesto de lo que se sirve: qué commit es, y el sha256 de cada archivo
 * del build. Corre después de `vite build` y deja `dist/version.json`.
 *
 * Existe por una sola razón. El cifrado y las promesas de la política valen
 * mientras el código que corre en el navegador sea el que está publicado: un
 * JavaScript distinto podría quedarse con cualquier cosa antes de cifrarla.
 * Como el build es reproducible (el mismo commit da los mismos bytes, en
 * cualquier máquina con las mismas versiones), cualquiera puede clonar el
 * commit que dice este archivo, buildear y comparar. `bun run verificar` lo
 * hace solo.
 */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const DIST = resolve(import.meta.dir, "../dist");
export const MANIFEST = "version.json";

const git = (...args: string[]): string => {
  const run = Bun.spawnSync(["git", ...args], { cwd: import.meta.dir });
  return run.exitCode === 0 ? run.stdout.toString().trim() : "";
};

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

export const sha256 = (bytes: Uint8Array): string =>
  createHash("sha256").update(bytes).digest("hex");

/**
 * Un solo número para comparar a ojo: el sha256 de la lista ordenada de
 * "ruta hash". Si cambia un byte de cualquier archivo, cambia este.
 */
export function buildHash(files: Record<string, string>): string {
  const lines = Object.keys(files)
    .sort()
    .map((path) => `${path} ${files[path]}`)
    .join("\n");
  return sha256(new TextEncoder().encode(lines));
}

export function hashDist(dir: string = DIST): Record<string, string> {
  const files: Record<string, string> = {};
  for (const path of walk(dir).sort()) {
    const rel = relative(dir, path).split("\\").join("/");
    if (rel === MANIFEST) continue;
    files[rel] = sha256(readFileSync(path));
  }
  return files;
}

if (import.meta.main) {
  const files = hashDist();
  /** En CI el commit lo da GitHub; en local, git. Un árbol con cambios sin
   * commitear no corresponde a ningún commit y el manifiesto lo dice: ese
   * build no se puede verificar contra nada público. */
  const commit = process.env.GITHUB_SHA || git("rev-parse", "HEAD");
  const dirty = !process.env.GITHUB_SHA && git("status", "--porcelain").length > 0;

  const manifest = {
    commit,
    /** La fecha del commit y no la del build: con la hora del build, dos builds
     * del mismo código ya no darían el mismo archivo. */
    commit_date: git("show", "-s", "--format=%cI", commit),
    dirty,
    repository: "https://github.com/faku-org/jobit",
    build_hash: buildHash(files),
    files,
  };

  writeFileSync(join(DIST, MANIFEST), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(
    `version.json: ${commit.slice(0, 12)}${dirty ? " (con cambios sin commitear)" : ""}, build ${manifest.build_hash.slice(0, 16)}, ${Object.keys(files).length} archivos`,
  );
}

export interface Manifest {
  commit: string;
  commit_date: string;
  dirty: boolean;
  repository: string;
  build_hash: string;
  files: Record<string, string>;
}

export interface Comparison {
  /** Archivos que están en los dos y no coinciden. */
  different: string[];
  /** Los publica el sitio y el build del commit no los tiene. */
  onlyLive: string[];
  /** Los tiene el build del commit y el sitio no los declara. */
  onlyLocal: string[];
}

/** Compara el manifiesto que sirve el sitio con el que sale de buildear el
 * mismo commit. Vacío en los tres campos quiere decir idénticos. */
export function compareManifests(
  live: Record<string, string>,
  local: Record<string, string>,
): Comparison {
  const paths = new Set([...Object.keys(live), ...Object.keys(local)]);
  const result: Comparison = { different: [], onlyLive: [], onlyLocal: [] };
  for (const path of [...paths].sort()) {
    const a = live[path];
    const b = local[path];
    if (a === undefined) result.onlyLocal.push(path);
    else if (b === undefined) result.onlyLive.push(path);
    else if (a !== b) result.different.push(path);
  }
  return result;
}

export const identical = (comparison: Comparison): boolean =>
  comparison.different.length === 0 &&
  comparison.onlyLive.length === 0 &&
  comparison.onlyLocal.length === 0;

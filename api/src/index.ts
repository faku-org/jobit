import { cors } from "@elysiajs/cors";
import { Elysia, t } from "elysia";
import { account } from "./account.ts";
import { admin } from "./admin.ts";
import { adminEnabled } from "./auth.ts";
import { ingest, ingestEnabled } from "./ingest.ts";
import { contentFilePath, isContentKind, loadContent, queryContent } from "./content.ts";
import { marketCsv, marketSheets } from "./export.ts";
import { categoryFacets, departmentFacets, filterJobs } from "./filter.ts";
import { type Limit, clientKey, take } from "./limit.ts";
import { type MarketReport, buildMarketReport } from "./market.ts";
import { boardView, formatMarket, localViewMessage, withBoardView } from "./cli.ts";
import { formatJob, formatJobs } from "./raw.ts";
import { XLSX_MIME, toXlsx } from "./xlsx.ts";
import { type Ranking, isEmptyRanking, isMix } from "./rank.ts";
import { appendEvents, eventsFilePath, eventsSchema } from "./events.ts";
import { appendStats, statsFilePath, statsSchema } from "./stats.ts";
import { loadFeed, lookupJob } from "./feed.ts";
import { site } from "./site.ts";
import { jobsFilePath } from "./store.ts";
import type { JobType, JobsQuery, Level, Result, SalaryRange, WorkMode } from "./types.ts";
import type { ContentKind } from "@jobit/worker/content/types";

const PORT = Number(process.env.PORT ?? 3000);
/**
 * Localhost by default: in production this sits behind nginx, and binding the
 * world would both expose it directly and make the forwarded header spoofable.
 * Set HOST to 0.0.0.0 to serve it straight, knowingly.
 */
const HOST = process.env.HOST ?? "127.0.0.1";
const CORS_ORIGINS = (process.env.CORS_ORIGIN ?? "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/** Generous for somebody reading the board, which paginates fifty at a time. */
const READ_LIMIT: Limit = { windowMs: MINUTE, max: 120 };
/**
 * The browser sends this once a day. The ceiling is for the whole carrier NAT
 * behind one address, not for one person, and a refused row costs nothing:
 * the client swallows the failure rather than showing it to somebody job
 * hunting.
 */
const WRITE_LIMIT: Limit = { windowMs: HOUR, max: 20 };
/**
 * Los eventos se mandan en lote cada vez que la pestaña se esconde, y cambiar
 * de aplicación esconde la pestaña: son bastantes más envíos que el resumen
 * diario, cada uno de a veinte filas como mucho.
 */
const EVENTS_LIMIT: Limit = { windowMs: HOUR, max: 60 };
/**
 * Probar contraseñas es lo único que se puede atacar sin estar adentro, así que
 * las rutas de cuentas tienen su propio presupuesto, chico y por dirección,
 * igual que el login del panel.
 */
const AUTH_LIMIT: Limit = { windowMs: 15 * MINUTE, max: 10 };

/**
 * A failed read names a path on the box. That is nothing the browser can act
 * on and something an attacker would like, so it goes to the log and the
 * answer stays vague.
 */
function unavailable(error: string): string {
  console.error(`[jobit] ${error}`);
  return "las ofertas no están disponibles en este momento";
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const MAX_EDUCATION_RANK = 6;
const MAX_EXPERIENCE_YEARS = 60;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

const LEVELS: readonly Level[] = ["entry", "mid", "senior"];
const WORK_MODES: readonly WorkMode[] = ["onsite", "remote", "hybrid"];
const JOB_TYPES: readonly JobType[] = ["full_time", "part_time", "internship"];

const splitList = (raw: string | undefined): string[] =>
  raw
    ?.split(",")
    .map((value) => value.trim())
    .filter(Boolean) ?? [];

const asSet = (values: string[]): Set<string> | undefined =>
  values.length > 0 ? new Set(values) : undefined;

/** The enum dimensions take a comma-separated list; a job matches any member. */
function parseSet<T extends string>(
  name: string,
  raw: string | undefined,
  allowed: readonly T[],
): Result<Set<T> | undefined> {
  const values = splitList(raw);
  if (values.length === 0) return { ok: true, value: undefined };

  const unknown = values.filter((value) => !(allowed as readonly string[]).includes(value));
  if (unknown.length > 0) {
    return { ok: false, error: `${name} inválido: ${unknown.join(", ")}` };
  }
  return { ok: true, value: new Set(values as T[]) };
}

/** Order carries the preference, so the ranking lists keep duplicates out
 * without going through a Set, which would say nothing about position. */
const parseOrdered = <T extends string>(raw: string | undefined, allowed: readonly T[]): T[] => {
  const values = splitList(raw).filter((value): value is T =>
    (allowed as readonly string[]).includes(value),
  );
  return [...new Set(values)];
};

const parseSalary = (
  min: number | undefined,
  max: number | undefined,
  includeUnknown: boolean | undefined,
): SalaryRange | undefined =>
  min === undefined && max === undefined
    ? undefined
    : {
        min: min ?? null,
        max: max ?? null,
        includeUnknown: includeUnknown !== false,
      };

const jobsQuerySchema = t.Object({
  ids: t.Optional(t.String()),
  q: t.Optional(t.String()),
  level: t.Optional(t.String()),
  remote: t.Optional(t.String()),
  category: t.Optional(t.String()),
  source: t.Optional(t.String()),
  department: t.Optional(t.String()),
  job_type: t.Optional(t.String()),
  hide_category: t.Optional(t.String()),
  hide_department: t.Optional(t.String()),
  salary_min: t.Optional(t.Numeric({ minimum: 0 })),
  salary_max: t.Optional(t.Numeric({ minimum: 0 })),
  salary_unknown: t.Optional(t.BooleanString()),
  no_experience: t.Optional(t.BooleanString()),
  days: t.Optional(t.Numeric({ minimum: 1 })),
  sort: t.Optional(t.Union([t.Literal("recent"), t.Literal("closing"), t.Literal("match")])),
  rank_category: t.Optional(t.String()),
  rank_department: t.Optional(t.String()),
  rank_mode: t.Optional(t.String()),
  rank_level: t.Optional(t.String()),
  rank_job_type: t.Optional(t.String()),
  rank_salary: t.Optional(t.Numeric({ minimum: 0 })),
  rank_no_experience: t.Optional(t.BooleanString()),
  rank_education: t.Optional(t.Numeric({ minimum: 0 })),
  rank_experience: t.Optional(t.Numeric({ minimum: 0 })),
  rank_mix: t.Optional(t.String()),
  limit: t.Optional(t.Numeric()),
  offset: t.Optional(t.Numeric()),
  format: t.Optional(t.Union([t.Literal("json"), t.Literal("txt")])),
  /** Del tablero, no de la consulta: los entiende `/api/cli`. */
  view: t.Optional(t.String()),
  job: t.Optional(t.String()),
  embed: t.Optional(t.String()),
});

type JobsQueryParams = typeof jobsQuerySchema.static;

/** The soft half of the query: everything that reorders instead of removing. */
function readRanking(query: JobsQueryParams): Ranking | undefined {
  const ranking: Ranking = {
    categories: splitList(query.rank_category),
    departments: splitList(query.rank_department),
    modes: parseOrdered(query.rank_mode, WORK_MODES),
    levels: parseOrdered(query.rank_level, LEVELS),
    jobTypes: parseOrdered(query.rank_job_type, JOB_TYPES),
    salaryTarget: query.rank_salary ?? null,
    noExperience: query.rank_no_experience === true,
    education:
      query.rank_education === undefined
        ? null
        : clamp(Math.round(query.rank_education), 0, MAX_EDUCATION_RANK),
    experienceYears:
      query.rank_experience === undefined
        ? null
        : clamp(Math.round(query.rank_experience), 0, MAX_EXPERIENCE_YEARS),
    mix: isMix(query.rank_mix) ? query.rank_mix : "balanced",
  };

  return isEmptyRanking(ranking) ? undefined : ranking;
}

function jobsQueryFrom(query: JobsQueryParams): Result<JobsQuery> {
  const levels = parseSet("level", query.level, LEVELS);
  const workModes = parseSet("remote", query.remote, WORK_MODES);
  const jobTypes = parseSet("job_type", query.job_type, JOB_TYPES);
  const invalid = [levels, workModes, jobTypes].find((result) => !result.ok);
  if (invalid && !invalid.ok) return invalid;

  return {
    ok: true,
    value: {
      ids: asSet(splitList(query.ids)),
      q: query.q?.trim() || undefined,
      levels: levels.ok ? levels.value : undefined,
      workModes: workModes.ok ? workModes.value : undefined,
      categories: asSet(splitList(query.category)),
      sources: asSet(splitList(query.source)),
      departments: asSet(splitList(query.department)),
      hiddenCategories: asSet(splitList(query.hide_category)),
      hiddenDepartments: asSet(splitList(query.hide_department)),
      jobTypes: jobTypes.ok ? jobTypes.value : undefined,
      salary: parseSalary(query.salary_min, query.salary_max, query.salary_unknown),
      noExperience: query.no_experience || undefined,
      days: query.days,
      sort: query.sort,
      ranking: query.sort === "match" ? readRanking(query) : undefined,
      limit: clamp(Math.floor(query.limit ?? DEFAULT_LIMIT), 1, MAX_LIMIT),
      offset: Math.max(Math.floor(query.offset ?? 0), 0),
    },
  };
}

/** Sin Accept, curl sigue recibiendo JSON. Texto solo si se pidió. */
function wantsText(request: Request, format: string | undefined): boolean {
  if (format === "txt") return true;
  const accept = request.headers.get("accept") ?? "";
  return accept.includes("text/plain") && !accept.includes("application/json");
}

const TEXT_TYPE = "text/plain; charset=utf-8";

const asText = (body: string): Response =>
  new Response(body, { headers: { "content-type": TEXT_TYPE } });

/** El informe del mercado, o el motivo por el que no se pudo armar. Lo piden
 * tres rutas: la que lo sirve como JSON y las dos que lo bajan como archivo. */
async function marketReport(): Promise<Result<MarketReport>> {
  const file = await loadFeed();
  if (!file.ok) return { ok: false, error: unavailable(file.error) };
  return { ok: true, value: buildMarketReport(file.value.jobs, file.value.scraped_at) };
}

/** El BOM que Excel necesita para leer un CSV como UTF-8; el resto de los
 * lectores lo ignora. */
const BOM = "\uFEFF";

/**
 * Un archivo con nombre, y el nombre lleva la fecha de scrape: dos descargas de
 * distintos días quedan una al lado de la otra en la carpeta de descargas en
 * vez de pisarse.
 */
function download(
  body: string | Uint8Array,
  extension: string,
  type: string,
  report: MarketReport,
): Response {
  const day = (report.scraped_at || new Date().toISOString()).slice(0, 10);
  return new Response(body, {
    headers: {
      "content-type": type,
      "content-disposition": `attachment; filename="jobit-mercado-${day}.${extension}"`,
    },
  });
}

export const app = new Elysia()
  .use(cors({ origin: CORS_ORIGINS }))
  /** Writing costs a line on disk, reading costs a scan of the board: the two
   * get their own budget, and their own bucket per client. El panel queda con
   * el presupuesto de lectura: escribe seguido y ya se defiende solo, con la
   * sesión y con su propio límite en el login. */
  .onBeforeHandle(({ request, server, path, set, status }) => {
    const key = clientKey(request, server?.requestIP(request)?.address ?? null);
    const [bucket, limit] =
      path === "/api/events"
        ? (["e", EVENTS_LIMIT] as const)
        : path.startsWith("/api/auth/")
          ? (["a", AUTH_LIMIT] as const)
          : request.method === "POST" && !path.startsWith("/api/admin")
            ? (["w", WRITE_LIMIT] as const)
            : (["r", READ_LIMIT] as const);

    const allowance = take(`${bucket}:${key}`, limit);
    if (allowance.ok) return;

    set.headers["retry-after"] = String(allowance.retryAfter);
    return status(429, { error: "demasiadas peticiones" });
  })
  .onAfterHandle(({ set }) => {
    set.headers["x-content-type-options"] = "nosniff";
    set.headers["referrer-policy"] = "no-referrer";
  })
  .get("/health", () => ({ status: "ok" }))
  .use(site)
  .use(admin)
  .use(account)
  .use(ingest)
  .get(
    "/api/jobs",
    async ({ query, request, status }) => {
      const file = await loadFeed();
      if (!file.ok) return status(503, { error: unavailable(file.error) });

      const params = jobsQueryFrom(query);
      if (!params.ok) return status(422, { error: params.error });

      const found = filterJobs(file.value.jobs, params.value);
      return wantsText(request, query.format) ? asText(formatJobs(found)) : found;
    },
    { query: jobsQuerySchema },
  )
  .get(
    "/api/jobs.txt",
    async ({ query, status }) => {
      const file = await loadFeed();
      if (!file.ok) return status(503, { error: unavailable(file.error) });

      const params = jobsQueryFrom(query);
      if (!params.ok) return status(422, { error: params.error });

      return asText(formatJobs(filterJobs(file.value.jobs, params.value)));
    },
    { query: jobsQuerySchema },
  )
  /**
   * La URL del tablero, en texto. `view` y `job` son los de la barra de
   * direcciones; el resto son los de `/api/jobs`. nginx y el dev server
   * reescriben `/` acá cuando el cliente es curl.
   */
  .get(
    "/api/cli",
    async ({ query, status }) => {
      const file = await loadFeed();
      if (!file.ok) return status(503, { error: unavailable(file.error) });

      const id = query.job?.trim() || query.embed?.trim();
      if (id) {
        const found = lookupJob(file.value, id);
        if (!found) return status(404, { error: "oferta no encontrada" });
        return asText(`${formatJob(found, true)}\n`);
      }

      const view = boardView(query.view);
      const local = localViewMessage(view);
      if (local) return asText(local);

      if (view === "market") {
        return asText(formatMarket(buildMarketReport(file.value.jobs, file.value.scraped_at)));
      }

      const params = jobsQueryFrom(withBoardView(query, view));
      if (!params.ok) return status(422, { error: params.error });
      return asText(formatJobs(filterJobs(file.value.jobs, params.value)));
    },
    { query: jobsQuerySchema },
  )
  .get(
    "/api/jobs/:id",
    async ({ params, request, query, status }) => {
      const file = await loadFeed();
      if (!file.ok) return status(503, { error: unavailable(file.error) });

      const job = lookupJob(file.value, params.id);
      if (!job) return status(404, { error: "oferta no encontrada" });
      return wantsText(request, query.format) ? asText(formatJob(job, true)) : job;
    },
    { query: t.Object({ format: t.Optional(t.Union([t.Literal("json"), t.Literal("txt")])) }) },
  )
  .get("/api/meta", async ({ status }) => {
    const file = await loadFeed();
    if (!file.ok) return status(503, { error: unavailable(file.error) });

    const { count, scraped_at, sources, jobs } = file.value;

    return {
      count,
      scraped_at,
      sources,
      categories: categoryFacets(jobs),
      departments: departmentFacets(jobs),
      no_experience_count: jobs.filter((job) => job.no_experience).length,
    };
  })
  /**
   * El contenido curado por rubro y puesto: preguntas, ejercicios y recursos.
   * Es público y no lleva nada de nadie; la web lo pide al abrir una oferta con
   * seguimiento. `kind` acepta varios separados por coma.
   */
  .get(
    "/api/content",
    async ({ query, status }) => {
      const content = await loadContent();
      if (!content.ok) return status(503, { error: content.error });

      const kinds = splitList(query.kind);
      const unknown = kinds.filter((kind) => !isContentKind(kind));
      if (unknown.length > 0) return status(422, { error: `kind inválido: ${unknown.join(", ")}` });

      return queryContent(content.value, {
        kinds: kinds.length > 0 ? new Set(kinds as ContentKind[]) : undefined,
        category: query.category?.trim() || undefined,
        role: query.role?.trim() || undefined,
        q: query.q?.trim() || undefined,
        limit: clamp(Math.floor(query.limit ?? 20), 1, 60),
        offset: Math.max(Math.floor(query.offset ?? 0), 0),
      });
    },
    {
      query: t.Object({
        kind: t.Optional(t.String()),
        category: t.Optional(t.String()),
        role: t.Optional(t.String()),
        q: t.Optional(t.String()),
        limit: t.Optional(t.Numeric()),
        offset: t.Optional(t.Numeric()),
      }),
    },
  )
  /** The board as a whole, with nothing in it about the person asking. */
  .get("/api/market", async ({ status }) => {
    const report = await marketReport();
    return report.ok ? report.value : status(503, { error: report.error });
  })
  /** El mismo informe para bajar: CSV para procesarlo, XLSX para abrirlo. */
  .get("/api/market.csv", async ({ status }) => {
    const report = await marketReport();
    if (!report.ok) return status(503, { error: report.error });
    const body = `${BOM}${marketCsv(report.value)}`;
    return download(body, "csv", "text/csv; charset=utf-8", report.value);
  })
  .get("/api/market.xlsx", async ({ status }) => {
    const report = await marketReport();
    if (!report.ok) return status(503, { error: report.error });
    return download(toXlsx(marketSheets(report.value)), "xlsx", XLSX_MIME, report.value);
  })
  .post(
    "/api/stats",
    async ({ body, status }) => {
      try {
        await appendStats(body);
        return { status: "ok" };
      } catch (cause) {
        console.error(`[jobit] no se pudo escribir la estadística: ${String(cause)}`);
        return status(503, { error: "no se pudo registrar la estadística" });
      }
    },
    { body: statsSchema },
  )
  /** Un lote de eventos de uso. events.ts recorta cada uno contra vocabularios
   * conocidos, así que el archivo nunca guarda texto libre. */
  .post(
    "/api/events",
    async ({ body, status }) => {
      try {
        const written = await appendEvents(body.events);
        return { status: "ok", written };
      } catch (cause) {
        console.error(`[jobit] no se pudieron escribir los eventos: ${String(cause)}`);
        return status(503, { error: "no se pudieron registrar los eventos" });
      }
    },
    { body: eventsSchema },
  );

if (import.meta.main) {
  app.listen({ port: PORT, hostname: HOST });
  console.log(`jobit api on http://${HOST}:${PORT}`);
  console.log(`reading ${jobsFilePath()}`);
  console.log(`contenido -> ${contentFilePath()}`);
  console.log(`stats -> ${statsFilePath()}`);
  console.log(`eventos -> ${eventsFilePath()}`);
  console.log(`cors origins: ${CORS_ORIGINS.join(", ")}`);
  console.log(
    adminEnabled()
      ? "admin: habilitado"
      : "admin: apagado (falta ADMIN_PASSWORD_HASH), /api/admin responde 404",
  );
  console.log(
    ingestEnabled()
      ? "ingesta: habilitada"
      : "ingesta: apagada (falta INGEST_TOKEN), /api/ingest responde 404",
  );
}

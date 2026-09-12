import { db } from "./db.ts";
import {
  type Print,
  type Review,
  type ServiceText,
  minhash,
  review,
  textHash,
} from "./moderation.ts";
import * as services from "./services.ts";
import type { Service } from "./services.ts";

/**
 * La cola de moderación: lo que el filtro dejó anotado y lo que alguien tiene
 * que mirar. El filtro vive en moderation.ts y es puro; acá está lo que se
 * guarda y en qué orden se muestra.
 */
export const DECISIONS = ["approved", "rejected", "suspended"] as const;
export type Decision = (typeof DECISIONS)[number];

/** Una lista corta: la denuncia no lleva texto libre de un desconocido. */
export const REPORT_REASONS = ["spam", "enganoso", "inapropiado", "no-es-un-servicio"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

const day = (now: Date): string => now.toISOString().slice(0, 10);

export const textOf = (service: Service): ServiceText => ({
  title: service.title,
  summary: service.summary,
  description: service.description,
  category: service.category,
  skills: service.skills,
});

const bodyOf = (text: ServiceText): string =>
  [text.title, text.summary, text.description, text.skills.join(" ")].join("\n");

/** Lo ya visto, sin el servicio que se está revisando: parecerse a uno mismo
 * no es parecerse a nada. */
export function prints(excludeServiceId = ""): Print[] {
  return db()
    .query<Print, [string]>(
      "SELECT service_id, kind, text_hash, signature FROM moderation_prints WHERE service_id <> ?",
    )
    .all(excludeServiceId);
}

/** Lo que dijo el filtro (`queue`, `reject`) o lo que decidió una persona. */
export type StoredDecision = Review["decision"] | Decision;

export interface StoredReview extends Omit<Review, "decision"> {
  decision: StoredDecision;
  service_id: string;
  /** Vacío cuando la decisión la tomó el filtro y no una persona. */
  decided_by: string;
  decided_at: string;
}

interface ReviewRow {
  service_id: string;
  score: number;
  reasons: string;
  decision: string;
  decided_by: string;
  decided_at: string;
}

const hydrate = (row: ReviewRow): StoredReview => ({
  service_id: row.service_id,
  score: row.score,
  reasons: JSON.parse(row.reasons) as Review["reasons"],
  decision: row.decision as StoredDecision,
  decided_by: row.decided_by,
  decided_at: row.decided_at,
});

export function reviewOf(serviceId: string): StoredReview | null {
  const row = db()
    .query<ReviewRow, [string]>("SELECT * FROM moderation_reviews WHERE service_id = ?")
    .get(serviceId);
  return row ? hydrate(row) : null;
}

function save(
  serviceId: string,
  score: number,
  reasons: unknown,
  decision: string,
  by = "",
  at = "",
): void {
  db().run(
    `INSERT OR REPLACE INTO moderation_reviews (service_id, score, reasons, decision, decided_by, decided_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [serviceId, score, JSON.stringify(reasons), decision, by, at],
  );
}

/**
 * Lo que pasa cuando alguien manda un servicio a la cola. Corre el filtro,
 * deja el puntaje anotado y, si el texto es uno que ya se rechazó, lo devuelve
 * a borrador en vez de dejarlo esperando. Queda en la cola igual: un rechazo
 * automático sin nadie que pueda mirarlo es un rechazo que nadie puede
 * discutir.
 */
export function submit(service: Service, now: Date = new Date()): StoredReview {
  const text = textOf(service);
  const result = review(text, prints(service.id));

  if (result.decision === "reject") {
    save(service.id, result.score, result.reasons, "rejected", "", day(now));
    services.setStatus(service.id, "draft", now);
    remember(service, "rejected", now);
  } else {
    save(service.id, result.score, result.reasons, "queue");
  }

  return (
    reviewOf(service.id) ?? { ...result, service_id: service.id, decided_by: "", decided_at: "" }
  );
}

/**
 * Se acuerda del texto sin guardarlo: el hash para reconocer el mismo texto y
 * la firma para reconocer el parecido.
 */
export function remember(service: Service, kind: Print["kind"], now: Date = new Date()): void {
  const text = textOf(service);
  db().run(
    `INSERT OR REPLACE INTO moderation_prints (text_hash, service_id, kind, signature, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [textHash(text), service.id, kind, minhash(bodyOf(text)), day(now)],
  );
}

export interface QueueItem {
  service: Service;
  review: StoredReview | null;
  reports: number;
}

/**
 * Lo que hay para mirar: lo que espera, lo que el filtro rechazó solo y lo
 * denunciado. Ordenado por puntaje, que es para lo que sirve el puntaje.
 */
export function pending(): QueueItem[] {
  const waiting = services.list({ status: "pending" });

  const autoRejected = db()
    .query<{ service_id: string }, []>(
      "SELECT service_id FROM moderation_reviews WHERE decision = 'rejected' AND decided_by = ''",
    )
    .all()
    .map((row) => services.byId(row.service_id))
    .filter((service): service is Service => service !== null && service.status === "draft");

  const reported = db()
    .query<{ service_id: string }, []>(
      "SELECT DISTINCT service_id FROM service_reports WHERE handled = 0",
    )
    .all()
    .map((row) => services.byId(row.service_id))
    .filter((service): service is Service => service !== null);

  const byId = new Map<string, Service>();
  for (const service of [...waiting, ...autoRejected, ...reported]) byId.set(service.id, service);

  return [...byId.values()]
    .map((service) => ({
      service,
      review: reviewOf(service.id),
      reports: reportCount(service.id),
    }))
    .sort(
      (a, b) =>
        b.reports - a.reports ||
        (b.review?.score ?? 0) - (a.review?.score ?? 0) ||
        a.service.updated_at.localeCompare(b.service.updated_at),
    );
}

export const reportCount = (serviceId: string): number =>
  db()
    .query<{ n: number }, [string]>(
      "SELECT COUNT(*) AS n FROM service_reports WHERE service_id = ? AND handled = 0",
    )
    .get(serviceId)?.n ?? 0;

/**
 * La decisión de una persona. Aprobar publica; rechazar devuelve a borrador,
 * porque quien lo escribió tiene que poder arreglarlo y volver a mandarlo;
 * suspender lo baja y no lo devuelve.
 */
export function decide(
  serviceId: string,
  decision: Decision,
  by = "admin",
  now: Date = new Date(),
): boolean {
  const service = services.byId(serviceId);
  if (!service) return false;

  const status =
    decision === "approved" ? "published" : decision === "rejected" ? "draft" : "suspended";
  services.setStatus(serviceId, status, now);

  const current = reviewOf(serviceId);
  save(serviceId, current?.score ?? 0, current?.reasons ?? [], decision, by, day(now));

  /** Lo aprobado y lo rechazado se recuerdan: el dedupe compara contra las dos
   * cosas. Lo suspendido también, que es un rechazo más tarde. */
  remember(service, decision === "approved" ? "published" : "rejected", now);

  db().run("UPDATE service_reports SET handled = 1 WHERE service_id = ?", [serviceId]);
  return true;
}

export function report(serviceId: string, reason: ReportReason, now: Date = new Date()): boolean {
  if (!services.byId(serviceId)) return false;

  db().run("INSERT INTO service_reports (service_id, reason, created_at) VALUES (?, ?, ?)", [
    serviceId,
    reason,
    day(now),
  ]);
  return true;
}

export const counts = (): { pending: number; reported: number } => ({
  pending: services.counts().pending,
  reported:
    db()
      .query<{ n: number }, []>(
        "SELECT COUNT(DISTINCT service_id) AS n FROM service_reports WHERE handled = 0",
      )
      .get()?.n ?? 0,
});

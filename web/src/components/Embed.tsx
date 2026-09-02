import { ArrowUpRight, Briefcase, Clock3, Laptop, MapPin, Sparkles, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import { useTheme } from "../hooks/useTheme.ts";
import { fetchJob, isAbortError } from "../lib/api.ts";
import {
  JOB_TYPE_LABEL,
  WORK_MODE_LABEL,
  formatLocation,
  formatSalary,
  relativeDate,
} from "../lib/format.ts";
import { jobLink } from "../lib/share.ts";
import { chipClass, mutedChip } from "../lib/styles.ts";
import { type Job, type Theme, workMode } from "../lib/types.ts";

interface EmbedProps {
  id: string;
  theme: Theme;
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-[560px] rounded-2xl border border-sky/50 bg-surface p-4 text-ink">
      {children}
    </div>
  );
}

function Card({ job }: { job: Job }) {
  const mode = workMode(job);
  const salary = formatSalary(job.salary);

  return (
    <Frame>
      <div className="flex items-start justify-between gap-3">
        <h1 className="text-[15px] leading-snug font-semibold tracking-tight">
          <a
            className="transition-colors hover:text-brand"
            href={job.apply_url}
            rel="noreferrer noopener"
            target="_blank"
          >
            {job.title}
          </a>
        </h1>
        <span className="shrink-0 text-xs text-ink/50">{relativeDate(job.date_posted)}</span>
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink/70">
        {job.company ? (
          <span className="inline-flex items-center gap-1.5">
            <Briefcase aria-hidden className="size-3.5 shrink-0 text-brand" />
            {job.company}
          </span>
        ) : null}
        <span className="inline-flex items-center gap-1.5">
          <MapPin aria-hidden className="size-3.5 shrink-0 text-brand" />
          {formatLocation(job.city, job.department)}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className={mutedChip}>{job.category_label}</span>
        <span className={job.remote ? `${chipClass} bg-brand/15 text-ink` : mutedChip}>
          <Laptop aria-hidden className="size-3.5" />
          {WORK_MODE_LABEL[mode]}
        </span>
        {job.job_type ? <span className={mutedChip}>{JOB_TYPE_LABEL[job.job_type]}</span> : null}
        {job.no_experience ? (
          <span className={`${chipClass} bg-sky/40 text-ink`}>
            <Sparkles aria-hidden className="size-3.5" />
            Sin experiencia
          </span>
        ) : null}
        {salary ? (
          <span className={`${chipClass} bg-ink/10 text-ink`}>
            <Wallet aria-hidden className="size-3.5" />
            {salary}
          </span>
        ) : null}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <a
          className="inline-flex items-center gap-1 text-xs font-medium text-ink/50 transition-colors hover:text-ink"
          href={jobLink(job.id)}
          rel="noreferrer noopener"
          target="_blank"
        >
          <Clock3 aria-hidden className="size-3.5" />
          Ver en JobIt
        </a>
        <a
          className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-panel px-3.5 py-2 text-sm font-medium text-onpanel transition-colors hover:bg-brand"
          href={job.apply_url}
          rel="noreferrer noopener"
          target="_blank"
        >
          Postularme
          <ArrowUpRight aria-hidden className="size-4" />
        </a>
      </div>
    </Frame>
  );
}

/**
 * One offer on somebody else's page: the iframe target of the share menu. It
 * only ever links out, so nothing here touches the stored preferences.
 */
export function Embed({ id, theme }: EmbedProps) {
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState(false);

  useTheme(theme);

  useEffect(() => {
    const controller = new AbortController();
    fetchJob(id, controller.signal)
      .then(setJob)
      .catch((cause: unknown) => {
        if (isAbortError(cause)) return;
        setError(true);
      });
    return () => controller.abort();
  }, [id]);

  if (error) {
    return (
      <Frame>
        <p className="text-sm text-ink/70">Esta oferta ya no está disponible.</p>
        <a
          className="mt-1 inline-block text-sm font-medium text-brand"
          href={jobLink(id)}
          rel="noreferrer noopener"
          target="_blank"
        >
          Buscar en JobIt
        </a>
      </Frame>
    );
  }

  if (!job) {
    return (
      <Frame>
        <div className="animate-pulse">
          <div className="h-4 w-3/5 rounded-full bg-sky/60" />
          <div className="mt-3 h-3 w-2/5 rounded-full bg-mist" />
          <div className="mt-4 flex gap-2">
            <div className="h-6 w-20 rounded-full bg-mist" />
            <div className="h-6 w-16 rounded-full bg-mist" />
          </div>
        </div>
      </Frame>
    );
  }

  return <Card job={job} />;
}

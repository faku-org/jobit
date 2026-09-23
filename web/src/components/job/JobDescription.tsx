import { Check } from "lucide-react";
import { useMemo } from "react";
import {
  type Block,
  type Mark,
  type Span,
  parseDescription,
  renderSpans,
} from "../../lib/description.ts";
import { fold } from "../../lib/catalog.ts";
import { findMarks, findPerks, findProfileMatches } from "../../lib/perks.ts";
import { formatWeeklyHours, weeklyHours } from "../../lib/schedule.ts";
import type { Profile } from "../../lib/profile.ts";
import { AuraSpark } from "../ui/Aura.tsx";

interface JobDescriptionProps {
  text: string;
  /** Only read to point at the requirements this person already meets. */
  profile: Profile;
}

const MARK_STYLE: Record<Mark["tone"], string> = {
  perk: "rounded bg-brand/15 px-1 py-0.5 text-ink decoration-brand/40 underline decoration-dotted underline-offset-2",
  match: "rounded bg-sky/45 px-1 py-0.5 font-medium text-ink",
};

function spanIdentity(span: Span): string {
  if (span.kind === "link") return `link:${span.href}:${span.text}`;
  if (span.kind === "mark") return `mark:${span.tone}:${span.note}:${span.text}`;
  return `${span.kind}:${span.text}`;
}

function blockIdentity(block: Block): string {
  if (block.kind === "heading") return `heading:${block.text}`;
  if (block.kind === "paragraph") return `paragraph:${block.text}`;
  if (block.kind === "list") return `list:${block.items.join("\0")}`;
  return `fields:${block.rows.map((row) => `${row.label}=${row.value}`).join("\0")}`;
}

/** Keys from content, disambiguated if the same run appears twice. */
function keyed<T>(items: T[], identity: (item: T) => string): [T, string][] {
  const seen = new Map<string, number>();
  return items.map((item) => {
    const base = identity(item);
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return [item, n === 0 ? base : `${base}#${n}`];
  });
}

function Spans({ text, marks }: { text: string; marks: Mark[] }) {
  const spans: Span[] = renderSpans(text, marks);

  return (
    <>
      {keyed(spans, spanIdentity).map(([span, key]) => {
        if (span.kind === "strong") {
          return (
            <strong key={key} className="font-semibold text-ink">
              {span.text}
            </strong>
          );
        }
        if (span.kind === "link") {
          return (
            <a
              key={key}
              className="font-medium text-brand underline decoration-brand/40 underline-offset-2 hover:decoration-brand"
              href={span.href}
              rel="noreferrer noopener"
              target="_blank"
            >
              {span.text}
            </a>
          );
        }
        if (span.kind === "mark") {
          return (
            <mark key={key} className={MARK_STYLE[span.tone]} title={span.note}>
              {span.text}
            </mark>
          );
        }
        return <span key={key}>{span.text}</span>;
      })}
    </>
  );
}

/** One parsed block, with the highlights that fall inside it. */
function BlockView({ block, profile }: { block: Block; profile: Profile }) {
  if (block.kind === "heading") {
    return (
      <h4 className="mt-6 border-l-[3px] border-brand pl-3 text-[15px] leading-snug font-semibold tracking-tight text-ink first:mt-0">
        {block.text}
      </h4>
    );
  }

  if (block.kind === "fields") {
    return (
      <dl className="mt-3 grid gap-x-3 gap-y-1.5 rounded-xl bg-mist px-3.5 py-3 sm:grid-cols-[auto_1fr]">
        {block.rows.map((row) => {
          const hours = fold(row.label) === "horario" ? weeklyHours(row.value) : null;
          return (
            <div key={row.label} className="contents">
              <dt className="text-xs font-medium text-muted sm:text-right">{row.label}</dt>
              <dd className="mb-1.5 text-sm text-ink/85 sm:mb-0">
                <Spans marks={findMarks(row.value, profile)} text={row.value} />
                {hours !== null ? (
                  <span className="text-muted"> · {formatWeeklyHours(hours)}</span>
                ) : null}
              </dd>
            </div>
          );
        })}
      </dl>
    );
  }

  if (block.kind === "list") {
    return (
      <ul className="mt-2.5 space-y-1.5">
        {keyed(block.items, (item) => item).map(([item, key]) => (
          <li key={key} className="flex gap-2.5">
            <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-brand" />
            <span className="text-[15px] leading-relaxed text-ink/80">
              <Spans marks={findMarks(item, profile)} text={item} />
            </span>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <p className="mt-2.5 text-[15px] leading-7 text-ink/80">
      <Spans marks={findMarks(block.text, profile)} text={block.text} />
    </p>
  );
}

/**
 * The offer as it was written, with its own structure given back to it: the
 * headings the employer typed become headings, the dashes become a list, and
 * what is worth noticing is marked instead of left in the middle of the fourth
 * paragraph.
 */
export function JobDescription({ text, profile }: JobDescriptionProps) {
  const blocks = useMemo(() => parseDescription(text), [text]);
  const perks = useMemo(() => findPerks(text), [text]);
  const matches = useMemo(() => findProfileMatches(text, profile), [text, profile]);

  return (
    <div>
      {perks.length > 0 || matches.length > 0 ? (
        <div className="mb-4 rounded-xl border border-brand/30 bg-brand/5 px-3.5 py-3">
          <p className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted uppercase">
            <AuraSpark intro={false} />
            Puntos a favor
          </p>

          <div className="mt-2 flex flex-wrap gap-1.5">
            {matches.map((label) => (
              <span
                key={label}
                className="inline-flex items-center gap-1 rounded-full bg-sky px-2.5 py-1 text-xs font-medium text-ink"
                title="Lo pide y vos lo tenés en tu perfil"
              >
                <Check aria-hidden className="size-3" />
                {label}
              </span>
            ))}
            {perks.map((perk) => (
              <span
                key={perk.id}
                className="inline-flex items-center rounded-full bg-brand/15 px-2.5 py-1 text-xs font-medium text-ink/80"
              >
                {perk.label}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {keyed(blocks, blockIdentity).map(([block, key]) => (
        <BlockView key={key} block={block} profile={profile} />
      ))}
    </div>
  );
}

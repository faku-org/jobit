import { BookOpen, ExternalLink, HelpCircle } from "lucide-react";
import { m } from "motion/react";
import type { ContentItem } from "@jobit/worker/content/types";
import { externalRel } from "../../lib/content.ts";
import { fadeUpTransition, stagger } from "../../lib/motion.ts";

interface PrepTipsProps {
  items: ContentItem[];
}

function Heading({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-1.5 text-sm font-medium text-ink">
      <span aria-hidden className="text-brand">
        {icon}
      </span>
      {children}
    </p>
  );
}

/**
 * Lo que se ofrece al confirmar una postulación: los ejercicios de práctica y
 * las preguntas del área. Es el contenido del sistema compartido, pedido por
 * rubro, así que un rubro sin nada no dibuja nada.
 */
export function PrepTips({ items }: PrepTipsProps) {
  if (items.length === 0) return null;

  const exercises = items.filter((item) => item.kind === "exercise");
  const questions = items.filter((item) => item.kind === "faq" || item.kind === "topic");

  return (
    <div className="space-y-5">
      {exercises.length > 0 ? (
        <div>
          <Heading icon={<BookOpen className="size-4" />}>Para practicar</Heading>
          <ul className="mt-2 space-y-2">
            {exercises.map((item, index) => (
              <m.li
                key={item.id}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border border-sky/50 bg-surface px-3 py-2.5"
                initial={{ opacity: 0, y: 8 }}
                transition={{ ...fadeUpTransition, delay: stagger(index) }}
              >
                <p className="text-sm font-medium text-ink">{item.title}</p>
                {item.body ? (
                  <p className="mt-1 text-sm leading-relaxed text-soft">{item.body}</p>
                ) : null}
                {item.url ? (
                  <a
                    className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-brand transition-colors hover:text-ink"
                    href={item.url}
                    rel={externalRel(item.sponsored)}
                    target="_blank"
                  >
                    Abrir el recurso
                    <ExternalLink aria-hidden className="size-3.5" />
                  </a>
                ) : null}
              </m.li>
            ))}
          </ul>
        </div>
      ) : null}

      {questions.length > 0 ? (
        <div>
          <Heading icon={<HelpCircle className="size-4" />}>Preguntas frecuentes del área</Heading>
          <div className="mt-2 space-y-1.5">
            {questions.map((item) => (
              <details
                key={item.id}
                className="group rounded-xl border border-sky/50 bg-surface px-3 py-2"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-medium text-ink [&::-webkit-details-marker]:hidden">
                  {item.title}
                  <span
                    aria-hidden
                    className="shrink-0 text-brand transition-transform group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <p className="mt-2 text-sm leading-relaxed text-soft">{item.body}</p>
              </details>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

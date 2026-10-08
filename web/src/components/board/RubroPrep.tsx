import { ChevronDown, GraduationCap } from "lucide-react";
import { INTERVIEW_KINDS, usePrep } from "../../hooks/usePrep.ts";
import { PrepTips } from "../job/PrepTips.tsx";

interface RubroPrepProps {
  category: string;
  label: string;
}

/**
 * Cuando alguien filtra por un rubro, el tablero le ofrece prepararse para las
 * entrevistas de ese rubro: las preguntas frecuentes y las habilidades que
 * importan. Es el mismo contenido que sirve `/entrevista/<rubro>` para un
 * buscador, acá dentro de la app.
 */
export function RubroPrep({ category, label }: RubroPrepProps) {
  const prep = usePrep(category, category !== "", INTERVIEW_KINDS);
  if (prep.items.length === 0) return null;

  return (
    <details className="group rounded-2xl border border-sky/50 bg-surface">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 [&::-webkit-details-marker]:hidden">
        <GraduationCap aria-hidden className="size-4 shrink-0 text-brand" />
        <span className="text-sm font-medium text-ink">Prepará tu entrevista de {label}</span>
        <ChevronDown
          aria-hidden
          className="ml-auto size-4 shrink-0 text-muted transition-transform group-open:rotate-180"
        />
      </summary>
      <div className="border-t border-sky/40 px-4 py-3">
        <PrepTips items={prep.items} />
        <a
          className="mt-4 inline-block text-xs font-medium text-brand transition-colors hover:text-ink"
          href={`/entrevista/${encodeURIComponent(category)}`}
        >
          Ver la guía completa de {label}
        </a>
      </div>
    </details>
  );
}

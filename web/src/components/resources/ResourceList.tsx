import { ExternalLink } from "lucide-react";
import {
  RESOURCE_TYPES,
  RESOURCE_TYPE_LABEL,
  orderResources,
  resourceType,
} from "@jobit/worker/content/resources";
import type { ContentItem } from "@jobit/worker/content/types";
import { externalRel } from "../../lib/content.ts";

interface ResourceListProps {
  items: ContentItem[];
}

/**
 * Los recursos de un rubro, agrupados por tipo y en el orden de
 * `orderResources`: el patrocinio no mueve a nadie. Un recurso patrocinado se
 * rotula a la vista y su enlace lleva `rel="sponsored"` (ver `externalRel`).
 */
export function ResourceList({ items }: ResourceListProps) {
  const ordered = orderResources(items);

  return (
    <div className="space-y-4">
      {RESOURCE_TYPES.map((type) => {
        const group = ordered.filter((item) => resourceType(item) === type.id);
        if (group.length === 0) return null;
        return (
          <section key={type.id}>
            <h3 className="text-sm font-medium text-ink">{type.label}</h3>
            <ul className="mt-2 space-y-2">
              {group.map((item) => (
                <li
                  key={item.id}
                  className="rounded-xl border border-sky/50 bg-surface px-3 py-2.5"
                >
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    {item.url ? (
                      <a
                        className="inline-flex items-center gap-1 text-sm font-medium text-brand transition-colors hover:text-ink"
                        href={item.url}
                        rel={externalRel(item.sponsored)}
                        target="_blank"
                      >
                        {item.title}
                        <ExternalLink aria-hidden className="size-3.5" />
                      </a>
                    ) : (
                      <span className="text-sm font-medium text-ink">{item.title}</span>
                    )}
                    {item.sponsored ? (
                      <span className="rounded-full border border-sky/60 px-2 py-0.5 text-[11px] text-soft">
                        Patrocinado
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    {RESOURCE_TYPE_LABEL[type.id]} · {item.source_label}
                    {item.tags.includes("es") ? " · En español" : ""}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-soft">{item.body}</p>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

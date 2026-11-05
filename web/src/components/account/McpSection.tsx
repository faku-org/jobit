import { Check, Copy, Plug } from "lucide-react";
import { useState } from "react";
import { accountQuietClass } from "./controls.ts";

/**
 * Cómo conectar un agente (Claude, Cursor, cualquier cliente MCP) a la
 * búsqueda de JobIt. Como el servidor está hosteado, alcanza con la URL; el
 * comando local queda para quien prefiera correrlo en su máquina.
 */
const TOOLS: { name: string; description: string }[] = [
  { name: "search_jobs", description: "Buscar ofertas filtradas y paginadas." },
  { name: "get_job", description: "Una oferta completa, con su descripción." },
  { name: "market_overview", description: "El tablero resumido." },
  { name: "list_filters", description: "Rubros, departamentos y fuentes." },
];

function ConfigBlock({ hint, config }: { hint: string; config: string }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard
      .writeText(config)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {
        /* Sin portapapeles queda el texto a la vista para copiar a mano. */
      });
  };

  return (
    <div>
      <p className="mt-1 text-[11px] leading-relaxed text-onpanel/70">{hint}</p>
      <div className="relative mt-2">
        <pre className="overflow-x-auto rounded-xl border border-onpanel/15 bg-onpanel-wash px-3 py-2.5 text-[11px] leading-relaxed text-onpanel/85">
          {config}
        </pre>
        <button
          aria-label="Copiar la configuración"
          className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-lg border border-onpanel/20 bg-panel/80 px-2 py-1 text-[10px] font-medium text-onpanel/80 transition-colors hover:border-sky hover:text-onpanel"
          type="button"
          onClick={copy}
        >
          {copied ? (
            <Check aria-hidden className="size-3 text-sky" />
          ) : (
            <Copy aria-hidden className="size-3" />
          )}
          {copied ? "Copiado" : "Copiar"}
        </button>
      </div>
    </div>
  );
}

export function McpSection() {
  const hostedUrl = new URL("/mcp", window.location.origin).href;

  const hosted = JSON.stringify({ mcpServers: { jobit: { url: hostedUrl } } }, null, 2);

  const local = JSON.stringify(
    {
      mcpServers: {
        jobit: {
          command: "bun",
          args: ["run", "--cwd", "/ruta/a/jobit/mcp", "start"],
          env: { JOBIT_API_URL: window.location.origin },
        },
      },
    },
    null,
    2,
  );

  return (
    <div className="space-y-4 px-4 pt-1 pb-4">
      <div className="flex gap-2.5 rounded-xl bg-onpanel-wash px-3 py-2.5">
        <Plug aria-hidden className="mt-0.5 size-4 shrink-0 text-sky" />
        <p className="text-[11px] leading-relaxed text-onpanel/75">
          Conectá tu agente a JobIt por <strong className="font-medium text-onpanel">MCP</strong>{" "}
          para que busque ofertas, vea una ficha entera o pida el resumen del mercado sin abrir el
          buscador.
        </p>
      </div>

      <div>
        <p className="text-[11px] font-semibold tracking-wide text-onpanel-muted uppercase">
          Conectar por URL
        </p>
        <ConfigBlock
          hint="Pegá esto en la configuración de servidores MCP de tu cliente (Claude, Cursor, …) y reinicialo. No hace falta clonar nada."
          config={hosted}
        />
      </div>

      <details className="border-t border-onpanel/10 pt-3">
        <summary className="cursor-pointer text-[11px] font-semibold tracking-wide text-onpanel-muted uppercase transition-colors hover:text-onpanel">
          Correrlo en tu máquina
        </summary>
        <ConfigBlock
          hint="Para quien prefiera el servidor local por stdio. Requiere Bun y el repo clonado; ajustá la ruta. Apunta a esta misma API."
          config={local}
        />
      </details>

      <div className="border-t border-onpanel/10 pt-3">
        <p className="text-[11px] font-semibold tracking-wide text-onpanel-muted uppercase">
          Qué puede hacer
        </p>
        <dl className="mt-2 divide-y divide-onpanel/10 overflow-hidden rounded-xl border border-onpanel/10">
          {TOOLS.map((tool) => (
            <div key={tool.name} className="flex items-baseline justify-between gap-3 px-3 py-2">
              <dt className="shrink-0 font-mono text-[11px] font-medium text-sky">{tool.name}</dt>
              <dd className="min-w-0 text-right text-[11px] text-onpanel/70">{tool.description}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 text-[11px] leading-relaxed text-onpanel-faint">
          Son de solo lectura: el agente no escribe nada ni toca lo guardado en este navegador.
        </p>
      </div>

      <a
        className={`${accountQuietClass} w-full`}
        href="https://github.com/faku-org/jobit/tree/develop/mcp"
        rel="noopener noreferrer"
        target="_blank"
      >
        Ver el servidor MCP en GitHub
      </a>
    </div>
  );
}

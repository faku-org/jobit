import { Trash2 } from "lucide-react";
import { useState } from "react";
import { Confirm } from "./Confirm.tsx";

interface DangerZoneProps {
  /** What is about to be lost, listed so the confirmation is informed. */
  counts: { saved: number; applications: number; dismissed: number };
  onEraseEverything: () => void;
}

/**
 * The only thing here is the erase: resetting the preferences moved up to the
 * restart button, which does the same and then walks the person back through
 * the questions instead of leaving them on an unordered board.
 */
export function DangerZone({ counts, onEraseEverything }: DangerZoneProps) {
  const [pending, setPending] = useState(false);

  const plural = (count: number, one: string, many: string) =>
    `${count} ${count === 1 ? one : many}`;

  return (
    <div className="space-y-3 border-t border-onpanel/10 pt-3">
      <p className="text-[11px] font-semibold tracking-wide text-onpanel/50 uppercase">
        Borrar datos
      </p>

      <div>
        <button
          aria-expanded={pending}
          className="inline-flex w-full items-center gap-2 rounded-lg bg-onpanel/10 px-2.5 py-2 text-left text-[11px] font-medium text-onpanel/80 transition-colors hover:bg-onpanel/20 hover:text-onpanel"
          type="button"
          onClick={() => setPending((current) => !current)}
        >
          <Trash2 aria-hidden className="size-3.5 shrink-0" />
          Borrar todos mis datos de este navegador
        </button>

        <Confirm
          action="Sí, borrar todo"
          losing={
            <>
              Se borra todo lo que JobIt guarda acá: tu perfil y tus estudios,{" "}
              {plural(counts.saved, "oferta guardada", "ofertas guardadas")},{" "}
              {plural(counts.applications, "postulación seguida", "postulaciones seguidas")},{" "}
              {plural(counts.dismissed, "oferta descartada", "ofertas descartadas")} y todas tus
              preferencias.
              <br />
              <strong className="font-medium text-onpanel/90">
                No hay copia en ningún servidor: esto no se puede deshacer.
              </strong>{" "}
              Vas a arrancar de cero con el onboarding.
            </>
          }
          open={pending}
          title="¿Borrar todo y empezar de cero?"
          tone="danger"
          onCancel={() => setPending(false)}
          onConfirm={() => {
            onEraseEverything();
            setPending(false);
          }}
        />
      </div>
    </div>
  );
}

import { AtSign, Image as ImageIcon, Lock, Mail, Share2, ShieldCheck, Users } from "lucide-react";
import { useState } from "react";
import type { Company } from "../api.ts";
import { CompanyEmails } from "../CompanyEmails.tsx";
import { Members } from "../Members.tsx";
import { AreaIdentity } from "./Identity.tsx";
import { AreaImage } from "./Image.tsx";
import { AreaPrivacy } from "./Privacy.tsx";
import { AreaSecurity } from "./Security.tsx";
import { AreaSocials } from "./Socials.tsx";

interface AreaProps {
  company: Company;
  onUpdated: (company: Company) => void;
  onFail: (cause: unknown) => void;
}

const AREAS = [
  { id: "imagen", label: "Imagen", icon: ImageIcon },
  { id: "identidad", label: "Identidad", icon: AtSign },
  { id: "redes", label: "Redes", icon: Share2 },
  { id: "correos", label: "Correos", icon: Mail },
  { id: "privacidad", label: "Privacidad", icon: ShieldCheck },
  { id: "miembros", label: "Miembros", icon: Users },
  { id: "seguridad", label: "Seguridad", icon: Lock },
] as const;

type AreaId = (typeof AREAS)[number]["id"];

/**
 * El panel de la empresa, en áreas separadas. Se muestra una por vez para que
 * nada sea un scroll largo, y cada una guarda lo suyo: se puede cerrar una sin
 * tocar las demás. Las áreas no se mezclan nunca.
 */
export function Settings({ company, onUpdated, onFail }: AreaProps) {
  const [area, setArea] = useState<AreaId>("imagen");
  const props = { company, onUpdated, onFail };

  return (
    <div>
      <nav aria-label="Áreas de la empresa" className="flex gap-1 overflow-x-auto pb-1">
        {AREAS.map((item) => {
          const Icon = item.icon;
          const active = area === item.id;
          return (
            <button
              key={item.id}
              aria-current={active ? "true" : undefined}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition-colors ${
                active ? "bg-panel text-onpanel" : "border border-sky/70 text-ink hover:bg-mist"
              }`}
              type="button"
              onClick={() => setArea(item.id)}
            >
              <Icon aria-hidden className="size-3.5" />
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* La `key` remonta el área al cambiar: cada una arranca del estado actual
          de la empresa y no de lo que quedó a medio editar en otra. */}
      <div className="mt-3" key={area}>
        {area === "imagen" ? <AreaImage {...props} /> : null}
        {area === "identidad" ? <AreaIdentity {...props} /> : null}
        {area === "redes" ? <AreaSocials {...props} /> : null}
        {area === "correos" ? <CompanyEmails {...props} /> : null}
        {area === "privacidad" ? <AreaPrivacy {...props} /> : null}
        {area === "miembros" ? <Members {...props} /> : null}
        {area === "seguridad" ? <AreaSecurity {...props} /> : null}
      </div>
    </div>
  );
}

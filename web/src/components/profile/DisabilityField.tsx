import { ShieldCheck } from 'lucide-react'
import { useId } from 'react'
import type { ResumeDisability } from '../../lib/resume.ts'
import { panelInputClass } from './PanelControls.tsx'

interface DisabilityFieldProps {
  value: ResumeDisability
  onChange: (disability: ResumeDisability) => void
}

/**
 * Opcional y apagado por defecto: nadie tiene que decir esto para usar la app.
 * Es un dato de salud, así que el texto dice dónde queda y dónde no antes de
 * pedirlo. Hoy sólo se guarda y se puede incluir en el archivo exportado; no
 * cambia el orden de las ofertas.
 */
export function DisabilityField({ value, onChange }: DisabilityFieldProps) {
  const id = useId()

  return (
    <div className="space-y-3">
      <div className="flex gap-2.5 rounded-xl bg-onpanel-wash px-3 py-2.5">
        <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-sky" />
        <p className="text-[0.6875rem] leading-relaxed text-onpanel/75">
          Es un dato sensible y es opcional. Queda{' '}
          <strong>sólo en este navegador</strong>: no se sincroniza, no se
          cuenta en las estadísticas y no se manda a ninguna empresa. Lo podés
          sacar cuando quieras.
        </p>
      </div>

      <label className="flex min-h-11 cursor-pointer items-start gap-2.5 sm:min-h-0">
        <input
          checked={value.declared}
          className="mt-0.5 size-4 shrink-0 accent-sky"
          type="checkbox"
          onChange={(event) =>
            onChange({ declared: event.target.checked, note: value.note })
          }
        />
        <span className="text-xs leading-relaxed text-onpanel/85">
          Tengo una discapacidad y quiero dejarlo anotado en mi perfil
        </span>
      </label>

      {value.declared ? (
        <div>
          <label
            className="text-[0.6875rem] font-semibold tracking-wide text-onpanel-muted uppercase"
            htmlFor={`${id}-note`}
          >
            Aclaración (opcional)
          </label>
          <textarea
            className={`${panelInputClass} mt-2 resize-y`}
            id={`${id}-note`}
            maxLength={200}
            placeholder="Por ejemplo, qué adaptación del puesto necesitás"
            rows={3}
            value={value.note}
            onChange={(event) =>
              onChange({ declared: true, note: event.target.value })
            }
          />
        </div>
      ) : null}
    </div>
  )
}

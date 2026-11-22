import { Plus, TriangleAlert, X } from 'lucide-react'
import { type FormEvent, useId, useState } from 'react'
import { MAX_REFERENCES, type ResumeReference } from '../../lib/resume.ts'
import {
  PanelField,
  panelButtonClass,
  panelInputClass,
  panelRemoveClass,
} from './PanelControls.tsx'

interface ReferencesFieldProps {
  value: ResumeReference[]
  onChange: (references: ResumeReference[]) => void
}

const EMPTY: ResumeReference = { name: '', relation: '', contact: '' }

/**
 * Referencias laborales. Son datos de otra persona, por eso el aviso va arriba
 * del formulario y no en letra chica: avisarle y pedirle permiso antes de
 * cargarla es lo que hace que sea una referencia y no un dato suelto.
 */
export function ReferencesField({ value, onChange }: ReferencesFieldProps) {
  const id = useId()
  const [draft, setDraft] = useState<ResumeReference>(EMPTY)
  const [error, setError] = useState('')
  const full = value.length >= MAX_REFERENCES

  const set = (key: keyof ResumeReference, text: string) => {
    setDraft((current) => ({ ...current, [key]: text }))
    setError('')
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const name = draft.name.trim()
    if (name === '') {
      setError('Poné al menos el nombre de la persona.')
      return
    }
    onChange([
      ...value,
      {
        name,
        relation: draft.relation.trim(),
        contact: draft.contact.trim(),
      },
    ])
    setDraft(EMPTY)
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2.5 rounded-xl bg-onpanel-wash px-3 py-2.5">
        <TriangleAlert
          aria-hidden
          className="mt-0.5 size-4 shrink-0 text-sky"
        />
        <p className="text-[11px] leading-relaxed text-onpanel/75">
          Son datos de otra persona. <strong>Pedile permiso antes</strong> de
          cargar su nombre y su contacto, y contale para qué. Se guardan sólo en
          este navegador y salen únicamente si descargás tu archivo.
        </p>
      </div>

      {value.length > 0 ? (
        <ul className="space-y-1.5">
          {value.map((entry, index) => (
            <li
              key={`${entry.name}-${index}`}
              className="flex items-center gap-2 rounded-xl bg-onpanel-wash px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-onpanel">
                  {entry.name}
                </p>
                <p className="truncate text-[11px] text-onpanel-muted">
                  {[entry.relation, entry.contact]
                    .filter((part) => part !== '')
                    .join(' · ') || 'Sin más datos'}
                </p>
              </div>
              <button
                aria-label={`Quitar a ${entry.name}`}
                className={panelRemoveClass}
                type="button"
                onClick={() =>
                  onChange(value.filter((_, position) => position !== index))
                }
              >
                <X aria-hidden className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {full ? (
        <p className="text-[11px] text-onpanel-faint">
          Ya cargaste {MAX_REFERENCES} referencias, que es el máximo.
        </p>
      ) : (
        <form className="space-y-3" onSubmit={submit}>
          <PanelField htmlFor={`${id}-name`} label="Nombre">
            <input
              aria-describedby={error ? `${id}-error` : undefined}
              aria-invalid={error !== ''}
              autoComplete="off"
              className={panelInputClass}
              id={`${id}-name`}
              maxLength={80}
              type="text"
              value={draft.name}
              onChange={(event) => set('name', event.target.value)}
            />
          </PanelField>
          <PanelField htmlFor={`${id}-relation`} label="Relación">
            <input
              autoComplete="off"
              className={panelInputClass}
              id={`${id}-relation`}
              maxLength={80}
              placeholder="Jefa directa en Panadería Sur"
              type="text"
              value={draft.relation}
              onChange={(event) => set('relation', event.target.value)}
            />
          </PanelField>
          <PanelField htmlFor={`${id}-contact`} label="Contacto">
            <input
              autoComplete="off"
              className={panelInputClass}
              id={`${id}-contact`}
              maxLength={120}
              placeholder="Celular o mail"
              type="text"
              value={draft.contact}
              onChange={(event) => set('contact', event.target.value)}
            />
          </PanelField>
          {error ? (
            <p
              className="text-[11px] text-onpanel"
              id={`${id}-error`}
              role="alert"
            >
              {error}
            </p>
          ) : null}
          <button className={panelButtonClass} type="submit">
            <Plus aria-hidden className="size-3.5" />
            Agregar referencia
          </button>
        </form>
      )}
    </div>
  )
}

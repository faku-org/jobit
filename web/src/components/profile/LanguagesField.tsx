import { Plus, X } from 'lucide-react'
import { type FormEvent, useId, useState } from 'react'
import {
  LANGUAGE_LEVELS,
  LANGUAGE_LEVEL_LABEL,
  LANGUAGE_SUGGESTIONS,
  MAX_LANGUAGES,
  type ResumeLanguage,
} from '../../lib/resume.ts'
import {
  PanelChip,
  panelButtonClass,
  panelInputClass,
  panelRemoveClass,
} from './PanelControls.tsx'

interface LanguagesFieldProps {
  value: ResumeLanguage[]
  onChange: (languages: ResumeLanguage[]) => void
}

/**
 * Idiomas con nivel. Los comunes se agregan de un toque (en intermedio, que se
 * corrige en la fila) y cualquier otro se escribe: la lista es corta y no hay
 * un catálogo que valga la pena mantener.
 */
export function LanguagesField({ value, onChange }: LanguagesFieldProps) {
  const id = useId()
  const [draft, setDraft] = useState('')
  const full = value.length >= MAX_LANGUAGES

  const has = (name: string) =>
    value.some((entry) => entry.name.toLowerCase() === name.toLowerCase())

  const add = (name: string) => {
    const clean = name.trim().slice(0, 40)
    if (clean === '' || has(clean) || full) return
    onChange([...value, { name: clean, level: 'intermediate' }])
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    add(draft)
    setDraft('')
  }

  const setLevel = (name: string, level: ResumeLanguage['level']) =>
    onChange(
      value.map((entry) => (entry.name === name ? { ...entry, level } : entry)),
    )

  const suggestions = LANGUAGE_SUGGESTIONS.filter((name) => !has(name))

  return (
    <div className="space-y-3">
      {value.length > 0 ? (
        <ul className="space-y-3">
          {value.map((entry) => (
            <li key={entry.name} className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-onpanel">
                  {entry.name}
                </span>
                <button
                  aria-label={`Quitar ${entry.name}`}
                  className={panelRemoveClass}
                  type="button"
                  onClick={() =>
                    onChange(value.filter((item) => item.name !== entry.name))
                  }
                >
                  <X aria-hidden className="size-4" />
                </button>
              </div>
              <div
                aria-label={`Nivel de ${entry.name}`}
                className="flex flex-wrap gap-1.5"
                role="group"
              >
                {LANGUAGE_LEVELS.map((level) => (
                  <PanelChip
                    key={level}
                    active={entry.level === level}
                    onClick={() => setLevel(entry.name, level)}
                  >
                    {LANGUAGE_LEVEL_LABEL[level]}
                  </PanelChip>
                ))}
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {!full && suggestions.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {suggestions.map((name) => (
            <button
              key={name}
              className={panelButtonClass}
              type="button"
              onClick={() => add(name)}
            >
              <Plus aria-hidden className="size-3.5" />
              {name}
            </button>
          ))}
        </div>
      ) : null}

      {full ? (
        <p className="text-[11px] text-onpanel-faint">
          Ya cargaste {MAX_LANGUAGES} idiomas, que es el máximo.
        </p>
      ) : (
        <form className="flex gap-1.5" onSubmit={submit}>
          <input
            aria-label="Otro idioma"
            className={panelInputClass}
            id={`${id}-other`}
            maxLength={40}
            placeholder="Otro idioma"
            type="text"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
          <button className={panelButtonClass} type="submit">
            <Plus aria-hidden className="size-3.5" />
            Agregar
          </button>
        </form>
      )}
    </div>
  )
}

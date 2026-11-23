import { ExternalLink, Plus, X } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import {
  LINK_KINDS,
  LINK_KIND_LABEL,
  MAX_LINKS,
  type ResumeLink,
  linkKindOf,
  normalizeUrl,
} from '../../lib/resume.ts'
import {
  PanelChip,
  panelButtonClass,
  panelInputClass,
  panelRemoveClass,
} from './PanelControls.tsx'

interface LinksFieldProps {
  value: ResumeLink[]
  onChange: (links: ResumeLink[]) => void
}

/**
 * LinkedIn, GitHub, portfolio y otras webs. El tipo se adivina por el dominio
 * al pegar el link y se puede corregir antes de agregar.
 */
export function LinksField({ value, onChange }: LinksFieldProps) {
  const [url, setUrl] = useState('')
  const [kind, setKind] = useState<ResumeLink['kind'] | ''>('')
  const [error, setError] = useState('')
  const full = value.length >= MAX_LINKS

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const clean = normalizeUrl(url)
    if (clean === '') {
      setError(
        'Ese link no parece una dirección web. Ejemplo: github.com/tu-usuario',
      )
      return
    }
    if (value.some((entry) => entry.url === clean)) {
      setError('Ese link ya está cargado.')
      return
    }
    onChange([...value, { kind: kind || linkKindOf(clean), url: clean }])
    setUrl('')
    setKind('')
    setError('')
  }

  return (
    <div className="space-y-3">
      {value.length > 0 ? (
        <ul className="space-y-1.5">
          {value.map((entry) => (
            <li
              key={entry.url}
              className="flex items-center gap-2 rounded-xl bg-onpanel-wash px-3 py-1"
            >
              <div className="min-w-0 flex-1">
                <p className="text-[0.625rem] font-semibold tracking-wide text-onpanel-muted uppercase">
                  {LINK_KIND_LABEL[entry.kind]}
                </p>
                <a
                  className="flex min-h-8 items-center gap-1 truncate text-xs text-onpanel underline underline-offset-2"
                  href={entry.url}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  <span className="truncate">
                    {entry.url.replace(/^https?:\/\//, '')}
                  </span>
                  <ExternalLink aria-hidden className="size-3 shrink-0" />
                </a>
              </div>
              <button
                aria-label={`Quitar ${entry.url}`}
                className={panelRemoveClass}
                type="button"
                onClick={() =>
                  onChange(value.filter((item) => item.url !== entry.url))
                }
              >
                <X aria-hidden className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {full ? (
        <p className="text-[0.6875rem] text-onpanel-faint">
          Ya cargaste {MAX_LINKS} links, que es el máximo.
        </p>
      ) : (
        <form className="space-y-2" onSubmit={submit}>
          <div className="flex gap-1.5">
            <input
              aria-describedby={error ? 'link-error' : undefined}
              aria-invalid={error !== ''}
              aria-label="Link"
              autoComplete="off"
              className={panelInputClass}
              inputMode="url"
              maxLength={200}
              placeholder="linkedin.com/in/tu-usuario"
              type="text"
              value={url}
              onChange={(event) => {
                setUrl(event.target.value)
                setError('')
              }}
            />
            <button className={panelButtonClass} type="submit">
              <Plus aria-hidden className="size-3.5" />
              Agregar
            </button>
          </div>
          <div
            aria-label="Tipo de link"
            className="flex flex-wrap gap-1.5"
            role="group"
          >
            {LINK_KINDS.map((option) => {
              const guessed = kind === '' ? linkKindOf(normalizeUrl(url)) : kind
              return (
                <PanelChip
                  key={option}
                  active={url.trim() !== '' && guessed === option}
                  onClick={() => setKind(option)}
                >
                  {LINK_KIND_LABEL[option]}
                </PanelChip>
              )
            })}
          </div>
          {error ? (
            <p
              className="text-[0.6875rem] text-onpanel"
              id="link-error"
              role="alert"
            >
              {error}
            </p>
          ) : null}
        </form>
      )}
    </div>
  )
}

import { Lock } from 'lucide-react'
import { useState } from 'react'
import type { FollowUp } from '../../hooks/useFollowUp.ts'
import { interviewsFor, notesFor } from '../../lib/followup.ts'
import {
  buildInterviewIcs,
  downloadIcs,
  interviewIcsName,
} from '../../lib/ics.ts'
import type { Application } from '../../lib/types.ts'
import { InterviewsArea } from './InterviewsArea.tsx'
import { NotesArea } from './NotesArea.tsx'

type Area = 'notes' | 'interviews'

interface FollowUpPanelProps {
  application: Application
  followUp: FollowUp
  /** El id del contenedor, para que quien lo abre apunte con `aria-controls`. */
  id: string
}

/**
 * Lo que sirve para preparar y no olvidar una entrevista: notas y entrevistas
 * de una postulación. Son dos áreas, una por vez, cada una con su propio
 * guardado. Todo queda en este navegador.
 */
export function FollowUpPanel({
  application,
  followUp,
  id,
}: FollowUpPanelProps) {
  const [area, setArea] = useState<Area>('notes')
  const notes = notesFor(followUp.state, application.id)
  const interviews = interviewsFor(followUp.state, application.id)

  const areas: { key: Area; label: string; count: number }[] = [
    { key: 'notes', label: 'Notas', count: notes.length },
    { key: 'interviews', label: 'Entrevistas', count: interviews.length },
  ]

  return (
    <div className="mt-3 space-y-3 border-t border-line pt-3" id={id}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1">
          {areas.map((option) => (
            <button
              key={option.key}
              aria-pressed={area === option.key}
              className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                area === option.key
                  ? 'bg-panel text-onpanel'
                  : 'bg-mist text-muted hover:bg-sky/40 hover:text-ink'
              }`}
              type="button"
              onClick={() => setArea(option.key)}
            >
              {option.label}
              <span className="ml-1.5 tabular-nums">{option.count}</span>
            </button>
          ))}
        </div>
        <p className="flex items-center gap-1.5 text-[11px] text-muted">
          <Lock aria-hidden className="size-3" />
          Solo en este navegador: no se envía ni se sincroniza.
        </p>
      </div>

      {area === 'notes' ? (
        <NotesArea
          notes={notes}
          onAdd={(text) => followUp.addNote(application.id, text)}
          onEdit={followUp.editNote}
          onRemove={followUp.removeNote}
        />
      ) : (
        <InterviewsArea
          applicationId={application.id}
          interviews={interviews}
          onCalendar={(interview) =>
            downloadIcs(
              buildInterviewIcs({
                interview,
                title: application.title,
                company: application.company,
              }),
              interviewIcsName(application.title, application.company),
            )
          }
          onRemove={followUp.removeInterview}
          onSave={followUp.saveInterview}
        />
      )}
    </div>
  )
}

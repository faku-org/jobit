import { useCallback, useEffect, useState } from 'react'
import {
  addNote,
  editNote,
  EMPTY_FOLLOWUP,
  FOLLOWUP_KEY,
  type FollowUpState,
  type InterviewDraft,
  readFollowUp,
  removeForApplication,
  removeInterview,
  removeNote,
  saveInterview,
} from '../lib/followup.ts'

function read(): FollowUpState {
  try {
    const raw = localStorage.getItem(FOLLOWUP_KEY)
    if (!raw) return EMPTY_FOLLOWUP
    return readFollowUp(JSON.parse(raw))
  } catch {
    return EMPTY_FOLLOWUP
  }
}

export interface FollowUp {
  state: FollowUpState
  addNote: (applicationId: string, text: string) => void
  editNote: (id: string, text: string) => void
  removeNote: (id: string) => void
  /** Crea la entrevista (sin `id`) o edita la que lo tenga. */
  saveInterview: (draft: Omit<InterviewDraft, 'id'> & { id?: string }) => void
  removeInterview: (id: string) => void
  /** Se va con la postulación que la tenía. */
  removeForApplication: (applicationId: string) => void
  /** Borra todo lo de este navegador, junto con el resto de los datos. */
  erase: () => void
}

/**
 * Notas y entrevistas, en el navegador y nada más. No pasa por `useJobPrefs`
 * a propósito: esa clave es la que viaja por el sync de la cuenta, y esto no
 * viaja a ningún lado.
 */
export function useFollowUp(): FollowUp {
  const [state, setState] = useState<FollowUpState>(read)

  useEffect(() => {
    if (state === EMPTY_FOLLOWUP) return
    try {
      localStorage.setItem(FOLLOWUP_KEY, JSON.stringify(state))
    } catch {
      /** Un navegador que no deja guardar tampoco deja leer: se sigue en memoria. */
    }
  }, [state])

  return {
    state,
    addNote: useCallback((applicationId, body) => {
      /** El id y la hora se resuelven afuera: el updater puede correr dos veces. */
      const id = crypto.randomUUID()
      const now = new Date().toISOString()
      setState((current) =>
        addNote(current, { id, applicationId, text: body, now }),
      )
    }, []),
    editNote: useCallback((id, body) => {
      const now = new Date().toISOString()
      setState((current) => editNote(current, id, body, now))
    }, []),
    removeNote: useCallback((id) => {
      setState((current) => removeNote(current, id))
    }, []),
    saveInterview: useCallback((draft) => {
      const id = draft.id ?? crypto.randomUUID()
      setState((current) => saveInterview(current, { ...draft, id }))
    }, []),
    removeInterview: useCallback((id) => {
      setState((current) => removeInterview(current, id))
    }, []),
    removeForApplication: useCallback((applicationId) => {
      setState((current) => removeForApplication(current, applicationId))
    }, []),
    erase: useCallback(() => {
      try {
        localStorage.removeItem(FOLLOWUP_KEY)
      } catch {
        /** Nada que borrar si no se puede guardar. */
      }
      /** No EMPTY_FOLLOWUP: ese objeto es el que el efecto no escribe. */
      setState({ notes: [], interviews: [] })
    }, []),
  }
}

interface ConfirmDeleteProps {
  question: string
  onCancel: () => void
  onConfirm: () => void
}

/** Confirmación en la misma fila: lo que se borra acá no tiene copia en ningún
 * servidor, así que se pregunta antes y no se esconde un "deshacer". */
export function ConfirmDelete({
  question,
  onCancel,
  onConfirm,
}: ConfirmDeleteProps) {
  return (
    <div
      className="mt-2 flex flex-wrap items-center gap-2 rounded-xl border border-red-600/40 bg-red-600/8 px-3 py-2"
      role="alert"
    >
      <p className="text-xs text-ink">{question}</p>
      <div className="flex gap-1.5">
        <button
          className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-red-600 transition-colors hover:bg-red-600/12"
          type="button"
          onClick={onConfirm}
        >
          Sí, borrar
        </button>
        <button
          className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted transition-colors hover:bg-sky/25 hover:text-ink"
          type="button"
          onClick={onCancel}
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}

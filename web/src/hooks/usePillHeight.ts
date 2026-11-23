import { type RefObject, useEffect, useRef, useState } from 'react'

/**
 * El alto real de un pill que flota sobre el borde de abajo de una página de la
 * ficha. Crece con la pregunta o con el aviso, así que el cuerpo reserva lo que
 * mide (`--apply-pill`) y el final del contenido siempre se puede leer.
 */
export function usePillHeight(): [RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState(0)

  useEffect(() => {
    const pill = ref.current
    if (!pill) return
    const observer = new ResizeObserver(([entry]) => {
      if (entry)
        setHeight(
          Math.ceil(entry.borderBoxSize[0]?.blockSize ?? pill.offsetHeight),
        )
    })
    observer.observe(pill)
    return () => observer.disconnect()
  }, [])

  return [ref, height]
}

import { useMotionValueEvent, useReducedMotion, useSpring } from 'motion/react'
import { useEffect, useId, useMemo, useState } from 'react'
import { radarGeometry, toPoints } from '../../lib/radar.ts'
import { TRAITS, type TraitScore, levelPhrase } from '../../lib/selfTest.ts'

const SIZE = { width: 400, height: 310 }
const CENTER = { x: SIZE.width / 2, y: 158 }

/**
 * Los cinco rasgos en un polígono. SVG propio, con los colores del tema: se
 * ve igual de bien en claro y en oscuro porque no hay un solo color suelto.
 *
 * El dibujo es decorativo para el lector de pantalla (`aria-hidden`): lo que
 * lee es la tabla de abajo, con el mismo contenido. La entrada es un resorte
 * que corre una sola vez; con "reducir movimiento" el polígono aparece ya
 * completo.
 */
export function Radar({ scores }: { scores: TraitScore[] }) {
  const captionId = useId()
  const reduced = useReducedMotion()
  const geometry = useMemo(
    () => radarGeometry(scores, { center: CENTER, radius: 104, labelGap: 18 }),
    [scores],
  )

  const spring = useSpring(reduced ? 1 : 0, {
    stiffness: 120,
    damping: 15,
    mass: 0.9,
  })
  const [progress, setProgress] = useState(reduced ? 1 : 0)
  useMotionValueEvent(spring, 'change', setProgress)

  useEffect(() => {
    if (reduced) spring.jump(1)
    else spring.set(1)
  }, [reduced, spring])

  /* El resorte se pasa un poco de 1 (rebota): el polígono respira, pero los
     puntos nunca salen del anillo exterior de manera visible. */
  const shown = Math.max(0, progress)
  const dots = geometry.dots(shown)

  return (
    <figure className="m-0">
      <svg
        aria-hidden
        className="mx-auto block h-auto w-full max-w-md overflow-visible"
        viewBox={`0 0 ${SIZE.width} ${SIZE.height}`}
      >
        {geometry.rings.map((ring) => (
          <polygon
            key={ring.level}
            fill="none"
            points={ring.points}
            stroke="var(--color-sky)"
            strokeOpacity={ring.level === 50 ? 0.9 : 0.5}
            strokeWidth={ring.level === 50 ? 1.25 : 1}
          />
        ))}
        {geometry.axes.map((axis) => (
          <line
            key={axis.key}
            stroke="var(--color-sky)"
            strokeOpacity={0.5}
            x1={CENTER.x}
            x2={axis.end.x}
            y1={CENTER.y}
            y2={axis.end.y}
          />
        ))}

        <polygon
          fill="var(--color-brand)"
          fillOpacity={0.22}
          points={toPoints(dots)}
          stroke="var(--color-brand)"
          strokeLinejoin="round"
          strokeWidth={2.25}
        />
        {dots.map((dot, index) => (
          <circle
            key={geometry.axes[index]?.key}
            cx={dot.x}
            cy={dot.y}
            fill="var(--color-brand)"
            r={4}
            stroke="var(--color-surface)"
            strokeWidth={1.5}
          />
        ))}

        {geometry.axes.map((axis) => (
          <text
            key={axis.key}
            dominantBaseline="middle"
            fill="var(--color-ink)"
            fontSize={12}
            fontWeight={600}
            textAnchor={axis.anchor}
            x={axis.labelAt.x}
            y={axis.labelAt.y + Math.sin(axis.angle) * 4}
          >
            {axis.label}
          </text>
        ))}
      </svg>

      <figcaption className="sr-only" id={captionId}>
        Tus cinco rasgos de 0 a 100 en un gráfico de radar. El mismo contenido,
        en tabla.
      </figcaption>
      {/* El recorte de sr-only no alcanza a una tabla: va en un div. */}
      <div className="sr-only">
        <table aria-labelledby={captionId}>
          <thead>
            <tr>
              <th scope="col">Rasgo</th>
              <th scope="col">Puntaje de 0 a 100</th>
              <th scope="col">Lectura</th>
            </tr>
          </thead>
          <tbody>
            {scores.map((score) => (
              <tr key={score.key}>
                <th scope="row">
                  {TRAITS.find((trait) => trait.key === score.key)?.label ??
                    score.key}
                </th>
                <td>{score.percent}</td>
                <td>{levelPhrase(score)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  )
}

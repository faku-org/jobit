import { Star } from "lucide-react";

interface RatingProps {
  average: number;
  count: number;
  /** En la ficha el número manda; en la tarjeta alcanza con las estrellas. */
  size?: "sm" | "md";
}

const STARS = 5;

const formatter = new Intl.NumberFormat("es-UY", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/**
 * La calificación como la ve quien busca: las estrellas llenas hasta el
 * promedio y cuántas opiniones hay detrás. Un servicio sin calificar lo dice
 * en palabras en vez de mostrar cinco estrellas vacías, que se leen como un
 * cero que nadie puso.
 */
export function Rating({ average, count, size = "sm" }: RatingProps) {
  const icon = size === "md" ? "size-4" : "size-3.5";

  if (count === 0) {
    return <span className="text-xs text-muted">Todavía sin calificaciones</span>;
  }

  return (
    <span
      aria-label={`${formatter.format(average)} de ${STARS}, ${count} ${count === 1 ? "opinión" : "opiniones"}`}
      className="inline-flex items-center gap-1"
    >
      <span aria-hidden className="inline-flex">
        {Array.from({ length: STARS }, (_, index) => (
          <Star
            key={index}
            className={`${icon} ${index < Math.round(average) ? "fill-current text-brand" : "text-sky"}`}
          />
        ))}
      </span>
      <span className={`${size === "md" ? "text-sm" : "text-xs"} text-soft tabular-nums`}>
        {formatter.format(average)}
        <span className="text-muted"> ({count})</span>
      </span>
    </span>
  );
}

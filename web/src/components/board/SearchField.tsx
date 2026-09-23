import { Search, X } from "lucide-react";
import { useEffect, useEffectEvent, useState } from "react";
import { fieldClass } from "../../lib/styles.ts";

interface SearchFieldProps {
  /** La búsqueda que está corriendo, ya sin el retardo. */
  value: string;
  onChange: (value: string) => void;
  delayMs?: number;
}

/**
 * El buscador: la letra se escribe acá adentro y sale recién cuando la persona
 * frena.
 *
 * Lo que se está tecleando es estado de este campo y de nadie más. Cuando vivía
 * arriba, cada tecla volvía a renderizar el tablero entero para cambiar un
 * `value` que mira solo este input: medido sobre cien tarjetas eran 23 ms por
 * tecla, contra 0,7 ms con la lista vacía. El retardo ya existía, pero solo
 * frenaba el pedido a la API, no el renderizado.
 *
 * Hacia afuera se comporta igual que antes: el valor que baja manda cuando
 * cambia por algo que no fue tipear (un enlace compartido, el botón de limpiar
 * los filtros, tocar un puesto en Mercado).
 */
export function SearchField({ value, onChange, delayMs = 300 }: SearchFieldProps) {
  const [text, setText] = useState(value);
  /**
   * `sent` es lo último que este campo mandó hacia arriba y `seen` lo último
   * que vio bajar. Con los dos alcanza para distinguir "volvió lo que mandé
   * yo", que no toca nada, de "lo cambió otra cosa", que es lo único que puede
   * pisar lo que se está escribiendo.
   */
  const [sent, setSent] = useState(value);
  const [seen, setSeen] = useState(value);

  if (value !== seen) {
    setSeen(value);
    if (value !== sent) {
      setSent(value);
      setText(value);
    }
  }

  /** El callback cambia de identidad cada vez que repinta el tablero, y no
   * puede reiniciar el reloj: si lo hiciera, escribir mientras algo de arriba
   * se actualiza no publicaría nunca. */
  const publish = useEffectEvent((next: string) => {
    setSent(next);
    onChange(next);
  });

  useEffect(() => {
    if (text === sent) return;

    const timer = setTimeout(() => publish(text), delayMs);
    return () => clearTimeout(timer);
  }, [text, sent, delayMs]);

  /** Limpiar no es escribir: sale en el momento, sin esperar el retardo. */
  const clear = (): void => {
    setText("");
    setSent("");
    onChange("");
  };

  return (
    <div className="relative">
      <Search
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-brand"
      />
      <input
        aria-label="Buscar ofertas"
        className={`${fieldClass} py-2.5 pr-10 pl-10 placeholder:text-faint`}
        placeholder="Buscar por puesto, empresa, ciudad o palabra de la descripción"
        type="text"
        value={text}
        onChange={(event) => setText(event.target.value)}
      />
      {text ? (
        <button
          aria-label="Limpiar búsqueda"
          className="absolute top-1/2 right-3 -translate-y-1/2 rounded-md p-0.5 text-faint transition-colors hover:text-ink"
          type="button"
          onClick={clear}
        >
          <X aria-hidden className="size-4" />
        </button>
      ) : null}
    </div>
  );
}

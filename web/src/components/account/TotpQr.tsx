import { createPortal } from "react-dom";
import { encode } from "uqr";

interface TotpQrProps {
  /** El `otpauth://` que devuelve la API. Lleva el secreto adentro, así que se
   * dibuja acá: un generador de QR por internet lo vería. */
  value: string;
  expanded: boolean;
  onExpand: () => void;
  onCollapse: () => void;
}

/** El azul de la marca, que contra el blanco tiene contraste de sobra para que
 * lo lea cualquier app de autenticación. */
const DARK = "#0d47a1";

/**
 * El código QR del segundo paso, armado en el navegador. Al tocarlo se amplía
 * sobre un velo claro, para poder escanearlo desde otro teléfono.
 *
 * Quién está ampliado lo decide el modal de cuenta, que también es el único
 * dueño del Escape: si no, el mismo atajo cerraba las dos cosas.
 *
 * Los módulos oscuros salen en una sola ruta SVG: son cientos de cuadraditos y
 * un nodo por cada uno pesa más de lo que resuelve.
 */
export function TotpQr({ value, expanded, onExpand, onCollapse }: TotpQrProps) {
  const qr = encode(value, { ecc: "M", border: 2 });
  const path = qr.data
    .map((row, y) => row.map((on, x) => (on ? `M${x} ${y}h1v1h-1z` : "")).join(""))
    .join("");

  const code = (className: string) => (
    <svg
      aria-label="Código QR para la app de autenticación"
      className={className}
      role="img"
      shapeRendering="crispEdges"
      viewBox={`0 0 ${qr.size} ${qr.size}`}
    >
      <rect fill="#ffffff" height={qr.size} width={qr.size} />
      <path d={path} fill={DARK} />
    </svg>
  );

  return (
    <>
      <button
        aria-label="Ampliar el código QR"
        className="mx-auto block w-fit rounded-xl bg-white p-2.5 transition-transform hover:scale-[1.02] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        type="button"
        onClick={onExpand}
      >
        {code("block size-44")}
      </button>

      {expanded
        ? createPortal(
            <div
              aria-label="Código QR ampliado"
              aria-modal
              className="fixed inset-0 z-80 flex items-center justify-center bg-white/70 p-6 backdrop-blur-sm"
              role="dialog"
              onClick={onCollapse}
            >
              <div className="rounded-2xl bg-white p-4 shadow-[0_24px_70px_rgba(13,71,161,0.35)] ring-1 ring-ink/10">
                {code("block size-[min(78vw,78svh)]")}
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

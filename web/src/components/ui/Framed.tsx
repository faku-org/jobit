/**
 * Lo que se ve cuando alguien mete la app entera en un iframe.
 *
 * El CSP deja `frame-ancestors *` a propósito, porque el `?embed=` existe para
 * que otras páginas muestren una oferta adentro suyo. Eso está bien mientras
 * lo enmarcado sea una oferta y nada más. La app completa es otra cosa: con
 * sesión abierta, una página ajena puede taparla con lo que quiera y hacer que
 * un clic caiga donde no se ve. La oferta se sigue pudiendo enmarcar; la app,
 * no.
 */
export function Framed() {
  return (
    <main className="framed">
      <h1>JobIt no se abre acá adentro</h1>
      <p>
        Esta página está metida dentro de otra. Para usar el buscador, abrilo directo.
      </p>
      <a href={window.location.href} target="_blank" rel="noopener noreferrer">
        Abrir JobIt
      </a>
    </main>
  );
}

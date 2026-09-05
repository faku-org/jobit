/**
 * Lo único con javascript de las dos legales, y las dos cosas que hace se caen
 * solas si no corre: el índice sigue siendo una lista de enlaces y cambiar de
 * documento sigue siendo navegar.
 *
 *   1. Marca en el índice la sección que se está leyendo.
 *   2. Cambia de un documento al otro sin recargar la página.
 */

const DOCS = ["/terminos", "/privacidad"];

/** El dev server sirve `/terminos.html` y nginx `/terminos`; la misma página
 * tiene que reconocerse igual desde las dos. */
const pathOf = (pathname: string): string => pathname.replace(/\.html$/, "");

/* ---------------------------------------------------------------- índice */

/** El mismo corte que `lg` en el css, que es donde el índice deja de ser un
 * desplegable y pasa a ser la columna de al lado. */
const narrow = matchMedia("(max-width: 1023px)");

const toc = (): HTMLDetailsElement | null =>
  document.querySelector<HTMLDetailsElement>("details.legal-toc");

/**
 * El desplegable viene abierto en el html, así que sin javascript el índice se
 * ve entero en cualquier pantalla. Con javascript se pliega en el teléfono,
 * donde catorce enlaces empujan el texto fuera de la vista.
 */
function foldToc(): void {
  const details = toc();
  if (details) details.open = !narrow.matches;
}

/** Agrandar la ventana con el índice plegado lo dejaría escondido detrás de un
 * resumen que en lg no se dibuja. */
narrow.addEventListener("change", foldToc);

let spy: IntersectionObserver | null = null;

/** Se rearma en cada cambio de documento: las secciones son otras y el
 * observer viejo apuntaría a nodos que ya no están en la página. */
function trackSections(): void {
  spy?.disconnect();
  spy = null;

  const links = [...document.querySelectorAll<HTMLAnchorElement>("[data-toc] a[href^='#']")];
  const sections = links.flatMap((link) => {
    const section = document.querySelector<HTMLElement>(link.hash);
    return section ? [{ link, section }] : [];
  });

  if (sections.length === 0) return;

  const visible = new Set<Element>();
  let current: HTMLAnchorElement | null = null;

  const mark = (link: HTMLAnchorElement): void => {
    if (link === current) return;
    current?.removeAttribute("aria-current");
    link.setAttribute("aria-current", "true");
    current = link;

    /** Un índice más alto que la pantalla tiene que traer sola la sección
     * activa. `nearest` para no mover la página vertical mientras alguien está
     * leyendo, y nada cuando el desplegable está cerrado. */
    if (link.checkVisibility()) link.scrollIntoView({ block: "nearest" });
  };

  spy = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) visible.add(entry.target);
        else visible.delete(entry.target);
      }

      /** La primera en orden de documento que toque la franja de lectura. Si
       * ninguna la toca, se queda la última que la tocó: pasa entre dos
       * secciones cortas y volver a la anterior sería un parpadeo. */
      const active = sections.find((entry) => visible.has(entry.section));
      if (active) mark(active.link);
    },
    /** La franja arranca abajo de la isla y termina antes del pie: una sección
     * cuenta cuando entra en la parte de la pantalla que se está leyendo. */
    { rootMargin: "-112px 0px -65% 0px" },
  );

  for (const entry of sections) spy.observe(entry.section);
}

/* ----------------------------------------------------- cambio de documento */

/** El otro documento se pide una sola vez y queda acá: son dos y no cambian
 * mientras alguien los lee. */
const pages = new Map<string, string>();

async function load(path: string): Promise<string> {
  const cached = pages.get(path);
  if (cached !== undefined) return cached;

  const response = await fetch(path, { headers: { accept: "text/html" } });
  if (!response.ok) throw new Error(`${path} respondió ${response.status}`);

  const html = await response.text();
  pages.set(path, html);
  return html;
}

/** Del documento nuevo entra lo que cambia: el cuerpo, el título de la pestaña
 * y el canonical. La isla de arriba es la misma en los dos. */
function apply(html: string): void {
  const next = new DOMParser().parseFromString(html, "text/html");
  const incoming = next.querySelector("main.legal");
  const outgoing = document.querySelector("main.legal");
  if (!incoming || !outgoing) throw new Error("la página no tiene el cuerpo esperado");

  outgoing.replaceWith(document.importNode(incoming, true));
  document.title = next.title;

  const canonical = document.querySelector<HTMLLinkElement>("link[rel='canonical']");
  const nextCanonical = next.querySelector<HTMLLinkElement>("link[rel='canonical']");
  if (canonical && nextCanonical) canonical.href = nextCanonical.href;

  scrollTo({ top: 0 });
  foldToc();
  trackSections();
}

type ViewTransitions = { startViewTransition: (update: () => void) => unknown };

/** Un cruce suave donde el navegador lo sabe hacer; donde no, el cambio es
 * seco, que es lo que era antes de todos modos. */
function withTransition(update: () => void): void {
  if ("startViewTransition" in document) {
    (document as unknown as ViewTransitions).startViewTransition(update);
    return;
  }
  update();
}

async function go(path: string, push: boolean): Promise<void> {
  let html: string;
  try {
    html = await load(path);
  } catch {
    /** Si el documento no llegó, que navegue el navegador: peor es quedarse
     * en la página anterior con la url cambiada. */
    location.assign(path);
    return;
  }

  if (push) history.pushState(null, "", path);
  withTransition(() => {
    apply(html);
  });
}

/** Un click en el otro documento, y solo ese: los enlaces con ancla, los que
 * salen a la app y todo lo que abre en otra pestaña siguen su camino. */
addEventListener("click", (event: MouseEvent) => {
  if (event.defaultPrevented || event.button !== 0) return;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

  const link = event.target instanceof Element ? event.target.closest("a") : null;
  if (!link || link.target !== "" || link.origin !== location.origin) return;

  /** Elegir una sección en el teléfono cierra el índice, que si no se queda
   * abierto tapando lo que se acaba de elegir. El salto lo sigue haciendo el
   * navegador, con el alto ya recalculado. */
  if (narrow.matches && link.hash !== "" && link.closest("[data-toc]")) {
    const details = toc();
    if (details) details.open = false;
    return;
  }

  const path = pathOf(link.pathname);
  if (!DOCS.includes(path) || path === pathOf(location.pathname)) return;

  event.preventDefault();
  void go(path, true);
});

addEventListener("popstate", () => {
  void go(pathOf(location.pathname), false);
});

foldToc();
trackSections();

/** El otro documento se trae apenas hay tiempo, así que el primer cambio ya lo
 * encuentra en memoria y no espera a la red. */
const other = DOCS.find((doc) => doc !== pathOf(location.pathname));
if (other !== undefined) {
  setTimeout(() => {
    void load(other).catch(() => {});
  }, 500);
}

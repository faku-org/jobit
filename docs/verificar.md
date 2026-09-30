# Verificar el código que se sirve

La política de privacidad promete cosas que cumple el JavaScript que corre en
el navegador: que el CV no sale, que el buscador no manda lo que escribís y,
cuando esté el cifrado de punta a punta, que la clave nunca llega al servidor.
Todo eso vale mientras el JavaScript sea el publicado. Esto es cómo
comprobarlo, y hasta dónde llega.

## Cómo funciona

1. **El build es reproducible.** El mismo commit, con las mismas versiones de
   Bun y de las dependencias (`bun.lock`), da los mismos bytes en cualquier
   máquina y en cualquier carpeta. Se probó buildeando dos veces en rutas
   distintas y comparando.
2. **El build deja un manifiesto.** `web/scripts/manifest.ts` corre después de
   `vite build` y escribe `dist/version.json`: el commit, su fecha (la del
   commit, no la del build, para no romper el punto 1), si el árbol tenía
   cambios sin commitear, el sha256 de cada archivo y un `build_hash` que los
   resume.
3. **El sitio lo sirve** en `/version.json`, sin caché.
4. **`bun run verificar` compara.** Baja el manifiesto, hashea cada archivo
   que sirve el sitio contra lo que declara, exige estar parado en ese commit
   sin cambios, buildea y compara byte a byte.
5. **Una tarea pública lo corre a diario** (`.github/workflows/verificar.yml`)
   en una máquina de GitHub, que no es el servidor de JobIt. El resultado de
   cada corrida queda público en la pestaña Actions.

```sh
git clone https://github.com/faku-org/jobit && cd jobit
git checkout <commit de /version.json>
bun install --frozen-lockfile
bun run verificar                # contra jobs.wefaber.net
bun run verificar --url <otro>   # contra otro despliegue
bun run verificar --no-build     # reusar web/dist ya buildeado
```

Sale con 0 si coincide, 1 si no, y 2 si el clon no está en el commit del sitio
(e imprime el `git checkout` que falta).

## Qué prueba y qué no

Prueba que **lo que el sitio sirve es el build de un commit público**. Si
alguien cambia un archivo en el servidor, o despliega algo que no está en el
repositorio, la verificación falla y dice qué archivo.

No prueba:

- **Lo que pasa en tu navegador en ese momento.** El servidor podría mandarle
  una versión distinta a una sola persona. La verificación hace que eso deje
  de ser invisible en general, no que sea imposible en un caso puntual.
- **Lo que hace la API.** El código del servidor no se puede observar desde
  afuera. Por eso lo sensible se diseña para que no le llegue en claro
  (ver [cero-acceso.md](cero-acceso.md)).
- **La página /verificar.** La sirve el mismo servidor. Su comprobación en el
  navegador solo muestra que el sitio es coherente con su propio manifiesto.
  La que cuenta es la de afuera.

## Cuando no coincide

Antes de concluir que el sitio sirve otra cosa, descartar lo que hace que dos
builds honestos difieran:

- **Otra versión de Bun.** Deploy y la tarea diaria usan la de
  `.bun-version`. `bun --version` tiene que dar esa.
- **Otras dependencias.** `bun install --frozen-lockfile` falla si `bun.lock`
  no alcanza para reproducir; sin `--frozen-lockfile` podría resolver otras.
- **Cambios locales.** El paso 2 lo detecta y lo marca.
- **Otra arquitectura.** Vite, Tailwind y oxc usan binarios nativos por
  plataforma. Hasta ahora dan lo mismo en x64 y arm64, pero si alguna vez no,
  la diferencia se va a ver en la tarea diaria antes que en ningún lado.

Si con todo eso igual no coincide, es exactamente lo que queremos saber:
hola@wefaber.net o un issue en el repositorio.

## Qué archivos pueden no responder

`admin.html` responde 403 desde fuera de la VPN interna, y es el único archivo
al que el verificador le acepta un 403 (`RESTRICTED` en `scripts/verificar.ts`
y en `web/src/verificar.ts`). Si aceptara cualquiera, un servidor podría
esconder un archivo alterado detrás de un 403 y pasar igual.

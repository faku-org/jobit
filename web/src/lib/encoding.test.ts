import { describe, expect, test } from 'bun:test'
import { Glob } from 'bun'

/* Un archivo guardado con la codificación equivocada deja "más" con dos
   letras raras en lugar de la á (UTF-8 leído como Latin-1) y la persona lo ve tal cual en un botón. Pasó en
   App.tsx y market.ts; este test lo frena antes de llegar a producción. */
/* Armado con códigos: escrito literal, el formateador lo convierte en esas
   mismas letras y el test se encuentra a sí mismo. */
const char = (code: number): string => String.fromCharCode(code)
const MOJIBAKE = new RegExp(
  `[${char(0xc2)}${char(0xc3)}][${char(0x80)}-${char(0xbf)}]|${char(0xe2)}${char(0x20ac)}`,
)

describe('codificación', () => {
  test('ningún fuente tiene texto con doble codificación', async () => {
    const root = `${import.meta.dir}/../../..`
    const offenders: string[] = []
    for (const dir of ['web/src', 'api/src', 'worker/src', 'mcp']) {
      const glob = new Glob('**/*.{ts,tsx,css,html}')
      for await (const scanned of glob.scan({
        cwd: `${root}/${dir}`,
        onlyFiles: true,
      })) {
        const file = scanned.replaceAll('\\', '/')
        if (file.includes('node_modules/')) continue
        const text = await Bun.file(`${root}/${dir}/${file}`).text()
        if (MOJIBAKE.test(text)) offenders.push(`${dir}/${file}`)
      }
    }
    expect(offenders).toEqual([])
  })
})

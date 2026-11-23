import { describe, expect, test } from 'bun:test'
import {
  DEFAULT_TEMPLATES,
  MAX_MAILTO_CHARS,
  attachmentList,
  buildMailto,
  fillTemplate,
  findContactEmail,
  mailSubject,
  messageValues,
  templateFor,
} from './message.ts'
import { EMPTY_RESUME, MAX_MESSAGE_CHARS, sanitizeResume } from './resume.ts'
import type { Job } from './types.ts'

const job: Job = {
  id: 'buscojobs:99',
  source: 'buscojobs',
  source_id: '99',
  title: 'Cajero para supermercado',
  company: 'Super',
  department: 'Canelones',
  city: 'Las Piedras',
  category: 'ventas',
  category_label: 'Ventas y comercial',
  date_posted: '2026-09-01T00:00:00.000Z',
  level: null,
  remote: null,
  job_type: null,
  salary: null,
  experience_years_min: null,
  no_experience: false,
  education_level: null,
  schedule: null,
  vacancies: null,
  closes_at: null,
  description: '',
  requirements: null,
  apply_url: 'https://ejemplo.com/1',
  duplicates: [],
}

const resume = { ...EMPTY_RESUME, name: 'Faku Presa' }

describe('fillTemplate', () => {
  test('completa nombre, puesto, empresa y adjuntos', () => {
    const text = fillTemplate(
      DEFAULT_TEMPLATES.short,
      messageValues(job, { ...resume, attachments: 'mi CV y mi libreta' }),
    )
    expect(text).toBe(
      'Hola, soy Faku Presa y me postulo al puesto de Cajero para supermercado en Super. Les adjunto mi CV y mi libreta. ¡Gracias!',
    )
  })

  test('sin empresa ni adjuntos usa un texto que se lee bien', () => {
    const values = messageValues({ ...job, company: null }, resume)
    expect(values.empresa).toBe('su empresa')
    expect(values.adjuntos).toBe('mi CV')
  })

  test('llena cada llave, las repetidas también', () => {
    const text = fillTemplate(
      DEFAULT_TEMPLATES.formal,
      messageValues(job, resume),
    )
    expect(text.match(/Faku Presa/g)).toHaveLength(2)
    expect(text).not.toContain('{')
  })

  test('idiomas y links salen del perfil, y vacíos quedan vacíos', () => {
    const full = messageValues(job, {
      ...resume,
      languages: [{ name: 'Inglés', level: 'advanced' }],
      links: [{ kind: 'github', url: 'https://github.com/faku' }],
    })
    expect(fillTemplate('{idiomas} | {links}', full)).toBe(
      'Inglés (avanzado) | https://github.com/faku',
    )
    expect(fillTemplate('[{idiomas}]', messageValues(job, resume))).toBe('[]')
  })

  test('una llave desconocida queda como la escribió la persona', () => {
    expect(
      fillTemplate('Hola {otro} {nombre}', messageValues(job, resume)),
    ).toBe('Hola {otro} Faku Presa')
  })

  test('los $ del texto no se interpretan como patrones de reemplazo', () => {
    const values = messageValues(job, { ...resume, name: 'Pe$&dro $1' })
    expect(fillTemplate('{nombre}', values)).toBe('Pe$&dro $1')
  })
})

describe('templateFor', () => {
  test('usa la guardada, y la de fábrica si no hay', () => {
    expect(templateFor(EMPTY_RESUME, 'formal')).toBe(DEFAULT_TEMPLATES.formal)
    expect(
      templateFor(
        { ...EMPTY_RESUME, messages: { formal: 'Hola {nombre}' } },
        'formal',
      ),
    ).toBe('Hola {nombre}')
    expect(
      templateFor({ ...EMPTY_RESUME, messages: { formal: 'Hola' } }, 'short'),
    ).toBe(DEFAULT_TEMPLATES.short)
  })
})

describe('findContactEmail', () => {
  const withText = (
    description: string,
    requirements: string | null = null,
  ) => ({
    ...job,
    description,
    requirements,
  })

  test('toma el mail de la descripción', () => {
    expect(
      findContactEmail(
        withText('Enviar CV a rrhh@empresa.com.uy antes del viernes.'),
      ),
    ).toBe('rrhh@empresa.com.uy')
  })

  test('el punto final de la oración no entra en la dirección', () => {
    expect(findContactEmail(withText('Escribinos a empleo@tienda.uy.'))).toBe(
      'empleo@tienda.uy',
    )
  })

  test('también mira los requisitos', () => {
    expect(findContactEmail(withText('Sin datos', 'CV a: jobs@acme.com'))).toBe(
      'jobs@acme.com',
    )
  })

  test('un mailto en el enlace de postulación gana sobre el texto', () => {
    expect(
      findContactEmail({
        ...withText('Otro: info@otra.com'),
        apply_url: 'mailto:rrhh@acme.uy?subject=Hola',
      }),
    ).toBe('rrhh@acme.uy')
  })

  test('un mailto roto no cae a adivinar en el texto', () => {
    expect(
      findContactEmail({
        ...withText('info@otra.com'),
        apply_url: 'mailto:no-es-un-mail',
      }),
    ).toBeNull()
  })

  test('la misma dirección repetida cuenta una vez', () => {
    expect(findContactEmail(withText('RRHH@acme.com y rrhh@acme.com'))).toBe(
      'RRHH@acme.com',
    )
  })

  test('con dos direcciones distintas no adivina', () => {
    expect(
      findContactEmail(withText('Ventas: a@acme.com. Soporte: b@acme.com')),
    ).toBeNull()
  })

  test('ignora noreply, imágenes y dominios de ejemplo', () => {
    expect(findContactEmail(withText('noreply@acme.com'))).toBeNull()
    expect(findContactEmail(withText('logo@2x.png'))).toBeNull()
    expect(findContactEmail(withText('tu@example.com'))).toBeNull()
    expect(
      findContactEmail(withText('noreply@acme.com, escribí a rrhh@acme.com')),
    ).toBe('rrhh@acme.com')
  })

  test('sin ningún mail devuelve nada', () => {
    expect(findContactEmail(job)).toBeNull()
    expect(findContactEmail(withText('Seguí @acme en redes'))).toBeNull()
  })
})

describe('buildMailto', () => {
  test('arma asunto y cuerpo codificados, con CRLF', () => {
    const url = buildMailto('rrhh@acme.uy', 'Postulación: Cajero', 'Hola\nChau')
    expect(url).toBe(
      'mailto:rrhh@acme.uy?subject=Postulaci%C3%B3n%3A%20Cajero&body=Hola%0D%0AChau',
    )
  })

  test('un cuerpo con & o # no corta los parámetros', () => {
    const url = buildMailto('a@b.uy', 'x', 'Ventas & Atención #1') ?? ''
    expect(url).not.toContain('& ')
    expect(new URL(url).searchParams.get('body')).toBe('Ventas & Atención #1')
  })

  test('si no entra en un mailto no lo corta: devuelve nada', () => {
    expect(buildMailto('a@b.uy', 'x', 'a'.repeat(MAX_MAILTO_CHARS))).toBeNull()
    expect(buildMailto('a@b.uy', 'x', 'a'.repeat(500))).not.toBeNull()
  })

  test('el mensaje más largo que se guarda en un caracter común todavía entra', () => {
    const url = buildMailto(
      'rrhh@empresa.com.uy',
      'Postulación',
      'a'.repeat(MAX_MESSAGE_CHARS),
    )
    expect(url).not.toBeNull()
  })
})

describe('mailSubject', () => {
  test('lleva el puesto y, si hay, el nombre', () => {
    expect(mailSubject(job, 'Faku Presa')).toBe(
      'Postulación: Cajero para supermercado - Faku Presa',
    )
    expect(mailSubject(job, '  ')).toBe('Postulación: Cajero para supermercado')
  })
})

describe('el mensaje en el currículum', () => {
  test('nombre, adjuntos y variantes se guardan recortados', () => {
    const saved = sanitizeResume({
      name: `  ${'x'.repeat(200)}  `,
      attachments: ' mi CV ',
      messages: {
        formal: ' Hola {nombre} ',
        short: '',
        first: 7,
        otra: 'no existe',
      },
    })
    expect(saved.name).toHaveLength(80)
    expect(saved.attachments).toBe('mi CV')
    expect(saved.messages).toEqual({ formal: 'Hola {nombre}' })
  })

  test('una variante más larga que el tope se corta', () => {
    const saved = sanitizeResume({
      messages: { formal: 'a'.repeat(MAX_MESSAGE_CHARS + 500) },
    })
    expect(saved.messages.formal).toHaveLength(MAX_MESSAGE_CHARS)
  })

  test('una forma rara de messages no rompe nada', () => {
    expect(sanitizeResume({ messages: 'hola' }).messages).toEqual({})
    expect(sanitizeResume({ messages: [1, 2] }).messages).toEqual({})
  })
})

describe('attachmentList', () => {
  test('parte lo que la persona escribió en adjuntos', () => {
    expect(
      attachmentList('mi CV, carta de presentación y certificados'),
    ).toEqual(['mi CV', 'carta de presentación', 'certificados'])
    expect(attachmentList('CV; foto')).toEqual(['CV', 'foto'])
  })

  test('una sola cosa queda entera, también con una "y" adentro de la palabra', () => {
    expect(attachmentList('mi CV')).toEqual(['mi CV'])
    expect(attachmentList('Curriculum Vitae')).toEqual(['Curriculum Vitae'])
  })

  test('vacío vale "mi CV", como en la plantilla', () => {
    expect(attachmentList('')).toEqual(['mi CV'])
    expect(attachmentList('  ,  ')).toEqual(['mi CV'])
  })
})

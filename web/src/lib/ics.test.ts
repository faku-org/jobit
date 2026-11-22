import { describe, expect, test } from 'bun:test'
import type { Interview } from './followup.ts'
import {
  buildInterviewIcs,
  escapeText,
  foldLine,
  interviewIcsName,
  interviewUid,
} from './ics.ts'

const NOW = new Date('2026-11-22T20:15:30Z')

const interview: Interview = {
  id: 'abc-123',
  applicationId: 'job-1',
  date: '2026-12-01',
  time: '15:30',
  place: 'Av. 18 de Julio 1234, piso 5',
  link: 'https://meet.google.com/abc-defg-hij',
  contact: 'Lucía Pérez, RRHH',
  revision: 0,
}

const build = (overrides: Partial<Interview> = {}) =>
  buildInterviewIcs({
    interview: { ...interview, ...overrides },
    title: 'Cocinero/a',
    company: 'La Pasiva',
    now: NOW,
  })

const linesOf = (ics: string) => ics.split('\r\n')

describe('escapeText', () => {
  test('escapes backslash, semicolon, comma and newlines', () => {
    expect(escapeText('a\\b;c,d\ne')).toBe('a\\\\b\\;c\\,d\\ne')
  })

  test('writes CRLF and CR as \\n too', () => {
    expect(escapeText('uno\r\ndos\rtres')).toBe('uno\\ndos\\ntres')
  })

  test('escapes the backslash first so it does not double-escape', () => {
    expect(escapeText('\\;')).toBe('\\\\\\;')
  })

  test('drops control characters', () => {
    expect(escapeText('a\u0000b\u0007c')).toBe('abc')
  })
})

describe('foldLine', () => {
  test('leaves a short line alone', () => {
    expect(foldLine('SUMMARY:corto')).toBe('SUMMARY:corto')
  })

  test('folds at 75 octets with CRLF and a space', () => {
    const folded = foldLine(`SUMMARY:${'a'.repeat(200)}`)
    const parts = folded.split('\r\n')
    expect(parts.length).toBeGreaterThan(1)
    expect(new TextEncoder().encode(parts[0]!).length).toBe(75)
    for (const part of parts.slice(1)) {
      expect(part.startsWith(' ')).toBe(true)
      expect(new TextEncoder().encode(part).length).toBeLessThanOrEqual(75)
    }
    expect(
      parts.map((part, index) => (index ? part.slice(1) : part)).join(''),
    ).toBe(`SUMMARY:${'a'.repeat(200)}`)
  })

  test('never splits a multi-byte character', () => {
    const line = `SUMMARY:${'ñ'.repeat(80)}`
    const folded = foldLine(line)
    const parts = folded.split('\r\n')
    for (const part of parts) {
      expect(new TextEncoder().encode(part).length).toBeLessThanOrEqual(75)
      expect(part).not.toContain('�')
    }
    const unfolded = parts
      .map((part, index) => (index ? part.slice(1) : part))
      .join('')
    expect(unfolded).toBe(line)
  })
})

describe('buildInterviewIcs', () => {
  test('is a VCALENDAR with one VEVENT, CRLF everywhere and a final CRLF', () => {
    const ics = build()
    expect(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n')).toBe(true)
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true)
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1)
    expect(ics.match(/END:VEVENT/g)).toHaveLength(1)
    /** Ningún LF suelto: todos vienen precedidos por CR. */
    expect(ics.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/)
  })

  test('has PRODID, CALSCALE and METHOD', () => {
    const ics = build()
    expect(ics).toContain('\r\nPRODID:-//JobIt//Seguimiento//ES\r\n')
    expect(ics).toContain('\r\nCALSCALE:GREGORIAN\r\n')
    expect(ics).toContain('\r\nMETHOD:PUBLISH\r\n')
  })

  test('no line is longer than 75 octets', () => {
    const ics = build({
      place: 'x'.repeat(190),
      contact: 'ñ'.repeat(100),
    })
    for (const line of linesOf(ics)) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75)
    }
  })

  test('writes DTSTART and DTEND in America/Montevideo, one hour apart', () => {
    const ics = build()
    expect(ics).toContain('DTSTART;TZID=America/Montevideo:20261201T153000\r\n')
    expect(ics).toContain('DTEND;TZID=America/Montevideo:20261201T163000\r\n')
  })

  test('carries the end across midnight', () => {
    const ics = build({ date: '2026-12-31', time: '23:30' })
    expect(ics).toContain('DTSTART;TZID=America/Montevideo:20261231T233000\r\n')
    expect(ics).toContain('DTEND;TZID=America/Montevideo:20270101T003000\r\n')
  })

  test('defines the time zone it uses, with no daylight saving', () => {
    const ics = build()
    expect(ics).toContain('BEGIN:VTIMEZONE\r\nTZID:America/Montevideo\r\n')
    expect(ics).toContain('TZOFFSETFROM:-0300\r\nTZOFFSETTO:-0300\r\n')
    expect(ics).not.toContain('BEGIN:DAYLIGHT')
    expect(ics.indexOf('END:VTIMEZONE')).toBeLessThan(
      ics.indexOf('BEGIN:VEVENT'),
    )
  })

  test('DTSTAMP is the generation instant in UTC', () => {
    expect(build()).toContain('\r\nDTSTAMP:20261122T201530Z\r\n')
  })

  test('UID is stable for the same interview and differs between interviews', () => {
    const uid = interviewUid(interview)
    expect(uid).toBe('jobit-entrevista-abc-123@jobit.uy')
    expect(build()).toContain(`\r\nUID:${uid}\r\n`)
    expect(build({ date: '2027-01-05' })).toContain(`\r\nUID:${uid}\r\n`)
    expect(interviewUid({ id: 'otra' })).not.toBe(uid)
  })

  test('SEQUENCE follows the revision so an edit updates the same event', () => {
    expect(build()).toContain('\r\nSEQUENCE:0\r\n')
    expect(build({ revision: 3 })).toContain('\r\nSEQUENCE:3\r\n')
  })

  test('has an alarm the day before', () => {
    const ics = build()
    expect(ics).toContain('BEGIN:VALARM\r\nACTION:DISPLAY\r\n')
    expect(ics).toContain('\r\nTRIGGER:-P1D\r\nEND:VALARM\r\n')
    /** El VALARM tiene DESCRIPTION, que ACTION:DISPLAY exige. */
    const alarm = ics.slice(
      ics.indexOf('BEGIN:VALARM'),
      ics.indexOf('END:VALARM'),
    )
    expect(alarm).toContain('DESCRIPTION:')
  })

  test('puts title and company in the summary, escaped', () => {
    const ics = buildInterviewIcs({
      interview,
      title: 'Cocinero, ayudante; turno noche',
      company: 'A\\B',
      now: NOW,
    })
    expect(ics).toContain(
      'SUMMARY:Entrevista: Cocinero\\, ayudante\\; turno noche en A\\\\B\r\n',
    )
  })

  test('summary without company has no dangling "en"', () => {
    const ics = buildInterviewIcs({
      interview,
      title: 'Cocinero/a',
      company: null,
      now: NOW,
    })
    expect(ics).toContain('SUMMARY:Entrevista: Cocinero/a\r\n')
  })

  test('LOCATION and URL are there when present and omitted when empty', () => {
    const full = build()
    expect(full).toContain('LOCATION:Av. 18 de Julio 1234\\, piso 5\r\n')
    expect(full).toContain('URL:https://meet.google.com/abc-defg-hij\r\n')

    const bare = build({ place: '', link: '' })
    expect(bare).not.toContain('LOCATION:')
    expect(bare).not.toContain('URL:')
  })

  test('the description has who, where and the link, with escaped line breaks', () => {
    const ics = build().replace(/\r\n /g, '')
    expect(ics).toContain('Con: Lucía Pérez\\, RRHH\\n')
    expect(ics).toContain('Enlace: https://meet.google.com/abc-defg-hij\\n')
    expect(ics).toContain('Agendada desde JobIt.')
  })

  test('user text cannot inject a new property', () => {
    const ics = build({ contact: 'Ana\r\nATTENDEE:mailto:x@y.z' })
    expect(linesOf(ics).some((line) => line.startsWith('ATTENDEE'))).toBe(false)
  })
})

describe('interviewIcsName', () => {
  test('is a plain ascii slug ending in .ics', () => {
    expect(interviewIcsName('Cocinero/a', 'La Pasiva')).toBe(
      'entrevista-cocinero-a-la-pasiva.ics',
    )
  })

  test('drops accents and symbols', () => {
    expect(interviewIcsName('Diseñador/a UX', 'Ñandú & Cía.')).toBe(
      'entrevista-disenador-a-ux-nandu-cia.ics',
    )
  })

  test('falls back when nothing is left', () => {
    expect(interviewIcsName('???', null)).toBe('entrevista.ics')
  })
})

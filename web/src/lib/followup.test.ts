import { describe, expect, test } from 'bun:test'
import {
  addNote,
  editNote,
  EMPTY_FOLLOWUP,
  type FollowUpState,
  interviewIssues,
  interviewsFor,
  isMeetingLink,
  isValidDate,
  isValidTime,
  MAX_NOTE,
  notesFor,
  readFollowUp,
  removeForApplication,
  removeInterview,
  removeNote,
  saveInterview,
} from './followup.ts'

const T1 = '2026-11-01T10:00:00.000Z'
const T2 = '2026-11-02T10:00:00.000Z'

const draft = {
  id: 'i1',
  applicationId: 'a1',
  date: '2026-12-01',
  time: '15:30',
  place: ' Sala 3 ',
  link: '',
  contact: 'Ana',
}

describe('notes', () => {
  test('adds a trimmed note, newest first', () => {
    let state = addNote(EMPTY_FOLLOWUP, {
      id: 'n1',
      applicationId: 'a1',
      text: '  primera  ',
      now: T1,
    })
    state = addNote(state, {
      id: 'n2',
      applicationId: 'a1',
      text: 'segunda',
      now: T2,
    })
    expect(notesFor(state, 'a1').map((note) => note.text)).toEqual([
      'segunda',
      'primera',
    ])
  })

  test('ignores an empty note', () => {
    const state = addNote(EMPTY_FOLLOWUP, {
      id: 'n1',
      applicationId: 'a1',
      text: '   \n ',
      now: T1,
    })
    expect(state).toBe(EMPTY_FOLLOWUP)
  })

  test('caps the length of a note', () => {
    const state = addNote(EMPTY_FOLLOWUP, {
      id: 'n1',
      applicationId: 'a1',
      text: 'x'.repeat(MAX_NOTE + 50),
      now: T1,
    })
    expect(state.notes[0]?.text).toHaveLength(MAX_NOTE)
  })

  test('edits text and touches updatedAt only', () => {
    const state = addNote(EMPTY_FOLLOWUP, {
      id: 'n1',
      applicationId: 'a1',
      text: 'vieja',
      now: T1,
    })
    const edited = editNote(state, 'n1', 'nueva', T2)
    expect(edited.notes[0]).toMatchObject({
      text: 'nueva',
      createdAt: T1,
      updatedAt: T2,
    })
  })

  test('an edit to empty is refused', () => {
    const state = addNote(EMPTY_FOLLOWUP, {
      id: 'n1',
      applicationId: 'a1',
      text: 'vieja',
      now: T1,
    })
    expect(editNote(state, 'n1', '  ', T2)).toBe(state)
  })

  test('removes one note and leaves the rest', () => {
    let state = addNote(EMPTY_FOLLOWUP, {
      id: 'n1',
      applicationId: 'a1',
      text: 'uno',
      now: T1,
    })
    state = addNote(state, {
      id: 'n2',
      applicationId: 'a1',
      text: 'dos',
      now: T2,
    })
    expect(removeNote(state, 'n1').notes.map((note) => note.id)).toEqual(['n2'])
  })

  test('notes of another application are not mixed in', () => {
    const state = addNote(EMPTY_FOLLOWUP, {
      id: 'n1',
      applicationId: 'otra',
      text: 'ajena',
      now: T1,
    })
    expect(notesFor(state, 'a1')).toEqual([])
  })
})

describe('interviews', () => {
  test('saves a new interview trimmed, at revision 0', () => {
    const state = saveInterview(EMPTY_FOLLOWUP, draft)
    expect(state.interviews).toEqual([
      { ...draft, place: 'Sala 3', revision: 0 },
    ])
  })

  test('saving the same id edits it and bumps the revision', () => {
    const once = saveInterview(EMPTY_FOLLOWUP, draft)
    const twice = saveInterview(once, { ...draft, time: '16:00' })
    expect(twice.interviews).toHaveLength(1)
    expect(twice.interviews[0]).toMatchObject({ time: '16:00', revision: 1 })
    expect(saveInterview(twice, draft).interviews[0]?.revision).toBe(2)
  })

  test('lists the next one first', () => {
    let state = saveInterview(EMPTY_FOLLOWUP, {
      ...draft,
      id: 'tarde',
      date: '2026-12-05',
    })
    state = saveInterview(state, { ...draft, id: 'pronto', date: '2026-12-01' })
    expect(interviewsFor(state, 'a1').map((item) => item.id)).toEqual([
      'pronto',
      'tarde',
    ])
  })

  test('removes one interview', () => {
    const state = saveInterview(EMPTY_FOLLOWUP, draft)
    expect(removeInterview(state, 'i1').interviews).toEqual([])
  })
})

describe('removeForApplication', () => {
  test('takes notes and interviews of that application and nothing else', () => {
    let state: FollowUpState = addNote(EMPTY_FOLLOWUP, {
      id: 'n1',
      applicationId: 'a1',
      text: 'mía',
      now: T1,
    })
    state = addNote(state, {
      id: 'n2',
      applicationId: 'a2',
      text: 'ajena',
      now: T1,
    })
    state = saveInterview(state, draft)
    state = saveInterview(state, { ...draft, id: 'i2', applicationId: 'a2' })

    const next = removeForApplication(state, 'a1')
    expect(next.notes.map((note) => note.id)).toEqual(['n2'])
    expect(next.interviews.map((item) => item.id)).toEqual(['i2'])
  })
})

describe('readFollowUp', () => {
  test('falls back to empty on anything that is not an object', () => {
    expect(readFollowUp(null)).toBe(EMPTY_FOLLOWUP)
    expect(readFollowUp('x')).toBe(EMPTY_FOLLOWUP)
  })

  test('drops malformed notes and interviews', () => {
    const state = readFollowUp({
      notes: [
        { id: 'n1', applicationId: 'a1', text: 'ok', createdAt: T1 },
        { id: 'n2', applicationId: 'a1', text: '   ' },
        { id: 3, applicationId: 'a1', text: 'sin id válido' },
        null,
      ],
      interviews: [
        { ...draft, revision: 2 },
        { ...draft, id: 'i2', date: '2026-02-30' },
        { ...draft, id: 'i3', time: '25:00' },
        { ...draft, id: 'i4', applicationId: undefined },
      ],
    })
    expect(state.notes.map((note) => note.id)).toEqual(['n1'])
    expect(state.notes[0]?.updatedAt).toBe(T1)
    expect(state.interviews.map((item) => item.id)).toEqual(['i1'])
    expect(state.interviews[0]?.revision).toBe(2)
  })

  test('a stored link that is not http(s) is dropped', () => {
    const state = readFollowUp({
      interviews: [{ ...draft, link: 'javascript:alert(1)' }],
    })
    expect(state.interviews[0]?.link).toBe('')
  })
})

describe('validation', () => {
  test('isValidDate checks the real calendar', () => {
    expect(isValidDate('2026-12-01')).toBe(true)
    expect(isValidDate('2028-02-29')).toBe(true)
    expect(isValidDate('2026-02-29')).toBe(false)
    expect(isValidDate('2026-13-01')).toBe(false)
    expect(isValidDate('01/12/2026')).toBe(false)
  })

  test('isValidTime is 24 hours', () => {
    expect(isValidTime('00:00')).toBe(true)
    expect(isValidTime('23:59')).toBe(true)
    expect(isValidTime('24:00')).toBe(false)
    expect(isValidTime('9:30')).toBe(false)
  })

  test('isMeetingLink accepts only http(s) without spaces', () => {
    expect(isMeetingLink('https://meet.google.com/abc')).toBe(true)
    expect(isMeetingLink('http://zoom.us/j/1')).toBe(true)
    expect(isMeetingLink('ftp://x.y')).toBe(false)
    expect(isMeetingLink('meet.google.com/abc')).toBe(false)
    expect(isMeetingLink('https://a.b/ c')).toBe(false)
  })

  test('interviewIssues separates missing from invalid', () => {
    expect(interviewIssues({ date: '', time: '', link: '' })).toEqual({
      missing: ['date', 'time'],
      invalid: [],
    })
    expect(
      interviewIssues({ date: '2026-12-01', time: '15:30', link: 'nada' }),
    ).toEqual({ missing: [], invalid: ['link'] })
    expect(
      interviewIssues({ date: '2026-12-01', time: '15:30', link: '' }),
    ).toEqual({ missing: [], invalid: [] })
  })
})

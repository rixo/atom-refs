'use babel'

import {Range} from 'atom'

export function addRangeMatchers() {
  this.addMatchers({toEqualRange, toEqualRanges})
}

const parseRangeRe = /(\d+):(\d+) (\d+):(\d+)(?: (\w+))?/

const formatRange = ({start, end, type = ''}) =>
  `${type}(${start.row}:${start.column} -> ${end.row}:${end.column})`

const formatRanges = ranges => `[${ranges.map(formatRange).join(', ')}]`

const toInt = v => parseInt(v)

function parseRange(range) {
  if (typeof range === 'string') {
    const match = parseRangeRe.exec(range)
    if (!match) {
      throw new Error('Invalid range spec: ' + range)
    }
    const [, r0, c0, r1, c1, type] = match
    const r = new Range([r0, c0].map(toInt), [r1, c1].map(toInt))
    return Object.assign(r, {type: type})
  } else {
    return Range.fromObject(range)
  }
}

function parseRanges(ranges) {
  if (!ranges) {
    return []
  }
  if (typeof ranges === 'string') {
    ranges = ranges.split(/,\s*/)
  }
  return ranges.map(parseRange)
}

function toEqualRange(expected) {
  const {actual} = this
  const prefix = this.messagePrefix || ''
  const expectedRange = parseRange(expected)
  if (actual instanceof Range === false) {
    this.message = () => `Expected${prefix} ${actual} to be a Range instance`
    return false
  }
  const {
    start: {row: asr, column: asc},
    end: {row: aer, column: aec},
    type: at,
  } = actual
  const {
    start: {row: esr, column: esc},
    end: {row: eer, column: eec},
    type: et,
  } = expectedRange
  const tests = [[asr, esr], [asc, esc], [aer, eer], [aec, eec], [at, et]]
  if (tests.every(([a, b]) => a === b)) {
    this.message = () => `Expected${prefix} ${formatRange(actual)} not to equal `
      + formatRange(expectedRange)
    return true
  } else {
    this.message = () => `Expected${prefix} ${formatRange(actual)} to equal `
      + formatRange(expectedRange)
    return false
  }
}

function toEqualRanges(expectedRanges) {
  const {actual} = this
  const expected = parseRanges(expectedRanges)
  if (!Array.isArray(expected)) {
    this.message = () => `Expected value must be an array (received: ${typeof expected})`
    return false
  }
  if (!Array.isArray(actual)) {
    this.message = () => `Actual value must be an array (received: ${typeof expected})`
    return false
  }
  if (expected.length !== actual.length) {
    this.message = () => {
      const exp = formatRanges(expected)
      const act = formatRanges(actual)
      return `Expected ${act} to equal ${exp}`
    }
    return false
  }
  const allPasses = expected.every((expectedRange, i) => {
    const o = {
      actual: actual[i],
      messagePrefix: ` [${i}]`,
    }
    const pass = toEqualRange.call(o, expectedRange)
    if (pass) {
      return true
    } else {
      this.message = o.message
      return false
    }
  })
  return allPasses
}

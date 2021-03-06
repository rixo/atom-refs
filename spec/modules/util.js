'use babel'

import { Range } from 'atom'
import dedent from 'dedent'

import { createLocator } from '../../lib/util'

const repeat = (char, n) => Array.from(Array(n)).join(char)

export const createAddRangeMatchers = opts => {
  const formatRange = createFormatRange(opts)
  const formatRanges = createFormatRanges(formatRange)
  const parseRange = createParseRange(opts)
  const parseRanges = createParseRanges(parseRange)
  const toEqualRange = createToEqualRange({ parseRange, formatRange })
  return function() {
    this.addMatchers({
      toEqualRange,
      toEqualRanges: toEqualRanges({ parseRanges, formatRanges, toEqualRange }),
      toMatchRanges,
    })
  }
}

const parseRangeRe = /(\d+):(\d+) (\d+):(\d+)(?: (\w+))?/

const createFormatRange = ({ human = false } = {}) =>
  human
    ? ({ start, end, type = '' }) =>
        `${type}(${start.row + 1}:${start.column + 1} -> ${end.row +
          1}:${end.column + 1})`
    : ({ start, end, type = '' }) =>
        `${type}(${start.row}:${start.column} -> ${end.row}:${end.column})`

const createFormatRanges = formatRange => ranges =>
  `[${ranges.map(formatRange).join(', ')}]`

const toInteger = v => parseInt(v)

const toIntHuman = v => v - 1

const createParseRange = ({ human = false } = {}) => {
  const toInt = human ? toIntHuman : toInteger
  return function parseRange(range) {
    if (typeof range === 'string') {
      const match = parseRangeRe.exec(range)
      if (!match) {
        throw new Error('Invalid range spec: ' + range)
      }
      const [, r0, c0, r1, c1, type] = match
      const r = new Range([r0, c0].map(toInt), [r1, c1].map(toInt))
      return Object.assign(r, { type: type })
    } else {
      return Range.fromObject(range)
    }
  }
}

const createParseRanges = parseRange => ranges => {
  if (!ranges) {
    return []
  }
  if (typeof ranges === 'string') {
    ranges = ranges.split(/,\s*/)
  }
  return ranges.map(parseRange)
}

const createToEqualRange = ({ parseRange, formatRange }) =>
  function toEqualRange(expected) {
    const { actual } = this
    const prefix = this.messagePrefix || ''
    const expectedRange = parseRange(expected)
    if (actual instanceof Range === false) {
      this.message = () => `Expected${prefix} ${actual} to be a Range instance`
      return false
    }
    const {
      start: { row: asr, column: asc },
      end: { row: aer, column: aec },
      type: at,
    } = actual
    const {
      start: { row: esr, column: esc },
      end: { row: eer, column: eec },
      type: et,
    } = expectedRange
    const tests = [[asr, esr], [asc, esc], [aer, eer], [aec, eec], [at, et]]
    if (tests.every(([a, b]) => a === b)) {
      this.message = () =>
        `Expected${prefix} ${formatRange(actual)} not to equal ` +
        formatRange(expectedRange)
      return true
    } else {
      this.message = () =>
        `Expected${prefix} ${formatRange(actual)} to equal ` +
        formatRange(expectedRange)
      return false
    }
  }

class CodeSpec {
  marks = []

  constructor(name) {
    this.name = name
  }

  mark(char, loc) {
    this.marks.push({ char, loc })
  }

  format(code, cursorLoc) {
    const { marks } = this
    const sortedMarks = marks.sort(({ loc: a }, { loc: b }) => a - b)
    let last = 0
    const result = [this.name + '\n\n']
    let pastCursor = cursorLoc == null
    sortedMarks.forEach(({ loc, char }) => {
      if (!pastCursor && loc >= cursorLoc) {
        result.push(code.substring(last, cursorLoc), '❙')
        last = cursorLoc
        pastCursor = true
      }
      result.push(code.substring(last, loc), char)
      last = loc
    }, [])
    if (!pastCursor) {
      result.push(code.substring(last, cursorLoc), '❙')
      last = cursorLoc
    }
    result.push(code.substring(last))
    return result.join('')
  }
}

const formatRow = (...strings) => {
  let numLines = 0
  const colLines = strings.map(string => {
    const lines = string.split('\n')
    numLines = Math.max(numLines, lines.length)
    return lines
  })
  const widths = colLines.map(lines =>
    Math.max(...lines.map(line => line.length))
  )
  const totalLines = colLines.reduce(
    (max, { length }) => Math.max(length, max),
    0
  )
  const rowLines = Array.from(Array(totalLines)).map((x, i) => {
    return colLines.reduce((result, lines, col) => {
      const l = lines[i] || ''
      result += l
      if (col < colLines.length - 1) {
        result += repeat(' ', widths[col] + 10 - l.length)
      }
      return result
    }, '')
  })
  return rowLines.join('\n')
}

const toEqualRanges = ({ parseRanges, formatRanges, toEqualRange }) =>
  function toEqualRanges(expectedRanges) {
    const { actual } = this
    const expected = parseRanges(expectedRanges)
    if (!Array.isArray(expected)) {
      this.message = () =>
        `Expected value must be an array (received: ${typeof expected})`
      return false
    }
    if (!Array.isArray(actual)) {
      this.message = () =>
        `Actual value must be an array (received: ${typeof expected})`
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

export const addRangeMatchers = createAddRangeMatchers()

function toMatchRanges(expected, code, cursorLoc, locator) {
  const { actual } = this
  if (!actual) {
    this.message = () => 'Expected result to be defined'
    return false
  }

  const expectedSpec = new CodeSpec('Expected')
  const actualSpec = new CodeSpec('Actual')
  const remainingActuals = [...actual]
  let pass = true
  expected.forEach(expectedItem => {
    const expectedRange = expectedItem.range ? expectedItem.range : expectedItem
    const expectedType = expectedItem.range ? expectedItem.type : null
    const typeDesc = (expectedType && `${expectedType}:`) || ''
    const { start, end } = expectedRange
    expectedSpec.mark(`_${typeDesc}`, locator.getLoc(start))
    expectedSpec.mark('_', locator.getLoc(end))
    const actIndex = remainingActuals.findIndex(
      expectedRange.isEqual.bind(expectedRange)
    )
    if (~actIndex) {
      const [act] = remainingActuals.splice(actIndex, 1)
      const { start: s, end: e, type } = act
      if (expectedType && expectedType !== type) {
        pass = false
        actualSpec.mark(`_❗${type}:`, locator.getLoc(s))
        actualSpec.mark('_', locator.getLoc(e))
      } else {
        actualSpec.mark('_', locator.getLoc(s))
        actualSpec.mark('_', locator.getLoc(e))
      }
    } else {
      pass = false
      actualSpec.mark('✘', locator.getLoc(start))
      // actualSpec.mark('✘', locator.getLoc(end))
    }
  }, true)

  if (remainingActuals.length > 0) {
    pass = false
    remainingActuals.forEach(({ start, end, type }) => {
      actualSpec.mark(`✚${type}:`, locator.getLoc(start))
      actualSpec.mark('✚', locator.getLoc(end))
    })
  }

  this.message = () =>
    formatRow(
      expectedSpec.format(code, cursorLoc),
      actualSpec.format(code, cursorLoc)
    ) + '\n'

  return pass
}

const autoCursor = parts => {
  const hasOnlyPipes = parts.every(part => !part.includes('§'))
  if (hasOnlyPipes) {
    return '|'
  } else {
    return '§'
  }
}

// cursor: null -> smart cursor: if only pipes |, use | else use §. Allows to
// use pipes in most case (more legible), but fallback on § when needed.
export const FindsRefsTest = ({ parse, findReferences, cursor = null }) => {
  const describeRefs = (title, cur = cursor, dc = describe) => (
    parts,
    ...descs
  ) => {
    if (cur === null) {
      cur = autoCursor(parts)
    }
    dc(title, () => {
      const regex = new RegExp(`_([^_]*${'\\' + cur}[^_]*)_|${'\\' + cur}`, 'g')
      let code = dedent(parts.join(''))
      const assertions = []
      let expected = []
      {
        let i = 1
        let pullLeft = 0
        code = code.replace(
          // /_([^_]*|[^_]*)_/g,
          regex,
          (match, spec, originalOffset) => {
            const offset = originalOffset - pullLeft
            const descSpec = descs[assertions.length]
            const desc = descSpec ? `finds ${descSpec}` : String(i++)
            if (match === cur) {
              pullLeft += match.length
              assertions.push({
                loc: offset,
                desc,
              })
              return ''
            }
            const nameOffset = spec.indexOf(cur)
            if (~nameOffset) {
              assertions.push({
                loc: offset + spec.indexOf(cur),
                desc,
              })
            }
            const name = spec.replace(cur, '')
            const from = offset
            const to = offset + name.length
            const typeMatch =
              descSpec && /^(ref|mut|decl|defimp|namimp):/.exec(descSpec)
            const type = typeMatch && typeMatch[1]
            expected.push([from, to, type])
            pullLeft += match.length - name.length
            return name
          }
        )
      }
      const locator = createLocator(code)
      expected = expected.map(([from, to, type]) => ({
        range: locator.getRange(from, to),
        type,
      }))
      // -- Run test --
      // parse
      const result = parse({ code })
      const ast = result.ast
      const error = result.error
      // assertions
      assertions.forEach(({ loc, desc }) => {
        it(desc, () => {
          if (error) {
            throw error
          }
          const ranges = findReferences(ast, loc, { locator })
          expect(ranges).toMatchRanges(expected, code, loc, locator)
        })
      })
    })
  }

  const xdescribeRefs = (title, cursor) =>
    describeRefs(title, cursor, xdescribe)

  const fdescribeRefs = (title, cursor) =>
    describeRefs(title, cursor, fdescribe)

  return { describeRefs, xdescribeRefs, fdescribeRefs }
}

'use babel'

import { Point, Range } from 'atom'

const or = (a, b) => (typeof a === 'undefined' ? b : a)

export const createLocator = text => {
  const nl = /\r\n|\n|\r/g
  const lineLocs = [0]
  while (nl.exec(text)) {
    lineLocs.push(nl.lastIndex)
  }

  const getLoc = ({ column: col, row, line }) => lineLocs[or(row, line)] + col

  const getPoint = loc => {
    if (loc > text.length || loc < 0) {
      throw new Error(`Loc (${loc}) outside of text (${text.length})`, loc)
    }
    const isRowLoc = (x, i, X) => X[i + 1] > loc
    let line = lineLocs.findIndex(isRowLoc)
    if (line === -1) {
      line = lineLocs.length - 1
    }
    const lineLoc = lineLocs[line]
    return new Point(line, loc - lineLoc)
  }

  const getRange = (start, end) => {
    return new Range(getPoint(start), getPoint(end))
  }

  return Object.assign(getLoc, { getLoc, getPoint, getRange })
}

export const locToRange = ({ start, end }) =>
  new Range([start.line - 1, start.column], [end.line - 1, end.column])

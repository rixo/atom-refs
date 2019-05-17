'use babel'

import { Range } from 'atom'

const or = (a, b) => (typeof a === 'undefined' ? b : a)

export const createLocator = text => {
  const nl = /\r\n|\n|\r/g
  const loc = [0]
  while (nl.exec(text)) {
    loc.push(nl.lastIndex)
  }
  return ({ column: col, row, line }) => loc[or(row, line)] + col
}

export const locToRange = ({ start, end }) =>
  new Range([start.line - 1, start.column], [end.line - 1, end.column])

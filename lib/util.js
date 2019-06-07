'use babel'

import { Range } from 'atom'

export { default as createLocator } from './locator'

export const locToRange = ({ start, end }) =>
  new Range([start.line - 1, start.column], [end.line - 1, end.column])

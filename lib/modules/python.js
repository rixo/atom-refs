'use babel'

import { lazy } from './util'

export const scopes = ['source.python']

// Module initialization code is kept minimal in order to reduct loading
// time impact. The actual implementations and, above all, their deps
// will only be required/loaded when the module's language is actually
// used.
export const parse = lazy(() => require('./python/parse'))
export const findReferences = lazy(() => require('./python/find-references'))

export default {
  scopes,
  parse,
  findReferences,
}

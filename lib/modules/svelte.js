'use babel'

import { lazy } from './util'

export const scopes = ['source.svelte']

// Module initialization code is kept minimal in order to reduct loading
// time impact. The actual implementations and, above all, their deps
// will only be required/loaded when the module's language is actually
// used.
export const parse = lazy(() => require('./svelte/parse').default)
export const findReferences = lazy(() => require('./svelte/find-references'))

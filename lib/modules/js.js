'use babel'

import { lazy } from './util'

export const scopes = [
  'source.js',
  'source.js.jsx',
  'source.babel',
  'text.html.basic',
  'text.html.vue',
  'source.svelte',
]

export const parse = lazy(() => require('./js/parse'))
export const findReferences = lazy(() => require('./js/find-references'))

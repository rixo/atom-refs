'use babel'

import babel from './hyperclick-lang-babel'
// import svelte from './hyperclick-lang-svelte'

import { getSuggestion } from './util-provider'
// import php from './hyperclick-lang-php'
import python from './hyperclick-lang-python'
// import ts from './hyperclick-lang-ts'
// import svelte from './hyperclick-lang-svelte-ide'

// const langs = [babel, svelte]
const langs = [babel]

const providedLangs = [
  ['source.tsx', 'source.ts'],
  ['text.html.php'],
  python,
  'source.svelte',
].map(spec => {
  if (typeof spec === 'string') {
    return { scopes: [spec], getSuggestion }
  } else if (Array.isArray(spec)) {
    return { scopes: spec, getSuggestion }
  } else {
    return { getSuggestion, ...spec }
  }
})

const hasScope = scopeName => ({ scopes }) => scopes.includes(scopeName)

export const resolveScopeLang = scope => langs.find(hasScope(scope))

export const resolveProvidedLang = editor =>
  providedLangs.find(hasScope(editor.getGrammar().scopeName))

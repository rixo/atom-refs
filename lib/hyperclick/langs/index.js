'use babel'

import { createProvidedLang } from './create-lang'

import babel from './hyperclick-lang-babel'
// import svelte from './hyperclick-lang-svelte'

// import php from './hyperclick-lang-php'
// import python from './hyperclick-lang-python'

const langs = [babel]

const providedLangs = [
  createProvidedLang('source.ts'),
  createProvidedLang('source.tsx'),
  createProvidedLang('source.svelte'),
  createProvidedLang('text.html.php'),
  createProvidedLang('source.python'),
]

const hasScope = scopeName => ({ scopes }) => scopes.includes(scopeName)

export const resolveScopeLang = scope => langs.find(hasScope(scope))

export const resolveProvidedLang = editor =>
  providedLangs.find(hasScope(editor.getGrammar().scopeName))

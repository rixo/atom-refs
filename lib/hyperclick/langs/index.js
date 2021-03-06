'use babel'

import babel from './hyperclick-lang-babel'
import svelte from './hyperclick-lang-svelte'

import php from './hyperclick-lang-php'

const langs = [babel, svelte]

const providedLangs = [php]

const hasScope = scopeName => ({ scopes }) => scopes.includes(scopeName)

export const resolveScopeLang = scope => langs.find(hasScope(scope))

export const resolveProvidedLang = editor =>
  providedLangs.find(hasScope(editor.getGrammar().scopeName))

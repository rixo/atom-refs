'use babel'

import babel from './hyperclick-lang-babel'
import svelte from './hyperclick-lang-svelte'

const langs = [babel, svelte]

export const resolveScopeLang = scopeName =>
  langs.find(({ scopes }) => scopes.includes(scopeName))

'use babel'

import babel from './hyperclick-lang-babel'
import svelte from './hyperclick-lang-svelte'

const langs = [babel, svelte]

const isScope = (textEditor, scopes) => {
  const { scopeName } = textEditor.getGrammar()
  if (scopes.indexOf(scopeName) >= 0) {
    return true
  }
  return false
}

const resolveLang = editor =>
  langs.find(({ scopes }) => isScope(editor, scopes))

export default resolveLang

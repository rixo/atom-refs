'use babel'

import Debug from 'debug'

import { findReferences as findSvelteReferences } from '../modules/svelte'
import { findReferences as findJsReferences } from '../modules/js-find-occurrences'

import buildSuggestion from './build-suggestion'

const debug = Debug('atom-ref')

const isScope = (textEditor, scopes) => {
  const { scopeName } = textEditor.getGrammar()

  if (scopes.indexOf(scopeName) >= 0) {
    return true
  }
  debug('Not Svelte', scopeName)
  return false
}

const svelteScopes = ['source.svelte']
const isSvelte = textEditor => isScope(textEditor, svelteScopes)

const jsScopes = ['source.js', 'source.js.jsx', 'javascript', 'source.flow']
const isJavascript = textEditor => isScope(textEditor, jsScopes)

export default state => () => ({
  providerName: 'atom-ref',
  priority: 2, // before js-hyperclick (0) and link-hyperclick (1)
  wordRegExp: /[$0-9\w]+/g,
  getSuggestionForWord(textEditor, text, range) {
    const findReferences =
      (isSvelte(textEditor) && findSvelteReferences) ||
      (isJavascript(textEditor) && findJsReferences)
    if (findReferences) {
      if (state.parseError) return

      const buffer = textEditor.getBuffer()
      const start = buffer.characterIndexForPosition(range.start)
      const end = buffer.characterIndexForPosition(range.end)

      const options = {
        jumpToImport: atom.config.get('js-hyperclick.jumpToImport'),
        findReferences,
      }
      const result = buildSuggestion(state, text, { start, end }, options)
      debug(text, result)
      if (result) {
        return result
        // return buildResult(textEditor, range, suggestion, false)
      }
    }
  },
})

'use babel'

import Debug from 'debug'

import { findReferences as findSvelteReferences } from '../modules/svelte'
import { findReferences as findJsReferences } from '../modules/js/find-references'

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

const createHyperclickProvider = state => () => ({
  providerName: 'atom-ref',
  priority: 2, // before js-hyperclick (0) and link-hyperclick (1)
  // wordRegExp: /[$0-9\w]+/g,
  getSuggestion(textEditor, pos) {
    const findReferences =
      (isSvelte(textEditor) && findSvelteReferences) ||
      (isJavascript(textEditor) && findJsReferences)
    if (findReferences) {
      if (state.parseError) return
      const options = {
        // FIXME: not our config!
        jumpToImport: atom.config.get('js-hyperclick.jumpToImport'),
        findReferences,
      }
      const result = buildSuggestion(state, pos, options)
      if (result) {
        return result
        // return buildResult(textEditor, range, suggestion, false)
      }
    }
  },
})

export default createHyperclickProvider

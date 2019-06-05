'use babel'

import buildJump from './build-jump'
import { navigateTo } from './navigate'
import { initCache, getCached } from './cache'

function buildSuggestion(editor, jump) {
  if (jump) {
    return {
      range: jump.range,
      callback: () => navigateTo(editor, jump),
    }
  }
}

const createHyperclickProvider = state => () => {
  initCache(state.subscriptions)

  return {
    providerName: 'atom-ref',
    priority: 2, // before js-hyperclick (0) and link-hyperclick (1)
    // wordRegExp: /[$0-9\w]+/g,
    getSuggestion(editor, point) {
      if (state.parseError) return

      const info = getCached(editor)

      const jump = buildJump(info, point)

      if (jump) {
        return buildSuggestion(editor, jump)
      }
    },
  }
}

export default createHyperclickProvider

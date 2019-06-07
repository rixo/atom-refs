'use babel'

import { getEntry } from '../cache'

import buildJump from './build-jump'
import { navigateTo } from './navigate'

function buildSuggestion(editor, jump) {
  if (jump) {
    return {
      range: jump.range,
      callback: () => navigateTo(editor, jump),
    }
  }
}

const createHyperclickProvider = () => () => {
  return {
    providerName: 'atom-refs',
    priority: 2, // before js-hyperclick (0) and link-hyperclick (1)
    getSuggestion(editor, point) {
      const info = getEntry(editor).getJumpContext()
      const jump = buildJump(info, point)
      if (jump) {
        return buildSuggestion(editor, jump)
      }
    },
  }
}

export default createHyperclickProvider

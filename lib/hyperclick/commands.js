'use babel'

import { getEntry } from '../cache'

import { resolveProvidedLang } from './langs'
import buildJump from './build-jump'
import { navigateTo } from './navigate'

const jumpWithOptions = options => state => () => {
  const { editor, history } = state
  // heuristic: take first if multiple cursor
  const cursor = editor.getCursors()[0]
  // guard: no cursor (wtf?)
  if (!cursor) return
  const fromPoint = cursor.getBufferPosition()
  const providedLang = resolveProvidedLang(editor)
  if (providedLang) {
    providedLang.getSuggestion(editor, fromPoint, options).then(suggestion => {
      if (suggestion) {
        if (history) history.add(editor, 'atom-refs:jump')
        suggestion.callback()
      }
    })
  } else {
    const context = getEntry(editor).getJumpContext()
    const jump = buildJump(context, fromPoint, options)
    // guard: found no jump
    if (!jump) return
    if (history) history.add(editor, 'atom-refs:jump')
    navigateTo(editor, jump)
  }
}

export default {
  'jump-to-local-definition': jumpWithOptions({ jumpToImport: true }),
  'jump-to-final-definition': jumpWithOptions({
    jumpToImport: false,
    skipIntermediate: true,
  }),
}

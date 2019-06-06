'use babel'

import { getEntry } from '../cache'

import buildJump from './build-jump'
import { navigateTo } from './navigate'

const jumpWithOptions = options => state => () => {
  const { editor } = state
  // heuristic: take first if multiple cursor
  const cursor = editor.getCursors()[0]
  // guard: no cursor (wtf?)
  if (!cursor) return
  const formPoint = cursor.getBufferPosition()
  const context = getEntry(editor).getJumpContext()
  const jump = buildJump(context, formPoint, options)
  // guard: found no jump
  if (!jump) return
  navigateTo(editor, jump)
}

export default {
  'jump-to-local': jumpWithOptions({ jumpToImport: true }),
  'jump-to-final': jumpWithOptions({
    jumpToImport: false,
    skipIntermediate: true,
  }),
}

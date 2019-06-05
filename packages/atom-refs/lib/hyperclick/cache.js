'use babel'

import resolveLang from './langs'

const editors = new WeakMap()
const data = new WeakMap()

let subscriptions

function watchEditor(editor) {
  if (!editors.has(editor)) {
    editors.set(editor, null)
    subscriptions.add(
      editor.onDidStopChanging(() => {
        data.delete(editor)
      })
    )
  }
}

export function initCache(_subscriptions) {
  subscriptions = _subscriptions
}

function parseInfo(editor) {
  const { createJumpContext } = resolveLang(editor)
  const code = editor.getText()
  return createJumpContext(code, editor)
}

export function getCached(editor) {
  if (!subscriptions) {
    throw new Error('Cache must be initialized')
  }
  watchEditor(editor)
  if (!data.has(editor)) {
    const info = parseInfo(editor)
    data.set(editor, info)
  }
  return data.get(editor)
}

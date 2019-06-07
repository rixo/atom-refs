'use babel'

import jumpCommands from './hyperclick/commands'

const select = state => () => {
  const { editor, ranges, vim } = state
  if (!editor || !ranges) {
    return
  }
  if (vim && atom.config.get('atom-refs.preferVimSelection')) {
    const editorState = vim.getEditorState(editor)
    const pm = editorState && editorState.persistentSelection
    pm.clearMarkers()
    ranges.forEach(range => pm.markBufferRange(range))
  } else {
    editor.setSelectedBufferRanges(ranges)
  }
}
select.scope = 'atom-text-editor'

const next = state => () => {
  const {
    ranges,
    editor,
    refs: { locator },
  } = state
  if (!ranges || !ranges.length || !editor || !locator) {
    return
  }
  editor.getCursors().forEach(cursor => {
    const currentIndex = findCurrentIndex(state, cursor)
    const nextIndex = (currentIndex + 1) % ranges.length
    const nextRange = ranges[nextIndex]
    const currentRange = ranges[currentIndex]
    const nextStart = nextRange.start
    if (currentRange) {
      const bufferPosition = cursor.getBufferPosition()
      const currentStart = currentRange.start
      const deltaRow = bufferPosition.row - currentStart.row
      const deltaCol =
        deltaRow === 0 ? bufferPosition.column - currentStart.column : 0
      const nextRow = nextStart.row + deltaRow
      const nextCol = nextStart.column + deltaCol
      cursor.setBufferPosition([nextRow, nextCol])
    } else {
      cursor.setBufferPosition(nextStart)
    }
  })
}
next.scope = 'atom-text-editor'

const previous = state => () => {
  const {
    ranges,
    editor,
    refs: { locator },
  } = state
  if (!ranges || !ranges.length || !editor || !locator) {
    return
  }
  editor.getCursors().forEach(cursor => {
    const curIndex = findCurrentIndex(state, cursor)
    const prevIndex = (curIndex + ranges.length - 1) % ranges.length
    const toRange = ranges[prevIndex]
    const curRange = ranges[curIndex]
    const toStart = toRange.start
    if (curRange) {
      const bufferPosition = cursor.getBufferPosition()
      const curStart = curRange.start
      const deltaRow = bufferPosition.row - curStart.row
      const deltaCol =
        deltaRow === 0 ? bufferPosition.column - curStart.column : 0
      const prevRow = toStart.row + deltaRow
      const prevCol = toStart.column + deltaCol
      cursor.setBufferPosition([prevRow, prevCol])
    } else {
      cursor.setBufferPosition(toStart)
    }
  })
}
previous.scope = 'atom-text-editor'

const findCurrentIndex = ({ ranges, refs: { locator } }, cursor) => {
  const bufferPosition = cursor.getBufferPosition()
  const pos = locator(bufferPosition)
  return ranges.findIndex(
    ({ start, end }) => pos >= locator(start) && pos <= locator(end)
  )
}

export default {
  select,
  next,
  previous,
  ...jumpCommands,
}

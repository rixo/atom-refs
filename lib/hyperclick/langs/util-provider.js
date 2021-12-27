'use babel'

import {
  getFindReferencesForEditor,
  getDefinitionsForScope,
} from '../../services'
import byFirstRange from '../../modules/util/byFirstRange'

const calcOffset = (range, offset) =>
  // NOTE Svelte LS incorrectly sends 0,1 (instead of 0,0) when it doesn't know
  range.start.row === 0 && range.start.column === 1
    ? 0
    : Math.min(range.start.column + offset, range.end.column - 1)

const wrapDefinition = (
  editor,
  { range, path, position: { row, column } },
  offset
) => ({
  range,
  callback() {
    const offsetColumn = calcOffset(range, offset)
    if (editor.getPath() === path) {
      const paneContainer = atom.workspace.paneContainerForItem(editor)
      paneContainer.activate()
      editor.setCursorBufferPosition([row, offsetColumn])
      editor.scrollToBufferPosition([row, offsetColumn], { center: true })
    } else {
      atom.workspace
        .open(path, {
          initialLine: row,
          initialColumn: offsetColumn,
          searchAllPanes: true,
          activatePane: true,
          activateItem: true,
        })
        .catch(err => {
          // eslint-disable-next-line no-console
          console.error('Failed to open editor', err)
        })
    }
  },
})

const wrapRange = (editor, range, offset) => ({
  range,
  callback() {
    const paneContainer = atom.workspace.paneContainerForItem(editor)
    paneContainer.activate()

    const { row, column } = range.start
    const offsetColumn = calcOffset(range, offset)
    editor.setCursorBufferPosition([row, offsetColumn])
    editor.scrollToBufferPosition([row, offsetColumn], { center: true })
  },
})

const findLocalReferences = async (editor, point) => {
  const refProvider = getFindReferencesForEditor(editor)
  if (!refProvider || !refProvider.findReferences) {
    return []
  }
  const references = await refProvider.findReferences(editor, point)
  if (!references) {
    return []
  }
  const editorPath = editor.getPath()
  const localRanges = references.references
    .filter(x => x.uri === editorPath)
    .map(({ range }) => range)
    .sort(byFirstRange)
  return localRanges
}

const rangeContainsPoint = point => ({ start, end }) =>
  start.isLessThanOrEqual(point) && end.isGreaterThanOrEqual(point)

const getOffset = (from, to) => {
  if (from.row !== to.row) return 0
  if (from.column >= to.column) return 0
  return to.column - from.column
}

const last = arr => arr[arr.length - 1]

const first = arr => arr[0]

const hasRange = ({ range }) => !!range

const lastWithRange = defs => last(defs.filter(hasRange))

const firstWithRange = defs => defs.find(hasRange)

const notZeroLength = ({ range: { start, end } = {} }) =>
  start && end && (start.row !== end.row || start.column !== end.column)

export async function getSuggestion(
  editor,
  point,
  { jumpToImport = atom.config.get('atom-refs.jumpToImport') } = {}
) {
  const scope = editor.getGrammar().scopeName
  const editorPath = editor.getPath()

  const defProvider = getDefinitionsForScope(scope)
  if (!defProvider) {
    return
  }

  const localReferences = (await findLocalReferences(editor, point)) || []

  const containsTarget = rangeContainsPoint(point)

  const origin = localReferences.find(containsTarget)
  const offset = origin ? getOffset(origin.start, point) : 0

  const result = await defProvider.getDefinition(editor, point)

  const rawDefs = (definitions = result && result.definitions)

  let definitions =
    // Svelte LS currently sends "ghost" definitions (in generated code)
    result.definitions.filter(notZeroLength)

  // if we have only zero length defs, let's do with that...
  if (definitions.length < 1 && rawDefs.length > 0) {
    definitions = rawDefs
  }

  // NOTE last refs are generally better (more "deep" / closer to the origin)
  definitions.reverse()

  if (definitions) {
    if (jumpToImport) {
      const localDef = definitions.find(
        ({ path, range }) => editorPath === path && range
      )
      if (localDef) {
        if (containsTarget(localDef.range)) return null
        return wrapDefinition(editor, localDef, offset)
      }
    } else if (definitions.length > 0) {
      const targetDef = firstWithRange(definitions)
      if (!targetDef) return null
      return wrapDefinition(editor, definitions[0], offset)
    }
  }

  // first: topmost ref
  const firstLocalRef = first(localReferences.sort(byFirstRange))
  if (firstLocalRef) {
    if (firstLocalRef === origin) {
      return null
    }
    return wrapRange(editor, firstLocalRef, offset)
  }
}

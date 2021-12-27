'use babel'

import { Debug } from './config'
import { getFindReferencesForEditor, getDefinitionsForEditor } from './services'
import byFirstRange from './modules/util/byFirstRange'

const debug = Debug('refs')

const customCursorChangeThrottle = {
  'source.python': 500,
}

// `this` bound to cache entry item
export function parseRefsContext(refsModule, code) {
  debug('parseRefsContext')

  const scopeName = this.getScope()

  if (!refsModule) {
    debug('parseRefsContext: unsupported scope', scopeName)
    return { unsupportedScope: scopeName }
  }

  const { error: parseError, ...parsed } = refsModule.parse({ code, scopeName })

  if (parseError) {
    return { parseError }
  }

  const locator = parsed.locator || this.getLocator()

  const findReferencesAt = pos =>
    refsModule.findReferences(this.getAst().ast, pos, { locator })

  const findReferences = point => findReferencesAt(locator.getPos(point))

  return { findReferences }
}

const isSingleLine = ({ range }) => range.start.row === range.end.row

const isNonZero = ({ range }) =>
  range.start.row !== range.end.row || range.start.column !== range.end.column

export function getProviderFindReferences(editor) {
  const refProvider = getFindReferencesForEditor(editor)
  const defProvider = getDefinitionsForEditor(editor)

  if (!refProvider || !refProvider.findReferences) {
    return null
  }

  const editorPath = editor.getPath()

  const findReferences = async point => {
    const refPromises = refProvider.findReferences(editor, point)
    const [references, definition] = await Promise.all([
      refPromises,
      defProvider && defProvider.getDefinition(editor, point),
    ])

    if (!references) return []
    let ranges = references.references
      .filter(x => x.uri === editorPath)
      .filter(isNonZero)
      .filter(isSingleLine)
      .map(({ range }) => ({
        ...range,
        type: 'ref',
      }))

    const { definitions } = definition || {}
    if (definitions) {
      const isCurrentEditor = ({ path, range }) => editorPath === path && range

      definitions
        .filter(isCurrentEditor)
        .filter(isNonZero)
        .filter(isSingleLine)
        // .forEach(({ id, range }) => {
        //   const idRange = id ? id.range : range
        //   const refRange = ranges.find(ref => !idRange.isEqual(ref))
        //   refRange.type = 'decl'
        // })
        .forEach(({ id, range }) => {
          const idRange = id ? id.range : range
          ranges = ranges.filter(ref => !idRange.isEqual(ref))
          ranges.push({ ...idRange, type: 'decl' })
        })
    }

    ranges.sort(byFirstRange)

    return ranges
  }

  const scope = editor.getGrammar().scopeName
  const cursorChangeThrottle = customCursorChangeThrottle[scope]

  return {
    findReferences,
    cursorChangeThrottle
  }
}

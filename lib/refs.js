'use babel'

import { Debug } from './config'
import { getFindReferencesForEditor, getDefinitionsForEditor } from './services'
import byFirstRange from './modules/util/byFirstRange'

const debug = Debug('refs')

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

export function getProviderFindReferences(editor) {
  const refProvider = getFindReferencesForEditor(editor)
  const defProvider = getDefinitionsForEditor(editor)
  if (!refProvider || !refProvider.findReferences) {
    return null
  }
  const findReferences = point => {
    const refPromise = refProvider.findReferences(editor, point)
    const defPromise =
      (defProvider && defProvider.getDefinition(editor, point)) || null
    const allPromise = Promise.all([refPromise, defPromise])
    return allPromise.then(([references, definition]) => {
      if (!references) return []
      const editorPath = editor.getPath()

      const ranges = references.references
        .filter(({ uri, range }) => {
          return editorPath === uri && range
        })
        .map(({ range }) => ({
          ...range,
          type: 'ref',
        }))

      const { definitions } = definition || {}
      if (definitions) {
        definitions
          .filter(({ path, id, range }) => editorPath === path && id && range)
          .forEach(({ id: { range } }) => {
            ranges.push({ ...range, type: 'decl' })
          })
      }
      return ranges.sort(byFirstRange)
    })
  }
  return {
    findReferences,
  }
}

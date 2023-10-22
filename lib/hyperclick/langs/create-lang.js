'use babel'

import { createLocator } from '../../util'
import {
  getDefinitionsForScope,
  getFindReferencesForEditor,
} from '../../services'

export default ({ scopes, parseAst, parseInfo, findReferences }) => {
  const createJumpContext = (code, scope) => {
    try {
      const { ast, error: parseError } = parseAst(code, scope)
      if (parseError) {
        return { type: 'parse-error', parseError, lang: 'svelte' }
      }
      const locator = createLocator(code)
      const { getPos, getPoint } = locator
      const findReferencesAt = pos => findReferences(ast, pos, { locator })
      try {
        return {
          ...parseInfo(ast),
          getPos,
          pointToPos: getPos,
          posToPoint: getPoint,
          findReferencesAt,
        }
      } catch (parseError) {
        return { type: 'parse-info-error', parseError, lang: 'svelte' }
      }
    } catch (parseError) {
      return { type: 'parse-error', parseError, lang: 'svelte' }
    }
  }

  return { scopes, createJumpContext }
}

export const createProvidedLang = scopes => {
  async function getSuggestion(
    editor,
    point,
    options = atom.config.get('atom-refs')
  ) {
    const { jumpToImport } = options

    let foundRef

    const refProvider = getFindReferencesForEditor(editor)
    const references = await refProvider.findReferences(editor, point)
    const editorPath = editor.getPath()
    const localReferences = references.references.filter(
      ({ uri, range }) => editorPath === uri && range
    )

    let offset = 0
    let origin
    try {
      const { getPos } = createLocator(editor.getText())
      const pos = getPos(point)
      const inAtomRange = ({ range: { start, end } }) => {
        return getPos(start) <= pos && pos < getPos(end)
      }
      origin = localReferences.find(inAtomRange)
      if (origin) {
        offset = pos - getPos(origin.range.start)
      }
    } catch (err) {
      console.error('[atom-refs:hyperclick] Failed to find origin', err)
    }

    if (jumpToImport) {
      const [firstRef] = localReferences.sort(
        (a, b) => a.range.start - b.range.start
      )
      if (firstRef && firstRef !== origin) {
        foundRef = {
          range: firstRef.range,
          path: firstRef.uri,
          position: firstRef.range.start,
        }
      }
    }

    if (!foundRef) {
      const scope = editor.getGrammar().scopeName
      const provider = getDefinitionsForScope(scope)
      if (!provider) {
        return
      }
      const result = await provider.getDefinition(editor, point)
      const definitions = result && result.definitions
      if (!definitions || !definitions.length) {
        // too spammy
        // atom.notifications.addWarning('Definition not found')
        return
      }

      foundRef = definitions[0]
    }

    if (!foundRef) {
      return
    }

    const {
      range,
      path,
      position: { row, column },
    } = foundRef

    const targetColumn = row === 0 && column === 1 ? 0 : column + offset

    const callback = () => {
      const editor = atom.workspace.getActiveTextEditor()
      if (editor.getPath() === path) {
        const paneContainer = atom.workspace.paneContainerForItem(editor)
        paneContainer.activate()
        editor.setCursorBufferPosition([row, targetColumn])
        editor.scrollToBufferPosition([row, targetColumn], { center: true })
      } else {
        atom.workspace
          .open(path, {
            initialLine: row,
            initialColumn: targetColumn,
            searchAllPanes: true,
            activatePane: true,
            activateItem: true,
          })
          .catch(err => {
            // eslint-disable-next-line no-console
            console.error('Failed to open editor', err)
          })
      }
    }
    return { range, callback }
  }

  return { scopes, getSuggestion }
}

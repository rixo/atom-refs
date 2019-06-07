'use babel'

import { createLocator } from '../../util'

export default ({ scopes, parseAst, parseInfo, findReferences }) => {
  const createJumpContext = (code, editor) => {
    try {
      const { ast, error: parseError } = parseAst(code, editor) // TODO remove dep on editor
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

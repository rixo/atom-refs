'use babel'

import { Debug } from './config'

const debug = Debug('refs')

// `this` bound to cache entry item
export function parseRefsContext(refsModule, code) {
  debug('parseRefsContext')

  const scopeName = this.getScope()

  if (!refsModule) {
    debug('parseRefsContext: unsupported scope', scopeName)
    return { unsupportedScope: scopeName }
  }

  // { ast, parseError }
  const { error: parseError, ...parsed } = refsModule.parse({ code, scopeName })

  const locator = parsed.locator || this.getLocator()

  const findReferencesAt = pos =>
    refsModule.findReferences(this.getAst().ast, pos, {
      locator: this.getLocator(),
    })

  return {
    ...parsed,
    parseError,
    locator,
    pointToPos: locator.getPos,
    posToPoint: locator.getPoint,
    findReferencesAt,
  }
}

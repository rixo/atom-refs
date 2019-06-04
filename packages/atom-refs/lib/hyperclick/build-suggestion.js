'use babel'

import { Range } from 'atom'

const navigateToPosition = ({ editor }, position) => {
  editor.setCursorBufferPosition(position)
  editor.scrollToCursorPosition()
}

export default function buildSuggestion(
  state,
  text,
  { start, end },
  { findReferences }
) {
  if (state.parseError) throw state.parseError
  // const { paths, scopes, externalModules } = state
  const { ast, locator } = state

  const references = findReferences(ast, start, { locator })

  const declarations = references.filter(
    ({ type }) => type === 'decl' || type === 'namimp' || type === 'defimp'
  )

  const firstDecl = declarations[0]

  if (firstDecl) {
    const origin = references.find(({ start: point }) => {
      const pos = locator.getPos(point)
      return pos >= start && pos < end
    })

    if (origin) {
      // debugger
    }

    const range = new Range(
      locator.getPos(firstDecl.start),
      locator.getPos(firstDecl.end)
    )
    const callback = () => {
      navigateToPosition(state, firstDecl.start)
    }
    return { range, callback }
  }

  //   for (let i = 0; i < paths.length; i++) {
  //     const path = paths[i]
  //     if (path.range.start > end) {
  //       break
  //     }
  //     if (path.range.start <= start && path.range.end >= end) {
  //       if (path.imported !== "default") {
  //         return {
  //           type: "from-import",
  //           imported: path.imported,
  //           moduleName: path.moduleName,
  //           bindingStart: path.range.start,
  //           bindingEnd: path.range.end,
  //         }
  //       }
  //
  //       return {
  //         type: "path",
  //         imported: path.imported,
  //         moduleName: path.moduleName,
  //         range: path.range,
  //       }
  //     }
  //   }
  //
  //   const closestScope = findClosestScope(scopes, start, end)
  //   // Sometimes it reports it has a binding, but it can't actually get the
  //   // binding
  //   if (closestScope.hasBinding(text) && closestScope.getBinding(text)) {
  //     const binding = closestScope.getBinding(text)
  //     const { start: bindingStart, end: bindingEnd } = binding.identifier
  //
  //     const clickedDeclaration = bindingStart <= start && bindingEnd >= end
  //     const crossFiles = !options.jumpToImport
  //
  //     if (clickedDeclaration || crossFiles) {
  //       const targetModule = externalModules.find(m => {
  //         const { start: bindingStart } = binding.identifier
  //         return m.local == text && m.start == bindingStart
  //       })
  //
  //       if (targetModule) {
  //         return {
  //           type: "from-import",
  //           imported: targetModule.imported,
  //           moduleName: targetModule.moduleName,
  //           bindingStart,
  //           bindingEnd,
  //         }
  //       }
  //     }
  //
  //     // Exit early if you clicked on where the variable is declared
  //     if (clickedDeclaration) {
  //       return null
  //     }
  //
  //     return {
  //       type: "binding",
  //       start: bindingStart,
  //       end: bindingEnd,
  //     }
  //   }

  return null
}

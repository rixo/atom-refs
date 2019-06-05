'use babel'

import { Range } from 'atom'

const navigateToPosition = ({ editor }, position) => {
  editor.setCursorBufferPosition(position)
  editor.scrollToCursorPosition()
}

const isDeclaration = ({ type }) =>
  type === 'decl' || type === 'namimp' || type === 'defimp'

export default function buildSuggestion(
  state,
  point,
  { jumpToImport, findReferences }
) {
  if (state.parseError) throw state.parseError
  // const { paths, scopes, externalModules } = state
  const {
    ast,
    locator,
    locator: { getPos },
  } = state
  const pos = getPos(point)

  const references = findReferences(ast, pos, { locator })

  const declaration = references.find(isDeclaration)

  if (declaration) {
    const origin = references.find(({ start, end }) => {
      return getPos(start) <= pos && pos < getPos(end)
    })

    const range = new Range(getPos(declaration.start), getPos(declaration.end))
    const jumpTarget = declaration.start.copy()
    if (origin) {
      const offset = pos - getPos(origin.start)
      jumpTarget.column += offset
    }
    const callback = () => {
      navigateToPosition(state, jumpTarget)
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

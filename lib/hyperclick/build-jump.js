'use babel'

const isDeclaration = ({ type }) =>
  type === 'decl' || type === 'namimp' || type === 'defimp'

export default function buildJump(
  {
    parseError,
    unsupportedScope,
    paths,
    externalModules,
    findReferencesAt,
    getPos,
  },
  point,
  options = atom.config.get('atom-refs')
) {
  const { jumpToImport } = options
  if (parseError) {
    throw new Error('Previous parse error: ' + parseError.stack || parseError)
  }
  if (unsupportedScope) {
    return null
    // throw new Error('Unsupported scope: ' + unsupportedScope)
  }

  const pos = getPos(point)

  const inRange = ({ start, end }) => {
    return start <= pos && pos < end
  }

  const inAtomRange = ({ start, end }) => {
    return getPos(start) <= pos && pos < getPos(end)
  }

  for (let i = 0; i < paths.length; i++) {
    const path = paths[i]
    if (path.range.start > pos) {
      break
    }
    // if (path.range.start <= start && path.range.end >= end) {
    if (inRange(path.range)) {
      if (path.imported !== 'default') {
        return {
          type: 'from-import',
          imported: path.imported,
          moduleName: path.moduleName,
          bindingStart: path.range.start,
          bindingEnd: path.range.end,
          options,
        }
      }
      return {
        type: 'path',
        imported: path.imported,
        moduleName: path.moduleName,
        range: path.range,
        options,
      }
    }
  }

  const references = findReferencesAt(pos)

  const declaration = references.find(isDeclaration)

  if (!declaration) {
    return null
  }

  const clickedDeclaration = inAtomRange(declaration)

  const isCrossFiles = !jumpToImport

  if (clickedDeclaration || isCrossFiles) {
    const bindingStart = getPos(declaration.start)
    const bindingEnd = getPos(declaration.end)
    const bindingName = declaration.identifier.name
    const targetModule = externalModules.find(m => {
      return m.local == bindingName && m.start == bindingStart
    })
    if (targetModule) {
      return {
        type: 'from-import',
        imported: targetModule.imported,
        moduleName: targetModule.moduleName,
        bindingStart,
        bindingEnd,
        options,
      }
    }
  }

  // Exit condition for jump => auto jump loop
  if (clickedDeclaration) {
    return null
  }

  const origin = references.find(inAtomRange)
  const destination = declaration.start.copy()
  if (origin) {
    const offset = pos - getPos(origin.start)
    destination.column += offset
  }

  return {
    type: 'binding',
    destination,
    options,
  }
}

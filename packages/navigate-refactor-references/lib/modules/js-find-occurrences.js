'use babel'

import traverse from 'babel-traverse'
import {locToRange} from '../util'
import {debug} from '../config'

export const findReferences = (ast, loc) => {
  let binding
  try {
    binding = findBinding(ast, loc)
  } catch (err) {
    if (err.message === "Cannot read property 'file' of undefined") {
      // ignore this one...seems like a bug in babylon when there are duplicated
      // const variables
    } else {
      throw err
    }
  }

  if (!binding) {
    debug('Not found')
    return []
  }

  debug('Found', binding)

  return gatherRanges(binding)
}

const gatherRanges = binding => {
  let ranges
  let refPaths
  if (binding.isGlobal) {
    ranges = []
    refPaths = binding.referencePaths
  } else {
    ranges = [getDeclRange(binding)]
    refPaths = binding.referencePaths
      // filter ObjectPattern
      .filter((p) => p.node !== binding.identifier)
      // filter undefined for ImportDefault
      .filter((p) => p)
      // filter exports
      .filter((p) => !p.isExportDeclaration())
  }

  ranges = ranges.concat(refPaths.map(p => {
    const range = locToRange(p.node.loc)
    range.type = 'ref'
    if (p.parentPath.isObjectProperty()) {
      const { key, shorthand } = p.parentPath.node
      range.shorthand = shorthand
      if (!shorthand) {
        range.key = locToRange(key.loc)
      }
      range.delimiter = ': '
    }
    return range
  }))

  // global doesn't has constantViolations
  if (binding.constantViolations) {
    ranges = ranges.concat(binding.constantViolations.map(p => {
      const node = p.node.left || p.node
      const range = locToRange(node.loc)
      range.type = 'mut'
      return range
    }))
  }

  ranges.sort((
    {start: {column: ca, row: ra}},
    {start: {column: cb, row: rb}}
  ) => {
    if (ra < rb) {
      return -1
    } else if (ra > rb) {
      return 1
    } else {
      return ca - cb
    }
  })

  return ranges
}

const getDeclRange = binding => {
  const {path, identifier} = binding
  let range
  if (path.isImportSpecifier()) {
    const {imported, local} = path.node
    range = locToRange(local.loc)
    range.shorthand = local.start === imported.start
    if (!range.shorthand) {
      range.key = locToRange(imported.loc)
    }
    range.delimiter = ' as '
  } else if (path.isPattern()) {
    range = locToRange({
      start: identifier.loc.start,
      end: identifier.loc.end,
    })
  } else if (identifier.typeAnnotation) {
    range = locToRange({
      start: identifier.loc.start,
      end: identifier.typeAnnotation.loc.start,
    })
  } else {
    range = locToRange(identifier.loc)
  }
  range.type = 'decl'
  return range
}

const findBinding = (ast, loc) => {
  if (!ast) {
    throw new Error('AST required')
  }
  const touches = path => {
    const {start, end} = path.node
    if (end < loc) {
      path.skip()
    } else if (start > loc) {
      path.stop()
    } else {
      return true
    }
  }
  const isNode = node => ({node: ref}) => ref === node
  const isLeftNode = node => ({node: {left: ref}}) => ref === node
  // https://github.com/thejameskyle/babel-handbook/blob/master/translations/en/plugin-handbook.md
  const onIdentififer = path => {
    if (touches(path)) {
      const {scope, node, node: {name}} = path
      if (!name) {
        return
      }
      const scopeBinding = scope.getBinding(name)
      if (
        scopeBinding && (
          scopeBinding.identifier === node
          || scopeBinding.referencePaths.some(isNode(node))
          // || scopeBinding.constantViolations.some(({node: {left: ref}}) => ref === node)
          || scopeBinding.constantViolations.some(isLeftNode(node))
        )
      ) {
        binding = scopeBinding
        path.stop()
      } else if (scope.globals[name]) {
        // global, no binding: gather global references
        binding = gatherGlobalBindings(ast, path)
        path.stop()
      }
    }
  }
  const visitor = {
    // enter(path) {
    //   if (touches(path)) {
    //     const {scope, node, node: {name}} = path
    //     if (!name) {
    //       return
    //     }
    //     debugger
    //   }
    // },
    JSXIdentifier: onIdentififer,
    Identifier: onIdentififer,
  }
  let binding
  traverse(ast, visitor)
  // if (!binding) d('global?')
  return binding
}

const gatherGlobalBindings = (ast, {node: {name: searchName}}) => {
  const paths = []
  const visitor = {
    Identifier(path) {
      const {scope, node: {name}} = path
      if (name === searchName) {
        const scopeBinding = scope.getBinding(name)
        // if there's a binding, then it's not global!
        if (!scopeBinding) {
          paths.push(path)
        }
      }
    },
  }
  traverse(ast, visitor)
  return {
    isGlobal: true,
    referencePaths: paths,
  }
}

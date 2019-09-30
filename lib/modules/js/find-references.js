'use babel'

import traverse from '@babel/traverse'

import byFirstRange from '../util/byFirstRange'
import { Debug } from '../../config'
import { locToRange } from '../../util'

const debug = Debug('js:findReferences')

const getRootScope = scope => {
  let cur = scope
  while (cur && cur.parent) {
    cur = cur.parent
  }
  return cur
}

const notDefault = path => path.node.name !== 'default'

const isObjectProperty = path =>
  path.parent &&
  path.parent.type === 'MemberExpression' &&
  !path.parent.computed && // allows o[prop]
  path.parent.property === path.node

const notObjectProperty = path => !isObjectProperty(path)

function gatherRanges(binding) {
  let ranges
  let refPaths
  if (binding.isGlobal) {
    ranges = []
    refPaths = binding.referencePaths
      // exclude `default`
      .filter(notDefault)
      // filter object properties to protect against bug
      //   "bug: globals match object properties"
      .filter(notObjectProperty)
  } else {
    ranges = [getDeclRange(binding)]
    refPaths = binding.referencePaths
      // filter ObjectPattern
      .filter(p => p.node !== binding.identifier)
      // filter undefined for ImportDefault
      .filter(Boolean)
      // filter exports
      .filter(p => !p.isExportDeclaration())
  }

  ranges.push(
    ...refPaths.map(p => {
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
    })
  )

  ranges.push(
    ...binding.constantViolations.map(p => {
      const node = p.node.left || p.node
      const range = locToRange(node.loc)
      range.type = 'mut'
      return range
    })
  )

  ranges.sort(byFirstRange)

  return ranges
}

function getDeclRange(binding) {
  const { path, identifier } = binding
  let range
  if (path.isImportSpecifier()) {
    const { imported, local } = path.node
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
  range.identifier = identifier
  return range
}

function findBinding(ast, loc) {
  if (!ast) {
    throw new Error('AST required')
  }
  const touches = path => {
    const { start, end } = path.node
    if (end <= loc) {
      path.skip()
      return false
    } else if (start > loc) {
      path.stop()
      return false
    } else {
      return true
    }
  }
  const isNode = node => ({ node: ref }) => ref === node
  const isLeftNode = node => ({ node: { left: ref } }) => ref === node
  // https://github.com/thejameskyle/babel-handbook/blob/master/translations/en/plugin-handbook.md
  const visitIdentififer = path => {
    if (touches(path)) {
      const {
        scope,
        node,
        node: { name },
      } = path
      if (!name) return
      if (isObjectProperty(path)) return
      const scopeBinding = scope.getBinding(name)
      if (
        scopeBinding &&
        (scopeBinding.identifier === node ||
          scopeBinding.referencePaths.some(isNode(node)) ||
          // || scopeBinding.constantViolations.some(({node: {left: ref}}) => ref === node)
          scopeBinding.constantViolations.some(isLeftNode(node)))
      ) {
        binding = scopeBinding
        path.stop()
      } else if (getRootScope(scope).globals[name]) {
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
    JSXIdentifier: visitIdentififer,
    Identifier: visitIdentififer,
  }
  let binding
  traverse(ast, visitor)
  // if (!binding) d('global?')
  return binding
}

function gatherGlobalBindings(ast, { node: { name: searchName } }) {
  const paths = []
  const visitor = {
    Identifier(path) {
      const {
        scope,
        node: { name },
      } = path
      if (name !== searchName) return
      // if there's a binding, then it's not global!
      const scopeBinding = scope.getBinding(name)
      if (scopeBinding) {
        path.skip()
        return
      }
      paths.push(path)
    },
  }
  traverse(ast, visitor)
  // --- post process ---
  const referencePaths = []
  const constantViolations = []
  paths.forEach(path => {
    const pp = path.parentPath
    if (pp && pp.isAssignmentExpression() && pp.node.left === path.node) {
      constantViolations.push(path)
    } else {
      referencePaths.push(path)
    }
  })
  // --- result ---
  return {
    isGlobal: true,
    referencePaths,
    constantViolations,
  }
}

export default function findReferences(ast, loc) {
  let binding
  try {
    binding = findBinding(ast, loc)
  } catch (err) {
    if (err.message === "Cannot read property 'file' of undefined") {
      // ignore this one...seems like a bug in babylon when there are
      // duplicated const variables
      // TODO still the case with @babel/parser?
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

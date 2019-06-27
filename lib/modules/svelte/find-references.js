'use babel'

import { uniq, flatten, compose } from 'underscore-plus'

import { Debug } from '../../config'

import byFirstRange from '../util/byFirstRange'

const debug = Debug('svelte:findReferences')

// using import kills eslint :(
// import { walk } from './svelte'
const { walk } = require('./_svelte')

const isGlobal = Symbol('isGlobal')

const get = (node, path) =>
  path.split('.').reduce((cur, step) => cur && cur[step], node)

const hasDollarPrefix = name => name.substr(0, 1) === '$'

const isObjectProperty = (node, parent) =>
  parent &&
  parent.type === 'MemberExpression' &&
  !parent.computed && // allows o[prop]
  parent.property === node

const possibleNames = identifier => {
  const name = identifier.name
  const otherName = hasDollarPrefix(name) ? name.substr(1) : '$' + name
  return [name, otherName]
}

const findResolvedVariables = (foundVariables, scope, identifier, name) => {
  const { references, set } = scope
  const variable = set && set.get(name)
  const scopeVariables = []

  if (variable) {
    scopeVariables.push(variable)
  } else if (references) {
    const reference = references.find(
      ref =>
        ref.identifier === identifier ||
        (hasDollarPrefix(name) && ref.identifier.name === name)
    )
    if (reference) {
      if (reference.resolved) {
        scopeVariables.push(reference.resolved)
      }
    }
  }

  if (scopeVariables.length > 0) {
    foundVariables.push(...scopeVariables)
    return true
  }

  return false
}

const findResolvedGlobal = (globalScope, name) => {
  // prolly global (hopefully)
  //
  // through: variables that are not resolved in this scope
  // -> hopefully it contains all global refs...
  //
  const through = get(globalScope, 'through')
  if (!through) {
    // eslint-disable-next-line no-console
    console.warn('Failed to find valid global scope')
    return []
  }
  return through.filter(({ identifier: id }) => id.name === name)
}

const findVariables = (parseResult, loc) => {
  const scopeManager = parseResult.scopeManager.program
  const globalScope = scopeManager.globalScope
  const ast = globalScope.block

  let found = false
  let currentScopes = []
  const uppers = []
  const foundVariables = []

  const visitor = {
    enter(node, parent) {
      const { start, end, type } = node
      if (found || end <= loc) {
        this.skip()
        return
      }
      // scope
      const nodeScopes = scopeManager.acquireAll(node)
      if (nodeScopes && nodeScopes.length) {
        uppers.push(currentScopes)
        currentScopes = nodeScopes
      }
      // identifier
      if (start > loc) {
        return
      }
      let identifier
      // We need to manually descend into each/if blocks because of this line, that effectively
      // blacklists all props except `else`:
      //   https://github.com/sveltejs/svelte/blob/master/src/compile/Component.ts#L38
      switch (type) {
        case 'Identifier':
          identifier = node
          break
        case 'EachBlock':
          if (visitNode(node.context, node)) {
            break
          }
        // fall through
        case 'InlineComponent':
        case 'IfBlock':
          if (visitNode(node.expression, node)) {
            break
          }
      }

      // guard: identifier at cursor not found
      if (!identifier) return

      // guard: don't match from `o.pr|op` (but match from `o[pr|op]`)
      if (isObjectProperty(node, parent)) return

      // references
      const parentScopes = uniq(flatten([...uppers, currentScopes])).reverse()

      // NOTE we need to do a complete traverse up search _for each name_
      possibleNames(identifier).forEach(name => {
        // first scope (i.e. closest to target identifier) to match wins
        const resolved = parentScopes.some(scope =>
          findResolvedVariables(foundVariables, scope, identifier, name)
        )
        // if not found in scope: means we need to search a global binding
        // for this identifier name
        if (!resolved) {
          const references = findResolvedGlobal(globalScope, name)
          foundVariables.push({
            [isGlobal]: true,
            references,
          })
        }
      })

      found = true // will skip everyting after that
      this.skip()
    },
    leave(node) {
      const nodeScopes = scopeManager.acquireAll(node)
      if (nodeScopes && nodeScopes.length) {
        if (nodeScopes !== currentScopes) {
          throw new Error('Illegal state')
        }
        currentScopes = uppers.pop()
      }
    },
  }

  const noop = () => {}
  const noopScope = { skip: noop }
  const visitNode = (node, parent) => {
    if (node) {
      if (node.type === 'Identifier') {
        // don't let "sub" visits end because they're called out of order...
        visitor.enter.call(noopScope, node, parent)
        visitor.leave.call(noopScope, node, parent)
      } else {
        walk(node, visitor)
      }
    }
    return found
  }

  walk(ast, visitor)

  const binding = compose(
    uniq,
    flatten
  )(foundVariables)

  return binding
}

const resolveRangeType = ref => {
  if (ref.isWrite()) {
    return 'mut'
  } else {
    return 'ref'
  }
}

const resolveDefType = def => {
  if (def.type === 'ImportBinding') {
    if (def.node.type === 'ImportDefaultSpecifier') {
      return 'defimp'
    }
    if (def.node.type === 'ImportSpecifier') {
      return 'namimp'
    }
    // eslint-disable-next-line no-console
    console.warn('atom-refs: unexpected state, please report your use case')
  }
  return 'decl'
}

const parseRefRange = (locator, ref) => {
  const { start, end, name } = ref.identifier
  const realStart = hasDollarPrefix(name) ? start + 1 : start
  const range = locator.getRange(realStart, end)
  range.identifier = ref.identifier
  range.type = resolveRangeType(ref)
  return range
}

const parseDefRange = (locator, def) => {
  const {
    name,
    name: { start, end, name: varName },
  } = def
  const realStart = hasDollarPrefix(varName) ? start + 1 : start
  const range = locator.getRange(realStart, end)
  range.identifier = name
  range.type = resolveDefType(def)
  return range
}

const isExcluded = blacklist => ({ identifier: id }) => !blacklist.has(id)

const gatherRefsRangesIn = (locator, excluded) => references =>
  references
    .filter(isExcluded(excluded))
    // filter out object properties to fix:
    // "bug: globals match object properties a->b"
    .map(ref => {
      excluded.add(ref.identifier)
      return parseRefRange(locator, ref)
    })

const gatherDefsRanges = (locator, excluded, defs) =>
  defs.map(def => {
    if (excluded.has(def.name)) return null
    excluded.add(def.name)
    return parseDefRange(locator, def)
  })

const hasName = targetName => ({ name }) => name === targetName

const gatherRanges = (variable, locator) => {
  const { defs, scope, name } = variable
  const ranges = []
  const excluded = new Set()
  const gatherRefs = gatherRefsRangesIn(locator, excluded)
  // definitions
  if (defs) {
    ranges.push(...gatherDefsRanges(locator, excluded, defs))
  }
  // references
  ranges.push(...gatherRefs(variable.references))
  // class scopes need to look for references in their parent scopes
  if (scope && scope.type === 'class') {
    const upperVariable = scope.upper.variables.find(hasName(name))
    if (upperVariable) {
      ranges.push(...gatherRefs(upperVariable.references))
    }
  }
  return ranges.filter(Boolean)
}

const findReferences = (ast, loc, { locator }) => {
  const variables = findVariables(ast, loc)
  // case: not found
  if (!variables) {
    debug('Not found')
    return []
  }
  // case: found
  const ranges = variables.reduce((result, variable) => {
    const ranges = gatherRanges(variable, locator)
    return result.concat(ranges)
  }, [])
  // sort
  ranges.sort(byFirstRange)
  // dev
  debug('Found', ranges)
  // return
  return ranges
}

export default findReferences

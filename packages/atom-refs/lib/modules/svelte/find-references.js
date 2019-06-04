'use babel'

import { uniq, flatten, compose } from 'underscore-plus'

import { debug } from '../../config'

// using import kills eslint :(
// import { walk } from './svelte'
const { walk } = require('./svelte')

const isGlobal = Symbol('isGlobal')

const get = (node, path) =>
  path.split('.').reduce((cur, step) => cur && cur[step], node)

const findVariables = (parseResult, loc) => {
  const foundVariables = {}
  const scopeManager = parseResult.scopeManager.program
  const ast = parseResult.scopeManager.program.globalScope.block
  const fragmentType = 'program'

  const rootScope = scopeManager.acquireAll(ast)
  const globalScopes = rootScope.filter(({ type }) => type === 'global')
  const globalScope = globalScopes[0] // heuristic (as they say in escope code)

  let currentScopes = []
  let found = false
  const uppers = []
  const visitor = {
    enter(node) {
      const { start, end, type } = node
      if (found || end <= loc) {
        this.skip()
        return
      }
      // scope
      const nodeScopes = scopeManager.acquireAll(node)
      if (nodeScopes) {
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
        case 'IfBlock':
          if (visitNode(node.expression, node)) {
            break
          }
      }
      if (!identifier) {
        return
      }
      // references
      const ancestors = [...uppers, currentScopes]
      const findVariables = scopes => {
        const variables = scopes
          .map(scope => {
            const { references } = scope
            const reference = references.find(
              ref => ref.identifier === identifier
            )
            if (reference) {
              if (reference.resolved) {
                return reference.resolved
              } else {
                // prolly global (hopefully)
                //
                // through: variables that are not resolved in this scope
                // -> hopefully it contains all global refs...
                //
                const through = get(globalScope, 'through')
                if (!through) {
                  // eslint-disable-next-line no-console
                  console.warn('Failed to find valid global scope')
                }
                const references = through.filter(
                  ({ identifier: id }) => id.name === identifier.name
                )
                return { [isGlobal]: true, references }
              }
            }
          })
          .filter(Boolean)
        if (variables.length > 0) {
          foundVariables[fragmentType] = uniq(variables)
          return true
        }
      }
      ancestors.reverse().some(findVariables)
      found = true
      this.skip()
    },
    leave(node) {
      const nodeScopes = scopeManager.acquireAll(node)
      if (nodeScopes) {
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
    flatten,
    Object.values
  )(foundVariables)

  return binding
}

const resolveRangeType = ref => {
  if (ref.writeExpr) {
    const writeType = ref.writeExpr.type
    if (writeType === 'ImportDefaultSpecifier') {
      return 'defimp'
    }
    if (writeType === 'ImportSpecifier') {
      return 'namimp'
    }
  }
  if (ref.resolved && ref.resolved.identifiers.includes(ref.identifier)) {
    return 'decl'
  } else if (ref.isWrite()) {
    return 'mut'
  } else {
    return 'ref'
  }
}

const gatherRanges = (variable, locator) => {
  const { references } = variable
  return references.map(ref => {
    const { start, end } = ref.identifier
    const range = locator.getRange(start, end)
    range.type = resolveRangeType(ref)
    return range
  })
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
  debug('Found', ranges)
  return ranges
}

export default findReferences

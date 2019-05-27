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
  let currentScopes = rootScope
  let found = false
  const uppers = []
  walk(ast, {
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
      if (type === 'Identifier') {
        identifier = node
      } else if (type === 'IfBlock' || type === 'EachBlock') {
        identifier = node.expression
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
  })

  const binding = compose(
    uniq,
    flatten,
    Object.values
  )(foundVariables)

  return binding
}

const gatherRanges = (references, locator) =>
  references.map(ref => {
    const { start, end } = ref.identifier
    const range = locator.getRange(start, end)
    if (ref.isWrite()) {
      // TODO decl
      ref.type = 'mut'
    } else {
      ref.type = 'ref'
    }
    return range
  })

const findReferences = (ast, loc, { locator }) => {
  const variables = findVariables(ast, loc)
  // case: not found
  if (!variables) {
    debug('Not found')
    return []
  }
  // case: found
  const ranges = variables.reduce((result, variable) => {
    const { references } = variable
    const ranges = gatherRanges(references, locator)
    return result.concat(ranges)
  }, [])
  debug('Found', ranges)
  return ranges
}

export default findReferences

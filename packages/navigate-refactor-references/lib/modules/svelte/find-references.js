'use babel'

// import traverse from 'babel-traverse'
import { walk } from 'svelte/compiler'
// import { Range } from 'atom'
// const walk = require('acorn-walk')
import { uniq, flatten, compose, identity } from 'underscore-plus'

import { debug } from '../../config'

const getContent = o => o.content

const findVariables = (parseResult, loc) => {
  // const fragments = Object.entries({
  //   module: getContent,
  //   instance:  getContent,
  //   // html: identity
  // })
  //   .map(([fragmentType, getAstRoot]) => {
  //     let ast = parseResult.ast[fragmentType]
  //     if (!ast) return null
  //     ast = getAstRoot(ast)
  //     const scopeManager = parseResult.scopeManager[fragmentType]
  //     return { fragmentType, ast, scopeManager }
  //   })
  //   .filter(Boolean)

  const foundVariables = {}
  {
    const scopeManager = parseResult.scopeManager.program
    const ast = parseResult.scopeManager.program.globalScope.block
    const fragmentType = 'program'

    let currentScopes = scopeManager.acquireAll(ast)
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
        if (type === 'Identifier' && start <= loc) {
          const variables = currentScopes
            .map(({ defs, references }) => {
              const reference = references.find(ref => ref.identifier === node)
              if (reference) {
                return reference.resolved
              }
            })
            .filter(Boolean)
          foundVariables[fragmentType] = uniq(variables)
          found = true
          this.skip()
        }
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
  }
  // fragments.forEach(({ fragmentType, ast, scopeManager }) => {
  //   let currentScopes = scopeManager.acquireAll(ast)
  //   let found = false
  //   const uppers = []
  //   walk(ast, {
  //     enter(node) {
  //       const { start, end, type } = node
  //       if (found || end <= loc) {
  //         this.skip()
  //         return
  //       }
  //       // scope
  //       const nodeScopes = scopeManager.acquireAll(node)
  //       if (nodeScopes) {
  //         uppers.push(currentScopes)
  //         currentScopes = nodeScopes
  //       }
  //       // identifier
  //       if (type === 'Identifier' && start <= loc) {
  //         const variables = currentScopes
  //           .map(({ references }) => {
  //             const reference = references.find(ref => ref.identifier === node)
  //             if (reference) {
  //               return reference.resolved
  //             }
  //           })
  //           .filter(Boolean)
  //         foundVariables[fragmentType] = uniq(variables)
  //         found = true
  //         this.skip()
  //       }
  //     },
  //     leave(node) {
  //       const nodeScopes = scopeManager.acquireAll(node)
  //       if (nodeScopes) {
  //         if (nodeScopes !== currentScopes) {
  //           throw new Error('Illegal state')
  //         }
  //         currentScopes = uppers.pop()
  //       }
  //     },
  //   })
  // })

  const binding = compose(
    uniq,
    flatten,
    Object.values
  )(foundVariables)

  return binding
}

const gatherRanges = (references, locator) => {
  return references.map(ref => {
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
}

export default (ast, loc, { locator }) => {
  const variables = findVariables(ast, loc)
  // console.log(loc, locator.getPoint(loc), variables)
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
  // console.log(ranges)
  debug('Found', ranges)
  return ranges
}

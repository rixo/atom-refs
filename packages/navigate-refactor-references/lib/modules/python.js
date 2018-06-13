'use babel'

import {lazy} from './util'
import {debug} from '../config'
import {Range} from 'atom'
import assert from 'assert'

export const scopes = [
  'source.python',
]

export const parse = lazy(createParser)
export const findReferences = lazy(createFinder)

export default {
  scopes,
  parse,
  findReferences,
}

const nodeRange = ({startPosition, endPosition}) =>
  Range.fromObject([startPosition, endPosition])

function createParser() {
  const Parser = require('tree-sitter')
  const Python = require('tree-sitter-python')
  const parser = new Parser()
  const {down} = require('./util/traverse')
  parser.setLanguage(Python)
  return ({code}) => {
    // TODO incremental
    const ast = parser.parse(code)
    // TODO remove debug util src
    ast.code = code
    if (!ast.rootNode.constructor.prototype.hasOwnProperty('src')) {
      Object.defineProperty(ast.rootNode.constructor.prototype, 'src', {
        get() {
          const code = this.tree.code
          return code && code.substring(this.startIndex, this.endIndex)
        },
      })
    }
    // error
    let errors = []
    if (ast.rootNode.hasError()) {
      down(ast.rootNode, node => {
        if (node.type === 'ERROR') {
          const err = new SyntaxError('Parse error')
          err.range = nodeRange(node)
          errors.push(err)
        }
      })
    }
    return {
      ast,
      error: errors.length > 0 ? errors : null,
    }
  }
}

function createFinder() {
  const {SKIP, up, down} = require('./util/traverse')
  const CLASS_DEF = 'class_definition'
  const FUNC_DEF = 'function_definition'
  const IDENTIFIER = 'identifier'

  const isAssign = node => {
    const p1 = node.parent
    const p2 = p1 && p1.parent
    return p1 && p2
      && p1.type === 'expression_list'
      && p2.type === 'assignment'
      && p2.children.indexOf(p1) === 0
  }

  const declTypes = [
    'class_definition',
    'function_definition',
  ]
  const isDecl = node => {
    return declTypes.some(t => node.type === t)
  }

  const isWrite = node => isAssign(node) || isDecl(node)

  const isGlobalAt = (scopeNode, testTargetName) => down(scopeNode, node => {
    if (isScopeNode(node)) return SKIP
    if (node.type === 'global_statement') {
      return down(node, node => {
        if (isBinding(node) && testTargetName(node)) {
          return true
        }
      }) || SKIP
    }
  }) || false

  const findRootScope = (fromNode, testTargetName) => {
    return up(fromNode, node => {
      if (isScopeNode(node) && isShadowedAt(node, testTargetName)) {
        return node
      }
    })
  }

  const getInnerScopeNode = node => up(node, node => {
    if (isScopeNode(node)) {
      return node
    }
  })

  // const isScopeNode = node => node.type === 'function_definition'
  const scopeTypes = [
    'class_definition',
    'function_definition',
  ]
  const isScopeNode = ({type}) => scopeTypes.some(t => type === t)

  // const isIdentifier = node => node.type === 'identifier'

  const isBinding = ({type, parent}) => {
    if (type === FUNC_DEF || type == CLASS_DEF) {
      return true
    } else if (type === IDENTIFIER) {
      const ptype = parent && parent.type
      return ptype !== CLASS_DEF && ptype !== FUNC_DEF
    } else {
      return false
    }
  }

  // is shadowed in this scope (disregarding child scops)?
  const isShadowedAt = (scope, testName) => {
    if (isGlobalAt(scope, testName)) {
      return false
    } else {
      return isWrittenAt(scope, testName)
    }
  }

  // is assigned in this scope, disregarding child scopes?
  const isWrittenAt = (scope, testName) => {
    return down(scope, node => {
      if (isBinding(node) && testName(node) && isWrite(node)) {
        return true
      } else if (isScopeNode(node)) {
        return SKIP
      }
    }) || false
  }

  const findIndentifierAt = (node, loc) => down(node, node => {
    if (isBinding(node)) {
      const identifier = getBindingIdentifier(node)
      const {startIndex, endIndex} = identifier
      if (startIndex <= loc && endIndex > loc) {
        return node
      }
    }
  })

  const getBindingIdentifier = node => {
    const {type, children} = node
    if (type === CLASS_DEF || type === FUNC_DEF) {
      const child1 = children && children[1]
      assert(child1)
      assert(child1.type === IDENTIFIER)
      return child1
    } else {
      return node
    }
  }

  const bindingRange = bindingNode => {
    const {type} = bindingNode
    if (type === FUNC_DEF || type === CLASS_DEF) {
      return nodeRange(getBindingIdentifier(bindingNode))
    } else {
      return nodeRange(bindingNode)
    }
  }

  return (ast, loc) => {
    console.log('loc', loc)
    const {code} = ast
    const getSrc = ({startIndex: a, endIndex: b}) => code.substring(a, b)
    const cursorNode = findIndentifierAt(ast.rootNode, loc)
    if (!cursorNode) {
      return []
    }
    // find references
    const ranges = []
    const pushNode = node => {
      const range = bindingRange(node)
      ranges.push(range)
      if (isAssign(node)) {
        range.type = 'mut'
      } else if (isDecl(node)) {
        range.type = 'decl'
      }
    }
    const getBindingName = node => getSrc(getBindingIdentifier(node))
    const targetName = getBindingName(cursorNode)
    // const testTargetName = node => getSrc(node) === targetName
    const testTargetName = node => getBindingName(node) === targetName
    const targetScopeNode = getInnerScopeNode(cursorNode)
    const rootScopeNode = findRootScope(cursorNode, testTargetName) || ast.rootNode
    debug('rootScopeNode', rootScopeNode.src)
    down(rootScopeNode, node => {
      if (isBinding(node) && testTargetName(node)) {
        pushNode(node)
      }
      // skip scopes where target identifier is shadowed
      if (node !== targetScopeNode && isScopeNode(node)) {
        const shadowed = isShadowedAt(node, testTargetName)
        if (shadowed) {
          return SKIP
        }
      }
    })
    return ranges
  }
}

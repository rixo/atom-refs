'use babel'

import {SKIP, up, down} from '../util/traverse'
import assert from 'assert'
import {Range} from 'atom'
import {debug} from '../../config'

const CLASS_DEF = 'class_definition'
const FUNC_DEF = 'function_definition'
const IDENTIFIER = 'identifier'
const ERROR = 'ERROR'

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
    if (identifier) {
      const {startIndex, endIndex} = identifier
      if (startIndex <= loc && endIndex > loc) {
        return node
      }
    }
  }
})

const getBindingIdentifier = node => {
  const {type, children} = node
  if (type === CLASS_DEF || type === FUNC_DEF) {
    const child1 = children && children[1]
    if (!child1) {
      return
    }
    if (child1.type === ERROR) {
      return
    }
    assert(child1.type === IDENTIFIER)
    return child1
  } else {
    return node
  }
}

const nodeRange = ({startPosition, endPosition}) =>
  Range.fromObject([startPosition, endPosition])

const bindingRange = bindingNode => {
  const {type} = bindingNode
  if (type === FUNC_DEF || type === CLASS_DEF) {
    const identifier = getBindingIdentifier(bindingNode)
    if (identifier) {
      return nodeRange(identifier)
    }
  } else {
    return nodeRange(bindingNode)
  }
}

const getBindingName = (getSrc, node) => {
  const identifier = getBindingIdentifier(node)
  if (identifier) {
    return getSrc(identifier)
  }
}

export default (ast, loc) => {
  // console.log('loc', loc)
  const {code} = ast
  const getSrc = ({startIndex: a, endIndex: b}) => code.substring(a, b)
  const cursorNode = findIndentifierAt(ast.rootNode, loc)
  if (!cursorNode) {
    return []
  }
  const targetName = getBindingName(getSrc, cursorNode)
  if (!targetName) {
    return []
  }
  // find references
  const ranges = []
  const pushNode = node => {
    const range = bindingRange(node)
    if (range) {
      ranges.push(range)
      if (isAssign(node)) {
        range.type = 'mut'
      } else if (isDecl(node)) {
        range.type = 'decl'
      }
    }
  }
  const testTargetName = node => getBindingName(getSrc, node) === targetName
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

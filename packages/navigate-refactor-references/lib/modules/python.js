'use babel'

import {lazy} from './util'
import {down, up, SKIP} from './util/traverse'
// import {debug} from '../config'
import {Range} from 'atom'

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
  parser.setLanguage(Python)
  return ({code}) => {
    const ast = parser.parse(code)
    // TODO incremental
    ast.code = code
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
    const p = node.parent
    if (!p) return false
    const ptype = p.type
    return declTypes.some(type => ptype === type)
  }

  const isWrite = node => isAssign(node) || isDecl(node)

  const isGlobalAt = (scopeNode, testTargetName) => down(scopeNode, node => {
    if (isScopeNode(node)) return SKIP
    if (node.type === 'global_statement') {
      return down(node, node => {
        if (isIdentifier(node) && testTargetName(node)) {
          return true
        }
      }) || SKIP
    }
  }) || false

  const isFunctionIdentifier = (scopeNode, idNode) =>
    scopeNode.type === 'function_definition' && scopeNode.children[1] === idNode

  const getFunctionIdentifier = scopeNode => {
    if (scopeNode.type !== 'function_definition') {
      return
    }
    const idNode = scopeNode.children && scopeNode.children[1]
    if (!idNode || !isIdentifier(idNode)) {
      throw new Error(
        'Unexpected (identifier is expected to be children[1] of function_definition)'
      )
    }
    return idNode
  }

  const isClassIdentifier = (classNode, idNode) =>
    classNode.type === 'class_definition' && classNode.children[1] === idNode

  const getClassIdentifier = classNode => {
    if (classNode.type !== 'class_definition') {
      return
    }
    const idNode = classNode.children && classNode.children[1]
    if (!idNode || !isIdentifier(idNode)) {
      throw new Error(
        'Unexpected (identifier is expected to be children[1] of class_definition)'
      )
    }
    return idNode
  }

  const findRootScope = (fromNode, testTargetName) => {
    return up(fromNode, node => {
      if (
        isScopeNode(node)
        && isShadowedAt(node, testTargetName)
        && !isFunctionIdentifier(node, fromNode)
        && !isClassIdentifier(node, fromNode)
      ) {
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

  const isIdentifier = node => node.type === 'identifier'

  // is shadowed in this scope (disregarding child scops)?
  const isShadowedAt = (scope, testName) => {
    if (isGlobalAt(scope, testName)) {
      return false
    }
    return isWrittenAt(scope, testName)
  }

  // is assigned in this scope, disregarding child scopes?
  const isWrittenAt = (scope, testName) => down(scope, node => {
    if (isScopeNode(node)) {
      // special case: class identifier
      // class identifier is a write, but it is a child of the
      // class_definition that is about to be skipped
      const classId = getClassIdentifier(node)
      if (classId && testName(classId)) {
        return true
      }
      const functionId = getFunctionIdentifier(node)
      if (functionId && testName(functionId)) {
        return true
      }
      // skip
      return SKIP
    }
    if (
      isIdentifier(node)
      && testName(node)
      && isWrite(node)
      && !isFunctionIdentifier(scope, node)
    ) {
      return true
    }
  }) || false

  const findIndentifierAt = (node, loc) => down(node, node => {
    if (node.type === 'identifier') {
      const {startIndex, endIndex} = node
      if (startIndex <= loc && endIndex > loc) {
        return node
      }
    }
  })

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
      const range = nodeRange(node)
      ranges.push(range)
      if (isAssign(node)) {
        range.type = 'mut'
      } else if (isDecl(node)) {
        range.type = 'decl'
      }
    }
    const targetName = getSrc(cursorNode)
    const testTargetName = node => getSrc(node) === targetName
    const targetScopeNode = getInnerScopeNode(cursorNode)
    const rootScopeNode = findRootScope(cursorNode, testTargetName) || ast.rootNode
    // console.log(getSrc(rootScopeNode))
    // down(rootScopeNode, node => console.log(node.type, getSrc(node)))
    down(rootScopeNode, node => {
      // skip scopes where target identifier is shadowed
      if (node !== targetScopeNode && isScopeNode(node)) {
        if (isShadowedAt(node, testTargetName)) {
          // special case: class identifiers
          // the identifier is under the class node, but actually in the
          // parent scope...
          const classIdentifier = getClassIdentifier(node)
          if (classIdentifier && testTargetName(classIdentifier)) {
            pushNode(classIdentifier)
          }
          // skip
          return SKIP
        }
      }
      if (isIdentifier(node) && testTargetName(node)) {
        pushNode(node)
      }
    })
    // const {startPosition, endPosition} = cursorNode
    // const range = Range.fromObject([startPosition, endPosition])
    // ranges.push(range)
    return ranges
  }
}


// function createParser() {
//   // const {parse, parse_dammit} = require('filbert')
//   const antlr4 = require('antlr4')
//   const {
//     // Python3Lexer,
//     // Python3Parser,
//     parse,
//   } = require('./python-parser')
//   // const parser = new Python3Parser()
//   return ({code}) => {
//     const errors = []
//     const tree = parse(code, {
//       onError: error => {
//         error.message = `Parse Error: ${error.message}`
//         errors.push(error)
//       },
//     })
//     return {
//       error: errors.length > 0 ? errors : null,
//       ast: tree,
//     }
//
//     // try {
//     //   const ast = parser.parseCode(code)
//     //   return {ast}
//     // } catch (error) {
//     //   if (error.lineNumber && error.columnNumber) {
//     //     error.loc = {
//     //       line: error.lineNumber,
//     //       column: error.columnNumber,
//     //     }
//     //   }
//     //   return {error}
//     // }
//   }
// }
//
// function createFinder() {
//   const antlr4 = require('antlr4')
//   const {Listener} = require('./python-parser')
//   const findReferences = Object.assign(new Listener, {
//     enterStmt(ctx) {
//       console.log('enterStmt', ctx)
//     },
//   })
//   return (ast, loc) => {
//     antlr4.tree.ParseTreeWalker.DEFAULT.walk(findReferences, ast)
//     return []
//   }
// }

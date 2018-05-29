'use babel'

import {lazy} from './util'

const scopes = [
  'text.html.php',
]

const createParser = () => {
  const PhpParser = require('php-parser')
  const parser = new PhpParser({
    parser: {
      extraDoc: true,
      php7: true,
      // locations: true,
    },
    lexer: {
      short_tags: true,
    },
    ast: {
      withPositions: true,
    },
  })
  return code => {
    try {
      const ast = parser.parseCode(code)
      return {ast}
    } catch (error) {
      if (error.lineNumber && error.columnNumber) {
        error.loc = {
          line: error.lineNumber,
          column: error.columnNumber,
        }
      }
      return {error}
    }
  }
}

const parse = lazy(createParser)
const findReferences = lazy(createFinder)

export default {
  scopes,
  parse,
  findReferences,
}

function createFinder() {
  const {locToRange} = require('../util')
  const kindTester = kinds => ({kind}) => kinds.some(k => k === kind)
  const isClassyNode = kindTester(['class', 'interface', 'trait'])
  const isFunctionNode = kindTester(['function', 'method', 'closure'])
  const isBindingNode = kindTester(
    ['variable', 'parameter', 'constref', 'identifier']
  )

  const findIdentifier = (ast, loc) => {
    const inClasses = []
    const inFunctions = []
    const finder = (node, parent, prop, idx) => {
      const {loc: {start, end}, name} = node
      if (isClassyNode(node)) {
        if (start.offset > loc) return STOP
        if (end.offset < loc) return SKIP
        inClasses.push(node)
        const result = traverse(node.body, finder)
        if (result) {
          return result
        } else {
          inClasses.pop()
          return SKIP
        }
      }
      else if (isFunctionNode(node)) {
        if (start.offset > loc) return STOP
        if (end.offset < loc) return SKIP
        inFunctions.push(node)
        const result = traverse(node.body, finder)
        || traverse(node.arguments, finder)
        if (result) {
          return result
        } else {
          inFunctions.pop()
          return SKIP
        }
      }
      // else if (kind === 'variable' || kind === 'parameter') {
      else if (isBindingNode(node)) {
        if (start.offset > loc) return STOP
        if (end.offset < loc) return SKIP
        return node
      }
      // else if (start.offset <= loc && end.offset >= loc) {
      //   debugger
      // }
    }
    const node = traverse(ast, finder)
    return {node, inFunctions, inClasses}
  }

  const findReferences = (toNode, root) => {
    const ranges = []
    const targetName = toNode.name
    let kinds = []
    if (toNode.kind === 'variable' || toNode.kind === 'parameter') {
      kinds.push('variable', 'parameter')
    } else if (toNode.kind === 'constref') {
      kinds.push('constref')
    } else if (toNode.kind === 'identifier') {
      kinds.push('identifier')
    }
    const visitor = node => {
      const {kind, name, loc} = node
      // don't enter another scope
      if (node !== root && (isFunctionNode(node) || isClassyNode(node))) {
        return SKIP
      }
      // if (kind === 'variable' || kind === 'parameter') {
      if (kinds.some(k => k === kind)) {
        if (name === targetName) {
          const range = locToRange(loc)
          ranges.push(range)
        }
      }
    }
    traverse(root, visitor)
    return ranges
  }

  const findThisRanges = classNode => {
    const ranges = []
    const visitor = node => {
      const {kind, name, loc} = node
      // don't enter another class
      if (node !== classNode && isClassyNode(node)) return SKIP
      if (kind === 'variable' && name === 'this') {
        const range = locToRange(loc)
        ranges.push(range)
      }
    }
    traverse(classNode, visitor)
    return ranges
  }

  return (ast, loc) => {
    const {node: identNode, inFunctions, inClasses} = findIdentifier(ast, loc)
    const result = []
    if (!identNode) {
      return result
    }
    console.log('found', identNode, inFunctions)
    if (identNode.name === 'this') {
      // search references in whole class
      const classNode = inClasses.pop()
      if (classNode) {
        result.push(...findThisRanges(classNode))
      } else {
        console.warn('atom-occurences: WTF??')
      }
    } else {
      // search references in function body
      const functionNode = inFunctions.pop()
      if (functionNode) {
        result.push(...findReferences(identNode, functionNode))
      } else {
        // search in root scope (outside any function)
        result.push(...findReferences(identNode, ast))
      }
    }

    return result
  }
}

const STOP = Symbol('stop')
const SKIP = Symbol('skip')

function traverse(root, handler) {
  const typeKey = 'kind'
  let done = false
  let result = void 0
  const pre = handler
  // const {pre, post} = typeof handler === 'function'
  //   ? {pre: handler}
  //   : handler
  const visit = (node, parent, prop, idx) => {
    if (done) {
      return
    }
    if (Array.isArray(node)) {
      node.some((child, i) => visit(child, node, prop, i))
      return
    }
    if (!node || typeof node[typeKey] !== 'string') {
      return
    }
    const goon = pre ? pre(node, parent, prop, idx) : void 0
    if (goon) {
      if (goon === STOP) {
        done = true
        return
      } else if (goon !== SKIP) {
        result = goon
        done = true
        return
      }
    } else {
      for (const prop in node) {
        const child = node[prop]
        if (typeof child === 'object') {
          visit(child, node, prop)
        }
      }
    }
    // if (post) {
    //   post(node, parent, prop, idx)
    // }
    return done
  }
  visit(root, null)
  return result
}

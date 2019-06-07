'use babel'

import { Debug } from '../../config'
import { locToRange } from '../../util'

const debug = Debug('php')

const STOP = Symbol('stop')
const SKIP = Symbol('skip')

const GUESS_CONSTREF_CALL = true

const kindTester = kinds => ({ kind }) => kinds.some(k => k === kind)
const isClassyNode = kindTester(['class', 'interface', 'trait'])
const isFunctionNode = kindTester(['function', 'method', 'closure'])
const isBindingNode = kindTester([
  'variable',
  'parameter',
  'constref',
  'identifier',
])
const isThisLookup = ({ node: p } = {}) =>
  p && p.kind === 'propertylookup' && p.what.name === 'this'
const $isCall = Symbol('isCall')
const $isClassAccess = Symbol('isNew')
const doesTargetFunction = node => node.kind === 'function' || node[$isCall]
const doesTargetClass = node => node.kind === 'class' || node[$isClassAccess]
const doesTargetGlobal = node =>
  doesTargetFunction(node) || doesTargetClass(node)
const isCall = ({ node: p, parent: { node: pp } = {} } = {}) => {
  if (p) {
    if (p.kind === 'call') {
      return true
    } else if (p.kind === 'propertylookup') {
      if (pp && pp.kind === 'call') {
        return true
      }
    }
  }
  return false
}
const isClassAccess = ({ node: p } = {}) => {
  if (p) {
    if (p.kind === 'new' || p.kind === 'staticlookup') {
      return true
    }
  }
  return false
}
const NL = /\r\n|\n|\r/g
const indexOf = (source, name) => source.indexOf(name)
const hackFunctionNameLoc = (
  { loc: { start, source }, name },
  indexOfName = indexOf
) => {
  // const nameOffset = source.indexOf(name)
  const nameOffset = indexOfName(source, name)
  const lines = source.substr(0, nameOffset).split(NL)
  const lineOffset = lines.length - 1
  const startLine = start.line + lineOffset
  const startColumn =
    lines[lineOffset].length + (lineOffset === 0 ? start.column : 0)
  const startOffset = start.offset + nameOffset
  return {
    start: {
      line: startLine,
      column: startColumn,
      offset: startOffset,
    },
    end: {
      line: startLine,
      column: startColumn + name.length,
      offset: startOffset + name.length,
    },
  }
}
const hackClassNameLoc = hackFunctionNameLoc
const indexOfAlias = (source, name) => {
  const re = new RegExp(`(\\bas\\b.*\\b)(${name})\\b`)
  const match = re.exec(source)
  if (match) {
    return match.index + match[1].length
  } else {
    return -1
  }
}
const hackUseItemAliasLoc = node =>
  hackFunctionNameLoc({ ...node, name: node.alias }, indexOfAlias)
const hackUseItemNameLoc = hackFunctionNameLoc
const hackUseItemNameOrAliasLoc = node =>
  node.alias ? hackUseItemAliasLoc(node) : hackUseItemNameLoc(node)
const aliasableName = ({ name, alias }) => {
  const result = alias || name
  // `$` is detected as a variable but its 'name' is an object
  if (typeof result === 'string') {
    return result
  }
}
const hackPropertyNameLoc = ({ loc: { start }, name: { length } }) => {
  return {
    start,
    end: {
      line: start.line,
      column: start.column + length + 1, // + 1 for the $
      offset: start.offset + length + 1,
    },
  }
}

function traverse(root, handler) {
  const typeKey = 'kind'
  let done = false
  let result = void 0
  const pre = handler
  // const {pre, post} = typeof handler === 'function'
  //   ? {pre: handler}
  //   : handler
  // const visit = (node, parent, path) => {
  const visit = step => {
    const { node } = step
    if (done) {
      return
    }
    if (Array.isArray(node)) {
      node.some((child, i) => visit({ key: i, node: child, parent: step }))
      return
    }
    if (!node || typeof node[typeKey] !== 'string') {
      return
    }
    // const goon = pre ? pre(step.node, step.parent && step.parent.node) : void 0
    const goon = pre ? pre(step) : void 0
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
          visit({ key: prop, node: child, parent: step })
        }
      }
    }
    return done
  }
  // visit(root, null, null)
  visit({ node: root })
  return result
}
/* eslint-disable brace-style */
const findIdentifier = (ast, loc) => {
  const inNamespaces = []
  const inClasses = []
  const inFunctions = []
  const touches = ({ start, end }) => start.offset <= loc && end.offset > loc
  const finder = path => {
    const { node, parent } = path
    const {
      kind,
      loc: { start, end },
    } = node
    // namespace
    if (kind === 'namespace') {
      if (start.offset > loc) return STOP
      if (end.offset <= loc) return SKIP
      inNamespaces.push(node)
      const result = traverse(node.children, finder)
      if (result) {
        return result
      } else {
        inNamespaces.pop()
        return SKIP
      }
    } else if (isClassyNode(node)) {
      // class name
      if (kind === 'class') {
        const nameLoc = hackClassNameLoc(node)
        if (touches(nameLoc)) {
          return node
        }
      }
      // ... and body
      if (start.offset > loc) return STOP
      if (end.offset <= loc) return SKIP
      inClasses.push(node)
      const result = traverse(node.body, finder)
      if (result) {
        return result
      } else {
        inClasses.pop()
        return SKIP
      }
    }
    // function body
    else if (isFunctionNode(node)) {
      // method name
      if (kind === 'method' || kind === 'function') {
        const nameLoc = hackFunctionNameLoc(node)
        if (touches(nameLoc)) {
          return node
        }
      }
      // ... and body
      if (start.offset > loc) return STOP
      if (end.offset <= loc) return SKIP
      inFunctions.push(node)
      const result =
        traverse(node.body, finder) || traverse(node.arguments, finder)
      if (result) {
        return result
      } else {
        inFunctions.pop()
        return SKIP
      }
    } else if (kind === 'staticlookup') {
      // TODO Test::$test
    }
    // others
    else if (isBindingNode(node)) {
      if (start.offset > loc) return STOP
      if (end.offset <= loc) return SKIP
      // are we a call?
      node[$isCall] = isCall(parent)
      // are we a `new Class`?
      node[$isClassAccess] = isClassAccess(parent)
      // only pick constref that are right of `$this->` because
      // we can't know classes of other variables
      if (kind === 'constref' && !isThisLookup(parent)) {
        return
      }
      return node
    } else if (kind === 'property') {
      const { start, end } = hackPropertyNameLoc(node)
      if (start.offset > loc) return STOP
      if (end.offset <= loc) return SKIP
      return node
    } else if (kind === 'useitem') {
      const { start, end } = hackUseItemNameOrAliasLoc(node)
      if (start.offset > loc) return STOP
      if (end.offset <= loc) return SKIP
      return node
    }
    // else if (node.kind === 'method') {
    //   const nameLoc = hackMethodNameLoc(node.loc)
    //   if (nameLoc.start.offset > loc) return STOP
    //   if (nameLoc.end.offset < loc) return SKIP
    //   // node[$isCall] = true
    //   return node
    // }
    else if (start.offset <= loc && end.offset >= loc) {
      if (kind !== 'program') {
        debug('Not found', node)
      }
    }
  }
  const node = traverse(ast, finder)
  return { node, inNamespaces, inFunctions, inClasses }
}

const findVariableRanges = (toNode, root) => {
  const ranges = []
  const { kind: toKind } = toNode
  const toCallable = toNode[$isCall] || toKind === 'function'
  const toClass =
    toNode[$isClassAccess] || toKind === 'class' || toKind === 'useitem'
  const kinds = []
  if (toKind === 'variable' || toKind === 'parameter') {
    kinds.push('variable', 'parameter')
  } else if (toKind === 'constref') {
    kinds.push('constref')
  } else if (toCallable) {
    // before identifier
    kinds.push('identifier', 'function')
  } else if (toClass) {
    // before identifier
    kinds.push('identifier', 'class', 'useitem')
  } else if (toKind === 'identifier') {
    kinds.push('identifier')
  }
  const toName = aliasableName(toNode)
  // exit early if we fail to resolve variable name at the
  // current cursor location
  if (!toName) {
    return ranges
  }
  const toNameLower = toName.toLowerCase()
  const testName =
    toCallable || toClass
      ? name => name && name.toLowerCase() === toNameLower
      : name => name === toName
  const isOurKind = ({ kind }) => kinds.some(k => k === kind)
  const isScope = node =>
    isFunctionNode(node) || isClassyNode(node) || node.kind === 'namespace'
  const getNodeName = node => {
    const { kind, name, alias } = node
    const result = (kind === 'useitem' && alias) || name
    // must handle case {name: {kind: 'identifier', name: '...'}}
    if (typeof result === 'object' && result) {
      return getNodeName(result)
    } else {
      return result
    }
  }
  const visitor = ({ node, parent }) => {
    const visibleName = getNodeName(node)
    const { kind, loc } = node
    // if (toClass && kind === 'useitem' && testName(node.alias)) {
    //   const nameLoc = hackUseItemAliasLoc(node)
    //   const range = locToRange(nameLoc)
    //   range.type = 'decl'
    //   ranges.push(range)
    // } else
    if (testName(visibleName)) {
      if (isOurKind(node)) {
        let range = locToRange(loc)
        const { node: p = {} } = parent || {}
        if (toCallable) {
          if (kind === 'function') {
            const nameLoc = hackFunctionNameLoc(node)
            range = locToRange(nameLoc)
            range.type = 'decl'
          } else if (!isCall(parent)) {
            return
          }
        } else if (toClass) {
          if (kind === 'class') {
            const nameLoc = hackClassNameLoc(node)
            range = locToRange(nameLoc)
            range.type = 'decl'
          } else if (kind === 'useitem') {
            const nameLoc = node.alias
              ? hackUseItemAliasLoc(node)
              : hackUseItemNameLoc(node)
            range = locToRange(nameLoc)
            range.type = 'decl'
          } else if (!isClassAccess(parent)) {
            return
          }
        } else {
          // normal variables
          if (isCall(parent) || isClassAccess(parent)) {
            return
          }
        }
        if (p.kind === 'assign' && p.left === node) {
          range.type = 'mut'
        } else if (kind === 'parameter') {
          range.type = 'decl'
        }
        ranges.push(range)
        // if (parent.kind === 'call' && parent.what === node) {
        //   // const range = locToRange
        // }
      }
    }
    // don't enter another scope (but let us see function/class names
    // before skipping)
    if (node !== root) {
      // functions / classes are namespace scope
      if (toCallable || toClass) {
        if (node.kind === 'namespace') {
          return SKIP
        }
      } else if (isScope(node)) {
        return SKIP
      }
    }
  }
  traverse(root, visitor)
  return ranges
}

const findClassRanges = (classNode, identNode) => {
  const ranges = []
  const { kind: identKind, name: identName } = identNode
  const visitor = ({ node, parent }) => {
    const { kind, name, loc } = node
    // don't enter another class
    if (node !== classNode && isClassyNode(node)) return SKIP
    if (name === identName) {
      const identIsCall = identNode[$isCall] || identKind === 'method'
      if (
        identKind === 'constref' ||
        identKind === 'method' ||
        identKind === 'property'
      ) {
        if (kind === 'constref') {
          // ensure left is `$this->` (because we can't guess
          // membership for other variables)
          if (!isThisLookup(parent)) {
            return
          }
          // ensure same 'call-ability'
          if (GUESS_CONSTREF_CALL) {
            if (identIsCall !== isCall(parent)) {
              return
            }
          }
          const range = locToRange(loc)
          ranges.push(range)
        }
        // highlight member functions
        else if (kind === 'method') {
          if (!identIsCall) {
            return
          }
          // const range = locToRange(loc)
          const range = locToRange(hackFunctionNameLoc(node))
          range.type = 'decl'
          ranges.push(range)
        }
        // highlight property declaration
        else if (kind === 'property') {
          if (identIsCall) {
            return
          }
          const range = locToRange(hackPropertyNameLoc(node))
          // don't take the $ in the selection (to allow refactor
          // along with references)
          range.start.column += 1
          range.type = 'decl'
          ranges.push(range)
        }
      } else if (kind === 'variable') {
        const range = locToRange(loc)
        ranges.push(range)
      }
    }
  }
  traverse(classNode, visitor)
  return ranges
}

const findReferences = (ast, loc) => {
  const {
    node: identNode,
    inNamespaces,
    inFunctions,
    inClasses,
  } = findIdentifier(ast, loc)
  const result = []
  if (!identNode) {
    return result
  }
  const { kind: identKind, name: identName } = identNode
  debug('Found', identNode)
  if (
    identName === 'this' ||
    identKind === 'constref' ||
    identKind === 'method' ||
    identKind === 'property'
  ) {
    // search references in whole class
    const classNode = inClasses.pop()
    if (classNode) {
      result.push(...findClassRanges(classNode, identNode))
    } else {
      console.warn('atom-refs: WTF??')
    }
  } else {
    // search references in function body
    const functionNode = inFunctions.pop()
    // functions are global by default
    if (functionNode && !doesTargetGlobal(identNode)) {
      result.push(...findVariableRanges(identNode, functionNode))
    } else {
      // search in root scope (outside any function)
      const namespaceNode = inNamespaces.pop()
      const root = namespaceNode || ast
      result.push(...findVariableRanges(identNode, root))
    }
  }

  return result
}

export default findReferences

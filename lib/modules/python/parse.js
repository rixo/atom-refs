'use babel'

import Parser from 'tree-sitter'
import Python from 'tree-sitter-python'
import { Range } from 'atom'
import { down } from '../util/traverse'
import { Debug } from '../../config'
const debug = Debug('python')

const parser = new Parser()
parser.setLanguage(Python)

const nodeRange = ({ startPosition, endPosition }) =>
  Range.fromObject([startPosition, endPosition])

function debugSrc() {
  const code = this.tree.code
  return code && code.substring(this.startIndex, this.endIndex)
}

export default ({ code }) => {
  // TODO incremental
  const ast = parser.parse(code)
  // TODO remove debug util src
  ast.code = code
  // add `src` debug property to SyntaxNode's prototype
  if (debug.enabled) {
    // it would be better to monkey patch SyntaxNode directly, but the
    // class is not explicitely exposed...
    const proto = ast.rootNode.constructor.prototype
    if (!proto.hasOwnProperty('src')) {
      Object.defineProperty(proto, 'src', {
        get: debugSrc,
      })
    }
  }
  // error
  const getSrc = ({ startIndex: a, endIndex: b }) => code.substring(a, b)
  const errors = []
  if (ast.rootNode.hasError()) {
    const ignoreRows = []
    const isIgnoredRow = (startRow, endRow) =>
      ignoreRows.some(([start, end]) => startRow >= start && endRow <= end)
    down(ast.rootNode, node => {
      if (node.type === 'ERROR') {
        const src = getSrc(node).trim()
        const {
          startPosition: { row: startRow },
          endPosition: { row: endRow },
        } = node
        if (src[0] === '%') {
          ignoreRows.push([startRow, endRow])
          return
        }
        if (isIgnoredRow(startRow, endRow)) {
          return
        }
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

// export const findReferences = 1

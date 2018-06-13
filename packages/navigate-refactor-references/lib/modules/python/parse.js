'use babel'

import Parser from 'tree-sitter'
import Python from 'tree-sitter-python'
import {Range} from 'atom'
import {down} from '../util/traverse'
// import assert from 'assert'
// import {debug} from '../../config'

const parser = new Parser()
parser.setLanguage(Python)

const nodeRange = ({startPosition, endPosition}) =>
  Range.fromObject([startPosition, endPosition])

export default ({code}) => {
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

// export const findReferences = 1

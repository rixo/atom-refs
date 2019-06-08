'use babel'

{
  const { default: Debug } = require('debug')
  Debug.enable('atom-refs:*')
}

import { Debug } from '../../config'
import { locToRange } from '../../util'
import byFirstRange from '../util/byFirstRange'

const debug = Debug('php')

function walk(node, visitor) {
  const kind = node.kind
  const handler = visitor.kind
  if (handler) {
    handler.call(this, node, parent)
  }
}

function findIdentifier(ast, loc) {
  debugger
}

export default (ast, loc) => {
  const identifier = findIdentifier(ast, loc)
  debug(identifier ? 'found at %s' : 'not found %s', loc)
}

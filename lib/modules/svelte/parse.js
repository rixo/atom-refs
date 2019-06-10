'use babel'

import { Range } from 'atom'
import { analyze } from 'escope'

/* eslint-disable-plugin import */
// nothing cut it: using import kills eslint :(
// import { compile, parse } from './svelte'
const { compile, parse, walk } = require('./_svelte')

const PARSE_WITH_COMPILE = true

const getScriptFragment = script => {
  if (!script) return null
  const {
    start,
    end,
    context,
    content: { body },
  } = script
  return {
    type: 'Fragment',
    start,
    end,
    children: body,
    context,
  }
}

const visit = (ast, visitor) =>
  walk(ast, {
    enter(node, parent) {
      const handler = visitor[node.type]
      if (handler) {
        handler.call(visitor, node, parent)
      }
    },
  })

export const traverse = (ast, visitor) =>
  walk(ast, {
    enter(node, parent) {
      const handler = visitor[node.type]
      if (handler) {
        handler.call(visitor, { node, parent })
      }
    },
  })

class ExtraIdentifiersVisitor {
  constructor(code) {
    this.code = code
  }

  visitTransition(node) {
    const {
      name,
      name: { length: l },
    } = node
    const nodeCode = this.code.substring(node.start, node.end)
    const start = node.start + nodeCode.indexOf(':') + 1
    node.id = {
      type: 'Identifier',
      name,
      start,
      end: start + l,
    }
  }

  InlineComponent(node) {
    addInlineComponentNodeIdentifiers(node, this.code)
  }

  Animation(node) {
    this.visitTransition(node)
  }

  Transition(node) {
    this.visitTransition(node)
  }
}

// adds Identifier for nodes that needs to be parsed by escope, but which
// svelte compiler does not add one by itself
const addExtraIdentifiers = (body, code) => {
  body.forEach(ast => {
    visit(ast, new ExtraIdentifiersVisitor(code))
  })
}

const addInlineComponentNodeIdentifiers = (node, code) => {
  const { start, name } = node
  const nodeCode = code.substring(node.start, node.end)
  node.id = {
    type: 'Identifier',
    name,
    start: start + 1,
    end: start + name.length + 1,
  }
  // guard: self closing tag
  if (nodeCode.substr(-2) === '/>') {
    return
  }
  {
    const idStart = start + nodeCode.lastIndexOf('</') + 2
    node.children.push({
      type: 'Identifier',
      name,
      start: idStart,
      end: idStart + name.length,
    })
  }
}

const analyzeScopes = (code, { module: mod, instance, html }) => {
  const escopeOptions = { ecmaVersion: 10, sourceType: 'module' }

  const body = [...[mod, instance].map(getScriptFragment), html]
    // const body = [
    //   module && module.content && module.content.body,
    //   instance && instance.content && instance.content.body,
    //   html,
    // ]
    .filter(Boolean)
    .sort(({ start: left }, { start: right }) => left - right)

  // add support for component refs in templates (e.g. <Foo />)
  addExtraIdentifiers(body, code)

  const program = {
    type: 'Program',
    sourceType: 'module',
    body,
  }

  return {
    // module: mod && escope.analyze(mod.content, escopeOptions),
    // instance: instance && escope.analyze(instance.content, escopeOptions),
    program: analyze(program, escopeOptions),
  }
}

const parseWithCompile = code => {
  const ast = compile(code, {
    generate: false,
  })
  ast.scopeManager = analyzeScopes(code, ast.ast)
  return { ast }
}

const parseWithParse = code => {
  const ast = parse(code)
  const scopeManager = analyzeScopes(code, ast)
  return { ast: { ast, scopeManager } }
}

const parser = PARSE_WITH_COMPILE ? parseWithCompile : parseWithParse

export default ({ code }) => {
  try {
    return parser(code)
  } catch (error) {
    const { start, end } = error
    if (start) {
      const { line, column } = start
      error.loc = { line, column }
      if (end) {
        const startPosition = [line, column]
        const endPosition = [end.line, end.column]
        error.range = Range.fromObject([startPosition, endPosition])
      }
    }
    return { error }
  }
}

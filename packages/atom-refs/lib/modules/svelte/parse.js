'use babel'

import { Range } from 'atom'
const escope = require('atom-references-escope')

/* eslint-disable-plugin import */
// nothing cut it: using import kills eslint :(
// import { compile, parse } from './svelte'
const { compile, parse } = require('./svelte')

const PARSE_WITH_COMPILE = false

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

const analyzeScopes = ({ module: mod, instance, html }) => {
  const escopeOptions = { ecmaVersion: 10, sourceType: 'module' }

  const body = [...[mod, instance].map(getScriptFragment), html]
    // const body = [
    //   module && module.content && module.content.body,
    //   instance && instance.content && instance.content.body,
    //   html,
    // ]
    .filter(Boolean)
    .sort(({ start: left }, { start: right }) => left - right)

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
  ast.scopeManager = analyzeScopes(ast.ast)
  return { ast }
}

const parseWithParse = code => {
  const ast = parse(code)
  const scopeManager = analyzeScopes(ast)
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

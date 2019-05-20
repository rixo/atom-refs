'use babel'

import { lazy } from './util'
import { createLocator } from '../util'

const scopes = [
  'source.js',
  'source.js.jsx',
  'source.babel',
  'text.html.basic',
  'text.html.vue',
  'source.svelte',
]

const parse = lazy(createParser)
const findReferences = lazy(
  () => require('./js-find-occurrences').findReferences
)

export default {
  scopes,
  parse,
  findReferences,
}

function createParser() {
  const { parse } = require('babylon')
  const isBabelParser = false
  // const parsePlugins = [
  //   'estree',
  //   'jsx',
  //   // 'flow',
  //   'flowComments',
  //   'typescript',
  //   'objectRestSpread',
  // ]
  const parsePlugins = ['*']

  const ERR_MODULE = `'import' and 'export' may appear only with 'sourceType: "module"'`
  const isModuleError = err =>
    err instanceof SyntaxError &&
    err.message.substr(0, ERR_MODULE.length) === ERR_MODULE

  const defaultSourceType = isBabelParser ? 'unambiguous' : 'script'

  const scriptRe = /(^[\s\S]*<script\b[^>]*>)([\s\S]*)<\/script>/

  const htmlScopes = ['source.svelte', 'text.html.vue', 'text.html.basic']
  const isHtml = editor => {
    const scopeName = editor.getGrammar().scopeName
    return htmlScopes.some(scope => scope === scopeName)
  }

  const parseSourceCode = (editor, code) => {
    if (editor === null) {
      return { code }
    }
    let sourceType
    if (isHtml(editor)) {
      sourceType = 'module'
      const match = scriptRe.exec(code)
      if (match && match[2]) {
        const numLines = match[1].split('\n').length
        const padding = Array(numLines).join('\n')
        code = padding + match[2]
      } else {
        code = ''
      }
    }
    const locator = createLocator(code)
    return { code, locator, sourceType }
  }

  const parseAs = ({ code, editor }, sourceType = defaultSourceType) => {
    let ast
    let error
    const {
      code: source,
      locator,
      sourceType: parsedSourceType,
    } = parseSourceCode(editor, code)
    try {
      ast = parse(source, {
        sourceType: parsedSourceType || sourceType,
        plugins: parsePlugins,
        // TODO command toggle strictMode
        // strictMode: false,
        // startLine,
      })
    } catch (err) {
      if (sourceType === 'script' && isModuleError(err)) {
        return parseAs({ code: source, editor: null }, 'module')
      } else if (err instanceof SyntaxError && err.loc) {
        error = err
      } else {
        // die hard on unexpected errors
        throw err
      }
    }
    return { ast, error, locator }
  }

  return state => parseAs(state, defaultSourceType)
}

'use babel'

import { createLocator } from '../../util'

const { parse } = require('@babel/parser')
const isBabelParser = true
const parsePlugins = [
  // WARNING NOT estree, not same node types:
  // see: https://babeljs.io/docs/en/babel-parser#output
  // 'estree',
  'jsx',
  'flow',
  'flowComments',
  // 'typescript',
  'objectRestSpread',
  'v8intrinsic',
  'asyncGenerators',
  'bigInt',
  'classProperties',
  'classPrivateMethods',
  ['decorators', { decoratorsBeforeExport: true }],
  'doExpressions',
  'dynamicImport',
  'exportDefaultFrom',
  'exportNamespaceFrom',
  'functionBind',
  'functionSent',
  'importMeta',
  'logicalAssignment',
  'nullishCoalescingOperator',
  'numericSeparator',
  'objectRestSpread',
  'optionalCatchBinding',
  'optionalChaining',
  'optionalApplication',
  ['pipelineOperator', { proposal: 'smart' }],
  'throwExpressions',
]
// const parsePlugins = ['*']

const ERR_MODULE = `'import' and 'export' may appear only with 'sourceType: "module"'`
const isModuleError = err =>
  err instanceof SyntaxError &&
  err.message.substr(0, ERR_MODULE.length) === ERR_MODULE

const defaultSourceType = isBabelParser ? 'unambiguous' : 'script'

const scriptRe = /(^[\s\S]*<script\b[^>]*>)([\s\S]*)<\/script>/

const htmlScopes = ['source.svelte', 'text.html.vue', 'text.html.basic']
const isHtml = scopeName => htmlScopes.some(scope => scope === scopeName)

const parseSourceCode = (scopeName, code, asHtml) => {
  const isHtmlSource = asHtml != null ? asHtml : scopeName && isHtml(scopeName)
  let sourceType
  if (isHtmlSource) {
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

const parseAs = ({ code, scopeName }, sourceType = defaultSourceType) => {
  let ast
  let error
  const {
    code: source,
    locator,
    sourceType: parsedSourceType,
  } = parseSourceCode(scopeName, code)
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
      // TODO should scopeName be passed here? (it was when I refactored
      // editor -> scopeName, but I'm not sure why...)
      return parseAs({ code: source }, 'module')
    } else if (err instanceof SyntaxError && err.loc) {
      error = err
    } else {
      // die hard on unexpected errors
      throw err
    }
  }
  return { ast, error, locator }
}

export default state => parseAs(state, defaultSourceType)

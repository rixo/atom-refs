'use babel'

import {lazy} from './util'

const scopes = [
  'source.js',
  'source.js.jsx',
  'source.babel',
  'text.html.basic',
  'text.html.vue',
]

const parse = lazy(createParser)
const findReferences = lazy(() => require('./js-find-occurrences').findReferences)

export default {
  scopes,
  parse,
  findReferences,
}

function createParser() {
  const {parse} = require('babylon')
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
    err instanceof SyntaxError
    && err.message.substr(0, ERR_MODULE.length) === ERR_MODULE

  const defaultSourceType = isBabelParser ? 'unambiguous' : 'script'

  const parseAs = (code, sourceType = defaultSourceType) => {
    let ast
    let error
    try {
      ast = parse(code, {
        sourceType,
        plugins: parsePlugins,
        // ranges: [],
        // startLine: 1,
      })
    } catch (err) {
      if (sourceType === 'script' && isModuleError(err)) {
        return parseAs(code, 'module')
      } else if (err instanceof SyntaxError && err.loc) {
        error = err
      } else {
        // die hard on unexpected errors
        throw err
      }
    }
    return {ast, error}
  }

  return code => parseAs(code, defaultSourceType)
}

'use babel'

// import {parse} from '@babel/parser'
import {parse} from 'babylon'

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

export const tryParse = (code, sourceType = defaultSourceType) => {
  let ast
  let error
  console.log('parse', sourceType)
  try {
    ast = parse(code, {
      sourceType,
      plugins: parsePlugins,
      // ranges: [],
      // startLine: 1,
    })
  } catch (err) {
    if (sourceType === 'script' && isModuleError(err)) {
      return tryParse(code, 'module')
    } else if (err instanceof SyntaxError && err.loc) {
      error = err
    } else {
      // die hard on unexpected errors
      throw err
    }
  }
  return {ast, error}
}

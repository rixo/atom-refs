'use babel'

const parsers = {}
const scopeParsers = {
  'source.js': 'JS',
  'source.js.jsx': 'JS',
  'source.babel': 'JS',
  'text.html.basic': 'JS',
  'text.html.vue': 'JS',
  'text.html.php': 'PHP',
}
const parserFactories = {
  JS: createJsParser,
  PHP: createPhpParser,
}
// import {parse} from '@babel/parser'
// import {parse} from 'babylon'
// import PhpParser from 'php-parser'

export const getScopeParser = scopeName => {
  const type = scopeParsers[scopeName]
  if (!type) {
    throw new Error(`No parser for scope ${scopeName}`)
  }
  return getParser(type)
}

const getParser = type => {
  const existing = parsers[type]
  if (existing) {
    return existing
  }
  const instance = createParser(type)
  parsers[type] = instance
  return instance
}

const createParser = type => {
  const factory = parserFactories[type]
  if (!factory) {
    throw new Error(`No factory for type ${type}`)
  }
  return factory()
}

function createJsParser() {
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
        return tryParse(code, 'module')
      } else if (err instanceof SyntaxError && err.loc) {
        error = err
      } else {
        // die hard on unexpected errors
        throw err
      }
    }
    return { ast, error }
  }

  return code => parseAs(code, defaultSourceType)
}

function createPhpParser() {
  const PhpParser = require('php-parser')
  const parser = new PhpParser({
    parser: {
      extraDoc: true,
      php7: true,
    },
    ast: {
      withPositions: true,
    },
  })
  return code => parser.parseCode(code)
}

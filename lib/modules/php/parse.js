'use babel'

import PhpParser from 'php-parser'

const parser = new PhpParser({
  parser: {
    extraDoc: true,
    php7: true,
    // locations: true,
  },
  lexer: {
    short_tags: true,
  },
  ast: {
    withPositions: true,
    withSource: true, // needed to determine precise function name loc
  },
})

export default ({ code }) => {
  try {
    const ast = parser.parseCode(code)
    return { ast }
  } catch (error) {
    if (error.lineNumber && error.columnNumber) {
      error.loc = {
        line: error.lineNumber,
        column: error.columnNumber,
      }
    }
    return { error }
  }
}
